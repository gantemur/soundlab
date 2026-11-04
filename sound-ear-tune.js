/* Deterministic ear-tuning exercises: one ratio at a time, with octave equivalence. */
((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabEarTune = api;
})(typeof window === "undefined" ? null : window, () => {
  "use strict";

  const START_HZ = 261.63; // C4, with the practice octave [C4,C5).
  const TASKS = Object.freeze({
    fifth: Object.freeze({ ratio: 3 / 2, p: 3, q: 2, note: "G", octave: 4 }),
    third: Object.freeze({ ratio: 5 / 4, p: 5, q: 4, note: "E", octave: 4 }),
    fourth: Object.freeze({ ratio: 4 / 3, p: 4, q: 3, note: "F", octave: 4 }),
    octaveUp: Object.freeze({ ratio: 2, p: 2, q: 1, note: "C", octave: 5 }),
    downFourth: Object.freeze({ ratio: 3 / 4, p: 3, q: 4, note: "G", octave: 3 }),
    downFifth: Object.freeze({ ratio: 2 / 3, p: 2, q: 3, note: "F", octave: 3 }),
    octaveDown: Object.freeze({ ratio: 1 / 2, p: 1, q: 2, note: "C", octave: 3 })
  });
  // Hidden offsets keep the slider centered without making zero the correct answer.
  // They are reproducible for exercises/tests; the students do not see them.
  const OFFSETS = Object.freeze({
    fifth: 18, third: -16, fourth: 22, octaveUp: -19,
    downFourth: -23, downFifth: 17, octaveDown: 20
  });
  const SOUNDS = Object.freeze(["pure", "rich", "guitar", "piano"]);
  const PATTERNS = Object.freeze(["alternating", "together"]);

  function cents(a, b) { return 1200 * Math.log2(a / b); }

  function foldOctave(hz, baseHz = START_HZ) {
    if (!(hz > 0) || !(baseHz > 0)) throw new RangeError("Frequencies must be positive");
    let foldedHz = hz;
    let shifts = 0;
    while (foldedHz >= 2 * baseHz) { foldedHz /= 2; shifts--; }
    while (foldedHz < baseHz) { foldedHz *= 2; shifts++; }
    return { foldedHz, shifts };
  }

  function parameters(taskId) {
    const task = TASKS[taskId];
    if (!task) throw new RangeError("Invalid ear-tuning task");
    return { ...task, hiddenOffset: OFFSETS[taskId] };
  }

  function step({ taskId = "fifth", referenceHz = START_HZ, adjustment = 0 } = {}) {
    const { ratio, p, q, hiddenOffset, note, octave } = parameters(taskId);
    if (!(referenceHz > 0) || !Number.isFinite(adjustment) || Math.abs(adjustment) > 60) {
      throw new RangeError("Invalid tuning frequency or adjustment");
    }
    const targetHz = referenceHz * ratio;
    const errorCents = hiddenOffset + adjustment;
    const tunedHz = targetHz * Math.pow(2, errorCents / 1200);
    // Use the ideal ratio's octave shift: a tiny imperfect tuning of 1:2 or
    // 2:1 should not make its displayed equivalence jump an entire octave.
    const { shifts } = foldOctave(targetHz, referenceHz);
    const foldedHz = tunedHz * Math.pow(2, shifts);
    return {
      note, octave, ratio, p, q, referenceHz, targetHz, tunedHz, errorCents,
      nearBeatHz: Math.abs(p * referenceHz - q * tunedHz),
      referencePartialHz: p * referenceHz, tunedPartialHz: q * tunedHz,
      foldedHz, shifts
    };
  }

  // Lightweight, finite overtone recipes for the ear-training audio engine.
  // The struck-string timbres are illustrative, not samples of real instruments.
  function partials(sound) {
    if (!SOUNDS.includes(sound)) throw new RangeError("Unknown ear-tuning timbre");
    const count = sound === "pure" ? 1 : 8;
    const recipe = [];
    for (let n = 1; n <= count; n++) {
      const weight = sound === "pure" ? 1 : sound === "rich" ? 1 / n :
        sound === "guitar" ? Math.abs(Math.sin(Math.PI * n * 0.22)) / Math.pow(n, 1.8) :
        Math.exp(-Math.pow((n - 1) / 6, 2)) / Math.pow(n, 1.2);
      const multiplier = sound === "piano" ? n * Math.sqrt(1 + 0.00016 * n * n) : n;
      recipe.push({ multiplier, weight });
    }
    const total = recipe.reduce((sum, part) => sum + part.weight, 0);
    return recipe.map(part => ({ multiplier: part.multiplier, amplitude: part.weight / total }));
  }

  function rating(errorCents) {
    const magnitude = Math.abs(errorCents);
    return magnitude <= 5 ? "excellent" : magnitude <= 15 ? "close" : "retry";
  }

  return { START_HZ, TASKS, OFFSETS, SOUNDS, PATTERNS, cents, foldOctave,
    parameters, step, partials, rating };
});
