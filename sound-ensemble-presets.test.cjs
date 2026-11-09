"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const abc = require("./sound-abc.js");
const score = require("./sound-score.js");
const compose = require("./sound-compose.js");
const presets = require("./sound-ensemble-presets.js");
const ensemble = require("./sound-ensemble.js");
const playerModel = require("./sound-score-player.js");
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
  for (const { id } of presets.CATALOG.filter(piece => piece.id !== "starter")) {
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
  assert.equal(presets.CATALOG.length, 27);
});

test("Turkish March is the complete K.331 finale with all unfolded pitched/grace attacks", () => {
  const catalog = presets.CATALOG.find(piece => piece.id === "turkishMarch");
  assert.equal(catalog.category, "classics");
  assert.match(catalog.description.en, /complete finale/i);
  const original = presets.create("turkishMarch", "en");
  assert.deepEqual(original.map(track => track.instrument), ["piano"]);
  assert.equal(original[0].name, "Piano · 4 voices");
  assert.ok(original[0].abc.includes("CC0") && original[0].abc.includes("M:2/4") &&
    original[0].abc.includes("Q:1/4=120"));
  assert.ok(original[0].abc.includes("!p!") && original[0].abc.includes("!f!"));
  for (const language of ["en", "mn"]) {
    const tracks = presets.create("turkishMarch", language);
    const { summary, prepared } = ensemble.parseTracks(tracks, "equal", temperament);
    assert.equal(prepared.length, 1, "the movement leaves three instrument slots free");
    assert.deepEqual(prepared[0].score.parts[0].voiceIds, ["RH", "Upper", "Middle", "LH"]);
    assert.deepEqual(prepared.map(t => t.score.totalBeats), [447]);
    assert.deepEqual(prepared.map(t => t.score.bars.length), [224]);
    assert.equal(prepared[0].score.bars[0].durationBeats, 1, "opening pickup retained");
    assert.equal(prepared[0].score.bars.at(-1).durationBeats, 2);
    assert.equal(summary.totalBeats, 447);
    assert.equal(summary.tempoQuarter, 120);
    assert.equal(447 * 60 / 120, 223.5);
    assert.equal(summary.eventCount, 2812,
      "2,530 unfolded written pitched notes and 282 sounded grace-note pitches are preserved");
    assert.ok(prepared[0].score.parts[0].events.every(e =>
      e.type === "rest" || !e.velocity || [.6, 1.17].includes(e.velocity)));
    const attacks = playerModel.scheduledEvents(prepared[0].score);
    assert.deepEqual(["RH", "Upper", "Middle", "LH"].map(id =>
      attacks.filter(e => e.voiceId === id).length), [1431, 20, 39, 1322]);
    // Pinned against the prior four-track score at public commit 8876d9a:
    // every sounding pitch, quarter-beat onset, written release and dynamic.
    const signature = ["RH", "Upper", "Middle", "LH"].flatMap(id =>
      attacks.filter(event => event.voiceId === id).map(event =>
        JSON.stringify([event.startBeat, event.durationBeats,
          score.pitchNumber(event.pitch), event.velocity ?? 1]))).join("\n");
    assert.equal(crypto.createHash("sha256").update(signature).digest("hex"),
      "7815a7ba4d5c1bdd0b50c234f56e21a47494548dc6f1d0a24a5dca158daa0a3f");
    assert.ok(tracks[0].abc.includes("V:LH\nz8 |"), "silent left-hand pickup preserved");
  }
  original[0].abc = "user edited";
  assert.notEqual(presets.create("turkishMarch")[0].abc, "user edited");
});

test("RP2 Entertainer retains all four repeated strains, alternate endings and exact piano attacks", () => {
  const entry = presets.CATALOG.find(item => item.id === "entertainer");
  assert.equal(entry.category, "classics");
  assert.match(entry.description.en, /152 played/);
  for (const language of ["en", "mn"]) {
    const original = presets.create("entertainer", language);
    assert.deepEqual(original.map(track => track.instrument), ["piano"]);
    assert.ok(original[0].abc.includes("CC0 1.0") && original[0].abc.includes("Q:1/4=76"));
    const { summary, prepared } = ensemble.parseTracks(original, "equal", temperament);
    const parsed = prepared[0].score;
    assert.equal(parsed.bars.length, 152);
    assert.equal(parsed.totalBeats, 304);
    assert.equal(summary.eventCount, 2623);
    assert.deepEqual(parsed.parts[0].voiceIds,
      ["RH1", "RH2", "RH3", "RH4", "LH1", "LH2", "LH3", "LH4"]);
    assert.deepEqual(parsed.tempoMap, [
      { beat: 0, tempoQuarter: 72 }, { beat: 72, tempoQuarter: 76 },
      { beat: 136, tempoQuarter: 72 }, { beat: 168, tempoQuarter: 74 },
      { beat: 232, tempoQuarter: 72 }, { beat: 240, tempoQuarter: 76 },
      { beat: 302, tempoQuarter: 72 }
    ]);
    assert.ok(Math.abs(score.beatToSeconds(parsed, 304) - 246.3655761024182) < 1e-10);
    const attacks = playerModel.scheduledEvents(parsed);
    assert.deepEqual(parsed.parts[0].voiceIds.map(id =>
      attacks.filter(event => event.voiceId === id).length),
    [747, 405, 196, 46, 581, 419, 210, 19]);
    const signature = parsed.parts[0].voiceIds.flatMap(id =>
      attacks.filter(event => event.voiceId === id).map(event =>
        JSON.stringify([event.startBeat, event.durationBeats, score.pitchNumber(event.pitch)]))).join("\n");
    assert.equal(crypto.createHash("sha256").update(signature).digest("hex"),
      "6f041441f38bc47ec699ca614fb5afa866a8f613d1a0b69cb4ea028e8d604581");
  }
});

test("El Choclo is a complete contrasting minor/major tango with synchronized original parts", () => {
  const catalog = presets.CATALOG.find(piece => piece.id === "elChoclo");
  assert.equal(catalog.category, "popular");
  assert.match(catalog.description.en, /tango/i);
  for (const language of ["en", "mn"]) {
    const tracks = presets.create("elChoclo", language);
    assert.deepEqual(tracks.map(track => track.instrument), ["bayan", "piano", "triangle", "drums"]);
    assert.equal(new Set(tracks.map(track => track.id)).size, 4);
    assert.ok(tracks.slice(0, 3).every(track => track.abc.includes("1913")),
      "sourced and newly arranged pitched parts retain the edition notice");
    assert.ok(tracks[3].abc.includes("K:C clef=perc"),
      "linked drum patterns preserve playable ABC when the pattern editor regenerates it");
    assert.ok(tracks[0].abc.includes("^c") && tracks[0].abc.includes("^G"),
      "A-major trio retains explicit sharps while K:Am is shared");
    const { summary, prepared } = ensemble.parseTracks(tracks, "equal", temperament);
    assert.equal(summary.totalBeats, 216);
    assert.equal(summary.tempoQuarter, 112);
    assert.ok(Math.abs(summary.totalBeats * 60 / summary.tempoQuarter - 115.714) < .001);
    assert.ok(summary.eventCount > 1024);
    assert.deepEqual(prepared.map(track => track.score.bars.length), [108, 108, 108, 108]);
    assert.ok(prepared.every(track => track.score.totalBeats === 216));
    assert.ok(prepared.every(track => track.score.bars.every(bar => bar.durationBeats === 2)));
    const leadEvents = prepared[0].score.parts[0].events;
    const minorPitch = leadEvents.find(event => event.type === "note" && event.bar === 5);
    const majorPitch = leadEvents.find(event => event.type === "note" && event.bar === 53);
    assert.ok(minorPitch && majorPitch, "lead melody reaches both contrasting sections");
    assert.equal(tracks[3].drumFeel, "straight", "tango subdivides straight, not swing");
    assert.equal(tracks[3].drumTouch, "expressive");
    assert.equal(tracks[3].textMode, "pattern");
    assert.ok(tracks[3].patterns.patterns.length < 10, "drum sections use linked reusable patterns");
    assert.equal(drumPatterns.toABC(tracks[3].patterns), tracks[3].abc);
    const hits = drums.scheduledEvents(drums.parse(tracks[3].abc), "straight", "expressive");
    assert.ok(hits.some(hit => hit.drum === "woodblock") && hits.some(hit => hit.drum === "snare"));
    assert.ok(hits.some(hit => hit.bar > 100), "percussion persists through the ending");
  }
  const first = presets.create("elChoclo", "mn");
  first[0].abc = "edited";
  first[3].patterns.patterns[0].name = "Private variation";
  const fresh = presets.create("elChoclo", "mn");
  assert.notEqual(fresh[0].abc, "edited");
  assert.notEqual(fresh[3].patterns.patterns[0].name, "Private variation");
});

test("Charleston is a synchronized complete-form 1923 dance with editable original backing", () => {
  for (const language of ["en", "mn"]) {
    const tracks = presets.create("charleston", language);
    assert.deepEqual(tracks.map(track => track.instrument), ["clarinet", "piano", "triangle", "drums"]);
    assert.equal(tracks.length, 4);
    assert.ok(tracks.slice(0, 3).every(track => track.abc.includes("1923")));
    const { summary, prepared } = ensemble.parseTracks(tracks, "equal", temperament);
    assert.equal(summary.totalBeats, 352);
    assert.equal(summary.tempoQuarter, 160);
    assert.equal(summary.totalBeats * 60 / summary.tempoQuarter, 132,
      "88 bars of 2/2 at 160 bpm last well past 90 seconds");
    assert.ok(summary.eventCount > 1024);
    assert.deepEqual(prepared.map(track => track.score.bars.length), [88, 88, 88, 88]);
    assert.deepEqual(prepared.map(track => track.score.totalBeats), [352, 352, 352, 352]);
    assert.equal(tracks[3].textMode, "pattern");
    assert.ok(tracks[3].patterns.patterns.length < 10, "repeating drum phrases reuse definitions");
    assert.equal(drumPatterns.toABC(tracks[3].patterns), tracks[3].abc);
    const hits = drums.scheduledEvents(drums.parse(tracks[3].abc), "light", "expressive");
    assert.ok(hits.some(hit => hit.drum === "snare") && hits.some(hit => hit.drum === "kick"));
    assert.ok(hits.some(hit => hit.bar > 80), "drums continue through the final refrain");
  }
});

test("D1 drum-only compositions contain eight synchronized bars and editable linked patterns", () => {
  const cases = [["drumKitSolo", 1], ["snareStudy", 1], ["snareRudiments", 1], ["drumDialogue", 2]];
  for (const [id, count] of cases) {
    for (const language of ["mn", "en"]) {
      const tracks = presets.create(id, language);
      assert.equal(tracks.length, count, id);
      assert.ok(tracks.every(track => track.instrument === "drums"), id + " has no melody");
      const { prepared, summary } = ensemble.parseTracks(tracks, "equal", temperament);
      assert.equal(summary.totalBeats, 32, id);
      assert.ok(summary.eventCount > 0 && summary.eventCount <= 1024, id);
      for (const track of prepared) {
        assert.equal(track.score.bars.length, 8, id);
        assert.equal(track.score.totalBeats, 32);
        assert.equal(track.score.tempoQuarter, { snareStudy: 96, snareRudiments: 92,
          drumKitSolo: 108, drumDialogue: 112 }[id]);
      }
      for (const track of tracks) {
        assert.equal(track.textMode, "pattern");
        assert.equal(track.patternBar, 1);
        assert.ok(track.patterns.patterns.length < 8, id + " reuses named patterns");
        assert.equal(drumPatterns.toABC(track.patterns), track.abc);
        assert.equal(drumPatterns.expanded(track.patterns).length, 8);
      }
      tracks[0].patterns.patterns[0].name = "Owner edit";
      const fresh = presets.create(id, language);
      assert.notEqual(fresh[0].patterns.patterns[0].name, "Owner edit", id + " creates independent patterns");
    }
  }
});

test("D1 kit and snare have dynamic variation; percussion dialogue really alternates and joins", () => {
  const kit = drums.scheduledEvents(drums.parse(presets.create("drumKitSolo")[0].abc));
  assert.ok(["kick", "snare", "hat", "openHat", "woodblock"].every(id => kit.some(hit => hit.drum === id)));
  assert.ok([.55, .8, 1].every(velocity => kit.some(hit => hit.velocity === velocity)));
  assert.ok(new Set(kit.map(hit => hit.bar)).size === 8);
  const snare = drums.scheduledEvents(drums.parse(presets.create("snareStudy")[0].abc));
  assert.ok(snare.length > 60);
  assert.ok(snare.every(hit => hit.drum === "snare"));
  const dialogue = presets.create("drumDialogue").map(track =>
    drums.scheduledEvents(drums.parse(track.abc)));
  assert.ok(dialogue[0].every(hit => hit.bar !== 3 && hit.bar !== 4));
  assert.ok(dialogue[1].every(hit => hit.bar !== 1 && hit.bar !== 2));
  assert.ok(dialogue.every(part => part.some(hit => hit.bar === 6) && part.some(hit => hit.bar === 8)));
});

test("D2b original snare rudiment demonstrates flams, rolls, ghosts and accents in both languages", () => {
  for (const language of ["en", "mn"]) {
    const track = presets.create("snareRudiments", language)[0];
    assert.equal(track.instrument, "drums");
    const score = drums.parse(track.abc);
    assert.equal(score.bars.length, 8);
    assert.equal(score.tempoQuarter, 92);
    const steps = score.parts[0].events.flatMap(event => event.hits);
    assert.ok(steps.some(hit => hit.articulation === "flam"));
    assert.ok(steps.some(hit => hit.articulation === "roll"));
    assert.ok(steps.some(hit => hit.velocity === drums.VELOCITIES.ghost));
    assert.ok(steps.some(hit => hit.velocity === drums.VELOCITIES.accent));
    assert.ok(drums.scheduledEvents(score).length > steps.length, "Decorations produce actual extra attacks");
    assert.deepEqual(drums.gridOf(drums.parse(drumPatterns.toABC(track.patterns))), drums.gridOf(score));
  }
});

test("D2c swing hi-hat study is bilingual, linked, original and actually demonstrates choking", () => {
  for (const language of ["en", "mn"]) {
    const [track] = presets.create("swingHats", language);
    assert.equal(track.instrument, "drums");
    assert.equal(track.drumFeel, "swing");
    assert.equal(track.textMode, "pattern");
    assert.equal(drumPatterns.expanded(track.patterns).length, 8);
    assert.equal(drumPatterns.toABC(track.patterns), track.abc);
    const parsed = drums.parse(track.abc);
    assert.equal(parsed.bars.length, 8);
    assert.equal(parsed.tempoQuarter, 104);
    const straight = drums.scheduledEvents(parsed);
    const swung = drums.scheduledEvents(parsed, track.drumFeel);
    assert.ok(swung.some(hit => hit.drum === "openHat" && hit.chokeBeat > hit.startBeat));
    assert.ok(swung.some(hit => hit.drum === "hat"));
    assert.ok(swung.some(hit => hit.drum === "snare"));
    assert.ok(swung.some((hit, i) => straight[i] && Math.abs(straight[i].startBeat - hit.startBeat) > .05));
    assert.ok(track.name.includes(language === "en" ? "Swing" : "Свинг"));
    const another = presets.create("swingHats", language)[0];
    track.patterns.patterns[0].name = "Private edit";
    assert.notEqual(another.patterns.patterns[0].name, "Private edit");
  }
});

test("D2e half-open hi-hat pedal study is bilingual, linked, and demonstrates all three hat positions", () => {
  for (const language of ["en", "mn"]) {
    const [track] = presets.create("hatPedal", language);
    assert.equal(track.instrument, "drums");
    assert.equal(track.textMode, "pattern");
    assert.equal(drumPatterns.expanded(track.patterns).length, 8);
    assert.equal(drumPatterns.toABC(track.patterns), track.abc);
    const parsed = drums.parse(track.abc);
    assert.equal(parsed.bars.length, 8);
    assert.equal(parsed.tempoQuarter, 108);
    const hits = drums.scheduledEvents(parsed);
    assert.ok(["hat", "halfHat", "openHat", "kick", "snare"].every(id => hits.some(hit => hit.drum === id)));
    assert.ok(hits.some(hit => hit.drum === "halfHat" && hit.chokeBeat > hit.startBeat));
    assert.ok(hits.some(hit => hit.drum === "openHat" && hit.chokeBeat > hit.startBeat));
    assert.ok(hits.some(hit => hit.drum === "openHat" &&
      hit.pedalChanges?.some(change => change.openness === .5 && change.beat > hit.startBeat)),
    "D2f practice must demonstrate an audible open-to-half closure before the next closed hat");
    assert.ok(hits.some(hit => hit.velocity === drums.VELOCITIES.accent));
    assert.ok(track.name.includes(language === "en" ? "Hi-hat" : "Цан"));
  }
});

test("D2d bilingual paradiddle demonstrates both hands and subtle written-independent accents", () => {
  for (const language of ["en", "mn"]) {
    const [track] = presets.create("stickingRudiments", language);
    assert.equal(track.instrument, "drums");
    assert.equal(track.drumTouch, "expressive");
    assert.equal(track.drumFeel, "straight");
    assert.equal(track.textMode, "pattern");
    assert.equal(drumPatterns.expanded(track.patterns).length, 8);
    assert.equal(drumPatterns.toABC(track.patterns), track.abc);
    const score = drums.parse(track.abc);
    assert.equal(score.bars.length, 8);
    assert.equal(score.tempoQuarter, 100);
    const hands = score.parts[0].events.flatMap(event => event.hits.map(hit => hit.hand));
    assert.ok(hands.includes("R") && hands.includes("L"));
    const strokes = drums.scheduledEvents(score, track.drumFeel, track.drumTouch);
    assert.ok(strokes.some(hit => hit.stroke === "flam-grace" && hit.hand));
    assert.ok(strokes.some(hit => hit.stroke === "roll-4" && hit.hand));
    assert.ok(strokes.some(hit => hit.velocity === drums.VELOCITIES.ghost));
    assert.ok(strokes.some(hit => hit.velocity === drums.VELOCITIES.accent));
    const { summary } = ensemble.parseTracks([track], "equal", temperament);
    assert.equal(summary.totalBeats, 32);
    assert.ok(summary.eventCount <= 1024);
    assert.ok(track.name.includes(language === "en" ? "R/L" : "Баруун/зүүн"));
  }
});

test("D2a tom/cymbal study uses all six new voices, varied strength and linked fill bars", () => {
  for (const language of ["mn", "en"]) {
    const [part] = presets.create("tomCymbalStudy", language);
    const hits = drums.scheduledEvents(drums.parse(part.abc));
    const newVoices = ["floorTom", "midTom", "highTom", "ride", "crash", "rimshot"];
    for (const id of newVoices) assert.ok(hits.some(hit => hit.drum === id), language + " " + id);
    assert.ok([.55, .8, 1].every(velocity => hits.some(hit => hit.velocity === velocity)));
    const { prepared, summary } = ensemble.parseTracks([part], "equal", temperament);
    assert.equal(prepared[0].score.bars.length, 8);
    assert.equal(summary.totalBeats, 32);
    assert.equal(summary.tempoQuarter, 104);
    assert.equal(part.patterns.patterns.length, 5);
    assert.equal(part.patterns.sequence.length, 8);
    assert.equal(part.patterns.sequence[0].id, part.patterns.sequence[1].id);
  }
});

test("Greensleeves, Daisy Bell and La Paloma align sourced melodies with strummed accompaniment", () => {
  for (const [id, count] of [["greensleeves", 3], ["daisy", 4], ["paloma", 4]]) {
    const tracks = presets.create(id, "en");
    assert.equal(tracks.length, count, id);
    assert.equal(tracks[0].abc, compose.EXAMPLES[id], id + " shares the Solo melody");
    assert.equal(tracks[1].instrument, "guitar");
    assert.ok(["down", "alternate"].includes(tracks[1].guitar.mode));
    assert.equal(tracks[1].guitar.spacingMs, 20);
    const { prepared, summary } = ensemble.parseTracks(tracks, "equal", temperament);
    const lead = prepared[0].score;
    assert.ok(summary.eventCount <= 1024);
    assert.ok(lead.totalBeats * score.secondsPerBeat(lead) <= 90);
    for (const track of prepared) {
      assert.ok(Math.abs(track.score.totalBeats - lead.totalBeats) < 1e-7, id);
      assert.equal(track.score.bars.length, lead.bars.length);
      assert.ok(track.score.bars.every((bar, index) =>
        Math.abs(bar.durationBeats - lead.bars[index].durationBeats) < 1e-7 &&
        Math.abs(bar.startBeat - lead.bars[index].startBeat) < 1e-7),
      id + " keeps every pickup and bar aligned, including rational triplet durations");
    }
    assert.ok(prepared[1].score.parts[0].events.some(event => event.type === "chord"),
      id + " actually includes chords to strum");
    const drumTrack = tracks.find(track => track.instrument === "drums");
    if (drumTrack) {
      assert.ok(drumTrack.patterns.patterns.length < lead.bars.length,
        id + " uses editable, reusable rhythm patterns");
      assert.equal(drumPatterns.toABC(drumTrack.patterns), drumTrack.abc);
      drumTrack.patterns.patterns[0].name = "local edit";
    }
    tracks[1].guitar.mode = "up";
    const reloaded = presets.create(id, "mn");
    assert.equal(reloaded[0].name, "Аялгуу");
    assert.notEqual(reloaded[1].guitar.mode, "up", id + " reload restores independent settings");
    const reloadedDrums = reloaded.find(track => track.instrument === "drums");
    if (reloadedDrums) assert.notEqual(reloadedDrums.patterns.patterns[0].name, "local edit");
  }
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

test("creative instrument substitutions retain all attacks with non-blocking register warnings", () => {
  for (const { id, instrument, attacks, warnings, example } of [
    { id: "bella", instrument: "clarinet", attacks: 335, warnings: 8, example: "F5" },
    { id: "minuteWaltz", instrument: "bayan", attacks: 1440, warnings: 44, example: "A♭2" }
  ]) {
    const original = presets.create(id, "en");
    const source = ensemble.parseTracks(original, "equal", temperament);
    const before = playerModel.scheduledEvents(source.prepared[0].score)
      .map(note => [note.startBeat, note.durationBeats, score.pitchNumber(note.pitch)]);
    const replacement = presets.create(id, "en");
    replacement[0].instrument = instrument;
    const { prepared, summary } = ensemble.parseTracks(replacement, "equal", temperament);
    assert.equal(summary.eventCount, attacks, id + " keeps the complete arrangement");
    assert.deepEqual(summary.warnings.map(item => [item.instrument, item.count, item.example]),
      [[instrument, warnings, example]]);
    assert.equal(summary.warnings[0].trackId, replacement[0].id);
    assert.deepEqual(playerModel.scheduledEvents(prepared[0].score)
      .map(note => [note.startBeat, note.durationBeats, score.pitchNumber(note.pitch)]), before,
    id + " changes timbre, not any pitch, duration or attack");
  }
});

test("every pitched timbre can replace a lead in folk, dance, ragtime and classical arrangements", () => {
  for (const id of ["bella", "minuet", "charleston", "entertainer", "furElise", "minuteWaltz"]) {
    const original = presets.create(id, "en");
    const reference = ensemble.parseTracks(original, "equal", temperament);
    const written = playerModel.scheduledEvents(reference.prepared[0].score).map(event =>
      [event.startBeat, event.durationBeats, score.pitchNumber(event.pitch)]);
    for (const instrument of playerModel.INSTRUMENTS) {
      const tracks = presets.create(id, "en");
      tracks[0].instrument = instrument;
      const { prepared, summary } = ensemble.parseTracks(tracks, "equal", temperament);
      const heard = playerModel.scheduledEvents(prepared[0].score).map(event =>
        [event.startBeat, event.durationBeats, score.pitchNumber(event.pitch)]);
      assert.deepEqual(heard, written, `${id} on ${instrument} preserves all notes`);
      assert.equal(summary.eventCount, reference.summary.eventCount,
        `${id} on ${instrument} preserves the entire ensemble`);
      assert.ok(summary.warnings.every(w => w.trackId === tracks[0].id ||
        reference.summary.warnings.some(old => old.trackId === w.trackId)),
      `${id} on ${instrument} only adds advisory register warnings`);
    }
  }
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


test("original guitar study mixes picking and strumming over eight synchronized bars", () => {
  const entry = presets.CATALOG.find(piece => piece.id === "guitarStrum");
  assert.equal(entry.category, "studies");
  assert.ok(entry.en && entry.mn && entry.description.en && entry.description.mn);
  const tracks = presets.create("guitarStrum", "en");
  assert.deepEqual(tracks.map(track => track.instrument), ["guitar", "triangle", "drums"]);
  assert.deepEqual(tracks[0].guitar, { mode: "alternate", spacingMs: 20 });
  assert.ok(tracks.slice(1).every(track => track.volume < tracks[0].volume));
  const { prepared, summary } = ensemble.parseTracks(tracks, "equal", temperament);
  assert.equal(summary.tempoQuarter, 100);
  assert.equal(summary.totalBeats, 32);
  assert.equal(summary.totalBeats * score.secondsPerBeat(prepared[0].score), 19.2);
  assert.ok(prepared.every(track => track.score.bars.length === 8));
  assert.ok(prepared.every(track => track.score.totalBeats === 32));
  const events = prepared[0].score.parts[0].events;
  assert.ok(events.filter(event => event.bar <= 2).every(event => event.type === "note"),
    "the first two bars demonstrate individual picking");
  assert.ok(events.some(event => event.type === "chord"));
  assert.ok(events.some(event => event.bar >= 5 && event.type === "note"),
    "the same guitar part can resume picking among strummed chords");
  const pitches = events.flatMap(event => event.type === "chord" ? event.pitches : [event.pitch]);
  assert.ok(pitches.every(pitch => score.pitchNumber(pitch) >= 40), "no guitar pitch below E2");
  assert.ok(events.filter(event => event.type === "chord").every(event => event.pitches.length <= 6));
  assert.equal(tracks[2].patterns.sequence.length, 8);
  assert.equal(tracks[2].patterns.patterns.length, 1, "the quiet beat remains one editable linked pattern");
});

test("guitar study settings and drum patterns are fresh for every preset load", () => {
  const first = presets.create("guitarStrum", "en");
  const second = presets.create("guitarStrum", "mn");
  assert.notEqual(first[0].name, second[0].name);
  assert.notEqual(first[0].guitar, second[0].guitar);
  assert.notEqual(first[2].patterns, second[2].patterns);
  first[0].guitar.mode = "up";
  first[0].guitar.spacingMs = 60;
  first[0].abc = "changed";
  first[2].patterns.sequence.pop();
  assert.deepEqual(second[0].guitar, { mode: "alternate", spacingMs: 20 });
  const again = presets.create("guitarStrum", "en");
  assert.deepEqual(again[0].guitar, second[0].guitar);
  assert.equal(again[0].abc, second[0].abc);
  assert.equal(again[2].patterns.sequence.length, 8);
});
