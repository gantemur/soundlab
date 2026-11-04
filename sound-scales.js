/* Build octave-equivalent scales by walking upward/downward in exact 3:2 steps. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabScales = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const MIN_BASE_HZ = 110;
  const MAX_BASE_HZ = 330;
  const MAX_NOTES = 12;
  const STEP_SECONDS = 0.31;
  const NOTE_SECONDS = 0.275;
  const CHORD_SECONDS = 3.2;
  const GAP_SECONDS = 3.2;
  const FIFTH_CENTS = 1200 * Math.log2(3 / 2);
  const FIFTH_TURN_DEGREES = 360 * Math.log2(3 / 2);
  const PRESETS = Object.freeze([
    Object.freeze({ id: "five-up", down: 0, up: 4 }),
    Object.freeze({ id: "five-center", down: 2, up: 2 }),
    Object.freeze({ id: "five-down", down: 4, up: 0 }),
    Object.freeze({ id: "seven", down: 1, up: 5 }),
    Object.freeze({ id: "twelve", down: 5, up: 6 })
  ]);

  function gcd(a, b) {
    while (b) [a, b] = [b, a % b];
    return a;
  }

  function octaveFraction(k) {
    if (!Number.isInteger(k) || Math.abs(k) >= MAX_NOTES) throw new RangeError("Invalid fifth step");
    let numerator = k >= 0 ? 3 ** k : 2 ** -k;
    let denominator = k >= 0 ? 2 ** k : 3 ** -k;
    while (numerator < denominator) numerator *= 2;
    while (numerator >= 2 * denominator) denominator *= 2;
    const divisor = gcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
  }

  function build({ down = 0, up = 4, tonicK = 0, baseHz = 220 } = {}) {
    if (!Number.isInteger(down) || !Number.isInteger(up) || down < 0 || up < 0 ||
        down + up + 1 > MAX_NOTES || !Number.isInteger(tonicK) || tonicK < -down || tonicK > up) {
      throw new RangeError("Scale requires 1–12 consecutive fifth steps including its tonic");
    }
    if (!Number.isFinite(baseHz) || baseHz < MIN_BASE_HZ || baseHz > MAX_BASE_HZ) {
      throw new RangeError("Reference pitch must be between 110 and 330 Hz");
    }
    const chain = Array.from({ length: down + up + 1 }, (_, index) => {
      const k = index - down;
      const { numerator, denominator } = octaveFraction(k);
      const ratio = numerator / denominator;
      return { k, numerator, denominator, ratio, cents: 1200 * Math.log2(ratio), hz: baseHz * ratio };
    });
    const notes = [...chain].sort((a, b) => a.ratio - b.ratio);
    const tonic = chain.find(note => note.k === tonicK);
    const tonicHz = tonic.hz;
    const ordered = notes.map(note => {
      let ratio = note.ratio / tonic.ratio;
      if (ratio < 1 - 1e-10) ratio *= 2;
      if (ratio >= 2 - 1e-10) ratio /= 2;
      return { ...note, relativeRatio: ratio, relativeCents: 1200 * Math.log2(ratio),
        playingHz: tonicHz * ratio };
    }).sort((a, b) => a.relativeCents - b.relativeCents);
    const gaps = ordered.map((note, i) =>
      (i + 1 < ordered.length ? ordered[i + 1].relativeCents : 1200) - note.relativeCents);
    const count = chain.length;
    const octaveCount = Math.round(count * Math.log2(3 / 2));
    return { baseHz, down, up, tonicK, tonicHz, chain, notes, ordered, gaps, count, octaveCount,
      closureCents: count * FIFTH_CENTS - octaveCount * 1200 };
  }

  function melodySteps(scale) {
    return [...scale.ordered.map(note => ({ k: note.k, hz: note.playingHz, octaveUp: false })),
      { k: scale.tonicK, hz: scale.tonicHz * 2, octaveUp: true },
      ...scale.ordered.slice().reverse().map(note => ({ k: note.k, hz: note.playingHz, octaveUp: false }))];
  }

  function melody(scale) {
    return melodySteps(scale).map(note => note.hz);
  }

  // The first pitch and a ghost pitch reached after `count` additional fifths
  // are compared in the nearest octave. This is the Pythagorean comma at 12
  // steps; five and seven fifths give larger near-return gaps, not commas.
  function returnGap(scale) {
    if (!scale || !Number.isInteger(scale.count) || !Array.isArray(scale.chain)) {
      throw new TypeError("A fifth-chain scale is required");
    }
    const direction = scale.up === 0 && scale.down > 0 ? -1 : 1;
    const startK = direction > 0 ? (scale.down ? -scale.down : 0) : scale.up;
    const ghostK = startK + direction * scale.count;
    const octaveCount = Math.round(scale.count * Math.log2(3 / 2));
    const signedCents = direction * (scale.count * FIFTH_CENTS - 1200 * octaveCount);
    const start = scale.chain.find(note => note.k === startK);
    const ratio = 2 ** (signedCents / 1200);
    return { startK, ghostK, direction, octaveCount, signedCents,
      angleDegrees: signedCents * 360 / 1200, ratio,
      fromHz: start.hz, toHz: start.hz * ratio, isPythagoreanComma: scale.count === 12 };
  }

  function makeGapSamples(scale, sampleRate) {
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new RangeError("Unsupported sample rate");
    }
    const { fromHz, toHz } = returnGap(scale);
    const length = Math.ceil(GAP_SECONDS * sampleRate);
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, t / .04, (GAP_SECONDS - t) / .12);
      data[i] = .4 * envelope *
        (Math.sin(2 * Math.PI * fromHz * t) + Math.sin(2 * Math.PI * toHz * t));
    }
    return data;
  }

  function makeSamples(scale, sampleRate) {
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new RangeError("Unsupported sample rate");
    }
    const frequencies = melody(scale);
    const count = Math.ceil(frequencies.length * STEP_SECONDS * sampleRate);
    const data = new Float32Array(count);
    for (let i = 0; i < data.length; i++) {
      const time = i / sampleRate;
      const index = Math.floor(time / STEP_SECONDS);
      const elapsed = time - index * STEP_SECONDS;
      if (index >= frequencies.length || elapsed >= NOTE_SECONDS) continue;
      const envelope = Math.min(1, elapsed / .018, (NOTE_SECONDS - elapsed) / .04);
      const phase = 2 * Math.PI * frequencies[index] * elapsed;
      // A quiet second harmonic makes the notes audible without obscuring their pitches.
      data[i] = envelope * (.88 * Math.sin(phase) + .12 * Math.sin(2 * phase));
    }
    return data;
  }

  // All selected pitch classes sound together, with a shared fade and a
  // per-note amplitude bound so even a twelve-note chord cannot clip.
  function makeChordSamples(scale, sampleRate) {
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new RangeError("Unsupported sample rate");
    }
    const frequencies = scale.ordered.map(note => note.playingHz);
    if (!frequencies.length || frequencies.length > MAX_NOTES) {
      throw new RangeError("Scale must contain 1–12 notes");
    }
    const samples = new Float32Array(Math.ceil(CHORD_SECONDS * sampleRate));
    const amplitude = 0.75 / frequencies.length;
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.max(0, Math.min(1, t / .035, (CHORD_SECONDS - t) / .10));
      for (const hz of frequencies) {
        const phase = 2 * Math.PI * hz * t;
        samples[i] += amplitude * envelope * (.88 * Math.sin(phase) + .12 * Math.sin(2 * phase));
      }
    }
    return samples;
  }

  return Object.freeze({ MIN_BASE_HZ, MAX_BASE_HZ, MAX_NOTES, PRESETS, FIFTH_CENTS,
    FIFTH_TURN_DEGREES, STEP_SECONDS, NOTE_SECONDS, CHORD_SECONDS, GAP_SECONDS, octaveFraction, build,
    returnGap, melodySteps, melody, makeSamples, makeChordSamples, makeGapSamples });
});
