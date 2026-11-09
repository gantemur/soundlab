/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * I3: gentle finger-plucked string and resonant soundboard surrogate.
 * Deterministic additive modes, not a recording or full coupled-string solver.
 */
(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  if (root) root.SoundLabHarp = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const TAU = 2 * Math.PI;
  const MIN_HZ = 82.4069, MAX_HZ = 1568;
  const DEFAULT_DECAY = .92, DEFAULT_VELOCITY = .62;
  const MAX_PARTIALS = 16;
  let cachedKey = null, cachedRecipe = null;

  function validate(hz, decay = DEFAULT_DECAY, velocity = DEFAULT_VELOCITY, sampleRate = 48000) {
    // Pitched score notes may extrapolate the same modal string recipe.
    // MIN_HZ/MAX_HZ remain the useful reference register for the explorer.
    if (!Number.isFinite(hz) || hz < 20 || hz > 5000 ||
        !Number.isFinite(decay) || decay < .12 || decay > 1.2 ||
        !Number.isFinite(velocity) || velocity < 0 || velocity > 1 ||
        !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new RangeError("Harp pitch, damping, attack strength or sample rate outside model range");
    }
  }
  function duration(decay = DEFAULT_DECAY) {
    // The score/export engine reserves at most three seconds after a 90-second
    // piece. Harp has a much longer audible tail than mandolin within this cap.
    return Math.min(3, Math.max(.7, 5 * decay));
  }
  function recipe(hz, decay, velocity, sampleRate) {
    validate(hz, decay, velocity, sampleRate);
    const key = [hz, decay, velocity, sampleRate].join("|");
    if (key === cachedKey) return cachedRecipe;
    const baseDecay = (.42 + 1.15 * decay) * Math.pow(220 / hz, .17);
    const stiffness = .000008 * Math.pow(hz / 440, .25);
    const brightness = .35 + .65 * velocity;
    const modes = [];
    let norm = 0;
    for (let n = 1; n <= MAX_PARTIALS; n++) {
      const frequency = n * hz * Math.sqrt(1 + stiffness * n * n);
      if (frequency >= Math.min(8200, sampleRate * .47)) break;
      // A fingertip excites a spatially distributed, approximately triangular
      // string displacement. Soundboard resonances selectively colour modes.
      const pluck = Math.abs(Math.sin(Math.PI * n * .23));
      const board = 1 + .26 * Math.exp(-Math.pow((frequency - 310) / 175, 2)) +
        .14 * Math.exp(-Math.pow((frequency - 720) / 260, 2));
      const weight = (n === 1 ? 1 : Math.pow(brightness, .5 + n * .13)) *
        pluck * board / Math.pow(n, 1.18);
      const time = baseDecay / (1 + .14 * (n - 1) + .023 * (n - 1) ** 2);
      modes.push({ frequency, weight, time }); norm += Math.abs(weight);
    }
    cachedKey = key;
    cachedRecipe = { modes, gain: .80 * Math.pow(velocity, .68) / Math.max(.1, norm),
      attack: .004 + .002 * (1 - velocity), duration: duration(decay) };
    return cachedRecipe;
  }
  function envelope(time, decay = DEFAULT_DECAY, velocity = DEFAULT_VELOCITY) {
    if (time <= 0 || time >= duration(decay)) return 0;
    return Math.pow(velocity, .68) * (1 - Math.exp(-time / .004)) *
      Math.exp(-time / (.42 + 1.15 * decay)) * Math.pow(Math.min(1, (duration(decay) - time) / .32), 2);
  }
  function sampleAt(time, hz, decay = DEFAULT_DECAY, velocity = DEFAULT_VELOCITY, sampleRate = 48000) {
    const r = recipe(hz, decay, velocity, sampleRate);
    if (time <= 0 || time >= r.duration || velocity === 0) return 0;
    const attack = 1 - Math.exp(-time / r.attack);
    let signal = 0;
    for (const mode of r.modes) {
      signal += mode.weight * Math.exp(-time / mode.time) *
        Math.sin(TAU * mode.frequency * time);
    }
    // Tiny soft contact noise, unlike a hard plectrum strike.
    const contact = .015 * Math.exp(-time / .003) * Math.sin(TAU * 1750 * time);
    const fade = Math.pow(Math.min(1, (r.duration - time) / .32), 2);
    return r.gain * attack * fade * (signal + contact);
  }
  return Object.freeze({ MIN_HZ, MAX_HZ, DEFAULT_DECAY, DEFAULT_VELOCITY,
    validate, duration, envelope, sampleAt });
});
