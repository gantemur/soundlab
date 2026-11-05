"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const drums = require("./sound-drum-abc.js");

const METER = { numerator: 4, denominator: 4, quarterBeats: 4 };
const GROOVE = drums.groove({ meter: METER, tempoQuarter: 96, totalBeats: 16 }, 3, "Rock beat");

test("drum ABC uses explicit MIDI channel 10 and fixed voice map", () => {
  assert.match(GROOVE, /K:C clef=perc/);
  assert.match(GROOVE, /%%MIDI channel 10/);
  for (const voice of drums.DRUMS) assert.match(GROOVE, new RegExp(`%%MIDI drummap ${voice.note} ${voice.midi}`));
  const parsed = drums.parse(GROOVE);
  assert.equal(parsed.percussion, true);
  assert.equal(parsed.bars.length, 4);
  assert.equal(parsed.totalBeats, 16);
  assert.equal(parsed.tempoQuarter, 96);
  const hits = drums.scheduledEvents(parsed);
  assert.equal(hits.filter(h => h.drum === "hat").length, 32);
  assert.equal(hits.filter(h => h.drum === "kick").length, 8);
  assert.equal(hits.filter(h => h.drum === "snare").length, 8);
  assert.deepEqual(hits.filter(h => h.startBeat === 0).map(h => h.drum), ["kick", "hat"]);
});

test("per-hit strength survives text ⇄ grid, including different strengths in the same chord", () => {
  const abc = GROOVE.replace("[!accent!CE]", "[!accent!C!p!E]");
  const original = drums.parse(abc);
  assert.equal(drums.gridOf(original)[0].cells[0].kick, 1);
  assert.equal(drums.gridOf(original)[0].cells[0].hat, .55);
  const changed = drums.toggleGridHit(original, 1, 3, "woodblock", .8);
  assert.deepEqual(drums.scheduledEvents(drums.parse(changed)).map(({ startBeat, drum, velocity }) =>
    [startBeat, drum, velocity]), [...drums.scheduledEvents(original).map(({ startBeat, drum, velocity }) =>
    [startBeat, drum, velocity]), [.75, "woodblock", .8]].sort((a, b) => a[0] - b[0]));
  assert.equal(drums.gridOf(drums.parse(changed))[0].cells[3].woodblock, .8);
  const removed = drums.toggleGridHit(drums.parse(changed), 1, 3, "woodblock", .8);
  assert.equal(drums.gridOf(drums.parse(removed))[0].cells[3].woodblock, undefined);
  assert.equal(drums.gridOf(drums.parse(removed))[0].cells[0].hat, .55);
});

test("sixteenth and eighth note grids share all onsets, including simultaneous hits", () => {
  const source = "M:4/4\nL:1/8\nQ:1/4=120\nK:C clef=perc\n[!p!C!accent!F] E z [DE] z2 C2 |]";
  const parsed = drums.parse(source);
  assert.equal(parsed.totalBeats, 4);
  const grid = drums.gridOf(parsed)[0].cells;
  assert.equal(grid.length, 16);
  assert.deepEqual(grid[0], { kick: .55, openHat: 1 });
  assert.deepEqual(grid[6], { snare: .8, hat: .8 });
  assert.deepEqual(drums.scheduledEvents(drums.parse(drums.fromGrid(parsed, drums.gridOf(parsed))))
    .map(hit => [hit.startBeat, hit.drum, hit.velocity]),
    drums.scheduledEvents(parsed).map(hit => [hit.startBeat, hit.drum, hit.velocity]));
});

test("editing a different grid step retains original long-duration drum notes", () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=100\nK:C clef=perc\nC2 z D z |]";
  // Deliberately overlong first bar is rejected; correct to four quarter beats.
  assert.throws(() => drums.parse(text), /Bar/);
  const source = "M:4/4\nL:1/4\nQ:1/4=100\nK:C clef=perc\nC2 z D |]";
  const score = drums.parse(source);
  const next = drums.toggleGridHit(score, 1, 12, "hat", 1);
  const parsed = drums.parse(next);
  const events = parsed.parts[0].events;
  assert.equal(events[0].durationBeats, 2, "Kick keeps its original half-note duration");
  assert.equal(events[1].durationBeats, 1, "Unchanged rest retains its quarter-note duration");
  assert.equal(events[2].durationBeats, 1, "An added simultaneous hit does not shorten the snare");
  assert.equal(events[2].hits.length, 2);
});

test("parser rejects unsupported syntax without modifying its source", () => {
  const valid = drums.parse(GROOVE);
  for (const bad of [
    GROOVE.replace("%%MIDI channel 10", "%%MIDI channel 9"),
    GROOVE.replace("drummap C 36", "drummap C 38"),
    GROOVE.replace("K:C clef=perc", "K:C"),
    GROOVE.replace("[!accent!CE]", "[CC]"),
    GROOVE.replace("[!accent!CE]", "[!ff!CE]"),
    GROOVE.replace("[!accent!CE]", "[C^E]"),
    GROOVE.replace("[!accent!CE]", "[CEG]2X"),
    GROOVE.replace("[!accent!CE]", "[CE] |"),
    GROOVE + "\n%%MIDI channel 10"
  ]) assert.throws(() => drums.parse(bad), /./);
  assert.equal(drums.scheduledEvents(valid).length, 48);
});

test("off-grid triplets remain playable as text, but grid refuses to quantize them", () => {
  const source = "M:4/4\nL:1/8\nQ:1/4=96\nK:C clef=perc\nC/3 D/3 E/3 z6 |]";
  // Three one-third eighth-note steps cannot be expressed on a sixteenth grid.
  assert.equal(drums.parse(source).bars[0].partial, true);
  const supported = "M:4/4\nL:1/8\nQ:1/4=96\nK:C clef=perc\nC/3 D/3 E/3 z7 |]";
  const parsed = drums.parse(supported);
  assert.equal(parsed.totalBeats, 4);
  assert.throws(() => drums.gridOf(parsed), /sixteenth-note-aligned/);
  assert.equal(supported.includes("C/3"), true);
});

test("a 32-bar drum part fits the full-score bound and waltz preset uses 3 beats", () => {
  const full = drums.parse(drums.groove({ meter: METER, tempoQuarter: 96, totalBeats: 128 }));
  assert.equal(full.bars.length, 32);
  assert.equal(drums.scheduledEvents(full).length, 384);
  const waltz = drums.parse(drums.groove({ meter: { numerator: 3, denominator: 4, quarterBeats: 3 },
    tempoQuarter: 120, totalBeats: 12 }));
  assert.equal(waltz.bars.length, 4);
  assert.equal(drums.gridOf(waltz)[0].cells.length, 12);
  assert.throws(() => drums.groove({ meter: METER, tempoQuarter: 96, totalBeats: 15 }), /actual bar durations/);
  const pickup = drums.parse(drums.groove({ meter: METER, tempoQuarter: 96, totalBeats: 13,
    barDurations: [1, 4, 4, 4] }));
  assert.equal(pickup.bars[0].durationBeats, 1);
  assert.equal(pickup.bars[0].pickup, true);
  assert.equal(pickup.bars.length, 4);
});
