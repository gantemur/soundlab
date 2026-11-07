/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * M1: opt-in, local-only microphone oscilloscope and spectrum. No recording.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabMicrophone = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const FFT_SIZE = 4096, MIN_DB = -100, MAX_DB = 0, FPS = 10;
  const constraints = Object.freeze({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false
  });
  const words = {
    en: {
      title: "Microphone", intro: "Allow microphone access to inspect live sound.",
      start: "Use microphone", stop: "Stop microphone",
      off: "● Mic off", pending: "● Awaiting permission", on: "● Mic active",
      ready: "No microphone access until you press Use microphone.",
      requesting: "Waiting for microphone permission… You can cancel.",
      live: "Input active. Stop releases the microphone.",
      muted: "Microphone is muted or temporarily interrupted.",
      stopped: "Microphone stopped and released.",
      ended: "Microphone disconnected; input released.",
      unavailable: "Microphone API unavailable. Use HTTPS and a supported browser.",
      denied: "Microphone permission denied or blocked. Check browser settings to retry.",
      missing: "No usable microphone was found.",
      busy: "Microphone is unavailable or already in use by another app.",
      audioError: "Could not start live audio analysis. Microphone released.",
      privacy: "On this device only. No speaker monitoring, recording or upload.",
      waveTitle: "Live waveform", waveHelp: "Recent samples · fixed vertical scale −1…+1",
      spectrumTitle: "Live spectrum", spectrumHelp: "Digital level in dBFS, not acoustic dB SPL",
      axis: "Frequency axis", linear: "Linear", log: "Logarithmic",
      upper: "Upper frequency", all: "Full range (Nyquist)",
      waveAria: "Live microphone waveform, amplitude from minus one to plus one",
      spectrumAria: "Live microphone frequency spectrum in relative digital decibels",
      waveInfo: "{ms} ms recent window · {rate} Hz capture context · peak {peak} · RMS {rms}",
      spectrumInfo: "FFT {size} · spacing {bin} Hz · highest spectral bin {peak} Hz ({level} dBFS)",
      spectrumSilent: "FFT {size} · spacing {bin} Hz · no significant spectral peak",
      rate: "Hz", ms: "ms", db: "dBFS"
    },
    mn: {
      title: "Микрофон", intro: "Зөвшөөрөл өгөөд орчны авианы долгион, спектрийг шууд ажиглаарай.",
      start: "Микрофон асаах", stop: "Микрофон унтраах",
      off: "● Унтраалттай", pending: "● Зөвшөөрөл хүлээж байна", on: "● Микрофон ажиллаж байна",
      ready: "«Микрофон асаах» товч дарахаас нааш микрофон ашиглахгүй.",
      requesting: "Микрофоны зөвшөөрөл хүлээж байна… Болих боломжтой.",
      live: "Микрофон ажиллаж байна. «Унтраах» товч төхөөрөмжөөс салгана.",
      muted: "Микрофоныг хаасан эсвэл түр саатуулсан байна.",
      stopped: "Микрофоныг унтрааж, төхөөрөмжөөс салгалаа.",
      ended: "Микрофон салсан тул оролтыг чөлөөллөө.",
      unavailable: "Микрофон ашиглах боломжгүй. HTTPS болон дэмжигдсэн хөтөч шаардлагатай.",
      denied: "Микрофоны зөвшөөрөл өгөөгүй эсвэл хаасан байна. Хөтчийн тохиргоог шалгаарай.",
      missing: "Ашиглах боломжтой микрофон олдсонгүй.",
      busy: "Микрофоныг ашиглах боломжгүй эсвэл өөр програм ашиглаж байна.",
      audioError: "Шууд шинжилгээг эхлүүлж чадсангүй. Микрофоныг чөлөөллөө.",
      privacy: "Зөвхөн таны төхөөрөмж дээр. Чанга яригчаар гаргахгүй, бичихгүй, илгээхгүй.",
      waveTitle: "Шууд долгион", waveHelp: "Сүүлийн сорьцууд · босоо хуваарь −1…+1",
      spectrumTitle: "Шууд спектр", spectrumHelp: "Дижитал түвшин, dBFS · дууны даралтын dB SPL биш",
      axis: "Давтамжийн тэнхлэг", linear: "Шугаман", log: "Логарифмын",
      upper: "Дээд давтамж", all: "Бүх давтамж (Найквист)",
      waveAria: "Микрофоны шууд долгион, амплитуд хасах нэгээс нэмэх нэг хүртэл",
      spectrumAria: "Микрофоны шууд давтамжийн спектр, харьцангуй дижитал децибел",
      waveInfo: "Сүүлийн {ms} мс · {rate} Гц сорьцлолт · оргил {peak} · RMS {rms}",
      spectrumInfo: "FFT {size} · алхам {bin} Гц · хамгийн хүчтэй зурвас {peak} Гц ({level} dBFS)",
      spectrumSilent: "FFT {size} · алхам {bin} Гц · тод зурвас илрээгүй",
      rate: "Гц", ms: "мс", db: "dBFS"
    }
  };
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const fmt = (n, digits = 1) => Number.isFinite(n) ? Number(n.toFixed(digits)).toString() : "—";
  const tickLabel = (hz, language) => hz >= 1000 ?
    fmt(hz / 1000, 1) + (language === "mn" ? " кГц" : " kHz") :
    fmt(hz, 0) + (language === "mn" ? " Гц" : " Hz");

  function surface(canvas, window) {
    const box = canvas.getBoundingClientRect(), dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const width = Math.max(180, Math.round(box.width || 500)), height = Math.max(135, Math.round(box.height || 255));
    const w = Math.round(width * dpr), h = Math.round(height * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    g.fillStyle = "#fbfdff"; g.fillRect(0, 0, width, height);
    return { g, width, height };
  }
  function grid(g, left, top, right, bottom, rows = 4) {
    g.strokeStyle = "#e3eaf3"; g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i <= rows; i++) {
      const y = top + i * (bottom - top) / rows;
      g.moveTo(left, y); g.lineTo(right, y);
    }
    g.stroke();
    g.strokeStyle = "#b9ccdc"; g.strokeRect(left, top, right - left, bottom - top);
    g.font = "11px system-ui, sans-serif"; g.fillStyle = "#516e88";
  }
  function stopTracks(stream) {
    if (!stream) return;
    for (const track of stream.getTracks()) {
      try { track.stop(); } catch (_) { /* Continue releasing other tracks. */ }
    }
  }
  function errorKey(error) {
    switch (error?.name) {
      case "NotAllowedError": case "SecurityError": case "PermissionDeniedError": return "denied";
      case "NotFoundError": case "DevicesNotFoundError": case "OverconstrainedError": return "missing";
      case "NotReadableError": case "TrackStartError": case "AbortError": return "busy";
      default: return "audioError";
    }
  }

  class Controller {
    constructor({ document, window, onBegin = () => {}, onStop = () => {} }) {
      this.document = document; this.window = window;
      this.onBegin = onBegin; this.onStop = onStop;
      this.language = "mn"; this.active = false; this.phase = "idle";
      this.statusKey = "ready"; this.ticket = 0;
      this.stream = null; this.context = null; this.source = null; this.analyser = null; this.sink = null;
      this.frame = null; this.lastDraw = -Infinity; this.timeData = null; this.frequencyData = null;
      this.trackListeners = [];
      this.$("analysisMicStart").addEventListener("click", () => { void this.start(); });
      this.$("analysisMicStop").addEventListener("click", () => this.stop());
      for (const id of ["analysisMicAxis", "analysisMicMaxHz"]) this.$(id).addEventListener("change", () => this.draw());
      this.document.addEventListener("visibilitychange", () => {
        if (this.document.hidden && this.isActive()) this.stop();
      });
      this.window.addEventListener("pagehide", () => this.stop());
      this.renderLanguage("mn");
    }
    $(id) { return this.document.getElementById(id); }
    text(key, replacements = {}) {
      return String(words[this.language][key] || words.en[key] || key)
        .replace(/\{(\w+)\}/g, (_, name) => replacements[name] ?? "");
    }
    put(id, value) { const element = this.$(id); if (element.textContent !== value) element.textContent = value; }
    isActive() { return this.phase === "requesting" || this.phase === "live"; }
    setActive(active) {
      if (this.active === active) return;
      this.active = active;
      if (!active) this.stop();
      else this.render();
    }
    renderLanguage(language) {
      this.language = language === "en" ? "en" : "mn";
      for (const element of this.document.querySelectorAll("[data-mic-i18n]")) {
        const key = element.getAttribute("data-mic-i18n");
        const value = this.text(key);
        if (element.textContent !== value) element.textContent = value;
      }
      this.$("analysisMicWaveCanvas").setAttribute("aria-label", this.text("waveAria"));
      this.$("analysisMicSpectrumCanvas").setAttribute("aria-label", this.text("spectrumAria"));
      this.render();
      if (this.phase === "live") this.draw();
    }
    render() {
      const busy = this.isActive(), live = this.phase === "live";
      this.$("analysisMicStart").hidden = busy;
      this.$("analysisMicStop").hidden = !busy;
      this.$("analysisMicStop").disabled = false;
      const indicator = this.$("analysisMicIndicator");
      indicator.dataset.state = live ? "live" : this.phase === "requesting" ? "requesting" : "off";
      this.put("analysisMicIndicator", this.text(live ? "on" : this.phase === "requesting" ? "pending" : "off"));
      this.put("analysisMicStatus", this.text(this.statusKey));
      this.$("analysisMicStatus").classList.toggle("error", this.phase === "error");
      this.$("analysisOfflineVisuals").hidden = busy;
      this.$("analysisMicVisuals").hidden = !live;
      this.$("analysisWorkspace").classList.toggle("analysis-mic-live", busy);
    }
    async start() {
      if (!this.active || this.isActive()) return false;
      const navigator = this.window.navigator, Context = this.window.AudioContext || this.window.webkitAudioContext;
      if (this.window.isSecureContext === false || !navigator?.mediaDevices?.getUserMedia) {
        this.phase = "error"; this.statusKey = "unavailable"; this.render(); return false;
      }
      if (typeof Context !== "function") {
        this.phase = "error"; this.statusKey = "audioError"; this.render(); return false;
      }
      this.onBegin(); // Stop internal audition before opening a live microphone.
      const ticket = ++this.ticket;
      this.phase = "requesting"; this.statusKey = "requesting"; this.render();
      let stream;
      try {
        // Call getUserMedia directly in the click gesture, before the first await.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { ...constraints.audio }, video: false
        });
        if (ticket !== this.ticket || !this.active || this.document.hidden) {
          stopTracks(stream); return false;
        }
        if (!stream.getAudioTracks?.().some(track => track.readyState !== "ended")) {
          throw Object.assign(new Error("No live audio track"), { name: "NotFoundError" });
        }
        const context = new Context();
        this.context = context; this.stream = stream;
        // Assign each node as soon as it exists so an intermediate failure can
        // disconnect every allocated node, not just close the context.
        const source = this.source = context.createMediaStreamSource(stream);
        const analyser = this.analyser = context.createAnalyser();
        const sink = this.sink = context.createGain();
        analyser.fftSize = FFT_SIZE; analyser.minDecibels = MIN_DB;
        analyser.maxDecibels = MAX_DB; analyser.smoothingTimeConstant = 0.18;
        // Keeping the graph connected ensures that the analyser runs on WebKit.
        // The output is always exactly zero; microphone samples never reach speakers.
        sink.gain.value = 0;
        source.connect(analyser); analyser.connect(sink); sink.connect(context.destination);
        this.timeData = new Float32Array(FFT_SIZE);
        this.frequencyData = new Float32Array(analyser.frequencyBinCount);
        for (const track of stream.getTracks()) {
          const ended = () => { if (this.stream === stream) this.stop("ended"); };
          const mute = () => { if (this.stream === stream) { this.statusKey = "muted"; this.render(); } };
          const unmute = () => { if (this.stream === stream) { this.statusKey = "live"; this.render(); } };
          track.addEventListener?.("ended", ended);
          track.addEventListener?.("mute", mute);
          track.addEventListener?.("unmute", unmute);
          this.trackListeners.push({ track, ended, mute, unmute });
        }
        if (typeof context.resume === "function") await context.resume();
        if (ticket !== this.ticket || !this.active || this.document.hidden) {
          // Stop or a newer start has already taken ownership of cleanup.
          // Do not release the newer attempt's graph from this stale continuation.
          if (ticket === this.ticket) this.releaseGraph();
          return false;
        }
        if (context.state && context.state !== "running") throw new Error("Audio context unavailable");
        this.phase = "live"; this.statusKey = "live"; this.lastDraw = -Infinity;
        this.render(); this.draw(); this.nextFrame(); return true;
      } catch (error) {
        if (ticket !== this.ticket) { if (stream && stream !== this.stream) stopTracks(stream); return false; }
        const graphOwnedStream = this.stream === stream;
        this.releaseGraph();
        if (stream && !graphOwnedStream) stopTracks(stream);
        this.phase = "error"; this.statusKey = errorKey(error); this.render();
        return false;
      }
    }
    nextFrame() {
      if (this.phase !== "live" || this.frame !== null) return;
      this.frame = this.window.requestAnimationFrame(now => {
        this.frame = null;
        if (this.phase !== "live") return;
        if (this.context?.state === "closed" || this.context?.state === "interrupted") {
          this.stop("ended"); return;
        }
        if (now - this.lastDraw >= 1000 / FPS || now < this.lastDraw) {
          this.lastDraw = now; this.draw();
        }
        this.nextFrame();
      });
    }
    draw() {
      if (this.phase !== "live" || !this.analyser || !this.context) return;
      this.analyser.getFloatTimeDomainData(this.timeData);
      this.analyser.getFloatFrequencyData(this.frequencyData);
      this.drawWave(); this.drawSpectrum();
    }
    drawWave() {
      const { g, width, height } = surface(this.$("analysisMicWaveCanvas"), this.window);
      const left = 42, top = 13, right = width - 12, bottom = height - 29, mid = (top + bottom) / 2;
      grid(g, left, top, right, bottom);
      for (const a of [-1, 0, 1]) g.fillText(fmt(a, 0), 8, mid - a * (bottom - top) / 2 + 4);
      const duration = FFT_SIZE / this.context.sampleRate;
      g.fillText("0", left, height - 7);
      g.fillText(fmt(duration * 1000, 1) + " " + this.text("ms"), right - 73, height - 7);
      g.strokeStyle = "#237db8"; g.lineWidth = 1.5; g.beginPath();
      let peak = 0, power = 0;
      for (let i = 0; i < this.timeData.length; i++) {
        const value = Number.isFinite(this.timeData[i]) ? clamp(this.timeData[i], -1, 1) : 0;
        peak = Math.max(peak, Math.abs(value)); power += value * value;
        const x = left + (right - left) * i / (this.timeData.length - 1);
        const y = mid - value * (bottom - top) / 2;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      this.put("analysisMicWaveInfo", this.text("waveInfo", {
        ms: fmt(duration * 1000, 1), rate: fmt(this.context.sampleRate, 0),
        peak: fmt(peak, 3), rms: fmt(Math.sqrt(power / this.timeData.length), 3)
      }));
    }
    drawSpectrum() {
      const { g, width, height } = surface(this.$("analysisMicSpectrumCanvas"), this.window);
      const left = 45, top = 13, right = width - 12, bottom = height - 29;
      grid(g, left, top, right, bottom, 5);
      for (let level = 0; level >= MIN_DB; level -= 20) {
        const y = top + (MAX_DB - level) / (MAX_DB - MIN_DB) * (bottom - top);
        g.fillText(String(level), 5, y + 4);
      }
      const rate = this.context.sampleRate, nyquist = rate / 2;
      const chosen = this.$("analysisMicMaxHz").value;
      const high = chosen === "all" ? nyquist : Math.min(nyquist, Number(chosen) || 5000);
      const log = this.$("analysisMicAxis").value === "log", low = log ? Math.min(20, high / 10) : 0;
      const fraction = hz => log ? Math.log(hz / low) / Math.log(high / low) : hz / high;
      const drawX = hz => left + (right - left) * clamp(fraction(hz), 0, 1);
      const ticks = log ? [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter(hz => hz >= low && hz <= high) :
        [0, high / 4, high / 2, 3 * high / 4, high];
      let lastX = -1000;
      for (const hz of [...ticks, high]) {
        const x = drawX(Math.max(low, hz));
        if (x - lastX < 54 && hz !== high) continue;
        g.fillText(tickLabel(hz, this.language), Math.max(left, Math.min(right - 43, x - 17)), height - 7);
        lastX = x;
      }
      const binHz = rate / FFT_SIZE;
      let best = -Infinity, bestHz = 0, started = false;
      g.strokeStyle = "#c25d34"; g.lineWidth = 1.5; g.beginPath();
      for (let i = 1; i < this.frequencyData.length; i++) {
        const hz = i * binHz;
        if (hz > high) break;
        if (hz < low) continue;
        const raw = this.frequencyData[i];
        const level = Number.isFinite(raw) ? clamp(raw, MIN_DB, MAX_DB) : MIN_DB;
        if (Number.isFinite(raw) && raw > best && hz >= 50) { best = raw; bestHz = hz; }
        const x = drawX(hz), y = top + (MAX_DB - level) / (MAX_DB - MIN_DB) * (bottom - top);
        if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
      }
      g.stroke();
      const info = { size: FFT_SIZE, bin: fmt(binHz, 2), peak: fmt(bestHz, 1), level: fmt(best, 1) };
      this.put("analysisMicSpectrumInfo", this.text(best > -95 ? "spectrumInfo" : "spectrumSilent", info));
    }
    releaseGraph() {
      if (this.frame !== null) this.window.cancelAnimationFrame(this.frame);
      this.frame = null;
      for (const { track, ended, mute, unmute } of this.trackListeners) {
        track.removeEventListener?.("ended", ended);
        track.removeEventListener?.("mute", mute);
        track.removeEventListener?.("unmute", unmute);
      }
      this.trackListeners = [];
      for (const node of [this.source, this.analyser, this.sink]) {
        try { node?.disconnect(); } catch (_) { /* A browser may already have detached it. */ }
      }
      const context = this.context, stream = this.stream;
      this.context = null; this.stream = null; this.source = null; this.analyser = null; this.sink = null;
      stopTracks(stream);
      if (context?.close) {
        try { Promise.resolve(context.close()).catch(() => {}); } catch (_) { /* Already closed. */ }
      }
      this.timeData = null; this.frequencyData = null;
    }
    stop(reason = "stopped") {
      const wasActive = this.isActive();
      this.ticket++; this.releaseGraph();
      this.phase = "idle"; this.statusKey = wasActive ? reason : "ready";
      this.render();
      if (wasActive) this.onStop();
    }
  }
  return Object.freeze({ Controller, FFT_SIZE, MIN_DB, MAX_DB, constraints, words, errorKey });
});
