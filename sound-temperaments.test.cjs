"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const temp = require("./sound-temperaments.js");

function close(actual, expected, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should equal ${expected}`);
}

test("five temperaments and the C-centred just comparator close twelve fifths against seven octaves", () => {
  assert.deepEqual(temp.SYSTEMS, ["equal", "pythagorean", "meantone", "werckmeister", "vallotti", "just"]);
  for (const system of temp.SYSTEMS) {
    const fifths = temp.fifths(system);
    assert.equal(fifths.length, 12);
    close(fifths.reduce((sum, edge) => sum + edge.cents, 0), 8400);
    assert.deepEqual(fifths.map(edge => edge.from), temp.CIRCLE);
    for (const edge of fifths) {
      close(((temp.pitches(system)[temp.PITCH_CLASSES[(edge.index + 1) % 12]] -
        temp.pitches(system)[temp.PITCH_CLASSES[edge.index]] - edge.cents) % 1200 + 1200) % 1200, 0, 1e-6);
    }
  }
});

test("equal temperament has twelve 700-cent fifths, and A4=440 Hz in every system", () => {
  for (const edge of temp.fifths("equal")) close(edge.cents, 700);
  for (const system of temp.SYSTEMS) {
    close(temp.frequency(system, 9, 4), 440);
    close(temp.frequency(system, 9, 5), 880);
    close(temp.frequency(system, 9, 3), 220);
    close(temp.frequency(system, 0, 5) / temp.frequency(system, 0, 4), 2);
  }
});

test("Pythagorean and quarter-comma meantone place the wolf at G sharp to E flat", () => {
  const pyth = temp.fifths("pythagorean");
  const meantone = temp.fifths("meantone");
  for (const fifths of [pyth, meantone]) {
    assert.deepEqual(fifths.filter(edge => edge.wolf).map(edge => edge.from + "–" + edge.to), ["G♯–E♭"]);
    for (const edge of fifths.filter(edge => !edge.wolf)) assert.equal(edge.wolf, false);
  }
  for (let index = 0; index < 12; index++) {
    if (index === temp.WOLF_EDGE) continue;
    close(pyth[index].cents, temp.FIFTH_CENTS);
    close(meantone[index].cents, temp.FIFTH_CENTS - temp.SYNTONIC_COMMA / 4);
  }
  close(pyth[8].cents, temp.FIFTH_CENTS - temp.PYTHAGOREAN_COMMA);
  close(meantone[8].cents, 8400 - 11 * (temp.FIFTH_CENTS - temp.SYNTONIC_COMMA / 4));
  close(temp.chord("meantone", 0).thirdCents, temp.PURE_MAJOR_THIRD);
  assert.ok(temp.chord("meantone", 8).thirdCents > 420, "remote keys can have very different thirds");
});

test("Werckmeister III and Vallotti use distinct historically documented fifth allocations", () => {
  const werck = temp.fifths("werckmeister");
  const vallotti = temp.fifths("vallotti");
  assert.deepEqual(werck.filter(edge => edge.deviation < -.01).map(edge => edge.index), [0, 1, 2, 5]);
  assert.deepEqual(vallotti.filter(edge => edge.deviation < -.01).map(edge => edge.index), [0, 1, 2, 3, 4, 11]);
  for (const edge of werck) close(edge.cents, temp.FIFTH_CENTS -
    ([0, 1, 2, 5].includes(edge.index) ? temp.PYTHAGOREAN_COMMA / 4 : 0));
  for (const edge of vallotti) close(edge.cents, temp.FIFTH_CENTS -
    ([11, 0, 1, 2, 3, 4].includes(edge.index) ? temp.PYTHAGOREAN_COMMA / 6 : 0));
  assert.ok(werck.every(edge => !edge.wolf) && vallotti.every(edge => !edge.wolf));
});

test("major and minor chords transpose over octave boundaries and deviate from equal", () => {
  const major = temp.chord("equal", 11, "major");
  assert.deepEqual(major.notes.map(note => note.name), ["B4", "E♭5", "F♯5"]);
  close(major.thirdCents, 400);
  close(major.fifthCents, 700);
  for (const note of major.notes) close(note.deviation, 0);
  const minor = temp.chord("equal", 10, "minor");
  assert.deepEqual(minor.notes.map(note => note.name), ["B♭4", "C♯5", "F5"]);
  close(minor.thirdCents, 300);
  close(minor.fifthCents, 700);
  for (const system of temp.SYSTEMS.slice(1)) {
    assert.equal(temp.chord(system, 3, "minor").notes.length, 3);
    assert.ok(temp.deviations(system).some(note => Math.abs(note.centsFromEqual) > 0.01));
  }
});

test("invalid model input is rejected instead of silently producing NaN", () => {
  for (const system of ["unknown", "none", ""]) assert.throws(() => temp.widths(system), RangeError);
  for (const pc of [-1, 12, 1.25, NaN]) assert.throws(() => temp.frequency("equal", pc), RangeError);
  for (const octave of [1, 7, 4.5]) assert.throws(() => temp.frequency("equal", 0, octave), RangeError);
  for (const key of [-1, 12]) assert.throws(() => temp.chord("equal", key), RangeError);
  assert.throws(() => temp.chord("equal", 0, "seventh"), RangeError);
});

test("fifth-narrowing slider trades a purer major third for a wider closing fifth", () => {
  close(temp.PURE_MAJOR_THIRD, 386.3137138648348);
  close(temp.PURE_MINOR_THIRD, 315.64128700055255);
  close(temp.EQUAL_NARROWING, temp.PYTHAGOREAN_COMMA / 12);
  close(temp.WOLF_FREE_NARROWING, temp.PYTHAGOREAN_COMMA / 11);
  close(temp.MEANTONE_NARROWING, temp.SYNTONIC_COMMA / 4);
  assert.equal(temp.SELECTABLE_SYSTEMS.length, 7);
  for (const narrowed of [0, temp.EQUAL_NARROWING, temp.WOLF_FREE_NARROWING,
    temp.MEANTONE_NARROWING, 6]) {
    const edges = temp.fifths("adjustable", narrowed);
    close(edges.reduce((sum, edge) => sum + edge.cents, 0), 8400);
    for (const [i, edge] of edges.entries()) {
      if (i !== temp.WOLF_EDGE) close(edge.cents, temp.FIFTH_CENTS - narrowed);
    }
    close(temp.chord("adjustable", 0, "major", 440, narrowed).thirdCents,
      4 * (temp.FIFTH_CENTS - narrowed) - 2400);
  }
  const pyth = temp.fifths("adjustable", 0)[temp.WOLF_EDGE];
  const meantone = temp.fifths("adjustable", temp.MEANTONE_NARROWING)[temp.WOLF_EDGE];
  assert.ok(pyth.deviation < -23 && meantone.deviation > 35,
    "The same closure edge reverses sign when the ordinary fifths are narrowed");
  assert.deepEqual(temp.fifths("adjustable", temp.WOLF_FREE_NARROWING)
    .filter(edge => edge.wolf), [], "The special closing edge may be pure without being a wolf");
  for (const edge of temp.fifths("adjustable", temp.EQUAL_NARROWING)) close(edge.cents, 700);
});

test("the fixed twelve-note just scale uses twelve exact 3:2–5:4 lattice points", () => {
  const limit5 = require("./sound-limit5.js");
  assert.deepEqual(temp.JUST12_COORDS, limit5.PRESETS.just12);
  assert.equal(new Set(temp.JUST12_COORDS.map(pair => pair.join(","))).size, 12);
  for (const [pc, coords] of temp.JUST12_COORDS.entries()) {
    const exact = limit5.point(...coords, 264);
    const [numerator, denominator] = temp.JUST12_RATIOS[pc];
    assert.deepEqual([exact.numerator, exact.denominator], [numerator, denominator]);
    assert.equal(exact.tetStep, pc);
    assert.ok(coords[1] >= -1 && coords[1] <= 1);
    close(temp.frequency("just", pc, 4), exact.hz, 1e-9);
  }
  close(temp.frequency("just", 0, 4), 264);
  close(temp.frequency("just", 9, 4), 440);
  close(temp.chord("just", 0, "major").thirdCents, temp.PURE_MAJOR_THIRD);
  close(temp.chord("just", 0, "major").fifthCents, temp.FIFTH_CENTS);
  close(temp.chord("just", 2, "major").thirdCents, temp.PURE_MAJOR_THIRD);
  close(temp.chord("just", 2, "major").fifthCents, 1200 * Math.log2(40 / 27));
  const fifths = temp.fifths("just");
  assert.equal(fifths.filter(edge => Math.abs(edge.deviation) < .001).length, 9);
  assert.deepEqual(fifths.filter(edge => edge.deviation < -1).map(edge => edge.from + "–" + edge.to),
    ["D–A", "B♭–F"]);
  close(fifths[2].deviation, -temp.SYNTONIC_COMMA);
  close(fifths[10].deviation, -temp.SYNTONIC_COMMA);
  close(fifths[6].deviation, 1200 * Math.log2(2048 / 2025));
  assert.ok(fifths.every(edge => !edge.wolf), "There is no single closing wolf in this just selection");
  assert.ok(temp.latticeNotes("just").every(note => Math.abs(note.deviation) < 1e-9));
  const dMajor = temp.latticeChord("just", 2, "major");
  assert.deepEqual(dMajor.vertices.map(vertex => [vertex.m, vertex.n]), [[2, 0], [2, 1], [3, 0]]);
  assert.deepEqual(dMajor.actualVertices.map(vertex => [vertex.m, vertex.n]), [[2, 0], [2, 1], [-1, 1]]);
});

test("the exact 3:2–5:4 lattice has triangular pure chords and distinct comma endpoints", () => {
  const pyth = temp.latticeNotes("pythagorean");
  assert.deepEqual(pyth.map(note => note.m), [0, 1, 2, 3, 4, 5, 6, 7, 8, -3, -2, -1]);
  assert.ok(pyth.every(note => Math.abs(note.deviation) < 1e-6),
    "Pythagorean shadows are precisely exact lattice points");
  assert.ok(temp.latticeNotes("equal").some(note => Math.abs(note.deviation) > 1));
  const major = temp.latticeChord("meantone", 0, "major");
  const minor = temp.latticeChord("meantone", 0, "minor");
  assert.deepEqual(major.vertices.map(({ m, n }) => [m, n]), [[0, 0], [0, 1], [1, 0]]);
  assert.deepEqual(minor.vertices.map(({ m, n }) => [m, n]), [[0, 0], [1, -1], [1, 0]]);
  close(major.vertices[1].deviation, 0);
  close(temp.latticeChord("pythagorean", 0, "major").vertices[1].deviation,
    temp.SYNTONIC_COMMA);
  const ends = temp.closure();
  assert.equal(ends.pureEnd.m - ends.start.m, 12);
  close(ends.cents, temp.PYTHAGOREAN_COMMA);
  assert.notDeepEqual(ends.pureEnd, ends.start);
});

test("rich two-note comparisons expose 3-to-2, 5-to-4, and 6-to-5 partial gaps", () => {
  const ordinary = temp.partialGap(220, 330, "fifth");
  assert.deepEqual([ordinary.lowerHarmonic, ordinary.upperHarmonic, ordinary.beatHz], [3, 2, 0]);
  close(temp.partialGap(220, 275, "major").beatHz, 0);
  close(temp.partialGap(220, 264, "minor").beatHz, 0);
  const wolf = temp.partialGap(temp.frequency("meantone", 8),
    temp.frequency("meantone", 3, 5), "fifth");
  assert.ok(wolf.beatHz > 15, "Wolf fifth should produce rapid mismatch of harmonic 3 and 2");
  const sampleRate = 8000;
  const rich = temp.makeSamples([{ hz: 220 }, { hz: 330 }], sampleRate, "chord");
  const pure = temp.makeSamples([{ hz: 220 }, { hz: 330 }], sampleRate, "chord", false);
  assert.equal(rich.length, 4 * sampleRate);
  assert.equal(temp.makeSamples([{ hz: 220 }, { hz: 330 }], sampleRate, "melody").length,
    Math.ceil(2 * .64 * sampleRate));
  assert.ok(rich.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
  assert.notDeepEqual([...rich.subarray(0, 100)], [...pure.subarray(0, 100)],
    "Richer upper partials are part of the listening experiment");
  assert.throws(() => temp.widths("adjustable", 7), RangeError);
  assert.throws(() => temp.widths("adjustable", NaN), RangeError);
  assert.throws(() => temp.partialGap(220, 0), RangeError);
  assert.throws(() => temp.makeSamples([{ hz: -1 }], 8000), RangeError);
});
