/**
 * Mumble OCB2-AES128 Encryption
 *
 * Implements the OCB2 (Offset Codebook Mode 2) authenticated encryption
 * used by Mumble for UDP voice packets.
 */

import * as crypto from 'crypto';

const BLOCK_SIZE = 16;

export class MumbleCrypto {
  private key: Buffer;
  private encryptNonce: Buffer;
  private decryptNonce: Buffer;
  // Decrypt history tracks the second byte of decrypt IV for each first byte value
  // Used to detect replay attacks
  private decryptHistory: number[] = new Array(256).fill(0);

  // Precomputed AES encryption of zeros for OCB
  private aesZero: Buffer;

  constructor(key: Buffer, clientNonce: Buffer, serverNonce: Buffer) {
    if (key.length !== 16) throw new Error('Key must be 16 bytes');
    if (clientNonce.length !== 16) throw new Error('Client nonce must be 16 bytes');
    if (serverNonce.length !== 16) throw new Error('Server nonce must be 16 bytes');

    this.key = key;
    this.encryptNonce = Buffer.from(clientNonce);
    this.decryptNonce = Buffer.from(serverNonce);

    // Precompute AES(key, 0)
    const cipher = crypto.createCipheriv('aes-128-ecb', this.key, null);
    cipher.setAutoPadding(false);
    this.aesZero = cipher.update(Buffer.alloc(BLOCK_SIZE));
  }

  /**
   * Get the current encrypt nonce (IV).
   * Used for responding to server resync requests.
   */
  getEncryptIV(): Buffer {
    return Buffer.from(this.encryptNonce);
  }

  /**
   * Get the current decrypt nonce (IV).
   * Used for requesting server resync.
   */
  getDecryptIV(): Buffer {
    return Buffer.from(this.decryptNonce);
  }

  /**
   * Set the decrypt nonce (IV) from a server resync response.
   */
  setDecryptIV(iv: Buffer): boolean {
    if (iv.length !== BLOCK_SIZE) return false;
    iv.copy(this.decryptNonce);
    return true;
  }

  private aesEncrypt(block: Buffer): Buffer {
    const cipher = crypto.createCipheriv('aes-128-ecb', this.key, null);
    cipher.setAutoPadding(false);
    return cipher.update(block);
  }

  private aesDecrypt(block: Buffer): Buffer {
    const decipher = crypto.createDecipheriv('aes-128-ecb', this.key, null);
    decipher.setAutoPadding(false);
    return decipher.update(block);
  }

  private xorBuffers(a: Buffer, b: Buffer): Buffer {
    const result = Buffer.alloc(a.length) as Buffer;
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] ^ b[i];
    }
    return result;
  }

  // OCB2 S2 (multiply by 2 in GF(2^128))
  private s2(block: Buffer): Buffer {
    const result = Buffer.alloc(BLOCK_SIZE);
    let carry = 0;

    for (let i = BLOCK_SIZE - 1; i >= 0; i--) {
      const tmp = (block[i] << 1) | carry;
      result[i] = tmp & 0xff;
      carry = (block[i] & 0x80) ? 1 : 0;
    }

    if (carry) {
      result[BLOCK_SIZE - 1] ^= 0x87; // Reduction polynomial
    }

    return result;
  }

  // OCB2 S3 (multiply by 3 in GF(2^128))
  private s3(block: Buffer): Buffer {
    return this.xorBuffers(this.s2(block), block);
  }

  decrypt(encrypted: Buffer): Buffer | null {
    if (encrypted.length < 4) return null;

    // First byte is the low byte of the sender's encrypt IV
    const ivbyte = encrypted[0];

    // Save current decrypt IV in case we need to restore it
    const saveiv = Buffer.from(this.decryptNonce);
    let restore = false;

    // Check if this is the next expected packet (in order)
    const expectedNext = (this.decryptNonce[0] + 1) & 0xFF;

    if (expectedNext === ivbyte) {
      // In order as expected
      if (ivbyte > this.decryptNonce[0]) {
        this.decryptNonce[0] = ivbyte;
      } else if (ivbyte < this.decryptNonce[0]) {
        // Wrapped around
        this.decryptNonce[0] = ivbyte;
        for (let i = 1; i < BLOCK_SIZE; i++) {
          this.decryptNonce[i]++;
          if (this.decryptNonce[i] !== 0) break;
        }
      } else {
        // ivbyte === decryptNonce[0], this shouldn't happen for expectedNext
        return null;
      }
    } else {
      // Out of order or repeat packet
      let diff = ivbyte - this.decryptNonce[0];
      if (diff > 128) diff -= 256;
      else if (diff < -128) diff += 256;

      if (ivbyte < this.decryptNonce[0] && diff > -30 && diff < 0) {
        // Late packet, but no wraparound
        this.decryptNonce[0] = ivbyte;
        restore = true;
      } else if (ivbyte > this.decryptNonce[0] && diff > -30 && diff < 0) {
        // Late packet with wraparound (e.g., last was 0x02, here comes 0xff from previous round)
        this.decryptNonce[0] = ivbyte;
        for (let i = 1; i < BLOCK_SIZE; i++) {
          if (this.decryptNonce[i]-- !== 0) break;
        }
        restore = true;
      } else if (ivbyte > this.decryptNonce[0] && diff > 0) {
        // Lost some packets, but we're good
        this.decryptNonce[0] = ivbyte;
      } else if (ivbyte < this.decryptNonce[0] && diff > 0) {
        // Lost some packets and wrapped around
        this.decryptNonce[0] = ivbyte;
        for (let i = 1; i < BLOCK_SIZE; i++) {
          this.decryptNonce[i]++;
          if (this.decryptNonce[i] !== 0) break;
        }
      } else {
        return null;
      }

      // Check decrypt history to avoid replay attacks
      if (this.decryptHistory[this.decryptNonce[0]] === this.decryptNonce[1]) {
        this.decryptNonce = saveiv;
        return null;
      }
    }

    // Get tag and ciphertext
    const tag = encrypted.subarray(1, 4);
    const ciphertext = encrypted.subarray(4);

    // Decrypt using OCB2
    const result = this.ocb2Decrypt(ciphertext, tag);

    if (!result) {
      // Decryption/tag verification failed, restore IV
      saveiv.copy(this.decryptNonce);
      return null;
    }

    // Update decrypt history
    this.decryptHistory[this.decryptNonce[0]] = this.decryptNonce[1];

    // Restore IV if this was a late packet
    if (restore) {
      saveiv.copy(this.decryptNonce);
    }

    return result;
  }

  private ocb2Decrypt(ciphertext: Buffer, expectedTag: Buffer): Buffer | null {
    if (ciphertext.length === 0) {
      return Buffer.alloc(0);
    }

    const plaintext: Buffer = Buffer.alloc(ciphertext.length);

    // Initialize offset
    let offset = this.aesEncrypt(this.decryptNonce);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let checksum: any = Buffer.alloc(BLOCK_SIZE);

    const fullBlocks = Math.floor(ciphertext.length / BLOCK_SIZE);

    // Process full blocks
    for (let i = 0; i < fullBlocks; i++) {
      const blockStart = i * BLOCK_SIZE;
      const block = ciphertext.subarray(blockStart, blockStart + BLOCK_SIZE);

      offset = this.s2(offset);
      // OCB2 decryption: P = D(K, C XOR offset) XOR offset
      const decrypted = this.xorBuffers(
        this.aesDecrypt(this.xorBuffers(block, offset)),
        offset
      );

      decrypted.copy(plaintext, blockStart);
      checksum = this.xorBuffers(checksum, decrypted);
    }

    // Process final partial block
    const remaining = ciphertext.length % BLOCK_SIZE;
    if (remaining > 0) {
      offset = this.s2(offset);

      // OCB2: pad = AES(offset XOR (len * 8))
      // len * 8 is the bit length, stored in the last 4 bytes (big-endian)
      const lenBlock = Buffer.alloc(BLOCK_SIZE);
      const bitLen = remaining * 8;
      lenBlock[BLOCK_SIZE - 1] = bitLen & 0xFF;
      lenBlock[BLOCK_SIZE - 2] = (bitLen >> 8) & 0xFF;
      lenBlock[BLOCK_SIZE - 3] = (bitLen >> 16) & 0xFF;
      lenBlock[BLOCK_SIZE - 4] = (bitLen >> 24) & 0xFF;

      const pad = this.aesEncrypt(this.xorBuffers(offset, lenBlock));

      // Mumble's OCB2: checksum = checksum XOR [plaintext, pad[remaining:16]]
      const lastBlockStart = fullBlocks * BLOCK_SIZE;
      for (let i = 0; i < remaining; i++) {
        plaintext[lastBlockStart + i] = ciphertext[lastBlockStart + i] ^ pad[i];
        checksum[i] ^= plaintext[lastBlockStart + i];
      }
      // XOR the remaining pad bytes into checksum (not 0x80 padding!)
      for (let i = remaining; i < BLOCK_SIZE; i++) {
        checksum[i] ^= pad[i];
      }
    }

    // Compute tag
    offset = this.s3(offset);
    const computedTag = this.aesEncrypt(this.xorBuffers(checksum, offset));

    // Verify tag (only first 3 bytes in Mumble)
    if (computedTag[0] !== expectedTag[0] ||
        computedTag[1] !== expectedTag[1] ||
        computedTag[2] !== expectedTag[2]) {
      return null; // Authentication failed
    }

    return plaintext;
  }

  encrypt(plaintext: Buffer): Buffer {
    // Increment encrypt nonce
    for (let i = 0; i < BLOCK_SIZE; i++) {
      this.encryptNonce[i]++;
      if (this.encryptNonce[i] !== 0) break;
    }

    const { ciphertext, tag } = this.ocb2Encrypt(plaintext);

    // Build packet: [header:1] [tag:3] [ciphertext]
    const result = Buffer.alloc(1 + 3 + ciphertext.length);
    result[0] = this.encryptNonce[0];
    tag.copy(result, 1, 0, 3);
    ciphertext.copy(result, 4);

    return result;
  }

  private ocb2Encrypt(plaintext: Buffer): { ciphertext: Buffer; tag: Buffer } {
    const ciphertext = Buffer.alloc(plaintext.length);

    // Initialize offset
    let offset = this.aesEncrypt(this.encryptNonce);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let checksum: any = Buffer.alloc(BLOCK_SIZE);

    const fullBlocks = Math.floor(plaintext.length / BLOCK_SIZE);

    // Process full blocks
    for (let i = 0; i < fullBlocks; i++) {
      const blockStart = i * BLOCK_SIZE;
      const block = plaintext.slice(blockStart, blockStart + BLOCK_SIZE);

      offset = this.s2(offset);
      checksum = this.xorBuffers(checksum, block);

      const encrypted = this.xorBuffers(
        this.aesEncrypt(this.xorBuffers(block, offset)),
        offset
      );

      encrypted.copy(ciphertext, blockStart);
    }

    // Process final partial block
    const remaining = plaintext.length % BLOCK_SIZE;
    if (remaining > 0) {
      offset = this.s2(offset);

      // OCB2: pad = AES(offset XOR (len * 8))
      // len * 8 is the bit length, stored in the last 4 bytes (big-endian)
      const lenBlock = Buffer.alloc(BLOCK_SIZE);
      const bitLen = remaining * 8;
      lenBlock[BLOCK_SIZE - 1] = bitLen & 0xFF;
      lenBlock[BLOCK_SIZE - 2] = (bitLen >> 8) & 0xFF;
      lenBlock[BLOCK_SIZE - 3] = (bitLen >> 16) & 0xFF;
      lenBlock[BLOCK_SIZE - 4] = (bitLen >> 24) & 0xFF;

      const pad = this.aesEncrypt(this.xorBuffers(offset, lenBlock));

      // Mumble's OCB2: checksum = checksum XOR [plaintext, pad[remaining:16]]
      // First XOR plaintext bytes, then XOR remaining pad bytes
      const lastBlockStart = fullBlocks * BLOCK_SIZE;
      for (let i = 0; i < remaining; i++) {
        ciphertext[lastBlockStart + i] = plaintext[lastBlockStart + i] ^ pad[i];
        checksum[i] ^= plaintext[lastBlockStart + i];
      }
      // XOR the remaining pad bytes into checksum (not 0x80 padding!)
      for (let i = remaining; i < BLOCK_SIZE; i++) {
        checksum[i] ^= pad[i];
      }
    }

    // Compute tag
    offset = this.s3(offset);
    const tag = this.aesEncrypt(this.xorBuffers(checksum, offset));

    return { ciphertext, tag };
  }
}
