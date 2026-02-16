/**
 * Mumble UDP Voice Handler
 *
 * Handles UDP communication for voice data.
 */

import * as dgram from 'dgram';
import { EventEmitter } from 'events';
import { MumbleCrypto } from './crypto';

export interface UdpOptions {
  host: string;
  port: number;
}

export class MumbleUdp extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private crypto: MumbleCrypto | null = null;
  private host: string;
  private port: number;
  private connected = false;
  private serverResponded = false; // True once we receive any UDP from server

  constructor(options: UdpOptions) {
    super();
    this.host = options.host;
    this.port = options.port;
  }

  setupCrypto(key: Buffer, clientNonce: Buffer, serverNonce: Buffer): void {
    this.crypto = new MumbleCrypto(key, clientNonce, serverNonce);
  }

  /**
   * Get the current encrypt IV for responding to server resync requests.
   */
  getEncryptIV(): Buffer | null {
    return this.crypto?.getEncryptIV() ?? null;
  }

  /**
   * Set the decrypt IV from a server resync response.
   */
  setDecryptIV(iv: Buffer): boolean {
    if (!this.crypto) return false;
    return this.crypto.setDecryptIV(iv);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');

      this.socket.on('message', (msg) => {
        this.handleMessage(msg);
      });

      this.socket.on('error', (err) => {
        this.emit('error', err);
        if (!this.connected) {
          reject(err);
        }
      });

      this.socket.on('listening', () => {
        this.connected = true;
        // Send initial ping to establish NAT mapping
        this.sendPing();
        resolve();
      });

      // Bind to any available port
      this.socket.bind();
    });
  }

  private handleMessage(msg: Buffer): void {
    if (!this.crypto) {
      this.emit('error', new Error('Crypto not initialized'));
      return;
    }

    // Decrypt the message
    const decrypted = this.crypto.decrypt(msg);
    if (!decrypted) {
      // Decryption failed - could be late/duplicate packet
      return;
    }

    // Mark that server has responded - UDP is working
    if (!this.serverResponded) {
      this.serverResponded = true;
      this.emit('established');
    }

    // Parse voice packet
    this.parseVoicePacket(decrypted);
  }

  private parseVoicePacket(data: Buffer): void {
    if (data.length < 1) return;

    const typeTarget = data[0];
    const type = (typeTarget >> 5) & 0x07;

    // Types: 0=CELT Alpha, 1=Ping, 2=Speex, 3=CELT Beta, 4=Opus
    if (type === 1) {
      // Ping packet
      this.emit('ping', data);
      return;
    }

    // Parse Mumble varint for session ID (MSB-first encoding)
    const { value: session } = this.readMumbleVarint(data, 1);

    if (session > 0) {
      this.emit('voice', { session, type, data });
    }
  }

  /**
   * Read Mumble's custom MSB-first varint encoding.
   * Different from protobuf's LSB-first encoding.
   */
  private readMumbleVarint(data: Buffer, offset: number): { value: number; bytesRead: number } {
    if (offset >= data.length) return { value: 0, bytesRead: 0 };

    const v = data[offset];

    if ((v & 0x80) === 0x00) {
      // 0xxxxxxx - 7 bit value
      return { value: v & 0x7F, bytesRead: 1 };
    } else if ((v & 0xC0) === 0x80) {
      // 10xxxxxx - 14 bit value
      if (offset + 1 >= data.length) return { value: 0, bytesRead: 1 };
      return { value: ((v & 0x3F) << 8) | data[offset + 1], bytesRead: 2 };
    } else if ((v & 0xE0) === 0xC0) {
      // 110xxxxx - 21 bit value
      if (offset + 2 >= data.length) return { value: 0, bytesRead: 1 };
      return {
        value: ((v & 0x1F) << 16) | (data[offset + 1] << 8) | data[offset + 2],
        bytesRead: 3,
      };
    } else if ((v & 0xF0) === 0xE0) {
      // 1110xxxx - 28 bit value
      if (offset + 3 >= data.length) return { value: 0, bytesRead: 1 };
      return {
        value: ((v & 0x0F) << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3],
        bytesRead: 4,
      };
    } else if ((v & 0xF8) === 0xF0) {
      // 11110xxx - 32 bit value
      if (offset + 4 >= data.length) return { value: 0, bytesRead: 1 };
      return {
        value: (data[offset + 1] << 24) | (data[offset + 2] << 16) | (data[offset + 3] << 8) | data[offset + 4],
        bytesRead: 5,
      };
    }

    return { value: 0, bytesRead: 1 };
  }

  /**
   * Write Mumble's custom MSB-first varint encoding.
   * This is the format used in UDP voice/ping packets.
   * Returns the number of bytes written.
   */
  private writeMumbleVarint(buffer: Buffer, offset: number, value: bigint): number {
    const i = value;

    if (i < 0x80n) {
      // 7-bit value: 0xxxxxxx
      buffer[offset] = Number(i);
      return 1;
    } else if (i < 0x4000n) {
      // 14-bit value: 10xxxxxx xxxxxxxx
      buffer[offset] = Number((i >> 8n) | 0x80n);
      buffer[offset + 1] = Number(i & 0xFFn);
      return 2;
    } else if (i < 0x200000n) {
      // 21-bit value: 110xxxxx xxxxxxxx xxxxxxxx
      buffer[offset] = Number((i >> 16n) | 0xC0n);
      buffer[offset + 1] = Number((i >> 8n) & 0xFFn);
      buffer[offset + 2] = Number(i & 0xFFn);
      return 3;
    } else if (i < 0x10000000n) {
      // 28-bit value: 1110xxxx xxxxxxxx xxxxxxxx xxxxxxxx
      buffer[offset] = Number((i >> 24n) | 0xE0n);
      buffer[offset + 1] = Number((i >> 16n) & 0xFFn);
      buffer[offset + 2] = Number((i >> 8n) & 0xFFn);
      buffer[offset + 3] = Number(i & 0xFFn);
      return 4;
    } else if (i < 0x100000000n) {
      // 32-bit value: 11110000 xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx
      buffer[offset] = 0xF0;
      buffer[offset + 1] = Number((i >> 24n) & 0xFFn);
      buffer[offset + 2] = Number((i >> 16n) & 0xFFn);
      buffer[offset + 3] = Number((i >> 8n) & 0xFFn);
      buffer[offset + 4] = Number(i & 0xFFn);
      return 5;
    } else {
      // 64-bit value: 11110100 + 8 bytes
      buffer[offset] = 0xF4;
      buffer[offset + 1] = Number((i >> 56n) & 0xFFn);
      buffer[offset + 2] = Number((i >> 48n) & 0xFFn);
      buffer[offset + 3] = Number((i >> 40n) & 0xFFn);
      buffer[offset + 4] = Number((i >> 32n) & 0xFFn);
      buffer[offset + 5] = Number((i >> 24n) & 0xFFn);
      buffer[offset + 6] = Number((i >> 16n) & 0xFFn);
      buffer[offset + 7] = Number((i >> 8n) & 0xFFn);
      buffer[offset + 8] = Number(i & 0xFFn);
      return 9;
    }
  }

  sendPing(): void {
    if (!this.socket || !this.crypto) return;

    // Ping packet: type=1 (ping) in upper 3 bits
    const pingData = Buffer.alloc(12); // Max size for header + 64-bit varint
    pingData[0] = (1 << 5); // Type 1 = ping

    // Add timestamp using MSB-first Mumble varint encoding
    const timestamp = BigInt(Date.now());
    const varintLen = this.writeMumbleVarint(pingData, 1, timestamp);

    const plaintext = pingData.subarray(0, 1 + varintLen);
    const encrypted = this.crypto.encrypt(plaintext);

    this.socket.send(encrypted, this.port, this.host);
  }

  send(data: Buffer): void {
    if (!this.socket || !this.crypto || !this.connected) return;

    const encrypted = this.crypto.encrypt(data);
    this.socket.send(encrypted, this.port, this.host);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.serverResponded = false;
    this.crypto = null;
  }

  isConnected(): boolean {
    // Only return true if we've received a response from the server
    // This ensures the server knows our UDP endpoint
    return this.connected && this.crypto !== null && this.serverResponded;
  }
}
