"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const abc = require("./sound-abc.js");
const scoreModel = require("./sound-score.js");
const player = require("./sound-score-player.js");
const presets = require("./sound-ensemble-presets.js");
const ensemble = require("./sound-ensemble.js");
const temperament = require("./sound-temperaments.js");
const pieces = require("./sound-chopin-scores.js");

const near = (value, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(value - expected) < tolerance, `${value} != ${expected}`);

test("E5 linearly interpolated quarter-BPM has an analytic, invertible score clock", () => {
  const score = abc.parse("M:2/4\nL:1/4\nQ:1/4=60\nK:C\n" +
    "C2 |\nQ:1/4=60\nD2 |\n%%soundlab-tempo-ramp linear\nQ:1/4=120\nE2 |]");
  assert.deepEqual(score.tempoMap, [{ beat: 0, tempoQuarter: 60 },
    { beat: 2, tempoQuarter: 60, interpolation: "linear" },
    { beat: 4, tempoQuarter: 120 }]);
  near(scoreModel.beatToSeconds(score, 4), 2 + 2 * Math.log(2));
  near(scoreModel.tempoAtBeat(score, 3), 90);
  near(scoreModel.tempoAtBeat(score, 5), 120);
  for (const beat of [0, .25, 1, 2, 2.1, 2.5, 3, 3.9, 4, 4.5, 6]) {
    near(scoreModel.secondsToBeat(score, scoreModel.beatToSeconds(score, beat)), beat);
  }
  const old = abc.parse("M:2/4\nL:1/4\nQ:1/4=60\nK:C\n" +
    "C2 |\nQ:1/4=120\nD2 |]");
  near(scoreModel.beatToSeconds(old, 4), 3);
  assert.deepEqual(old.tempoMap.map(x => x.interpolation), [undefined, undefined]);
});

test("E5 score hairpins interpolate attack velocities, preserving accents and timings", () => {
  const score = abc.parse("M:2/4\nL:1/4\nQ:1/4=60\nK:C\n" +
    "!p!!<(!C !accent!D | !f!!<)!E F | !f!!>(!G A | !p!!>)!B c |]");
  const notes = score.parts[0].events;
  near(notes[0].velocity, .6);
  near(notes[1].velocity, (.6 + (1.17 - .6) / 2) * 1.16);
  near(notes[2].velocity, 1.17);
  near(notes[3].velocity, 1.17);
  near(notes[4].velocity, 1.17);
  near(notes[5].velocity, 1.17 - (1.17 - .6) / 2);
  near(notes[6].velocity, .6);
  assert.deepEqual(notes.map(x => x.startBeat), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("E5 ornaments resolve to timed pitches after a long tied note is consolidated", () => {
  const score = abc.parse("M:2/4\nL:1/4\nQ:1/4=120\nK:Db\n" +
    "!trill!_A2- | _A2- | _A2 | !mordent!_e2 |]");
  const notation = score.parts[0].events;
  assert.equal(notation[0].ornament, "trill");
  assert.equal(notation[1].tieFromPrevious, true);
  const audible = player.scheduledEvents(score);
  const trill = audible.filter(e => e.isOrnament && e.startBeat < 6);
  const mordent = audible.filter(e => e.isOrnament && e.startBeat >= 6);
  assert.ok(trill.length >= 27 && trill.length % 2 === 1);
  assert.deepEqual(trill.slice(0, 3).map(e => scoreModel.pitchNumber(e.pitch)),
    [68, 70, 68], "A-flat alternates with diatonic B-flat");
  assert.equal(mordent.length, 3);
  assert.deepEqual(mordent.map(e => scoreModel.pitchNumber(e.pitch)), [75, 77, 75]);
  near(trill[0].startBeat, 0);
  near(trill.at(-1).startBeat + trill.at(-1).durationBeats, 6);
  near(mordent.at(-1).startBeat + mordent.at(-1).durationBeats, 8);
  assert.equal(notation.filter(e => e.type === "note").length, 4,
    "ornaments do not rewrite the four actual ABC notes");
  assert.ok(player.scheduledEvents(score, 4).some(e => e.startBeat < 4),
    "late seeking retains the ornament's still-ringing attack");
});

test("E5 malformed ramps, hairpins and ornaments fail visibly without changing old ABC", () => {
  const header = "M:2/4\nL:1/4\nQ:1/4=60\nK:C\n";
  for (const body of [
    "%%soundlab-tempo-ramp linear\nC2 |]",
    "C2 |\n%%soundlab-tempo-ramp cubic\nD2 |]",
    "C2 |\n%%soundlab-tempo-ramp linear\nD2 |]",
    "C2 |\nQ:1/4=90\n%%soundlab-tempo-ramp linear\nQ:1/4=100\nD2 |]", // same Q boundary
    "!p!!<(!C D |]", "!p!!<(!C D | !p!!<)!E F |]",
    "!p!!<(!C D | !f!!>)!E F |]",
    "!trill!z C |]", "!mordent![CE]2 |]",
    "!trill!C- | !mordent!C |]"
  ]) {
    assert.throws(() => abc.parse(header + body), /tempo.ramp|hairpin|dynamic|ornament|note|Articulation|Bar/i, body);
  }
  const valid = abc.parse(header + "C D | E F |]");
  assert.equal(valid.tempoMap, undefined);
  assert.equal(valid.parts[0].events.length, 4);
});

function sourceSignature(score) {
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const rational = value => {
    const numerator = Math.round(value * 24);
    near(value, numerator / 24);
    const divisor = gcd(Math.abs(numerator), 24);
    return divisor === 24 ? String(numerator / divisor) : `${numerator / divisor}/${24 / divisor}`;
  };
  const active = new Map(), attacks = [];
  for (const event of score.parts[0].events) {
    if (event.type !== "note") continue;
    if (event.tieFromPrevious) {
      active.get(event.voiceId).duration += event.durationBeats;
      continue;
    }
    const item = { start: event.startBeat, duration: event.durationBeats,
      pitch: [event.pitch.letter, event.pitch.accidental, event.pitch.octave],
      staff: event.voiceId.startsWith("RH") ? "1" : "2" };
    attacks.push(item);
    active.set(event.voiceId, item);
  }
  attacks.sort((a, b) => Math.round(a.start * 24) - Math.round(b.start * 24) ||
    a.staff.localeCompare(b.staff) ||
    a.pitch[0].localeCompare(b.pitch[0]) || a.pitch[1] - b.pitch[1] ||
    a.pitch[2] - b.pitch[2] || Math.round(a.duration * 24) - Math.round(b.duration * 24));
  return { count: attacks.length, hash: crypto.createHash("sha256")
    .update(attacks.map(a => JSON.stringify([rational(a.start), rational(a.duration),
      a.pitch, a.staff])).join("\n")).digest("hex") };
}

test("RP4 complete Minute Waltz source signature, ornaments, printed expression and playback", () => {
  assert.ok(pieces.MINUTE_WALTZ_ABC.includes("CC0 1.0"));
  const entry = presets.CATALOG.find(piece => piece.id === "minuteWaltz");
  assert.equal(entry.category, "classics");
  for (const language of ["en", "mn"]) {
    const tracks = presets.create("minuteWaltz", language);
    assert.equal(tracks.length, 1);
    assert.equal(tracks[0].instrument, "piano");
    const { summary, prepared } = ensemble.parseTracks(tracks, "equal", temperament);
    const score = prepared[0].score;
    assert.equal(score.bars.length, 140);
    near(score.totalBeats, 420);
    near(scoreModel.beatToSeconds(score, 420), 131.34850624693615, 1e-7);
    assert.deepEqual(score.parts[0].voiceIds, ["RH1", "LH1", "LH2", "LH3"]);
    assert.equal(score.tempoMap.filter(x => x.interpolation === "linear").length, 4);
    assert.equal(score.parts[0].events.filter(e => e.ornament === "trill").length, 2);
    assert.equal(score.parts[0].events.filter(e => e.ornament === "mordent").length, 8);
    const { count, hash } = sourceSignature(score);
    assert.equal(count, 1360);
    assert.equal(hash, "26c2a8d1a802ebf7a63ab52ea293453f924dab09bb51c05f632974882b4ce08f");
    const sounding = player.scheduledEvents(score);
    assert.equal(sounding.length, 1440);
    assert.equal(sounding.filter(event => event.isGrace).length, 10);
    assert.equal(sounding.filter(event => event.isOrnament).length, 80);
    assert.equal(summary.eventCount, sounding.length);
    assert.ok(sounding.at(-1).startBeat > 417,
      "all written music survives the first/second ending and final cadence");
    assert.ok(player.scheduledEvents(score, 400).some(x => x.startBeat >= 400));
    assert.ok(score.parts[0].events.some(x => x.velocity === 1.17), "printed f is audible");
    assert.ok(score.parts[0].events.some(x => x.velocity === .42), "printed pp is audible");
    assert.ok(score.parts[0].events.some(x => x.velocity > .6 && x.velocity < 1.17),
      "hairpin velocities interpolate smoothly between source and editorial dynamics");
  }
});
