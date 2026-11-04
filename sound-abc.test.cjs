"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const abc = require("./sound-abc.js");
const score = require("./sound-score.js");
const temperaments = require("./sound-temperaments.js");
const { EXAMPLES } = require("./sound-compose.js");

const piece = (body, options = {}) => [
  "X:1", "T:A short piece", `M:${options.meter || "4/4"}`,
  `L:${options.unit || "1/4"}`, `Q:${options.tempo || "1/4=96"}`,
  `K:${options.key || "C"}`, body
].join("\n");

test("all Compose examples are valid measured single-part scores", () => {
  for (const [name, source] of Object.entries(EXAMPLES)) {
    const parsed = abc.parse(source);
    assert.equal(parsed.version, 1, name);
    assert.equal(parsed.parts.length, 1, name);
    const expectedBars = { ode: 16, minuetG: 32, lightly: 16, mozart40: 20,
      frere: 8, twinkle: 12 }[name] || 4;
    assert.equal(parsed.bars.length, expectedBars, name);
    assert.equal(parsed.totalBeats, name === "waltz" ? 12 :
      name === "minuetG" ? 96 : name === "lightly" ? 32 :
      name === "mozart40" ? 80 : name === "frere" ? 32 :
      name === "twinkle" ? 48 : name === "ode" ? 64 : 16, name);
    assert.equal(parsed.parts[0].events[0].startBeat, 0, name);
    assert.equal(parsed.parts[0].events.at(-1).startBeat +
      parsed.parts[0].events.at(-1).durationBeats, parsed.totalBeats, name);
    assert.ok(parsed.totalBeats * score.secondsPerBeat(parsed) <= 90, name);
    for (const note of parsed.parts[0].events.filter(e => e.type === "note")) {
      const hz = score.frequency(note.pitch);
      assert.ok(hz >= score.MIN_NOTE_HZ && hz <= score.MAX_NOTE_HZ,
        `${name}: ${score.pitchName(note.pitch)} is in range for every Compose instrument`);
    }
    assert.equal(score.validate(parsed), parsed);
  }
});

test("published melodies preserve musical signatures rather than replacing them with exercises", () => {
  const ode = abc.parse(EXAMPLES.ode);
  assert.equal(ode.parts[0].events.length, 62);
  assert.deepEqual(ode.parts[0].events.slice(0, 4).map(e => score.pitchName(e.pitch)),
    ["B4", "B4", "C5", "D5"]);
  const mozart = abc.parse(EXAMPLES.mozart40);
  assert.equal(mozart.key.name, "Gm");
  assert.equal(mozart.parts[0].events[0].type, "rest");
  assert.equal(mozart.parts[0].events[0].durationBeats, 3,
    "The Mozart theme retains the original three-beat lead-in before the violin upbeat");
  assert.deepEqual(mozart.parts[0].events.slice(1, 3).map(e => score.pitchName(e.pitch)),
    ["E♭4", "D4"]);
  const minuet = abc.parse(EXAMPLES.minuetG);
  assert.equal(minuet.key.name, "G");
  assert.equal(score.pitchName(minuet.parts[0].events.at(-1).pitch), "G3");
});

test("ABC note values, rests, split bars and double bars preserve exact timing", () => {
  const parsed = abc.parse(piece("C2 z D/ E/ | F G A B || c4 |]"));
  assert.deepEqual(parsed.parts[0].events.slice(0, 4).map(e =>
    [e.type, e.startBeat, e.durationBeats]), [
    ["note", 0, 2], ["rest", 2, 1], ["note", 3, .5], ["note", 3.5, .5]
  ]);
  assert.deepEqual(parsed.bars.map(b => b.startBeat), [0, 4, 8]);
  assert.equal(parsed.parts[0].events.at(-1).pitch.octave, 5);
  assert.equal(parsed.totalBeats, 12);
});

test("key signatures, explicit accidentals and octave markings are spelled, not flattened", () => {
  const parsed = abc.parse(piece("F ^F F =F | F _F F2 | C, C' c, c' | B4 |]", { key: "G" }));
  const pitches = parsed.parts[0].events.map(e => score.pitchName(e.pitch));
  assert.deepEqual(pitches, ["F♯4", "F♯4", "F♯4", "F4", "F♯4", "F♭4",
    "F♭4", "C3", "C5", "C4", "C6", "B4"]);
  assert.equal(parsed.key.fifths, 1);
  assert.equal(abc.parse(piece("B4 |]", { key: "Bb" })).parts[0].events[0].pitch.accidental, -1);
  assert.equal(abc.parse(piece("F4 |]", { key: "Em" })).parts[0].events[0].pitch.accidental, 1);
});

test("tempo units and meter denominators use quarter-beat timing", () => {
  const compound = abc.parse(piece("C3 D3 | E6 |]", {
    meter: "6/8", unit: "1/8", tempo: "1/8=144" }));
  assert.equal(compound.meter.quarterBeats, 3);
  assert.equal(compound.tempoQuarter, 72);
  assert.deepEqual(compound.parts[0].events.map(e => e.durationBeats), [1.5, 1.5, 3]);
  assert.equal(compound.totalBeats * score.secondsPerBeat(compound), 5);
});

test("different tunings change frequencies while preserving equal-temperature A4", () => {
  const a4 = { letter: "A", accidental: 0, octave: 4 };
  assert.equal(score.frequency(a4, "equal"), 440);
  for (const tuning of score.TUNINGS) {
    const a = score.frequency(a4, tuning, 440, temperaments);
    assert.ok(a > 435 && a < 445);
  }
  const e4 = { letter: "E", accidental: 0, octave: 4 };
  assert.notEqual(score.frequency(e4, "equal"),
    score.frequency(e4, "just", 440, temperaments));
  const c4 = { letter: "C", accidental: 0, octave: 4 };
  assert.ok(Math.abs(score.frequency({ ...c4, octave: 5 }, "pythagorean", 440, temperaments) /
    score.frequency(c4, "pythagorean", 440, temperaments) - 2) < 1e-12);
});

test("C1 parser rejects unsupported notation and visibly detects rhythm errors", () => {
  const invalid = [
    piece("C D E |]"), // incomplete non-final bar only? final partial allowed, so use non-final
    piece("C4 | C2 D | C4 |]"),
    piece("C D E F | [CE]2 |]"),
    piece("C D E F |: C4 :|"),
    piece("C D E F | (3CDE C |]"),
    piece("C D E F | C4 |]", { key: "H" }),
    piece("C D E F | C4 |]", { tempo: "1/4=600" }),
    piece("C D E F | C4 |]", { unit: "1/5" }),
    piece("C D E F | C4 |]", { meter: "27/4" }),
    piece("C D E F | C4 |]", { key: "C" }) + "\nC",
    piece("C D E F | C4 |]", { key: "C" }).replace("K:C", "K:C\nK:G")
  ];
  // A single final pickup/partial bar is permitted; check it explicitly.
  assert.equal(abc.parse(invalid.shift()).bars[0].partial, true);
  for (const source of invalid) assert.throws(() => abc.parse(source), abc.ABCError);
  assert.throws(() => abc.parse(piece("C8 |]")), /Bar 1 has 8 quarter beats/);
  assert.throws(() => abc.parse(piece("C D E F | C4 |]".repeat(17))), abc.ABCError);
  assert.throws(() => abc.parse(" ".repeat(8193)), abc.ABCError);
});


test("a first pickup and final partial bar preserve time without hiding an interior rhythm error", () => {
  const parsed = abc.parse(piece("C/ D/ | E4 | G3 |]"));
  assert.deepEqual(parsed.bars.map(bar => [bar.number, bar.startBeat, bar.durationBeats, bar.partial]),
    [[1, 0, 1, true], [2, 1, 4, false], [3, 5, 3, true]]);
  assert.equal(parsed.bars[0].pickup, true);
  assert.equal(parsed.parts[0].events[2].bar, 2, "Notated bar indices remain one-based");
  assert.equal(parsed.totalBeats, 8);
  assert.equal(abc.parse(piece("C/ D/ | E4 | G3 |")).totalBeats, 8,
    "A trailing ordinary barline also closes a final partial bar");
  assert.equal(abc.parse(piece("C3 |]")).bars[0].pickup, false);
  assert.throws(() => abc.parse(piece("C | D3 | E4 |]")), /Bar 2 has 3 quarter beats/);
  assert.throws(() => abc.parse(piece("C5 | E4 |]")), /Bar 1 has 5 quarter beats/);
});

test("ties retain separate notated notes through barlines and line breaks", () => {
  const parsed = abc.parse(piece("C2-C2- |\nC2 C D |]"));
  const events = parsed.parts[0].events;
  assert.deepEqual(events.map(event => [event.startBeat, event.durationBeats, event.bar,
    event.tieFromPrevious, event.tieToNext]), [
    [0, 2, 1, false, true], [2, 2, 1, true, true],
    [4, 2, 2, true, false], [6, 1, 2, false, false], [7, 1, 2, false, false]
  ]);
  assert.equal(parsed.totalBeats, 8);
});

test("a tied accidental crosses a barline without changing later untied notes", () => {
  for (const [key, source, expected] of [
    ["C", "^F2- | F2 F2 |]", ["F♯4", "F♯4", "F4"]],
    ["G", "=F2- | F2 F2 |]", ["F4", "F4", "F♯4"]],
    ["C", "^F2- | F4- | F2 F2 |]", ["F♯4", "F♯4", "F♯4", "F4"]],
    ["C", "^F2- | ^F2 F2 |]", ["F♯4", "F♯4", "F♯4"]]
  ]) {
    const parsed = abc.parse(piece(source, { key }));
    assert.deepEqual(parsed.parts[0].events.map(event => score.pitchName(event.pitch)), expected);
  }
  for (const source of ["C2-D2 |]", "C2-c2 |]", "^C2-_D2 |]", "^F2-=F2 |]",
    "C2-z2 |]", "z2-C2 |]", "C4- |]", "C4-", "-C4 |]", "C2--C2 |]"]) {
    assert.throws(() => abc.parse(piece(source)), abc.ABCError, source);
  }
});

test("the score model rejects broken, orphaned and nonboolean tie metadata", () => {
  const source = abc.parse(piece("C2-C2 | C4 |]"));
  for (const mutate of [
    events => { events[0].tieToNext = "yes"; },
    events => { events[1].tieFromPrevious = null; },
    events => { events[0].tieFromPrevious = true; },
    events => { events[0].tieToNext = false; },
    events => { events[1].tieFromPrevious = false; },
    events => { events[1].pitch.letter = "D"; },
    events => { events[1].type = "rest"; },
    events => { events.at(-1).tieToNext = true; }
  ]) {
    const broken = structuredClone(source);
    mutate(broken.parts[0].events);
    assert.throws(() => score.validate(broken), RangeError);
  }
});

test("larger scores stay bounded by bars, notated events, beats and 90 seconds", () => {
  const fullBars = count => Array(count).fill("C4").join(" | ") + " |]";
  const thirtyTwo = abc.parse(piece(fullBars(32)));
  assert.equal(thirtyTwo.bars.length, 32);
  assert.equal(thirtyTwo.totalBeats, 128);
  assert.throws(() => abc.parse(piece(fullBars(33))), /Maximum 32 bars/);
  const eightNotes = "C D E F G A B c";
  const atEventLimit = Array(32).fill(eightNotes).join(" | ") + " |]";
  assert.equal(abc.parse(piece(atEventLimit, { unit: "1/8" })).parts[0].events.length, 256);
  assert.throws(() => abc.parse(piece(atEventLimit.replace(eightNotes, "C/ C/ D E F G A B c"),
    { unit: "1/8" })), /Maximum 256 notes\/rests/);
  const atBeatLimit = Array(21).fill("C12").join(" | ") + " | C4 |]";
  assert.equal(abc.parse(piece(atBeatLimit, { meter: "12/4", tempo: "1/4=320" })).totalBeats, 256);
  assert.throws(() => abc.parse(piece(atBeatLimit.replace("C4 |]", "C5 |]"),
    { meter: "12/4", tempo: "1/4=320" })), /Maximum 256 quarter beats/);
  const ninetySeconds = abc.parse(piece(fullBars(30), { tempo: "1/4=80" }));
  assert.equal(ninetySeconds.totalBeats * score.secondsPerBeat(ninetySeconds), 90);
  assert.throws(() => abc.parse(piece(fullBars(30), { tempo: "1/4=79" })), /90 seconds/);
});
