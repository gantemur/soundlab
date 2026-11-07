/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * C1/C2a: two independent local PCM sources, linked inspection and spectral overlay.
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
      maxHz: "Upper frequency", nyquist: "Full range (Nyquist)", visualTitle: "Waveform & spectrum",
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
      overlayTitle: "Overlay spectra A/B", overlayIntro: "Compare the two spectra on one frequency axis, without resampling.",
      linkCursors: "Link inspection times (seconds)", normalizeOverlay: "Normalize each displayed spectral peak",
      overlayNote: "Native Hann windows use the same sample count but may span different times. Peak normalization affects only this overlay, not the source audio or the two separate spectra.",
      overlayWaiting: "Choose two sounds to compare their spectra.",
      overlayInfo: "{scale} · A: {a} · B: {b}{missing}",
      overlayAbsolute: "Original levels (dBFS)", overlayRelative: "Each displayed peak = 0 dB",
      overlayWindow: "{ms} ms Hann · {bin} Hz/bin · cursor {time} s",
      overlayUnavailable: "no source", overlayMissing: " · above {hz} Hz, only the higher-rate source has samples",
      overlayAria: "Two spectra with shared frequency and level axes",
      disclaimer: "Native sample rates and durations may differ. Both spectra use fixed −100…0 dBFS without automatic level matching, time alignment or resampling. This is not an acoustic dB SPL measurement."
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
      maxHz: "Дээд давтамж", nyquist: "Бүх давтамж (Найквист)", visualTitle: "Долгион ба спектр",
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
      overlayTitle: "A/B спектрийг давхарлах", overlayIntro: "Сорьцлолтыг өөрчлөхгүйгээр нэг давтамжийн тэнхлэг дээр харьцуулна.",
      linkCursors: "Шинжлэх хугацааг (сек) холбох", normalizeOverlay: "Харагдах спектр бүрийн оргилыг нормчлох",
      overlayNote: "Hann цонхны сорьцын тоо ижил боловч хугацааны урт өөр байж болно. Оргилын нормчлол нь зөвхөн энэ давхар зурагт нөлөөлнө; эх авиа, тусдаа спектрүүд өөрчлөгдөхгүй.",
      overlayWaiting: "Хоёр авиа сонгож, спектрүүдийг харьцуулаарай.",
      overlayInfo: "{scale} · A: {a} · B: {b}{missing}",
      overlayAbsolute: "Эх түвшин (dBFS)", overlayRelative: "Харагдах оргил бүр = 0 dB",
      overlayWindow: "Hann {ms} мс · {bin} Гц/алхам · курсор {time} сек",
      overlayUnavailable: "авиа байхгүй", overlayMissing: " · {hz} Гц-ээс дээш зөвхөн өндөр сорьцлолттой авиа",
      overlayAria: "Ижил давтамж, түвшний тэнхлэгтэй A/B спектр",
      disclaimer: "Сорьцлох давтамж болон хугацаа өөр байж болно. Хоёр спектр тогтмол −100…0 dBFS хуваарьтай; дууны түвшин, хугацаа, сорьцлолтыг автоматаар тааруулахгүй. Акустик dB SPL хэмжилт биш."
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
          else this.drawOverlay();
        } else this.drawOverlay();
      });
      this.$("compareNormalize").addEventListener("change", event => {
        this.normalizeOverlay = Boolean(event.target.checked);
        this.drawOverlay();
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
      this.$("compareKindModes").setAttribute("aria-label", this.text("kindModes"));
      this.render();
      this.drawOverlay();
    }
    render() {
      for (const key of ["A", "B"]) this.renderSlot(key);
      this.put("compareVolumeValue", Math.round(this.volume * 100) + "%");
      this.$("compareLinkCursors").checked = this.linkCursors;
      this.$("compareNormalize").checked = this.normalizeOverlay;
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
    draw() { for (const key of ["A", "B"]) this.drawSlot(key, false); this.drawOverlay(); }
    drawSlot(key, includeOverlay = true) {
      const s = this.slots[key], pcm = s.pcm;
      if (!pcm || !s.index || !this.active || s.busy) {
        if (includeOverlay) this.drawOverlay();
        return;
      }
      if (!s.spectrum || s.spectrum.fftSize !== this.fftSize) {
        s.spectrum = dsp.spectrumAt(pcm.channels[s.channel], pcm.sampleRate, s.cursor, this.fftSize);
      }
      this.drawWave(key); this.drawSpectrum(key);
      this.put(`compare${key}Measure`, this.text("measure", { peak: fmt(s.index.peak, 4), rms: fmt(s.index.rms, 4) }));
      if (includeOverlay) this.drawOverlay();
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
  }
  return Object.freeze({ Controller, words, MAX_TOTAL_PCM_BYTES, DEFAULTS, totalBytes, overlayModel });
});
