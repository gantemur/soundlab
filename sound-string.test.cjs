"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const guitar = require("./sound-string.js");

test("a feedback-plucked string is finite, pitched and decays", () => {
  for (const pitch of [110, 220, 440, 880]) {
    let early = 0, late = 0;
    for (let i = 0; i < 200; i++) {
      early += guitar.pluckAt(.05 + i / 48000, pitch, .65) ** 2;
      late += guitar.pluckAt(.5 + i / 48000, pitch, .65) ** 2;
    }
    assert.ok(early > late, "Vibrating string loses energy");
    assert.equal(guitar.pluckAt(0, pitch, .65), 0);
    assert.equal(guitar.pluckAt(3.1, pitch, .65), 0);
    for (let i = 1; i < 600; i++) {
      assert.ok(Math.abs(guitar.pluckAt(i / 48000, pitch, .65)) <= 1);
    }
  }
  assert.notEqual(guitar.pluckAt(.018, 220, .65, .12), guitar.pluckAt(.018, 220, .65, .45));
  assert.throws(() => guitar.pluckAt(.1, 40, .65), RangeError);
  assert.throws(() => guitar.pluckAt(.1, 220, .65, .65), RangeError);
});

test("strumming excites independently tuned and staggered strings", () => {
  assert.deepEqual(Object.keys(guitar.CHORDS), ["em", "g", "c", "am", "d", "a", "e", "dm", "g7", "c7", "dsus4"]);
  const em = guitar.chordFrequencies("em");
  assert.equal(em.length, 6);
  assert.ok(Math.abs(em[0] - 82.4069) < .01);
  assert.ok(Math.abs(em[5] - 329.6276) < .01);
  assert.equal(guitar.chordFrequencies("c")[0], null, "C chord mutes the low E string");
  // The first 10 ms of G and Em are the same low E string with different frets.
  assert.notEqual(guitar.strumAt(.008, "em", .65), guitar.strumAt(.008, "g", .65));
  assert.equal(guitar.strumAt(0, "em", .65), 0);
  assert.equal(guitar.strumAt(3.01, "em", .65), 0);
  const chord = ["em", "g", "c"].map(name => guitar.strumAt(.12, name, .65));
  assert.equal(new Set(chord).size, 3);
  for (const name of Object.keys(guitar.CHORDS)) {
    for (let i = 0; i < 1500; i += 7) {
      const value = guitar.strumAt(i / 48000, name, .65);
      assert.ok(Number.isFinite(value) && Math.abs(value) <= 1);
    }
  }
  assert.throws(() => guitar.chordFrequencies("wrong"), RangeError);
});

test("expanded chords mute the correct strings and five original strokes are distinct and bounded", () => {
  assert.deepEqual(guitar.STRUM_PATTERNS, ["down", "up", "alternate", "arpeggio", "fingerpick"]);
  assert.deepEqual(guitar.CHORDS.am, [-1, 0, 2, 2, 1, 0]);
  assert.deepEqual(guitar.CHORDS.d, [-1, -1, 0, 2, 3, 2]);
  assert.deepEqual(guitar.CHORDS.dsus4, [-1, -1, 0, 2, 3, 3]);
  assert.deepEqual(guitar.CHORDS.g7, [3, 2, 0, 0, 0, 1]);
  assert.equal(guitar.chordFrequencies("dm")[0], null);
  assert.equal(guitar.chordFrequencies("dm")[1], null);
  assert.ok(Math.abs(guitar.chordFrequencies("a")[1] - 110) < 1e-6);
  for (const chord of Object.keys(guitar.CHORDS)) {
    const frequencies = guitar.chordFrequencies(chord);
    assert.ok(frequencies.filter(frequency => frequency !== null).length >= 4);
    for (const pattern of guitar.STRUM_PATTERNS) {
      for (const time of [0, .01, .055, .15, .25, .42, 1, 2.8]) {
        const value = guitar.strumAt(time, chord, .7, .22, pattern);
        assert.ok(Number.isFinite(value) && Math.abs(value) <= 1);
      }
    }
  }
  const gestureSamples = guitar.STRUM_PATTERNS.map(pattern =>
    [.018, .065, .17, .245].map(time => guitar.strumAt(time, "em", .7, .22, pattern).toFixed(5)).join("|"));
  assert.equal(new Set(gestureSamples).size, 5, "Different gestures produce different timing and tone");
  assert.equal(guitar.strumAt(.15, "em", .7), guitar.strumAt(.15, "em", .7, .22, "down"),
    "Existing chord behavior remains the default");
  assert.throws(() => guitar.strumAt(.1, "em", .7, .22, "shuffle"), RangeError);
});
