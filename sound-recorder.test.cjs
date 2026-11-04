"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const wav = require("./sound-recorder.js");

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
  assert.throws(() => wav.encodeWav([new Float32Array(15 * 8000 + 1)], 8000), RangeError);
  assert.equal(wav.encodeWav([], 8000).length, 44);
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
      assert.equal(options.processorOptions.maxFrames, 661500);
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
