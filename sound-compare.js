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
  // unequal bin numbers as matching frequencies). It is a display estimate,
  // not phase-coherent subtraction or a transfer function.
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
    floorDb = DIFFERENCE_FLOOR_DB } = {}) {
    if (!matched?.A || !matched?.B) return null;
    const high = Math.min(matched.sampleRateA / 2, matched.sampleRateB / 2,
      Number.isFinite(maxHz) && maxHz > 0 ? maxHz : Infinity);
    const low = axis === "log" ? Math.min(20, high / 2) : 0;
    if (!(high > low)) return null;
    const aPeak = bestVisibleDb(matched.A, low, high), bPeak = bestVisibleDb(matched.B, low, high);
    const peakOffset = normalize && Number.isFinite(aPeak) && Number.isFinite(bPeak) ? aPeak - bPeak : 0;
    return { ...matched, axis, low, high, normalize, floorDb, aPeak, bPeak, peakOffset };
  }
  function differenceAt(model, hz) {
    if (!model || !Number.isFinite(hz) || hz < model.low || hz > model.high) return null;
    const powerA = powerAt(model.A, hz), powerB = powerAt(model.B, hz);
    if (powerA === null || powerB === null) return null;
    const dbA = powerA > 0 ? 10 * Math.log10(powerA) : -Infinity;
    const dbB = powerB > 0 ? 10 * Math.log10(powerB) : -Infinity;
    const valid = dbA >= model.floorDb && dbB >= model.floorDb;
    return { hz, dbA, dbB, valid, delta: valid ? dbA - dbB - model.peakOffset : null };
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
      overlayTitle: "Spectral comparison A/B", overlayIntro: "Choose a native spectral overlay or a matched-window level difference, without resampling the sound.",
      linkCursors: "Link inspection times (seconds)", normalizeOverlay: "Normalize each displayed spectral peak",
      overlayNote: "Native Hann windows use the same sample count but may span different times. Peak normalization affects only this overlay, not the source audio or the two separate spectra.",
      overlayWaiting: "Choose two sounds to compare their spectra.",
      overlayInfo: "{scale} · A: {a} · B: {b}{missing}",
      overlayAbsolute: "Original levels (dBFS)", overlayRelative: "Each displayed peak = 0 dB",
      overlayWindow: "{ms} ms Hann · {bin} Hz/bin · cursor {time} s",
      overlayUnavailable: "no source", overlayMissing: " · above {hz} Hz, only the higher-rate source has samples",
      overlayAria: "Two spectra with shared frequency and level axes",
      plotModes: "Spectral comparison views", overlayMode: "Overlay A/B", differenceMode: "Difference A−B",
      differenceTitle: "Matched-window spectral difference", differenceIntro: "A positive dB difference means A has more spectral power than B at this frequency.",
      differenceNormalize: "Compare shape (align matched spectral peaks)",
      differenceProbeLabel: "Inspect frequency · Hz", differenceAria: "Signed spectral level difference A minus B in decibels",
      differenceWaiting: "Choose two sounds to calculate the A−B difference.",
      differenceInfo: "Shared band {low}–{high} Hz · paired Hann {ms} ms · A: {aSamples} samples at {aRate} Hz ({aBins} Hz/FFT bin) · B: {bSamples} samples at {bRate} Hz ({bBins} Hz/FFT bin)",
      differenceNote: "Each source uses a Hann window of approximately equal real duration, centered on its own cursor. FFTs are zero-padded for sampling the frequency axis, not for added resolution. Squared amplitudes are linearly interpolated at matching Hz; values below −90 dBFS in either source are hidden, not assigned an artificial ratio. Curves stop at the lower Nyquist limit. This is not time alignment, phase subtraction, a transfer function or acoustic dB SPL.",
      differenceAbsolute: "Absolute source levels (dBFS)", differenceRelative: "Peak-relative spectral shapes (display only)",
      differencePadding: "Hann windows extend beyond a recording: {a} A samples and {b} B samples treated as silence; inspect farther from the edges for a complete window.",
      differenceProbe: "{hz} Hz · A {a} dBFS · B {b} dBFS · A−B {delta} dB{mode}",
      differenceProbeRelative: " (peak-relative)", differenceProbeBelow: "{hz} Hz · A {a} dBFS · B {b} dBFS · at least one source is below −90 dBFS; difference hidden.",
      differenceProbeRange: "Enter a frequency inside the shared {low}–{high} Hz range.",
      differenceNoBand: "There is no shared frequency range for these two recordings.",
      differenceNoSignal: "No plotted frequency passes the −90 dBFS gate in both sounds. Try matching audible content or inspecting another time.",
      differenceClipped: "The chart shows −60…+60 dB; the frequency probe reports values beyond the plotted limits.",
      disclaimer: "The overlay shows native equal-sample Hann spectra at their original dBFS levels; A−B instead uses paired equal-duration windows and matched Hz values. No automatic time alignment or resampling of audio. This is not acoustic dB SPL."
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
      overlayTitle: "A/B спектрийн харьцуулалт", overlayIntro: "Эх спектрүүдийг давхарлах эсвэл ижил хугацааны цонхоор ялгааг нь шинжилнэ. Эх авианы сорьцлолт өөрчлөгдөхгүй.",
      linkCursors: "Шинжлэх хугацааг (сек) холбох", normalizeOverlay: "Харагдах спектр бүрийн оргилыг нормчлох",
      overlayNote: "Hann цонхны сорьцын тоо ижил боловч хугацааны урт өөр байж болно. Оргилын нормчлол нь зөвхөн энэ давхар зурагт нөлөөлнө; эх авиа, тусдаа спектрүүд өөрчлөгдөхгүй.",
      overlayWaiting: "Хоёр авиа сонгож, спектрүүдийг харьцуулаарай.",
      overlayInfo: "{scale} · A: {a} · B: {b}{missing}",
      overlayAbsolute: "Эх түвшин (dBFS)", overlayRelative: "Харагдах оргил бүр = 0 dB",
      overlayWindow: "Hann {ms} мс · {bin} Гц/алхам · курсор {time} сек",
      overlayUnavailable: "авиа байхгүй", overlayMissing: " · {hz} Гц-ээс дээш зөвхөн өндөр сорьцлолттой авиа",
      overlayAria: "Ижил давтамж, түвшний тэнхлэгтэй A/B спектр",
      plotModes: "Спектрийн харьцуулалтын хэлбэр", overlayMode: "A/B давхарлах", differenceMode: "Ялгаа A−B",
      differenceTitle: "Ижил хугацааны цонхтой спектрийн ялгаа", differenceIntro: "Эерэг dB нь тухайн давтамжид A-ийн спектрийн чадал B-ээс ихийг заана.",
      differenceNormalize: "Хэлбэрийг харьцуулах (спектрийн оргилуудыг тааруулах)",
      differenceProbeLabel: "Шинжлэх давтамж · Гц", differenceAria: "A хасах B спектрийн түвшний тэмдэгтэй ялгаа, децибел",
      differenceWaiting: "Спектрийн A−B ялгааг олохын тулд хоёр авиа сонгоорой.",
      differenceInfo: "Хамтын зурвас {low}–{high} Гц · Hann {ms} мс · A: {aSamples} сорьц, {aRate} Гц ({aBins} Гц/FFT алхам) · B: {bSamples} сорьц, {bRate} Гц ({bBins} Гц/FFT алхам)",
      differenceNote: "Хоёр авианы курсор бүрийн орчимд бараг ижил бодит хугацаатай Hann цонх авна. FFT-ийн тэгээр нөхөлт давтамжийн тэнхлэгийг нягтруулдаг ч ялгах чадварыг нэмэхгүй. Ижил Гц цэгт амплитудын квадратыг шугаман интерполяцлана. Аль нэг спектр −90 dBFS-ээс бага бол хиймэл харьцаа тооцохгүй. Доод Найквистийн давтамж дээр зогсоно. Хугацаа тааруулах, фазын ялгаа, дамжуулалтын функц эсвэл акустик dB SPL биш.",
      differenceAbsolute: "Эх дохионы түвшин (dBFS)", differenceRelative: "Оргилд харьцуулсан спектрийн хэлбэр (зөвхөн зураг)",
      differencePadding: "Hann цонх бичлэгийн хязгаараас гарчээ: A-ийн {a}, B-ийн {b} сорьцыг тэгээр нөхөв. Бүрэн цонх үзэхийн тулд курсорыг дотогш шилжүүлээрэй.",
      differenceProbe: "{hz} Гц · A {a} dBFS · B {b} dBFS · A−B {delta} dB{mode}",
      differenceProbeRelative: " (оргилд харьцуулсан)", differenceProbeBelow: "{hz} Гц · A {a} dBFS · B {b} dBFS · дор хаяж нэг нь −90 dBFS-ээс бага тул ялгааг нуув.",
      differenceProbeRange: "Хамтын {low}–{high} Гц доторх давтамж оруулна уу.",
      differenceNoBand: "Хоёр бичлэгт давхцах давтамжийн зурвас байхгүй.",
      differenceNoSignal: "−90 dBFS босго давсан хамтын цэг алга. Ижил төстэй авиа эсвэл өөр хугацаа сонгоорой.",
      differenceClipped: "Графикт −60…+60 dB харуулна; тусгай давтамжийн утга үүнээс гадуур байж болно.",
      disclaimer: "Давхарласан зурагт эх сорьцлолттой, ижил тооны сорьцтой Hann спектрүүдийг dBFS түвшнээр харуулна. A−B ялгаанд ижил хугацааны цонх, ижил Гц цэгүүд ашиглана. Авианы хугацаа эсвэл сорьцлолтыг автоматаар тааруулахгүй. Акустик dB SPL биш."
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
        this.put("compareVolumeValue", Math.round(this.volume * 100) + "%");
      });
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
        this.stopPlayback();
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
      this.$("compareDifferenceSpectrum").setAttribute("aria-label", this.text("differenceAria"));
      this.$("compareKindModes").setAttribute("aria-label", this.text("kindModes"));
      this.$("compareSpectralModes").setAttribute("aria-label", this.text("plotModes"));
      this.render();
      this.drawSpectral();
    }
    render() {
      for (const key of ["A", "B"]) this.renderSlot(key);
      this.put("compareVolumeValue", Math.round(this.volume * 100) + "%");
      this.$("compareLinkCursors").checked = this.linkCursors;
      this.$("compareNormalize").checked = this.normalizeOverlay;
      this.$("compareDifferenceNormalize").checked = this.normalizeDifference;
      this.syncSpectralView();
    }
    syncSpectralView() {
      const difference = this.spectralView === "difference";
      this.$("compareOverlayView").hidden = difference;
      this.$("compareDifferenceView").hidden = !difference;
      for (const [id, selected] of [["compareShowOverlay", !difference], ["compareShowDifference", difference]]) {
        const button = this.$(id);
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    }
    setSpectralView(view) {
      this.spectralView = view === "difference" ? "difference" : "overlay";
      this.syncSpectralView();
      if (this.spectralView === "difference") this.drawDifference(); else this.drawOverlay();
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
        const cursor = this.linkCursors && other.pcm ? Math.min(other.cursor, pcm.duration) :
          Math.min(pcm.duration / 2, .25);
        const spectrum = dsp.spectrumAt(pcm.channels[0], pcm.sampleRate, cursor, this.fftSize);
        if (cancelled()) return false;
        // Commit only after all work passes: a failed load cannot disturb the other slot.
        s.pcm = pcm; s.source = { ...source }; s.index = index; s.channel = 0;
        s.cursor = cursor; s.spectrum = spectrum; s.audioBuffer = null;
        s.classId = source.classId; s.exampleId = source.exampleId || "";
        s.status = "ready"; s.error = false;
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
        if (ticket === s.ticket) { s.busy = false; this.renderSlot(key); this.drawSlot(key); }
      }
    }
    async reindexChannel(key) {
      const s = this.slots[key], pcm = s.pcm; if (!pcm) return false;
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
      finally { if (ticket === s.ticket) { s.busy = false; this.renderSlot(key); this.drawSlot(key); } }
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
          other.cursor = Math.min(s.cursor, other.pcm.duration);
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
      for (const key of ["A", "B"]) this.renderSlot(key);
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
        let buffer = s.audioBuffer;
        if (!buffer) {
          buffer = context.createBuffer(pcm.channels.length, pcm.frames, pcm.sampleRate);
          const attenuation = pcm.peak > .98 ? .98 / pcm.peak : 1;
          for (let c = 0; c < pcm.channels.length; c++) {
            const target = buffer.getChannelData(c), samples = pcm.channels[c];
            for (let start = 0; start < samples.length; start += 131072) {
              if (cancelled()) return false;
              const end = Math.min(samples.length, start + 131072);
              for (let i = start; i < end; i++) target[i] = samples[i] * attenuation;
              await this.yieldTask();
            }
          }
          if (cancelled()) return false;
          s.audioBuffer = buffer;
        }
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
    drawSpectral() { if (this.spectralView === "difference") this.drawDifference(); else this.drawOverlay(); }
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
        axis: this.axis, maxHz: this.maxHz, normalize: this.normalizeDifference
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
      }) + " · " + this.text(model.normalize ? "differenceRelative" : "differenceAbsolute"));
      this.put("compareDifferencePadding", A.paddedSamples || B.paddedSamples ?
        this.text("differencePadding", { a: A.paddedSamples, b: B.paddedSamples }) : "");
      const probe = this.$("compareDifferenceHz");
      probe.min = String(low); probe.max = String(high);
      const hz = probe.value.trim() === "" ? NaN : Number(probe.value);
      const inspected = differenceAt(model, hz);
      const db = value => value === -Infinity ? "−∞" : fmt(value, 2);
      this.put("compareDifferenceProbe", !inspected ? this.text("differenceProbeRange", {
        low: fmt(low, 0), high: fmt(high, 0)
      }) : inspected.valid ? this.text("differenceProbe", {
        hz: fmt(hz, 2), a: db(inspected.dbA), b: db(inspected.dbB),
        delta: fmt(inspected.delta, 2), mode: model.normalize ? this.text("differenceProbeRelative") : ""
      }) : this.text("differenceProbeBelow", { hz: fmt(hz, 2),
        a: db(inspected.dbA), b: db(inspected.dbB) }));
      const p = this.canvas("compareDifferenceSpectrum"); if (!p) return;
      const { g, left, right, top, bottom, height } = p;
      const x = frequency => left + (right - left) * (axis === "log" ?
        Math.log(Math.max(low, frequency) / low) / Math.log(high / low) : frequency / high);
      const y = value => bottom - (clamp(value, -60, 60) + 60) / 120 * (bottom - top);
      g.strokeStyle = "#dbe7ef"; g.fillStyle = "#56738d";
      for (let level = -60; level <= 60; level += 20) {
        g.beginPath(); g.moveTo(left, y(level)); g.lineTo(right, y(level));
        g.strokeStyle = level === 0 ? "#8ba9b9" : "#dbe7ef"; g.stroke();
        g.textAlign = "right"; g.fillText(level > 0 ? `+${level}` : String(level), left - 5, y(level) + 4);
      }
      g.fillStyle = "#56738d"; g.textAlign = "left"; g.fillText("A−B · dB", left + 8, top + 13);
      const ticks = axis === "log" ? [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
        .filter(value => value >= low && value <= high) : [0, high / 4, high / 2, high * .75, high];
      let last = -Infinity;
      for (const frequency of [...ticks, high]) {
        const px = x(frequency);
        if (px - last < 50 && frequency !== high) continue;
        g.textAlign = "center"; g.fillText(frequency >= 1000 ? fmt(frequency / 1000, 1) + "k" : fmt(frequency, 0),
          clamp(px, left + 15, right - 15), height - 7); last = px;
      }
      const count = Math.max(2, Math.floor(right - left));
      let started = false, validCount = 0;
      g.lineWidth = 1.8; g.strokeStyle = "#7c4bc2"; g.beginPath();
      for (let i = 0; i <= count; i++) {
        const fraction = i / count;
        const frequency = axis === "log" ? low * (high / low) ** fraction : high * fraction;
        const point = differenceAt(model, frequency);
        if (!point?.valid) {
          if (started) g.stroke();
          g.beginPath(); started = false; continue;
        }
        const px = left + (right - left) * fraction, py = y(point.delta);
        if (!started) { g.moveTo(px, py); started = true; } else g.lineTo(px, py);
        validCount++;
      }
      if (started) g.stroke();
      if (inspected) {
        const px = x(hz);
        g.strokeStyle = "#d17f20"; g.lineWidth = 1.1; g.beginPath();
        g.moveTo(px, top); g.lineTo(px, bottom); g.stroke();
      }
      this.put("compareDifferenceStatus", validCount ? this.text("differenceClipped") : this.text("differenceNoSignal"));
    }
  }
  return Object.freeze({ Controller, words, MAX_TOTAL_PCM_BYTES, DEFAULTS, DIFFERENCE_FLOOR_DB,
    totalBytes, overlayModel, matchedSpectra, differenceModel, differenceAt });
});
