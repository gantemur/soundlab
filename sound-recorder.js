/* Capture Sound Lab's own Web Audio output as a short mono PCM WAV.
 * No microphone, MediaRecorder codec, network service, or dependency is used.
 */
(function (root, makeRecorder) {
  "use strict";
  const api = makeRecorder();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabRecorder = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_SECONDS = 15;

  function encodeWav(blocks, sampleRate) {
    if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 || !Array.isArray(blocks)) {
      throw new RangeError("Invalid WAV sample rate or blocks");
    }
    let frames = 0;
    for (const block of blocks) {
      if (!(block instanceof Float32Array)) throw new TypeError("WAV blocks must be Float32Array");
      frames += block.length;
      if (frames > Math.ceil(sampleRate * MAX_SECONDS)) throw new RangeError("Recording too long");
    }
    const bytes = new Uint8Array(44 + frames * 2);
    const view = new DataView(bytes.buffer);
    const ascii = (offset, value) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    ascii(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); ascii(8, "WAVE");
    ascii(12, "fmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); // block alignment
    view.setUint16(34, 16, true);
    ascii(36, "data"); view.setUint32(40, frames * 2, true);
    let offset = 44;
    for (const block of blocks) {
      for (const value of block) {
        const sample = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
        view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
        offset += 2;
      }
    }
    return bytes;
  }

  class Recorder {
    constructor(contextOwner, WorkletNodeType) {
      this.contextOwner = contextOwner;
      this.WorkletNodeType = WorkletNodeType;
      this.state = "idle";
      this.generation = 0;
      this.loadedContext = null;
      this.node = null;
      this.keepAlive = null;
      this.timeout = null;
      this.blocks = [];
      this.frames = 0;
      this.sampleRate = 44100;
      this.startedAt = 0;
      this.onDone = () => {};
      this.onError = () => {};
    }

    get elapsed() {
      if (this.state === "recording") {
        return Math.min(MAX_SECONDS, Math.max(0, this.contextOwner.context.currentTime - this.startedAt));
      }
      return this.frames / this.sampleRate;
    }

    async start() {
      if (this.state !== "idle") return false;
      this.state = "starting";
      const ticket = ++this.generation;
      try {
        const context = await this.contextOwner.readyContext();
        if (ticket !== this.generation) return false;
        if (!context.audioWorklet || !this.WorkletNodeType || !context.createConstantSource) {
          throw new Error("unsupported");
        }
        if (this.loadedContext !== context) {
          await context.audioWorklet.addModule("sound-recorder-worklet.js");
          this.loadedContext = context;
        }
        if (ticket !== this.generation) return false;

        this.blocks = [];
        this.frames = 0;
        this.sampleRate = context.sampleRate;
        const node = new this.WorkletNodeType(context, "sol-wav-capture", {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
          processorOptions: { maxFrames: Math.ceil(context.sampleRate * MAX_SECONDS) }
        });
        this.node = node;
        node.port.onmessage = event => this.receive(event.data);
        node.onprocessorerror = () => this.fail(new Error("recording processor failed"));
        // Keep the capture clock running through pauses between notes and hits.
        const keepAlive = context.createConstantSource();
        this.keepAlive = keepAlive;
        keepAlive.offset.value = 0;
        this.contextOwner.output.connect(node);
        keepAlive.connect(node);
        node.connect(context.destination); // The recorder worklet emits silence, not a duplicate sound.
        this.startedAt = context.currentTime;
        this.state = "recording";
        keepAlive.start();
        return true;
      } catch (error) {
        if (ticket === this.generation) this.cleanup();
        throw error;
      }
    }

    receive(message) {
      if (this.state !== "recording" && this.state !== "stopping") return;
      if (message?.type === "samples" && message.samples instanceof Float32Array) {
        if (this.frames + message.samples.length <= Math.ceil(this.sampleRate * MAX_SECONDS)) {
          this.blocks.push(message.samples);
          this.frames += message.samples.length;
        }
      } else if (message?.type === "done") {
        this.complete();
      }
    }

    stop() {
      if (this.state === "starting") {
        this.generation++;
        this.cleanup();
        return true;
      }
      if (this.state !== "recording") return false;
      this.state = "stopping";
      this.node.port.postMessage({ type: "stop" });
      // A suspended or closing context may not deliver the final worklet message.
      this.timeout = setTimeout(() => this.complete(), 600);
      return true;
    }

    complete() {
      if (this.state !== "recording" && this.state !== "stopping") return;
      const blocks = this.blocks, frames = this.frames, sampleRate = this.sampleRate;
      this.cleanup();
      try { this.onDone(frames ? encodeWav(blocks, sampleRate) : null, frames / sampleRate); }
      catch (error) { this.onError(error); }
    }

    fail(error) {
      if (this.state === "idle") return;
      this.cleanup();
      this.onError(error);
    }

    cleanup() {
      this.generation++;
      if (this.timeout !== null) clearTimeout(this.timeout);
      this.timeout = null;
      if (this.keepAlive) {
        try { this.keepAlive.stop(); } catch (_) { /* Already stopped. */ }
        this.keepAlive.disconnect();
      }
      if (this.node) {
        if (this.contextOwner.output) {
          try { this.contextOwner.output.disconnect(this.node); } catch (_) { /* No active route. */ }
        }
        this.node.disconnect();
        this.node.port.onmessage = null;
        if (this.node.port.close) this.node.port.close();
      }
      this.keepAlive = null;
      this.node = null;
      this.blocks = [];
      this.frames = 0;
      this.state = "idle";
    }
  }

  return Object.freeze({ MAX_SECONDS, encodeWav, Recorder });
});
