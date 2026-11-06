"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const wav = require("./sound-recorder.js");
const sharedWav = require("./sound-wav.js");

test("mono PCM WAV has the correct RIFF header, sample rate, duration and signed samples", () => {
  const bytes = wav.encodeWav([
    Float32Array.of(0, 0.5), Float32Array.of(-1, 1, -2, 2, NaN)
  ], 44100);
  const header = new DataView(bytes.buffer);
  const name = (at, count) => String.fromCharCode(...bytes.slice(at, at + count));
  assert.equal(name(0, 4), "RIFF");
  assert.equal(name(8, 4), "WAVE");
  assert.equal(name(12, 4), "fmt ");
  assert.equal(name(36, 4), "data");
  assert.equal(header.getUint32(4, true), bytes.length - 8);
  assert.equal(header.getUint16(20, true), 1);
  assert.equal(header.getUint16(22, true), 1);
  assert.equal(header.getUint32(24, true), 44100);
  assert.equal(header.getUint32(28, true), 88200);
  assert.equal(header.getUint16(34, true), 16);
  assert.equal(header.getUint32(40, true), 14);
  assert.deepEqual(Array.from({ length: 7 }, (_, i) => header.getInt16(44 + 2 * i, true)),
    [0, 16384, -32768, 32767, -32768, 32767, 0]);
  assert.equal(bytes.length, 58);
});

test("WAV encoder rejects invalid or oversized recordings", () => {
  assert.throws(() => wav.encodeWav([], 0), RangeError);
  assert.throws(() => wav.encodeWav([], 500000), RangeError);
  assert.throws(() => wav.encodeWav([new Int16Array(2)], 44100), TypeError);
  assert.throws(() => wav.encodeWav([new Float32Array(30 * 8000 + 1)], 8000), RangeError);
  assert.equal(wav.encodeWav([], 8000).length, 44);
});

test("shared WAV extraction preserves recorder bytes, non-finite policy and the 30-second ceiling", () => {
  assert.equal(wav.MAX_SECONDS, 30);
  const blocks = [Float32Array.of(-2, -1, -.5, 0, .5, 1, 2, NaN, Infinity, -Infinity)];
  assert.deepEqual(wav.encodeWav(blocks, 44100),
    sharedWav.encodeWav(blocks, 44100, { maxSeconds: 30, nonFinite: "silence" }));
  const sixteenSeconds = new Float32Array(16 * 8000);
  assert.equal(wav.encodeWav([sixteenSeconds], 8000).length, 44 + 16 * 8000 * 2);
  const thirtyOneSeconds = new Float32Array(31 * 8000);
  assert.doesNotThrow(() => sharedWav.encodeWav([thirtyOneSeconds], 8000));
  assert.throws(() => wav.encodeWav([thirtyOneSeconds], 8000), RangeError);
  for (const rate of [8000, 44100, 48000]) {
    const bytes = wav.encodeWav([new Float32Array(30 * rate)], rate);
    assert.equal(bytes.length, 44 + 30 * rate * 2);
    assert.equal(new DataView(bytes.buffer).getUint32(40, true), 30 * rate * 2);
    assert.throws(() => wav.encodeWav([new Float32Array(30 * rate + 1)], rate), RangeError);
  }
});

test("recorder browser entrypoint uses the shared encoder without starting audio", () => {
  const calls = [], expected = Uint8Array.of(1, 2, 3);
  const context = { SoundLabWav: { encodeWav(...args) { calls.push(args); return expected; } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "sound-recorder.js"), "utf8"), context);
  const blocks = [Float32Array.of(.5)];
  assert.equal(context.SoundLabRecorder.encodeWav(blocks, 44100), expected);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], blocks);
  assert.equal(calls[0][1], 44100);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), { maxSeconds: 30, nonFinite: "silence" });
});

test("audio worklet captures real samples, includes silence, limits length and never outputs audio", () => {
  let Processor;
  class FakeProcessor {
    constructor() { this.port = { messages: [], postMessage(message) { this.messages.push(message); } }; }
  }
  const code = fs.readFileSync(path.join(__dirname, "sound-recorder-worklet.js"), "utf8");
  vm.runInNewContext(code, {
    AudioWorkletProcessor: FakeProcessor,
    Float32Array,
    registerProcessor(name, ctor) { assert.equal(name, "sol-wav-capture"); Processor = ctor; }
  });
  const p = new Processor({ processorOptions: { maxFrames: 5 } });
  const output = [[new Float32Array(3)]];
  assert.equal(p.process([[
    Float32Array.of(0.2, 0.4, 0.6), Float32Array.of(0.4, 0.6, 0.8)
  ]], output), true);
  assert.deepEqual(Array.from(output[0][0]), [0, 0, 0]);
  assert.equal(p.process([[]], [[new Float32Array(4)]]), false);
  assert.equal(p.process([[]], [[new Float32Array(4)]]), false);
  assert.deepEqual(p.port.messages.map(x => x.type), ["samples", "done"]);
  const samples = Array.from(p.port.messages[0].samples);
  assert.equal(samples.length, 5);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(samples[i] - [0.3, 0.5, 0.7][i]) < 1e-6);
  assert.deepEqual(samples.slice(3), [0, 0]);

  const q = new Processor({ processorOptions: { maxFrames: 100 } });
  q.process([[Float32Array.of(0.25, 0.5)]], [[new Float32Array(2)]]);
  q.port.onmessage({ data: { type: "stop" } });
  assert.deepEqual(q.port.messages.map(x => x.type), ["samples", "done"]);
  assert.equal(q.port.messages[0].samples.length, 2);
});

test("worklet capture finishes at exactly 30 seconds, including a partial final render quantum", () => {
  let Processor;
  class FakeProcessor {
    constructor() { this.port = { messages: [], postMessage(message) { this.messages.push(message); } }; }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "sound-recorder-worklet.js"), "utf8"), {
    AudioWorkletProcessor: FakeProcessor, Float32Array,
    registerProcessor(name, ctor) { assert.equal(name, "sol-wav-capture"); Processor = ctor; }
  });
  for (const rate of [44100, 48000]) {
    const maxFrames = rate * 30, quantum = 128;
    const processor = new Processor({ processorOptions: { maxFrames } });
    const input = [[new Float32Array(quantum).fill(.25)]], output = [[new Float32Array(quantum)]];
    const blocks = Math.ceil(maxFrames / quantum);
    for (let i = 0; i < blocks; i++) {
      assert.equal(processor.process(input, output), i < blocks - 1);
    }
    assert.equal(processor.frames, maxFrames);
    assert.equal(processor.process(input, output), false);
    const samples = processor.port.messages.filter(message => message.type === "samples");
    assert.equal(samples.reduce((sum, message) => sum + message.samples.length, 0), maxFrames);
    assert.equal(samples[0].samples[0], .25);
    assert.equal(samples.at(-1).samples.at(-1), .25);
    assert.equal(processor.port.messages.filter(message => message.type === "done").length, 1);
    assert.ok(output[0][0].every(sample => sample === 0), "Capture must not double speaker output");
  }
});

test("recorder loads once, records through the shared bus and cleans up after Stop", async () => {
  const routes = [], modules = [], keepAlives = [], nodes = [];
  const output = {
    connect(node) { routes.push(["connect", node]); },
    disconnect(node) { routes.push(["disconnect", node]); }
  };
  const context = {
    sampleRate: 44100, currentTime: 10, destination: {},
    audioWorklet: { async addModule(path) { modules.push(path); } },
    createConstantSource() {
      const source = { offset: { value: null }, started: false, stopped: false,
        connect(node) { this.target = node; }, start() { this.started = true; },
        stop() { this.stopped = true; }, disconnect() {} };
      keepAlives.push(source);
      return source;
    }
  };
  class FakeWorkletNode {
    constructor(ctx, name, options) {
      assert.equal(ctx, context);
      assert.equal(name, "sol-wav-capture");
      assert.equal(options.processorOptions.maxFrames, 1323000);
      this.port = { sent: [], postMessage(message) { this.sent.push(message); }, close() {} };
      this.connected = false;
      nodes.push(this);
    }
    connect(target) { this.connected = target === context.destination; }
    disconnect() { this.connected = false; }
  }
  const recorder = new wav.Recorder({ context, output, readyContext: async () => context }, FakeWorkletNode);
  const result = [];
  recorder.onDone = (bytes, duration) => result.push({ bytes, duration });
  assert.equal(await recorder.start(), true);
  assert.equal(recorder.state, "recording");
  assert.equal(modules.join(), "sound-recorder-worklet.js");
  assert.equal(nodes[0].connected, true);
  assert.equal(keepAlives[0].started, true);
  assert.equal(keepAlives[0].offset.value, 0);
  assert.ok(routes.some(([action, node]) => action === "connect" && node === nodes[0]));
  context.currentTime = 9;
  assert.equal(recorder.elapsed, 0, "Elapsed cannot be negative");
  context.currentTime = 26;
  assert.equal(recorder.elapsed, 16, "The timer continues beyond the former 15-second limit");
  context.currentTime = 100;
  assert.equal(recorder.elapsed, 30, "The displayed timer cannot exceed the new cap");
  context.currentTime = 10;
  assert.equal(recorder.stop(), true);
  assert.equal(recorder.state, "stopping");
  assert.deepEqual(nodes[0].port.sent, [{ type: "stop" }]);
  recorder.receive({ type: "samples", samples: Float32Array.of(0, 0.5, -0.5) });
  recorder.receive({ type: "done" });
  assert.equal(result.length, 1);
  assert.equal(result[0].bytes.length, 50);
  assert.equal(result[0].duration, 3 / 44100);
  assert.equal(keepAlives[0].stopped, true);
  assert.equal(nodes[0].connected, false);
  assert.equal(recorder.state, "idle");
  assert.equal(await recorder.start(), true);
  assert.equal(modules.length, 1, "Worklet module must not reload on each recording");
  recorder.stop();
  recorder.receive({ type: "done" });
  assert.equal(result.length, 2);
  assert.equal(result[1].bytes, null, "No captured frames gives no misleading recording");
});

test("recorder bounds incoming samples at 30 seconds and completes once when the worklet reaches its cap", async () => {
  const nodes = [], keepAlives = [], results = [];
  const context = {
    sampleRate: 8000, currentTime: 0, destination: {},
    audioWorklet: { async addModule() {} },
    createConstantSource() {
      const source = { offset: { value: null }, stopped: false,
        connect() {}, start() {}, stop() { this.stopped = true; }, disconnect() {} };
      keepAlives.push(source);
      return source;
    }
  };
  class FakeWorkletNode {
    constructor(ctx, name, options) {
      assert.equal(options.processorOptions.maxFrames, 30 * 8000);
      this.port = { sent: [], closed: false,
        postMessage(message) { this.sent.push(message); }, close() { this.closed = true; } };
      nodes.push(this);
    }
    connect() {}
    disconnect() { this.disconnected = true; }
  }
  const recorder = new wav.Recorder({ context, output: { connect() {}, disconnect() {} },
    readyContext: async () => context }, FakeWorkletNode);
  recorder.onDone = (bytes, duration) => results.push({ bytes, duration });
  await recorder.start();
  recorder.receive({ type: "samples", samples: new Float32Array(30 * 8000 + 1) });
  assert.equal(recorder.frames, 0, "An oversized block cannot exceed the capture budget");
  recorder.receive({ type: "samples", samples: new Float32Array(16 * 8000) });
  assert.equal(recorder.frames, 16 * 8000);
  recorder.receive({ type: "samples", samples: new Float32Array(14 * 8000 + 1) });
  assert.equal(recorder.frames, 16 * 8000, "Reject a block that would cross the remaining budget");
  recorder.receive({ type: "samples", samples: new Float32Array(14 * 8000) });
  recorder.receive({ type: "samples", samples: Float32Array.of(.5) });
  assert.equal(recorder.frames, 30 * 8000);
  recorder.receive({ type: "done" });
  assert.equal(recorder.state, "idle");
  assert.equal(results.length, 1);
  assert.equal(results[0].duration, 30);
  assert.equal(results[0].bytes.length, 44 + 30 * 8000 * 2);
  assert.equal(nodes[0].port.sent.length, 0, "Automatic completion requires no manual Stop request");
  assert.equal(nodes[0].port.closed, true);
  assert.equal(nodes[0].disconnected, true);
  assert.equal(keepAlives[0].stopped, true);
  assert.equal(recorder.frames, 0);
  recorder.receive({ type: "done" });
  recorder.receive({ type: "samples", samples: Float32Array.of(.5) });
  assert.equal(results.length, 1, "Late messages cannot complete the recording twice");
  assert.equal(recorder.frames, 0);
});

test("cancel during asynchronous preparation never creates a recording node", async () => {
  let resumeWorklet;
  const context = {
    sampleRate: 44100, currentTime: 0, destination: {},
    audioWorklet: { addModule() { return new Promise(resolve => { resumeWorklet = resolve; }); } },
    createConstantSource() { throw new Error("Should never create a source"); }
  };
  const recorder = new wav.Recorder({ context, output: {}, readyContext: async () => context }, class {});
  const pending = recorder.start();
  await Promise.resolve();
  recorder.stop();
  resumeWorklet();
  assert.equal(await pending, false);
  assert.equal(recorder.state, "idle");
});
