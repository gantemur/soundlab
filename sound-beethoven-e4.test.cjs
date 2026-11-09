"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const abc = require("./sound-abc.js");
const scoreModel = require("./sound-score.js");
const player = require("./sound-score-player.js");
const preset = require("./sound-ensemble-presets.js");
const ensemble = require("./sound-ensemble.js");
const temperament = require("./sound-temperaments.js");

const note = body => abc.parse("M:2/4\nL:1/4\nQ:1/4=60\nK:C\n" + body);
const near = (x, y) => assert.ok(Math.abs(x - y) < 1e-8, `${x} != ${y}`);

test("E4 pedal marks change piano release but do not change written lengths", () => {
  const written = note("!ped!C D | !ped-up!E F |]");
  assert.deepEqual(written.pedalMap, [{ beat: 0, down: true }, { beat: 2, down: false }]);
  assert.deepEqual(written.parts[0].events.map(e => e.durationBeats), [1, 1, 1, 1]);
  const attacks = player.scheduledEvents(written);
  assert.deepEqual(attacks.map(e => e.pedalEndBeat), [2, 2, 3, 4]);
  const ranges = ["piano", "fmep", "sine"].map(instrument => {
    const synth = Object.create(player.Player.prototype);
    synth.instrument = instrument;
    return synth.noteOffBeat(attacks[0]);
  });
  assert.deepEqual(ranges, [2, 2, 1], "only struck piano models retain pedal resonance");
  assert.equal(scoreModel.pedalReleaseBeat(written, 2), 2, "pedal-up at a key release has precedence");
});

test("E4 staccato and legato modify sounding releases without moving attacks or score bars", () => {
  const score = note("!staccato!C !tenuto!D | !legato!E F |]");
  const attacks = player.scheduledEvents(score);
  assert.deepEqual(attacks.map(e => e.startBeat), [0, 1, 2, 3]);
  near(attacks[0].durationBeats, .58);
  near(attacks[1].durationBeats, .97);
  near(attacks[2].durationBeats, 1.07);
  near(attacks[3].durationBeats, 1);
  assert.deepEqual(score.parts[0].events.map(e => e.durationBeats), [1, 1, 1, 1]);
});

test("E4 grace notes are timed separately, steal host time, and inherit expression", () => {
  const written = note("!p!{^F G}!legato!A B | C2 |]");
  const notation = written.parts[0].events;
  assert.deepEqual(notation[0].gracePitches.map(p => scoreModel.pitchNumber(p)), [66, 67]);
  near(notation[0].durationBeats, 1);
  const attacks = player.scheduledEvents(written);
  assert.equal(attacks.length, 5);
  assert.deepEqual(attacks.slice(0, 2).map(e => e.isGrace), [true, true]);
  near(scoreModel.beatToSeconds(written, attacks[1].startBeat), .055);
  near(scoreModel.beatToSeconds(written, attacks[2].startBeat), .11);
  assert.ok(attacks[2].durationBeats > .5 && attacks[2].velocity === .6);
  assert.ok(attacks[0].velocity < attacks[2].velocity);
  assert.equal(written.totalBeats, 4);
});

test("E4 rejects malformed pedal/grace/articulation notation, including conflicting voices", () => {
  for (const body of ["!ped-up!C2 |]", "!ped!C2 |]", "!ped!!ped!C2 |]",
    "!staccato!!legato!C2 |]", "{C}z C |]", "{C} | C2 |]", "{C2}C2 |]",
    "{C}C2- | {D}C2 |]", "!ped!C2 | !ped-up!!ped!C2 |]"]) {
    assert.throws(() => note(body), /ped|grace|Articulation|articulation|Unsupported|same bar|Pitch/i, body);
  }
  const twoVoices = "M:2/4\nL:1/4\nQ:1/4=60\nK:C\n" +
    "V:Right\n!ped!C2 | !ped-up!D2 |]\n" +
    "V:Left\n!ped!E2 | F2 !ped-up! |]";
  assert.throws(() => abc.parse(twoVoices), /pedal maps must agree/);
});

function sourceSignature(score) {
  // The XML's time divisions are 1/24 quarter beat. Reconstruct exact rational
  // onset/length from the independently parsed ABC (undo only ABC bar ties).
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const rational = x => {
    const n = Math.round(x * 24), divisor = gcd(Math.abs(n), 24);
    near(x, n / 24);
    return divisor === 24 ? String(n / divisor) : `${n / divisor}/${24 / divisor}`;
  };
  const current = new Map(), attacks = [];
  for (const event of score.parts[0].events) {
    if (event.type !== "note") continue;
    if (event.tieFromPrevious) {
      current.get(event.voiceId).duration += event.durationBeats;
      continue;
    }
    const item = { start: event.startBeat, duration: event.durationBeats,
      pitch: [event.pitch.letter, event.pitch.accidental, event.pitch.octave],
      staff: event.voiceId.startsWith("RH") ? "1" : "2" };
    current.set(event.voiceId, item);
    attacks.push(item);
  }
  attacks.sort((a, b) => a.start - b.start || a.staff.localeCompare(b.staff) ||
    a.pitch[0].localeCompare(b.pitch[0]) || a.pitch[1] - b.pitch[1] ||
    a.pitch[2] - b.pitch[2] || a.duration - b.duration);
  const signature = attacks.map(a => JSON.stringify([
    rational(a.start), rational(a.duration), a.pitch, a.staff])).join("\n");
  return { attacks, hash: crypto.createHash("sha256").update(signature).digest("hex") };
}

test("RP3 exact full-work XML signature survives repeated endings, polyphony and tuplets", () => {
  const piece = preset.CATALOG.find(item => item.id === "furElise");
  assert.equal(piece.category, "classics");
  assert.match(piece.description.en, /Complete WoO 59/);
  for (const language of ["mn", "en"]) {
    const tracks = preset.create("furElise", language);
    assert.equal(tracks.length, 1);
    assert.equal(tracks[0].instrument, "piano");
    assert.ok(tracks[0].abc.includes("CC0 1.0") && tracks[0].abc.includes("!ped!"));
    const { summary, prepared } = ensemble.parseTracks(tracks, "equal", temperament);
    const score = prepared[0].score;
    assert.equal(score.bars.length, 126);
    near(score.bars[0].durationBeats, .5);
    near(score.bars.at(-1).durationBeats, 1);
    near(score.totalBeats, 187.5);
    near(scoreModel.beatToSeconds(score, score.totalBeats), 156.0952012383901);
    assert.equal(summary.eventCount, 1041, "1,038 main attacks + 3 graces");
    assert.deepEqual(score.parts[0].voiceIds,
      ["RH1", "RH2", "RH3", "RH4", "LH1", "LH2", "LH3"]);
    assert.equal(score.pedalMap.length, 14);
    assert.deepEqual(score.tempoMap.map(entry => entry.tempoQuarter), [72, 68, 72, 76, 72]);
    const exact = sourceSignature(score);
    assert.equal(exact.attacks.length, 1038);
    assert.equal(exact.hash, "8f752d046a98272b1b0783b48a979ebe4ccd963a86a919d33400d3ac8a9e2a58");
    assert.ok(exact.attacks.at(-1).start > 184, "complete final cadence is present");
    const sounded = player.scheduledEvents(score);
    assert.equal(sounded.filter(e => e.isGrace).length, 3);
    assert.equal(sounded.filter(e => e.articulation === "staccato").length, 70);
    assert.ok(sounded.some(e => e.pedalEndBeat > e.startBeat + e.durationBeats + .25));
  }
});
