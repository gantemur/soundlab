/* Capture Sound Lab's own Web Audio output as a short mono PCM WAV.
 * No microphone, MediaRecorder codec, network service, or dependency is used.
 */
(function (root, makeRecorder) {
  "use strict";
  const wav = typeof module === "object" && module.exports ? require("./sound-wav.js") : root.SoundLabWav;
  const api = makeRecorder(wav);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabRecorder = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (wav) {
  "use strict";

  const MAX_SECONDS = 30;

  function encodeWav(blocks, sampleRate) {
    return wav.encodeWav(blocks, sampleRate, { maxSeconds: MAX_SECONDS, nonFinite: "silence" });
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
