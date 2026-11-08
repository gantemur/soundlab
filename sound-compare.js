/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * C1/C2: two independent local PCM sources, paired spectral inspection and listening.
 */
(function (root, factory) {
  "use strict";
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./sound-wave-reader.js") : root.SoundLabWaveReader,
    node ? require("./sound-analysis-dsp.js") : root.SoundLabAnalysisDSP,
    node ? require("./sound-analysis-examples.js") : root.SoundLabAnalysisExamples);
  if (node) module.exports = api;
  if (root) root.SoundLabCompare = api;
})(typeof window !== "undefined" ? window : null, function (reader, dsp, examples) {
  "use strict";

  const MAX_TOTAL_PCM_BYTES = 64 * 1024 * 1024;
  const DEFAULTS = Object.freeze({ A: "reference-sine-440", B: "model-guitar-a3" });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const fmt = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)).toString() : "—";
  const safeName = name => String(name || "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 180);
  const totalBytes = pcm => pcm?.channels?.reduce((total, channel) => total + channel.byteLength, 0) || 0;
  const DIFFERENCE_FLOOR_DB = -90;
  // The overlay retains each FFT's own Hz/bin and Nyquist limit. A dB offset is
  // applied only to the optional display, never to the underlying PCM/spectrum.
  function overlayModel(slots, { maxHz = null, axis = "log", normalize = false } = {}) {
    const series = ["A", "B"].flatMap(key => {
      const { pcm, spectrum } = slots[key] || {};
      return pcm && spectrum?.magnitudes?.length && spectrum.binHz > 0 && pcm.sampleRate > 0 ?
        [{ key, pcm, spectrum, nyquist: pcm.sampleRate / 2 }] : [];
    });
    if (!series.length) return null;
    const high = Math.min(Number.isFinite(maxHz) && maxHz > 0 ? maxHz : Infinity,
      Math.max(...series.map(s => s.nyquist)));
    const low = axis === "log" ? Math.min(20, high / 2) : 0;
    if (!(high > low)) return null;
    const traces = series.map(item => {
      const { spectrum, nyquist } = item, last = Math.min(spectrum.magnitudes.length - 1,
        Math.floor(Math.min(high, nyquist) / spectrum.binHz + 1e-9));
      const first = Math.max(0, Math.ceil(low / spectrum.binHz));
      let peak = 0;
      for (let i = first; i <= last; i++) {
        const mag = spectrum.magnitudes[i];
        if (Number.isFinite(mag) && mag > peak) peak = mag;
      }
      return { ...item, first, last, peak, referenceDb: normalize && peak > 1e-5 ? 20 * Math.log10(peak) : 0,
        windowMs: 1000 * spectrum.fftSize / item.pcm.sampleRate };
    });
    return { low, high, axis, normalize, traces };
  }

  // Match the two *physical Hann durations* to within one sample at each rate.
  // The original C2a overlay continues to show native equal-sample windows;
  // this separate comparison never changes the source or its native spectra.
  function matchedSpectra(slots, fftSamples = 4096) {
    const a = slots.A, b = slots.B;
    if (!a?.pcm || !b?.pcm || !a.pcm.channels?.[a.channel] || !b.pcm.channels?.[b.channel]) return null;
    if (![1024, 4096, 16384].includes(fftSamples)) return null;
    const seconds = fftSamples / Math.max(a.pcm.sampleRate, b.pcm.sampleRate);
    const build = slot => dsp.spectrumAtDuration(slot.pcm.channels[slot.channel], slot.pcm.sampleRate,
      slot.cursor, seconds);
    return { A: build(a), B: build(b), sampleRateA: a.pcm.sampleRate,
      sampleRateB: b.pcm.sampleRate, seconds, fftSamples };
  }

  // Interpolate spectral *power* in Hz (never interpolate dB values or treat
  // unequal bin numbers as matching frequencies). Taking its square root
  // gives a continuous amplitude estimate on the shared physical Hz axis.
  // Neither display is phase-coherent subtraction or a transfer function.
  function powerAt(spectrum, hz) {
    if (!spectrum || !Number.isFinite(hz) || hz < 0 || hz >
        (spectrum.magnitudes.length - 1) * spectrum.binHz) return null;
    const position = hz / spectrum.binHz, lower = Math.floor(position);
    const upper = Math.min(spectrum.magnitudes.length - 1, lower + 1), fraction = position - lower;
    const a = spectrum.magnitudes[lower], b = spectrum.magnitudes[upper];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return (1 - fraction) * a * a + fraction * b * b;
  }
  function bestVisibleDb(spectrum, low, high) {
    let peak = 0;
    for (let i = Math.max(0, Math.ceil(low / spectrum.binHz));
      i < spectrum.magnitudes.length && i * spectrum.binHz <= high; i++) {
      peak = Math.max(peak, spectrum.magnitudes[i]);
    }
    return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  }
  function differenceModel(matched, { axis = "log", maxHz = null, normalize = false,
    measure = "amplitude", floorDb = DIFFERENCE_FLOOR_DB } = {}) {
    if (!matched?.A || !matched?.B) return null;
    const high = Math.min(matched.sampleRateA / 2, matched.sampleRateB / 2,
      Number.isFinite(maxHz) && maxHz > 0 ? maxHz : Infinity);
    const low = axis === "log" ? Math.min(20, high / 2) : 0;
    if (!(high > low)) return null;
    const aPeak = bestVisibleDb(matched.A, low, high), bPeak = bestVisibleDb(matched.B, low, high);
    return { ...matched, axis, low, high, normalize,
      measure: measure === "ratio" ? "ratio" : "amplitude", floorDb, aPeak, bPeak };
  }
  function differenceAt(model, hz) {
    if (!model || !Number.isFinite(hz) || hz < model.low || hz > model.high) return null;
    const powerA = powerAt(model.A, hz), powerB = powerAt(model.B, hz);
    if (powerA === null || powerB === null) return null;
    const dbA = powerA > 0 ? 10 * Math.log10(powerA) : -Infinity;
    const dbB = powerB > 0 ? 10 * Math.log10(powerB) : -Infinity;
    const rawA = Math.sqrt(powerA), rawB = Math.sqrt(powerB);
    const referenceA = model.normalize && Number.isFinite(model.aPeak) ? 10 ** (model.aPeak / 20) : 1;
    const referenceB = model.normalize && Number.isFinite(model.bPeak) ? 10 ** (model.bPeak / 20) : 1;
    const amplitudeA = rawA / referenceA, amplitudeB = rawB / referenceB;
    // A genuine signed amplitude difference is defined even if a source is
    // silent. The optional level-ratio view instead floors BOTH operands
    // before the logarithm; it remains continuous but is floor-limited near
    // silence. The floor applies after optional peak normalization.
    const floor = 10 ** (model.floorDb / 20);
    const floorLimited = model.measure === "ratio" && (amplitudeA < floor || amplitudeB < floor);
    const delta = model.measure === "ratio" ?
      20 * Math.log10(Math.max(amplitudeA, floor) / Math.max(amplitudeB, floor)) :
      amplitudeA - amplitudeB;
    return { hz, dbA, dbB, rawA, rawB, amplitudeA, amplitudeB,
      valid: true, floorLimited, delta };
  }
  // C2e: compare coarse RMS envelopes on a *seconds* grid, leaving native PCM untouched.
  // Tau is B time minus A time: the existing shared playback reads B(t + tau).
  const ALIGN_HOP_SECONDS = 0.01;
  const ALIGN_SECONDS = 12;
  const ALIGN_MAX_OFFSET_SECONDS = 2;
  function alignmentEnvelope(pcm, channel = 0, maxSeconds = ALIGN_SECONDS) {
    const samples = pcm?.channels?.[channel], rate = pcm?.sampleRate;
    if (!samples || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(maxSeconds) ||
      maxSeconds <= 0) return null;
    const frames = Math.min(samples.length, Math.floor(maxSeconds * rate));
    const count = Math.floor(frames / (ALIGN_HOP_SECONDS * rate));
    if (count < 50) return null;
    const rms = new Float64Array(count);
    let peak = 0;
    for (let i = 0; i < count; i++) {
      const from = Math.round(i * ALIGN_HOP_SECONDS * rate);
      const to = Math.min(frames, Math.round((i + 1) * ALIGN_HOP_SECONDS * rate));
      let sum = 0;
      for (let j = from; j < to; j++) {
        const value = samples[j];
        if (!Number.isFinite(value)) return null;
        sum += value * value;
      }
      const value = Math.sqrt(sum / Math.max(1, to - from));
      rms[i] = value;
      peak = Math.max(peak, value);
    }
    if (!(peak > 1e-6)) return null;
    // Square-root compression makes quieter attacks count without a log noise floor.
    const features = new Float64Array(count);
    let mean = 0;
    for (let i = 0; i < count; i++) {
      let sum = 0, weight = 0;
      for (let k = -2; k <= 2; k++) {
        const j = i + k;
        if (j < 0 || j >= count) continue;
        const w = 3 - Math.abs(k);
        sum += w * rms[j]; weight += w;
      }
      features[i] = Math.sqrt(Math.max(0, sum / weight / peak));
      mean += features[i];
    }
    mean /= count;
    let variance = 0;
    for (const value of features) variance += (value - mean) ** 2;
    const deviation = Math.sqrt(variance / count);
    // A steady sine has virtually constant energy: its phase is not a time marker.
    return { features, deviation, sampleCount: frames, rate };
  }
  function estimateTimeOffset(pcmA, pcmB, { channelA = 0, channelB = 0,
    maxSeconds = ALIGN_SECONDS, maxOffsetSeconds = ALIGN_MAX_OFFSET_SECONDS } = {}) {
    const a = alignmentEnvelope(pcmA, channelA, maxSeconds);
    const b = alignmentEnvelope(pcmB, channelB, maxSeconds);
    if (!a || !b || a.deviation < 0.07 || b.deviation < 0.07) {
      return { ok: false, reason: "noPattern" };
    }
    const A = a.features, B = b.features;
    const limit = Math.min(200, Math.floor(Math.max(0, maxOffsetSeconds) / ALIGN_HOP_SECONDS));
    const minOverlap = Math.max(40, Math.ceil(0.55 * Math.min(A.length, B.length)));
    const results = [];
    for (let shift = -limit; shift <= limit; shift++) {
      // Compare A(t) with B(t+tau), so positive tau skips B's beginning.
      const from = Math.max(0, -shift), end = Math.min(A.length, B.length - shift);
      const count = end - from;
      if (count < minOverlap) continue;
      let sumA = 0, sumB = 0, sumAA = 0, sumBB = 0, sumAB = 0;
      for (let i = from; i < end; i++) {
        const x = A[i], y = B[i + shift];
        sumA += x; sumB += y; sumAA += x * x; sumBB += y * y; sumAB += x * y;
      }
      const varA = sumAA - sumA * sumA / count, varB = sumBB - sumB * sumB / count;
      if (varA < 1e-5 || varB < 1e-5) continue;
      const correlation = Math.max(-1, Math.min(1,
        (sumAB - sumA * sumB / count) / Math.sqrt(varA * varB)));
      // Avoid favoring tiny overlaps that happen to contain one matching event.
      const overlapWeight = Math.sqrt(count / Math.min(A.length, B.length));
      results.push({ shift, score: correlation * overlapWeight, correlation, overlap: count * ALIGN_HOP_SECONDS });
    }
    if (!results.length) return { ok: false, reason: "noPattern" };
    results.sort((x, y) => y.score - x.score);
    const best = results[0];
    // Ignore adjacent 10ms candidates; they reflect the same broad peak.
    const second = results.find(item => Math.abs(item.shift - best.shift) >= 12);
    // In a repeating rhythm, a distant lag can correlate almost perfectly
    // despite a shorter overlap; this is not a unique alignment.
    const repeated = results.some(item => Math.abs(item.shift - best.shift) >= 20 &&
      item.correlation >= 0.94 && item.overlap >= Math.max(0.8, 0.65 * best.overlap));
    const margin = second ? best.score - second.score : best.score;
    if (Math.abs(best.shift) >= limit - 2) return { ok: false, reason: "edge", score: best.score };
    if (best.correlation < 0.78 || best.score < 0.73)
      return { ok: false, reason: "weak", score: best.score };
    if (margin < 0.055 || repeated) return { ok: false, reason: "ambiguous", score: best.score, margin };
    const confidence = best.correlation >= 0.94 && best.score >= 0.90 && margin >= 0.12 ?
      "high" : "moderate";
    return { ok: true, offset: best.shift * ALIGN_HOP_SECONDS,
      score: best.score, correlation: best.correlation, margin, confidence,
      resolution: ALIGN_HOP_SECONDS, analyzedSeconds: Math.min(maxSeconds,
        pcmA.duration || A.length * ALIGN_HOP_SECONDS, pcmB.duration || B.length * ALIGN_HOP_SECONDS) };
  }

  // Shared time t follows A. Sound B is heard at native source time t + tau;
  // positive tau skips B's initial samples, negative tau delays its entrance.
  // Scheduling uses AudioBufferSourceNode offsets, not modified/resampled PCM.
  function sharedDuration(durationA, durationB, tau = 0) {
    if (![durationA, durationB, tau].every(Number.isFinite)) return 0;
    return Math.max(0, durationA, durationB - tau);
  }
  function sharedStart(duration, time, tau = 0) {
    if (!(duration > 0) || !Number.isFinite(time) || !Number.isFinite(tau) || time < 0) return null;
    const localTime = time + tau;
    if (localTime >= duration) return null;
    return { delay: Math.max(0, -localTime), offset: Math.max(0, localTime) };
  }
  const words = {
    en: {
      title: "Compare two sounds", intro: "Choose A and B independently; compare waveforms, spectra and listening.",
      spectrumTab: "Spectrum", spectrogramTab: "Spectrogram", compareTab: "Compare",
      kindSingle: "Single source", kindCompare: "Compare", kindModes: "Analysis sub-tabs", masterVolume: "Master listening volume",
      volumeHint: "A/B volume is multiplied by the master level; neither changes the measured samples or spectra.",
      sourceA: "Sound A", sourceB: "Sound B", classLabel: "Class", exampleLabel: "Example",
      open: "Open WAV…", mic: "Microphone…", fromAnalysis: "Use current Analysis sound",
      playA: "▶ Play A", playB: "▶ Play B", stopA: "Ⅱ Stop A", stopB: "Ⅱ Stop B",
      volume: "Listening volume", channel: "Analysis channel", settings: "Comparison settings",
      syncTitle: "Compare by listening", syncIntro: "Listen to A/B on one timeline, mix them, or automatically alternate short excerpts.",
      syncModes: "Shared listening modes", syncModeA: "A", syncModeB: "B", syncModeBoth: "Together", syncModeAuto: "Auto A/B",
      syncSwitchPeriod: "Switch every", syncReplay: "Replay the excerpt on every turn",
      syncAutoHelpReplay: "A and B each replay the same short interval from the selected starting time (B offset included). Even a quickly fading pluck is heard at every B turn. Playback loops until paused.",
      syncAutoHelpTimeline: "A and B alternate along their original recordings without restarting. A fading pluck can become nearly silent in later B turns; playback ends with the shared timeline.",
      syncPlay: "▶ Play", syncPause: "Ⅱ Pause", syncPosition: "Shared playback position", syncExcerptStart: "Repeated excerpt starts at",
      syncTime: "{time} / {duration} s", syncOffset: "B time offset τ · s", syncOffsetReset: "Reset offset",
      syncOffsetHelp: "At shared time t, B plays at t + τ. Positive τ skips B's beginning; negative τ delays B. No phase alignment.",
      syncEstimate: "Estimate B offset", syncApplyEstimate: "Apply suggestion",
      syncEstimateHelp: "Looks for a shared pattern of loudness changes in the first 12 s, searching ±2 s in steps of 0.01 s. Best for two recordings of the same event. Estimates are not phase alignment and never alter the sound.",
      syncEstimating: "Checking both amplitude envelopes…",
      syncEstimateSuggested: "Suggested τ = {offset} s · {confidence} match (envelope correlation {score}). Press Apply to use it.",
      syncEstimateApplied: "Applied τ = {offset} s. You can still adjust the offset manually.",
      syncConfidenceHigh: "strong", syncConfidenceModerate: "tentative",
      syncEstimateNoPattern: "No reliable alignment: at least one sound lacks distinctive changes over time (such as a steady tone).",
      syncEstimateWeak: "No reliable alignment: the two amplitude patterns do not match closely enough.",
      syncEstimateAmbiguous: "No reliable alignment: several offsets fit similarly well, as with repeating patterns.",
      syncEstimateEdge: "No reliable alignment within ±2 s. Try adjusting the offset manually.",
      syncReady: "Choose A, B, Together or Auto A/B, then play.", syncStarting: "Preparing aligned playback…",
      syncPlaying: "Playing {mode}. Switch modes without restarting.", syncPaused: "Paused at {time} s.",
      syncAutoPlayingReplay: "Auto A/B: repeating {period} s excerpts from {time} s. Pause to stop the loop.",
      syncAutoPlayingTimeline: "Auto A/B: switching every {period} s on the original timeline.",
      syncPausedExcerpt: "Paused. The next excerpt begins at {time} s.",
      syncError: "Shared playback could not start; both sources remain available for analysis.",
      syncMixHint: "Uses the separate A/B volume sliders and master volume. Together mixes each at half gain for headroom. Blue waveform markers show the shared playhead; orange markers remain inspection cursors.",
      fftSize: "FFT window · samples", axis: "Frequency axis", linear: "Linear", log: "Logarithmic",
      maxHz: "Upper frequency", nyquist: "Full range (Nyquist)", visualTitle: "Waveform",
      individualSpectra: "Show individual spectra", individualSpectrum: "Spectrum",
      individualHint: "Separate A/B spectra are supplementary; the overlay above is the main comparison.",
      cursor: "Inspection time · s", noSource: "Choose a source", loading: "Preparing sound…",
      ready: "Ready to compare.", stopped: "Stopped.", starting: "Preparing playback…",
      playing: "Playing", noAnalysis: "No Analysis sound is available to copy.",
      invalid: "Unsupported or malformed WAV; previous source kept.",
      limit: "Combined A+B decoded audio exceeds 64 MiB, or an input exceeds its WAV limits. Previous source kept.",
      nonfinite: "Source contains invalid/nonfinite samples; previous source kept.",
      unavailable: "This example is unavailable. Previous source kept.",
      unsupported: "This source or format is unsupported. Previous source kept.",
      generic: "Could not prepare the sound. Previous source kept.",
      playbackError: "Could not play this source/rate. Analysis remains available.",
      generated: "Generated signal", modeled: "Modeled instrument", recorded: "Real recording",
      imported: "Your local WAV", prepared: "Sound Lab WAV", microphone: "Microphone capture",
      localClass: "Local file", micClass: "Microphone capture", mono: "Mono", left: "Left", right: "Right",
      micRolling: "Recent microphone input (up to 30 s)", micTake: "Deliberately recorded microphone take",
      localHint: "Audio remains on this device; it is not uploaded.",
      sourceInfo: "{duration} s · {rate} Hz · {channels}",
      measure: "Peak {peak} · RMS {rms}",
      cursorInfo: "Cursor {time} s · source duration {duration} s · amplitude scale ±{scale}",
      spectrumInfo: "Hann {fft} · {bin} Hz/bin · strongest displayed bin {peak} Hz ({level} dBFS); not a pitch estimate",
      spectrumSilent: "Hann {fft} · {bin} Hz/bin · no significant peak",
      overlayTitle: "Spectral comparison A/B", overlayIntro: "Overlay the spectra, subtract their amplitudes, or inspect their level ratio without resampling the sound.",
      linkCursors: "Link inspection times (using B offset)", normalizeOverlay: "Normalize each displayed spectral peak",
      overlayNote: "Native Hann windows use the same sample count but may span different times. Peak normalization affects only this overlay, not the source audio or the two separate spectra.",
      overlayWaiting: "Choose two sounds to compare their spectra.",
      overlayInfo: "{scale} · A: {a} · B: {b}{missing}",
      overlayAbsolute: "Original levels (dBFS)", overlayRelative: "Each displayed peak = 0 dB",
      overlayWindow: "{ms} ms Hann · {bin} Hz/bin · cursor {time} s",
      overlayUnavailable: "no source", overlayMissing: " · above {hz} Hz, only the higher-rate source has samples",
      overlayAria: "Two spectra with shared frequency and level axes",
      plotModes: "Spectral comparison views", overlayMode: "Overlay A/B", differenceMode: "Difference A−B", ratioMode: "Level ratio (dB)",
      differenceTitle: "Signed spectral-amplitude difference", differenceIntro: "|A| − |B|: positive where A has more spectral amplitude, negative where B has more. The line stays continuous.",
      ratioTitle: "Spectral level ratio (dB)", ratioIntro: "10 log₁₀(PA/PB): positive where A is stronger. A documented floor keeps this view continuous near silence.",
      differenceAxis: "|A| − |B| · amplitude", ratioAxis: "A/B · dB",
      differenceNormalize: "Compare shape (align matched spectral peaks)",
      differenceProbeLabel: "Inspect frequency · Hz", differenceAria: "Continuous signed difference of spectral amplitudes A minus B", ratioAria: "Continuous spectral level ratio A over B in decibels",
      differenceWaiting: "Choose two sounds to calculate the A−B difference.",
      differenceInfo: "Shared band {low}–{high} Hz · paired Hann {ms} ms · A: {aSamples} samples at {aRate} Hz ({aBins} Hz/FFT bin) · B: {bSamples} samples at {bRate} Hz ({bBins} Hz/FFT bin)",
      differenceNote: "Each source uses a centered Hann window of approximately equal real duration. Squared amplitudes are interpolated at matching Hz, then square-rooted before subtraction; no low-level points are removed. FFT zero-padding samples the axis more densely but adds no physical resolution. This subtracts spectral magnitudes, NOT complex Fourier transforms or waveforms. Manual offset affects linked inspection times, not phase alignment or acoustic dB SPL.",
      ratioNote: "This view subtracts decibel levels, equivalently 10 log₁₀(PA/PB). A −90 dB floor is applied to EACH amplitude (after optional peak normalization) before taking the logarithm, so the plotted ratio is continuous and finite. Near silence it is floor-limited, not a precise physical ratio; both inaudible components approach zero difference. Manual offset does not imply phase alignment, a transfer function or acoustic dB SPL.",
      differenceAbsolute: "Original spectral amplitudes (linear units)", differenceRelative: "Peak-relative spectral shapes (display only)",
      ratioAbsolute: "Original spectral levels with −90 dBFS floor", ratioRelative: "Peak-relative levels with −90 dB floor",
      differencePadding: "Hann windows extend beyond a recording: {a} A samples and {b} B samples treated as silence; inspect farther from the edges for a complete window.",
      differenceProbe: "{hz} Hz · |A| {a} · |B| {b} · A−B {delta}{mode}",
      ratioProbe: "{hz} Hz · A {a} dBFS · B {b} dBFS · A/B {delta} dB{mode}{limit}",
      ratioFloorHint: " (floor-limited)", differenceProbeRelative: " (peak-relative)",
      differenceProbeRange: "Enter a frequency inside the shared {low}–{high} Hz range.",
      differenceNoBand: "There is no shared frequency range for these two recordings.",
      differenceContinuous: "The vertical amplitude scale fits this pair; the line includes every frequency in the shared band.",
      ratioClipped: "The chart shows −90…+90 dB (clipped); the frequency probe is not clipped. Floor-limited ratios are only indicative.",
      disclaimer: "The overlay shows native equal-sample Hann spectra at their original dBFS levels. Difference A−B subtracts paired-window magnitudes, while Level ratio uses their dB ratio with a floor. Manual B offset affects shared playback and linked cursors; there is no automatic or phase alignment, or resampling of audio. This is not acoustic dB SPL."
    },
    mn: {
      title: "Хоёр авиаг харьцуулах", intro: "A ба B авиаг тусад нь сонгож, долгион, спектр болон сонсголыг харьцуулаарай.",
      spectrumTab: "Спектр", spectrogramTab: "Спектрограмм", compareTab: "Харьцуулах",
      kindSingle: "Нэг авиа", kindCompare: "Харьцуулах", kindModes: "Шинжилгээний хэсэг", masterVolume: "Нийт сонсох дууны хэмжээ",
      volumeHint: "A/B-ийн хэмжээ нийт хэмжээтэй үржигдэнэ; эх сорьц, спектрийн хэмжилт өөрчлөгдөхгүй.",
      sourceA: "Эх авиа A", sourceB: "Эх авиа B", classLabel: "Бүлэг", exampleLabel: "Жишээ",
      open: "WAV нээх…", mic: "Микрофон…", fromAnalysis: "Шинжлэх хэсгийн авиаг авах",
      playA: "▶ A тоглуулах", playB: "▶ B тоглуулах", stopA: "Ⅱ A зогсоох", stopB: "Ⅱ B зогсоох",
      volume: "Сонсох дууны хэмжээ", channel: "Шинжлэх суваг", settings: "Харьцуулах тохиргоо",
      syncTitle: "Харьцуулж сонсох", syncIntro: "A/B-г нэг хугацаанд сонсох, хамт тоглуулах эсвэл богино хэсгүүдээр ээлжлэн харьцуулах боломжтой.",
      syncModes: "Нэгдсэн сонсох горим", syncModeA: "A", syncModeB: "B", syncModeBoth: "Хамт", syncModeAuto: "A/B ээлжлэх",
      syncSwitchPeriod: "Солих хугацаа", syncReplay: "Ээлж бүрд нэг хэсгийг эхнээс нь тоглуулах",
      syncAutoHelpReplay: "Сонгосон мөчөөс эхлэх богино хэсгийг A, B дээр дахин дахин ээлжлэн тоглуулна (B-ийн зөрүү үйлчилнэ). Гитарын эхний цохилт B-ийн ээлж бүрд сонсогдоно. Түр зогсоох хүртэл давтана.",
      syncAutoHelpTimeline: "A ба B-г эх бичлэгийн хугацаагаар ээлжлэн сонсоно; дахин эхлүүлэхгүй. Хурдан намжих хөгжим B-ийн сүүлийн ээлжүүдэд сонсогдохгүй байж болно. Нэгдсэн хугацааны төгсгөлд зогсоно.",
      syncPlay: "▶ Тоглуулах", syncPause: "Ⅱ Түр зогсоох", syncPosition: "Нэгдсэн тоглуулах байрлал", syncExcerptStart: "Давтах хэсгийн эхлэл",
      syncTime: "{time} / {duration} сек", syncOffset: "B-ийн хугацааны зөрүү τ · сек", syncOffsetReset: "Зөрүүг тэглэх",
      syncOffsetHelp: "Нэгдсэн t мөчид B-ийн t + τ мөчийг сонсоно. Эерэг τ B-ийн эхийг алгасна; сөрөг τ B-г хойшлуулна. Фазыг тааруулахгүй.",
      syncEstimate: "B-ийн зөрүүг тооцох", syncApplyEstimate: "Саналын дагуу тааруулах",
      syncEstimateHelp: "Эхний 12 секундийн дууны эрчмийн өөрчлөлтийг харьцуулж, ±2 сек дотор 0.01 сек алхмаар хайна. Нэг үйл явдлын хоёр бичлэгт тохиромжтой. Фазыг тааруулахгүй, эх авиаг өөрчлөхгүй.",
      syncEstimating: "Хоёр авианы эрчмийн хэлбэрийг шалгаж байна…",
      syncEstimateSuggested: "Санал болгосон τ = {offset} сек · {confidence} тохирол (эрчмийн хэлбэрийн хамаарал {score}). Хэрэглэх бол товчийг дарна уу.",
      syncEstimateApplied: "τ = {offset} сек зөрүүг хэрэглэв. Гараар дахин тохируулж болно.",
      syncConfidenceHigh: "сайн", syncConfidenceModerate: "болзолтой",
      syncEstimateNoPattern: "Найдвартай зөрүү олдсонгүй: дор хаяж нэг авианд ялгарах хугацааны өөрчлөлт байхгүй (жишээ нь тогтмол өнгө).",
      syncEstimateWeak: "Найдвартай зөрүү олдсонгүй: хоёр авианы эрчмийн өөрчлөлт хангалттай төстэй биш.",
      syncEstimateAmbiguous: "Найдвартай зөрүү олдсонгүй: давтагдах хэмнэл мэт хэд хэдэн зөрүү ойролцоо таарч байна.",
      syncEstimateEdge: "±2 сек дотроос найдвартай зөрүү олдсонгүй. Гараар тохируулж үзнэ үү.",
      syncReady: "A, B, Хамт эсвэл A/B ээлжлэх горим сонгоод тоглуулаарай.", syncStarting: "Тааруулсан авиануудыг бэлтгэж байна…",
      syncPlaying: "{mode} горимоор сонсож байна. Дахин эхлүүлэхгүйгээр сольж болно.", syncPaused: "{time} сек дээр түр зогслоо.",
      syncAutoPlayingReplay: "A/B ээлжлэх: {time} сек-ээс {period} сек хэсгийг давтаж байна. Түр зогсоож дуусгана.",
      syncAutoPlayingTimeline: "A/B ээлжлэх: эх хугацааны тэнхлэг дээр {period} сек тутам солино.",
      syncPausedExcerpt: "Түр зогслоо. Дараагийн хэсэг {time} сек-ээс эхэлнэ.",
      syncError: "Нэгдсэн сонсголыг эхлүүлж чадсангүй; хоёр авианы шинжилгээ хэвээр.",
      syncMixHint: "A/B-ийн өөрийн хэмжээ болон нийт хэмжээг хэрэглэнэ. Хамт сонсоход хоёр сувгийн хэмжээг тус бүрд нь хагаслаж нөөц үлдээнэ. Хөх шугам нь нэгдсэн тоглуулах, улбар шар нь шинжлэх курсор.",
      fftSize: "FFT цонхны урт · сорьц", axis: "Давтамжийн тэнхлэг", linear: "Шугаман", log: "Логарифмын",
      maxHz: "Дээд давтамж", nyquist: "Бүх давтамж (Найквист)", visualTitle: "Долгионы хэлбэр",
      individualSpectra: "Тус бүрийн спектрийг харах", individualSpectrum: "Спектр",
      individualHint: "A ба B-ийн тусдаа спектрүүд нэмэлт лавлагаа болно; гол харьцуулалт дээд талын давхарласан зурагт байна.",
      cursor: "Шинжлэх хугацаа · сек", noSource: "Авиа сонгоно уу", loading: "Авиаг бэлтгэж байна…",
      ready: "Харьцуулахад бэлэн.", stopped: "Зогслоо.", starting: "Тоглуулахаар бэлтгэж байна…",
      playing: "Тоглож байна", noAnalysis: "Шинжлэх хэсэгт хуулах авиа алга.",
      invalid: "WAV буруу эсвэл дэмжигдээгүй. Өмнөх авиа хэвээр үлдлээ.",
      limit: "A+B задарсан авианы нийлбэр 64 МиБ-аас, эсвэл нэг WAV өөрийн хязгаараас хэтэрсэн. Өмнөх авиа хэвээр.",
      nonfinite: "Авианы сорьцын утга буруу байна. Өмнөх авиа хэвээр.",
      unavailable: "Энэ жишээг ачаалж чадсангүй. Өмнөх авиа хэвээр.",
      unsupported: "Энэ авиа эсвэл кодлол дэмжигдэхгүй. Өмнөх авиа хэвээр.",
      generic: "Авиаг бэлтгэж чадсангүй. Өмнөх авиа хэвээр.",
      playbackError: "Энэ авиа/сорьцлолтыг тоглуулж чадсангүй. Шинжлэх боломж хэвээр.",
      generated: "Тооцоолж үүсгэсэн авиа", modeled: "Хөгжмийн загвар", recorded: "Бодит бичлэг",
      imported: "Таны WAV файл", prepared: "Sound Lab-ийн WAV", microphone: "Микрофоны бичлэг",
      localClass: "Төхөөрөмжийн файл", micClass: "Микрофоны бичлэг", mono: "Моно", left: "Зүүн", right: "Баруун",
      micRolling: "Микрофоны сүүлийн 30 сек хүртэлх бичлэг", micTake: "Микрофоноор тусгайлан бичсэн авиа",
      localHint: "Авиа зөвхөн таны төхөөрөмжид байна; серверт илгээхгүй.",
      sourceInfo: "{duration} сек · {rate} Гц · {channels}",
      measure: "Оргил {peak} · RMS {rms}",
      cursorInfo: "Курсор {time} сек · урт {duration} сек · далайцын хуваарь ±{scale}",
      spectrumInfo: "Hann {fft} · алхам {bin} Гц · хамгийн хүчтэй зурвас {peak} Гц ({level} dBFS); нот тодорхойлохгүй",
      spectrumSilent: "Hann {fft} · алхам {bin} Гц · тод зурвас илрээгүй",
      overlayTitle: "A/B спектрийн харьцуулалт", overlayIntro: "Спектрүүдийг давхарлах, далайцуудыг хасах эсвэл түвшний харьцааг харах боломжтой. Эх авианы сорьцлолт өөрчлөгдөхгүй.",
      linkCursors: "Шинжлэх хугацааг (B-ийн зөрүүгээр) холбох", normalizeOverlay: "Харагдах спектр бүрийн оргилыг нормчлох",
      overlayNote: "Hann цонхны сорьцын тоо ижил боловч хугацааны урт өөр байж болно. Оргилын нормчлол нь зөвхөн энэ давхар зурагт нөлөөлнө; эх авиа, тусдаа спектрүүд өөрчлөгдөхгүй.",
      overlayWaiting: "Хоёр авиа сонгож, спектрүүдийг харьцуулаарай.",
      overlayInfo: "{scale} · A: {a} · B: {b}{missing}",
      overlayAbsolute: "Эх түвшин (dBFS)", overlayRelative: "Харагдах оргил бүр = 0 dB",
      overlayWindow: "Hann {ms} мс · {bin} Гц/алхам · курсор {time} сек",
      overlayUnavailable: "авиа байхгүй", overlayMissing: " · {hz} Гц-ээс дээш зөвхөн өндөр сорьцлолттой авиа",
      overlayAria: "Ижил давтамж, түвшний тэнхлэгтэй A/B спектр",
      plotModes: "Спектрийн харьцуулалтын хэлбэр", overlayMode: "A/B давхарлах", differenceMode: "Ялгаа A−B", ratioMode: "Түвшний харьцаа (дБ)",
      differenceTitle: "Спектрийн далайцын тэмдэгтэй ялгаа", differenceIntro: "|A| − |B|: эерэг бол A, сөрөг бол B-ийн далайц их. Бүх давтамжид тасралтгүй муруй гарна.",
      ratioTitle: "Спектрийн түвшний харьцаа (дБ)", ratioIntro: "10 log₁₀(PA/PB): эерэг бол A хүчтэй. Сул дохионд тодорхой босго тавьж, муруйг тасралтгүй болгов.",
      differenceAxis: "|A| − |B| · далайц", ratioAxis: "A/B · дБ",
      differenceNormalize: "Хэлбэрийг харьцуулах (спектрийн оргилуудыг тааруулах)",
      differenceProbeLabel: "Шинжлэх давтамж · Гц", differenceAria: "A хасах B спектрийн далайцын тасралтгүй тэмдэгтэй ялгаа", ratioAria: "A ба B спектрийн түвшний тасралтгүй харьцаа, децибел",
      differenceWaiting: "Спектрийн A−B ялгааг олохын тулд хоёр авиа сонгоорой.",
      differenceInfo: "Хамтын зурвас {low}–{high} Гц · Hann {ms} мс · A: {aSamples} сорьц, {aRate} Гц ({aBins} Гц/FFT алхам) · B: {bSamples} сорьц, {bRate} Гц ({bBins} Гц/FFT алхам)",
      differenceNote: "Хоёр авианы курсорын орчимд бараг ижил бодит хугацаатай Hann цонх авна. Ижил Гц цэгт далайцын квадратыг интерполяцлан язгуур авч, далайцуудыг хасна; сул утгыг нуухгүй. FFT-ийн тэгээр нөхөлт давтамжийг нягтруулах ч ялгах чадварыг нэмэхгүй. Энэ нь комплекс Фурье хувиргалтууд эсвэл долгионуудыг хассан хэрэг БИШ. Гарын зөрүү зөвхөн холбосон курсорт үйлчилнэ; фаз тааруулахгүй, акустик dB SPL биш.",
      ratioNote: "Энэ харагдацад децибел түвшнүүдийг хасна: 10 log₁₀(PA/PB). Логарифм авахын өмнө хоёр далайц бүрд −90 дБ босго (оргилд нормчилсон бол түүний дараа) хэрэглэснээр муруй тасралтгүй болно. Маш сул авиа дахь харьцаа босгоор хязгаарлагдсан, нарийн физик хэмжилт биш; хоёулаа сул бол ялгаа тэгт дөхнө. Гарын зөрүү нь фаз тааруулалт, дамжуулалтын функц эсвэл акустик dB SPL биш.",
      differenceAbsolute: "Эх спектрийн далайц (шугаман нэгж)", differenceRelative: "Оргилд харьцуулсан спектрийн хэлбэр (зөвхөн зураг)",
      ratioAbsolute: "Эх спектрийн түвшин, −90 dBFS босготой", ratioRelative: "Оргилд харьцуулсан түвшин, −90 дБ босготой",
      differencePadding: "Hann цонх бичлэгийн хязгаараас гарчээ: A-ийн {a}, B-ийн {b} сорьцыг тэгээр нөхөв. Бүрэн цонх үзэхийн тулд курсорыг дотогш шилжүүлээрэй.",
      differenceProbe: "{hz} Гц · |A| {a} · |B| {b} · A−B {delta}{mode}",
      ratioProbe: "{hz} Гц · A {a} dBFS · B {b} dBFS · A/B {delta} дБ{mode}{limit}",
      ratioFloorHint: " (босгоор хязгаарласан)", differenceProbeRelative: " (оргилд харьцуулсан)",
      differenceProbeRange: "Хамтын {low}–{high} Гц доторх давтамж оруулна уу.",
      differenceNoBand: "Хоёр бичлэгт давхцах давтамжийн зурвас байхгүй.",
      differenceContinuous: "Босоо далайцын хуваарь энэ хосод таарна; хамтын бүх давтамжийн утгыг холбов.",
      ratioClipped: "Графикт −90…+90 дБ (хязгаарласан); тоон утга хязгааргүй. Сул дохионы харьцаа зөвхөн ойролцоо.",
      disclaimer: "Давхарласан зурагт эх сорьцлолттой, ижил сорьцын тоотой Hann спектрүүдийн dBFS түвшнийг харуулна. Ялгаа A−B нь ижил хугацааны далайцуудыг хасна; Түвшний харьцаа нь босготой дБ харьцаа юм. Гарын B зөрүү нь нэгдсэн сонсгол, холбосон курсорт үйлчилнэ; автоматаар, фазаар тааруулахгүй, авиаг дахин сорьцлохгүй. Акустик dB SPL биш."
    }
  };

  class CompareError extends Error {
    constructor(code) { super(code); this.code = code; }
  }

  class Controller {
    constructor({ document, window, contextOwner, getAnalysis = () => null, onMic = () => {}, ...models }) {
      this.document = document; this.window = window; this.contextOwner = contextOwner;
      this.getAnalysis = getAnalysis; this.onMic = onMic; this.models = models;
      this.active = false; this.initialized = false; this.language = "mn";
      this.fftSize = 4096; this.axis = "log"; this.maxHz = 5000; this.volume = 1;
      this.linkCursors = false; this.normalizeOverlay = false;
      this.spectralView = "overlay"; this.normalizeDifference = false; this.matchedCache = null;
      this.slots = Object.fromEntries(["A", "B"].map(key => [key, {
        pcm: null, source: null, index: null, channel: 0, cursor: .25, volume: .2,
        classId: examples.CATALOGUE.find(entry => entry.id === DEFAULTS[key]).classId,
        exampleId: DEFAULTS[key], ticket: 0, busy: false, status: "ready", error: false, audioBuffer: null
      }]));
      this.voice = null; this.playingKey = null; this.playbackTicket = 0; this.startingKey = null;
      this.syncMode = "A"; this.syncOffset = 0; this.syncPosition = 0;
      this.syncSwitchPeriod = .6; this.syncReplay = true;
      this.syncVoice = null; this.syncStarting = false; this.syncStatus = "syncReady";
      this.alignmentResult = null; this.alignmentBusy = false; this.alignmentTicket = 0;
      for (const key of ["A", "B"]) {
        this.$(`compare${key}Class`).addEventListener("change", event => {
          const state = this.slots[key], category = event.target.value;
          if (![...examples.CLASSES.map(c => c.id), "local", "microphone"].includes(category)) return;
          state.classId = category;
          const first = examples.CATALOGUE.find(entry => entry.classId === category);
          if (first) { state.exampleId = first.id; void this.loadExample(key, first.id); }
          else this.renderPickers(key);
        });
        this.$(`compare${key}Example`).addEventListener("change", event => { void this.loadExample(key, event.target.value); });
        this.$(`compare${key}Open`).addEventListener("click", () => this.$(`compare${key}File`).click());
        this.$(`compare${key}File`).addEventListener("change", event => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (file) void this.openFile(key, file);
        });
        this.$(`compare${key}Mic`).addEventListener("click", () => this.onMic(key));
        this.$(`compare${key}FromAnalysis`).addEventListener("click", () => { void this.useAnalysis(key); });
        this.$(`compare${key}Play`).addEventListener("click", () => { void this.play(key); });
        this.$(`compare${key}Volume`).addEventListener("input", event => {
          const s = this.slots[key];
          s.volume = clamp(Number(event.target.value) || 0, 0, 100) / 100;
          this.put(`compare${key}VolumeValue`, Math.round(s.volume * 100) + "%");
          if (this.voice && this.playingKey === key) this.updateListeningGain();
          if (this.syncVoice) this.updateSyncGains();
        });
        this.$(`compare${key}Channel`).addEventListener("change", event => {
          const s = this.slots[key];
          if (!s.pcm) return;
          s.channel = clamp(Number(event.target.value) || 0, 0, s.pcm.channels.length - 1);
          void this.reindexChannel(key);
        });
        this.$(`compare${key}Cursor`).addEventListener("input", event => this.setCursor(key, Number(event.target.value)));
        this.$(`compare${key}Wave`).addEventListener("pointerdown", event => {
          const s = this.slots[key]; if (!s.pcm) return;
          const rect = event.target.getBoundingClientRect();
          this.setCursor(key, clamp((event.clientX - rect.left - 44) / Math.max(1, rect.width - 58), 0, 1) * s.pcm.duration);
        });
        this.$(`compare${key}Wave`).addEventListener("keydown", event => {
          const s = this.slots[key];
          if (!s.pcm || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const step = Math.max(1 / s.pcm.sampleRate, s.pcm.duration / (event.shiftKey ? 10 : 100));
          this.setCursor(key, event.key === "Home" ? 0 : event.key === "End" ? s.pcm.duration :
            s.cursor + (event.key === "ArrowRight" ? step : -step));
        });
      }
      this.$("compareVolume").addEventListener("input", event => {
        this.volume = clamp(Number(event.target.value) || 0, 0, 100) / 100;
        if (this.voice) this.updateListeningGain();
        if (this.syncVoice) this.updateSyncGains();
        this.put("compareVolumeValue", Math.round(this.volume * 100) + "%");
      });
      for (const mode of ["A", "B", "Both", "Auto"]) {
        this.$(`compareSyncMode${mode}`).addEventListener("click", () => {
          void this.setSyncMode(mode === "Both" ? "both" : mode === "Auto" ? "auto" : mode);
        });
      }
      this.$("compareSyncSwitchPeriod").addEventListener("change", event => {
        void this.setSyncAutoOptions(Number(event.target.value), this.syncReplay);
      });
      this.$("compareSyncReplay").addEventListener("change", event => {
        void this.setSyncAutoOptions(this.syncSwitchPeriod, Boolean(event.target.checked));
      });
      this.$("compareSyncPlay").addEventListener("click", () => { void this.playShared(); });
      this.$("compareSyncSeek").addEventListener("input", event => {
        this.put("compareSyncTime", this.text("syncTime", {
          time: fmt(Number(event.target.value), 2), duration: fmt(this.syncDuration(), 2)
        }));
      });
      this.$("compareSyncSeek").addEventListener("change", event => {
        void this.seekShared(Number(event.target.value));
      });
      this.$("compareSyncOffset").addEventListener("input", event => {
        this.$("compareSyncOffsetNumber").value = fmt(Number(event.target.value), 2);
      });
      this.$("compareSyncOffset").addEventListener("change", event => this.setSyncOffset(Number(event.target.value)));
      this.$("compareSyncOffsetNumber").addEventListener("change", event => this.setSyncOffset(Number(event.target.value)));
      this.$("compareSyncOffsetReset").addEventListener("click", () => this.setSyncOffset(0));
      this.$("compareSyncEstimate").addEventListener("click", () => { void this.estimateSyncOffset(); });
      this.$("compareSyncApplyEstimate").addEventListener("click", () => this.applySyncEstimate());
      this.$("compareLinkCursors").addEventListener("change", event => {
        this.linkCursors = Boolean(event.target.checked);
        if (this.linkCursors) {
          const anchor = this.slots.A.pcm ? "A" : this.slots.B.pcm ? "B" : null;
          if (anchor) this.setCursor(anchor, this.slots[anchor].cursor);
          else this.drawSpectral();
        } else this.drawSpectral();
      });
      this.$("compareNormalize").addEventListener("change", event => {
        this.normalizeOverlay = Boolean(event.target.checked);
        this.drawOverlay();
      });
      this.$("compareShowOverlay").addEventListener("click", () => this.setSpectralView("overlay"));
      this.$("compareShowDifference").addEventListener("click", () => this.setSpectralView("difference"));
      this.$("compareShowRatio").addEventListener("click", () => this.setSpectralView("ratio"));
      this.$("compareDifferenceNormalize").addEventListener("change", event => {
        this.normalizeDifference = Boolean(event.target.checked);
        this.drawDifference();
      });
      this.$("compareDifferenceHz").addEventListener("input", () => this.drawDifference());
      this.$("compareDifferenceSpectrum").addEventListener("pointerdown", event => {
        const model = this.currentDifferenceModel(), rect = event.target.getBoundingClientRect();
        if (!model || rect.width < 20) return;
        const fraction = clamp((event.clientX - rect.left - 44) / (rect.width - 58), 0, 1);
        const hz = model.axis === "log" ? model.low * (model.high / model.low) ** fraction : model.high * fraction;
        this.$("compareDifferenceHz").value = fmt(hz, 2);
        this.drawDifference();
      });
      this.$("compareDifferenceSpectrum").addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const model = this.currentDifferenceModel(); if (!model) return;
        event.preventDefault();
        const previous = Number(this.$("compareDifferenceHz").value);
        const current = Number.isFinite(previous) && previous >= model.low && previous <= model.high ? previous : model.low;
        const step = event.shiftKey ? 1 / 10 : 1 / 100;
        const hz = event.key === "Home" ? model.low : event.key === "End" ? model.high :
          model.axis === "log" ? current * (model.high / model.low) ** (event.key === "ArrowRight" ? step : -step) :
            current + (event.key === "ArrowRight" ? 1 : -1) * model.high * step;
        this.$("compareDifferenceHz").value = fmt(clamp(hz, model.low, model.high), 2);
        this.drawDifference();
      });
      this.$("compareIndividualDetails").addEventListener("toggle", () => {
        if (this.$("compareIndividualDetails").open) {
          this.drawSpectrum("A"); this.drawSpectrum("B");
        }
      });
      for (const id of ["compareFFT", "compareAxis", "compareMaxHz"]) this.$(id).addEventListener("change", () => {
        this.fftSize = Number(this.$("compareFFT").value);
        this.axis = this.$("compareAxis").value === "linear" ? "linear" : "log";
        this.maxHz = this.$("compareMaxHz").value === "all" ? null : Number(this.$("compareMaxHz").value);
        this.draw();
      });
      this.renderLanguage("mn");
    }

    $(id) { return this.document.getElementById(id); }
    text(key, replacements = {}) {
      return String(words[this.language][key] || words.en[key] || key)
        .replace(/\{(\w+)\}/g, (_, name) => replacements[name] ?? "");
    }
    put(id, value) { const element = this.$(id); if (element.textContent !== value) element.textContent = value; }
    async yieldTask() { return new Promise(resolve => this.window.setTimeout(resolve, 0)); }
    setActive(active) {
      if (this.active === active) { if (active) this.draw(); return; }
      this.active = active;
      if (!active) {
        for (const state of Object.values(this.slots)) {
          state.ticket++; state.busy = false;
          if (state.status === "loading" || state.status === "starting") state.status = "stopped";
        }
        this.stopPlayback(); this.invalidateEstimate();
      } else {
        if (!this.initialized) {
          this.initialized = true;
          for (const key of ["A", "B"]) void this.loadExample(key, DEFAULTS[key]);
        } else {
          for (const key of ["A", "B"]) if (!this.slots[key].pcm) {
            void this.loadExample(key, this.slots[key].exampleId || DEFAULTS[key]);
          }
        }
        this.render(); this.draw();
      }
    }
    options(id, entries, value) {
      const select = this.$(id);
      select.replaceChildren(...entries.map(([key, label]) => {
        const option = this.document.createElement("option"); option.value = key; option.textContent = label; return option;
      }));
      select.value = String(value);
    }
    renderPickers(key) {
      const s = this.slots[key], classes = examples.CLASSES.map(item => [item.id, item.title[this.language]]);
      if (s.source?.classId === "local") classes.push(["local", this.text("localClass")]);
      if (s.source?.classId === "microphone") classes.push(["microphone", this.text("micClass")]);
      const classId = classes.some(([id]) => id === s.classId) ? s.classId : s.source?.classId || classes[0][0];
      this.options(`compare${key}Class`, classes, classId);
      const entries = ["local", "microphone"].includes(classId) ?
        [[classId, s.source?.name || this.text("noSource")]] :
        examples.CATALOGUE.filter(entry => entry.classId === classId)
          .map(entry => [entry.id, entry.title[this.language]]);
      this.options(`compare${key}Example`, entries, entries.some(([id]) => id === s.exampleId) ? s.exampleId : entries[0]?.[0] || "");
    }
    renderLanguage(language) {
      this.language = language === "en" ? "en" : "mn";
      for (const element of this.document.querySelectorAll("[data-compare-i18n]")) {
        const label = this.text(element.getAttribute("data-compare-i18n"));
        if (element.textContent !== label) element.textContent = label;
      }
      for (const key of ["A", "B"]) {
        this.$(`compare${key}Wave`).setAttribute("aria-label", `${key}: ${this.text("visualTitle")}`);
        this.$(`compare${key}Spectrum`).setAttribute("aria-label", `${key}: ${this.text("visualTitle")} FFT`);
      }
      this.$("compareOverlaySpectrum").setAttribute("aria-label", this.text("overlayAria"));
      this.$("compareDifferenceSpectrum").setAttribute("aria-label", this.text(this.spectralView === "ratio" ? "ratioAria" : "differenceAria"));
      this.$("compareKindModes").setAttribute("aria-label", this.text("kindModes"));
      this.$("compareSpectralModes").setAttribute("aria-label", this.text("plotModes"));
      this.$("compareSyncModes").setAttribute("aria-label", this.text("syncModes"));
      this.options("compareSyncSwitchPeriod", [.3, .6, 1, 2].map(seconds =>
        [String(seconds), `${seconds} ${this.language === "en" ? "s" : "сек"}`]), this.syncSwitchPeriod);
      this.$("compareSyncOffset").setAttribute("aria-label", this.text("syncOffset"));
      this.$("compareSyncOffsetNumber").setAttribute("aria-label", this.text("syncOffset"));
      this.render();
      this.drawSpectral();
    }
    render() {
      for (const key of ["A", "B"]) this.renderSlot(key);
      this.renderShared();
      this.put("compareVolumeValue", Math.round(this.volume * 100) + "%");
      this.$("compareLinkCursors").checked = this.linkCursors;
      this.$("compareNormalize").checked = this.normalizeOverlay;
      this.$("compareDifferenceNormalize").checked = this.normalizeDifference;
      this.syncSpectralView();
    }
    syncSpectralView() {
      const overlay = this.spectralView === "overlay", ratio = this.spectralView === "ratio";
      this.$("compareOverlayView").hidden = !overlay;
      this.$("compareDifferenceView").hidden = overlay;
      this.put("compareDifferenceTitle", this.text(ratio ? "ratioTitle" : "differenceTitle"));
      this.put("compareDifferenceIntro", this.text(ratio ? "ratioIntro" : "differenceIntro"));
      this.put("compareDifferenceNote", this.text(ratio ? "ratioNote" : "differenceNote"));
      this.$("compareDifferenceSpectrum").setAttribute("aria-label", this.text(ratio ? "ratioAria" : "differenceAria"));
      for (const [id, selected] of [["compareShowOverlay", overlay],
        ["compareShowDifference", this.spectralView === "difference"], ["compareShowRatio", ratio]]) {
        const button = this.$(id);
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    }
    setSpectralView(view) {
      this.spectralView = ["difference", "ratio"].includes(view) ? view : "overlay";
      this.syncSpectralView();
      if (this.spectralView !== "overlay") this.drawDifference(); else this.drawOverlay();
    }
    renderSlot(key) {
      const s = this.slots[key], entry = examples.CATALOGUE.find(item => item.id === s.source?.exampleId);
      this.renderPickers(key);
      this.put(`compare${key}Badge`, s.source ? this.text(s.source.kind) : "");
      this.put(`compare${key}Name`, entry ? entry.title[this.language] : (s.source?.name || this.text("noSource")));
      const pcm = s.pcm;
      this.put(`compare${key}Info`, pcm ? this.text("sourceInfo", { duration: fmt(pcm.duration, 3),
        rate: fmt(pcm.sampleRate, 0), channels: pcm.channels.length === 2 ? "Stereo" : this.text("mono") }) : "");
      this.put(`compare${key}Description`, entry ? entry.description[this.language] +
        "" :
        s.source?.kind === "microphone" ? this.text(s.source.captureMode === "take" ? "micTake" : "micRolling") :
          s.source ? this.text("localHint") : "");
      const credit = entry?.credit;
      this.$(`compare${key}RecordingCredit`).hidden = !credit;
      if (credit) {
        const link = this.$(`compare${key}RecordingSource`), license = this.$(`compare${key}RecordingLicense`);
        link.href = credit.sourceUrl; link.textContent = credit.creator;
        license.href = credit.licenseUrl; license.textContent = credit.license;
      }
      const stereo = pcm?.channels.length === 2;
      this.$(`compare${key}ChannelField`).hidden = !stereo;
      this.options(`compare${key}Channel`, stereo ? [["0", this.text("left")], ["1", this.text("right")]] :
        [["0", this.text("mono")]], s.channel);
      this.$(`compare${key}Cursor`).disabled = !pcm || s.busy;
      if (pcm) {
        const input = this.$(`compare${key}Cursor`);
        input.max = String(pcm.duration); input.step = String(1 / pcm.sampleRate); input.value = String(s.cursor);
      }
      const playing = this.playingKey === key || this.startingKey === key;
      this.$(`compare${key}Play`).disabled = !pcm || s.busy;
      this.$(`compare${key}Play`).setAttribute("aria-pressed", String(playing));
      this.put(`compare${key}Play`, this.text(playing ? `stop${key}` : `play${key}`));
      this.put(`compare${key}VolumeValue`, Math.round(s.volume * 100) + "%");
      this.put(`compare${key}Status`, this.text(s.status));
      this.$(`compare${key}Status`).classList.toggle("error", s.error);
      this.$(`compare${key}Channel`).disabled = s.busy;
    }

    syncDuration() {
      return sharedDuration(this.slots.A.pcm?.duration || 0, this.slots.B.pcm?.duration || 0, this.syncOffset);
    }
    currentSyncPosition() {
      if (!this.syncVoice) return this.syncPosition;
      const voice = this.syncVoice;
      if (voice.repeat) return voice.position; // The seek control is the repeated excerpt's anchor.
      return clamp(voice.position + Math.max(0, voice.context.currentTime - voice.startTime), 0, this.syncDuration());
    }
    sharedMarkerTime() {
      const voice = this.syncVoice;
      if (!voice?.repeat) return this.currentSyncPosition();
      const elapsed = Math.max(0, voice.context.currentTime - voice.startTime);
      return clamp(voice.position + elapsed % voice.period, 0, this.syncDuration());
    }
    renderShared() {
      const ready = this.active && ["A", "B"].every(key => this.slots[key].pcm && !this.slots[key].busy);
      const duration = this.syncDuration(), time = this.currentSyncPosition();
      for (const mode of ["A", "B", "both", "auto"]) {
        const id = mode === "both" ? "Both" : mode === "auto" ? "Auto" : mode;
        const button = this.$(`compareSyncMode${id}`), selected = this.syncMode === mode;
        button.disabled = !ready;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
      const auto = this.syncMode === "auto", repeat = auto && this.syncReplay;
      this.$("compareSyncAutoControls").hidden = !auto;
      this.$("compareSyncSwitchPeriod").value = String(this.syncSwitchPeriod);
      this.$("compareSyncReplay").checked = this.syncReplay;
      this.put("compareSyncAutoHelp", this.text(repeat ? "syncAutoHelpReplay" : "syncAutoHelpTimeline"));
      const positionLabel = this.text(repeat ? "syncExcerptStart" : "syncPosition");
      this.put("compareSyncPositionLabel", positionLabel);
      this.$("compareSyncSeek").setAttribute("aria-label", positionLabel);
      const playing = Boolean(this.syncVoice || this.syncStarting);
      this.$("compareSyncPlay").disabled = !ready;
      this.$("compareSyncPlay").setAttribute("aria-pressed", String(playing));
      this.put("compareSyncPlay", this.text(playing ? "syncPause" : "syncPlay"));
      const seek = this.$("compareSyncSeek");
      seek.disabled = !ready;
      seek.max = String(Math.max(.01, duration));
      seek.value = String(time);
      this.put("compareSyncTime", this.text("syncTime", { time: fmt(time, 2), duration: fmt(duration, 2) }));
      this.$("compareSyncOffset").value = String(clamp(this.syncOffset, -2, 2));
      this.$("compareSyncOffsetNumber").value = String(this.syncOffset);
      this.$("compareSyncEstimate").disabled = !ready || this.alignmentBusy;
      const suggestion = this.alignmentResult, apply = this.$("compareSyncApplyEstimate");
      apply.hidden = !ready || !suggestion?.ok || Boolean(suggestion.applied);
      apply.disabled = !ready || this.alignmentBusy;
      const estimateKey = this.alignmentBusy ? "syncEstimating" : !suggestion ? null :
        suggestion.ok ? (suggestion.applied ? "syncEstimateApplied" : "syncEstimateSuggested") :
        ({ noPattern: "syncEstimateNoPattern", weak: "syncEstimateWeak",
          ambiguous: "syncEstimateAmbiguous", edge: "syncEstimateEdge" })[suggestion.reason] || "syncEstimateWeak";
      this.put("compareSyncEstimateResult", estimateKey ? this.text(estimateKey, {
        offset: (suggestion?.offset > 0 ? "+" : "") + fmt(suggestion?.offset || 0, 2),
        confidence: this.text(suggestion?.confidence === "high" ? "syncConfidenceHigh" : "syncConfidenceModerate"),
        score: fmt(suggestion?.correlation || 0, 2)
      }) : "");
      const status = this.syncStarting ? "syncStarting" : this.syncVoice ?
        auto ? (repeat ? "syncAutoPlayingReplay" : "syncAutoPlayingTimeline") : "syncPlaying" :
        this.syncStatus === "syncPaused" && repeat ? "syncPausedExcerpt" : this.syncStatus;
      this.put("compareSyncStatus", this.text(status, {
        mode: this.text(this.syncMode === "both" ? "syncModeBoth" : this.syncMode === "auto" ?
          "syncModeAuto" : `syncMode${this.syncMode}`), time: fmt(time, 2), period: fmt(this.syncSwitchPeriod, 1)
      }));
    }
    async setSyncMode(mode) {
      if (!["A", "B", "both", "auto"].includes(mode) || mode === this.syncMode) return;
      const previousAuto = this.syncMode === "auto";
      const restart = Boolean(this.syncVoice || this.syncStarting) && (previousAuto !== (mode === "auto"));
      const position = this.syncVoice?.repeat && mode !== "auto" ? this.sharedMarkerTime() : this.currentSyncPosition();
      this.syncMode = mode;
      if (restart) {
        this.stopPlayback(); this.syncPosition = clamp(position, 0, this.syncDuration());
        return this.playShared();
      }
      if (this.syncVoice) this.updateSyncGains();
      this.renderShared();
    }
    async setSyncAutoOptions(period, repeat) {
      if (![.3, .6, 1, 2].includes(period)) return;
      repeat = Boolean(repeat);
      if (period === this.syncSwitchPeriod && repeat === this.syncReplay) return;
      const wasPlaying = this.syncMode === "auto" && Boolean(this.syncVoice || this.syncStarting);
      const position = this.syncVoice?.repeat && !repeat ? this.sharedMarkerTime() : this.currentSyncPosition();
      this.syncSwitchPeriod = period; this.syncReplay = repeat;
      if (wasPlaying) {
        this.stopPlayback(); this.syncPosition = clamp(position, 0, this.syncDuration());
        return this.playShared();
      }
      this.renderShared();
    }
    invalidateEstimate() {
      this.alignmentTicket++;
      this.alignmentResult = null; this.alignmentBusy = false;
    }
    async estimateSyncOffset() {
      if (!this.active || this.alignmentBusy) return false;
      const a = this.slots.A, b = this.slots.B;
      if (!a.pcm || !b.pcm || a.busy || b.busy) return false;
      const pcmA = a.pcm, pcmB = b.pcm, channelA = a.channel, channelB = b.channel;
      const ticket = ++this.alignmentTicket;
      this.alignmentResult = null; this.alignmentBusy = true; this.renderShared();
      await this.yieldTask(); // Allow the checking status to paint before scanning local PCM.
      const result = estimateTimeOffset(pcmA, pcmB, { channelA, channelB });
      if (ticket !== this.alignmentTicket || !this.active ||
        a.pcm !== pcmA || b.pcm !== pcmB || a.channel !== channelA || b.channel !== channelB) return false;
      this.alignmentResult = { ...result, applied: false };
      this.alignmentBusy = false;
      this.renderShared();
      return result.ok;
    }
    applySyncEstimate() {
      const result = this.alignmentResult;
      if (!result?.ok || result.applied || this.alignmentBusy ||
        !this.slots.A.pcm || !this.slots.B.pcm) return false;
      const offset = result.offset;
      this.setSyncOffset(offset);
      this.alignmentResult = { ...result, applied: true };
      this.renderShared();
      return true;
    }
    setSyncOffset(value) {
      if (!Number.isFinite(value)) return;
      const offset = Math.round(clamp(value, -30, 30) * 100) / 100;
      if (offset === this.syncOffset) { this.renderShared(); return; }
      this.invalidateEstimate();
      const wasPlaying = Boolean(this.syncVoice || this.syncStarting);
      const position = this.currentSyncPosition();
      this.syncOffset = offset;
      if (this.linkCursors && this.slots.A.pcm) this.setCursor("A", this.slots.A.cursor);
      if (wasPlaying) {
        this.stopPlayback();
        this.syncPosition = clamp(position, 0, this.syncDuration());
        return this.playShared();
      } else {
        this.syncPosition = clamp(position, 0, this.syncDuration());
        this.renderShared();
      }
    }
    async seekShared(time) {
      if (!Number.isFinite(time)) return false;
      const position = clamp(time, 0, this.syncDuration());
      const wasPlaying = Boolean(this.syncVoice || this.syncStarting);
      if (wasPlaying) this.stopPlayback();
      this.syncPosition = position;
      this.syncStatus = "syncPaused";
      this.renderShared();
      this.drawWave("A"); this.drawWave("B");
      if (wasPlaying) return this.playShared();
      return true;
    }
    updateSyncGains() {
      if (!this.syncVoice) return;
      const now = this.syncVoice.context.currentTime;
      for (const voice of this.syncVoice.voices) {
        const auto = this.syncVoice.auto;
        const active = auto || this.syncMode === "both" || this.syncMode === voice.key;
        const level = active ? this.listeningGain(voice.key) * (!auto && this.syncMode === "both" ? .5 : 1) : 0;
        const at = Math.max(now, voice.startAt);
        voice.gain.gain.setTargetAtTime(level, at, .012);
      }
    }
    scheduleAlternateGates(shared) {
      if (!shared.auto) return;
      const now = shared.context.currentTime, { period, startTime } = shared;
      const current = Math.max(0, Math.floor(Math.max(0, now - startTime) / period));
      // Browser background throttling can delay the UI tick. Recover the live
      // phase instead of scheduling a backlog of AudioParam events in the past.
      if (current > shared.nextGateIndex) {
        for (const item of shared.voices) {
          item.gate.gain.setValueAtTime(Number((current % 2 === 0) === (item.key === "A")), now);
        }
        shared.nextGateIndex = current + 1;
      }
      const last = Math.ceil((now + 30 - startTime) / period);
      for (let turn = shared.nextGateIndex; turn <= last; turn++) {
        const at = startTime + turn * period;
        for (const item of shared.voices) {
          const active = (turn % 2 === 0) === (item.key === "A");
          item.gate.gain.setTargetAtTime(active ? 1 : 0, at, .006);
        }
      }
      shared.nextGateIndex = Math.max(shared.nextGateIndex, last + 1);
    }
    tickShared() {
      if (!this.syncVoice) return;
      this.scheduleAlternateGates(this.syncVoice);
      if (!this.syncVoice.repeat && this.currentSyncPosition() >= this.syncDuration() - .005) {
        this.finishShared(); return;
      }
      this.renderShared();
      this.drawWave("A"); this.drawWave("B");
    }
    finishShared() {
      this.stopPlayback();
      this.syncPosition = 0; this.syncStatus = "syncReady";
      this.renderShared();
      this.drawWave("A"); this.drawWave("B");
    }

    async loadExample(key, id) {
      const entry = examples.CATALOGUE.find(item => item.id === id);
      if (!entry) return false;
      const s = this.slots[key]; s.classId = entry.classId; s.exampleId = id;
      return this.load(key, options => examples.create(id, { ...this.models, ...options }),
        { kind: entry.kind, classId: entry.classId, exampleId: id, origin: "catalogue" });
    }
    async openFile(key, file) {
      return this.load(key, async options => {
        if (!Number.isFinite(file.size) || file.size > reader.MAX_INPUT_BYTES) throw new CompareError("limit");
        const bytes = await file.arrayBuffer();
        if (options.isCancelled()) throw new CompareError("cancelled");
        return reader.decode(bytes, options);
      }, { kind: "imported", classId: "local", origin: "file", name: safeName(file.name) });
    }
    async openPrepared(key, blob, name, provenance = null) {
      if (!["A", "B"].includes(key) || !blob || typeof blob.arrayBuffer !== "function") return false;
      const mic = provenance?.kind === "microphone";
      const source = mic ? { kind: "microphone", classId: "microphone", origin: "microphone",
        name: safeName(name || "microphone.wav"), captureMode: provenance.captureMode === "take" ? "take" : "rolling",
        recordedAt: String(provenance.recordedAt || "") } :
        { kind: "prepared", classId: "local", origin: "soundlab", name: safeName(name || "sound-lab.wav") };
      return this.load(key, async options => {
        if (!Number.isFinite(blob.size) || blob.size > reader.MAX_INPUT_BYTES) throw new CompareError("limit");
        const bytes = await blob.arrayBuffer();
        if (options.isCancelled()) throw new CompareError("cancelled");
        return reader.decode(bytes, options);
      }, source);
    }
    async useAnalysis(key) {
      const current = this.getAnalysis();
      if (!current?.pcm || !current?.source) {
        const s = this.slots[key]; s.status = "noAnalysis"; s.error = true; this.renderSlot(key); return false;
      }
      return this.load(key, async () => current.pcm, { ...current.source });
    }
    async load(key, create, source) {
      if (!["A", "B"].includes(key)) return false;
      const s = this.slots[key], ticket = ++s.ticket;
      this.stopPlayback(); s.busy = true; s.status = "loading"; s.error = false; this.renderSlot(key);
      const cancelled = () => ticket !== s.ticket || !this.active;
      try {
        await this.yieldTask();
        if (cancelled()) return false;
        const pcm = await create({ isCancelled: cancelled, yieldTask: () => this.yieldTask() });
        if (cancelled()) return false;
        if (!pcm?.channels?.length || !pcm.frames || !Number.isFinite(pcm.sampleRate) ||
          totalBytes(pcm) + totalBytes(this.slots[key === "A" ? "B" : "A"].pcm) > MAX_TOTAL_PCM_BYTES) {
          throw new CompareError("limit");
        }
        const index = await dsp.buildWaveformIndex(pcm.channels[0], {
          isCancelled: cancelled, yieldTask: () => this.yieldTask()
        });
        if (cancelled()) return false;
        const other = this.slots[key === "A" ? "B" : "A"];
        const linkedTime = key === "B" ? other.cursor + this.syncOffset : other.cursor - this.syncOffset;
        const cursor = this.linkCursors && other.pcm ? clamp(linkedTime, 0, pcm.duration) :
          Math.min(pcm.duration / 2, .25);
        const spectrum = dsp.spectrumAt(pcm.channels[0], pcm.sampleRate, cursor, this.fftSize);
        if (cancelled()) return false;
        // Commit only after all work passes: a failed load cannot disturb the other slot.
        s.pcm = pcm; s.source = { ...source }; s.index = index; s.channel = 0;
        s.cursor = cursor; s.spectrum = spectrum; s.audioBuffer = null;
        s.classId = source.classId; s.exampleId = source.exampleId || "";
        s.status = "ready"; s.error = false;
        this.invalidateEstimate();
        this.syncPosition = 0; this.syncStatus = "syncReady";
        return true;
      } catch (error) {
        if (!cancelled() && error?.code !== "cancelled") {
          s.status = ["invalid", "limit", "nonfinite", "unavailable", "unsupported"].includes(error?.code) ? error.code : "generic";
          s.error = true;
          // A failed replacement is not a selection change: show the class and
          // example of the PCM we actually kept, if there is one.
          if (s.source) {
            s.classId = s.source.classId;
            s.exampleId = s.source.exampleId || "";
          }
        }
        return false;
      } finally {
        if (ticket === s.ticket) { s.busy = false; this.renderSlot(key); this.renderShared(); this.drawSlot(key); }
      }
    }
    async reindexChannel(key) {
      const s = this.slots[key], pcm = s.pcm; if (!pcm) return false;
      this.invalidateEstimate();
      const ticket = ++s.ticket; s.busy = true; s.status = "loading";
      this.stopPlayback(); this.renderSlot(key);
      try {
        const index = await dsp.buildWaveformIndex(pcm.channels[s.channel], {
          isCancelled: () => ticket !== s.ticket || !this.active, yieldTask: () => this.yieldTask()
        });
        if (ticket !== s.ticket || !this.active) return false;
        s.index = index; s.spectrum = dsp.spectrumAt(pcm.channels[s.channel], pcm.sampleRate, s.cursor, this.fftSize);
        s.status = "ready"; return true;
      } catch (_) { if (ticket === s.ticket) { s.status = "generic"; s.error = true; } return false; }
      finally { if (ticket === s.ticket) { s.busy = false; this.renderSlot(key); this.renderShared(); this.drawSlot(key); } }
    }
    setCursor(key, time) {
      const s = this.slots[key];
      if (!s.pcm || s.busy || !Number.isFinite(time)) return;
      s.cursor = clamp(time, 0, s.pcm.duration);
      s.spectrum = dsp.spectrumAt(s.pcm.channels[s.channel], s.pcm.sampleRate, s.cursor, this.fftSize);
      this.$(`compare${key}Cursor`).value = String(s.cursor);
      if (this.linkCursors) {
        const otherKey = key === "A" ? "B" : "A", other = this.slots[otherKey];
        if (other.pcm && !other.busy) {
          const linkedTime = key === "A" ? s.cursor + this.syncOffset : s.cursor - this.syncOffset;
          other.cursor = clamp(linkedTime, 0, other.pcm.duration);
          other.spectrum = dsp.spectrumAt(other.pcm.channels[other.channel], other.pcm.sampleRate,
            other.cursor, this.fftSize);
          this.$(`compare${otherKey}Cursor`).value = String(other.cursor);
        }
        this.draw();
      } else this.drawSlot(key);
    }

    listeningGain(key) { return this.volume * this.slots[key].volume; }
    updateListeningGain() {
      if (!this.voice || !this.playingKey) return;
      this.voice.gain.gain.setTargetAtTime(this.listeningGain(this.playingKey),
        this.contextOwner.context.currentTime, .01);
    }

    async prepareAudioBuffer(slot, pcm, context, cancelled) {
      if (slot.audioBuffer) return slot.audioBuffer;
      const buffer = context.createBuffer(pcm.channels.length, pcm.frames, pcm.sampleRate);
      const attenuation = pcm.peak > .98 ? .98 / pcm.peak : 1;
      for (let c = 0; c < pcm.channels.length; c++) {
        const target = buffer.getChannelData(c), samples = pcm.channels[c];
        for (let start = 0; start < samples.length; start += 131072) {
          if (cancelled()) return null;
          const end = Math.min(samples.length, start + 131072);
          for (let i = start; i < end; i++) target[i] = samples[i] * attenuation;
          await this.yieldTask();
        }
      }
      if (cancelled()) return null;
      slot.audioBuffer = buffer;
      return buffer;
    }

    // Audition-only loop, made directly from native PCM samples. Out-of-range
    // source times become silence (including the delay from a negative B τ).
    // Neither the analysis PCM nor either cached full-playback buffer changes.
    async prepareExcerptBuffer(pcm, context, sourceTime, seconds, cancelled) {
      const frames = Math.max(1, Math.round(seconds * pcm.sampleRate));
      const buffer = context.createBuffer(pcm.channels.length, frames, pcm.sampleRate);
      const first = Math.round(sourceTime * pcm.sampleRate);
      const fade = Math.max(1, Math.round(.004 * pcm.sampleRate));
      const attenuation = pcm.peak > .98 ? .98 / pcm.peak : 1;
      for (let c = 0; c < pcm.channels.length; c++) {
        const target = buffer.getChannelData(c), source = pcm.channels[c];
        for (let start = 0; start < frames; start += 131072) {
          if (cancelled()) return null;
          const end = Math.min(frames, start + 131072);
          for (let i = start; i < end; i++) {
            const at = first + i;
            if (at < 0 || at >= source.length) continue;
            target[i] = source[at] * attenuation * Math.min(1, i / fade, (frames - 1 - i) / fade);
          }
          await this.yieldTask();
        }
      }
      return cancelled() ? null : buffer;
    }

    stopPlayback() {
      this.playbackTicket++;
      const voice = this.voice;
      this.voice = null; this.playingKey = null; this.startingKey = null;
      if (voice) {
        voice.node.onended = null;
        try { voice.gain.gain.setValueAtTime(0, this.contextOwner.context.currentTime); voice.node.stop(); }
        catch (_) { /* The source may have ended already. */ }
        try { voice.node.disconnect(); voice.gain.disconnect(); } catch (_) { /* Graph may be detached. */ }
      }
      const shared = this.syncVoice, wasStarting = this.syncStarting;
      const time = shared ? this.currentSyncPosition() : this.syncPosition;
      this.syncVoice = null; this.syncStarting = false;
      if (shared) {
        if (shared.timer !== null) this.window.clearInterval(shared.timer);
        for (const item of shared.voices) {
          item.node.onended = null;
          try { item.gain.gain.setValueAtTime(0, shared.context.currentTime); item.node.stop(); }
          catch (_) { /* This branch may already have ended. */ }
          try { item.node.disconnect(); item.gain.disconnect(); item.gate?.disconnect(); }
          catch (_) { /* Already detached. */ }
        }
      }
      if (shared || wasStarting) {
        this.syncPosition = time;
        this.syncStatus = "syncPaused";
      }
      for (const key of ["A", "B"]) {
        const s = this.slots[key];
        if (s.status === "playing" || s.status === "starting") s.status = "ready";
        this.renderSlot(key);
      }
      this.renderShared();
    }
    stop() {
      this.stopPlayback();
      for (const s of Object.values(this.slots)) {
        s.ticket++; s.busy = false;
        if (s.status === "loading" || s.status === "starting" || s.status === "playing") s.status = "stopped";
      }
      this.render();
    }
    async play(key) {
      const s = this.slots[key]; if (!this.active || !s.pcm || s.busy) return false;
      if (this.playingKey === key || this.startingKey === key) { this.stopPlayback(); return true; }
      this.stopPlayback(); const ticket = ++this.playbackTicket;
      this.startingKey = key; s.status = "starting"; this.render();
      const pcm = s.pcm, cancelled = () => ticket !== this.playbackTicket || !this.active || s.pcm !== pcm;
      try {
        const context = await this.contextOwner.readyContext();
        if (cancelled()) return false;
        const buffer = await this.prepareAudioBuffer(s, pcm, context, cancelled);
        if (!buffer || cancelled()) return false;
        const node = context.createBufferSource(), gain = context.createGain();
        node.buffer = buffer; gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(this.listeningGain(key), context.currentTime + .008);
        node.connect(gain); gain.connect(this.contextOwner.output);
        this.voice = { node, gain }; this.startingKey = null; this.playingKey = key;
        s.status = "playing";
        node.onended = () => {
          if (this.voice?.node !== node) return;
          this.stopPlayback(); s.status = "ready"; this.renderSlot(key);
        };
        node.start(); this.render(); return true;
      } catch (_) {
        if (!cancelled()) { this.stopPlayback(); s.status = "playbackError"; s.error = true; this.renderSlot(key); }
        return false;
      } finally {
        if (ticket === this.playbackTicket && this.startingKey === key) {
          this.startingKey = null; this.renderSlot(key);
        }
      }
    }

    async playShared() {
      const a = this.slots.A, b = this.slots.B;
      if (!this.active || !a.pcm || !b.pcm || a.busy || b.busy) return false;
      if (this.syncVoice || this.syncStarting) { this.stopPlayback(); this.drawWave("A"); this.drawWave("B"); return true; }
      this.stopPlayback(); const ticket = ++this.playbackTicket;
      this.syncStarting = true; this.syncStatus = "syncStarting"; this.renderShared();
      const pcmA = a.pcm, pcmB = b.pcm;
      const auto = this.syncMode === "auto", repeat = auto && this.syncReplay, period = this.syncSwitchPeriod;
      const cancelled = () => ticket !== this.playbackTicket || !this.active ||
        a.pcm !== pcmA || b.pcm !== pcmB;
      try {
        const context = await this.contextOwner.readyContext();
        if (cancelled()) return false;
        const duration = this.syncDuration();
        const position = this.syncPosition >= duration - .005 ? 0 : clamp(this.syncPosition, 0, duration);
        const bufferA = repeat ? await this.prepareExcerptBuffer(pcmA, context, position, period, cancelled) :
          await this.prepareAudioBuffer(a, pcmA, context, cancelled);
        if (!bufferA || cancelled()) return false;
        const bufferB = repeat ? await this.prepareExcerptBuffer(pcmB, context, position + this.syncOffset, period, cancelled) :
          await this.prepareAudioBuffer(b, pcmB, context, cancelled);
        if (!bufferB || cancelled()) return false;
        const now = context.currentTime, startTime = auto ? now + .025 : now, voices = [];
        try {
          for (const [key, buffer, pcm, shift] of [["A", bufferA, pcmA, 0], ["B", bufferB, pcmB, this.syncOffset]]) {
            const plan = repeat ? { delay: 0, offset: 0 } : sharedStart(pcm.duration, position, shift);
            if (!plan) continue;
            const node = context.createBufferSource(), gain = context.createGain();
            node.buffer = buffer;
            if (repeat) {
              node.loop = true; node.loopStart = 0;
              node.loopEnd = Math.max(1, Math.round(period * pcm.sampleRate)) / pcm.sampleRate;
            }
            gain.gain.setValueAtTime(0, now);
            node.connect(gain);
            const gate = auto ? context.createGain() : null;
            if (gate) {
              gate.gain.setValueAtTime(0, now);
              gain.connect(gate); gate.connect(this.contextOwner.output);
            } else gain.connect(this.contextOwner.output);
            voices.push({ key, node, gain, gate, startAt: startTime + plan.delay, offset: plan.offset });
          }
          if (!voices.length) throw new Error("No samples remain on the shared timeline");
          const shared = { context, voices, startTime, position, timer: null, ended: 0,
            auto, repeat, period, nextGateIndex: 0 };
          this.scheduleAlternateGates(shared);
          for (const item of voices) item.node.start(item.startAt, item.offset);
          this.syncVoice = shared; this.syncPosition = position; this.syncStarting = false;
          this.syncStatus = "syncPlaying";
          for (const item of voices) item.node.onended = () => {
            if (this.syncVoice !== shared) return;
            shared.ended++;
            if (shared.ended === voices.length) this.finishShared();
          };
          this.updateSyncGains();
          shared.timer = this.window.setInterval(() => this.tickShared(), 80);
        } catch (error) {
          for (const item of voices) {
            try { item.node.stop(); } catch (_) { /* Source not started. */ }
            try { item.node.disconnect(); item.gain.disconnect(); item.gate?.disconnect(); }
            catch (_) { /* Detached. */ }
          }
          throw error;
        }
        this.renderShared(); this.drawWave("A"); this.drawWave("B");
        return true;
      } catch (_) {
        if (!cancelled()) {
          this.stopPlayback(); this.syncStatus = "syncError"; this.renderShared();
        }
        return false;
      } finally {
        if (ticket === this.playbackTicket && this.syncStarting) {
          this.syncStarting = false; this.renderShared();
        }
      }
    }

    canvas(id) {
      if (!this.active) return null;
      const canvas = this.$(id), rect = canvas.getBoundingClientRect();
      if (rect.width < 10) return null;
      const width = Math.max(160, Math.round(rect.width)), height = Math.max(150, Math.round(rect.height || 205));
      const ratio = clamp(this.window.devicePixelRatio || 1, 1, 2);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      const g = canvas.getContext("2d"); if (!g) return null;
      g.setTransform(ratio, 0, 0, ratio, 0, 0); g.clearRect(0, 0, width, height);
      g.fillStyle = "#fbfdff"; g.fillRect(0, 0, width, height);
      g.font = "11px system-ui, sans-serif"; g.lineWidth = 1;
      return { g, left: 44, right: width - 14, top: 18, bottom: height - 30, width, height };
    }
    drawSpectral() { if (this.spectralView !== "overlay") this.drawDifference(); else this.drawOverlay(); }
    draw() { for (const key of ["A", "B"]) this.drawSlot(key, false); this.drawSpectral(); }
    drawSlot(key, includeOverlay = true) {
      const s = this.slots[key], pcm = s.pcm;
      if (!pcm || !s.index || !this.active || s.busy) {
        if (includeOverlay) this.drawSpectral();
        return;
      }
      if (!s.spectrum || s.spectrum.fftSize !== this.fftSize) {
        s.spectrum = dsp.spectrumAt(pcm.channels[s.channel], pcm.sampleRate, s.cursor, this.fftSize);
      }
      this.drawWave(key);
      if (this.$("compareIndividualDetails").open) this.drawSpectrum(key);
      this.put(`compare${key}Measure`, this.text("measure", { peak: fmt(s.index.peak, 4), rms: fmt(s.index.rms, 4) }));
      if (includeOverlay) this.drawSpectral();
    }
    drawWave(key) {
      const s = this.slots[key], pcm = s.pcm, p = this.canvas(`compare${key}Wave`); if (!p) return;
      const { g, left, right, top, bottom, height } = p, scale = Math.max(1, s.index.peak);
      const y = value => (top + bottom) / 2 - value / scale * (bottom - top) / 2;
      g.strokeStyle = "#dbe7ef"; g.fillStyle = "#56738d";
      for (const value of [-scale, 0, scale]) {
        g.beginPath(); g.moveTo(left, y(value)); g.lineTo(right, y(value)); g.stroke();
        g.textAlign = "right"; g.fillText(fmt(value, 2), left - 6, y(value) + 4);
      }
      const ticks = p.width < 430 ? 2 : 4;
      for (let i = 0; i <= ticks; i++) {
        const x = left + (right - left) * i / ticks;
        g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke();
        g.textAlign = i === 0 ? "left" : i === ticks ? "right" : "center";
        g.fillText(fmt(pcm.duration * i / ticks, 2), x, height - 8);
      }
      const count = Math.max(1, Math.min(2048, Math.floor(right - left)));
      const env = dsp.waveformEnvelope(s.index, 0, pcm.duration, count, pcm.sampleRate);
      g.strokeStyle = key === "A" ? "#237b9a" : "#b46c3e"; g.beginPath();
      for (let i = 0; i < count; i++) {
        const x = left + (i + .5) * (right - left) / count;
        g.moveTo(x, y(env.minima[i])); g.lineTo(x, y(env.maxima[i]));
      }
      g.stroke();
      const x = left + (right - left) * s.cursor / pcm.duration;
      g.strokeStyle = "#d17f20"; g.lineWidth = 1.6; g.beginPath();
      g.moveTo(x, top); g.lineTo(x, bottom); g.stroke();
      if (this.syncVoice || this.syncPosition > 0) {
        const playbackTime = this.sharedMarkerTime() + (key === "B" ? this.syncOffset : 0);
        if (playbackTime >= 0 && playbackTime <= pcm.duration) {
          const px = left + (right - left) * playbackTime / pcm.duration;
          g.strokeStyle = "#3366c5"; g.lineWidth = 1.4; g.beginPath();
          g.moveTo(px, top); g.lineTo(px, bottom); g.stroke();
        }
      }
      this.put(`compare${key}CursorInfo`, this.text("cursorInfo", { time: fmt(s.cursor, 3),
        duration: fmt(pcm.duration, 3), scale: fmt(scale, 2) }));
    }
    drawSpectrum(key) {
      const s = this.slots[key], pcm = s.pcm, spectrum = s.spectrum;
      const p = this.canvas(`compare${key}Spectrum`); if (!p || !spectrum) return;
      const { g, left, right, top, bottom, height } = p;
      const high = Math.min(pcm.sampleRate / 2, this.maxHz || Infinity);
      const min = this.axis === "log" ? Math.min(high / 2, Math.max(20, spectrum.binHz)) : 0;
      const x = hz => left + (right - left) * (this.axis === "log" ?
        Math.log(Math.max(min, hz) / min) / Math.log(high / min) : hz / high);
      const y = db => bottom - (clamp(db, -100, 0) + 100) / 100 * (bottom - top);
      g.strokeStyle = "#dbe7ef"; g.fillStyle = "#56738d";
      for (let level = -100; level <= 0; level += 20) {
        g.beginPath(); g.moveTo(left, y(level)); g.lineTo(right, y(level)); g.stroke();
        g.textAlign = "right"; g.fillText(String(level), left - 5, y(level) + 4);
      }
      const ticks = this.axis === "log" ? [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
        .filter(hz => hz >= min && hz <= high) : [0, high / 2, high];
      let lastX = -1000;
      for (const hz of [...ticks, high]) {
        const pos = x(hz); if (pos - lastX < 47 && hz !== high) continue;
        g.textAlign = "center"; g.fillText(hz >= 1000 ? fmt(hz / 1000, 1) + "k" : fmt(hz, 0),
          clamp(pos, left + 12, right - 12), height - 8); lastX = pos;
      }
      let best = -Infinity, peakHz = 0, started = false;
      g.strokeStyle = key === "A" ? "#237b9a" : "#b46c3e"; g.lineWidth = 1.4; g.beginPath();
      for (let i = 0; i < spectrum.magnitudes.length; i++) {
        const hz = i * spectrum.binHz;
        if (hz > high) break;
        if (hz < min) continue;
        const level = spectrum.magnitudes[i] > 0 ? 20 * Math.log10(spectrum.magnitudes[i]) : -Infinity;
        if (Number.isFinite(level) && level > best && hz >= 50) { best = level; peakHz = hz; }
        const px = x(hz), py = y(level);
        if (!started) { g.moveTo(px, py); started = true; } else g.lineTo(px, py);
      }
      g.stroke();
      this.put(`compare${key}SpectrumInfo`, this.text(best > -95 ? "spectrumInfo" : "spectrumSilent", {
        fft: this.fftSize, bin: fmt(spectrum.binHz, 2), peak: fmt(peakHz, 1), level: fmt(best, 1)
      }));
    }
    drawOverlay() {
      const data = overlayModel(this.slots, {
        maxHz: this.maxHz, axis: this.axis, normalize: this.normalizeOverlay
      });
      if (!data) { this.put("compareOverlayInfo", this.text("overlayWaiting")); return; }
      const { low, high, traces } = data;
      const limit = traces.length === 2 ? Math.min(...traces.map(trace => trace.nyquist)) : high;
      const details = key => {
        const trace = traces.find(item => item.key === key);
        return trace ? this.text("overlayWindow", { ms: fmt(trace.windowMs, 1),
          bin: fmt(trace.spectrum.binHz, 2), time: fmt(this.slots[key].cursor, 3) }) : this.text("overlayUnavailable");
      };
      this.put("compareOverlayInfo", this.text("overlayInfo", {
        scale: this.text(this.normalizeOverlay ? "overlayRelative" : "overlayAbsolute"),
        a: details("A"), b: details("B"),
        missing: limit < high ? this.text("overlayMissing", { hz: fmt(limit, 0) }) : ""
      }));
      const p = this.canvas("compareOverlaySpectrum"); if (!p) return;
      const { g, left, right, top, bottom, height } = p;
      const x = hz => left + (right - left) * (data.axis === "log" ?
        Math.log(Math.max(low, hz) / low) / Math.log(high / low) : hz / high);
      const y = level => bottom - (clamp(level, -100, 0) + 100) / 100 * (bottom - top);
      if (limit < high) {
        const edge = x(limit);
        g.fillStyle = "#eff2f6";
        g.fillRect(edge, top, right - edge, bottom - top);
      }
      g.strokeStyle = "#dbe7ef"; g.fillStyle = "#56738d";
      for (let level = -100; level <= 0; level += 20) {
        g.beginPath(); g.moveTo(left, y(level)); g.lineTo(right, y(level)); g.stroke();
        g.textAlign = "right"; g.fillText(String(level), left - 5, y(level) + 4);
      }
      const ticks = data.axis === "log" ? [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
        .filter(hz => hz >= low && hz <= high) : [0, high / 4, high / 2, high * .75, high];
      let lastX = -Infinity;
      for (const hz of [...ticks, high]) {
        const px = x(hz);
        if (px - lastX < 48 && hz !== high) continue;
        g.textAlign = "center"; g.fillText(hz >= 1000 ? fmt(hz / 1000, 1) + "k" : fmt(hz, 0),
          clamp(px, left + 12, right - 12), height - 7); lastX = px;
      }
      for (const trace of traces) {
        g.strokeStyle = trace.key === "A" ? "#237b9a" : "#b46c3e";
        g.lineWidth = 2; g.beginPath();
        let started = false;
        for (let i = trace.first; i <= trace.last; i++) {
          const hz = i * trace.spectrum.binHz, mag = trace.spectrum.magnitudes[i];
          const db = Number.isFinite(mag) && mag > 0 ? 20 * Math.log10(mag) - trace.referenceDb : -Infinity;
          const px = x(hz), py = y(db);
          if (!started) { g.moveTo(px, py); started = true; } else g.lineTo(px, py);
        }
        if (started) g.stroke();
      }
    }

    currentDifferenceModel() {
      const a = this.slots.A, b = this.slots.B;
      if (!a.pcm || !b.pcm || a.busy || b.busy) return null;
      const cache = this.matchedCache;
      if (!cache || cache.aPcm !== a.pcm || cache.bPcm !== b.pcm ||
          cache.aChannel !== a.channel || cache.bChannel !== b.channel ||
          cache.aCursor !== a.cursor || cache.bCursor !== b.cursor || cache.fftSize !== this.fftSize) {
        this.matchedCache = { aPcm: a.pcm, bPcm: b.pcm, aChannel: a.channel, bChannel: b.channel,
          aCursor: a.cursor, bCursor: b.cursor, fftSize: this.fftSize,
          matched: matchedSpectra(this.slots, this.fftSize) };
      }
      return differenceModel(this.matchedCache.matched, {
        axis: this.axis, maxHz: this.maxHz, normalize: this.normalizeDifference,
        measure: this.spectralView === "ratio" ? "ratio" : "amplitude"
      });
    }
    drawDifference() {
      const model = this.currentDifferenceModel();
      if (!model) {
        this.put("compareDifferenceInfo", this.text("differenceWaiting"));
        this.put("compareDifferenceProbe", "");
        this.put("compareDifferencePadding", "");
        this.put("compareDifferenceStatus", "");
        return;
      }
      const { low, high, A, B, axis } = model;
      this.put("compareDifferenceInfo", this.text("differenceInfo", {
        low: fmt(low, 0), high: fmt(high, 0), ms: fmt(model.seconds * 1000, 2),
        aSamples: A.windowSamples, bSamples: B.windowSamples,
        aRate: model.sampleRateA, bRate: model.sampleRateB,
        aBins: fmt(A.binHz, 2), bBins: fmt(B.binHz, 2)
      }) + " · " + this.text(model.measure === "ratio" ?
        (model.normalize ? "ratioRelative" : "ratioAbsolute") :
        (model.normalize ? "differenceRelative" : "differenceAbsolute")));
      this.put("compareDifferencePadding", A.paddedSamples || B.paddedSamples ?
        this.text("differencePadding", { a: A.paddedSamples, b: B.paddedSamples }) : "");
      const probe = this.$("compareDifferenceHz");
      probe.min = String(low); probe.max = String(high);
      const hz = probe.value.trim() === "" ? NaN : Number(probe.value);
      const inspected = differenceAt(model, hz);
      const db = value => value === -Infinity ? "−∞" : fmt(value, 2);
      const amp = value => Math.abs(value) > 0 && Math.abs(value) < .0001 ? value.toExponential(2) : fmt(value, 4);
      const signedAmp = value => value > 0 ? "+" + amp(value) : amp(value);
      const signed = (value, digits = 2) => value > 0 ? "+" + fmt(value, digits) : fmt(value, digits);
      this.put("compareDifferenceProbe", !inspected ? this.text("differenceProbeRange", {
        low: fmt(low, 0), high: fmt(high, 0)
      }) : model.measure === "ratio" ? this.text("ratioProbe", {
        hz: fmt(hz, 2), a: db(inspected.dbA), b: db(inspected.dbB),
        delta: signed(inspected.delta), mode: model.normalize ? this.text("differenceProbeRelative") : "",
        limit: inspected.floorLimited ? this.text("ratioFloorHint") : ""
      }) : this.text("differenceProbe", {
        hz: fmt(hz, 2), a: amp(inspected.amplitudeA), b: amp(inspected.amplitudeB),
        delta: signedAmp(inspected.delta), mode: model.normalize ? this.text("differenceProbeRelative") : ""
      }));
      const p = this.canvas("compareDifferenceSpectrum"); if (!p) return;
      const { g, left, right, top, bottom, height } = p;
      const x = frequency => left + (right - left) * (axis === "log" ?
        Math.log(Math.max(low, frequency) / low) / Math.log(high / low) : frequency / high);
      const count = Math.max(2, Math.floor(right - left)), points = [];
      let min = 0, max = 0;
      for (let i = 0; i <= count; i++) {
        const fraction = i / count;
        const frequency = axis === "log" ? low * (high / low) ** fraction : high * fraction;
        const point = differenceAt(model, frequency);
        points.push(point);
        if (point) { min = Math.min(min, point.delta); max = Math.max(max, point.delta); }
      }
      const ratio = model.measure === "ratio";
      const padding = Math.max(.08 * (max - min), 1e-3);
      const yMin = ratio ? -90 : min - padding, yMax = ratio ? 90 : max + padding;
      const y = value => bottom - (clamp(value, yMin, yMax) - yMin) / (yMax - yMin) * (bottom - top);
      const axisLabel = value => Math.abs(value) < 1e-12 ? "0" :
        Math.abs(value) < .0001 ? value.toExponential(1) : fmt(value, Math.abs(value) < .1 ? 4 : 3);
      g.strokeStyle = "#dbe7ef"; g.fillStyle = "#56738d";
      for (let i = 0; i <= 4; i++) {
        const level = yMin + (yMax - yMin) * i / 4;
        g.beginPath(); g.moveTo(left, y(level)); g.lineTo(right, y(level));
        g.strokeStyle = "#dbe7ef"; g.stroke();
        g.textAlign = "right"; g.fillText(ratio ? signed(level, 0) : axisLabel(level), left - 5, y(level) + 4);
      }
      g.strokeStyle = "#8ba9b9"; g.beginPath(); g.moveTo(left, y(0)); g.lineTo(right, y(0)); g.stroke();
      g.fillStyle = "#56738d"; g.textAlign = "left";
      g.fillText(this.text(ratio ? "ratioAxis" : "differenceAxis"), left + 8, top + 13);
      const ticks = axis === "log" ? [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
        .filter(value => value >= low && value <= high) : [0, high / 4, high / 2, high * .75, high];
      let last = -Infinity;
      for (const frequency of [...ticks, high]) {
        const px = x(frequency);
        if (px - last < 50 && frequency !== high) continue;
        g.textAlign = "center"; g.fillText(frequency >= 1000 ? fmt(frequency / 1000, 1) + "k" : fmt(frequency, 0),
          clamp(px, left + 15, right - 15), height - 7); last = px;
      }
      let started = false;
      g.lineWidth = 1.8; g.strokeStyle = "#7c4bc2"; g.beginPath();
      for (let i = 0; i <= count; i++) {
        const fraction = i / count;
        const point = points[i];
        if (!point) {
          if (started) g.stroke();
          g.beginPath(); started = false; continue;
        }
        const px = left + (right - left) * fraction, py = y(point.delta);
        if (!started) { g.moveTo(px, py); started = true; } else g.lineTo(px, py);
      }
      if (started) g.stroke();
      if (inspected) {
        const px = x(hz);
        g.strokeStyle = "#d17f20"; g.lineWidth = 1.1; g.beginPath();
        g.moveTo(px, top); g.lineTo(px, bottom); g.stroke();
      }
      this.put("compareDifferenceStatus", this.text(ratio ? "ratioClipped" : "differenceContinuous"));
    }
  }
  return Object.freeze({ Controller, words, MAX_TOTAL_PCM_BYTES, DEFAULTS, DIFFERENCE_FLOOR_DB,
    totalBytes, overlayModel, matchedSpectra, differenceModel, differenceAt, sharedDuration, sharedStart, estimateTimeOffset });
});
