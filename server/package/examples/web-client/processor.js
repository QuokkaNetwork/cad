// AudioWorklet processor for microphone capture
class MicProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.frameSize = options.processorOptions?.frameSize || 960;
    this.buffer = new Float32Array(0);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputChannel = input[0];

    // Append to buffer
    const newBuffer = new Float32Array(this.buffer.length + inputChannel.length);
    newBuffer.set(this.buffer);
    newBuffer.set(inputChannel, this.buffer.length);
    this.buffer = newBuffer;

    // Send complete frames
    while (this.buffer.length >= this.frameSize) {
      const frame = this.buffer.slice(0, this.frameSize);
      this.buffer = this.buffer.slice(this.frameSize);

      // Convert Float32 to Int16
      const int16Frame = new Int16Array(this.frameSize);
      for (let i = 0; i < this.frameSize; i++) {
        const s = Math.max(-1, Math.min(1, frame[i]));
        int16Frame[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Send to main thread
      this.port.postMessage(int16Frame.buffer, [int16Frame.buffer]);
    }

    return true;
  }
}

registerProcessor('mic-processor', MicProcessor);
