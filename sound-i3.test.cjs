/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * I3 models: bounded DSP, useful timbre distinctions and held-voice lifecycle.
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const harp = require("./sound-harp.js");
const transient = require("./sound-transient.js");
const held = require("./sound-i3-held.js");
const scorePlayer = require("./sound-score-player.js");
const abc = require("./sound-abc.js");

test("I3 harp has a soft, register-dependent pluck, reproducible bounded samples and a three-second export tail", () => {
  assert.deepEqual(transient.KINDS.includes("harp"), true);
  assert.equal(harp.duration(harp.DEFAULT_DECAY), 3);
  for (const sampleRate of [16000, 44100, 48000]) {
    for (const hz of [110, 440, 880]) {
      const samples = transient.makeSamples("harp", hz, harp.DEFAULT_DECAY, sampleRate,
        "medium", { velocity: harp.DEFAULT_VELOCITY });
      assert.equal(samples.length, sampleRate * 3);
      assert.equal(samples[0], 0);
      assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 1),
        "harp must stay finite and below digital full scale");
      assert.deepEqual(samples.slice(100, 110),
        transient.makeSamples("harp", hz, harp.DEFAULT_DECAY, sampleRate,
          "medium", { velocity: harp.DEFAULT_VELOCITY }).slice(100, 110));
      assert.ok(Math.max(...samples.slice(0, 600)) > .001);
    }
  }
  assert.ok(harp.envelope(1, .92, .62) > harp.envelope(2, .92, .62));
  assert.throws(() => transient.makeSamples("harp", 40, .92, 16000), /range/);
  assert.throws(() => harp.sampleAt(.2, 440, .92, -1), /range/);
});

test("stopped flute is odd-rich, Principal is brighter, accordion has a beating pair, bayan is dry", () => {
  assert.deepEqual(held.KINDS, ["organ-stopped", "organ-principal", "accordion", "bayan"]);
  const stopped = held.partials("organ-stopped", 70, 440);
  const principal = held.partials("organ-principal", 70, 440);
  assert.ok(stopped[1] < .12 * stopped[0]);
  assert.ok(principal[1] > .35 * principal[0]);
  assert.ok(principal[3] > stopped[3]);
  for (const kind of held.KINDS) {
    const [lo, hi] = held.rangeFor(kind);
    assert.ok(lo > 0 && hi > lo);
    const slider = held.hzToSlider(440, kind);
    assert.ok(Math.abs(held.sliderToHz(slider, kind) - 440) < 1e-8);
    assert.ok(Number.isFinite(held.waveAt(2.3, kind, 65, 440)));
    assert.ok(held.partials(kind, 0, 440).every(value => value === 0), "zero pressure must silence a rank");
  }
});

function fixture() {
  const params = [];
  function param() {
    const p = { records: [],
      setValueAtTime(value, time) { this.records.push(["set", value, time]); },
      linearRampToValueAtTime(value, time) { this.records.push(["ramp", value, time]); },
      setTargetAtTime(value, time, speed) { this.records.push(["target", value, time, speed]); },
      cancelScheduledValues(time) { this.records.push(["cancel", time]); } };
    params.push(p); return p;
  }
  const context = { currentTime: 0, sampleRate: 44100, sources: [], gains: [], waves: [],
    createGain() {
      const node = { gain: param(), connect(dest) { this.target = dest; },
        disconnect() { this.disconnected = true; } };
      this.gains.push(node); return node;
    },
    createPeriodicWave(real, imag, options) {
      const wave = { real, imag, options }; this.waves.push(wave); return wave;
    },
    createOscillator() {
      const source = { frequency: param(),
        setPeriodicWave(wave) { this.wave = wave; }, connect(dest) { this.target = dest; },
        disconnect() { this.disconnected = true; },
        start(time) { this.startedAt = time; }, stop(time) { this.stoppedAt = time; } };
      this.sources.push(source); return source;
    }
  };
  return { context, params };
}

test("I3 held voices start only on command; pressure/pitch updates, note-off and Stop release every native source", () => {
  for (const kind of held.KINDS) {
    const { context } = fixture();
    context.currentTime = 1;
    const voiced = held.createVoice({ context, output: {}, kind, hz: 440, at: 1,
      strength: 60, level: .18 });
    const ranked = context.sources.filter(source => source.wave);
    assert.equal(ranked.length, kind === "accordion" ? 2 : 1);
    assert.ok(ranked.every(source => source.startedAt === 1));
    assert.ok(ranked.every(source => source.wave.options.disableNormalization === true));
    assert.ok(voiced.envelopeAt(1.1) > 0);
    context.currentTime = 1.2;
    const initialWaves = context.waves.length;
    assert.equal(voiced.update({ hz: 550, strength: 85, level: .22 }), true);
    assert.ok(context.waves.length > initialWaves, "retimbre uses a new harmonic wave at the new pitch");
    assert.equal(voiced.release(1.3, .2), true);
    assert.equal(voiced.release(1.31, .2), false, "a voice cannot start another release");
    assert.ok(voiced.envelopeAt(1.55) <= 1e-8);
    assert.equal(voiced.stop(), true);
    assert.equal(voiced.stop(), false);
    assert.ok(context.sources.every(source => source.disconnected));
    assert.ok(context.gains.every(gain => gain.disconnected));
  }
});

test("I3 score selection enforces each instrument's range and preserves standard ABC concert pitches", () => {
  const dummyOwner = { output: {}, readyContext() { throw new Error("unexpected audio"); } };
  const dummyModel = { makeSamples() { throw new Error("unexpected sample rendering"); } };
  const player = new scorePlayer.Player({ contextOwner: dummyOwner, transientModel: dummyModel,
    sustainModel: require("./sound-sustain.js") });
  const tune = abc.parse("M:4/4\nL:1/4\nQ:1/4=100\nK:C\nC D E F |]");
  for (const instrument of ["harp", ...held.KINDS]) {
    assert.doesNotThrow(() => player.configure({ score: tune, instrument }));
  }
  const bass = abc.parse("M:4/4\nL:1/4\nQ:1/4=100\nK:C\nC,,,4 |]");
  assert.throws(() => player.configure({ score: bass, instrument: "harp" }), /outside/);
  assert.throws(() => player.configure({ score: bass, instrument: "accordion" }), /outside/);
});
