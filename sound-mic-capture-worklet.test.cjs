/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const wav = require("./sound-wav.js"), reader = require("./sound-wave-reader.js");
const dsp = require("./sound-analysis-dsp.js");

function fixture(rate = 10) {
  let Processor;
  const posted = [];
  const globals = {
    sampleRate: rate, Float32Array,
    AudioWorkletProcessor: class { constructor() {
      this.port = { postMessage(message) { posted.push(message); }, onmessage: null };
    } },
    registerProcessor(name, klass) { assert.equal(name, "soundlab-mic-capture"); Processor = klass; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "sound-mic-capture-worklet.js"), "utf8"),
    globals, { filename: "sound-mic-capture-worklet.js" });
  const processor = new Processor();
  const send = data => processor.port.onmessage({ data });
  const feed = (samples, outputLength = samples.length) => {
    const out = new Float32Array(outputLength).fill(.7);
    assert.equal(processor.process([[samples]], [[out]]), true);
    assert.deepEqual([...out], Array(outputLength).fill(0), "Microphone must never reach the output");
  };
  const snapshots = () => posted.filter(message => message.type === "snapshot");
  return { processor, posted, send, feed, snapshots };
}

test("M2 microphone PCM ring keeps exactly the latest 30 seconds, across wrap and continuous capture", () => {
  const f = fixture(10);
  assert.equal(f.processor.maxFrames, 300);
  f.feed(Float32Array.from({ length: 220 }, (_, i) => i / 500));
  f.send({ type: "snapshot", id: 1 });
  assert.equal(f.snapshots()[0].mode, "rolling");
  assert.equal(f.snapshots()[0].samples.length, 220);
  f.feed(Float32Array.from({ length: 125 }, (_, i) => (220 + i) / 500));
  f.send({ type: "snapshot", id: 2 });
  const result = f.snapshots()[1];
  assert.equal(result.samples.length, 300);
  assert.equal(result.mode, "rolling");
  assert.ok(Math.abs(result.samples[0] - 45 / 500) < 1e-6);
  assert.ok(Math.abs(result.samples[299] - 344 / 500) < 1e-6);
  assert.equal(f.processor.ring.length, 300, "30 seconds is the memory bound, not a growing list");
  assert.ok(f.posted.every(p => p.type !== "samples"), "Audio is only transferred on request");
});

test("M2 explicit take freezes at Stop, survives the rolling window overwriting it, and can be replaced", () => {
  const f = fixture(10);
  f.feed(Float32Array.from([.1, .1]));
  f.send({ type: "beginTake" });
  f.feed(Float32Array.from([.2, .3, -.4]));
  f.send({ type: "stopTake" });
  assert.equal(f.posted.at(-1).type, "takeStopped");
  assert.equal(f.posted.at(-1).frames, 3);
  f.feed(new Float32Array(301).fill(.9));
  f.send({ type: "snapshot", id: 11 });
  assert.deepEqual([...f.snapshots().at(-1).samples], [.2, .3, -.4].map(Math.fround));
  assert.equal(f.snapshots().at(-1).mode, "take");
  f.send({ type: "beginTake" });
  f.feed(Float32Array.from([-.5]));
  f.send({ type: "snapshot", id: 12 });
  assert.deepEqual([...f.snapshots().at(-1).samples], [-.5]);
  assert.equal(f.snapshots().at(-1).mode, "take");
});

test("M2 take auto-stops at 30s; no explicit Record means rolling fallback, and stereo is downmixed", () => {
  const f = fixture(10);
  f.send({ type: "beginTake" });
  f.feed(new Float32Array(290).fill(.25));
  f.feed(new Float32Array(35).fill(-.75));
  const stopped = f.posted.find(m => m.type === "takeStopped");
  assert.equal(stopped.reason, "limit"); assert.equal(stopped.frames, 300);
  f.send({ type: "snapshot", id: 1 });
  const captured = f.snapshots().at(-1).samples;
  assert.equal(captured.length, 300);
  assert.equal(captured[289], .25);
  assert.equal(captured[299], -.75);
  const g = fixture(10);
  const out = new Float32Array(3).fill(1);
  g.processor.process([[Float32Array.from([1, -1, .5]), Float32Array.from([-1, 1, -.5])]], [[out]]);
  g.send({ type: "snapshot", id: 2 });
  assert.deepEqual([...g.snapshots()[0].samples], [0, 0, 0]);
  assert.deepEqual([...out], [0, 0, 0]);
});

test("M2 microphone PCM round-trips through WAV and the existing Hann analyzer without resampling", async () => {
  const rate = 8192, frames = 4096, tone = 512;
  const f = fixture(rate);
  const samples = Float32Array.from({ length: frames }, (_, i) => .6 * Math.sin(2 * Math.PI * tone * i / rate));
  f.feed(samples.subarray(0, 2017)); f.feed(samples.subarray(2017));
  f.send({ type: "snapshot", id: 7 });
  const snapshot = f.snapshots()[0];
  assert.equal(snapshot.sampleRate, rate);
  const bytes = wav.encodeWav([snapshot.samples], snapshot.sampleRate, { maxSeconds: 30 });
  const pcm = await reader.decode(bytes, { yieldTask: async () => {} });
  assert.equal(pcm.sampleRate, rate); assert.equal(pcm.frames, frames);
  const actual = pcm.channels[0];
  let squaredError = 0;
  for (let i = 0; i < frames; i++) squaredError += (actual[i] - samples[i]) ** 2;
  assert.ok(Math.sqrt(squaredError / frames) < 2 / 32768);
  const spectrum = dsp.spectrumAt(actual, rate, .25, 4096);
  const peakBin = spectrum.magnitudes.indexOf(Math.max(...spectrum.magnitudes));
  assert.equal(peakBin * rate / 4096, tone);
  assert.ok(Math.abs(spectrum.magnitudes[peakBin] - .6) < .001);
});
