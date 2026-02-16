/**
 * Mumble TLS Connection Handler
 *
 * Handles low-level TCP/TLS communication with Mumble servers.
 * Packet format: [2 bytes: type (BE)] [4 bytes: length (BE)] [payload]
 */

import * as tls from 'tls';
import { EventEmitter } from 'events';
import { MessageType } from './types';

const HEADER_SIZE = 6;
const MAX_MESSAGE_SIZE = 0x7fffff;

export interface ConnectionOptions {
  host: string;
  port: number;
  rejectUnauthorized?: boolean;
  key?: string | Buffer;
  cert?: string | Buffer;
}

interface ParseState {
  buffer: Buffer;
  expectedLength: number;
  messageType: MessageType;
  state: 'header' | 'payload';
}

export class MumbleConnection extends EventEmitter {
  private socket: tls.TLSSocket | null = null;
  private parseState: ParseState;
  private connected = false;
  private _backpressure = false;

  constructor() {
    super();
    this.parseState = {
      buffer: Buffer.alloc(0),
      expectedLength: HEADER_SIZE,
      messageType: MessageType.Version,
      state: 'header',
    };
  }

  /**
   * Returns true if the TCP write buffer is full (backpressured).
   * When backpressured, callers should drop non-essential data like audio frames.
   */
  isBackpressured(): boolean {
    return this._backpressure;
  }

  connect(options: ConnectionOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const tlsOptions: tls.ConnectionOptions = {
        host: options.host,
        port: options.port,
        rejectUnauthorized: options.rejectUnauthorized ?? false,
        key: options.key,
        cert: options.cert,
      };

      this.socket = tls.connect(tlsOptions, () => {
        this.connected = true;
        this.emit('connected');
        resolve();
      });

      this.socket.setNoDelay(true);

      this.socket.on('data', (data) => this.handleData(data));

      // Handle TCP backpressure - drain event fires when buffer empties
      this.socket.on('drain', () => {
        this._backpressure = false;
        this.emit('drain');
      });

      this.socket.on('error', (err) => {
        this.emit('error', err);
        if (!this.connected) {
          reject(err);
        }
      });

      this.socket.on('close', (hadError) => {
        this.connected = false;
        this.emit('disconnected', hadError ? 'error' : 'closed');
      });

      this.socket.on('end', () => {
        this.emit('disconnected', 'server closed connection');
      });

      this.socket.on('timeout', () => {
        this.emit('error', new Error('Connection timeout'));
        this.socket?.destroy();
      });
    });
  }

  private handleData(data: Buffer): void {
    this.parseState.buffer = Buffer.concat([this.parseState.buffer, data]);

    // Parse and emit all complete messages
    while (this.parseState.buffer.length >= this.parseState.expectedLength) {
      if (this.parseState.state === 'header') {
        const type = this.parseState.buffer.readUInt16BE(0);
        const length = this.parseState.buffer.readUInt32BE(2);

        if (length > MAX_MESSAGE_SIZE) {
          this.emit('error', new Error(`Message size ${length} exceeds maximum ${MAX_MESSAGE_SIZE}`));
          this.socket?.destroy();
          return;
        }

        this.parseState.messageType = type as MessageType;
        this.parseState.buffer = this.parseState.buffer.subarray(HEADER_SIZE);
        this.parseState.expectedLength = length;
        this.parseState.state = 'payload';

        if (length === 0) {
          this.emit('message', this.parseState.messageType, Buffer.alloc(0));
          this.parseState.expectedLength = HEADER_SIZE;
          this.parseState.state = 'header';
        }
      } else {
        const payload = Buffer.from(this.parseState.buffer.subarray(0, this.parseState.expectedLength));
        this.parseState.buffer = this.parseState.buffer.subarray(this.parseState.expectedLength);
        const messageType = this.parseState.messageType;

        this.parseState.expectedLength = HEADER_SIZE;
        this.parseState.state = 'header';

        this.emit('message', messageType, payload);
      }
    }
  }

  /**
   * Send a message over the TCP connection.
   * @returns true if the write succeeded, false if backpressured
   */
  send(type: MessageType, payload: Uint8Array): boolean {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected');
    }

    // Combine header and payload into single buffer for single syscall
    const packet = Buffer.alloc(HEADER_SIZE + payload.length);
    packet.writeUInt16BE(type, 0);
    packet.writeUInt32BE(payload.length, 2);
    if (payload.length > 0) {
      Buffer.from(payload).copy(packet, HEADER_SIZE);
    }

    // Write returns false when kernel buffer is full
    const ok = this.socket.write(packet);
    if (!ok) {
      this._backpressure = true;
    }
    return ok;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this._backpressure = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
