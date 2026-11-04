/* Audio thread: copy Sound Lab's mono audio into bounded chunks for WAV export.
 * The output remains silent; listening uses the regular parallel output route.
 */
class SolWavCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.maxFrames = Math.max(1, Math.floor(options.processorOptions.maxFrames));
    this.frames = 0;
    this.chunk = new Float32Array(2048);
    this.used = 0;
    this.finished = false;
    this.port.onmessage = event => {
      if (event.data?.type === "stop") this.finish();
    };
  }

  flush() {
    if (!this.used) return;
    const block = this.used === this.chunk.length ? this.chunk : this.chunk.slice(0, this.used);
    this.port.postMessage({ type: "samples", samples: block }, [block.buffer]);
    this.chunk = new Float32Array(2048);
    this.used = 0;
  }

  finish() {
    if (this.finished) return;
    this.flush();
    this.finished = true;
    this.port.postMessage({ type: "done" });
  }

  process(inputs, outputs) {
    if (this.finished) return false;
    const channels = inputs[0] || [];
    const frameCount = channels[0]?.length || outputs[0]?.[0]?.length || 128;
    for (let i = 0; i < frameCount && this.frames < this.maxFrames; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] || 0;
      this.chunk[this.used++] = channels.length ? sample / channels.length : 0;
      this.frames++;
      if (this.used === this.chunk.length) this.flush();
    }
    if (this.frames >= this.maxFrames) this.finish();
    return !this.finished;
  }
}

registerProcessor("sol-wav-capture", SolWavCaptureProcessor);
