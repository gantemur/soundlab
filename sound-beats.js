/* Two equal-amplitude sine waves and their ideal interference envelope.
 * Deterministic model shared by the educational plots and audio controls.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabBeats = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MIN_BASE_HZ = 120;
  const MAX_BASE_HZ = 1000;
  const MIN_GAP_HZ = 0;
  const MAX_GAP_HZ = 20;

  function validate(recipe) {
    if (!recipe || !Number.isFinite(recipe.baseHz) || !Number.isFinite(recipe.gapHz) ||
        recipe.baseHz < MIN_BASE_HZ || recipe.baseHz > MAX_BASE_HZ ||
        recipe.gapHz < MIN_GAP_HZ || recipe.gapHz > MAX_GAP_HZ) {
      throw new RangeError("Invalid beating frequencies");
    }
    return recipe;
  }

  function frequencies(recipe) {
    validate(recipe);
    return [recipe.baseHz, recipe.baseHz + recipe.gapHz];
  }

  function beatRate(recipe) {
    return validate(recipe).gapHz;
  }

  function envelopeAt(time, recipe) {
    validate(recipe);
    if (!Number.isFinite(time) || time < 0) throw new RangeError("Invalid beat time");
    return Math.abs(Math.cos(Math.PI * recipe.gapHz * time));
  }

  function sampleAt(time, recipe) {
    validate(recipe);
    if (!Number.isFinite(time) || time < 0) throw new RangeError("Invalid beat time");
    // (sin(2πf₁t) + sin(2πf₂t))/2 = sin(2πf̄t) cos(πΔft).
    return Math.sin(2 * Math.PI * (recipe.baseHz + recipe.gapHz / 2) * time) *
      Math.cos(Math.PI * recipe.gapHz * time);
  }

  function spectrumLines(recipe) {
    const [low, high] = frequencies(recipe);
    return low === high ? [{ hz: low, amplitude: 1 }] :
      [{ hz: low, amplitude: 0.5 }, { hz: high, amplitude: 0.5 }];
  }

  return Object.freeze({ MIN_BASE_HZ, MAX_BASE_HZ, MIN_GAP_HZ, MAX_GAP_HZ,
    validate, frequencies, beatRate, envelopeAt, sampleAt, spectrumLines });
});
