/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Local PCM inspection. Source samples, analysis and audition gain are separate.
 */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./sound-wave-reader.js") : root.SoundLabWaveReader,
    node ? require("./sound-analysis-dsp.js") : root.SoundLabAnalysisDSP,
    node ? require("./sound-analysis-examples.js") : root.SoundLabAnalysisExamples);
  if (node) module.exports = api;
  if (root) root.SoundLabAnalysis = api;
})(typeof window !== "undefined" ? window : null, function (reader, dsp, examples) {
  "use strict";
  const words = {
    en: {
      title: "Analyze a sound", intro: "Choose an example or open a WAV to inspect its waveform and frequency content.",
      classLabel: "Class", exampleLabel: "Example", open: "Open WAV…", local: "Local file",
      generated: "Generated signal", modeled: "Modeled instrument", imported: "Your local file",
      play: "▶ Play", pause: "Ⅱ Pause", playSelection: "Play selection", volume: "Listening volume",
      atCursor: "At cursor", average: "Selection average", modes: "Spectrum analysis mode",
      channel: "Analysis channel", left: "Left", right: "Right", mono: "Mono", stereo: "Stereo",
      cancel: "Cancel", recalculate: "Recalculate", settings: "Analysis settings",
      fftSize: "FFT window length · samples", frequencyAxis: "Frequency axis", linear: "Linear", log: "Logarithmic",
      settingsHint: "Hann window. Waveform zoom does not change the FFT length. Source samples and source sample rate are preserved.",
      fileDetails: "File details and limits",
      limits: "RIFF-WAV: 8/16/24/32-bit PCM or 32-bit float; mono/stereo. Up to 120 seconds, 32 MiB input and 64 MiB decoded samples. Nothing is uploaded.",
      unsupportedFormats: "Compressed WAV, RF64, RIFX and WAVE_FORMAT_EXTENSIBLE are not supported yet. No microphone is used.",
      waveform: "Waveform", waveHelp: "Click to inspect. Drag the A/B handles at the top to select an interval.",
      zoomIn: "+ Zoom", zoomOut: "− Zoom", fit: "Fit", panLeft: "Pan left", panRight: "Pan right",
      cursor: "Inspection cursor · s", cursorSlider: "Move the inspection cursor through the whole sound",
      selectionStart: "A · Selection start (s)", selectionEnd: "B · Selection end (s)", selectAll: "Select all",
      keyboardHelp: "←/→ moves the cursor (Shift: larger step). Use the start/end fields for exact selection. Inspection and playback positions are independent.",
      spectrum: "Frequency content", frequencyReadout: "Frequency · Hz",
      spectrumNote: "Amplitude dB is relative to a unit-peak sample, not acoustic dB SPL. The average is a power average, not density per Hz.",
      selectedDuration: "Selected duration", peak: "Peak sample", rms: "RMS level",
      levelNote: "Measurements use the original samples in the selected channel and interval. Listening volume does not change them.",
      ready: "Ready. Sound starts only when you press Play.", loading: "Preparing source…", calculating: "Analyzing…",
      cancelled: "Cancelled. The current source is unchanged.", stopped: "Stopped. Your source and selection are kept.",
      complete: "Ready. Inspect the waveform or listen.", errorInvalid: "This is not a supported, well-formed WAV file. The previous sound is kept.",
      errorUnsupported: "This source or WAV encoding is not supported in this browser. The previous sound is kept.",
      errorLimit: "The file exceeds a supported limit: 120 seconds, 32 MiB input, 64 MiB decoded samples or 4,096 metadata/audio chunks. It was not truncated.",
      errorNonfinite: "The WAV contains non-finite sample values and cannot be analyzed. The previous sound is kept.",
      errorGeneric: "Could not prepare this sound. The previous sound is kept; try another example or WAV.",
      errorAnalysis: "Analysis could not finish. Try a smaller FFT window or selection.",
      errorTime: "Enter a time within this sound; selection start must be before its end.",
      errorPlayback: "This browser could not play this source/rate. Its samples can still be analyzed.",
      starting: "Preparing playback…", playing: "Playing", paused: "Paused", idle: "Not playing",
      listening: "Start quietly. Playback uses the original channels; the channel picker changes analysis only.",
      attenuation: "Audition is attenuated by {db} dB to keep samples within full scale; source measurements are unchanged.",
      windowInfo: "Hann · {n} samples · {ms} ms · bin spacing {hz} Hz · Nyquist {nyq} Hz",
      windowExtent: "Window {start}–{end} s; source overlap {actualStart}–{actualEnd} s.",
      padded: "{count} samples are zero-padded. Padding adds no new information.",
      averageInfo: "{count} windows averaged in power; {padded} padded window(s). Bin spacing is not a resolution guarantee.",
      dc: "DC", bin: "bin", seconds: "s", hz: "Hz", frame: "sample", encoding: "Encoding",
      generatedEncoding: "Generated Float32 samples", noSource: "Choose an example or open a WAV.",
      warning: "Selected samples reach or approach digital full scale; clipping is possible. Reducing listening volume cannot repair clipped source samples.",
      view: "View {start}–{end} s · waveform scale ±{scale}",
      legend: "Orange: inspection / FFT · A/B: selection · blue dashed: playback",
      waveAria: "PCM waveform with inspection cursor and selection handles; arrow keys move the cursor",
      spectrumAria: "Hann-window amplitude spectrum of the selected source channel",
      noUpload: "This WAV stays on your device. No upload or microphone access.",
      frequencyValue: "{hz} Hz · {db} dB · amplitude {value}", logDC: "Log axis omits DC; DC amplitude {value}.",
      cursorPosition: "Cursor {time} s", selected: "Selection"
    },
    mn: {
      title: "Дуу шинжлэх", intro: "Жишээ сонгох эсвэл WAV файл нээж, долгион ба давтамжийн бүрэлдэхүүнийг шинжлээрэй.",
      classLabel: "Бүлэг", exampleLabel: "Жишээ", open: "WAV нээх…", local: "Төхөөрөмжийн файл",
      generated: "Тооцоолж үүсгэсэн авиа", modeled: "Хөгжмийн загвар", imported: "Таны төхөөрөмжийн файл",
      play: "▶ Тоглуулах", pause: "Ⅱ Түр зогсоох", playSelection: "Хэсгийг тоглуулах", volume: "Сонсох дууны хэмжээ",
      atCursor: "Курсор дээр", average: "Хэсгийн дундаж", modes: "Давтамж шинжлэх горим",
      channel: "Шинжлэх суваг", left: "Зүүн", right: "Баруун", mono: "Моно", stereo: "Стерео",
      cancel: "Болих", recalculate: "Дахин тооцоолох", settings: "Шинжилгээний тохиргоо",
      fftSize: "FFT цонхны урт · сорьц", frequencyAxis: "Давтамжийн тэнхлэг", linear: "Шугаман", log: "Логарифмын",
      settingsHint: "Hann цонх. FFT-ийн урт долгионыг томруулахад өөрчлөгдөхгүй. Сорьцын утга болон эх давтамжийг хэвээр хадгална.",
      fileDetails: "Файлын тухай ба хязгаар",
      limits: "RIFF-WAV: 8/16/24/32-бит PCM эсвэл 32-бит float; 1–2 суваг. 120 секунд, 32 МиБ файл, 64 МиБ задарсан сорьц хүртэл. Серверт илгээхгүй.",
      unsupportedFormats: "Шахсан WAV, RF64, RIFX, WAVE_FORMAT_EXTENSIBLE одоогоор дэмжихгүй. Микрофон ашиглахгүй.",
      waveform: "Долгионы хэлбэр", waveHelp: "Дарж курсор байрлуулна. Дээд талын A/B бариулаар хэсэг сонгоно.",
      zoomIn: "+ Томруулах", zoomOut: "− Багасгах", fit: "Бүтнээр", panLeft: "Зүүн тийш", panRight: "Баруун тийш",
      cursor: "Шинжлэх курсор · сек", cursorSlider: "Бүтэн дууны дагуу шинжлэх курсор хөдөлгөх",
      selectionStart: "A · Хэсгийн эхлэл (сек)", selectionEnd: "B · Хэсгийн төгсгөл (сек)", selectAll: "Бүгдийг сонгох",
      keyboardHelp: "←/→ товчоор курсор хөдөлгөнө (Shift: том алхам). Эхлэл/төгсгөлийн тоон талбараар нарийн хэсэг сонгоно. Курсор ба тоглуулах байрлал тусдаа.",
      spectrum: "Давтамжийн бүрэлдэхүүн", frequencyReadout: "Давтамж · Гц",
      spectrumNote: "Амплитудын dB: 1 нэгж оргил сорьцтой харьцуулсан, акустик dB SPL биш. Дундаж нь чадлуудын дундаж; Гц тутмын нягт биш.",
      selectedDuration: "Сонгосон хугацаа", peak: "Оргил сорьц", rms: "RMS түвшин",
      levelNote: "Хэмжилт нь сонгосон суваг, хэсгийн эх сорьцод хамаарна. Сонсох чангыг өөрчлөхөд хэмжилт өөрчлөгдөхгүй.",
      ready: "Бэлэн. Зөвхөн Тоглуулах товчийг дарахад дуу гарна.", loading: "Дууг бэлтгэж байна…", calculating: "Шинжилж байна…",
      cancelled: "Болилоо. Одоогийн дуу өөрчлөгдөөгүй.", stopped: "Зогслоо. Дуу болон сонгосон хэсэг хэвээр.",
      complete: "Бэлэн. Долгионыг шинжлэх эсвэл сонсож болно.",
      errorInvalid: "Зөв бүтэцтэй, дэмжигдсэн WAV файл биш байна. Өмнөх дуу хэвээр үлдлээ.",
      errorUnsupported: "Энэ дуу эсвэл WAV кодлолыг хөтөч дэмжихгүй байна. Өмнөх дуу хэвээр үлдлээ.",
      errorLimit: "120 секунд, 32 МиБ файл, 64 МиБ задарсан сорьц эсвэл 4,096 мета өгөгдөл/аудио хэсгийн хязгаараас хэтэрсэн. Файлыг тайраагүй.",
      errorNonfinite: "WAV дотор төгсгөлгүй эсвэл тодорхойгүй сорьц байна. Өмнөх дуу хэвээр үлдлээ.",
      errorGeneric: "Дууг бэлтгэж чадсангүй. Өмнөх дуу хэвээр; өөр жишээ эсвэл WAV сонгоно уу.",
      errorAnalysis: "Шинжилгээг дуусгаж чадсангүй. FFT цонх эсвэл сонгосон хэсгийг багасгаж үзнэ үү.",
      errorTime: "Дууны хүрээнд хугацаа оруулна уу. Хэсгийн эхлэл төгсгөлөөсөө өмнө байх ёстой.",
      errorPlayback: "Хөтөч энэ дуу эсвэл сорьцлох давтамжаар тоглуулж чадсангүй. Сорьцыг шинжлэх боломжтой хэвээр.",
      starting: "Тоглуулахаар бэлтгэж байна…", playing: "Тоглож байна", paused: "Түр зогссон", idle: "Тоглуулаагүй",
      listening: "Сул дуугаар эхлээрэй. Эх сувгуудаар тоглоно; суваг сонголт зөвхөн шинжилгээнд хамаарна.",
      attenuation: "Сонсох сорьцыг хязгаарт багтаахын тулд {db} dB сулруулсан. Эх сорьцын хэмжилт өөрчлөгдөөгүй.",
      windowInfo: "Hann · {n} сорьц · {ms} мс · алхам {hz} Гц · Найквист {nyq} Гц",
      windowExtent: "Цонх {start}–{end} сек; эх дууны давхцал {actualStart}–{actualEnd} сек.",
      padded: "{count} сорьцыг тэгээр нөхсөн. Нөхөх нь шинэ мэдээлэл нэмэхгүй.",
      averageInfo: "{count} цонхны чадлыг дундажлав; {padded} цонх тэгээр нөхөгдсөн. Алхам нь ялгах чадварын баталгаа биш.",
      dc: "Тогтмол", bin: "алхам", seconds: "сек", hz: "Гц", frame: "сорьц", encoding: "Кодлол",
      generatedEncoding: "Тооцоолж үүсгэсэн Float32 сорьц", noSource: "Жишээ сонгох эсвэл WAV нээнэ үү.",
      warning: "Сонгосон сорьц дижитал дээд хэмжээнд хүрсэн эсвэл ойртсон байна; таслагдсан байж болно. Сонсох чангыг сулруулах нь эх сорьцын таслалтыг засахгүй.",
      view: "Харагдац {start}–{end} сек · долгионы хуваарь ±{scale}",
      legend: "Улбар шар: курсор / FFT · A/B: сонгосон хэсэг · цэнхэр тасархай: тоглуулах байрлал",
      waveAria: "Эх сорьцын долгион, шинжлэх курсор, хэсгийн бариул; суман товчоор курсор хөдөлгөнө",
      spectrumAria: "Сонгосон сувгийн Hann цонхтой амплитудын спектр",
      noUpload: "WAV таны төхөөрөмжид үлдэнэ. Серверт илгээхгүй, микрофон ашиглахгүй.",
      frequencyValue: "{hz} Гц · {db} dB · амплитуд {value}", logDC: "Лог тэнхлэгт тогтмол хэсэг орохгүй; түүний амплитуд {value}.",
      cursorPosition: "Курсор {time} сек", selected: "Сонгосон хэсэг"
    }
  };
  const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
  const db = value => value > 0 ? 20 * Math.log10(value) : -Infinity;
  const number = (value, digits = 3) => !Number.isFinite(value) ? "−∞" :
    (Math.abs(value) > 1e6 || (Math.abs(value) > 0 && Math.abs(value) < 1e-4)) ? value.toExponential(2) :
      Number(value.toFixed(digits)).toString();
  const safeName = name => String(name || "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 180);

  class Controller {
    constructor({ document, window, contextOwner, ...models }) {
      this.document = document;
      this.window = window;
      this.contextOwner = contextOwner;
      this.models = models;
      this.language = "mn";
      this.active = false;
      this.pcm = null;
      this.indexes = [];
      this.source = null;
      this.channel = 0;
      this.fftSize = 4096;
      this.axis = "linear";
      this.spectrumMode = "local";
      this.cursor = .25;
      this.start = 0;
      this.end = 0;
      this.viewStart = 0;
      this.viewSpan = 0;
      this.frequency = 440;
      this.volume = .2;
      this.loadTicket = 0;
      this.analysisTicket = 0;
      this.playbackTicket = 0;
      this.sourceBusy = false;
      this.analysisBusy = false;
      this.spectrum = null;
      this.measure = null;
      this.statusKey = "ready";
      this.statusProgress = null;
      this.error = false;
      this.position = 0;
      this.playEnd = 0;
      this.playing = false;
      this.starting = false;
      this.paused = false;
      this.voice = null;
      this.frame = null;
      this.analysisTimer = null;
      this.drag = null;
      this.bind();
      this.renderLanguage("mn");
    }
    $(id) { return this.document.getElementById(id); }
    text(key, values = {}) {
      return String(words[this.language][key] || words.en[key] || key)
        .replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
    }
    put(id, value) { this.$(id).textContent = value; }
    yieldTask() { return new Promise(resolve => this.window.setTimeout(resolve, 0)); }
    on(id, event, callback) { this.$(id).addEventListener(event, callback); }
    bind() {
      this.on("analysisClass", "change", event => {
        const first = examples.CATALOGUE.find(item => item.classId === event.target.value);
        if (first) this.loadExample(first.id);
      });
      this.on("analysisExample", "change", event => this.loadExample(event.target.value));
      this.on("analysisOpen", "click", () => this.$("analysisFile").click());
      this.on("analysisFile", "change", event => {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (file) this.openFile(file);
      });
      this.on("analysisPlay", "click", () => {
        if (this.isPlaying()) this.pause();
        else this.play(false);
      });
      this.on("analysisPlaySelection", "click", () => this.play(true));
      this.on("analysisVolume", "input", event => {
        this.volume = clamp(Number(event.target.value) || 0, 0, 100) / 100;
        if (this.voice) this.voice.gain.gain.setTargetAtTime(this.volume, this.contextOwner.context.currentTime, .01);
        this.renderControls();
      });
      this.on("analysisAtCursor", "click", () => this.setSpectrumMode("local"));
      this.on("analysisAverage", "click", () => this.setSpectrumMode("average"));
      this.on("analysisChannel", "change", event => {
        if (!this.pcm) return;
        this.channel = clamp(Number(event.target.value) || 0, 0, this.pcm.channels.length - 1);
        this.measure = null;
        this.recompute(true);
        this.drawWave();
      });
      this.on("analysisFFT", "change", event => {
        const n = Number(event.target.value);
        if (![1024, 4096, 16384, 65536].includes(n)) return;
        this.fftSize = n;
        this.recompute(false);
        this.drawWave();
      });
      this.on("analysisAxis", "change", event => {
        this.axis = event.target.value === "log" ? "log" : "linear";
        this.renderMeasurements();
        this.drawSpectrum();
      });
      this.on("analysisCancel", "click", () => this.cancelWork());
      this.on("analysisRetry", "click", () => this.pcm ? this.recompute(true) : this.loadExample(examples.CATALOGUE[0].id));
      this.on("analysisZoomIn", "click", () => this.zoom(.5));
      this.on("analysisZoomOut", "click", () => this.zoom(2));
      this.on("analysisFit", "click", () => {
        if (!this.pcm) return;
        this.viewStart = 0; this.viewSpan = this.pcm.duration; this.drawWave();
      });
      this.on("analysisPanLeft", "click", () => this.pan(-1));
      this.on("analysisPanRight", "click", () => this.pan(1));
      this.on("analysisCursor", "change", event => this.setCursor(Number(event.target.value)));
      this.on("analysisCursorSlider", "input", event => this.setCursor(Number(event.target.value), true));
      this.on("analysisStart", "change", event => this.setSelection(Number(event.target.value), this.end));
      this.on("analysisEnd", "change", event => this.setSelection(this.start, Number(event.target.value)));
      this.on("analysisSelectAll", "click", () => { if (this.pcm) this.setSelection(0, this.pcm.duration); });
      this.on("analysisFrequency", "input", event => {
        if (!this.pcm || !Number.isFinite(Number(event.target.value))) return;
        this.frequency = clamp(Number(event.target.value), 0, this.pcm.sampleRate / 2);
        this.renderFrequency(); this.drawSpectrum();
      });
      this.on("analysisWaveCanvas", "pointerdown", event => this.pointerDown(event));
      this.on("analysisWaveCanvas", "pointermove", event => { if (this.drag) this.pointerMove(event); });
      this.on("analysisWaveCanvas", "pointerup", event => this.pointerEnd(event));
      this.on("analysisWaveCanvas", "pointercancel", event => this.pointerEnd(event));
      this.on("analysisWaveCanvas", "keydown", event => {
        if (!this.pcm || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const delta = Math.max(1 / this.pcm.sampleRate, this.viewSpan / (event.shiftKey ? 10 : 100));
        const time = event.key === "Home" ? 0 : event.key === "End" ? this.pcm.duration :
          this.cursor + (event.key === "ArrowRight" ? delta : -delta);
        this.setCursor(clamp(time, 0, this.pcm.duration), true);
      });
      this.on("analysisSpectrumCanvas", "pointermove", event => this.spectrumPointer(event));
      this.on("analysisSpectrumCanvas", "pointerdown", event => this.spectrumPointer(event));
    }
    setActive(active) {
      if (this.active === active) return;
      this.active = active;
      if (!active) this.stop();
      else if (!this.pcm && !this.sourceBusy) this.loadExample(examples.CATALOGUE[0].id);
      else if (!this.spectrum) this.recompute(true);
      this.draw();
    }
    async loadExample(id) {
      const entry = examples.CATALOGUE.find(item => item.id === id);
      if (!entry) return;
      return this.load(options => examples.create(id, { ...this.models, ...options }),
        { kind: entry.kind, classId: entry.classId, exampleId: id });
    }
    async openFile(file) {
      return this.load(async options => {
        if (!Number.isFinite(file.size) || file.size > reader.MAX_INPUT_BYTES) {
          const error = new Error("Input size"); error.code = "limit"; throw error;
        }
        const bytes = await file.arrayBuffer();
        if (options.isCancelled()) { const error = new Error("Cancelled"); error.code = "cancelled"; throw error; }
        return reader.decode(bytes, options);
      }, { kind: "imported", classId: "local", name: safeName(file.name) });
    }
    async load(create, source) {
      if (this.sourceBusy) return false;
      this.stopPlayback(true);
      this.invalidateAnalysis();
      const ticket = ++this.loadTicket;
      this.sourceBusy = true;
      this.status("loading");
      const isCancelled = () => ticket !== this.loadTicket || !this.active;
      try {
        await this.yieldTask();
        if (isCancelled()) return false;
        const pcm = await create({ isCancelled, yieldTask: () => this.yieldTask(),
          onProgress: progress => { if (!isCancelled()) this.progress("loading", progress * .65); } });
        if (isCancelled()) return false;
        const indexes = [];
        for (let channel = 0; channel < pcm.channels.length; channel++) {
          indexes.push(await dsp.buildWaveformIndex(pcm.channels[channel], { isCancelled,
            yieldTask: () => this.yieldTask(), onProgress: progress => {
              if (!isCancelled()) this.progress("loading", .65 + .35 * (channel + progress) / pcm.channels.length);
            } }));
        }
        if (isCancelled()) return false;
        // Atomic replacement: failures/cancel before this point keep the prior source.
        this.pcm = pcm; this.indexes = indexes; this.source = source; this.channel = 0;
        this.waveEnvelope = null;
        this.cursor = source.kind === "generated" ? pcm.duration / 2 : Math.min(.25, pcm.duration / 2);
        this.start = 0; this.end = pcm.duration;
        this.viewStart = 0; this.viewSpan = pcm.duration; this.position = 0;
        this.frequency = Math.min(440, pcm.sampleRate / 2);
        this.measure = null; this.spectrum = null;
        this.sourceBusy = false;
        this.renderSource(); this.renderControls(); this.drawWave();
        await this.recompute(true);
        return true;
      } catch (error) {
        if (!isCancelled()) {
          this.status(({ invalid: "errorInvalid", unsupported: "errorUnsupported", limit: "errorLimit",
            nonfinite: "errorNonfinite", cancelled: "cancelled" })[error.code] || "errorGeneric", error.code !== "cancelled");
        }
        return false;
      } finally {
        if (ticket === this.loadTicket) { this.sourceBusy = false; this.renderSource(); this.renderControls(); }
      }
    }
    invalidateAnalysis() {
      this.analysisTicket++;
      if (this.analysisTimer !== null) this.window.clearTimeout(this.analysisTimer);
      this.analysisTimer = null;
      this.analysisBusy = false;
    }
    cancelWork() {
      this.loadTicket++;
      this.sourceBusy = false;
      this.invalidateAnalysis();
      this.status("cancelled"); this.renderSource();
    }
    scheduleAnalysis(measurements = false) {
      this.invalidateAnalysis();
      this.spectrum = null;
      if (measurements) this.measure = null;
      this.renderMeasurements(); this.drawSpectrum();
      this.analysisTimer = this.window.setTimeout(() => {
        this.analysisTimer = null; this.recompute(measurements);
      }, 60);
    }
    async recompute(updateMeasurements = true) {
      this.invalidateAnalysis();
      if (!this.active || !this.pcm || this.sourceBusy) return;
      const ticket = this.analysisTicket;
      const isCancelled = () => ticket !== this.analysisTicket || !this.active;
      const pcm = this.pcm, index = this.indexes[this.channel], n = this.fftSize;
      const cursor = this.cursor, start = this.start, end = this.end, mode = this.spectrumMode;
      this.spectrum = null;
      if (updateMeasurements) this.measure = null;
      this.analysisBusy = true;
      this.status("calculating");
      this.renderMeasurements(); this.drawSpectrum();
      try {
        await this.yieldTask();
        if (isCancelled()) return;
        const options = { isCancelled, yieldTask: () => this.yieldTask(),
          onProgress: progress => { if (!isCancelled()) this.progress("calculating", progress); } };
        const measure = updateMeasurements || !this.measure ?
          await dsp.measurements(index, pcm.sampleRate, start, end, { isCancelled, yieldTask: options.yieldTask }) : this.measure;
        if (isCancelled()) return;
        const spectrum = mode === "average" ?
          await dsp.spectrumAverage(index.samples, pcm.sampleRate, start, end, n, options) :
          dsp.spectrumAt(index.samples, pcm.sampleRate, cursor, n);
        if (isCancelled()) return;
        this.measure = measure; this.spectrum = spectrum;
        this.analysisBusy = false; this.status("complete");
        this.renderMeasurements(); this.draw();
      } catch (error) {
        if (!isCancelled()) { this.analysisBusy = false; this.status("errorAnalysis", true); }
      } finally {
        if (!isCancelled()) { this.analysisBusy = false; this.renderControls(); }
      }
    }
    setSpectrumMode(mode) {
      if (mode === this.spectrumMode) return;
      this.spectrumMode = mode; this.recompute(false); this.renderControls(); this.drawWave();
    }
    setCursor(value, delayed = false) {
      if (!this.pcm) return;
      if (!Number.isFinite(value) || value < 0 || value > this.pcm.duration) {
        this.status("errorTime", true); this.renderTimes(); return;
      }
      this.cursor = Math.round(value * this.pcm.sampleRate) / this.pcm.sampleRate;
      if (this.cursor < this.viewStart || this.cursor > this.viewStart + this.viewSpan) {
        this.viewStart = clamp(this.cursor - this.viewSpan / 2, 0, this.pcm.duration - this.viewSpan);
      }
      if (this.spectrumMode === "local") delayed ? this.scheduleAnalysis(false) : this.recompute(false);
      this.renderTimes(); this.drawWave();
    }
    setSelection(start, end, delayed = false) {
      if (!this.pcm) return;
      const fs = this.pcm.sampleRate;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > this.pcm.duration ||
          Math.round(start * fs) >= Math.round(end * fs)) {
        this.status("errorTime", true); this.renderTimes(); return;
      }
      this.start = Math.round(start * fs) / fs; this.end = Math.round(end * fs) / fs;
      delayed ? this.scheduleAnalysis(true) : this.recompute(true);
      this.renderTimes(); this.drawWave();
    }
    zoom(factor) {
      if (!this.pcm) return;
      const center = this.cursor >= this.viewStart && this.cursor <= this.viewStart + this.viewSpan ?
        this.cursor : this.viewStart + this.viewSpan / 2;
      this.viewSpan = clamp(this.viewSpan * factor, Math.min(this.pcm.duration, 16 / this.pcm.sampleRate), this.pcm.duration);
      this.viewStart = clamp(center - this.viewSpan / 2, 0, this.pcm.duration - this.viewSpan);
      this.drawWave();
    }
    pan(direction) {
      if (!this.pcm) return;
      this.viewStart = clamp(this.viewStart + direction * this.viewSpan / 2, 0, this.pcm.duration - this.viewSpan);
      this.drawWave();
    }
    timeFromPointer(event) {
      const rect = this.$("analysisWaveCanvas").getBoundingClientRect();
      return this.viewStart + clamp((event.clientX - rect.left - 50) / Math.max(1, rect.width - 66), 0, 1) * this.viewSpan;
    }
    pointerDown(event) {
      if (!this.pcm || this.sourceBusy || event.button > 0) return;
      event.preventDefault();
      const canvas = this.$("analysisWaveCanvas"), rect = canvas.getBoundingClientRect();
      const time = this.timeFromPointer(event), tolerance = 18 / Math.max(1, rect.width - 66) * this.viewSpan;
      const nearTop = event.clientY - rect.top < 48;
      const startDistance = Math.abs(time - this.start), endDistance = Math.abs(time - this.end);
      const target = nearTop && Math.min(startDistance, endDistance) < tolerance ?
        (startDistance <= endDistance ? "start" : "end") : "cursor";
      this.drag = { id: event.pointerId, target };
      canvas.setPointerCapture?.(event.pointerId);
      canvas.focus?.({ preventScroll: true });
      this.pointerMove(event);
    }
    pointerMove(event) {
      if (!this.drag || this.drag.id !== event.pointerId || !this.pcm) return;
      const time = this.timeFromPointer(event), step = 1 / this.pcm.sampleRate;
      if (this.drag.target === "start") this.setSelection(clamp(time, 0, this.end - step), this.end, true);
      else if (this.drag.target === "end") this.setSelection(this.start, clamp(time, this.start + step, this.pcm.duration), true);
      else this.setCursor(time, true);
    }
    pointerEnd(event) {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      const changedSelection = this.drag.target !== "cursor";
      this.drag = null;
      if (this.$("analysisWaveCanvas").hasPointerCapture?.(event.pointerId)) this.$("analysisWaveCanvas").releasePointerCapture(event.pointerId);
      if (changedSelection || this.spectrumMode === "local") this.recompute(changedSelection);
    }
    isPlaying() { return this.playing || this.starting; }
    currentPosition() {
      if (!this.playing || !this.voice) return this.position;
      return Math.min(this.playEnd, this.voice.offset + this.contextOwner.context.currentTime - this.voice.startedAt);
    }
    stopPlayback(reset = true) {
      this.position = reset ? 0 : this.currentPosition();
      this.playbackTicket++;
      this.playing = false; this.starting = false;
      if (this.frame !== null) this.window.cancelAnimationFrame(this.frame);
      this.frame = null;
      const voice = this.voice;
      this.voice = null;
      if (voice) {
        voice.node.onended = null;
        try { voice.gain.gain.cancelScheduledValues(this.contextOwner.context.currentTime);
          voice.gain.gain.setValueAtTime(0, this.contextOwner.context.currentTime); voice.node.stop(); } catch (_) { /* Already stopped. */ }
        voice.node.disconnect(); voice.envelope.disconnect(); voice.gain.disconnect();
        try { voice.node.buffer = null; } catch (_) { /* Browser can release it on collection. */ }
      }
      if (reset) { this.paused = false; this.playEnd = 0; }
      this.renderPlayback(); this.drawWave();
    }
    pause() { this.stopPlayback(false); this.paused = true; this.renderPlayback(); }
    stop() {
      this.stopPlayback(true);
      const busy = this.sourceBusy || this.analysisBusy || this.analysisTimer !== null;
      this.loadTicket++; this.sourceBusy = false; this.invalidateAnalysis();
      if (this.pcm || busy) this.status("stopped");
      this.renderSource();
    }
    async play(selection = false) {
      if (!this.active || !this.pcm || this.sourceBusy) return false;
      const pcm = this.pcm;
      let offset = selection ? this.start : this.position;
      let end = selection ? this.end : (this.paused && this.playEnd > offset ? this.playEnd : pcm.duration);
      if (offset >= end) offset = 0;
      this.stopPlayback(false);
      const ticket = ++this.playbackTicket;
      this.starting = true; this.paused = false; this.renderPlayback();
      const cancelled = () => ticket !== this.playbackTicket || !this.active || this.pcm !== pcm;
      let buffer;
      try {
        const context = await this.contextOwner.readyContext();
        if (cancelled()) return false;
        buffer = context.createBuffer(pcm.channels.length, pcm.frames, pcm.sampleRate);
        // Scale only this audition copy before the audio graph. Float-WAV values
        // above 1 remain intact in source PCM and cannot overload downstream nodes.
        const attenuation = pcm.peak > .98 ? .98 / pcm.peak : 1;
        for (let c = 0; c < pcm.channels.length; c++) {
          const target = buffer.getChannelData(c), samples = pcm.channels[c];
          for (let start = 0; start < samples.length; start += 131072) {
            if (cancelled()) return false;
            const stop = Math.min(samples.length, start + 131072);
            for (let i = start; i < stop; i++) target[i] = samples[i] * attenuation;
            await this.yieldTask();
          }
        }
        if (cancelled()) return false;
        const node = context.createBufferSource(), envelope = context.createGain(), gain = context.createGain();
        node.buffer = buffer;
        const now = context.currentTime, duration = end - offset, ramp = Math.min(.008, duration / 3);
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(1, now + ramp);
        envelope.gain.setValueAtTime(1, now + Math.max(ramp, duration - ramp));
        envelope.gain.linearRampToValueAtTime(0, now + duration);
        gain.gain.setValueAtTime(this.volume, now);
        node.connect(envelope); envelope.connect(gain); gain.connect(this.contextOwner.output);
        this.voice = { node, envelope, gain, offset, startedAt: now };
        this.position = offset; this.playEnd = end;
        this.starting = false; this.playing = true;
        node.onended = () => {
          if (this.voice?.node !== node) return;
          this.position = end; this.stopPlayback(false); this.paused = false; this.renderPlayback();
        };
        node.start(now, offset, duration);
        this.renderPlayback(); this.followPlayback();
        return true;
      } catch (_) {
        if (!cancelled()) {
          this.stopPlayback(true);
          this.put("analysisPlaybackStatus", this.text("errorPlayback"));
        }
        return false;
      } finally {
        buffer = null;
        if (ticket === this.playbackTicket) { this.starting = false; this.renderControls(); }
      }
    }
    followPlayback() {
      if (!this.playing) return;
      this.drawWave(); this.renderPlayback();
      this.frame = this.window.requestAnimationFrame(() => { this.frame = null; this.followPlayback(); });
    }
    status(key, error = false) {
      this.statusKey = key; this.error = error; this.statusProgress = null;
      this.renderControls();
    }
    progress(key, progress) {
      this.statusKey = key; this.statusProgress = clamp(progress, 0, 1);
      this.put("analysisStatus", this.text(key) + " " + Math.round(this.statusProgress * 100) + "%");
    }
    options(id, entries, value) {
      const select = this.$(id);
      select.replaceChildren(...entries.map(([key, label]) => {
        const option = this.document.createElement("option"); option.value = key; option.textContent = label; return option;
      }));
      select.value = String(value);
    }
    renderLanguage(language) {
      this.language = language === "en" ? "en" : "mn";
      this.document.querySelectorAll("[data-analysis-i18n]").forEach(element => {
        element.textContent = this.text(element.getAttribute("data-analysis-i18n"));
      });
      for (const [id, key] of [["analysisSpectrumModes", "modes"], ["analysisPanLeft", "panLeft"],
        ["analysisPanRight", "panRight"], ["analysisCursorSlider", "cursorSlider"],
        ["analysisWaveCanvas", "waveAria"], ["analysisSpectrumCanvas", "spectrumAria"]]) this.$(id).setAttribute("aria-label", this.text(key));
      this.renderSource(); this.renderControls(); this.renderMeasurements(); this.renderPlayback(); this.draw();
    }
    renderSource() {
      const entry = examples.CATALOGUE.find(item => item.id === this.source?.exampleId);
      const classes = examples.CLASSES.map(item => [item.id, item.title[this.language]]);
      if (this.source?.kind === "imported") classes.push(["local", this.text("local")]);
      const classId = this.source?.classId || examples.CATALOGUE[0].classId;
      this.options("analysisClass", classes, classId);
      this.options("analysisExample", classId === "local" ? [["local", this.source.name]] :
        examples.CATALOGUE.filter(item => item.classId === classId).map(item => [item.id, item.title[this.language]]),
        classId === "local" ? "local" : (entry?.id || examples.CATALOGUE[0].id));
      this.options("analysisChannel", this.pcm?.channels.length === 2 ?
        [["0", this.text("left")], ["1", this.text("right")]] : [["0", this.text("mono")]], this.channel);
      this.$("analysisChannelField").hidden = this.pcm?.channels.length !== 2;
      this.put("analysisSourceName", entry ? entry.title[this.language] : (this.source?.name || this.text("noSource")));
      this.put("analysisSourceDescription", entry ? entry.description[this.language] : this.text("noUpload"));
      const pcm = this.pcm;
      this.put("analysisSourceInfo", pcm ? `${this.text(this.source.kind)} · ${number(pcm.duration)} ${this.text("seconds")} · ${number(pcm.sampleRate)} ${this.text("hz")} · ${this.text(pcm.channels.length === 2 ? "stereo" : "mono")}` : "");
      this.put("analysisEncoding", pcm ? `${this.text("encoding")}: ${pcm.encoding === "generated-float32" ? this.text("generatedEncoding") : pcm.encoding}` : "");
      const attenuation = pcm?.peak > .98 ? .98 / pcm.peak : 1;
      this.put("analysisListeningHint", this.text("listening") + (attenuation < 1 ? " " + this.text("attenuation", { db: number(-db(attenuation), 1) }) : ""));
      this.renderTimes();
    }
    renderControls() {
      for (const id of ["analysisClass", "analysisExample", "analysisOpen"]) this.$(id).disabled = this.sourceBusy;
      for (const id of ["analysisPlay", "analysisPlaySelection", "analysisAtCursor", "analysisAverage",
        "analysisFFT", "analysisChannel", "analysisCursor", "analysisCursorSlider", "analysisStart", "analysisEnd",
        "analysisZoomIn", "analysisZoomOut", "analysisFit", "analysisSelectAll", "analysisFrequency"])
        this.$(id).disabled = !this.pcm || this.sourceBusy;
      this.$("analysisCancel").hidden = !this.sourceBusy && !this.analysisBusy;
      this.$("analysisRetry").hidden = this.sourceBusy || this.analysisBusy || (!!this.spectrum && this.statusKey !== "errorAnalysis");
      for (const [id, mode] of [["analysisAtCursor", "local"], ["analysisAverage", "average"]]) {
        this.$(id).setAttribute("aria-pressed", String(mode === this.spectrumMode));
        this.$(id).classList.toggle("selected", mode === this.spectrumMode);
      }
      this.$("analysisStatus").classList.toggle("error", this.error);
      this.put("analysisStatus", this.text(this.statusKey) + (this.statusProgress === null ? "" : " " + Math.round(this.statusProgress * 100) + "%"));
      this.put("analysisVolumeValue", Math.round(this.volume * 100) + "%");
      this.put("analysisPlay", this.text(this.isPlaying() ? "pause" : "play"));
      this.$("analysisPlay").setAttribute("aria-pressed", String(this.isPlaying()));
      this.$("analysisWorkspace").setAttribute("aria-busy", String(this.sourceBusy));
    }
    renderPlayback() {
      this.put("analysisPlay", this.text(this.isPlaying() ? "pause" : "play"));
      this.$("analysisPlay").setAttribute("aria-pressed", String(this.isPlaying()));
      const key = this.starting ? "starting" : this.playing ? "playing" : this.paused ? "paused" : "idle";
      this.put("analysisPlaybackStatus", this.text(key) + (this.pcm ? ` · ${number(this.currentPosition(), 2)} / ${number(this.pcm.duration, 2)} ${this.text("seconds")}` : ""));
    }
    renderTimes() {
      const fs = this.pcm?.sampleRate || 44100, duration = this.pcm?.duration || 0;
      for (const [id, value] of [["analysisStart", this.start], ["analysisEnd", this.end],
        ["analysisCursor", this.cursor], ["analysisCursorSlider", this.cursor]]) {
        const input = this.$(id);
        input.value = String(Math.min(duration, Number(value.toFixed(8)))); input.max = String(duration);
        input.step = id === "analysisCursorSlider" ? String(1 / fs) : "any";
      }
      this.$("analysisFrequency").max = String(fs / 2);
      this.$("analysisFrequency").value = String(Number(this.frequency.toFixed(4)));
    }
    renderMeasurements() {
      const measure = this.measure, pcm = this.pcm, spectrum = this.spectrum;
      this.put("analysisDuration", measure ? `${number(measure.duration, 5)} ${this.text("seconds")}` : "—");
      this.put("analysisPeak", measure ? `${number(measure.peak, 5)} · ${number(db(measure.peak), 2)} dB` : "—");
      this.put("analysisRMS", measure ? `${number(measure.rms, 5)} · ${number(db(measure.rms), 2)} dB` : "—");
      const bits = /^PCM(8|16|24|32)$/.exec(pcm?.encoding || "");
      const fullScaleThreshold = bits ? Math.min(.9999, 1 - 2 ** (1 - Number(bits[1]))) : .9999;
      this.$("analysisLevelWarning").hidden = !measure || measure.peak < fullScaleThreshold;
      this.put("analysisLevelWarning", this.text("warning"));
      this.put("analysisFFTInfo", pcm ? this.text("windowInfo", { n: this.fftSize,
        ms: number(1000 * this.fftSize / pcm.sampleRate, 2), hz: number(pcm.sampleRate / this.fftSize, 3), nyq: number(pcm.sampleRate / 2) }) : "");
      let padding = "";
      if (spectrum) {
        padding = this.spectrumMode === "average" ? this.text("averageInfo", { count: spectrum.windowCount, padded: spectrum.paddedWindowCount || 0 }) :
          this.text("windowExtent", { start: number(spectrum.windowStart, 4), end: number(spectrum.windowEnd, 4),
            actualStart: number(spectrum.actualStart, 4), actualEnd: number(spectrum.actualEnd, 4) });
        if (spectrum.paddedSamples) padding += " " + this.text("padded", { count: spectrum.paddedSamples });
        if (this.axis === "log") padding += " " + this.text("logDC", { value: number(spectrum.magnitudes[0], 5) });
      }
      this.put("analysisPadding", padding);
      this.renderFrequency();
    }
    renderFrequency() {
      if (!this.spectrum) { this.put("analysisSpectrumReadout", "—"); return; }
      const bin = clamp(Math.round(this.frequency / this.spectrum.binHz), 0, this.spectrum.magnitudes.length - 1);
      const value = this.spectrum.magnitudes[bin];
      this.put("analysisSpectrumReadout", this.text("frequencyValue", {
        hz: number(bin * this.spectrum.binHz, 3), db: number(db(value), 2), value: number(value, 5) }));
    }
    canvas(id) {
      if (!this.active) return null;
      const canvas = this.$(id), rect = canvas.getBoundingClientRect();
      if (!rect.width) return null;
      const width = Math.max(160, Math.round(rect.width)), height = Math.max(160, Math.round(rect.height || 255));
      const ratio = Math.min(2, this.window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
      if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      ctx.font = "11px system-ui, sans-serif"; ctx.lineWidth = 1; ctx.setLineDash([]);
      return { ctx, width, height, left: 50, right: width - 16, top: 38, bottom: height - 32 };
    }
    draw() { this.drawWave(); this.drawSpectrum(); }
    drawWave() {
      const p = this.canvas("analysisWaveCanvas");
      if (!p || !this.pcm || !this.indexes[this.channel]) return;
      const { ctx, left, right, top, bottom, width } = p, index = this.indexes[this.channel];
      const scale = Math.max(1, index.peak), mid = (top + bottom) / 2, half = (bottom - top) / 2;
      const x = time => left + (time - this.viewStart) / this.viewSpan * (right - left);
      const y = value => mid - value / scale * half;
      const end = Math.min(this.pcm.duration, this.viewStart + this.viewSpan);
      ctx.fillStyle = "#d9eee9";
      const a = clamp(x(this.start), left, right), b = clamp(x(this.end), left, right);
      ctx.fillRect(a, top, b - a, bottom - top);
      if (this.spectrumMode === "local") {
        ctx.fillStyle = "#f8dcb2";
        const n = this.fftSize / this.pcm.sampleRate;
        const a = clamp(x(this.cursor - n / 2), left, right), b = clamp(x(this.cursor + n / 2), left, right);
        ctx.fillRect(a, top, b - a, bottom - top);
      }
      ctx.strokeStyle = "#d6e2ed"; ctx.fillStyle = "#627e96"; ctx.textAlign = "right";
      for (const value of [-scale, 0, scale]) {
        ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke();
        ctx.fillText(number(value, 2), left - 7, y(value) + 4);
      }
      const ticks = width < 420 ? 2 : 4;
      for (let i = 0; i <= ticks; i++) {
        const xx = left + (right - left) * i / ticks;
        ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, bottom); ctx.stroke();
        ctx.textAlign = i === 0 ? "left" : i === ticks ? "right" : "center";
        ctx.fillText(number(this.viewStart + this.viewSpan * i / ticks, 4), xx, bottom + 19);
      }
      ctx.strokeStyle = "#258d98"; ctx.lineWidth = 1.2; ctx.beginPath();
      const fs = this.pcm.sampleRate, first = Math.max(0, Math.floor(this.viewStart * fs));
      const last = Math.min(index.samples.length - 1, Math.ceil(end * fs));
      if (last - first <= (right - left) * 1.5) {
        for (let i = first; i <= last; i++) {
          const xx = clamp(x(i / fs), left, right);
          if (i === first) ctx.moveTo(xx, y(index.samples[i])); else ctx.lineTo(xx, y(index.samples[i]));
        }
      } else {
        const count = Math.max(1, Math.min(2048, Math.floor(right - left)));
        if (!this.waveEnvelope || this.waveEnvelope.index !== index || this.waveEnvelope.start !== this.viewStart ||
            this.waveEnvelope.end !== end || this.waveEnvelope.count !== count) {
          this.waveEnvelope = { index, start: this.viewStart, end, count,
            data: dsp.waveformEnvelope(index, this.viewStart, end, count, fs) };
        }
        const envelope = this.waveEnvelope.data;
        for (let i = 0; i < count; i++) {
          const xx = left + (i + .5) * (right - left) / count;
          if (envelope.minima[i] === envelope.maxima[i]) {
            ctx.moveTo(xx - .5, y(envelope.minima[i])); ctx.lineTo(xx + .5, y(envelope.maxima[i]));
          } else {
            ctx.moveTo(xx, y(envelope.minima[i])); ctx.lineTo(xx, y(envelope.maxima[i]));
          }
        }
      }
      ctx.stroke();
      if (last - first < 64) {
        ctx.fillStyle = "#258d98";
        for (let i = first; i <= last; i++) {
          ctx.beginPath(); ctx.arc(clamp(x(i / fs), left, right), y(index.samples[i]), 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (const [time, label] of [[this.start, "A"], [this.end, "B"]]) {
        if (time < this.viewStart || time > end) continue;
        const xx = x(time);
        ctx.strokeStyle = "#27645f"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, bottom); ctx.stroke();
        ctx.fillStyle = "#27645f"; ctx.beginPath(); ctx.moveTo(xx - 8, top - 12); ctx.lineTo(xx + 8, top - 12); ctx.lineTo(xx, top); ctx.closePath(); ctx.fill();
        ctx.textAlign = "center"; ctx.fillText(label, clamp(xx, left + 5, right - 5), top - 17);
      }
      if (this.cursor >= this.viewStart && this.cursor <= end) {
        ctx.strokeStyle = "#cf7a22"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x(this.cursor), top); ctx.lineTo(x(this.cursor), bottom); ctx.stroke();
      }
      if (this.playing || this.paused) {
        const position = this.currentPosition();
        if (position >= this.viewStart && position <= end) {
          ctx.strokeStyle = "#2f63c3"; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(x(position), top); ctx.lineTo(x(position), bottom); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      this.put("analysisViewReadout", this.text("view", { start: number(this.viewStart, 4), end: number(end, 4), scale: number(scale, 2) }) + " · " + this.text("legend"));
      this.$("analysisPanLeft").disabled = this.viewStart <= 0 || this.sourceBusy;
      this.$("analysisPanRight").disabled = end >= this.pcm.duration - 1e-9 || this.sourceBusy;
    }
    frequencyToFraction(frequency) {
      const max = this.pcm.sampleRate / 2;
      if (this.axis !== "log") return frequency / max;
      const min = this.pcm.sampleRate / this.fftSize;
      return Math.log(Math.max(min, frequency) / min) / Math.log(max / min);
    }
    spectrumPointer(event) {
      if (!this.pcm) return;
      const rect = this.$("analysisSpectrumCanvas").getBoundingClientRect();
      const fraction = clamp((event.clientX - rect.left - 50) / Math.max(1, rect.width - 66), 0, 1);
      const max = this.pcm.sampleRate / 2, min = this.pcm.sampleRate / this.fftSize;
      this.frequency = this.axis === "log" ? min * Math.pow(max / min, fraction) : max * fraction;
      this.$("analysisFrequency").value = String(Number(this.frequency.toFixed(3)));
      this.renderFrequency(); this.drawSpectrum();
    }
    drawSpectrum() {
      const p = this.canvas("analysisSpectrumCanvas");
      if (!p || !this.pcm) return;
      const { ctx, left, right, top, bottom, width } = p;
      // This scale is fixed for the whole source, not recomputed for quiet tails.
      const high = Math.max(0, Math.ceil(db(2 * this.indexes[this.channel].peak) / 20) * 20);
      const low = high - 100;
      const y = value => bottom - (clamp(value, low, high) - low) / (high - low) * (bottom - top);
      const x = frequency => left + this.frequencyToFraction(frequency) * (right - left);
      ctx.strokeStyle = "#d6e2ed"; ctx.fillStyle = "#627e96"; ctx.textAlign = "right";
      for (let value = low; value <= high; value += 20) {
        ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke();
        ctx.fillText(String(value), left - 7, y(value) + 4);
      }
      ctx.textAlign = "left"; ctx.fillText("dB", left, 19);
      const max = this.pcm.sampleRate / 2, min = this.pcm.sampleRate / this.fftSize;
      const ticks = this.axis === "linear" ? [0, max / 4, max / 2, max * .75, max] :
        Array.from({ length: 12 }, (_, i) => 10 ** (Math.floor(Math.log10(min)) + i)).filter(f => f >= min && f <= max);
      for (let i = 0; i < ticks.length; i++) {
        if (width < 420 && this.axis === "linear" && i % 2 === 1) continue;
        const xx = x(ticks[i]);
        ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, bottom); ctx.stroke();
        ctx.textAlign = xx > right - 25 ? "right" : xx < left + 25 ? "left" : "center";
        ctx.fillText(number(ticks[i], 1), xx, bottom + 19);
      }
      if (!this.spectrum) return;
      const magnitudes = this.spectrum.magnitudes;
      const columns = Math.max(1, Math.min(2048, Math.ceil(right - left)));
      const peaks = new Float64Array(columns); peaks.fill(-Infinity);
      for (let k = this.axis === "log" ? 1 : 0; k < magnitudes.length; k++) {
        const column = clamp(Math.floor(this.frequencyToFraction(k * this.spectrum.binHz) * columns), 0, columns - 1);
        peaks[column] = Math.max(peaks[column], db(magnitudes[k]));
      }
      ctx.strokeStyle = "#2d73bc"; ctx.lineWidth = 1.5; ctx.beginPath();
      let began = false;
      for (let i = 0; i < columns; i++) {
        if (!Number.isFinite(peaks[i])) continue;
        const xx = left + i * (right - left) / Math.max(1, columns - 1);
        if (!began) { ctx.moveTo(xx, y(peaks[i])); began = true; } else ctx.lineTo(xx, y(peaks[i]));
      }
      ctx.stroke();
      if (this.axis !== "log" || this.frequency > 0) {
        const xx = clamp(x(this.frequency), left, right);
        ctx.strokeStyle = "#cf7a22"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, bottom); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
  return Object.freeze({ Controller, messages: words });
});
