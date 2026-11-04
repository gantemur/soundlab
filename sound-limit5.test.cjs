"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("./sound-limit5.js");

test("five-limit lattice preserves rational pitches after octave folding", () => {
  const cases = [
    [[0, 0], [1, 1]], [[1, 0], [3, 2]], [[0, 1], [5, 4]],
    [[-1, 0], [4, 3]], [[2, 0], [9, 8]], [[4, 0], [81, 64]],
    [[-2, 1], [10, 9]], [[-1, 1], [5, 3]], [[1, 1], [15, 8]]
  ];
  for (const [[a, b], [p, q]] of cases) {
    const note = m.point(a, b);
    assert.equal(note.numerator, p);
    assert.equal(note.denominator, q);
    assert.ok(note.ratio >= 1 && note.ratio < 2);
  }
  assert.equal(m.lattice().length, 28);
  assert.throws(() => m.point(5, 0), RangeError);
  assert.throws(() => m.point(0, 0, 500), RangeError);
});

test("pure major/minor chords and G major/D minor use consistent ratio voicing", () => {
  for (const [preset, expected] of [
    ["major", [1, 5 / 4, 3 / 2]],
    ["minor", [1, 6 / 5, 3 / 2]],
    ["gmajor", [1, 5 / 4, 3 / 2]],
    ["dminor", [1, 6 / 5, 3 / 2]]
  ]) {
    const notes = m.chordVoicing(m.PRESETS[preset]);
    const root = notes[0].hz;
    assert.deepEqual(notes.map(note => Math.round(note.hz / root * 100000)),
      expected.map(ratio => Math.round(ratio * 100000)));
  }
  assert.deepEqual(m.selected(m.PRESETS.seven).map(note => note.numerator + "/" + note.denominator),
    ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"]);
  assert.throws(() => m.selected([[0, 0], [0, 0]]), RangeError);
});

test("the C-centred twelve-note just preset is an exact chromatic one-per-key selection", () => {
  const notes = m.selected(m.PRESETS.just12, 264);
  assert.equal(notes.length, 12);
  assert.deepEqual(notes.map(note => note.tetStep), [...Array(12).keys()]);
  assert.deepEqual(notes.map(note => note.numerator + "/" + note.denominator),
    ["1/1", "16/15", "9/8", "6/5", "5/4", "4/3", "45/32", "3/2", "8/5", "5/3", "9/5", "15/8"]);
  assert.equal(m.closePairs(m.PRESETS.just12).length, 0);
  assert.equal(notes.find(note => note.tetStep === 9).hz, 440);
  const samples = m.makeSamples(notes, 8000, "melody");
  assert.equal(samples.length, Math.ceil(12 * m.STEP_SECONDS * 8000));
  assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
});

test("both routes E and D give exactly 81/80 syntonic comma", () => {
  assert.ok(Math.abs(m.COMMA_CENTS - 21.50628959671478) < 1e-10);
  for (const which of ["e", "d"]) {
    const pair = m.comparison(which);
    assert.ok(Math.abs(pair.ratio - 81 / 80) < 1e-12);
    assert.ok(Math.abs(pair.cents - m.COMMA_CENTS) < 1e-10);
    assert.equal(pair.just.tetStep, pair.pyth.tetStep);
    assert.ok(pair.just.hz < pair.pyth.hz);
  }
  assert.equal(m.comparison("e").beatHz, 3.4375);
  assert.ok(Math.abs(m.comparison("d").beatHz - 3.05555555556) < 1e-8);
});

test("near-return detection is selection-driven, distinguishing syntonic comma and second-layer diaschisma", () => {
  assert.deepEqual(m.closePairs(m.PRESETS.major), []);
  for (const preset of ["commaE", "commaD"]) {
    const [pair] = m.closePairs(m.PRESETS[preset], 261.63);
    assert.equal(pair.numerator, 81);
    assert.equal(pair.denominator, 80);
    assert.ok(Math.abs(pair.cents - m.COMMA_CENTS) < 1e-8);
    assert.ok(pair.beatHz > 2);
    assert.equal(pair.thirdSteps, -1);
  }
  const [pair] = m.closePairs(m.PRESETS.diaschisma, 261.63);
  assert.equal(pair.numerator, 2048);
  assert.equal(pair.denominator, 2025);
  assert.ok(Math.abs(pair.cents - 19.552568708) < 1e-5);
  assert.equal(Math.abs(pair.thirdSteps), 2);
  assert.ok(pair.beatHz > 0);
  assert.deepEqual(m.closePairs([[0, 0], [1, 0]]), []);
});

test("octave shifts and harmonic coincidences explain the positions of lattice points", () => {
  assert.equal(m.octaveShift(0, 0), 0);
  assert.equal(m.octaveShift(2, 0), -1); // (3/2)^2 = 9/4 -> 9/8
  assert.equal(m.octaveShift(-1, 0), 1); // 2/3 -> 4/3
  assert.equal(m.octaveShift(0, 2), 0); // (5/4)^2 = 25/16
  assert.throws(() => m.octaveShift(6, 0), RangeError);
  assert.deepEqual(m.harmonicMatch(m.point(0, 0), m.point(1, 0)), { i: 3, j: 2, ratio: 3 });
  assert.deepEqual(m.harmonicMatch(m.point(0, 0), m.point(0, 1)), { i: 5, j: 4, ratio: 5 });
  assert.deepEqual(m.harmonicMatch(m.point(0, 1), m.point(1, 1)), { i: 3, j: 2, ratio: 3.75 });
  assert.equal(m.harmonicMatch(m.point(0, 1), m.point(4, 0)), null);
  assert.throws(() => m.harmonicMatch(m.point(0, 0), m.point(1, 0), 1), RangeError);
});

test("5-limit playback is silent until explicitly generated and bounded", () => {
  const notes = m.selected(m.PRESETS.major);
  const melody = m.makeSamples(notes, 16000, "melody");
  const chord = m.makeSamples(m.chordVoicing(m.PRESETS.major), 16000, "chord");
  const comma = m.makeComparisonSamples("e", 220, 16000);
  assert.equal(melody.length, Math.ceil(notes.length * m.STEP_SECONDS * 16000));
  assert.equal(chord.length, Math.ceil(m.CHORD_SECONDS * 16000));
  assert.equal(comma.length, Math.ceil(m.COMPARE_SECONDS * 16000));
  for (const samples of [melody, chord, comma]) {
    assert.equal(samples[0], 0);
    assert.ok(samples.some(value => Math.abs(value) > 0.02));
    assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
  }
  assert.throws(() => m.makeSamples(notes, 4000), RangeError);
});
