"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const scales = require("./sound-scales.js");

const close = (actual, expected, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

test("five exact fifths give the pentatonic classes, with a near-return at the sixth pitch", () => {
  const scale = scales.build();
  assert.equal(scale.count, 5);
  assert.deepEqual(scale.chain.map(n => n.k), [0, 1, 2, 3, 4]);
  assert.deepEqual(scale.notes.map(n => `${n.numerator}/${n.denominator}`),
    ["1/1", "9/8", "81/64", "3/2", "27/16"]);
  close(scale.closureCents, -90.2249956730628, 1e-5);
  close(scale.gaps.reduce((a, b) => a + b, 0), 1200);
  assert.equal(scale.gaps.filter(gap => gap > 250).length, 2);
});

test("one downward and five upward steps give a seven-note diatonic scale", () => {
  const scale = scales.build({ down: 1, up: 5 });
  assert.deepEqual(scale.chain.map(n => n.k), [-1, 0, 1, 2, 3, 4, 5]);
  assert.deepEqual(scale.notes.map(n => `${n.numerator}/${n.denominator}`),
    ["1/1", "9/8", "81/64", "4/3", "3/2", "27/16", "243/128"]);
  assert.equal(scale.gaps.filter(gap => gap < 100).length, 2);
  assert.equal(scale.gaps.filter(gap => gap > 190 && gap < 210).length, 5);
});

test("tonic changes the mode but never changes the generated pitch collection", () => {
  const major = scales.build({ down: 0, up: 4, tonicK: 0 });
  const minor = scales.build({ down: 0, up: 4, tonicK: 3 });
  assert.deepEqual(major.notes.map(note => note.hz), minor.notes.map(note => note.hz));
  close(major.tonicHz, 220);
  close(minor.tonicHz, 220 * 27 / 16);
  assert.deepEqual(minor.ordered.map(note => Math.round(note.relativeCents / 100)), [0, 3, 5, 7, 10]);
  close(minor.ordered[0].playingHz, minor.tonicHz);
});

test("up/down windows give five distinct modes relative to one fixed reference", () => {
  const patterns = ["0,2,4,7,9", "0,2,5,7,9", "0,2,5,7,10", "0,3,5,7,10", "0,3,5,8,10"];
  for (let down = 0; down < 5; down++) {
    const scale = scales.build({ down, up: 4 - down });
    assert.equal(scale.count, 5);
    const semitones = scale.ordered.map(note => Math.round(note.relativeCents / 100));
    assert.equal(semitones.join(","), patterns[down]);
  }
});

test("the five-down preset contains only downward fifth steps", () => {
  const preset = scales.PRESETS.find(item => item.id === "five-down");
  assert.equal(preset.down, 4);
  assert.equal(preset.up, 0);
  assert.deepEqual(scales.build(preset).chain.map(note => note.k), [-4, -3, -2, -1, 0]);
});

test("each tonic defines a full octave window containing all pitches in playback order", () => {
  for (const down of [0, 2, 4]) {
    const up = 4 - down;
    for (let tonicK = -down; tonicK <= up; tonicK++) {
      const scale = scales.build({ down, up, tonicK });
      const anchor = (3 / 2) ** (tonicK + down);
      const positions = scale.ordered.map(note => anchor * note.relativeRatio);
      assert.ok(positions.every(f => f >= anchor * (1 - 1e-9) && f < 2 * anchor),
        "Every original or octave-copied note has exactly one place in the tonic octave");
      assert.ok(positions.every((f, i) => !i || f > positions[i - 1]));
      assert.deepEqual(scale.ordered.map(note => note.k),
        scales.melodySteps(scale).slice(0, scale.count).map(note => note.k));
    }
  }
});

test("twelve consecutive fifths miss seven octaves by one Pythagorean comma", () => {
  const scale = scales.build({ down: 5, up: 6 });
  close(scale.closureCents, 23.460010384649, 1e-4);
  assert.equal(scale.octaveCount, 7);
  assert.equal(scale.count, 12);
  assert.equal(new Set(scale.notes.map(n => n.k)).size, 12);
});

test("opt-in ghost returns continue the pentatonic in the selected direction", () => {
  const up = scales.returnGap(scales.build({ down: 0, up: 4 }));
  assert.deepEqual([up.startK, up.ghostK, up.octaveCount], [0, 5, 3]);
  close(up.ratio, 243 / 256);
  close(up.signedCents, -90.2249956730628, 1e-5);
  close(up.angleDegrees, -27.06749870191884, 1e-4);
  assert.equal(up.isPythagoreanComma, false);
  const down = scales.returnGap(scales.build({ down: 4, up: 0 }));
  assert.deepEqual([down.startK, down.ghostK, down.direction], [0, -5, -1]);
  close(down.ratio, 256 / 243);
  close(down.signedCents, -up.signedCents);
  assert.equal(down.isPythagoreanComma, false);
  const center = scales.returnGap(scales.build({ down: 2, up: 2 }));
  assert.deepEqual([center.startK, center.ghostK], [-2, 3]);
});

test("twelve-step ghost closes within 7.04° and sounds a bounded beat pair", () => {
  const scale = scales.build({ down: 5, up: 6 });
  const gap = scales.returnGap(scale);
  assert.deepEqual([gap.startK, gap.ghostK, gap.octaveCount], [-5, 7, 7]);
  close(gap.ratio, 531441 / 524288, 1e-9);
  close(gap.signedCents, 23.460010384649, 1e-5);
  close(gap.angleDegrees, 7.03800311539, 1e-5);
  assert.equal(gap.isPythagoreanComma, true);
  const samples = scales.makeGapSamples(scale, 22050);
  assert.equal(samples.length, Math.ceil(scales.GAP_SECONDS * 22050));
  assert.equal(samples[0], 0);
  assert.ok(samples.some(value => Math.abs(value) > .2));
  assert.ok(samples.every(value => Math.abs(value) <= .8 + 1e-6));
  assert.throws(() => scales.makeGapSamples(scale, 1000), RangeError);
});

test("scale melody starts and ends on the selected tonic and synthesizes bounded notes", () => {
  const scale = scales.build({ down: 1, up: 5, tonicK: -1 });
  const sequence = scales.melody(scale);
  const steps = scales.melodySteps(scale);
  assert.deepEqual(steps.map(note => note.hz), sequence);
  assert.equal(steps[0].k, scale.tonicK);
  assert.equal(steps[7].octaveUp, true);
  assert.equal(steps.at(-1).k, scale.tonicK);
  assert.equal(sequence.length, 15);
  close(sequence[0], scale.tonicHz);
  close(sequence[7], scale.tonicHz * 2);
  close(sequence.at(-1), scale.tonicHz);
  const audio = scales.makeSamples(scale, 22050);
  assert.equal(audio.length, Math.ceil(15 * scales.STEP_SECONDS * 22050));
  assert.equal(audio[0], 0);
  assert.ok(audio.every(sample => Math.abs(sample) <= 1));
  assert.ok(audio.some(sample => Math.abs(sample) > .5));
});

test("3-limit Together mode renders all pitch classes without clipping", () => {
  for (const options of [{ down: 0, up: 4 }, { down: 1, up: 5 }, { down: 5, up: 6 }]) {
    const scale = scales.build(options);
    const rate = 22050;
    const samples = scales.makeChordSamples(scale, rate);
    assert.equal(samples.length, Math.ceil(scales.CHORD_SECONDS * rate));
    assert.equal(samples[0], 0);
    assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= .75 + 1e-6));
    const index = Math.floor(.053 * rate);
    const t = index / rate;
    const expected = scale.ordered.reduce((sum, note) => sum + .75 / scale.count *
      (.88 * Math.sin(2 * Math.PI * note.playingHz * t) +
       .12 * Math.sin(4 * Math.PI * note.playingHz * t)), 0);
    close(samples[index], expected, 1e-6);
    assert.ok(Math.abs(samples.at(-1)) < .02, "The chord fades at its end");
  }
  assert.throws(() => scales.makeChordSamples(scales.build(), 1000), RangeError);
});

test("the spiral turn and adjacent Fourier partials come from exact fifths", () => {
  close(scales.FIFTH_TURN_DEGREES, 210.586500259, 1e-6);
  const scale = scales.build({ down: 3, up: 4 });
  for (let index = 0; index + 1 < scale.chain.length; index++) {
    // Unreduced frequencies ascend by a fifth; every adjacent pair shares 3f=2f'.
    const lower = (3 / 2) ** scale.chain[index].k;
    const higher = (3 / 2) ** scale.chain[index + 1].k;
    close(3 * lower, 2 * higher);
    const octavePosition = scale.chain[index].k * Math.log2(3 / 2);
    const angle = 360 * octavePosition;
    close((angle + scales.FIFTH_TURN_DEGREES) / 360,
      (scale.chain[index + 1].k) * Math.log2(3 / 2));
  }
});

test("invalid scale dimensions and pitches are rejected", () => {
  for (const options of [{ down: -1 }, { up: 12 }, { down: 6, up: 6 },
    { down: 1.5 }, { tonicK: -1 }, { tonicK: 6 }, { baseHz: Infinity },
    { baseHz: 109 }, { baseHz: 331 }]) {
    assert.throws(() => scales.build(options), RangeError);
  }
  assert.throws(() => scales.octaveFraction(12), RangeError);
  assert.throws(() => scales.makeSamples(scales.build(), 1000), RangeError);
});
