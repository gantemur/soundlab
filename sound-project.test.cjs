/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const codec = require("./sound-project.js");
const compose = require("./sound-compose.js");
const ensemble = require("./sound-ensemble.js");
const presets = require("./sound-ensemble-presets.js");
const player = require("./sound-score-player.js");
const drums = require("./sound-drum-abc.js");
const patterns = require("./sound-drum-patterns.js");

const copy = value => JSON.parse(JSON.stringify(value));
const solo = (changes = {}) => ({
  format: codec.FORMAT, version: codec.VERSION, title: "Миний ая", mode: "solo",
  content: { abc: compose.EXAMPLES.first, instrument: "flute", tuning: "equal", volume: 38,
    guitar: { mode: "pluck", spacingMs: 20 }, ...changes }
});
const arrangement = (tracks = copy(ensemble.DEFAULTS)) => ({
  format: codec.FORMAT, version: codec.VERSION, title: "My arrangement", mode: "ensemble",
  content: { tuning: "equal", tracks, selectedId: tracks[0].id,
    nextId: Math.max(...tracks.map(track => track.id)) + 1,
    editor: { gridBar: 1, gridStep: 16, gridStrength: "normal" } }
});
function drumTrack({ count = 8, pickup = false } = {}) {
  const durations = Array.from({ length: count }, (_, i) => pickup && i === 0 ? 1 : 4);
  const text = drums.groove({ meter: { numerator: 4, denominator: 4, quarterBeats: 4 },
    tempoQuarter: 96, totalBeats: durations.reduce((sum, n) => sum + n, 0), barDurations: durations }, 7, "Beat");
  const project = patterns.fromABC(text);
  return { id: 7, name: "Бөмбөр", instrument: "drums", volume: 27, mute: false, solo: false,
    abc: text, patterns: project, patternBar: 1, patternId: project.sequence[0].id,
    textMode: "pattern", patternDraft: null };
}
function rejected(project, code = "invalid") {
  assert.throws(() => codec.validate(project), error => error instanceof codec.ProjectError && error.code === code);
}

test("native projects have stable format/version and readable, newline-terminated JSON", () => {
  assert.equal(codec.FORMAT, "soundlab-project");
  assert.equal(codec.VERSION, 1);
  assert.equal(codec.MAX_BYTES, 16 * 1024 * 1024);
  const text = codec.encode(solo());
  assert.match(text, /^\{\n  "format": "soundlab-project",/);
  assert.equal(text.endsWith("\n"), true);
  assert.deepEqual(codec.decode(text), solo());
  assert.deepEqual(codec.decode("\uFEFF" + text), solo());
});

test("every shipped solo score and bilingual ensemble preset round-trips", () => {
  for (const [id, abc] of Object.entries(compose.EXAMPLES)) {
    const info = compose.EXAMPLE_INFO[id];
    const project = solo({ abc, instrument: info?.instrument || "flute",
      guitar: info?.guitar || { mode: "pluck", spacingMs: 20 } });
    assert.deepEqual(codec.decode(codec.encode(project)), codec.validate(project), id);
  }
  for (const language of ["mn", "en"]) for (const preset of presets.CATALOG) {
    const tracks = preset.id === "starter" ? copy(ensemble.DEFAULTS) : presets.create(preset.id, language);
    const project = arrangement(tracks);
    assert.deepEqual(codec.decode(codec.encode(project)), codec.validate(project), language + " " + preset.id);
  }
});

test("raw ABC is preserved exactly, even for empty or invalid unfinished scores", () => {
  for (const text of ["", "   ", "% unfinished\r\nT:Өөрийн ая\r\nC D [", "X:" + "a".repeat(8190),
    "\uFEFF" + compose.EXAMPLES.first.replace(/\n/g, "\r\n") + "\r\n% trailing comment  \r\n"]) {
    assert.equal(codec.decode(codec.encode(solo({ abc: text }))).content.abc, text);
    const project = arrangement();
    project.content.tracks[0].abc = text;
    assert.equal(codec.decode(codec.encode(project)).content.tracks[0].abc, text);
  }
});

test("musically invalid or incompatible raw scores remain editable rather than blocking Save", () => {
  const project = arrangement();
  project.content.tracks[0].abc = compose.EXAMPLES.first.replace("Q:1/4=96", "Q:1/4=300");
  project.content.tracks[1].abc = "not a score";
  assert.equal(codec.decode(codec.encode(project)).content.tracks[1].abc, "not a score");
  assert.equal(codec.decode(codec.encode(solo({ abc: "C''''''''" }))).content.abc, "C''''''''");
});

test("all pitched instruments, tunings and guitar settings survive without being conflated", () => {
  for (const instrument of player.INSTRUMENTS) for (const tuning of ["equal", "pythagorean", "just"]) {
    for (const mode of player.GUITAR_MODES) {
      const project = solo({ instrument, tuning, volume: 0, guitar: { mode, spacingMs: 60 } });
      assert.deepEqual(codec.decode(codec.encode(project)), project);
    }
  }
  const project = arrangement();
  project.content.tracks[0].guitar = { mode: "up", spacingMs: 13.5 };
  assert.deepEqual(codec.decode(codec.encode(project)).content.tracks[0].guitar, { mode: "up", spacingMs: 13.5 });
});

test("I0/I1 preserves old instrument IDs and adds marimba without a project schema migration", () => {
  assert.equal(codec.VERSION, 1);
  assert.equal(compose.UI.en.marimba, "Marimba");
  assert.equal(compose.UI.mn.marimba, "Маримба");
  for (const instrument of ["flute", "violin", "morin", "guitar", "piano", "chimes", "fmep", "marimba"]) {
    assert.equal(codec.decode(codec.encode(solo({ instrument }))).content.instrument, instrument);
  }
  const project = arrangement();
  project.content.tracks = ["piano", "chimes", "marimba", "morin"].map((instrument, index) => ({
    id: index + 1, name: instrument, instrument, abc: compose.EXAMPLES.first,
    volume: 40, mute: index === 1, solo: false
  }));
  project.content.selectedId = 3;
  project.content.nextId = 5;
  const decoded = codec.decode(codec.encode(project));
  assert.deepEqual(decoded.content.tracks.map(track => track.instrument), ["piano", "chimes", "marimba", "morin"]);
  assert.equal(decoded.content.selectedId, 3);
  assert.equal(decoded.content.tracks[1].mute, true);
  assert.equal(decoded.content.tracks[2].abc, compose.EXAMPLES.first);
});

test("track ordering, IDs, mix settings and editor choices round-trip", () => {
  const project = arrangement();
  project.title = "Өөрчлөлт";
  project.content.tracks.reverse();
  project.content.tracks[0].name = "Quiet bass";
  project.content.tracks[0].mute = true;
  project.content.tracks[1].solo = true;
  project.content.tracks[1].volume = 100;
  project.content.selectedId = project.content.tracks[1].id;
  project.content.nextId = 400;
  project.content.tuning = "just";
  project.content.editor = { gridBar: 3, gridStep: 8, gridStrength: "p" };
  assert.deepEqual(codec.decode(codec.encode(project)), codec.validate(project));
});

test("linked patterns retain repeats, unused definitions, names and multi-bar grouping", () => {
  const track = drumTrack();
  const grouped = patterns.groupBars(track.patterns, 1, 4);
  const pair = patterns.groupBars(grouped.project, 5, 2);
  track.patterns = patterns.replaceRange(pair.project, pair.patternId, 7, 8);
  track.patterns = patterns.updatePatternABC(track.patterns, pair.patternId,
    patterns.patternABC(track.patterns, pair.patternId).replace(/^T:.*$/m, "T:Нэртэй хоёр такт"));
  track.patternBar = 5;
  track.patternId = pair.patternId;
  track.abc = patterns.toABC(track.patterns);
  const result = codec.decode(codec.encode(arrangement([track]))).content.tracks[0];
  assert.deepEqual(result.patterns, track.patterns);
  assert.equal(result.patterns.patterns.some(item => !result.patterns.sequence.some(slot => slot.id === item.id)), true);
  assert.deepEqual(patterns.runs(result.patterns), patterns.runs(track.patterns));
  assert.equal(result.patternId, pair.patternId);
  assert.equal(result.patternBar, 5);
});

test("pickup bars and independent grid velocities survive project saving", () => {
  const track = drumTrack({ count: 4, pickup: true });
  track.patterns = patterns.toggleHit(track.patterns, track.patternId, 1, 1, "woodblock", .55);
  track.abc = patterns.toABC(track.patterns);
  const result = codec.decode(codec.encode(arrangement([track]))).content.tracks[0];
  assert.deepEqual(result.patterns.barDurations, [1, 4, 4, 4]);
  assert.deepEqual(result.patterns, track.patterns);
});

test("linked drums compare musical meaning rather than rewriting comments or hit order", () => {
  const track = drumTrack();
  track.abc = "% source comment\r\n" + track.abc.replace("[!accent!CE]", "[E!accent!C]").replace(/\n/g, "\r\n") + "\r\n% end  ";
  const result = codec.decode(codec.encode(arrangement([track]))).content.tracks[0];
  assert.equal(result.abc, track.abc);
  assert.deepEqual(result.patterns, track.patterns);
});

test("invalid and empty pattern drafts retain last valid music and acquire a derived error", () => {
  for (const text of ["", "[", "T:Unfinished\r\n"]) {
    const track = drumTrack();
    track.patternDraft = { id: track.patternId, text, error: "untrusted cached explanation" };
    const result = codec.decode(codec.encode(arrangement([track]))).content.tracks[0];
    assert.equal(result.patternDraft.text, text);
    assert.equal(result.patternDraft.id, track.patternId);
    assert.notEqual(result.patternDraft.error, track.patternDraft.error);
    assert.ok(result.patternDraft.error.length > 0 && result.patternDraft.error.length <= 512);
    assert.equal(/[\u0000-\u001f\u007f]/.test(result.patternDraft.error), false);
    assert.deepEqual(result.patterns, track.patterns);
    assert.equal(result.abc, track.abc);
  }
});

test("a saved unapplied draft is not silently committed if its text happens to validate", () => {
  const track = drumTrack();
  const text = patterns.patternABC(track.patterns, track.patternId).replace("T:A", "T:New name");
  track.patternDraft = { id: track.patternId, text };
  const result = codec.decode(codec.encode(arrangement([track]))).content.tracks[0];
  assert.equal(result.patternDraft.text, text);
  assert.match(result.patternDraft.error, /not been applied/);
  assert.equal(result.patterns.patterns[0].name, "A");
});

test("raw edits may unlink drums while leaving harmless old editor IDs in controller state", () => {
  const track = drumTrack();
  track.patterns = null;
  track.textMode = "full";
  track.abc = "unfinished full drum score";
  const result = codec.validate(arrangement([track])).content.tracks[0];
  assert.equal(result.abc, track.abc);
  assert.equal(result.patterns, null);
  assert.equal(result.patternDraft, null);
  assert.equal(Object.hasOwn(result, "patternId"), false);
  assert.equal(Object.hasOwn(result, "patternBar"), false);
});

test("validation creates independent data and accepts plain cross-realm records", () => {
  const source = arrangement([drumTrack()]);
  const result = codec.validate(source);
  result.content.tracks[0].patterns.patterns[0].bars[0].cells[0].woodblock = .55;
  result.content.tracks[0].patterns.sequence[0].id = 999;
  assert.equal(source.content.tracks[0].patterns.patterns[0].bars[0].cells[0].woodblock, undefined);
  assert.notEqual(source.content.tracks[0].patterns.sequence[0].id, 999);
  const foreign = vm.runInNewContext("(" + JSON.stringify(source) + ")");
  assert.deepEqual(codec.validate(foreign), codec.validate(source));
});

test("malformed JSON and unsupported format/version use stable error categories", () => {
  for (const text of ["", "{", "null", "[]", "true", "42", "\"project\""]) {
    assert.throws(() => codec.decode(text), error => error.code === "invalid");
  }
  rejected({ ...solo(), format: "another-app" }, "format");
  for (const version of [0, 2, "1", null, { version: 1 }]) rejected({ ...solo(), version }, "version");
  assert.throws(() => codec.decode({}), error => error.code === "invalid");
});

test("unknown keys and prototype payloads are rejected at every relevant depth", () => {
  for (const key of ["__proto__", "constructor", "prototype", "unrecognized"]) {
    for (const location of ["project", "content", "track", "patterns", "definition", "bar", "cell", "draft"]) {
      const project = arrangement([drumTrack()]);
      const track = project.content.tracks[0];
      track.patternDraft = { id: track.patternId, text: "[" };
      const targets = { project, content: project.content, track, patterns: track.patterns,
        definition: track.patterns.patterns[0], bar: track.patterns.patterns[0].bars[0],
        cell: track.patterns.patterns[0].bars[0].cells[0], draft: track.patternDraft };
      Object.defineProperty(targets[location], key, { value: { polluted: true }, enumerable: true });
      assert.throws(() => codec.decode(JSON.stringify(project)), error => error.code === "invalid", location + " " + key);
    }
  }
  assert.equal({}.polluted, undefined);
});

test("validation refuses accessor fields without invoking them", () => {
  let reads = 0;
  const accessor = solo();
  Object.defineProperty(accessor.content, "abc", { enumerable: true, get() { reads++; return ""; } });
  rejected(accessor);
  assert.equal(reads, 0);
});

test("non-data object shapes and malformed array containers do not enter the editor", () => {
  class Settings { constructor() { Object.assign(this, solo().content); } }
  const instance = solo(); instance.content = new Settings(); rejected(instance);
  const inherited = solo(); inherited.content = Object.create(solo().content); rejected(inherited);
  const symbol = solo(); symbol.content[Symbol("hidden")] = true; rejected(symbol);
  const hidden = solo(); Object.defineProperty(hidden.content, "hidden", { value: true }); rejected(hidden);
  const sparse = arrangement(); delete sparse.content.tracks[0]; rejected(sparse);
  const extra = arrangement(); extra.content.tracks.label = "extra"; rejected(extra);
  const cellArray = arrangement([drumTrack()]); cellArray.content.tracks[0].patterns.patterns[0].bars[0].cells[0] = []; rejected(cellArray);
});

test("solo field domains, lengths, booleans and finite numbers are strict", () => {
  const mutations = [
    value => { value.title = "x".repeat(121); },
    value => { value.mode = "single"; },
    value => { value.content.abc = "x".repeat(8193); },
    value => { value.content.abc = null; },
    value => { value.content.instrument = "drums"; },
    value => { value.content.tuning = "unknown"; },
    value => { value.content.volume = "38"; },
    value => { value.content.volume = Infinity; },
    value => { value.content.volume = NaN; },
    value => { value.content.volume = -1; },
    value => { value.content.volume = 101; },
    value => { value.content.guitar.mode = "sideways"; },
    value => { value.content.guitar.spacingMs = -1; },
    value => { value.content.guitar.spacingMs = 61; },
    value => { value.content.guitar.spacingMs = NaN; },
    value => { delete value.content.guitar; },
    value => { value.content.guitar = []; }
  ];
  for (const mutate of mutations) { const value = solo(); mutate(value); rejected(value); }
});

test("ensemble IDs, settings, track counts and references are strict", () => {
  const mutations = [
    value => { value.content.tracks = []; },
    value => { value.content.tracks = Array.from({ length: 5 }, (_, i) => ({ ...value.content.tracks[0], id: i + 1 })); },
    value => { value.content.tracks[1].id = 1; },
    value => { value.content.tracks[0].id = 1.5; },
    value => { value.content.tracks[0].id = 0; },
    value => { value.content.tracks[0].id = Number.MAX_SAFE_INTEGER; },
    value => { value.content.selectedId = 3; },
    value => { value.content.nextId = 2; },
    value => { value.content.tracks[0].mute = 0; },
    value => { value.content.tracks[0].solo = "false"; },
    value => { value.content.tracks[0].name = "x".repeat(41); },
    value => { value.content.editor.gridBar = 0; },
    value => { value.content.editor.gridBar = 33; },
    value => { value.content.editor.gridStep = "16"; },
    value => { value.content.editor.gridStrength = "soft"; },
    value => { value.content.tuning = "unknown"; }
  ];
  for (const mutate of mutations) { const value = arrangement(); mutate(value); rejected(value); }
});

test("damaged pattern definitions and sequence references fail before restoration", () => {
  const mutations = [
    track => { track.patterns.patterns[0].id = 0; },
    track => { track.patterns.patterns.push(copy(track.patterns.patterns[0])); },
    track => { track.patterns.patterns[0].name = "x".repeat(91); },
    track => { track.patterns.patterns[0].name = "two\nlines"; },
    track => { track.patterns.patterns[0].name = " padded "; },
    track => { track.patterns.patterns[0].name = "Name % lost as an ABC comment"; },
    track => { track.patterns.title = "two\rlines"; },
    track => { track.patterns.patterns[0].bars.push(copy(track.patterns.patterns[0].bars[0]), copy(track.patterns.patterns[0].bars[0])); },
    track => { track.patterns.patterns[0].bars[0].cells = []; },
    track => { track.patterns.patterns[0].bars[0].cells.push({}); },
    track => { track.patterns.patterns[0].bars[0].cells[0].kick = .9; },
    track => { track.patterns.patterns[0].bars[0].cells[0].kick = "0.8"; },
    track => { track.patterns.sequence[0].id = 100; },
    track => { track.patterns.sequence[0].offset = 1; },
    track => { track.patterns.barDurations.pop(); },
    track => { track.patterns.barDurations[0] = 4 / 3; },
    track => { track.patterns.nextId = 1; },
    track => { track.patterns.number = -1; },
    track => { track.patterns.meter.quarterBeats = 3; },
    track => { track.patterns.meter.numerator = 13; },
    track => { track.patterns.meter.denominator = 3; },
    track => { track.patterns.tempoQuarter = 321; },
    track => { track.patternId = 100; },
    track => { track.patternBar = 9; },
    track => { track.instrument = "flute"; }
  ];
  for (const mutate of mutations) { const track = drumTrack(); mutate(track); rejected(arrangement([track])); }
});

test("unused definitions are validated even when the expanded song is still valid", () => {
  const track = drumTrack();
  const grouped = patterns.groupBars(track.patterns, 1, 2);
  track.patterns = patterns.replaceRange(grouped.project, grouped.patternId, 3, 8);
  track.patternId = grouped.patternId;
  track.abc = patterns.toABC(track.patterns);
  const unused = track.patterns.patterns.find(pattern => pattern.id !== grouped.patternId);
  unused.bars = [{ cells: [{ kick: .8 }] }, { cells: [{ kick: .8 }] }, { cells: [{ kick: .8 }] }, { cells: [{ kick: .8 }] }];
  assert.doesNotThrow(() => patterns.toABC(track.patterns), "the older model only visits active definitions");
  rejected(arrangement([track]));
});

test("the selected pattern must correspond to the selected song-bar occurrence", () => {
  const track = drumTrack();
  const unique = patterns.makeUnique(track.patterns, 3);
  track.patterns = unique.project;
  track.abc = patterns.toABC(track.patterns);
  track.patternId = unique.patternId;
  track.patternBar = 1;
  rejected(arrangement([track]));
  track.patternBar = 3;
  assert.equal(codec.validate(arrangement([track])).content.tracks[0].patternId, unique.patternId);
});

test("linked ABC must agree with patterns in rhythm, velocities, title, meter and tempo", () => {
  for (const change of [
    text => text.replace("T:Beat", "T:Other"),
    text => text.replace("Q:1/4=96", "Q:1/4=97"),
    text => text.replace("M:4/4", "M:8/8"),
    text => text.replace("!accent!", "!p!"),
    text => text.replace("[!accent!CE]", "E"),
    () => "unfinished ABC"
  ]) {
    const track = drumTrack(); track.abc = change(track.abc); rejected(arrangement([track]));
  }
});

test("pattern drafts cannot point to another pattern or hide outside the pattern editor", () => {
  for (const mutate of [
    track => { track.patternDraft.id = 999; },
    track => { track.textMode = "full"; },
    track => { track.patterns = null; },
    track => { track.patternDraft.text = "x".repeat(8193); },
    track => { track.patternDraft.error = "x".repeat(513); },
    track => { track.patternDraft.error = { message: "bad" }; }
  ]) {
    const track = drumTrack(); track.patternDraft = { id: track.patternId, text: "[" }; mutate(track);
    rejected(arrangement([track]));
  }
});

test("the file cap accommodates four full libraries of 64 large unused pattern definitions", () => {
  const bars = Array.from({ length: 4 }, () => ({ cells: Array.from({ length: 96 }, (_, i) =>
    i < 32 ? { kick: .55, snare: 1 } : { kick: .8 }) }));
  const source = {
    title: "Large library", number: 1,
    meter: { numerator: 12, denominator: 2, quarterBeats: 24 }, tempoQuarter: 320,
    barDurations: [24, 24, 24, 24],
    patterns: Array.from({ length: 64 }, (_, i) => ({ id: i + 1, name: "Загвар " + (i + 1), bars: copy(bars) })),
    sequence: Array.from({ length: 4 }, (_, offset) => ({ id: 1, offset })), nextId: 65
  };
  const tracks = Array.from({ length: 4 }, (_, i) => ({
    id: i + 1, name: "Drums " + (i + 1), instrument: "drums", volume: 30, mute: false, solo: false,
    abc: patterns.toABC(source), patterns: copy(source), patternBar: 1, patternId: 1,
    textMode: "pattern", patternDraft: null
  }));
  const encoded = codec.encode(arrangement(tracks));
  assert.ok(Buffer.byteLength(encoded) > 1024 * 1024, "a 1 MiB cap would reject this supported library");
  assert.ok(Buffer.byteLength(encoded) <= codec.MAX_BYTES);
  const result = codec.decode(encoded);
  assert.equal(result.content.tracks.length, 4);
  assert.equal(result.content.tracks[3].patterns.patterns.length, 64);
  assert.equal(result.content.tracks[3].patterns.patterns[63].bars[3].cells.length, 96);
  assert.deepEqual(result.content.tracks[3].patterns.patterns[63].bars[3].cells[0], { kick: .55, snare: 1 });
  source.patterns.push({ id: 65, name: "too many", bars: copy(bars) });
  source.nextId = 66;
  tracks[0].patterns = source;
  rejected(arrangement(tracks));
});

test("file limits count UTF-8 bytes before JSON parsing, including non-ASCII padding", () => {
  for (const text of [" ".repeat(codec.MAX_BYTES + 1), "а".repeat(codec.MAX_BYTES / 2 + 1),
    "😀".repeat(codec.MAX_BYTES / 4 + 1)]) {
    assert.throws(() => codec.decode(text), error => error.code === "size");
  }
  const exact = codec.encode(solo());
  assert.deepEqual(codec.decode(exact + " ".repeat(codec.MAX_BYTES - Buffer.byteLength(exact))), solo());
});

test("filenames are stable, Unicode-friendly and contain no path or control characters", () => {
  assert.equal(codec.filename("Миний ая"), "Миний ая.soundlab.json");
  assert.equal(codec.filename("  Score.soundlab.json "), "Score.soundlab.json");
  assert.equal(codec.filename(""), "sound-lab-project.soundlab.json");
  assert.equal(codec.filename("..."), "sound-lab-project.soundlab.json");
  assert.equal(codec.filename(null), "sound-lab-project.soundlab.json");
  assert.match(codec.filename("CON"), /^sound-lab-CON\./);
  const dangerous = codec.filename('../one\\two:three/"four"\u0000\n\u202e');
  assert.equal(/[\\/:"<>|?*\u0000-\u001f\u007f\u202a-\u202e]/.test(dangerous), false);
  assert.equal(dangerous.startsWith("."), false);
  assert.ok(codec.filename("😀".repeat(120)).length <= 214);
});
