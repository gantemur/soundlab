/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * An original, small two-operator FM electric-piano model for Compose.
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

  function makeElectricPianoSamples(hz, sampleRate) {
    if (!Number.isFinite(hz) || hz < 110 || hz > 880 ||
        !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new RangeError("FM electric-piano pitch or sample rate outside supported range");
    }
    const samples = new Float32Array(Math.ceil(sampleRate * DURATION_SECONDS));
    // A falling 2:1 modulation index gives the metallic initial attack a
    // warmer tail. A very slightly detuned carrier adds gentle beating.
    // This is a teaching model, not a Yamaha/DX7 algorithm or patch.
    const antiAlias = Math.min(1, sampleRate / (hz * 16));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const phase = TAU * hz * t;
      const index = antiAlias * (0.18 + 2.1 * Math.exp(-t / .17));
      const fm = Math.sin(phase + index * Math.sin(2 * phase));
      const warm = Math.sin(phase * .9982);
      const amplitude = (1 - Math.exp(-t / .0035)) *
        (.61 * Math.exp(-t / .72) + .27 * Math.exp(-t / 2.1));
      const tail = Math.max(0, Math.min(1, (DURATION_SECONDS - t) / .035));
      samples[i] = (.78 * fm + .22 * warm) * amplitude * tail;
    }
    return samples;
  }

  return Object.freeze({ DURATION_SECONDS, makeElectricPianoSamples });
});
