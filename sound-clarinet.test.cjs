/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const clarinet = require("./sound-clarinet.js");
const sustain = require("./sound-sustain.js");

function approx(actual, expected, epsilon = 1e-10) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
}

test("clarinet keeps its E5 reference while synthesizing an extended upper register", () => {
  assert.deepEqual(sustain.rangeFor("clarinet"), [clarinet.MIN_HZ, clarinet.MAX_HZ]);
  assert.ok(clarinet.MIN_HZ >= 140 && clarinet.REFERENCE_MAX_HZ <= 660);
  assert.ok(clarinet.MAX_HZ >= 1046 && clarinet.MAX_HZ < 1047);
  assert.deepEqual(sustain.recommendedRangeFor("clarinet"),
    [clarinet.MIN_HZ, clarinet.REFERENCE_MAX_HZ]);
  assert.ok(clarinet.PARTIALS * clarinet.REFERENCE_MAX_HZ < 8000,
    "The reference-range harmonics fit at the minimum 16 kHz supported rate");
  const extended = sustain.clarinetComponents(60, clarinet.MAX_HZ, 16000);
  assert.ok(extended.slice(7).every(c => c.sin === 0 && c.cos === 0),
    "High-register analysis does not fold partials above 8 kHz");
  assert.deepEqual(sustain.partials("clarinet", 0, clarinet.MIN_HZ), Array(clarinet.PARTIALS).fill(0));
  assert.equal(sustain.waveAt(1.6, "clarinet", 0), 0);
  assert.equal(clarinet.noiseGain(0), 0);
  for (const breath of [10, 25, 60, 80, 100]) {
    const weights = clarinet.strengthWeights(breath);
    assert.ok(weights.soft >= 0 && weights.bright >= 0);
    assert.ok(clarinet.noiseGain(breath) < .01);
    for (const hz of [clarinet.MIN_HZ, 220, 440, clarinet.MAX_HZ]) {
      const components = sustain.clarinetComponents(breath, hz, 16000);
      const amplitudes = components.map(c => Math.hypot(c.sin, c.cos));
      assert.equal(amplitudes.length, clarinet.PARTIALS);
      assert.ok(amplitudes.every(a => Number.isFinite(a) && a >= 0 && a < 1));
      const peak = Math.max(...Array.from({ length: 4096 }, (_, i) =>
        Math.abs(sustain.clarinetWaveFromComponents(i * Math.PI * 2 / 4096, components))));
      assert.ok(peak > 0 && peak < 1.05, `${breath}% at ${hz} Hz has bounded steady tone`);
      assert.ok(amplitudes[2] > amplitudes[1] * 2,
        "the third (odd) harmonic is stronger than the second (even) harmonic");
      assert.ok(amplitudes[0] > amplitudes[2]);
    }
  }
  for (const hz of [19.99, 5000.01, NaN, Infinity]) {
    assert.throws(() => sustain.clarinetComponents(60, hz), RangeError);
  }
  for (const hz of [120, 146, 1047, 1200, 5000]) {
    assert.ok(sustain.clarinetComponents(60, hz, 16000)[0].sin !== 0,
      `${hz} Hz keeps the actual reed fundamental outside the reference register`);
  }
  for (const breath of [-1, 101, NaN, Infinity]) {
    assert.throws(() => clarinet.strengthWeights(breath), RangeError);
    assert.throws(() => clarinet.noiseGain(breath), RangeError);
  }
  for (const rate of [0, 8000, 999999, NaN]) {
    assert.throws(() => sustain.clarinetComponents(60, 220, rate), RangeError);
  }
});

test("I2b blowing changes spectral colour beyond a fixed square wave or volume knob", () => {
  for (const hz of [196, 329.627557, 523.251131]) {
    const weak = sustain.partials("clarinet", 20, hz);
    const strong = sustain.partials("clarinet", 100, hz);
    assert.ok(strong[0] > 2 * weak[0]);
    assert.ok(strong[2] / strong[0] > 1.8 * weak[2] / weak[0],
      "third harmonic grows relative to fundamental with blowing");
    assert.ok(strong[1] / strong[0] < .14, "second stays weak even at full blowing");
    const flute = sustain.partials("flute", 60, hz);
    assert.ok(sustain.partials("clarinet", 60, hz)[2] / sustain.partials("clarinet", 60, hz)[0] >
      flute[2] / flute[0] * 2, "clarinet should be odd-richer than flute at the same pitch");
  }
});

test("I2b steady plotting components equal Fourier analysis of their own periodic tone", () => {
  for (const sampleRate of [16000, 44100, 48000]) {
    for (const [hz, breath] of [[220, 20], [440, 60], [550, 100]]) {
      const components = sustain.clarinetComponents(breath, hz, sampleRate);
      const count = 2048;
      const samples = Float64Array.from({ length: count }, (_, i) =>
        sustain.clarinetWaveFromComponents(2 * Math.PI * i / count, components));
      for (const k of [1, 2, 3, 5, 9, 12]) {
        let sine = 0, cosine = 0;
        for (let i = 0; i < count; i++) {
          const theta = 2 * Math.PI * k * i / count;
          sine += samples[i] * Math.sin(theta);
          cosine += samples[i] * Math.cos(theta);
        }
        approx(2 * sine / count, components[k - 1].sin);
        approx(2 * cosine / count, components[k - 1].cos);
      }
    }
  }
});

test("I2b tongued onset is continuous, settles exactly and resumes at note age", () => {
  assert.equal(clarinet.brightOnset(0), 0);
  assert.equal(clarinet.brightOnset(clarinet.TONGUE_SECONDS), 1);
  assert.equal(clarinet.brightOnset(4), 1);
  assert.ok(clarinet.brightOnset(.03) < clarinet.brightOnset(.07));
  assert.ok(clarinet.noiseOnset(0) > 2);
  assert.equal(clarinet.noiseOnset(clarinet.NOISE_SECONDS), 1);
  assert.equal(clarinet.noiseOnset(3), 1);
  for (const age of [-.001, NaN, Infinity]) {
    assert.throws(() => clarinet.noiseOnset(age), RangeError);
    assert.throws(() => clarinet.brightOnset(age), RangeError);
  }
  const min = sustain.sliderToHz(0, "clarinet"), max = sustain.sliderToHz(1000, "clarinet");
  approx(min, clarinet.MIN_HZ);
  approx(max, clarinet.MAX_HZ);
  for (const hz of [min, 220, 440, max]) {
    approx(sustain.sliderToHz(sustain.hzToSlider(hz, "clarinet"), "clarinet"), hz);
  }
});
