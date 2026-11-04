"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const motion = require("./sound-motion.js");

test("theremin pad maps horizontal position logarithmically and vertical position to volume", () => {
  assert.equal(motion.padHz(0), 120);
  assert.equal(motion.padHz(1), 1600);
  assert.ok(Math.abs(motion.padHz(0.5) - Math.sqrt(120 * 1600)) < 1e-9);
  assert.ok(Math.abs(motion.padFraction(440) - Math.log(440 / 120) / Math.log(1600 / 120)) < 1e-12);
  assert.equal(motion.padLevel(0), 1);
  assert.equal(motion.padLevel(1), 0);
  assert.equal(motion.padLevel(0.25), 0.75);
  assert.equal(motion.padHz(-1), 120);
  assert.equal(motion.padHz(2), 1600);
});

test("theremin colors have bounded, distinct harmonic recipes for sound and waveform plots", () => {
  assert.deepEqual(motion.TIMBRES, ["pure", "rich", "voice", "overtones"]);
  assert.equal(motion.timbrePartials("pure")[0], 1);
  assert.equal(motion.timbrePartials("pure").slice(1).every(x => x === 0), true);
  const signatures = [];
  for (const timbre of motion.TIMBRES) {
    const partials = motion.timbrePartials(timbre);
    assert.equal(partials.length, ["voice", "overtones"].includes(timbre) ? 24 : 8);
    assert.ok(Object.isFrozen(partials));
    assert.ok(partials.every(x => Number.isFinite(x) && x >= 0 && x <= 1));
    const samples = Array.from({ length: 1000 }, (_, i) =>
      motion.timbreWaveAt(2 * Math.PI * i / 1000, timbre));
    assert.ok(samples.every(x => Number.isFinite(x) && Math.abs(x) <= 1.001));
    signatures.push(samples.map(x => x.toFixed(3)).join(","));
  }
  assert.equal(new Set(signatures).size, 4);
  assert.ok(Math.abs(motion.timbreWaveAt(Math.PI / 4, "pure") - Math.SQRT1_2) < 1e-12);
  assert.throws(() => motion.timbrePartials("piano"), RangeError);
  assert.throws(() => motion.timbreWaveAt(Infinity, "voice"), RangeError);
});

test("vowel colors use fixed-frequency formants rather than fixed harmonic-number mixtures", () => {
  assert.deepEqual(motion.VOWELS, ["a", "e", "i", "o", "u"]);
  for (const vowel of motion.VOWELS) {
    const formants = motion.vowelFormants(vowel);
    assert.equal(formants.length, 3);
    assert.ok(formants.every(([frequency, q, db]) => frequency > 0 && q > 0 && db > 0));
  }
  // 5*150=3*250=750 Hz. The vocal tract responds to the *same frequency*,
  // although that is the fifth harmonic of one note and third of the other.
  const at150 = motion.timbreComponents("voice", 150, "a")[4].magnitude / motion.timbrePartials("voice")[4];
  const at250 = motion.timbreComponents("voice", 250, "a")[2].magnitude / motion.timbrePartials("voice")[2];
  assert.ok(Math.abs(at150 - at250) < 1e-10);
  assert.ok(at150 > 3, "An A-vowel formant enhances 750 Hz");
  assert.ok(motion.timbreComponents("voice", 150, "i")[1].magnitude >
    motion.timbreComponents("voice", 150, "a")[1].magnitude * 3,
  "An I-vowel formant emphasizes lower harmonics than an A-vowel");
  assert.throws(() => motion.vowelFormants("x"), RangeError);
  assert.throws(() => motion.timbreComponents("voice", 200, "x"), RangeError);
});

test("overtone focusing emphasizes a selected existing harmonic, preserving the low drone", () => {
  for (let n = motion.MIN_OVERTONE; n <= motion.MAX_OVERTONE; n++) {
    const focus = motion.overtoneFocus(180, n);
    assert.equal(focus.frequency, n * 180);
    assert.ok(focus.gain >= 12 && focus.gain <= 27);
    assert.equal(focus.q, 14);
    const components = motion.timbreComponents("overtones", 180, "a", n);
    assert.ok(components[n - 1].magnitude > components[n].magnitude * 2);
    assert.ok(components[0].magnitude > 0.8, "The fundamental drone remains present");
  }
  const six = motion.timbreComponents("overtones", 200, "a", 6);
  const nine = motion.timbreComponents("overtones", 200, "a", 9);
  assert.ok(six[5].magnitude > nine[5].magnitude * 5);
  assert.ok(nine[8].magnitude > six[8].magnitude * 5);
  const high = motion.timbreComponents("voice", 1600, "e", 6, 16000);
  assert.equal(high[5].magnitude, 0, "No plotted harmonics above Nyquist");
  for (const invalid of [1, 13, 3.5, NaN]) {
    assert.throws(() => motion.overtoneFocus(180, invalid), RangeError);
  }
});

test("the abrupt siren alternates between only its two chosen frequencies", () => {
  const recipe = { lowHz: 440, highHz: 880, rate: 1, pattern: "two-tone" };
  assert.equal(motion.sirenHzAt(0, recipe), 440);
  assert.equal(motion.sirenHzAt(0.49, recipe), 440);
  assert.equal(motion.sirenHzAt(0.50, recipe), 880);
  assert.equal(motion.sirenHzAt(0.99, recipe), 880);
  assert.equal(motion.sirenHzAt(1, recipe), 440);
});

test("gradual sinusoidal and linear-in-pitch paths differ and share exact endpoints", () => {
  assert.deepEqual(motion.PATTERNS, ["two-tone", "sine-sweep", "pitch-sweep"]);
  const recipe = { lowHz: 440, highHz: 880, rate: 1, pattern: "pitch-sweep" };
  const at = (pattern, time) => motion.sirenHzAt(time, { ...recipe, pattern });
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

  near(at("pitch-sweep", 0.125), 440 * Math.pow(2, 0.25));
  near(at("sine-sweep", 0.125), 440 + 220 * (1 - Math.SQRT1_2));
  assert.ok(at("sine-sweep", 0.125) < at("pitch-sweep", 0.125));

  for (const pattern of motion.PATTERNS) {
    near(at(pattern, 0), 440);
    near(at(pattern, 1), 440);
    if (pattern !== "two-tone") near(at(pattern, 0.75), at(pattern, 0.25));
    near(at(pattern, 0.5), 880);
  }
  // Equal musical intervals, so log-frequency has a straight-line trajectory.
  near(Math.log2(at("pitch-sweep", 0.25) / 440), 0.5);
  near(Math.log2(at("pitch-sweep", 0.125) / 440), 0.25);
  // The sinusoidal trajectory slows near each turning point.
  assert.ok(at("sine-sweep", 0.01) - 440 < at("pitch-sweep", 0.01) - 440);
  near(motion.sirenHzAt(0.125, { ...recipe, pattern: "sine-sweep", rate: 2 }), at("sine-sweep", 0.25));
});

test("moving-pitch recipes reject invalid sound parameters", () => {
  assert.throws(() => motion.padHz(NaN), RangeError);
  assert.throws(() => motion.padLevel(Infinity), RangeError);
  assert.throws(() => motion.padFraction(0), RangeError);
  const recipe = { lowHz: 440, highHz: 880, rate: 0.8, pattern: "pitch-sweep" };
  for (const bad of [
    { ...recipe, lowHz: 10 }, { ...recipe, highHz: 5000 },
    { ...recipe, highHz: 445 }, { ...recipe, rate: 0.1 },
    { ...recipe, rate: 4 }, { ...recipe, pattern: "noise" }, { ...recipe, pattern: "sweep" }
  ]) assert.throws(() => motion.sirenHzAt(0.1, bad), RangeError);
  assert.throws(() => motion.sirenHzAt(-0.01, recipe), RangeError);
  assert.throws(() => motion.sirenHzAt(Infinity, recipe), RangeError);
});
