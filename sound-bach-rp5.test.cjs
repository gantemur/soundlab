"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const abc = require("./sound-abc.js");
const score = require("./sound-score.js");
const player = require("./sound-score-player.js");
const presets = require("./sound-ensemble-presets.js");
const ensemble = require("./sound-ensemble.js");
const temperament = require("./sound-temperaments.js");
const bach = require("./sound-bach-scores.js");

const expectedSourceHash = "8c1c32ffd092731aea84875a39b43d792c6ac60bcb6d3e9cc92891bc006c0f8d";
const rational = value => {
  const quarters = Math.round(value * 4);
  assert.ok(Math.abs(value - quarters / 4) < 1e-9, `non-sixteenth source timing: ${value}`);
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const divisor = gcd(Math.abs(quarters), 4);
  return divisor === 4 ? String(quarters / divisor) : `${quarters / divisor}/${4 / divisor}`;
};

function audibleSignature(events) {
  const notes = events.map(event => ({
    start: event.startBeat, duration: event.durationBeats, pitch: event.pitch,
    staff: event.voiceId === "RH" ? "1" : "2"
  }));
  notes.sort((a, b) => a.start - b.start || a.staff.localeCompare(b.staff) ||
    a.pitch.letter.localeCompare(b.pitch.letter) || a.pitch.accidental - b.pitch.accidental ||
    a.pitch.octave - b.pitch.octave || a.duration - b.duration);
  const content = notes.map(note => JSON.stringify([rational(note.start), rational(note.duration),
    [note.pitch.letter, note.pitch.accidental, note.pitch.octave], note.staff])).join("\n");
  return crypto.createHash("sha256").update(content).digest("hex");
}

test("RP5a complete Bach Prelude reproduces all source pitches and tied sustains", () => {
  assert.match(bach.PRELUDE_C_MAJOR_ABC, /CC0 1\.0/);
  assert.match(bach.PRELUDE_C_MAJOR_ABC, /Source MXL SHA-256|source MXL SHA-256/);
  assert.equal(presets.CATALOG.find(item => item.id === "bachPrelude").category, "classics");
  for (const language of ["mn", "en"]) {
    const tracks = presets.create("bachPrelude", language);
    assert.equal(tracks.length, 1);
    assert.equal(tracks[0].instrument, "piano");
    assert.equal(tracks[0].abc, bach.PRELUDE_C_MAJOR_ABC);
    const { summary, prepared } = ensemble.parseTracks(tracks, "equal", temperament);
    const parsed = prepared[0].score;
    assert.deepEqual(parsed.parts[0].voiceIds, ["RH", "LH1", "LH2"]);
    assert.equal(parsed.bars.length, 35);
    assert.equal(parsed.totalBeats, 140);
    assert.ok(parsed.bars.every(bar => bar.durationBeats === 4));
    assert.ok(Math.abs(score.beatToSeconds(parsed, 140) - 140 * 60 / 66) < 1e-9);
    assert.equal(parsed.tempoQuarter, 66);
    assert.equal(parsed.tempoMap, undefined, "no editorial tempo changes");
    assert.equal(parsed.pedalMap, undefined, "no invented damper-pedal instructions");
    const audible = player.scheduledEvents(parsed);
    assert.equal(audible.length, 549);
    assert.equal(summary.eventCount, 549);
    assert.deepEqual(["RH", "LH1", "LH2"].map(id => audible.filter(e => e.voiceId === id).length),
      [415, 67, 67]);
    assert.equal(audibleSignature(audible), expectedSourceHash,
      "independent JS playback events preserve every pinned MusicXML attack/release");
    const overlap = audible.find(e => e.voiceId === "LH1" && e.startBeat === .25);
    assert.ok(overlap && overlap.durationBeats === 1.75);
    assert.ok(audible.some(e => e.voiceId === "LH2" && e.startBeat === 0 && e.durationBeats === 2));
    const finalChord = audible.filter(e => e.startBeat === 136);
    assert.equal(finalChord.length, 5, "complete final chord includes both staves");
    assert.ok(finalChord.every(e => e.durationBeats === 4));
    assert.equal(player.scheduledEvents(parsed, 136).filter(e => e.startBeat === 136).length, 5,
      "seeking to the final bar retains every chord voice");
  }
});

test("RP5a multiple tunings, instrument substitution and edits preserve full score structure", () => {
  for (const tuning of ["equal", "pythagorean", "just"]) {
    const tracks = presets.create("bachPrelude", "en");
    const original = player.scheduledEvents(abc.parse(tracks[0].abc));
    for (const instrument of ["piano", "harp", "sine", "violin", "bayan"]) {
      tracks[0].instrument = instrument;
      const { summary, prepared } = ensemble.parseTracks(tracks, tuning, temperament);
      assert.equal(summary.totalBeats, 140);
      assert.equal(summary.eventCount, 549);
      assert.deepEqual(player.scheduledEvents(prepared[0].score).map(e =>
        [e.startBeat, e.durationBeats, score.pitchNumber(e.pitch)]),
      original.map(e => [e.startBeat, e.durationBeats, score.pitchNumber(e.pitch)]));
    }
    tracks[0].abc = "edited";
    assert.equal(presets.create("bachPrelude", "en")[0].abc, bach.PRELUDE_C_MAJOR_ABC);
  }
});
