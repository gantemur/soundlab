"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const abc = require("./sound-abc.js");
const compose = require("./sound-compose.js");
const presets = require("./sound-ensemble-presets.js");
const ensemble = require("./sound-ensemble.js");
const drums = require("./sound-drum-abc.js");
const drumPatterns = require("./sound-drum-patterns.js");
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
  for (const { id } of [...pieces, { id: "bella" }, { id: "chopin7" }, { id: "chopin20" }]) {
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
  assert.equal(presets.CATALOG.length, 7);
});

test("complete Bella Ciao arrangement synchronizes four distinct instruments and linked drum patterns", () => {
  const tracks = presets.create("bella", "en");
  assert.equal(tracks.length, 4);
  assert.deepEqual(tracks.map(track => track.instrument), ["violin", "guitar", "triangle", "drums"]);
  assert.equal(tracks[0].abc, compose.EXAMPLES.bella);
  const { prepared, summary } = ensemble.parseTracks(tracks, "equal", temperament);
  assert.equal(summary.totalBeats, 64);
  assert.ok(summary.eventCount > 300 && summary.eventCount < 600);
  assert.ok(prepared.every(track => track.score.bars.length === 17));
  assert.ok(prepared.every(track => track.score.totalBeats === 64));
  assert.deepEqual(prepared[0].score.bars.map(bar => bar.durationBeats),
    prepared[3].score.bars.map(bar => bar.durationBeats));
  assert.equal(drums.parse(tracks[3].abc).percussion, true);
  assert.equal(tracks[3].patterns.sequence.length, 17);
  assert.ok(tracks[3].patterns.patterns.length < 10, "repetitive beat is stored as a pattern");
  assert.equal(tracks[3].textMode, "pattern");
  assert.equal(drumPatterns.toABC(tracks[3].patterns), tracks[3].abc);
  const second = presets.create("bella", "mn");
  assert.equal(second[3].name, "Бөмбөр");
  assert.notEqual(second[3].patterns, tracks[3].patterns, "pattern projects are independently editable");
  assert.match(tracks[1].abc, /Original|original/);
});

test("complete Chopin preludes have two synchronized piano hands and preserved chord harmony", () => {
  for (const { id, bars, beats, key } of [
    { id: "chopin7", bars: 17, beats: 49, key: "A" },
    { id: "chopin20", bars: 13, beats: 52, key: "Cm" }
  ]) {
    const tracks = presets.create(id, "en");
    assert.deepEqual(tracks.map(track => track.name), ["Right hand", "Left hand"]);
    assert.ok(tracks.every(track => track.instrument === "piano"));
    assert.ok(tracks.every(track => track.abc.includes("Public-domain source:")));
    const { prepared, summary } = ensemble.parseTracks(tracks, "equal", temperament);
    assert.equal(summary.totalBeats, beats);
    assert.ok(summary.eventCount >= 160);
    for (const track of prepared) {
      assert.equal(track.score.key.name, key);
      assert.equal(track.score.totalBeats, beats);
      assert.equal(track.score.bars.length, bars);
      assert.ok(track.score.parts[0].events.some(event => event.type === "chord"));
    }
    assert.ok(prepared[0].score.parts[0].events.some(event =>
      event.type === "chord" && event.pitches.length >= (id === "chopin20" ? 4 : 3)));
  }
});
