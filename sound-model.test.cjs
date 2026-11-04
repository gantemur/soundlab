"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("./sound-model.js");

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, actual + " differs from " + expected);
}

test("each ideal waveform has its expected shape and range", () => {
  near(m.sampleWave("sine", 0), 0);
  near(m.sampleWave("sine", 0.25), 1);
  near(m.sampleWave("triangle", 0.25), 1);
  near(m.sampleWave("triangle", 0.75), -1);
  assert.equal(m.sampleWave("square", 0.25), 1);
  assert.equal(m.sampleWave("square", 0.75), -1);
  near(m.sampleWave("sawtooth", 0.25), -0.5);
  near(m.sampleWave("sawtooth", 0.75), 0.5);
  for (const wave of m.WAVEFORMS) {
    for (let i = -100; i <= 100; i++) {
      const sample = m.sampleWave(wave, i / 37);
      assert.ok(sample >= -1.000001 && sample <= 1.000001);
    }
  }
  assert.throws(() => m.sampleWave("unknown", 0));
});

test("harmonic magnitude patterns distinguish the waveforms", () => {
  assert.deepEqual([1, 2, 3, 4].map(n => m.harmonicMagnitude("sine", n)), [1, 0, 0, 0]);
  assert.deepEqual([1, 2, 3, 4].map(n => m.harmonicMagnitude("square", n)), [1, 0, 1 / 3, 0]);
  assert.deepEqual([1, 2, 3, 4].map(n => m.harmonicMagnitude("triangle", n)), [1, 0, 1 / 9, 0]);
  assert.deepEqual([1, 2, 3, 4].map(n => m.harmonicMagnitude("sawtooth", n)), [1, .5, 1 / 3, .25]);
  assert.equal(m.harmonicMagnitude("square", 0), 0);
});

test("musical pitch names and 12-TET mapping stay separate from raw Hz", () => {
  const a = m.nearestNote(440);
  assert.equal(a.english, "A4");
  assert.equal(a.mongolian, "Ля4");
  near(a.frequency, 440);
  assert.equal(m.nearestNote(261.626).english, "C4");
  near(m.snapFrequency(438), 440);
  near(m.resolvePitch({ kind: "hz", hz: 438 }, { id: "12tet" }), 438);
  near(m.resolvePitch({ kind: "midi", midi: 69 }, { id: "12tet" }), 440);
  assert.throws(() => m.resolvePitch({ kind: "midi", midi: 69 }, { id: "unknown" }));
});

test("logarithmic frequency slider round-trips within its range", () => {
  for (const f of [80, 110, 261.626, 440, 880, 2000]) {
    near(m.sliderToFrequency(m.frequencyToSlider(f)), f, 1e-7);
  }
  near(m.frequencyToSlider(40), 0);
  near(m.frequencyToSlider(4000), 1000);
  near(m.sliderToFrequency(-500), 80);
  near(m.sliderToFrequency(1500), 2000);
});
