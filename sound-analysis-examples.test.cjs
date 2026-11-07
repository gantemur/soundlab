/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const examples = require("./sound-analysis-examples.js");
const transientModel = require("./sound-transient.js");
const sustainModel = require("./sound-sustain.js");
const temperamentModel = require("./sound-temperaments.js");

const immediate = async () => {};
const close = (actual, expected, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not close to ${expected}`);

test("the catalogue retains its seven original examples and adds eleven credited recordings", () => {
  assert.deepEqual(examples.CLASSES.map(item => item.id), ["reference", "instruments", "nature", "wildlife", "objects", "footsteps", "mechanical"]);
  assert.deepEqual(examples.CATALOGUE.filter(item => item.kind !== "recorded").map(item => item.id), [
    "reference-sine-440", "reference-beats-440-444", "reference-chirp", "reference-white-noise",
    "model-guitar-a3", "model-flute-a4", "model-chime-c5"
  ]);
  assert.ok(Object.isFrozen(examples.CATALOGUE));
  for (const item of [...examples.CLASSES, ...examples.CATALOGUE]) {
    assert.ok(Object.isFrozen(item));
    assert.ok(item.title.mn && item.title.en && Object.isFrozen(item.title));
  }
  for (const item of examples.CATALOGUE) {
    assert.ok(item.description.mn && item.description.en);
    assert.ok(Object.isFrozen(item.description));
    assert.ok(item.duration > 0 && item.duration <= 10);
    if (item.kind !== "recorded") {
      assert.equal(item.kind, item.classId === "reference" ? "generated" : "modeled");
    } else {
      assert.ok(item.credit && item.credit.license && item.credit.sourceUrl);
      assert.match(item.path, /^assets\/analysis\/[-a-z0-9]+\.wav$/);
    }
  }
  const flute = examples.CATALOGUE.find(item => item.id === "model-flute-a4");
  assert.match(flute.description.en, /Compose\/offline flute/);
  assert.match(flute.description.en, /including breath noise/);
  for (const item of examples.CATALOGUE.filter(item => item.kind === "modeled")) {
    assert.match(item.description.en.toLowerCase(), /not a recording/);
  }
});

test("all generated examples are deterministic, finite, bounded and independent between requests", async () => {
  for (const entry of examples.CATALOGUE.filter(item => item.kind === "generated")) {
    const progress = [];
    const a = await examples.create(entry.id, { yieldTask: immediate, onProgress: value => progress.push(value) });
    const b = await examples.create(entry.id, { yieldTask: immediate });
    assert.equal(a.sampleRate, 44100);
    assert.equal(a.frames, entry.duration * 44100);
    assert.equal(a.duration, entry.duration);
    assert.equal(a.channels.length, 1);
    assert.equal(a.channels[0].length, a.frames);
    assert.equal(a.encoding, "generated-float32");
    assert.equal(a.exampleId, entry.id);
    assert.equal(a.kind, "generated");
    assert.ok(a.peak > .2 && a.peak <= .5);
    assert.ok(a.channels[0].every(Number.isFinite));
    assert.deepEqual(a.channels[0], b.channels[0]);
    assert.notEqual(a.channels[0], b.channels[0]);
    assert.equal(progress[0], 0);
    assert.equal(progress.at(-1), 1);
    assert.ok(progress.every((value, i) => value >= 0 && value <= 1 && (!i || value >= progress[i - 1])));
    const previous = b.channels[0][123];
    a.channels[0][123] = 0;
    assert.equal(b.channels[0][123], previous, "there is no mutable global PCM cache");
  }
});

test("reference signals use their exact amplitudes and phase laws without automatic normalization or edge ramps", async () => {
  const sine = (await examples.create("reference-sine-440", { yieldTask: immediate })).channels[0];
  const beats = (await examples.create("reference-beats-440-444", { yieldTask: immediate })).channels[0];
  const chirp = (await examples.create("reference-chirp", { yieldTask: immediate })).channels[0];
  for (const index of [0, 1, 17, 999, 12123, 44099, 88199]) {
    const t = index / 44100;
    close(sine[index], .5 * Math.sin(2 * Math.PI * 440 * t));
    close(beats[index], .25 * (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 444 * t)));
    close(chirp[index], .5 * Math.sin(2 * Math.PI * (150 * t + (2000 - 150) / 6 * t * t)));
  }
  const rms = values => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
  close(rms(sine), .5 / Math.sqrt(2));
  close(rms(beats), .25);
  close(beats[11025], 0, 1e-6);
  // A mistaken sin(2*pi*f(t)*t) would double the intended chirp slope.
  const index = 100001, t = index / 44100;
  close(chirp[index], .5 * Math.sin(2 * Math.PI * (150 * t + (2000 - 150) / 6 * t * t)));
  assert.ok(Math.abs(chirp[index] - .5 * Math.sin(2 * Math.PI * (150 + (2000 - 150) * t / 3) * t)) > .01);
});

test("white noise has a fixed seed but no repeated short period, large DC offset or hidden full-scale normalization", async () => {
  const result = await examples.create("reference-white-noise", { yieldTask: immediate });
  const values = result.channels[0];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const rms = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
  assert.ok(Math.abs(mean) < .005);
  close(rms, Math.sqrt(1 / 12), .002);
  assert.notDeepEqual(values.slice(0, 1024), values.slice(1024, 2048));
});

// A Web Audio graph fixture, NOT a browser DSP reimplementation. It retains
// the real model buffers/PeriodicWave coefficients for inspection, while a
// deliberately controlled output checks the shared WAV encode/decode path.
function offlineFixture(options = {}) {
  const contexts = [], modelCalls = [];
  const param = () => ({ value: 0, events: [],
    setValueAtTime(value, at) { this.value = value; this.events.push(["set", value, at]); },
    linearRampToValueAtTime(value, at) { this.value = value; this.events.push(["ramp", value, at]); },
    setTargetAtTime(value, at, constant) { this.value = value; this.events.push(["target", value, at, constant]); },
    cancelScheduledValues() {}
  });
  class OfflineAudioContext {
    constructor(channels, frames, sampleRate) {
      this.channels = channels; this.length = frames; this.sampleRate = sampleRate;
      this.currentTime = 0; this.destination = {}; this.sources = []; this.buffers = []; this.waves = [];
      this.filters = []; this.shapers = [];
      contexts.push(this);
    }
    resume() { throw new Error("must not resume live playback"); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createBiquadFilter() {
      const filter = { type: "lowpass", frequency: param(), Q: param(), gain: param(), connect() {}, disconnect() {} };
      this.filters.push(filter); return filter;
    }
    createWaveShaper() {
      const shaper = { curve: null, oversample: "none", connect() {}, disconnect() {} };
      this.shapers.push(shaper); return shaper;
    }
    createPeriodicWave(real, imag, settings) {
      const wave = { real: Float32Array.from(real), imag: Float32Array.from(imag), settings };
      this.waves.push(wave); return wave;
    }
    source(kind) {
      const source = { kind, frequency: param(), onended: null,
        connect() {}, disconnect() {},
        start(at) { this.at = at; }, stop(at) { this.endsAt = at; },
        setPeriodicWave(wave) { this.wave = wave; }
      };
      if (kind === "buffer") source.buffer = null;
      this.sources.push(source); return source;
    }
    createOscillator() { return this.source("oscillator"); }
    createBufferSource() { return this.source("buffer"); }
    createBuffer(channels, frames, sampleRate) {
      const data = new Float32Array(frames);
      const buffer = { numberOfChannels: channels, length: frames, sampleRate, duration: frames / sampleRate,
        getChannelData() { return data; } };
      this.buffers.push(buffer); return buffer;
    }
    async startRendering() {
      if (options.onRender) await options.onRender(this);
      if (options.fail) throw new Error("fixture render failed");
      const data = new Float32Array(this.length);
      data.set([0, .25, -.5]);
      return { numberOfChannels: this.channels, sampleRate: this.sampleRate, length: this.length,
        getChannelData() { return data; } };
    }
  }
  return { contexts, modelCalls, deps: { OfflineAudioContext, sustainModel, temperamentModel,
    transientModel: { ...transientModel, makeSamples(...args) {
      modelCalls.push(args); return transientModel.makeSamples(...args);
    } }, yieldTask: immediate } };
}

test("modeled examples use the existing score/export/reader path with the exact requested pitches", async () => {
  for (const id of ["model-guitar-a3", "model-flute-a4", "model-chime-c5"]) {
    const f = offlineFixture(), progress = [];
    const result = await examples.create(id, { ...f.deps, onProgress: value => progress.push(value) });
    assert.equal(f.contexts.length, 1);
    const context = f.contexts[0];
    assert.equal(context.channels, 1);
    assert.equal(result.sampleRate, 44100);
    close(result.duration, 3.02, 1 / 44100);
    assert.equal(result.frames, context.length);
    assert.equal(result.kind, "modeled");
    assert.equal(result.exampleId, id);
    assert.equal(result.modelPath, "compose-wav");
    assert.equal(result.renderingGain, 1);
    assert.equal(result.peak, .5);
    close(result.channels[0][1], .25, 1 / 32768);
    assert.equal(result.channels[0][2], -.5);
    assert.ok(result.channels[0].every(Number.isFinite));
    assert.equal(context.sources.length, id === "model-flute-a4" ? 2 : 1);
    assert.equal(context.sources[0].at, 0);
    assert.ok(context.sources.every(source => source.onended === null), "the exporter releases all its sources");
    assert.equal(progress[0], 0);
    assert.equal(progress.at(-1), 1);
    assert.ok(progress.every((value, i) => !i || value >= progress[i - 1]));

    if (id === "model-flute-a4") {
      assert.equal(f.modelCalls.length, 0);
      assert.equal(context.sources[0].kind, "oscillator");
      close(context.sources[0].frequency.events[0][1], 440);
      assert.equal(context.sources[0].type, "sine");
      assert.equal(context.waves.length, 0, "flute now uses the same nonlinear jet graph as Blow/Bow");
      assert.equal(context.shapers.length, 1);
      assert.equal(context.shapers[0].curve.length, 2049);
      assert.equal(context.shapers[0].oversample, "4x");
      assert.deepEqual(context.filters.map(filter => filter.type), ["highpass", "lowpass", "lowpass"]);
      assert.equal(context.sources[1].kind, "buffer");
      assert.equal(context.sources[1].loop, true, "the exported example includes the shared breath-noise path");
      assert.equal(context.buffers.length, 1);
      assert.equal(context.buffers[0].length, 44100, "one bounded reusable second of noise");
      assert.equal(context.sources[1].buffer, null, "export releases the noise source reference");
    } else {
      assert.equal(context.sources[0].kind, "buffer");
      assert.equal(f.modelCalls.length, 1);
      const [kind, hz, decay, rate, size, settings] = f.modelCalls[0];
      assert.equal(rate, 44100); assert.equal(size, "medium");
      if (id === "model-guitar-a3") {
        assert.equal(kind, "pluck"); close(hz, 220); assert.equal(decay, .65);
        assert.deepEqual(settings, { position: .22 });
      } else {
        assert.equal(kind, "kick"); close(hz, 523.2511306011972); assert.equal(decay, .7);
        assert.equal(settings.drumVoice, "chimes"); close(settings.chimeHz, hz);
      }
      assert.equal(context.buffers.length, 1);
      const samples = context.buffers[0].getChannelData(0);
      assert.ok(samples.every(Number.isFinite), "the real transient model, before the fixture's controlled output");
      assert.ok(samples.some(value => Math.abs(value) > .01));
      assert.equal(samples.length, Math.ceil(transientModel.duration(decay) * 44100));
      assert.equal(context.sources[0].buffer, null, "export releases the original source buffer reference");
    }
  }
});

test("reference preparation never constructs audio or uses randomness/network, and the module has no playback side effects", async t => {
  const oldRandom = Math.random;
  Math.random = () => { throw new Error("unseeded random signal"); };
  t.after(() => { Math.random = oldRandom; });
  let contexts = 0;
  const OfflineAudioContext = function () { contexts++; throw new Error("reference needs no renderer"); };
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("reference needs no network"); };
  t.after(() => { globalThis.fetch = oldFetch; });
  for (const entry of examples.CATALOGUE.filter(item => item.kind === "generated")) {
    await examples.create(entry.id, { OfflineAudioContext, yieldTask: immediate });
  }
  assert.equal(contexts, 0);
  const source = fs.readFileSync(path.join(__dirname, "sound-analysis-examples.js"), "utf8");
  assert.doesNotMatch(source, /\b(?:XMLHttpRequest|getUserMedia|decodeAudioData|AudioContext)\s*\(/);
  assert.match(source, /fetch\(path, \{ credentials: "same-origin" \}\)/);
  assert.doesNotMatch(source, /\.play\s*\(|createObjectURL|localStorage|setInterval/);
});

test("unknown examples, unsupported offline rendering and render failures fail visibly", async () => {
  for (const id of ["", null, "__proto__", "constructor", "recording-does-not-exist"]) {
    await assert.rejects(examples.create(id), error => error.code === "invalid");
  }
  await assert.rejects(examples.create("reference-sine-440", { onProgress: null }), error => error.code === "invalid");
  await assert.rejects(examples.create("model-flute-a4", { yieldTask: immediate }), error => error.code === "unsupported");
  const f = offlineFixture({ fail: true });
  await assert.rejects(examples.create("model-chime-c5", f.deps), error => error.code === "render");
});

test("reference generation yields and can be cancelled before allocation or during a chunk sequence", async () => {
  let progress = 0;
  await assert.rejects(examples.create("reference-white-noise", { isCancelled: () => true,
    onProgress: () => progress++ }), error => error.code === "cancelled");
  assert.equal(progress, 0);
  let cancelled = false, yields = 0;
  await assert.rejects(examples.create("reference-beats-440-444", {
    isCancelled: () => cancelled, yieldTask: async () => { if (++yields === 3) cancelled = true; }
  }), error => error.code === "cancelled");
  assert.equal(yields, 3);
});

test("a short native offline render finishing after cancellation cannot return a stale source", async () => {
  let cancelled = false;
  const f = offlineFixture({ onRender() { cancelled = true; } });
  await assert.rejects(examples.create("model-flute-a4", {
    ...f.deps, isCancelled: () => cancelled
  }), error => error.code === "cancelled");
  assert.equal(f.contexts.length, 1);
  assert.equal(f.contexts[0].sources[0].onended, null);
});
