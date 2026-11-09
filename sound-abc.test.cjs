"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const abc = require("./sound-abc.js");
const score = require("./sound-score.js");
const temperaments = require("./sound-temperaments.js");
const { EXAMPLES, EXAMPLE_INFO } = require("./sound-compose.js");

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
      frere: 8, twinkle: 12, korobeiniki: 16, kalinka: 27, birch: 8,
      bella: 17, greensleeves: 17, daisy: 32, paloma: 20 }[name] || 4;
    assert.equal(parsed.bars.length, expectedBars, name);
    assert.equal(parsed.totalBeats, name === "waltz" ? 12 :
      name === "minuetG" ? 96 : name === "lightly" ? 32 :
      name === "mozart40" ? 80 : name === "frere" ? 32 :
      name === "twinkle" ? 48 : name === "ode" ? 64 :
      name === "korobeiniki" ? 32 : name === "kalinka" ? 53 :
      name === "birch" || name === "greensleeves" ? 48 : name === "bella" ? 64 :
      name === "daisy" ? 96 : name === "paloma" ? 40 : 16, name);
    assert.equal(parsed.parts[0].events[0].startBeat, 0, name);
    assert.equal(parsed.parts[0].events.at(-1).startBeat +
      parsed.parts[0].events.at(-1).durationBeats, parsed.totalBeats, name);
    assert.ok(parsed.totalBeats * score.secondsPerBeat(parsed) <= 90, name);
    const lower = EXAMPLE_INFO[name]?.instrument === "guitar" ? 80 : score.MIN_NOTE_HZ;
    const pitches = parsed.parts[0].events.flatMap(event => event.type === "chord" ? event.pitches :
      event.type === "note" ? [event.pitch] : []);
    for (const pitch of pitches) {
      const hz = score.frequency(pitch);
      assert.ok(hz >= lower && hz <= score.MAX_NOTE_HZ,
        `${name}: ${score.pitchName(pitch)} is in range for the example's instrument`);
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

test("Russian folk presets retain their source phrases, pickup, cadence and repeated stanza", () => {
  const korobeiniki = abc.parse(EXAMPLES.korobeiniki);
  assert.equal(korobeiniki.key.name, "Dm");
  assert.deepEqual(korobeiniki.parts[0].events.slice(0, 4).map(e => score.pitchName(e.pitch)),
    ["A4", "E4", "F4", "G4"]);
  assert.equal(score.pitchName(korobeiniki.parts[0].events.at(-2).pitch), "D4");
  assert.equal(korobeiniki.parts[0].events.at(-1).type, "rest");

  const kalinka = abc.parse(EXAMPLES.kalinka);
  assert.equal(kalinka.key.name, "Em");
  assert.equal(kalinka.bars[0].pickup, true);
  assert.equal(kalinka.bars[0].durationBeats, 1);
  assert.deepEqual(kalinka.parts[0].events.slice(0, 4).map(e => score.pitchName(e.pitch)),
    ["B4", "A4", "F♯4", "G4"]);
  assert.equal(score.pitchName(kalinka.parts[0].events.at(-1).pitch), "B4");

  const birch = abc.parse(EXAMPLES.birch);
  assert.equal(birch.key.name, "Am");
  assert.deepEqual(birch.parts[0].events.slice(0, 4).map(e => score.pitchName(e.pitch)),
    ["E4", "E4", "E4", "E4"]);
  assert.deepEqual(birch.parts[0].events.filter(e => e.bar <= 4).map(e =>
    [score.pitchName(e.pitch), e.durationBeats]),
  birch.parts[0].events.filter(e => e.bar >= 5).map(e =>
    [score.pitchName(e.pitch), e.durationBeats]),
  "The traditional four-bar stanza is repeated exactly");
  assert.equal(score.pitchName(birch.parts[0].events.at(-1).pitch), "A3");
});

test("Bella Ciao contains two traditional stanzas, a pickup and a resolved cadence", () => {
  const bella = abc.parse(EXAMPLES.bella);
  assert.equal(bella.key.name, "Am");
  assert.deepEqual(bella.bars.filter(b => b.partial).map(b => b.number), [1, 17]);
  assert.equal(bella.bars[0].durationBeats, 1);
  assert.equal(bella.bars.at(-1).durationBeats, 3);
  assert.deepEqual(bella.parts[0].events.slice(0, 3).map(e => score.pitchName(e.pitch)),
    ["A4", "B4", "C5"]);
  assert.equal(score.pitchName(bella.parts[0].events.at(-1).pitch), "A4");
});

test("Greensleeves retains the pickup, minor cadences and complete verse/refrain", () => {
  const tune = abc.parse(EXAMPLES.greensleeves);
  assert.equal(tune.key.name, "Em");
  assert.deepEqual(tune.bars.filter(bar => bar.partial).map(bar => bar.durationBeats), [0.5, 2.5]);
  const events = tune.parts[0].events;
  assert.deepEqual(events.slice(0, 6).map(event => score.pitchName(event.pitch)),
    ["E4", "G4", "A4", "B4", "C5", "B4"]);
  assert.equal(score.pitchName(events.find(event => event.bar === 10).pitch), "D5",
    "The refrain starts after the complete verse");
  assert.ok(events.some(event => score.pitchName(event.pitch) === "C♯4"));
  assert.ok(events.some(event => score.pitchName(event.pitch) === "D♯4"));
  assert.deepEqual(events.slice(-2).map(event => [score.pitchName(event.pitch), event.durationBeats]),
    [["E4", 1.5], ["E4", 1]]);
});

test("Daisy Bell preserves the historical chorus ties, triplet and closing rests", () => {
  const tune = abc.parse(EXAMPLES.daisy);
  const events = tune.parts[0].events;
  assert.equal(tune.key.name, "G");
  assert.deepEqual(events.slice(0, 4).map(event => score.pitchName(event.pitch)),
    ["D5", "B4", "G4", "D4"]);
  assert.deepEqual(events.filter(event => event.tieToNext).map(event => event.bar), [7, 15, 19, 23, 31]);
  const turn = events.filter(event => event.bar === 19);
  assert.deepEqual(turn.map(event => score.pitchName(event.pitch)), ["A4", "B4", "A4", "G4"]);
  assert.ok(turn.slice(0, 3).every(event => Math.abs(event.durationBeats - 1 / 3) < 1e-7));
  assert.equal(turn[3].durationBeats, 2);
  assert.equal(events.at(-2).tieFromPrevious, true);
  assert.equal(events.at(-1).type, "rest");
  assert.equal(events.at(-1).durationBeats, 2);
});

test("La Paloma retains triplets, tied sustains and rearticulated pickups in its opening section", () => {
  const tune = abc.parse(EXAMPLES.paloma);
  const events = tune.parts[0].events;
  assert.equal(tune.key.name, "C");
  assert.equal(events[0].type, "rest");
  assert.equal(events[0].durationBeats, 1.5);
  assert.deepEqual(events.slice(1, 6).map(event => score.pitchName(event.pitch)),
    ["G4", "G4", "G4", "F4", "G4"]);
  assert.deepEqual(events.filter(event => event.tieToNext).map(event => event.bar), [2, 5, 7, 10, 12, 15, 17]);
  const figure = events.filter(event => event.bar === 9);
  assert.deepEqual(figure.map(event => score.pitchName(event.pitch)), ["C5", "B4", "A4", "G4", "F4"]);
  assert.ok(figure.slice(0, 3).every(event => Math.abs(event.durationBeats - 1 / 3) < 1e-7));
  assert.deepEqual(figure.slice(-2).map(event => event.durationBeats), [0.75, 0.25]);
  for (const bar of [6, 11, 16]) {
    assert.ok(!events.filter(event => event.bar === bar).at(-1).tieToNext,
      "The printed pickup is attacked again at the following bar");
  }
  assert.equal(score.pitchName(events.at(-1).pitch), "E4");
});

test("ABC bracketed chords keep simultaneous pitches, shared durations and accidentals", () => {
  const parsed = abc.parse(piece("[^CEG]2 z [EGB] | [CEG]3 z |]"));
  const events = parsed.parts[0].events;
  assert.equal(parsed.totalBeats, 8);
  assert.equal(events[0].type, "chord");
  assert.deepEqual(events[0].pitches.map(score.pitchName), ["C♯4", "E4", "G4"]);
  assert.equal(events[0].durationBeats, 2);
  assert.deepEqual(events.map(e => [e.type, e.startBeat, e.durationBeats]), [
    ["chord", 0, 2], ["rest", 2, 1], ["chord", 3, 1],
    ["chord", 4, 3], ["rest", 7, 1]
  ]);
  assert.equal(score.validate(parsed), parsed);
  for (const bad of ["[C]4", "[CC]4", "[Cz]4", "[CE]4-", "[CE", "[CDEFGAB]4"]) {
    assert.throws(() => abc.parse(piece(bad + " |]")), /./, bad);
  }
});

test("ABC V: blocks preserve overlapping independent rhythms, ties and dynamic state", () => {
  const source = piece("V:Right\n!p!C4- | C4 |]\n" +
    "V:Left\nz2 !f!^F2 | F2 =F2 |]");
  const parsed = abc.parse(source);
  assert.deepEqual(parsed.parts[0].voiceIds, ["Right", "Left"]);
  assert.equal(parsed.parts.length, 1, "the voices belong to one instrument");
  assert.equal(parsed.bars.length, 2);
  assert.equal(parsed.totalBeats, 8);
  const right = parsed.parts[0].events.filter(e => e.voiceId === "Right");
  const left = parsed.parts[0].events.filter(e => e.voiceId === "Left");
  assert.deepEqual(right.map(e => e.startBeat), [0, 4]);
  assert.deepEqual(left.map(e => e.startBeat), [0, 2, 4, 6]);
  assert.ok(right.every(e => e.velocity === .6));
  assert.equal(left[1].velocity, 1.17);
  assert.deepEqual(left.slice(1).map(e => score.pitchName(e.pitch)),
    ["F♯4", "F4", "F4"], "accidentals and bar resets belong to the voice");
  assert.equal(score.validate(parsed), parsed);
});

test("RP2 Q: changes form one exact monotone clock, including inside the first polyphonic voice", () => {
  const source = "M:2/4\nL:1/4\nQ:1/4=60\nK:C\n" +
    "V:RH\nC2 |\nQ:1/4=120\nD2 |\nQ:1/4=80\nE2 |]\n" +
    "V:LH\nC,2 | D,2 | E,2 |]";
  const parsed = abc.parse(source);
  assert.deepEqual(parsed.tempoMap, [{ beat: 0, tempoQuarter: 60 },
    { beat: 2, tempoQuarter: 120 }, { beat: 4, tempoQuarter: 80 }]);
  assert.equal(score.beatToSeconds(parsed, 2), 2);
  assert.equal(score.beatToSeconds(parsed, 4), 3);
  assert.equal(score.beatToSeconds(parsed, 6), 4.5);
  assert.equal(score.tempoAtBeat(parsed, 3), 120);
  for (const beat of [0, .25, 1.75, 2, 2.5, 3.99, 4, 5, 6]) {
    assert.ok(Math.abs(score.secondsToBeat(parsed, score.beatToSeconds(parsed, beat)) - beat) < 1e-11);
  }
  assert.equal(score.beatToSeconds(abc.parse(piece("C4 |]")), 4), 2.5,
    "old scores remain fixed-tempo without additional fields");
  assert.throws(() => score.secondsToBeat(parsed, -1), /Invalid score time/);
  assert.throws(() => score.beatToSeconds(parsed, NaN), /Invalid score beat/);
  for (const bad of [
    "C2\nQ:1/4=120\nD2 |]",
    "C2 |]\nQ:1/4=120",
    "C2 |\nQ:1/4=20\nD2 |]"
  ]) assert.throws(() => abc.parse(piece(bad, { meter: "2/4", tempo: "1/4=60" })), /./);
  const mismatched = source.replace("V:LH\nC,2 | D,2 | E,2 |]",
    "V:LH\nC,2 |\nQ:1/4=100\nD,2 |\nQ:1/4=80\nE,2 |]");
  assert.throws(() => abc.parse(mismatched), /tempo maps must agree/);
  const badModel = structuredClone(parsed);
  badModel.tempoMap[1].beat = 0;
  assert.throws(() => score.validate(badModel), /tempo map/);
});

test("V: blocks reject misaligned measures, stray music, repeated IDs and corrupt voice timing", () => {
  const header = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\n";
  for (const bad of [
    "C4 |]\nV:A\nC4 |]",
    "V:A\nC4 |]\nV:A\nE4 |]",
    "V:A\nC4 |]\nV:B\n",
    "V:A\nC4 |]\nV:B\nC2 |]",
    "V:A\nC | C4 | C3 |]\nV:B\nC4 | C4 |]",
    "V:two words\nC4 |]",
    "V:A\nC4 |]\nV:B\nD4 |]\nQ:1/4=90"
  ]) assert.throws(() => abc.parse(header + bad), /./, bad);
  assert.throws(() => abc.parse("V:A\n" + header + "C4 |]"), /K: before/);
  const valid = abc.parse(header + "V:A\nC4 |]\nV:B\nE4 |]");
  const corrupt = structuredClone(valid);
  corrupt.parts[0].events[1].startBeat = .5;
  assert.throws(() => score.validate(corrupt), /timing/);
  const orphan = structuredClone(valid);
  orphan.parts[0].events[0].voiceId = "missing";
  assert.throws(() => score.validate(orphan), /voice/);
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
    piece("C D E F | [CE]5 |]"),
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

test("persistent score-level dynamics and one-shot accents keep written pitches and timing", () => {
  const scoreWithDynamics = abc.parse(piece("!p!C !accent!D E !mf![CEG] | !ff!G A B c |]"));
  assert.equal(scoreWithDynamics.totalBeats, 8);
  const events = scoreWithDynamics.parts[0].events;
  assert.deepEqual(events.map(event => event.velocity),
    [.6, Math.min(1.5, .6 * 1.16), .6, 1, 1.32, 1.32, 1.32, 1.32]);
  assert.deepEqual(events.map(event => event.startBeat), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(events[3].type, "chord");
  assert.equal(score.validate(scoreWithDynamics), scoreWithDynamics);
  for (const invalid of ["!ppp!C4", "!fermata!C4", "!p C4"]) {
    assert.throws(() => abc.parse(piece(invalid + " |]")), /dynamic|Close each/);
  }
  for (const value of [-.1, 0, 1.6, Infinity, NaN]) {
    const invalid = structuredClone(scoreWithDynamics);
    invalid.parts[0].events[0].velocity = value;
    assert.throws(() => score.validate(invalid), RangeError);
  }
});

test("complete scores can exceed former bar, event, beat and 90-second cutoffs", () => {
  const fullBars = count => Array(count).fill("C4").join(" | ") + " |]";
  const longPiece = abc.parse(piece(fullBars(200), { tempo: "1/4=80" }));
  assert.equal(longPiece.bars.length, 200);
  assert.equal(longPiece.totalBeats, 800);
  assert.equal(longPiece.totalBeats * score.secondsPerBeat(longPiece), 600);
  const eightNotes = "C D E F G A B c";
  const dense = abc.parse(piece(Array(140).fill(eightNotes).join(" | ") + " |]", { unit: "1/8" }));
  assert.equal(dense.parts[0].events.length, 1120);
  assert.equal(score.validate(dense).totalBeats, 560);
});
