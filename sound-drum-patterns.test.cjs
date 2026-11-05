"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const drums = require("./sound-drum-abc.js");
const patterns = require("./sound-drum-patterns.js");

const meter = { numerator: 4, denominator: 4, quarterBeats: 4 };
const groove = bars => drums.groove({ meter, tempoQuarter: 96, totalBeats: bars * 4 }, 3, "Beat");
const signatures = project => drums.gridOf(drums.parse(patterns.toABC(project))).map(bar => bar.cells);

test("D1 starts with one linked pattern for repeated four-bar percussion", () => {
  const source = groove(4), project = patterns.fromABC(source);
  assert.equal(project.patterns.length, 1);
  assert.deepEqual(project.sequence.map(slot => slot.id), [1, 1, 1, 1]);
  assert.deepEqual(patterns.runs(project), [{ id: 1, name: "A", startBar: 1, endBar: 4, repeats: 4 }]);
  assert.deepEqual(signatures(project), drums.gridOf(drums.parse(source)).map(bar => bar.cells));
  assert.equal(drums.parse(patterns.patternABC(project, 1)).bars.length, 1);
  assert.equal(patterns.toABC(project).match(/^X:3$/m)?.[0], "X:3");
});

test("editing a shared pattern changes every linked occurrence", () => {
  const source = patterns.fromABC(groove(4));
  const changed = patterns.toggleHit(source, 1, 1, 3, "woodblock", drums.VELOCITIES.accent);
  assert.equal(drums.gridOf(drums.parse(patterns.toABC(source)))[0].cells[3].woodblock, undefined);
  assert.equal(signatures(changed).filter(bar => bar[3].woodblock === 1).length, 4);
  assert.equal(patterns.runs(changed)[0].repeats, 4);
});

test("Make unique detaches only the selected bar without altering neighbors", () => {
  const project = patterns.fromABC(groove(4));
  const unique = patterns.makeUnique(project, 2);
  assert.equal(unique.startBar, 2);
  assert.equal(unique.project.patterns.length, 2);
  assert.deepEqual(patterns.runs(unique.project).map(run => [run.name, run.startBar, run.endBar]),
    [["A", 1, 1], ["B", 2, 2], ["A", 3, 4]]);
  const changed = patterns.toggleHit(unique.project, unique.patternId, 1, 7, "snare", 1);
  assert.equal(signatures(changed)[1][7].snare, 1);
  for (const index of [0, 2, 3]) assert.equal(signatures(changed)[index][7].snare, undefined);
  assert.equal(patterns.runs(project).length, 1, "The previous project remains unchanged");
});

test("select a 2-bar or 4-bar pattern and repeat it to complete a phrase", () => {
  const eight = patterns.fromABC(groove(8));
  const pair = patterns.groupBars(eight, 1, 2);
  assert.equal(patterns.getPattern(pair.project, pair.patternId).bars.length, 2);
  const repeated = patterns.replaceRange(pair.project, pair.patternId, 3, 8);
  assert.deepEqual(patterns.runs(repeated).map(run => [run.name, run.repeats]), [["B", 4]]);
  assert.deepEqual(signatures(repeated), signatures(eight));
  const four = patterns.groupBars(eight, 1, 4);
  assert.equal(patterns.getPattern(four.project, four.patternId).bars.length, 4);
  assert.equal(patterns.runs(patterns.replaceRange(four.project, four.patternId, 5, 8))[0].repeats, 2);
});

test("pattern ABC text round-trips through the grid and maintains its clock", () => {
  const initial = patterns.fromABC(groove(4));
  const text = patterns.patternABC(initial, 1).replace("[!accent!CE]", "[!accent!C!p!EG]");
  const edited = patterns.updatePatternABC(initial, 1, text);
  assert.equal(signatures(edited).every(bar => bar[0].woodblock === .8 && bar[0].hat === .55), true);
  assert.equal(drums.parse(patterns.toABC(edited)).totalBeats, 16);
  assert.equal(patterns.patternABC(edited, 1).includes("!p!E"), true);
  assert.throws(() => patterns.updatePatternABC(edited, 1, text.replace("Q:1/4=96", "Q:1/4=120")), /M: and Q:/);
  assert.throws(() => patterns.updatePatternABC(edited, 1, text.replace("|]", "z16 |]")), /Bar|length/);
  assert.equal(signatures(edited)[0][0].woodblock, .8, "Invalid text leaves the previous data intact");
});

test("T: edits rename the reusable pattern, not the song, and retain its linked notes", () => {
  const initial = patterns.fromABC(groove(4));
  const renamed = patterns.updatePatternABC(initial, 1,
    patterns.patternABC(initial, 1).replace("T:A", "T:DDDD"));
  assert.equal(patterns.getPattern(renamed, 1).name, "DDDD");
  assert.equal(patterns.runs(renamed)[0].name, "DDDD");
  assert.match(patterns.patternABC(renamed, 1), /^T:DDDD$/m);
  assert.match(patterns.toABC(renamed), /^T:Beat$/m, "The expanded song keeps its own title");
  assert.deepEqual(signatures(renamed), signatures(initial));
  const tapped = patterns.toggleHit(renamed, 1, 1, 3, "woodblock", 1);
  assert.equal(patterns.getPattern(tapped, 1).name, "DDDD");
  assert.equal(signatures(tapped).filter(bar => bar[3].woodblock === 1).length, 4);
});

test("assigning an existing single-bar pattern targets any chosen song bar", () => {
  const initial = patterns.fromABC(groove(4));
  const detached = patterns.makeUnique(initial, 2);
  const variant = patterns.toggleHit(detached.project, detached.patternId, 1, 7, "woodblock", 1);
  const assigned = patterns.assignAtBar(variant, detached.patternId, 4);
  assert.deepEqual(patterns.runs(assigned).map(run => [run.name, run.startBar, run.endBar]),
    [["A", 1, 1], ["B", 2, 2], ["A", 3, 3], ["B", 4, 4]]);
  assert.equal(signatures(assigned)[1][7].woodblock, 1);
  assert.equal(signatures(assigned)[3][7].woodblock, 1);
  assert.equal(signatures(assigned)[0][7].woodblock, undefined);
  assert.equal(signatures(variant)[3][7].woodblock, undefined, "The source project is unchanged");
  const restored = patterns.assignAtBar(assigned, 1, 2);
  assert.equal(signatures(restored)[1][7].woodblock, undefined);
  assert.equal(patterns.atBar(restored, 2).pattern.id, 1);
});

test("assigning a longer pattern can split an old occurrence without losing untouched bars", () => {
  const initial = patterns.fromABC(groove(8));
  const grouped = patterns.groupBars(initial, 1, 4);
  const varied = patterns.toggleHit(grouped.project, grouped.patternId, 2, 7, "woodblock", 1);
  const before = signatures(varied);
  const assigned = patterns.assignAtBar(varied, 1, 2);
  const after = signatures(assigned);
  assert.equal(after[1][7].woodblock, undefined, "The selected bar adopts pattern A");
  for (const i of [0, 2, 3, 4, 5, 6, 7]) assert.deepEqual(after[i], before[i]);
  assert.equal(patterns.atBar(assigned, 2).pattern.id, 1);
  assert.equal(patterns.getPattern(assigned, grouped.patternId).bars.length, 4,
    "The original longer pattern remains available for reassignment");
  const fourAtFive = patterns.assignAtBar(assigned, grouped.patternId, 5);
  assert.equal(patterns.atBar(fourAtFive, 5).pattern.id, grouped.patternId);
  assert.equal(patterns.atBar(fourAtFive, 8).offset, 3);
  assert.equal(signatures(fourAtFive)[5][7].woodblock, 1);
  assert.throws(() => patterns.assignAtBar(assigned, grouped.patternId, 7), /needs 4 bar/);
});

test("assignment rejects a pattern that does not fit a pickup", () => {
  const pickup = patterns.fromABC(drums.groove({ meter, tempoQuarter: 96, totalBeats: 13,
    barDurations: [1, 4, 4, 4] }));
  const full = patterns.atBar(pickup, 2).pattern;
  assert.throws(() => patterns.assignAtBar(pickup, full.id, 1), /pickup|bar lengths/);
  assert.deepEqual(patterns.assignAtBar(pickup, full.id, 3).barDurations, [1, 4, 4, 4]);
  assert.deepEqual(signatures(pickup), signatures(patterns.assignAtBar(pickup, full.id, 3)));
});

test("replace range refuses partial occurrences and incompatible meter/pickup", () => {
  const eight = patterns.fromABC(groove(8));
  const pair = patterns.groupBars(eight, 1, 2);
  assert.throws(() => patterns.replaceRange(pair.project, pair.patternId, 2, 7), /complete pattern/);
  assert.throws(() => patterns.replaceRange(pair.project, pair.patternId, 3, 7), /complete pattern/);
  assert.throws(() => patterns.groupBars(pair.project, 2, 2), /complete bars/);
  const pickup = patterns.fromABC(drums.groove({ meter, tempoQuarter: 96, totalBeats: 13,
    barDurations: [1, 4, 4, 4] }));
  assert.deepEqual(pickup.barDurations, [1, 4, 4, 4]);
  const full = patterns.atBar(pickup, 2).pattern;
  assert.throws(() => patterns.replaceRange(pickup, full.id, 1, 4), /pickup|bar lengths/);
  assert.equal(patterns.runs(pickup).length, 2);
});

test("existing non-grid ABC is never discarded by pattern extraction", () => {
  const offGrid = "M:4/4\nL:1/8\nQ:1/4=96\nK:C clef=perc\nC/3 D/3 E/3 z7 |]";
  assert.equal(drums.parse(offGrid).totalBeats, 4);
  assert.throws(() => patterns.fromABC(offGrid), /sixteenth-note-aligned/);
  assert.match(offGrid, /C\/3/);
});

test("a bounded 32-bar arrangement can be written as ordinary expanded ABC", () => {
  const project = patterns.fromABC(groove(32));
  assert.equal(patterns.runs(project)[0].repeats, 32);
  const unique = patterns.makeUnique(project, 32);
  assert.equal(patterns.runs(unique.project).length, 2);
  const parsed = drums.parse(patterns.toABC(unique.project));
  assert.equal(parsed.bars.length, 32);
  assert.equal(parsed.totalBeats, 128);
  assert.throws(() => patterns.replaceRange(project, 1, 1, 33), /range/);
});
