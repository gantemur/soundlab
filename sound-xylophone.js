/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Original deterministic xylophone-like teaching model, not a recording.
 *
 * A hard mallet excites a short-lived collection of flexural wooden-bar modes.
 * Their illustrative ratios are drawn from one measured xylophone bar:
 * https://euphonics.org/3-3-marimbas-and-xylophones/
 * Mode strengths, attack, damping, and a small fundamental resonator are
 * pedagogical choices, not measured parameters of a particular instrument.
 * No acoustic recordings, code or figures are imported.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabXylophone = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TAU = 2 * Math.PI;
  const MIN_HZ = 261.6255;
  const MAX_HZ = 2093.005;
  const MIN_DECAY = .12;
  const MAX_DECAY = 1.2;
  const DEFAULT_DECAY = .32;
  const DEFAULT_VELOCITY = .66;
  const REFERENCE_RATE = 48000;
  const MAX_MODE_HZ = 7500;
  const MODE_RATIOS = Object.freeze([1, 3, 6.16, 10.29, 14.01, 19.66]);
  const MODE_WEIGHTS = Object.freeze([1, .68, .30, .13, .06, .028]);
  const MODE_DECAYS = Object.freeze([1, .29, .15, .10, .07, .05]);
  const OUTPUT_SCALE = .38;
  const recipeCache = new Map();
  let latestRecipe = null;

  function validVelocity(velocity) {
    return Number.isFinite(velocity) && velocity >= 0 && velocity <= 1;
  }

  function validate(pitchHz, decaySec = DEFAULT_DECAY,
    velocity = DEFAULT_VELOCITY, sampleRate = REFERENCE_RATE) {
    if (!Number.isFinite(pitchHz) || pitchHz < MIN_HZ || pitchHz > MAX_HZ) {
      throw new RangeError("Xylophone pitch outside the supported range");
    }
    if (!Number.isFinite(decaySec) || decaySec < MIN_DECAY || decaySec > MAX_DECAY) {
      throw new RangeError("Xylophone decay outside the supported range");
    }
    if (!validVelocity(velocity)) throw new RangeError("Xylophone strike strength outside the supported range");
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new RangeError("Unsupported xylophone sampling rate");
    }
  }

  function taper(hz, from, to) {
    if (hz <= from) return 1;
    if (hz >= to) return 0;
    return .5 + .5 * Math.cos(Math.PI * (hz - from) / (to - from));
  }

  function bandGain(hz, sampleRate) {
    // The fixed 6.5–7.5 kHz cap keeps the 16 kHz explainer and 44.1/48 kHz
    // playback on the same spectral model. Low-rate PCM additionally tapers
    // modes before Nyquist; the smooth finite attack limits splatter.
    return taper(hz, 6500, MAX_MODE_HZ) * taper(hz, .47 * sampleRate, .495 * sampleRate);
  }

  function makeRecipe(pitchHz, decaySec, velocity, sampleRate) {
    validate(pitchHz, decaySec, velocity, sampleRate);
    const register = Math.max(.72, Math.min(1.06, Math.pow(523.251131 / pitchHz, .17)));
    const decay = decaySec * register;
    const brightness = .09 + .91 * Math.pow(velocity, 1.16);
    const modes = MODE_RATIOS.flatMap((ratio, index) => {
      const hz = ratio * pitchHz;
      const band = bandGain(hz, sampleRate);
      if (!band) return [];
      return [Object.freeze({ ratio, hz,
        weight: MODE_WEIGHTS[index] * (index === 0 ? 1 :
          Math.pow(brightness, 1 + .16 * (index - 1))) * band,
        decaySec: decay * MODE_DECAYS[index] })];
    });
    return Object.freeze({ pitchHz, decaySec, velocity, sampleRate,
      modes: Object.freeze(modes),
      attackSec: .00042 + .00065 * (1 - velocity),
      resonatorAttackSec: .0035,
      resonatorDecaySec: decay * .70,
      resonatorWeight: .12 * Math.min(1, Math.pow(523.251131 / pitchHz, .2)),
      gain: OUTPUT_SCALE * Math.pow(velocity, .75) });
  }

  function recipe(pitchHz, decaySec, velocity, sampleRate) {
    if (latestRecipe && latestRecipe.pitchHz === pitchHz && latestRecipe.decaySec === decaySec &&
        latestRecipe.velocity === velocity && latestRecipe.sampleRate === sampleRate) return latestRecipe;
    const key = [pitchHz, decaySec, velocity, sampleRate].join("|");
    if (!recipeCache.has(key)) {
      if (recipeCache.size >= 24) recipeCache.delete(recipeCache.keys().next().value);
      recipeCache.set(key, makeRecipe(pitchHz, decaySec, velocity, sampleRate));
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

  function envelope(time, decaySec = DEFAULT_DECAY, velocity = DEFAULT_VELOCITY) {
    if (!Number.isFinite(time)) throw new RangeError("Invalid xylophone time");
    const model = recipe(523.251131, decaySec, velocity, REFERENCE_RATE);
    if (time <= 0 || velocity === 0) return 0;
    return Math.pow(velocity, .75) * rise(time, model.attackSec) * Math.exp(-time / decaySec);
  }

  function sampleAt(time, pitchHz, decaySec = DEFAULT_DECAY,
    velocity = DEFAULT_VELOCITY, sampleRate = REFERENCE_RATE) {
    if (!Number.isFinite(time)) throw new RangeError("Invalid xylophone time");
    const model = recipe(pitchHz, decaySec, velocity, sampleRate);
    if (time <= 0 || time >= 3 || velocity === 0) return 0;
    let bar = 0;
    for (const mode of model.modes) {
      bar += mode.weight * Math.exp(-time / mode.decaySec) * Math.sin(TAU * mode.hz * time);
    }
    const tube = model.resonatorWeight * rise(time, model.resonatorAttackSec) *
      Math.exp(-time / model.resonatorDecaySec) * Math.sin(TAU * pitchHz * time);
    // Conservative absolute bound: .38 × (1+.68+.30+.13+.06+.028+.12) < .89.
    return model.gain * (rise(time, model.attackSec) * bar + tube);
  }

  return Object.freeze({ MIN_HZ, MAX_HZ, MIN_DECAY, MAX_DECAY,
    DEFAULT_DECAY, DEFAULT_VELOCITY, REFERENCE_RATE, MAX_MODE_HZ, MODE_RATIOS,
    validVelocity, validate, modeData, envelope, sampleAt });
});
