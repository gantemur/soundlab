/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * Original, deliberately simplified mandolin-course model; no recordings.
 * Two independently tuned feedback strings, a short pick transient and a
 * compact-body filter. Tremolo is a finite succession of new plucks, never
 * amplitude modulation of one sustained tone.
 */
(function (root, factory) {
  "use strict";
  const strings = typeof module === "object" && module.exports ?
    require("./sound-string.js") : root.SoundLabString;
  const api = factory(strings);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabMandolin = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (strings) {
  "use strict";
  if (!strings) throw new Error("The plucked-string model must load before mandolin synthesis");

  const RATE = 48000;
  const TAU = Math.PI * 2;
  const MIN_HZ = 195.9977; // G3, the lowest open course in G3 D4 A4 E5 tuning.
  const MAX_HZ = 1318.5103; // E6: an illustrative high register, not a fret model.
  const MIN_DECAY = .12;
  const MAX_DECAY = 1.2;
  const DEFAULT_DECAY = .52;
  const DEFAULT_VELOCITY = .64;
  const COURSE_DETUNE_CENTS = 1.6;
  const STROKE_INTERVAL = .105;
  const STROKE_COUNT = 8;
  // A fixed inter-string pick delay can put the two course fundamentals nearly
  // out of phase at some pitches. Compensate the resulting gross loudness dip
  // without changing either string, its detuning, or its transient timing.
  const REFERENCE_RMS = .095;
  const ARTICULATIONS = Object.freeze(["pick", "tremolo"]);
  const cache = new Map();

  function courseFrequencies(hz) {
    if (!Number.isFinite(hz) || hz < MIN_HZ || hz > MAX_HZ) {
      throw new RangeError("Mandolin pitch outside the supported range");
    }
    return [hz * Math.pow(2, -COURSE_DETUNE_CENTS / 2400),
      hz * Math.pow(2, COURSE_DETUNE_CENTS / 2400)];
  }

  function validate(hz, decay = DEFAULT_DECAY, velocity = DEFAULT_VELOCITY,
    sampleRate = RATE, articulation = "pick") {
    courseFrequencies(hz);
    if (!Number.isFinite(decay) || decay < MIN_DECAY || decay > MAX_DECAY) {
      throw new RangeError("Mandolin decay outside the supported range");
    }
    if (!Number.isFinite(velocity) || velocity < 0 || velocity > 1) {
      throw new RangeError("Mandolin pick strength outside the supported range");
    }
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new RangeError("Unsupported mandolin sample rate");
    }
    if (!ARTICULATIONS.includes(articulation)) throw new RangeError("Unknown mandolin articulation");
  }

  function duration(decay) { return Math.max(.35, Math.min(3, decay * 4)); }

  function makeWave(hz, decay, velocity, sampleRate, articulation) {
    const frames = Math.ceil(duration(decay) * RATE);
    const result = new Float32Array(frames);
    if (velocity === 0) return result;
    const [firstHz, secondHz] = courseFrequencies(hz);
    const positionA = .255 - .105 * velocity;
    const positionB = .265 - .090 * velocity;
    const courseDecay = articulation === "tremolo" ? Math.max(.12, Math.min(.33, decay * .58)) : decay;
    const first = strings.pluckWave(firstHz, courseDecay, positionA);
    const second = strings.pluckWave(secondHz, Math.max(.12, courseDecay * .94), positionB);
    const strokes = articulation === "tremolo" ? STROKE_COUNT : 1;
    const excitation = new Float32Array(frames);
    const clickGain = (.028 + .055 * velocity) * Math.pow(velocity, .6);
    for (let stroke = 0; stroke < strokes; stroke++) {
      // Slightly unequal, alternating plectrum strokes make this a series of
      // fresh string excitations instead of a synthesized volume wobble.
      const at = Math.round(stroke * STROKE_INTERVAL * RATE);
      const secondAt = at + (stroke % 2 === 0 ? 110 : 74); // 1.5–2.3 ms spread.
      const weight = (articulation === "pick" ? .47 : .39) *
        [1, .88, 1.04, .91][stroke % 4];
      const aLimit = Math.min(first.length, frames - at);
      const bLimit = Math.min(second.length, frames - secondAt);
      for (let i = 0; i < aLimit; i++) excitation[at + i] += first[i] * weight;
      for (let i = 0; i < bLimit; i++) excitation[secondAt + i] += second[i] * weight * .93;
      const clickLimit = Math.min(Math.round(.008 * RATE), frames - at);
      for (let i = 0; i < clickLimit; i++) {
        const age = i / RATE;
        excitation[at + i] += clickGain * Math.exp(-age / .0022) *
          Math.sin(TAU * (2700 + (stroke % 2) * 270) * age) * (stroke % 2 ? -.9 : 1);
      }
    }

    // A deliberately compact, broad soundboard response: a little low-mid
    // emphasis and a rolled-off top, without pretending to model measured
    // resonant modes of a particular instrument.
    const cutoff = Math.min(4800, sampleRate * .36);
    const gain = .76 * Math.pow(velocity, .73);
    const alphaLow = -Math.expm1(-TAU * 520 / RATE);
    const alphaMid = -Math.expm1(-TAU * 1700 / RATE);
    const alphaHigh = -Math.expm1(-TAU * cutoff / RATE);
    let low = 0, mid = 0, high = 0, antiAlias = 0;
    for (let i = 0; i < frames; i++) {
      const input = excitation[i];
      low += alphaLow * (input - low);
      mid += alphaMid * (input - mid);
      high += alphaHigh * (input - high);
      // The last low-pass adds a little extra rolloff near lower Nyquist rates.
      antiAlias += alphaHigh * (high - antiAlias);
      const body = .72 * antiAlias + .22 * (mid - low) + .14 * low;
      result[i] = Math.max(-.94, Math.min(.94, gain * body));
    }
    // Calibrate only the overall level, using an early 10–300 ms window.
    // Velocity still controls the target level and the excitation spectrum.
    // Keep headroom instead of hard-clipping a dynamically amplified course.
    let energy = 0, peak = 0;
    const start = Math.round(.01 * RATE), end = Math.min(frames, Math.round(.30 * RATE));
    for (let i = 0; i < frames; i++) {
      peak = Math.max(peak, Math.abs(result[i]));
      if (i >= start && i < end) energy += result[i] * result[i];
    }
    const measured = Math.sqrt(energy / Math.max(1, end - start));
    const target = REFERENCE_RMS * Math.pow(velocity / DEFAULT_VELOCITY, .8);
    const correction = Math.min(3.5, target / Math.max(measured, 1e-6),
      .90 / Math.max(peak, 1e-6));
    for (let i = 0; i < frames; i++) result[i] *= correction;
    return result;
  }

  function wave(hz, decay = DEFAULT_DECAY, velocity = DEFAULT_VELOCITY,
    sampleRate = RATE, articulation = "pick") {
    validate(hz, decay, velocity, sampleRate, articulation);
    const key = [hz, decay, velocity, sampleRate, articulation].join("|");
    let result = cache.get(key);
    if (!result) {
      result = makeWave(hz, decay, velocity, sampleRate, articulation);
      if (cache.size >= 8) cache.delete(cache.keys().next().value);
      cache.set(key, result);
    }
    return result;
  }

  function sampleAt(time, hz, decay = DEFAULT_DECAY, velocity = DEFAULT_VELOCITY,
    sampleRate = RATE, articulation = "pick") {
    if (!Number.isFinite(time)) throw new RangeError("Invalid mandolin time");
    if (time <= 0) return 0;
    const samples = wave(hz, decay, velocity, sampleRate, articulation);
    const index = time * RATE;
    if (index >= samples.length - 1) return 0;
    const low = Math.floor(index), mix = index - low;
    return samples[low] * (1 - mix) + samples[low + 1] * mix;
  }

  function envelope(time, decay = DEFAULT_DECAY, velocity = DEFAULT_VELOCITY,
    articulation = "pick") {
    if (!Number.isFinite(time)) throw new RangeError("Invalid mandolin time");
    if (time <= 0 || velocity === 0) return 0;
    let sum = 0;
    const count = articulation === "tremolo" ? STROKE_COUNT : 1;
    for (let stroke = 0; stroke < count; stroke++) {
      const age = time - stroke * STROKE_INTERVAL;
      if (age > 0) sum += Math.min(1, age / .002) * Math.exp(-age / decay) *
        (articulation === "tremolo" ? .4 : 1);
    }
    return Math.min(1, Math.pow(velocity, .73) * sum);
  }

  return Object.freeze({ RATE, MIN_HZ, MAX_HZ, MIN_DECAY, MAX_DECAY,
    DEFAULT_DECAY, DEFAULT_VELOCITY, COURSE_DETUNE_CENTS,
    STROKE_INTERVAL, STROKE_COUNT, ARTICULATIONS,
    courseFrequencies, validate, duration, wave, sampleAt, envelope });
});
