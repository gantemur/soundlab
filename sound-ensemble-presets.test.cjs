"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const abc = require("./sound-abc.js");
const compose = require("./sound-compose.js");
const presets = require("./sound-ensemble-presets.js");
const ensemble = require("./sound-ensemble.js");
const temperament = require("./sound-temperaments.js");

const pieces = [
  { id: "minuet", melody: "minuetG", bars: 32, beats: 96 },
  { id: "korobeiniki", melody: "korobeiniki", bars: 16, beats: 32 },
  { id: "kalinka", melody: "kalinka", bars: 27, beats: 53 }
];

test("all three ensemble presets contain complete published melodies and synchronized original parts", () => {
  for (const { id, melody, bars, beats } of pieces) {
    const tracks = presets.create(id, "mn");
    assert.equal(tracks.length, 3);
    assert.equal(tracks[0].abc, compose.EXAMPLES[melody], id + " must retain the sourced C1 melody");
    assert.equal(new Set(tracks.map(track => track.id)).size, 3);
    assert.deepEqual(tracks.map(track => track.mute), [false, false, false]);
    assert.ok(tracks.every(track => track.abc.includes("% ")),
      id + " must retain provenance for the lead and mark the new backing parts");
    const { summary, prepared } = ensemble.parseTracks(tracks, "equal", temperament);
    assert.equal(summary.totalBeats, beats, id);
    assert.equal(prepared.length, 3, id);
    assert.ok(summary.eventCount < 512, id);
    prepared.forEach(track => {
      assert.equal(track.score.totalBeats, beats, id + " shared clock");
      assert.equal(track.score.bars.length, bars, id + " full-length accompaniment");
    });
    assert.ok(abc.parse(tracks[1].abc).parts[0].events.length > bars,
      id + " has independently editable notes in the inner part");
    assert.ok(abc.parse(tracks[2].abc).parts[0].events.length >= bars,
      id + " has independently editable bass notes");
  }
});

test("ensemble presets work in available tunings without pitch or duration errors", () => {
  for (const { id } of pieces) {
    for (const tuning of ["equal", "pythagorean", "just"]) {
      assert.doesNotThrow(() => ensemble.parseTracks(presets.create(id), tuning, temperament),
        id + " " + tuning);
    }
  }
});

test("loading a preset makes independent track objects and local ABC edits do not mutate catalog", () => {
  const first = presets.create("minuet", "en");
  assert.equal(first[0].name, "Melody");
  first[0].abc = "changed";
  first[1].mute = true;
  const again = presets.create("minuet", "mn");
  assert.equal(again[0].abc, compose.EXAMPLES.minuetG);
  assert.equal(again[0].name, "Аялгуу");
  assert.equal(again[1].mute, false);
  assert.throws(() => presets.create("not-present"), /Unknown ensemble preset/);
  assert.equal(presets.CATALOG.length, 4);
});
