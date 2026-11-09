"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const score = require("./sound-score.js");
const player = require("./sound-score-player.js");
const presets = require("./sound-ensemble-presets.js");
const ensemble = require("./sound-ensemble.js");
const temperament = require("./sound-temperaments.js");
const odeon = require("./sound-odeon-scores.js");

const expectedEventsSha = "2de2e11a031a9d01538a55c6ea4a60e3e9d885106c5ca22a9619bcd25dfe2db3";

function sourceSignature(events) {
  // SHA-256 is independently produced by the private offline MIDI preparer.
  // Its exact onset/duration/pitch integers use 480 ticks per quarter beat.
  return crypto.createHash("sha256").update(events.map(e => [
    Math.round(e.startBeat * 480), Math.round(e.durationBeats * 480),
    Math.round(score.pitchNumber(e.pitch))
  ]).sort((a, b) => a[0] - b[0] || a[2] - b[2])
    .map(tuple => tuple.join(":")).join("\n")).digest("hex");
}

test("RP5b Odeon retains all 1,452 sounds across its editorial 129-bar repeat form", () => {
  const entry = presets.CATALOG.find(item => item.id === "odeonPrinted");
  assert.equal(entry.category, "classics");
  assert.match(entry.description.en, /first ending/);
  assert.match(odeon.ODEON_PRINT_ABC, /1909 piano/);
  assert.match(odeon.ODEON_PRINT_ABC, /alternate first ending needs separate audit/);
  for (const language of ["en", "mn"]) {
    const tracks = presets.create("odeonPrinted", language);
    assert.equal(tracks.length, 1);
    assert.equal(tracks[0].instrument, "piano");
    assert.equal(tracks[0].abc, odeon.ODEON_PRINT_ABC);
    const { summary, prepared } = ensemble.parseTracks(tracks, "equal", temperament);
    const parsed = prepared[0].score;
    assert.deepEqual(parsed.parts[0].voiceIds, ["P1", "P2", "P3", "P4"]);
    assert.equal(parsed.bars.length, 129);
    assert.equal(parsed.totalBeats, 258);
    assert.ok(parsed.bars.every(bar => bar.durationBeats === 2));
    assert.equal(parsed.tempoQuarter, 88);
    assert.ok(Math.abs(score.beatToSeconds(parsed, 258) - 258 * 60 / 88) < 1e-9);
    assert.equal(summary.eventCount, 1452);
    const events = player.scheduledEvents(parsed);
    assert.equal(events.length, 1452);
    assert.equal(sourceSignature(events), expectedEventsSha,
      "pitches, starts and releases must match privately pinned source plus exactly one added B repeat");
    assert.equal(Math.min(...events.map(e => score.pitchNumber(e.pitch))), 39);
    assert.equal(Math.max(...events.map(e => score.pitchNumber(e.pitch))), 76);
    const firstB = events.filter(e => e.startBeat >= 66 && e.startBeat < 98);
    const secondB = events.filter(e => e.startBeat >= 98 && e.startBeat < 130);
    assert.equal(firstB.length, 179);
    const normalizedStrain = (notes, offset) => notes.map(e => [
      e.startBeat - offset, e.durationBeats, score.pitchNumber(e.pitch)
    ]).sort((a, b) => a[0] - b[0] || a[2] - b[2]);
    assert.deepEqual(normalizedStrain(firstB, 66), normalizedStrain(secondB, 98),
      "the provisional repeated B is exact and its alternate ending is disclosed");
    assert.ok(events.some(e => e.startBeat > 254), "full final phrase must reach the ending");
    assert.ok(player.scheduledEvents(parsed, 254).some(e => e.startBeat > 254),
      "seeking to the final cadence must retain the remaining attacks");
  }
});

test("RP5b Odeon permits creative re-instrumentation without removing written notes", () => {
  const reference = presets.create("odeonPrinted", "en");
  for (const tuning of ["equal", "pythagorean", "just"]) {
    for (const instrument of ["piano", "guitar", "bayan", "clarinet", "harp", "sine", "marimba"]) {
      const tracks = reference.map(track => ({ ...track, instrument }));
      const { summary, prepared } = ensemble.parseTracks(tracks, tuning, temperament);
      assert.equal(summary.totalBeats, 258);
      assert.equal(summary.eventCount, 1452);
      assert.equal(player.scheduledEvents(prepared[0].score).length, 1452);
    }
  }
  reference[0].abc = "edited";
  assert.equal(presets.create("odeonPrinted", "en")[0].abc, odeon.ODEON_PRINT_ABC);
});
