"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const strings = require("./sound-string.js");
const mandolin = require("./sound-mandolin.js");
const transient = require("./sound-transient.js");

function rms(samples, at, end, rate = mandolin.RATE) {
  let square = 0, count = 0;
  for (let i = Math.floor(at * rate); i < Math.min(samples.length, Math.floor(end * rate)); i++) {
    square += samples[i] * samples[i]; count++;
  }
  return Math.sqrt(square / Math.max(1, count));
}

test("Mandolin has separate slightly detuned G3–E6 courses and reuses the original string model", () => {
  assert.equal(typeof strings.pluckWave, "function");
  const [a, b] = mandolin.courseFrequencies(440);
  assert.ok(a < 440 && b > 440);
  assert.ok(Math.abs(1200 * Math.log2(b / a) - mandolin.COURSE_DETUNE_CENTS) < 1e-8);
  assert.equal(mandolin.MIN_HZ > 195 && mandolin.MAX_HZ < 1400, true);
  assert.ok(mandolin.wave(440).length === Math.ceil(mandolin.DEFAULT_DECAY * 4 * mandolin.RATE));
});

test("Mandolin is deterministic, finite, bounded, cached and silent at zero strength", () => {
  const sample = mandolin.wave(440, .52, .64);
  assert.equal(mandolin.wave(440, .52, .64), sample);
  assert.equal(sample.length, 99840);
  assert.ok(sample.every(Number.isFinite));
  assert.ok(Math.max(...sample.slice(0, 4000).map(Math.abs)) < .94);
  assert.ok(rms(sample, .01, .09) > .005);
  assert.equal(rms(mandolin.wave(440, .52, 0), .01, .09), 0);
  assert.equal(mandolin.sampleAt(0, 440), 0);
  assert.equal(mandolin.sampleAt(5, 440), 0);
});

test("Mandolin strength alters brightness as well as energy", () => {
  const weak = mandolin.wave(440, .52, .25);
  const strong = mandolin.wave(440, .52, .9);
  assert.ok(rms(strong, .008, .1) > rms(weak, .008, .1) * 1.4);
  // Increasing velocity moves the plectrum toward the bridge; that change is
  // part of the source displacement, not merely multiplying a gain control.
  const ratioA = weak[256] / weak[259], ratioB = strong[256] / strong[259];
  assert.ok(Math.abs(ratioA - ratioB) > .001);
});

test("Mandolin course cancellations no longer swallow notes in the ordinary melody range", () => {
  const levels = [196, 261.625565, 440, 659.255114].map(hz =>
    rms(mandolin.wave(hz), .01, .30));
  const spread = Math.max(...levels) / Math.min(...levels);
  assert.ok(spread < 1.2, `G3–E5 note levels should remain close: ${levels}`);
  for (const hz of [196, 261.625565, 440, 659.255114, 1318]) {
    const samples = mandolin.wave(hz);
    assert.ok(samples.every(Number.isFinite));
    assert.ok(samples.every(value => Math.abs(value) <= .9), `${hz} Hz exceeded headroom`);
  }
});

test("Tremolo is eight offset re-excitations and decays within the same safe note tail", () => {
  const pick = mandolin.wave(440, .52, .64, 48000, "pick");
  const tremolo = mandolin.wave(440, .52, .64, 48000, "tremolo");
  assert.equal(mandolin.STROKE_COUNT, 8);
  assert.ok(mandolin.STROKE_INTERVAL > .08 && mandolin.STROKE_INTERVAL < .13);
  assert.ok(rms(tremolo, .53, .7) > rms(pick, .53, .7) * 1.3);
  assert.notDeepEqual([...tremolo.slice(6000, 6400)], [...pick.slice(6000, 6400)]);
  assert.equal(pick.length, tremolo.length);
  assert.equal(transient.makeSamples("mandolin", 440, .52, 48000, "medium",
    { articulation: "tremolo" }).length, pick.length);
});

test("All Mandolin samples in explainer and 16, 44.1 and 48 kHz PCM share their model", () => {
  for (const rate of [16000, 44100, 48000]) {
    const options = { velocity: .7, articulation: "tremolo" };
    const samples = transient.makeSamples("mandolin", 440, .52, rate, "medium", options);
    assert.ok(samples.every(Number.isFinite));
    assert.ok(samples.some(value => Math.abs(value) > .01));
    assert.ok(Math.max(...samples.slice(0, 1600).map(Math.abs)) < 1);
    for (const index of [100, 1500, Math.floor(rate * .2), Math.floor(rate * .68)]) {
      const actual = samples[index];
      const expected = transient.plottedSampleAt("mandolin", index / rate, 440, .52,
        "medium", { ...options, sampleRate: rate });
      assert.ok(Math.abs(actual - expected) < 1e-7, `${rate} Hz, frame ${index}`);
    }
    assert.equal(samples[samples.length - 1] !== undefined, true);
  }
});

test("Invalid Mandolin register, articulation, strength, decay and sample rate fail before playback", () => {
  for (const hz of [195, 1320, -220, NaN]) assert.throws(() => mandolin.wave(hz), RangeError);
  for (const [decay, velocity, rate, articulation] of [[.05, .5, 48000, "pick"],
    [.52, 1.1, 48000, "pick"], [.52, .5, 2000, "pick"], [.52, .5, 48000, "vibrato"]]) {
    assert.throws(() => mandolin.wave(440, decay, velocity, rate, articulation), RangeError);
  }
  assert.throws(() => transient.validate("mandolin", 440, .52, "medium", { articulation: "vibrato" }), RangeError);
});
