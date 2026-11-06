/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Original, deterministic marimba-like teaching model.
 * A soft strike excites a few tuned wooden-bar modes; a slow-building component
 * at the fundamental stands in for the radiation enhanced by a resonator tube.
 * The illustrative 1:4:10 tuning is not a claim about every bar/register. Higher
 * ratios, weights and damping below are design choices, not measured parameters.
 * This is neither a recording nor a coupled beam/contact/air-column simulation.
 *
 * Physical motivation (no code, recordings or figures imported):
 * https://euphonics.org/3-3-marimbas-and-xylophones/
 * https://www.yamaha.com/en/musical_instrument_guide/marimba/mechanism/mechanism003.html
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabMarimba = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TAU = 2 * Math.PI;
  const MIN_HZ = 110;
  const MAX_HZ = 1760;
  const MIN_DECAY = .12;
  const MAX_DECAY = 1.2;
  const DEFAULT_DECAY = .65;
  const DEFAULT_VELOCITY = .62;
  const REFERENCE_RATE = 48000;
  const MAX_MODE_HZ = 7500;
  const MODE_RATIOS = Object.freeze([1, 4, 10, 17.3, 26.4]);
  const MODE_WEIGHTS = Object.freeze([1, .48, .20, .075, .04]);
  const MODE_DECAYS = Object.freeze([1, .31, .14, .085, .06]);
  const OUTPUT_SCALE = .44;
  const recipeCache = new Map();
  let latestRecipe = null;

  function validVelocity(velocity) {
    return Number.isFinite(velocity) && velocity >= 0 && velocity <= 1;
  }

  function validate(pitchHz, decaySec = DEFAULT_DECAY,
    velocity = DEFAULT_VELOCITY, sampleRate = REFERENCE_RATE) {
    if (!Number.isFinite(pitchHz) || pitchHz < MIN_HZ || pitchHz > MAX_HZ) {
      throw new RangeError("Marimba pitch outside the supported range");
    }
    if (!Number.isFinite(decaySec) || decaySec < MIN_DECAY || decaySec > MAX_DECAY) {
      throw new RangeError("Marimba decay outside the supported range");
    }
    if (!validVelocity(velocity)) throw new RangeError("Marimba strike strength outside the supported range");
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new RangeError("Unsupported marimba sampling rate");
    }
  }

  function taper(hz, from, to) {
    if (hz <= from) return 1;
    if (hz >= to) return 0;
    return .5 + .5 * Math.cos(Math.PI * (hz - from) / (to - from));
  }

  function bandGain(hz, sampleRate) {
    // A smooth fixed band cap keeps the existing 16 kHz explanatory FFT and
    // normal 44.1/48 kHz playback on exactly the same model. Lower-rate renders
    // additionally suppress modes before their own Nyquist limit. Smooth attack
    // and tail envelopes limit spectral splatter; this is not an ideal brickwall.
    return taper(hz, 6500, MAX_MODE_HZ) * taper(hz, .47 * sampleRate, .495 * sampleRate);
  }

  function makeRecipe(pitchHz, decaySec, velocity, sampleRate) {
    validate(pitchHz, decaySec, velocity, sampleRate);
    const registerTime = Math.max(.70, Math.min(1.14, Math.pow(220 / pitchHz, .16)));
    const decay = decaySec * registerTime;
    const brightness = .12 + .88 * Math.pow(velocity, 1.4);
    const modes = MODE_RATIOS.flatMap((ratio, index) => {
      const hz = pitchHz * ratio;
      const band = bandGain(hz, sampleRate);
      if (!band) return [];
      const colour = index === 0 ? 1 : Math.pow(brightness, 1 + .22 * index);
      return [Object.freeze({ ratio, hz,
        weight: MODE_WEIGHTS[index] * colour * band,
        decaySec: decay * MODE_DECAYS[index] })];
    });
    return Object.freeze({ pitchHz, decaySec, velocity, sampleRate,
      modes: Object.freeze(modes),
      attackSec: .0032 - .0017 * velocity,
      resonatorAttackSec: Math.max(.004, Math.min(.016, .010 * Math.pow(220 / pitchHz, .3))),
      resonatorDecaySec: decay * .83,
      resonatorWeight: .31 * Math.min(1, Math.pow(440 / pitchHz, .3)),
      gain: OUTPUT_SCALE * Math.pow(velocity, .7) });
  }

  function recipe(pitchHz, decaySec, velocity, sampleRate) {
    // Every sample of one rendered note shares a recipe; the fast path avoids
    // allocating a string key per sample. Only a small bank of numbers is cached,
    // not multi-second waveform buffers, so many-note export stays memory-bounded.
    if (latestRecipe && latestRecipe.pitchHz === pitchHz && latestRecipe.decaySec === decaySec &&
      latestRecipe.velocity === velocity && latestRecipe.sampleRate === sampleRate) return latestRecipe;
    const key = [pitchHz, decaySec, velocity, sampleRate].join("|");
    if (!recipeCache.has(key)) {
      const next = makeRecipe(pitchHz, decaySec, velocity, sampleRate);
      if (recipeCache.size >= 24) recipeCache.delete(recipeCache.keys().next().value);
      recipeCache.set(key, next);
    }
    latestRecipe = recipeCache.get(key);
    return latestRecipe;
  }

  function modeData(pitchHz, decaySec = DEFAULT_DECAY,
    velocity = DEFAULT_VELOCITY, sampleRate = REFERENCE_RATE) {
    return recipe(pitchHz, decaySec, velocity, sampleRate).modes;
  }

  function rise(time, attackSec) {
    const onset = -Math.expm1(-time / attackSec);
    return onset * onset;
  }

  // A simple, positive amplitude guide for the explorer. Like the other
  // transient envelopes this is a guide, not the exact oscillation envelope of
  // every partial. Transient synthesis applies the common finite ending/fade.
  function envelope(time, decaySec = DEFAULT_DECAY, velocity = DEFAULT_VELOCITY) {
    if (!Number.isFinite(time)) throw new RangeError("Invalid marimba time");
    const model = recipe(440, decaySec, velocity, REFERENCE_RATE);
    if (time <= 0 || velocity === 0) return 0;
    return Math.pow(velocity, .7) * rise(time, model.attackSec) * Math.exp(-time / decaySec);
  }

  function sampleAt(time, pitchHz, decaySec = DEFAULT_DECAY,
    velocity = DEFAULT_VELOCITY, sampleRate = REFERENCE_RATE) {
    if (!Number.isFinite(time)) throw new RangeError("Invalid marimba time");
    const model = recipe(pitchHz, decaySec, velocity, sampleRate);
    // All public transient hits are at most three seconds long. The transient
    // wrapper supplies the exact decay-dependent duration and final 18 ms fade.
    if (time <= 0 || time >= 3 || velocity === 0) return 0;
    let bar = 0;
    for (const mode of model.modes) {
      bar += mode.weight * Math.exp(-time / mode.decaySec) * Math.sin(TAU * mode.hz * time);
    }
    const tube = model.resonatorWeight * rise(time, model.resonatorAttackSec) *
      Math.exp(-time / model.resonatorDecaySec) * Math.sin(TAU * pitchHz * time);
    // Fixed gain rather than per-note peak normalization preserves strength.
    // The triangle bound is .44 * (1 + .48 + .20 + .075 + .04 + .31) < .927.
    return model.gain * (rise(time, model.attackSec) * bar + tube);
  }

  return Object.freeze({ MIN_HZ, MAX_HZ, MIN_DECAY, MAX_DECAY,
    DEFAULT_DECAY, DEFAULT_VELOCITY, REFERENCE_RATE, MAX_MODE_HZ, MODE_RATIOS,
    validVelocity, validate, modeData, envelope, sampleAt });
});
