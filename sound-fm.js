/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * An original, small two-operator FM electric-piano model shared by Compose
 * and the Strike/Pluck piano experiment.
 * It does not reproduce a proprietary synthesizer voice or use samples.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabFM = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const DURATION_SECONDS = 2.8;
  const TAU = 2 * Math.PI;

  function envelopeAt(time, decaySec = .8, velocity = .62, touch = "press") {
    if (time <= 0) return 0;
    const slowTime = time * .8 / decaySec;
    const body = (1 - Math.exp(-time / .0035)) *
      (.61 * Math.exp(-slowTime / .72) + .27 * Math.exp(-slowTime / 2.1));
    const force = Math.min(1.15, .82 + .18 * velocity / .62);
    const damper = touch === "tap" && time > .16 ? Math.exp(-(time - .16) / .070) : 1;
    return body * force * (touch === "tap" ? .8 : 1) * damper;
  }

  function sampleAt(time, hz, sampleRate = 48000, options = {}) {
    const decaySec = options.decaySec ?? .8;
    if (time <= 0 || time >= DURATION_SECONDS * decaySec / .8) return 0;
    const velocity = options.velocity ?? .62;
    const touch = options.touch ?? "press";
    const phase = TAU * hz * time;
    // A falling 2:1 modulation index gives the metallic initial attack a
    // warmer tail. A slightly detuned carrier adds gentle beating.
    const antiAlias = Math.min(1, sampleRate / (hz * 16));
    const index = antiAlias * (.18 + 2.1 * Math.pow(Math.max(.05, velocity) / .62, .6) *
      Math.exp(-time * .8 / (decaySec * .17)));
    const fm = Math.sin(phase + index * Math.sin(2 * phase));
    const warm = Math.sin(phase * .9982);
    const tail = Math.max(0, Math.min(1, (DURATION_SECONDS * decaySec / .8 - time) / .035));
    return (.78 * fm + .22 * warm) * envelopeAt(time, decaySec, velocity, touch) * tail;
  }

  function makeElectricPianoSamples(hz, sampleRate, options = {}) {
    // The FM oscillator has no physical keyboard register. Its high carrier
    // retains a fundamental while the modulation index rolls off.
    if (!Number.isFinite(hz) || hz < 20 || hz > 5000 ||
        !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
        !Number.isFinite(options.decaySec ?? .8) || (options.decaySec ?? .8) < .12 ||
        (options.decaySec ?? .8) > 1.2 || !Number.isFinite(options.velocity ?? .62) ||
        (options.velocity ?? .62) < 0 || (options.velocity ?? .62) > 1 ||
        !["press", "tap"].includes(options.touch ?? "press")) {
      throw new RangeError("FM electric-piano pitch or sample rate outside supported range");
    }
    const seconds = DURATION_SECONDS * (options.decaySec ?? .8) / .8;
    const samples = new Float32Array(Math.ceil(sampleRate * seconds));
    // This is a teaching model, not a Yamaha/DX7 algorithm or patch.
    for (let i = 0; i < samples.length; i++) {
      samples[i] = sampleAt(i / sampleRate, hz, sampleRate, options);
    }
    return samples;
  }

  return Object.freeze({ DURATION_SECONDS, envelopeAt, sampleAt, makeElectricPianoSamples });
});
