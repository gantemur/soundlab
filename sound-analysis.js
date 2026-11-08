/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Local PCM inspection. Source samples, analysis and audition gain are separate.
 */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./sound-wave-reader.js") : root.SoundLabWaveReader,
    node ? require("./sound-analysis-dsp.js") : root.SoundLabAnalysisDSP,
    node ? require("./sound-analysis-examples.js") : root.SoundLabAnalysisExamples,
    node ? require("./sound-analysis-spectrogram.js") : root.SoundLabSpectrogram);
  if (node) module.exports = api;
  if (root) root.SoundLabAnalysis = api;
})(typeof window !== "undefined" ? window : null, function (reader, dsp, examples, spectro) {
  "use strict";
  const words = {
    en: {
      title: "Analyze a sound", intro: "Choose an example, open a WAV, or capture microphone sound.",
      classLabel: "Class", exampleLabel: "Example", open: "Open WAV…", microphoneButton: "Microphone…", local: "Local file",
      microphoneClass: "Microphone capture", microphone: "Recorded with microphone",
      micRollingDescription: "Last 30 seconds (or less) captured from your microphone. Stored only on this device; never uploaded.",
      micTakeDescription: "Explicit microphone take captured on this device. It is separate from WAV files and synthesized examples.",
      generated: "Generated signal", modeled: "Modeled instrument", recorded: "Real recording", imported: "Your local file",
      recordingCredit: "Recording by", spectroMaxHz: "Spectrogram upper frequency", spectroFullRange: "Full range (Nyquist)",
      top2k: "2,000 Hz", top5k: "5,000 Hz", top10k: "10,000 Hz",
      prepared: "Prepared Sound Lab WAV", chooseView: "Analysis view", chooseSection: "Analysis sub-tabs", kindSingle: "Single source",
      kindCompare: "Compare", viewSpectrum: "Spectrum", viewSpectro: "Spectrogram",
      spectrogram: "Time–frequency spectrogram", spectroFFT: "Spectrogram window · samples",
      spectroInfo: "Hann · {n} samples ({ms} ms) · hop {hop} ms · {axis} frequency · {low}–{high} dB (unit peak)",
      spectroHint: "Same time range, cursor, and A/B selection as the waveform. Color is Hann-window amplitude relative to a unit-peak sample, not dB SPL. Select a point for time and frequency.",
      spectroCalculating: "Preparing bounded spectrogram tiles…", spectroReady: "Spectrogram ready.",
      spectroError: "Spectrogram could not finish; try a shorter window or zoom in.",
      spectroAria: "Linked time–frequency spectrogram; click or use left/right for time and up/down for frequency",
      play: "▶ Play", pause: "Ⅱ Pause", playSelection: "Play selection", volume: "Listening volume",
      atCursor: "At cursor", average: "Selection average", modes: "Spectrum analysis mode",
      channel: "Analysis channel", left: "Left", right: "Right", mono: "Mono", stereo: "Stereo",
      cancel: "Cancel", recalculate: "Recalculate", settings: "Analysis settings",
      fftSize: "FFT window length · samples", frequencyAxis: "Frequency axis", linear: "Linear", log: "Logarithmic",
      settingsHint: "Hann window. Waveform zoom does not change the FFT length. Source samples and source sample rate are preserved.",
      fileDetails: "File details and limits",
      limits: "RIFF-WAV: 8/16/24/32-bit PCM or 32-bit float; mono/stereo. Up to 120 seconds, 32 MiB input and 64 MiB decoded samples. Nothing is uploaded.",
      unsupportedFormats: "Compressed WAV, RF64, RIFX and WAVE_FORMAT_EXTENSIBLE are not supported yet. Opening a WAV does not use the microphone.",
      waveform: "Waveform", waveHelp: "Click to inspect. Drag the A/B handles at the top to select an interval.",
      zoomIn: "+ Zoom", zoomOut: "− Zoom", fit: "Fit", panLeft: "Pan left", panRight: "Pan right",
      cursor: "Inspection cursor · s", cursorSlider: "Move the inspection cursor through the whole sound",
      selectionStart: "A · Selection start (s)", selectionEnd: "B · Selection end (s)", selectAll: "Select all",
      selectionHeading: "Analysis interval · A–B",
      selectionEffect: "A–B controls Play selection, peak/RMS measurements and Selection average. At cursor uses only the orange inspection cursor.",
      keyboardHelp: "←/→ moves the cursor (Shift: larger step). Use the start/end fields for exact selection. Inspection and playback positions are independent.",
      spectrum: "Frequency content", frequencyReadout: "Frequency · Hz",
      cursorModeHint: "At cursor: the spectrum comes from the orange cursor's FFT window; A–B does not restrict this view.",
      averageModeHint: "Selection average: FFT window powers are averaged over A–B. Change A–B to analyze a different interval.",
      frequencyMin: "Start frequency · Hz", frequencyMax: "End frequency · Hz",
      spectrumZoomLabel: "Spectrum frequency range", spectrumPanLeft: "Pan frequency left", spectrumPanRight: "Pan frequency right",
      errorFrequency: "Enter a frequency range inside the available axis, with the end greater than the start.",
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
      errorUnavailable: "Could not load this bundled recording. Try again once the page is fully available.",
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
      noUpload: "This WAV stays on your device. Opening it does not access the microphone.",
      frequencyValue: "{hz} Hz · {db} dB · amplitude {value}", logDC: "Log axis omits DC; DC amplitude {value}.",
      cursorPosition: "Cursor {time} s", selected: "Selection"
    },
    mn: {
      title: "Дуу шинжлэх", intro: "Жишээ сонгох, WAV нээх эсвэл микрофоны авиаг бичиж шинжлээрэй.",
      classLabel: "Бүлэг", exampleLabel: "Жишээ", open: "WAV нээх…", microphoneButton: "Микрофон…", local: "Төхөөрөмжийн файл",
      microphoneClass: "Микрофоны бичлэг", microphone: "Микрофоноор бичсэн авиа",
      micRollingDescription: "Микрофоны сүүлийн 30 секунд (эсвэл түүнээс богино) бичлэг. Зөвхөн төхөөрөмжид хадгалсан; серверт илгээгээгүй.",
      micTakeDescription: "Таны тусгайлан бичсэн микрофоны авиа. WAV файлаас болон тооцоолж үүсгэсэн авианаас тусдаа эх үүсвэр.",
      generated: "Тооцоолж үүсгэсэн авиа", modeled: "Хөгжмийн загвар", recorded: "Бодит бичлэг", imported: "Таны төхөөрөмжийн файл",
      recordingCredit: "Бичлэгийн эх", spectroMaxHz: "Спектрограммын дээд давтамж", spectroFullRange: "Бүх давтамж (Найквист)",
      top2k: "2,000 Гц", top5k: "5,000 Гц", top10k: "10,000 Гц",
      prepared: "Sound Lab-д бэлдсэн WAV", chooseView: "Шинжилгээний харагдац", chooseSection: "Шинжилгээний хэсэг", kindSingle: "Нэг авиа",
      kindCompare: "Харьцуулах", viewSpectrum: "Спектр", viewSpectro: "Спектрограмм",
      spectrogram: "Хугацаа–давтамжийн спектрограмм", spectroFFT: "Спектрограммын цонх · сорьц",
      spectroInfo: "Hann · {n} сорьц ({ms} мс) · алхам {hop} мс · {axis} давтамж · {low}–{high} dB (нэгж оргил)",
      spectroHint: "Долгионтой ижил хугацааны хүрээ, курсор, A/B хэсэгтэй. Өнгө нь нэгж оргил сорьцтой харьцуулсан Hann амплитуд, dB SPL биш. Дарж хугацаа ба давтамж сонгоно.",
      spectroCalculating: "Хязгаарлагдсан спектрограммын хэсгүүдийг бэлдэж байна…", spectroReady: "Спектрограмм бэлэн.",
      spectroError: "Спектрограммыг тооцоолж чадсангүй. Цонхыг богиносгох эсвэл хугацааг томруулна уу.",
      spectroAria: "Долгионтой холбоотой спектрограмм; дарж эсвэл зүүн/баруун сумаар хугацаа, дээш/доош сумаар давтамж сонгоно",
      play: "▶ Тоглуулах", pause: "Ⅱ Түр зогсоох", playSelection: "Хэсгийг тоглуулах", volume: "Сонсох дууны хэмжээ",
      atCursor: "Курсор дээр", average: "Хэсгийн дундаж", modes: "Давтамж шинжлэх горим",
      channel: "Шинжлэх суваг", left: "Зүүн", right: "Баруун", mono: "Моно", stereo: "Стерео",
      cancel: "Болих", recalculate: "Дахин тооцоолох", settings: "Шинжилгээний тохиргоо",
      fftSize: "FFT цонхны урт · сорьц", frequencyAxis: "Давтамжийн тэнхлэг", linear: "Шугаман", log: "Логарифмын",
      settingsHint: "Hann цонх. FFT-ийн урт долгионыг томруулахад өөрчлөгдөхгүй. Сорьцын утга болон эх давтамжийг хэвээр хадгална.",
      fileDetails: "Файлын тухай ба хязгаар",
      limits: "RIFF-WAV: 8/16/24/32-бит PCM эсвэл 32-бит float; 1–2 суваг. 120 секунд, 32 МиБ файл, 64 МиБ задарсан сорьц хүртэл. Серверт илгээхгүй.",
      unsupportedFormats: "Шахсан WAV, RF64, RIFX, WAVE_FORMAT_EXTENSIBLE одоогоор дэмжихгүй. WAV нээхэд микрофон ашиглахгүй.",
      waveform: "Долгионы хэлбэр", waveHelp: "Дарж курсор байрлуулна. Дээд талын A/B бариулаар хэсэг сонгоно.",
      zoomIn: "+ Томруулах", zoomOut: "− Багасгах", fit: "Бүтнээр", panLeft: "Зүүн тийш", panRight: "Баруун тийш",
      cursor: "Шинжлэх курсор · сек", cursorSlider: "Бүтэн дууны дагуу шинжлэх курсор хөдөлгөх",
      selectionStart: "A · Хэсгийн эхлэл (сек)", selectionEnd: "B · Хэсгийн төгсгөл (сек)", selectAll: "Бүгдийг сонгох",
      selectionHeading: "Шинжлэх хэсэг · A–B",
      selectionEffect: "A–B хэсэг нь хэсгийг тоглуулах, оргил/RMS хэмжих болон «Хэсгийн дундаж» спектрт үйлчилнэ. «Курсор дээр» спектр зөвхөн улбар шар курсороос хамаарна.",
      keyboardHelp: "←/→ товчоор курсор хөдөлгөнө (Shift: том алхам). Эхлэл/төгсгөлийн тоон талбараар нарийн хэсэг сонгоно. Курсор ба тоглуулах байрлал тусдаа.",
      spectrum: "Давтамжийн бүрэлдэхүүн", frequencyReadout: "Давтамж · Гц",
      cursorModeHint: "Курсор дээр: спектр нь улбар шар курсорын FFT цонхноос гарна. A–B хэсэг үүнийг хязгаарлахгүй.",
      averageModeHint: "Хэсгийн дундаж: A–B доторх FFT цонхнуудын чадлыг дундажлана. A–B-г хөдөлгөж өөр хэсгийг шинжилнэ.",
      frequencyMin: "Эхлэх давтамж · Гц", frequencyMax: "Төгсөх давтамж · Гц",
      spectrumZoomLabel: "Спектрийн давтамжийн хүрээ", spectrumPanLeft: "Давтамжийг зүүн тийш шилжүүлэх", spectrumPanRight: "Давтамжийг баруун тийш шилжүүлэх",
      errorFrequency: "Тэнхлэгийн боломжит хүрээнд эхлэх давтамжаас их төгсөх давтамж оруулна уу.",
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
      errorUnavailable: "Энд хадгалсан бичлэгийг ачаалж чадсангүй. Хуудас бүрэн бэлэн болсны дараа дахин оролдоно уу.",
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
      noUpload: "WAV таны төхөөрөмжид үлдэнэ. Нээхэд микрофонд хандахгүй.",
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
      this.spectroFFT = 1024;
      this.spectroMaxHz = 5000;
      this.axis = "linear";
      this.spectrumMode = "local";
      this.analysisView = "spectrum";
      this.cursor = .25;
      this.start = 0;
      this.end = 0;
      this.viewStart = 0;
      this.viewSpan = 0;
      this.frequency = 440;
      this.spectrumWindow = null; // Frequency DISPLAY only. FFT sample count stays independent.
      this.volume = .2;
      this.loadTicket = 0;
      this.analysisTicket = 0;
      this.spectroTicket = 0;
      this.playbackTicket = 0;
      this.sourceBusy = false;
      this.analysisBusy = false;
      this.spectroBusy = false;
      this.spectrum = null;
      this.spectrogram = null;
      this.spectroBitmap = null;
      this.spectroCache = new spectro.TileCache();
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
      this.lastPlaybackDrawTime = -Infinity;
      this.ignorePointerClick = false;
      this.pointerClickTimer = null;
      this.analysisTimer = null;
      this.spectroTimer = null;
      this.drag = null;
      this.bind();
      this.renderLanguage("mn");
    }
    $(id) { return this.document.getElementById(id); }
    text(key, values = {}) {
      return String(words[this.language][key] || words.en[key] || key)
        .replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
    }
    put(id, value) {
      const target = this.$(id);
      // Replacing even an unchanged button text node during a touch gesture
      // can invalidate the eventual click on some WebKit devices.
      if (target.textContent !== value) target.textContent = value;
    }
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
      // Pointerdown remains deliverable when a browser drops the subsequent
      // click during canvas repainting. Stop the sounding node immediately;
      // suppress the synthetic click so it cannot start playback again.
      this.on("analysisPlay", "pointerdown", event => {
        if (event.button !== 0 || !this.isPlaying()) {
          this.ignorePointerClick = false;
          return;
        }
        this.pause();
        this.ignorePointerClick = true;
        if (this.pointerClickTimer !== null) this.window.clearTimeout(this.pointerClickTimer);
        this.pointerClickTimer = this.window.setTimeout(() => {
          this.ignorePointerClick = false;
          this.pointerClickTimer = null;
        }, 800);
      });
      this.on("analysisPlay", "click", event => {
        if (this.ignorePointerClick && event.detail !== 0) {
          this.ignorePointerClick = false;
          if (this.pointerClickTimer !== null) this.window.clearTimeout(this.pointerClickTimer);
          this.pointerClickTimer = null;
          return;
        }
        this.ignorePointerClick = false;
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
      this.on("analysisViewSpectrum", "click", () => this.setView("spectrum"));
      this.on("analysisViewSpectro", "click", () => this.setView("spectrogram"));
      this.on("analysisChannel", "change", event => {
        if (!this.pcm) return;
        this.channel = clamp(Number(event.target.value) || 0, 0, this.pcm.channels.length - 1);
        this.measure = null;
        this.recompute(true);
        this.drawWave();
        this.scheduleSpectrogram();
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
        this.spectrumWindow = null; // A fitted axis is unambiguous across linear/log switches.
        this.renderSpectrumWindow();
        this.renderMeasurements();
        this.drawSpectrum();
        this.scheduleSpectrogram();
      });
      this.on("analysisSpectroFFT", "change", event => {
        const size = Number(event.target.value);
        if (!spectro.FFT_SIZES.includes(size)) return;
        this.spectroFFT = size;
        this.scheduleSpectrogram();
      });
      this.on("analysisSpectroMaxHz", "change", event => {
        const cap = event.target.value === "all" ? null : Number(event.target.value);
        if (cap !== null && ![2000, 5000, 10000].includes(cap)) return;
        this.spectroMaxHz = cap;
        if (this.pcm) this.frequency = Math.min(this.frequency, this.maxVisibleHz());
        this.scheduleSpectrogram();
      });
      this.on("analysisCancel", "click", () => this.cancelWork());
      this.on("analysisRetry", "click", () => {
        if (!this.pcm) this.loadExample(examples.CATALOGUE[0].id);
        else if (this.analysisView === "spectrogram") this.scheduleSpectrogram();
        else this.recompute(true);
      });
      this.on("analysisZoomIn", "click", () => this.zoom(.5));
      this.on("analysisZoomOut", "click", () => this.zoom(2));
      this.on("analysisFit", "click", () => {
        if (!this.pcm) return;
        this.viewStart = 0; this.viewSpan = this.pcm.duration; this.drawWave(); this.scheduleSpectrogram();
      });
      this.on("analysisPanLeft", "click", () => this.pan(-1));
      this.on("analysisPanRight", "click", () => this.pan(1));
      this.on("analysisCursor", "change", event => this.setCursor(Number(event.target.value)));
      this.on("analysisCursorSlider", "input", event => this.setCursor(Number(event.target.value), true));
      this.on("analysisStart", "change", event => this.setSelection(Number(event.target.value), this.end));
      this.on("analysisEnd", "change", event => this.setSelection(this.start, Number(event.target.value)));
      this.on("analysisSelectAll", "click", () => { if (this.pcm) this.setSelection(0, this.pcm.duration); });
      this.on("analysisSpectrumZoomIn", "click", () => this.zoomSpectrum(.5));
      this.on("analysisSpectrumZoomOut", "click", () => this.zoomSpectrum(2));
      this.on("analysisSpectrumFit", "click", () => { this.spectrumWindow = null; this.renderSpectrumWindow(); this.drawSpectrum(); });
      this.on("analysisSpectrumPanLeft", "click", () => this.panSpectrum(-1));
      this.on("analysisSpectrumPanRight", "click", () => this.panSpectrum(1));
      for (const id of ["analysisSpectrumMin", "analysisSpectrumMax"]) {
        this.on(id, "change", () => {
          this.setSpectrumWindow(Number(this.$("analysisSpectrumMin").value), Number(this.$("analysisSpectrumMax").value));
        });
      }
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
      this.on("analysisSpectroCanvas", "pointerdown", event => this.spectrogramPointer(event));
      this.on("analysisSpectroCanvas", "keydown", event => {
        if (!this.pcm || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        if (["ArrowUp", "ArrowDown"].includes(event.key)) {
          const delta = event.shiftKey ? .1 : .02;
          const fraction = clamp(spectro.frequencyFraction(this.frequency, this.pcm.sampleRate,
            this.spectroFFT, this.axis, this.maxVisibleHz()) + (event.key === "ArrowUp" ? delta : -delta), 0, 1);
          this.frequency = spectro.frequencyAtFraction(fraction, this.pcm.sampleRate, this.spectroFFT,
            this.axis, this.maxVisibleHz());
          this.drawSpectrogram();
        } else {
          this.setCursor(clamp(this.cursor + (event.key === "ArrowRight" ? 1 : -1) *
            Math.max(1 / this.pcm.sampleRate, this.viewSpan / (event.shiftKey ? 10 : 100)), 0, this.pcm.duration), true);
        }
      });
    }
    setActive(active) {
      if (this.active === active) return;
      this.active = active;
      if (!active) this.stop();
      else if (!this.pcm && !this.sourceBusy) this.loadExample(examples.CATALOGUE[0].id);
      else if (!this.spectrum) this.recompute(true);
      if (active && this.analysisView === "spectrogram" && this.pcm) this.scheduleSpectrogram();
      this.draw();
    }
    async loadExample(id) {
      const entry = examples.CATALOGUE.find(item => item.id === id);
      if (!entry) return;
      return this.load(options => examples.create(id, { ...this.models, ...options }),
        { kind: entry.kind, classId: entry.classId, exampleId: id, origin: "catalogue" });
    }
    maxVisibleHz() {
      return Math.min(this.pcm?.sampleRate / 2 || 22050, this.spectroMaxHz ?? Infinity);
    }
    async openFile(file) {
      return this.load(async options => {
        if (!Number.isFinite(file.size) || file.size > reader.MAX_INPUT_BYTES) {
          const error = new Error("Input size"); error.code = "limit"; throw error;
        }
        const bytes = await file.arrayBuffer();
        if (options.isCancelled()) { const error = new Error("Cancelled"); error.code = "cancelled"; throw error; }
        return reader.decode(bytes, options);
      }, { kind: "imported", classId: "local", origin: "file", name: safeName(file.name) });
    }
    // REC and Compose keep their already prepared Blob. The same bounded WAV
    // decoder as Open WAV is used, without a download, upload, or extra PCM cache.
    async openPrepared(blob, name, provenance = null) {
      if (!blob || typeof blob.arrayBuffer !== "function" || !Number.isFinite(blob.size)) return false;
      if (this.sourceBusy) this.cancelWork(); // Supersede lazy first example on tab entry.
      const source = provenance?.kind === "microphone" ? {
        kind: "microphone", classId: "microphone", origin: "microphone",
        captureMode: provenance.captureMode === "take" ? "take" : "rolling",
        recordedAt: String(provenance.recordedAt || ""), name: safeName(name || "microphone.wav")
      } : { kind: "prepared", classId: "local", origin: "soundlab", name: safeName(name || "sound-lab.wav") };
      return this.load(async options => {
        if (blob.size > reader.MAX_INPUT_BYTES) {
          const error = new Error("Input size"); error.code = "limit"; throw error;
        }
        const bytes = await blob.arrayBuffer();
        if (options.isCancelled()) { const error = new Error("Cancelled"); error.code = "cancelled"; throw error; }
        return reader.decode(bytes, options);
      }, source);
    }
    async load(create, source) {
      if (this.sourceBusy) return false;
      this.stopPlayback(true);
      this.invalidateAnalysis();
      this.invalidateSpectrogram(true);
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
        this.spectrumWindow = null;
        this.measure = null; this.spectrum = null;
        this.spectroCache.clear();
        this.sourceBusy = false;
        this.renderSource(); this.renderControls(); this.drawWave();
        await this.recompute(true);
        this.scheduleSpectrogram();
        return true;
      } catch (error) {
        if (!isCancelled()) {
          this.status(({ invalid: "errorInvalid", unsupported: "errorUnsupported", limit: "errorLimit",
            nonfinite: "errorNonfinite", unavailable: "errorUnavailable", cancelled: "cancelled" })[error.code] || "errorGeneric", error.code !== "cancelled");
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
    invalidateSpectrogram(clear = false) {
      this.spectroTicket++;
      if (this.spectroTimer !== null) this.window.clearTimeout(this.spectroTimer);
      this.spectroTimer = null;
      this.spectroBusy = false;
      if (clear) {
        this.spectrogram = null;
        this.spectroBitmap = null;
      }
    }
    scheduleSpectrogram() {
      if (this.analysisView !== "spectrogram" || !this.active || !this.pcm || this.sourceBusy) {
        this.invalidateSpectrogram();
        return;
      }
      this.invalidateSpectrogram(true);
      this.put("analysisSpectroStatus", this.text("spectroCalculating"));
      this.spectroTimer = this.window.setTimeout(() => {
        this.spectroTimer = null;
        this.computeSpectrogram();
      }, 55);
      this.drawSpectrogram();
    }
    async computeSpectrogram() {
      this.invalidateSpectrogram(true);
      if (this.analysisView !== "spectrogram" || !this.active || !this.pcm || this.sourceBusy) return;
      const ticket = this.spectroTicket, pcm = this.pcm, channel = this.channel;
      const start = this.viewStart, end = Math.min(pcm.duration, start + this.viewSpan);
      const size = this.spectroFFT, axis = this.axis, maxHz = this.maxVisibleHz();
      const cancelled = () => ticket !== this.spectroTicket || !this.active ||
        this.pcm !== pcm || this.analysisView !== "spectrogram";
      this.spectroBusy = true;
      this.put("analysisSpectroStatus", this.text("spectroCalculating"));
      this.renderControls();
      try {
        await this.yieldTask();
        if (cancelled()) return;
        const result = await this.spectroCache.view(pcm.channels[channel], pcm.sampleRate, start, end, {
          fftSize: size, axis, maxHz, rows: 160, isCancelled: cancelled, yieldTask: () => this.yieldTask(),
          onProgress: fraction => {
            if (!cancelled()) this.put("analysisSpectroStatus", this.text("spectroCalculating") +
              " " + Math.round(100 * fraction) + "%");
          }
        });
        if (cancelled()) return;
        this.spectrogram = result;
        this.spectroBitmap = null;
        this.put("analysisSpectroStatus", this.text("spectroReady"));
        this.renderMeasurements();
        this.drawSpectrogram();
      } catch (_) {
        if (!cancelled()) this.put("analysisSpectroStatus", this.text("spectroError"));
      } finally {
        if (!cancelled()) { this.spectroBusy = false; this.renderControls(); }
      }
    }
    setView(view) {
      if (!["spectrum", "spectrogram"].includes(view) || this.analysisView === view) return;
      this.analysisView = view;
      this.renderControls();
      if (view === "spectrogram") {
        this.invalidateAnalysis();
        if (!this.measure) this.recompute(true);
        this.scheduleSpectrogram();
      } else {
        this.invalidateSpectrogram();
        this.recompute(false);
      }
      this.draw();
    }
    cancelWork() {
      this.loadTicket++;
      this.sourceBusy = false;
      this.invalidateAnalysis();
      this.invalidateSpectrogram();
      this.status("cancelled"); this.renderSource();
      this.put("analysisSpectroStatus", this.text("cancelled"));
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
          (this.analysisView === "spectrum" ?
            await dsp.spectrumAverage(index.samples, pcm.sampleRate, start, end, n, options) : null) :
          (this.analysisView === "spectrum" ? dsp.spectrumAt(index.samples, pcm.sampleRate, cursor, n) : null);
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
      const previousViewStart = this.viewStart;
      if (this.cursor < this.viewStart || this.cursor > this.viewStart + this.viewSpan) {
        this.viewStart = clamp(this.cursor - this.viewSpan / 2, 0, this.pcm.duration - this.viewSpan);
      }
      if (this.analysisView === "spectrum" && this.spectrumMode === "local") {
        delayed ? this.scheduleAnalysis(false) : this.recompute(false);
      }
      if (this.viewStart !== previousViewStart) this.scheduleSpectrogram();
      this.renderTimes(); this.drawWave(); this.drawSpectrogram();
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
      this.renderTimes(); this.drawWave(); this.drawSpectrogram();
    }
    zoom(factor) {
      if (!this.pcm) return;
      const center = this.cursor >= this.viewStart && this.cursor <= this.viewStart + this.viewSpan ?
        this.cursor : this.viewStart + this.viewSpan / 2;
      this.viewSpan = clamp(this.viewSpan * factor, Math.min(this.pcm.duration, 16 / this.pcm.sampleRate), this.pcm.duration);
      this.viewStart = clamp(center - this.viewSpan / 2, 0, this.pcm.duration - this.viewSpan);
      this.drawWave(); this.scheduleSpectrogram();
    }
    pan(direction) {
      if (!this.pcm) return;
      this.viewStart = clamp(this.viewStart + direction * this.viewSpan / 2, 0, this.pcm.duration - this.viewSpan);
      this.drawWave(); this.scheduleSpectrogram();
    }
    spectrumDomain() {
      if (!this.pcm) return { low: 0, high: 22050 };
      return { low: this.axis === "log" ? this.pcm.sampleRate / this.fftSize : 0,
        high: this.pcm.sampleRate / 2 };
    }
    spectrumBounds() {
      const domain = this.spectrumDomain();
      if (!this.spectrumWindow) return domain;
      const low = clamp(this.spectrumWindow.low, domain.low, domain.high);
      const high = clamp(this.spectrumWindow.high, domain.low, domain.high);
      return high > low ? { low, high } : domain;
    }
    spectrumCoordinate(frequency) {
      return this.axis === "log" ? Math.log(Math.max(Number.MIN_VALUE, frequency)) : frequency;
    }
    spectrumFromCoordinate(coordinate) {
      return this.axis === "log" ? Math.exp(coordinate) : coordinate;
    }
    spectrumMinimumWidth() {
      return this.pcm ? 2 * this.pcm.sampleRate / this.fftSize : 1;
    }
    setSpectrumWindow(low, high) {
      if (!this.pcm) return;
      const domain = this.spectrumDomain();
      if (!Number.isFinite(low) || !Number.isFinite(high) || low < domain.low || high > domain.high ||
          high - low < Math.min(this.spectrumMinimumWidth(), domain.high - domain.low) - 1e-8) {
        this.status("errorFrequency", true); this.renderSpectrumWindow(); return;
      }
      this.spectrumWindow = low <= domain.low && high >= domain.high ? null : { low, high };
      this.renderSpectrumWindow(); this.drawSpectrum();
    }
    zoomSpectrum(factor) {
      if (!this.pcm) return;
      const domain = this.spectrumDomain(), view = this.spectrumBounds();
      const fullStart = this.spectrumCoordinate(domain.low), fullEnd = this.spectrumCoordinate(domain.high);
      const lo = this.spectrumCoordinate(view.low), hi = this.spectrumCoordinate(view.high);
      const anchor = this.frequency >= view.low && this.frequency <= view.high ?
        this.spectrumCoordinate(this.frequency) : (lo + hi) / 2;
      // On a log axis the minimum span must be measured at the zoom anchor,
      // not at the first FFT bin: 440 and 444 Hz must remain distinguishable.
      const anchorHz = this.spectrumFromCoordinate(anchor), minimumHz = this.spectrumMinimumWidth();
      const minSpan = Math.max(1e-10, this.spectrumCoordinate(Math.min(domain.high, anchorHz + minimumHz / 2)) -
        this.spectrumCoordinate(Math.max(domain.low, anchorHz - minimumHz / 2)));
      const span = clamp((hi - lo) * factor, minSpan, fullEnd - fullStart);
      let start = clamp(anchor - span / 2, fullStart, fullEnd - span);
      if (!Number.isFinite(start)) start = fullStart;
      this.spectrumWindow = span >= fullEnd - fullStart - 1e-9 ? null :
        { low: this.spectrumFromCoordinate(start), high: this.spectrumFromCoordinate(start + span) };
      this.renderSpectrumWindow(); this.drawSpectrum();
    }
    panSpectrum(direction) {
      if (!this.pcm) return;
      const domain = this.spectrumDomain(), view = this.spectrumBounds();
      const fullStart = this.spectrumCoordinate(domain.low), fullEnd = this.spectrumCoordinate(domain.high);
      const lo = this.spectrumCoordinate(view.low), hi = this.spectrumCoordinate(view.high);
      const shift = .4 * (hi - lo) * direction;
      const start = clamp(lo + shift, fullStart, fullEnd - (hi - lo));
      this.spectrumWindow = { low: this.spectrumFromCoordinate(start),
        high: this.spectrumFromCoordinate(start + hi - lo) };
      this.renderSpectrumWindow(); this.drawSpectrum();
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
      this.lastPlaybackDrawTime = -Infinity;
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
      this.renderPlayback(); this.drawWave(); this.drawSpectrogram();
    }
    pause() { this.stopPlayback(false); this.paused = true; this.renderPlayback(); }
    stop() {
      this.stopPlayback(true);
      const busy = this.sourceBusy || this.analysisBusy || this.spectroBusy ||
        this.analysisTimer !== null || this.spectroTimer !== null;
      this.loadTicket++; this.sourceBusy = false; this.invalidateAnalysis(); this.invalidateSpectrogram();
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
      // Spectrogram compositing, axes and time-window plots are substantial
      // main-thread work on phones. Redrawing at 60 fps can queue the next
      // frame ahead of a pointer click, making Pause feel unresponsive on
      // short recordings such as the cricket clip. Audio stays on the audio
      // clock; only the animated overlays are throttled to about eight fps.
      const time = this.contextOwner.context.currentTime;
      if (time - this.lastPlaybackDrawTime >= 1 / 8 || time < this.lastPlaybackDrawTime) {
        this.lastPlaybackDrawTime = time;
        // Progress changes only a status readout, never the active button.
        this.renderPlaybackProgress(); this.drawWave(); this.drawSpectrogram();
      }
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
        ["analysisWaveCanvas", "waveAria"], ["analysisSpectrumCanvas", "spectrumAria"],
        ["analysisSpectroCanvas", "spectroAria"], ["analysisViewModes", "chooseView"],
        ["analysisKindModes", "chooseSection"], ["analysisSpectrumZoomTools", "spectrumZoomLabel"],
        ["analysisSpectrumPanLeft", "spectrumPanLeft"], ["analysisSpectrumPanRight", "spectrumPanRight"]])
        this.$(id).setAttribute("aria-label", this.text(key));
      if (this.spectrogram) this.put("analysisSpectroStatus", this.text("spectroReady"));
      this.renderSource(); this.renderControls(); this.renderMeasurements(); this.renderPlayback(); this.draw();
    }
    renderSource() {
      const entry = examples.CATALOGUE.find(item => item.id === this.source?.exampleId);
      const classes = examples.CLASSES.map(item => [item.id, item.title[this.language]]);
      if (this.source?.classId === "local") classes.push(["local", this.text("local")]);
      if (this.source?.classId === "microphone") classes.push(["microphone", this.text("microphoneClass")]);
      const classId = this.source?.classId || examples.CATALOGUE[0].classId;
      this.options("analysisClass", classes, classId);
      this.options("analysisExample", ["local", "microphone"].includes(classId) ? [[classId, this.source.name]] :
        examples.CATALOGUE.filter(item => item.classId === classId).map(item => [item.id, item.title[this.language]]),
        ["local", "microphone"].includes(classId) ? classId : (entry?.id || examples.CATALOGUE[0].id));
      this.options("analysisChannel", this.pcm?.channels.length === 2 ?
        [["0", this.text("left")], ["1", this.text("right")]] : [["0", this.text("mono")]], this.channel);
      this.$("analysisChannelField").hidden = this.pcm?.channels.length !== 2;
      this.put("analysisSourceName", entry ? entry.title[this.language] : (this.source?.name || this.text("noSource")));
      this.put("analysisSourceBadge", this.source ? this.text(this.source.kind) : "");
      this.put("analysisSourceDescription", entry ? entry.description[this.language] :
        this.source?.kind === "microphone" ? this.text(this.source.captureMode === "take" ? "micTakeDescription" : "micRollingDescription") : this.text("noUpload"));
      this.$("analysisRecordingCredit").hidden = !entry?.credit;
      if (entry?.credit) {
        const source = this.$("analysisRecordingSource"), license = this.$("analysisRecordingLicense");
        source.textContent = entry.credit.creator;
        source.href = entry.credit.sourceUrl;
        license.textContent = entry.credit.license;
        license.href = entry.credit.licenseUrl;
      }
      const pcm = this.pcm;
      this.put("analysisSourceInfo", pcm ? `${this.text(this.source.kind)} · ${number(pcm.duration)} ${this.text("seconds")} · ${number(pcm.sampleRate)} ${this.text("hz")} · ${this.text(pcm.channels.length === 2 ? "stereo" : "mono")}` : "");
      this.put("analysisEncoding", pcm ? `${this.text("encoding")}: ${pcm.encoding === "generated-float32" ? this.text("generatedEncoding") : pcm.encoding}` : "");
      const attenuation = pcm?.peak > .98 ? .98 / pcm.peak : 1;
      this.put("analysisListeningHint", this.text("listening") + (attenuation < 1 ? " " + this.text("attenuation", { db: number(-db(attenuation), 1) }) : ""));
      this.renderTimes();
    }
    renderControls() {
      for (const id of ["analysisClass", "analysisExample", "analysisOpen", "analysisMicOpen"]) this.$(id).disabled = this.sourceBusy;
      for (const id of ["analysisPlay", "analysisPlaySelection", "analysisAtCursor", "analysisAverage",
        "analysisFFT", "analysisSpectroFFT", "analysisSpectroMaxHz", "analysisChannel", "analysisCursor", "analysisCursorSlider", "analysisStart", "analysisEnd",
        "analysisZoomIn", "analysisZoomOut", "analysisFit", "analysisSelectAll", "analysisFrequency",
        "analysisSpectrumZoomIn", "analysisSpectrumZoomOut", "analysisSpectrumFit", "analysisSpectrumPanLeft",
        "analysisSpectrumPanRight", "analysisSpectrumMin", "analysisSpectrumMax"])
        this.$(id).disabled = !this.pcm || this.sourceBusy;
      this.$("analysisCancel").hidden = !this.sourceBusy && !this.analysisBusy && !this.spectroBusy;
      const spectroFailed = this.analysisView === "spectrogram" && !this.spectroBusy && !this.spectrogram &&
        !this.spectroTimer && !!this.pcm;
      this.$("analysisRetry").hidden = this.sourceBusy || this.analysisBusy || this.spectroBusy ||
        (this.analysisView === "spectrogram" ? !spectroFailed : (!!this.spectrum && this.statusKey !== "errorAnalysis"));
      this.$("analysisSpectrumModes").hidden = this.analysisView !== "spectrum";
      this.$("analysisFFTField").hidden = this.analysisView !== "spectrum";
      this.$("analysisSpectroFFTField").hidden = this.analysisView !== "spectrogram";
      this.$("analysisSpectroMaxHzField").hidden = this.analysisView !== "spectrogram";
      this.$("analysisSpectrumView").hidden = this.analysisView !== "spectrum";
      this.$("analysisSpectroView").hidden = this.analysisView !== "spectrogram";
      for (const [id, view] of [["analysisViewSpectrum", "spectrum"], ["analysisViewSpectro", "spectrogram"]]) {
        this.$(id).disabled = !this.pcm || this.sourceBusy;
        this.$(id).setAttribute("aria-pressed", String(this.analysisView === view));
        this.$(id).classList.toggle("selected", this.analysisView === view);
      }
      for (const [id, mode] of [["analysisAtCursor", "local"], ["analysisAverage", "average"]]) {
        this.$(id).setAttribute("aria-pressed", String(mode === this.spectrumMode));
        this.$(id).classList.toggle("selected", mode === this.spectrumMode);
      }
      this.put("analysisSpectrumModeHint", this.text(this.spectrumMode === "local" ? "cursorModeHint" : "averageModeHint"));
      this.renderSpectrumWindow();
      this.$("analysisStatus").classList.toggle("error", this.error);
      this.put("analysisStatus", this.text(this.statusKey) + (this.statusProgress === null ? "" : " " + Math.round(this.statusProgress * 100) + "%"));
      this.put("analysisVolumeValue", Math.round(this.volume * 100) + "%");
      this.renderPlaybackButton();
      this.$("analysisWorkspace").setAttribute("aria-busy", String(this.sourceBusy));
    }
    renderPlaybackButton() {
      this.put("analysisPlay", this.text(this.isPlaying() ? "pause" : "play"));
      const button = this.$("analysisPlay"), pressed = String(this.isPlaying());
      if (button.getAttribute("aria-pressed") !== pressed) button.setAttribute("aria-pressed", pressed);
    }
    renderPlayback() {
      this.renderPlaybackButton();
      this.renderPlaybackProgress();
    }
    renderPlaybackProgress() {
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
    renderSpectrumWindow() {
      const { low, high } = this.spectrumBounds(), domain = this.spectrumDomain();
      for (const [id, value] of [["analysisSpectrumMin", low], ["analysisSpectrumMax", high]]) {
        const input = this.$(id);
        if (input !== this.document.activeElement) input.value = String(Number(value.toFixed(5)));
        input.min = String(domain.low); input.max = String(domain.high);
      }
      this.$("analysisSpectrumFit").disabled = !this.pcm || this.sourceBusy || !this.spectrumWindow;
      this.$("analysisSpectrumZoomOut").disabled = !this.pcm || this.sourceBusy || !this.spectrumWindow;
      this.$("analysisSpectrumPanLeft").disabled = !this.pcm || this.sourceBusy || low <= domain.low + 1e-8;
      this.$("analysisSpectrumPanRight").disabled = !this.pcm || this.sourceBusy || high >= domain.high - 1e-8;
      this.$("analysisSpectrumZoomIn").disabled = !this.pcm || this.sourceBusy ||
        high - low <= this.spectrumMinimumWidth() + 1e-8;
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
      const grid = this.spectrogram;
      this.put("analysisSpectroInfo", pcm ? this.text("spectroInfo", { n: this.spectroFFT,
        ms: number(1000 * this.spectroFFT / pcm.sampleRate, 1),
        hop: grid ? number(1000 * grid.hopSeconds, 2) : "—", axis: this.text(this.axis),
        low: spectro.MIN_DB, high: spectro.MAX_DB }) + ` · 0–${number(this.maxVisibleHz())} ${this.text("hz")}` : "");
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
    draw() { this.drawWave(); this.drawSpectrum(); this.drawSpectrogram(); }
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
      if (this.analysisView === "spectrum" && this.spectrumMode === "local") {
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
      const { low, high } = this.spectrumBounds();
      return (this.spectrumCoordinate(frequency) - this.spectrumCoordinate(low)) /
        (this.spectrumCoordinate(high) - this.spectrumCoordinate(low));
    }
    spectrumPointer(event) {
      if (!this.pcm) return;
      const rect = this.$("analysisSpectrumCanvas").getBoundingClientRect();
      const fraction = clamp((event.clientX - rect.left - 50) / Math.max(1, rect.width - 66), 0, 1);
      const { low, high } = this.spectrumBounds();
      this.frequency = this.spectrumFromCoordinate(this.spectrumCoordinate(low) +
        fraction * (this.spectrumCoordinate(high) - this.spectrumCoordinate(low)));
      this.$("analysisFrequency").value = String(Number(this.frequency.toFixed(3)));
      this.renderFrequency(); this.drawSpectrum();
    }
    drawSpectrum() {
      if (this.analysisView !== "spectrum") return;
      const p = this.canvas("analysisSpectrumCanvas");
      if (!p || !this.pcm) return;
      const { ctx, left, right, top, bottom, width } = p;
      // Fixed, unit-peak amplitude reference shared with the spectrogram.
      const high = spectro.MAX_DB, low = spectro.MIN_DB;
      const y = value => bottom - (clamp(value, low, high) - low) / (high - low) * (bottom - top);
      const x = frequency => left + this.frequencyToFraction(frequency) * (right - left);
      ctx.strokeStyle = "#d6e2ed"; ctx.fillStyle = "#627e96"; ctx.textAlign = "right";
      for (let value = low; value <= high; value += 20) {
        ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke();
        ctx.fillText(String(value), left - 7, y(value) + 4);
      }
      ctx.textAlign = "left"; ctx.fillText("dB", left, 19);
      const { low: min, high: max } = this.spectrumBounds();
      const tickCount = width < 420 ? 3 : 5;
      const approximateStep = (max - min) / (tickCount - 1);
      const order = Math.pow(10, Math.floor(Math.log10(approximateStep)));
      const step = [1, 2, 5, 10].map(factor => factor * order)
        .find(value => value >= approximateStep - 1e-12) || 10 * order;
      let ticks = [];
      if (this.axis === "linear") {
        const first = Math.ceil((min - 1e-9 * step) / step);
        for (let i = first; i * step <= max + 1e-9 * step && ticks.length < 20; i++) ticks.push(i * step);
      } else {
        const exponentStart = Math.floor(Math.log10(min)), exponentEnd = Math.ceil(Math.log10(max));
        for (let power = exponentStart; power <= exponentEnd; power++) {
          for (const factor of [1, 2, 5]) {
            const f = factor * Math.pow(10, power);
            if (f >= min && f <= max) ticks.push(f);
          }
        }
        if (ticks.length < 2) ticks = Array.from({ length: tickCount }, (_, i) =>
          this.spectrumFromCoordinate(this.spectrumCoordinate(min) + i / (tickCount - 1) *
            (this.spectrumCoordinate(max) - this.spectrumCoordinate(min))));
      }
      let lastTickX = -Infinity;
      for (let i = 0; i < ticks.length; i++) {
        const xx = x(ticks[i]);
        if (xx - lastTickX < 53 && i !== ticks.length - 1) continue;
        if (i === ticks.length - 1 && xx - lastTickX < 47) continue;
        lastTickX = xx;
        ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, bottom); ctx.stroke();
        ctx.textAlign = xx > right - 25 ? "right" : xx < left + 25 ? "left" : "center";
        ctx.fillText(number(ticks[i], 2), xx, bottom + 19);
      }
      if (!this.spectrum) return;
      const magnitudes = this.spectrum.magnitudes;
      const columns = Math.max(1, Math.min(2048, Math.ceil(right - left)));
      const peaks = new Float64Array(columns); peaks.fill(-Infinity);
      const firstBin = Math.max(this.axis === "log" ? 1 : 0, Math.ceil(min / this.spectrum.binHz));
      const lastBin = Math.min(magnitudes.length - 1, Math.floor(max / this.spectrum.binHz));
      for (let k = firstBin; k <= lastBin; k++) {
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
      if (this.frequency >= min && this.frequency <= max) {
        const xx = x(this.frequency);
        ctx.strokeStyle = "#cf7a22"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, bottom); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    spectrogramPointer(event) {
      if (!this.pcm || this.analysisView !== "spectrogram") return;
      const rect = this.$("analysisSpectroCanvas").getBoundingClientRect();
      const timeFraction = clamp((event.clientX - rect.left - 50) / Math.max(1, rect.width - 66), 0, 1);
      const frequencyFraction = 1 - clamp((event.clientY - rect.top - 38) /
        Math.max(1, rect.height - 70), 0, 1);
      this.frequency = spectro.frequencyAtFraction(frequencyFraction, this.pcm.sampleRate, this.spectroFFT,
        this.axis, this.maxVisibleHz());
      this.setCursor(clamp(this.viewStart + timeFraction * this.viewSpan, 0, this.pcm.duration), true);
      this.drawSpectrogram();
    }
    // Heatmap pixels are built once per completed view. The lightweight
    // selection/cursor/playback overlays can then follow every pointer or frame.
    drawSpectrogram() {
      if (this.analysisView !== "spectrogram") return;
      const p = this.canvas("analysisSpectroCanvas");
      if (!p || !this.pcm) return;
      const { ctx, left, right, top, bottom, width } = p;
      const x = time => left + (time - this.viewStart) / this.viewSpan * (right - left);
      const grid = this.spectrogram;
      ctx.fillStyle = "#101a37";
      ctx.fillRect(left, top, right - left, bottom - top);
      if (grid && typeof ctx.drawImage === "function") {
        if (!this.spectroBitmap || this.spectroBitmap.grid !== grid) {
          const offscreen = this.document.createElement("canvas");
          offscreen.width = grid.columns; offscreen.height = grid.rows;
          const imageCtx = offscreen.getContext("2d");
          if (imageCtx && typeof imageCtx.createImageData === "function" && typeof imageCtx.putImageData === "function") {
            const image = imageCtx.createImageData(grid.columns, grid.rows);
            const stops = [[16, 26, 55], [48, 39, 110], [32, 108, 158], [42, 188, 174], [248, 222, 114]];
            for (let col = 0; col < grid.columns; col++) {
              for (let row = 0; row < grid.rows; row++) {
                const value = grid.pixels[col * grid.rows + row];
                const scaled = value * (stops.length - 1) / 255;
                const stop = Math.min(stops.length - 2, Math.floor(scaled));
                const fraction = scaled - stop;
                const offset = ((grid.rows - row - 1) * grid.columns + col) * 4;
                for (let c = 0; c < 3; c++) image.data[offset + c] = Math.round(stops[stop][c] * (1 - fraction) + stops[stop + 1][c] * fraction);
                image.data[offset + 3] = 255;
              }
            }
            imageCtx.putImageData(image, 0, 0);
            this.spectroBitmap = { grid, canvas: offscreen };
          }
        }
        if (this.spectroBitmap) {
          const first = clamp((this.viewStart - grid.timeStart) / grid.hopSeconds, 0, grid.columns);
          const span = clamp(this.viewSpan / grid.hopSeconds, 0, grid.columns - first);
          if (span > 0) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this.spectroBitmap.canvas, first, 0, span, grid.rows,
              left, top, right - left, bottom - top);
          }
        }
      }
      const a = clamp(x(this.start), left, right), b = clamp(x(this.end), left, right);
      ctx.fillStyle = "rgba(97, 236, 195, .13)";
      if (b > a) ctx.fillRect(a, top, b - a, bottom - top);
      ctx.strokeStyle = "#a5b7cf"; ctx.fillStyle = "#526b8a"; ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const fraction = i / 4, y = bottom - fraction * (bottom - top);
        const frequency = spectro.frequencyAtFraction(fraction, this.pcm.sampleRate, this.spectroFFT,
          this.axis, this.maxVisibleHz());
        ctx.fillText(number(frequency, 1), left - 5, y + 4);
      }
      ctx.textAlign = "left"; ctx.fillText(this.text("hz"), left, 19);
      const ticks = width < 420 ? 2 : 4;
      for (let i = 0; i <= ticks; i++) {
        const xx = left + i * (right - left) / ticks;
        ctx.strokeStyle = "rgba(200, 218, 239, .18)"; ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, bottom); ctx.stroke();
        ctx.fillStyle = "#526b8a";
        ctx.textAlign = i === 0 ? "left" : i === ticks ? "right" : "center";
        ctx.fillText(number(this.viewStart + this.viewSpan * i / ticks, 4), xx, bottom + 19);
      }
      for (const [time, label] of [[this.start, "A"], [this.end, "B"]]) {
        if (time < this.viewStart || time > this.viewStart + this.viewSpan) continue;
        const xx = clamp(x(time), left, right);
        ctx.strokeStyle = "#90e9c9"; ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, bottom); ctx.stroke();
        ctx.fillStyle = "#2f786b"; ctx.textAlign = "center"; ctx.fillText(label, xx, top - 12);
      }
      const frequencyY = bottom - clamp(spectro.frequencyFraction(this.frequency,
        this.pcm.sampleRate, this.spectroFFT, this.axis, this.maxVisibleHz()), 0, 1) * (bottom - top);
      ctx.strokeStyle = "rgba(250, 213, 139, .75)"; ctx.setLineDash([3, 4]); ctx.beginPath();
      ctx.moveTo(left, frequencyY); ctx.lineTo(right, frequencyY); ctx.stroke(); ctx.setLineDash([]);
      if (this.cursor >= this.viewStart && this.cursor <= this.viewStart + this.viewSpan) {
        ctx.strokeStyle = "#f5a54b"; ctx.lineWidth = 1.8; ctx.beginPath();
        ctx.moveTo(x(this.cursor), top); ctx.lineTo(x(this.cursor), bottom); ctx.stroke();
      }
      if (this.playing || this.paused) {
        const time = this.currentPosition();
        if (time >= this.viewStart && time <= this.viewStart + this.viewSpan) {
          ctx.strokeStyle = "#8fb8ff"; ctx.setLineDash([5, 3]); ctx.beginPath();
          ctx.moveTo(x(time), top); ctx.lineTo(x(time), bottom); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      this.put("analysisSpectroReadout", this.text("cursorPosition", { time: number(this.cursor, 4) }) +
        " · " + number(this.frequency, 1) + " " + this.text("hz"));
    }
  }
  return Object.freeze({ Controller, messages: words });
});
