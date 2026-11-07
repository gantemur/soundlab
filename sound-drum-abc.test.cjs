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

test("D2a six extended drum notes round-trip through strict ABC and the sixteenth grid", () => {
  const header = ["X:2", "T:Extended kit", "M:4/4", "L:1/16", "Q:1/4=104", "K:C clef=perc",
    "%%MIDI channel 10", ...drums.DRUMS.map(drum => `%%MIDI drummap ${drum.note} ${drum.midi}`)];
  const source = [...header, "[!accent!A!p!Bcdf]4 e4 z8 |]"].join("\n");
  const score = drums.parse(source);
  const onsets = drums.scheduledEvents(score);
  assert.deepEqual(new Set(onsets.map(hit => hit.drum)),
    new Set(["floorTom", "midTom", "highTom", "ride", "rimshot", "crash"]));
  assert.equal(onsets.find(hit => hit.drum === "floorTom").velocity, 1);
  assert.equal(onsets.find(hit => hit.drum === "midTom").velocity, .55);
  assert.equal(onsets.find(hit => hit.drum === "crash").startBeat, 1);
  const grid = drums.gridOf(score);
  assert.equal(grid[0].cells[0].highTom, .8);
  assert.equal(grid[0].cells[4].crash, .8);
  const exported = drums.fromGrid(score, grid);
  assert.deepEqual(drums.scheduledEvents(drums.parse(exported)), onsets);
  const edited = drums.toggleGridHit(score, 1, 9, "ride", .55);
  assert.equal(drums.gridOf(drums.parse(edited))[0].cells[9].ride, .55);
  assert.throws(() => drums.parse(source.replace("drummap f 40", "drummap f 37")), /fixed Sound Lab/);
  assert.throws(() => drums.parse(source.replace("[!accent!A!p!Bcdf]", "[Ag]")), /mapped drum note/);
});

test("D2b flams, measured rolls, ghost strokes and accents survive text ⇄ pattern grid", () => {
  const source = "M:4/4\nL:1/16\nQ:1/4=120\nK:C clef=perc\n" +
    "[!ghost!!flam!D!accent!!roll!E]4 z4 !p!D4 !flam!!accent!D4 |]";
  const score = drums.parse(source);
  assert.deepEqual(score.parts[0].events[0].hits, [
    { drum: "snare", velocity: drums.VELOCITIES.ghost, articulation: "flam" },
    { drum: "hat", velocity: drums.VELOCITIES.accent, articulation: "roll" }
  ]);
  const strokes = drums.scheduledEvents(score);
  assert.equal(strokes.length, 9, "Two flams, one four-stroke roll and one plain stroke");
  assert.ok(strokes.every(hit => hit.startBeat >= 0), "Pickup grace strokes cannot begin before the score");
  const firstFlam = strokes.filter(hit => hit.drum === "snare" && hit.bar === 1 && hit.startBeat < .25);
  assert.equal(firstFlam.length, 2);
  assert.ok(firstFlam[0].startBeat < firstFlam[1].startBeat);
  assert.ok(firstFlam[0].velocity < firstFlam[1].velocity);
  const roll = strokes.filter(hit => hit.drum === "hat");
  assert.deepEqual(roll.map(hit => hit.startBeat), [0, .25, .5, .75]);
  assert.ok(roll[0].velocity < roll.at(-1).velocity);
  const grid = drums.gridOf(score);
  assert.deepEqual(grid[0].cells[0].snare, { velocity: .34, articulation: "flam" });
  assert.deepEqual(grid[0].cells[0].hat, { velocity: 1, articulation: "roll" });
  const roundTrip = drums.parse(drums.fromGrid(score, grid));
  assert.deepEqual(drums.scheduledEvents(roundTrip), strokes);
  const changed = drums.toggleGridHit(score, 1, 7, "rimshot", .8, "roll");
  assert.deepEqual(drums.gridOf(drums.parse(changed))[0].cells[7].rimshot,
    { velocity: .8, articulation: "roll" });
  assert.deepEqual(drums.gridOf(drums.parse(changed))[0].cells[0], grid[0].cells[0],
    "Unedited simultaneous techniques must remain intact");
  const cleared = drums.toggleGridHit(drums.parse(changed), 1, 7, "rimshot", .8, "roll");
  assert.equal(drums.gridOf(drums.parse(cleared))[0].cells[7].rimshot, undefined);
  assert.equal(drums.gridOf(drums.parse(changed))[0].cells[7].rimshot.articulation, "roll");
});

test("D2b rejects unknown, repeated or unfinished decorations and impossible grid technique", () => {
  const base = "M:4/4\nL:1/4\nQ:1/4=120\nK:C clef=perc\n";
  for (const note of ["!flam!!roll!D", "!p!!ghost!D", "!roll!!roll!D", "!flam!D!roll!", "!buzz!D", "!flamD"]) {
    assert.throws(() => drums.parse(base + note + " z3 |]"), /./, note);
  }
  const score = drums.parse(base + "D z3 |]");
  assert.throws(() => drums.toggleGridHit(score, 1, 0, "snare", .8, "buzz"), /Invalid grid/);
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

test("D2c (3 notation makes three eighth-note steps in one quarter; no silent grid quantization", () => {
  const header = "M:4/4\nL:1/8\nQ:1/4=120\nK:C clef=perc\n";
  const abc = header + "(3[!accent!CE]Dz z6 | (3DFE z6 |]";
  const parsed = drums.parse(abc);
  assert.ok(Math.abs(parsed.totalBeats - 8) < 1e-9);
  assert.ok(parsed.bars.every(bar => Math.abs(bar.durationBeats - 4) < 1e-9));
  assert.deepEqual(parsed.parts[0].events.slice(0, 4).map(event => event.durationBeats),
    [1 / 3, 1 / 3, 1 / 3, 3]);
  assert.deepEqual(drums.scheduledEvents(parsed).filter(hit => hit.bar === 1)
    .map(({ drum, startBeat }) => [drum, startBeat]),
    [["kick", 0], ["hat", 0], ["snare", 1 / 3]]);
  assert.throws(() => drums.gridOf(parsed), /sixteenth-note-aligned events/);
  assert.equal(parsed.parts[0].events[1].hits[0].drum, "snare");
  assert.throws(() => drums.parse(header + "(3DE |]"), /three triplet/);
  assert.throws(() => drums.parse(header + "(3D(3E z6 |]"), /no nested tuplets/);
  assert.throws(() => drums.parse(header + "(4D E z6 |]"), /Use \(3/);
});

test("D2c straight, light and 2:1 swing shift offbeats, not the ABC, quarter beats or barlines", () => {
  const source = "M:4/4\nL:1/8\nQ:1/4=120\nK:C clef=perc\nC E D E z4 | C E D E z4 |]";
  const parsed = drums.parse(source), unchanged = structuredClone(parsed);
  const at = feel => drums.scheduledEvents(parsed, feel).map(hit => +hit.startBeat.toFixed(9));
  assert.deepEqual(at("straight"), [0, .5, 1, 1.5, 4, 4.5, 5, 5.5]);
  assert.deepEqual(at("light"), [0, .58, 1, 1.58, 4, 4.58, 5, 5.58]);
  assert.deepEqual(at("swing"), [0, +(2 / 3).toFixed(9), 1, +(5 / 3).toFixed(9),
    4, +(14 / 3).toFixed(9), 5, +(17 / 3).toFixed(9)]);
  assert.deepEqual(parsed, unchanged, "Changing feel must not mutate the score or linked patterns");
  assert.throws(() => drums.scheduledEvents(parsed, "random"), /Unknown drum rhythmic feel/);
  const roll = drums.parse("M:4/4\nL:1/8\nQ:1/4=120\nK:C clef=perc\n!roll!E2 z6 |]");
  const strokes = drums.scheduledEvents(roll, "swing");
  assert.deepEqual(strokes.map(hit => +hit.startBeat.toFixed(9)),
    [0, +(.5 * 2 / 3).toFixed(9), +(2 / 3).toFixed(9), +(5 / 6).toFixed(9)]);
  assert.ok(strokes.every(hit => hit.durationBeats > 0));
});

test("D2c closed hi-hat marks an earlier open-hat tail for choking, including across a bar", () => {
  const source = "M:4/4\nL:1/8\nQ:1/4=120\nK:C clef=perc\nF z7 | E F z6 | [EF] z7 |]";
  const straight = drums.scheduledEvents(drums.parse(source));
  assert.deepEqual(straight.filter(hit => hit.drum === "openHat").map(hit => [hit.startBeat, hit.chokeBeat]),
    [[0, 4], [4.5, 8], [8, 8]]);
  const swing = drums.scheduledEvents(drums.parse(source), "swing");
  assert.ok(Math.abs(swing.find(hit => hit.drum === "openHat" && hit.bar === 2).startBeat - (4 + 2 / 3)) < 1e-9);
  assert.equal(swing.find(hit => hit.drum === "openHat" && hit.bar === 1).chokeBeat, 4);
  const free = drums.parse("M:4/4\nL:1/8\nQ:1/4=120\nK:C clef=perc\nF z7 |]");
  assert.equal(drums.scheduledEvents(free)[0].chokeBeat, undefined);
});

test("D2d sticking marks survive strict ABC, chords, pattern grids and toggles", () => {
  const source = "M:4/4\nL:1/16\nQ:1/4=100\nK:C clef=perc\n" +
    "[!R!!accent!!flam!D!L!!ghost!E]4 !roll!!L!D4 !R!D4 z4 |]";
  const score = drums.parse(source);
  assert.deepEqual(score.parts[0].events[0].hits, [
    { drum: "snare", velocity: 1, articulation: "flam", hand: "R" },
    { drum: "hat", velocity: .34, hand: "L" }
  ]);
  assert.deepEqual(drums.gridOf(score)[0].cells[0].snare,
    { velocity: 1, articulation: "flam", hand: "R" });
  assert.deepEqual(drums.gridOf(score)[0].cells[0].hat,
    { velocity: .34, hand: "L" });
  const restored = drums.parse(drums.fromGrid(score, drums.gridOf(score)));
  assert.deepEqual(drums.scheduledEvents(restored), drums.scheduledEvents(score));
  const changed = drums.toggleGridHit(score, 1, 14, "snare", .55, "plain", "L");
  assert.deepEqual(drums.gridOf(drums.parse(changed))[0].cells[14].snare, { velocity: .55, hand: "L" });
  assert.equal(drums.gridOf(drums.parse(drums.toggleGridHit(drums.parse(changed),
    1, 14, "snare", .55, "plain", "L")))[0].cells[14].snare, undefined);
  for (const bad of ["!R!!L!D", "!R!!R!D", "!L!z", "!r!D", "!R!!flam!!roll!D"]) {
    assert.throws(() => drums.parse("M:4/4\nL:1/4\nQ:1/4=100\nK:C clef=perc\n" +
      bad + " z3 |]"), /./, bad);
  }
  assert.throws(() => drums.toggleGridHit(score, 1, 7, "snare", .8, "plain", "both"), /Invalid grid/);
});

test("D2d a marked flam uses the opposite grace hand; a roll alternates from its first hand", () => {
  const score = drums.parse("M:4/4\nL:1/4\nQ:1/4=100\nK:C clef=perc\n" +
    "!flam!!R!D !roll!!L!D !R!D z |]");
  const hits = drums.scheduledEvents(score);
  assert.deepEqual(hits.filter(hit => hit.stroke?.startsWith("flam")).map(hit => hit.hand), ["L", "R"]);
  assert.deepEqual(hits.filter(hit => hit.stroke?.startsWith("roll")).map(hit => hit.hand),
    ["L", "R", "L", "R"]);
  assert.equal(hits.find(hit => hit.startBeat === 2)?.hand, "R");
  assert.equal(drums.scheduledEvents(drums.parse("M:4/4\nL:1/4\nQ:1/4=100\nK:C clef=perc\nD z3 |]"))[0].hand,
    undefined, "Legacy unmarked hits remain unmarked");
});

test("D2d expressive touch is deterministic, bounded and preserves written ghosts/accents", () => {
  const score = drums.parse("M:4/4\nL:1/16\nQ:1/4=100\nK:C clef=perc\n" +
    "!accent!D2 !p!D2 !ghost!D2 D2 !R!D8 | !p!D4 D4 D4 D4 |]");
  const frozen = structuredClone(score);
  const even = drums.scheduledEvents(score, "straight", "even");
  const played = drums.scheduledEvents(score, "straight", "expressive");
  assert.deepEqual(drums.scheduledEvents(score, "straight", "expressive"), played,
    "Subtle accents may not change between playbacks or exports");
  assert.deepEqual(played.map(hit => hit.startBeat), even.map(hit => hit.startBeat));
  assert.deepEqual(played.map(hit => hit.durationBeats), even.map(hit => hit.durationBeats));
  assert.equal(played[0].velocity, 1);
  assert.equal(played[2].velocity, .34);
  assert.ok(played.some((hit, i) => hit.velocity !== even[i].velocity));
  for (let i = 0; i < played.length; i++) {
    const change = played[i].velocity / even[i].velocity;
    assert.ok(change >= .90 && change <= 1.06, "Dynamic variation stays modest");
  }
  assert.deepEqual(score, frozen, "Choice changes playback, never the written score");
  assert.throws(() => drums.scheduledEvents(score, "straight", "random"), /Unknown drum touch/);
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

test("drum generation tolerates triplet roundoff without dropping a grid step or quantizing off-grid bars", () => {
  const clock = { meter: { numerator: 3, denominator: 4, quarterBeats: 3 },
    tempoQuarter: 144, totalBeats: 9.000000000000007 };
  for (const barDurations of [undefined, [3, 2.999999999999993, 3.000000000000007]]) {
    const score = drums.parse(drums.groove({ ...clock, barDurations }));
    assert.equal(score.totalBeats, 9);
    assert.deepEqual(score.bars.map(bar => bar.durationBeats), [3, 3, 3]);
    assert.deepEqual(drums.gridOf(score).map(bar => bar.cells.length), [12, 12, 12]);
  }
  assert.throws(() => drums.groove({ ...clock, totalBeats: 1, barDurations: [1 / 3, 2 / 3] }),
    /Invalid bar durations/);
  assert.throws(() => drums.groove({ ...clock, totalBeats: 9.001 }), /Cannot make a drum groove/);
});
