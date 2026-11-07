/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * M2: opt-in microphone workspace, 30-second local PCM capture and Analysis handoff.
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
      title: "Microphone", intro: "Inspect live sound, then analyze the most recent 30 seconds or a recorded take.",
      statusTitle: "Microphone status", recordTitle: "Capture sound",
      recordHelp: "Without pressing Record, Close & analyze takes the last 30 seconds. Press Record to choose a take instead.",
      record: "● Record", recordStop: "■ Stop recording", retry: "Try microphone again",
      finish: "Close & analyze", discard: "Back without loading",
      off: "● Mic off", pending: "● Awaiting permission", on: "● Mic active",
      ready: "Microphone starts only when you open this workspace.",
      requesting: "Waiting for microphone permission… You can cancel.",
      live: "Input active. Closing releases the microphone.",
      muted: "Microphone is muted or temporarily interrupted.",
      stopped: "Microphone stopped and released.",
      ended: "Microphone disconnected; input released.",
      unavailable: "Microphone API unavailable. Use HTTPS and a supported browser.",
      denied: "Microphone permission denied or blocked. Check browser settings to retry.",
      missing: "No usable microphone was found.",
      busy: "Microphone is unavailable or already in use by another app.",
      audioError: "Could not start microphone capture. Microphone released.",
      workletError: "This browser cannot capture PCM audio. A current browser with AudioWorklet support is required.",
      captureError: "Could not retrieve the audio. Try again or return without loading.",
      captureEmpty: "No microphone samples yet. Speak or play a sound, then try again.",
      privacy: "Audio stays on this device. No speaker monitoring, upload or automatic download. The header REC records synthesized audio only.",
      rolling: "Last {seconds} s available (up to 30 s). Close to analyze those samples.",
      recording: "Recording your take: {seconds} / 30 s",
      saved: "Take saved: {seconds} s. Close to analyze it, or record again.",
      recordCap: "The take reached 30 seconds and stopped automatically.",
      finishing: "Preparing the microphone recording for Analysis…",
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
      title: "Микрофон", intro: "Орчны авиаг шууд ажиглаад, сүүлийн 30 секунд эсвэл тусгай бичлэгийг шинжлээрэй.",
      statusTitle: "Микрофоны төлөв", recordTitle: "Авиа хадгалах",
      recordHelp: "«Бичих» дараагүй бол хаахад сүүлийн 30 секундийг шинжилгээнд авна. Хүссэн хэсгийг сонгох бол «Бичих» дарна.",
      record: "● Бичих", recordStop: "■ Бичлэг зогсоох", retry: "Дахин оролдох",
      finish: "Хааж шинжлэх", discard: "Бичлэг авахгүй буцах",
      off: "● Унтраалттай", pending: "● Зөвшөөрөл хүлээж байна", on: "● Микрофон ажиллаж байна",
      ready: "Энэ цонхыг нээх хүртэл микрофон ашиглахгүй.",
      requesting: "Микрофоны зөвшөөрөл хүлээж байна… Болих боломжтой.",
      live: "Микрофон ажиллаж байна. Цонхыг хаахад төхөөрөмжөөс салгана.",
      muted: "Микрофоныг хаасан эсвэл түр саатуулсан байна.",
      stopped: "Микрофоныг унтрааж, төхөөрөмжөөс салгалаа.",
      ended: "Микрофон салсан тул оролтыг чөлөөллөө.",
      unavailable: "Микрофон ашиглах боломжгүй. HTTPS болон дэмжигдсэн хөтөч шаардлагатай.",
      denied: "Микрофоны зөвшөөрөл өгөөгүй эсвэл хаасан байна. Хөтчийн тохиргоог шалгаарай.",
      missing: "Ашиглах боломжтой микрофон олдсонгүй.",
      busy: "Микрофоныг ашиглах боломжгүй эсвэл өөр програм ашиглаж байна.",
      audioError: "Микрофоноос авиа авах боломжгүй. Төхөөрөмжийг чөлөөллөө.",
      workletError: "Энэ хөтөч PCM бичлэгийг дэмжихгүй. AudioWorklet дэмждэг шинэ хөтөч ашиглаарай.",
      captureError: "Авианы сорьцыг авч чадсангүй. Дахин оролдох эсвэл буцаарай.",
      captureEmpty: "Авианы сорьц хараахан алга. Дуу гаргаад дахин оролдоорой.",
      privacy: "Авиа зөвхөн төхөөрөмжид хадгалагдана. Чанга яригчаар гаргахгүй, серверт илгээхгүй. Дээд REC нь зөвхөн зохиомол авиаг бичнэ.",
      rolling: "Сүүлийн {seconds} сек бэлэн (30 сек хүртэл). Хаахад энэ хэсгийг шинжилнэ.",
      recording: "Бичиж байна: {seconds} / 30 сек",
      saved: "{seconds} сек бичлэг хадгаллаа. Хаагаад шинжлэх эсвэл дахин бичээрэй.",
      recordCap: "30 секунд хүрсэн тул бичлэг автоматаар зогслоо.",
      finishing: "Микрофоны бичлэгийг шинжилгээнд бэлтгэж байна…",
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
    constructor({ document, window, onBegin = () => {}, onStop = () => {},
      onViewChange = () => {}, onCapture = async () => false }) {
      this.document = document; this.window = window;
      this.onBegin = onBegin; this.onStop = onStop;
      this.onViewChange = onViewChange; this.onCapture = onCapture;
      this.language = "mn"; this.active = false; this.open = false; this.phase = "idle";
      this.statusKey = "ready"; this.ticket = 0;
      this.stream = null; this.context = null; this.source = null; this.analyser = null;
      this.capture = null; this.sink = null;
      this.frame = null; this.lastDraw = -Infinity; this.timeData = null; this.frequencyData = null;
      this.recording = false; this.takeReady = false; this.takeDuration = 0; this.available = 0;
      this.destination = "analysis";
      this.takeId = 0;
      this.finishing = false; this.pendingSnapshot = null; this.snapshotId = 0;
      this.trackListeners = [];
      this.$("analysisMicOpen").addEventListener("click", () => { void this.openView(); });
      this.$("analysisMicRetry").addEventListener("click", () => { void this.start(); });
      this.$("analysisMicRecord").addEventListener("click", () => this.beginTake());
      this.$("analysisMicRecordStop").addEventListener("click", () => this.stopTake());
      this.$("analysisMicFinish").addEventListener("click", () => { void this.finish(); });
      this.$("analysisMicDiscard").addEventListener("click", () => this.stop());
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
    openView(destination = "analysis") {
      if (!this.active || this.open) return false;
      this.open = true;
      this.destination = ["A", "B"].includes(destination) ? destination : "analysis";
      this.recording = false; this.takeReady = false; this.takeDuration = 0; this.available = 0;
      this.onViewChange(true);
      this.render();
      this.$("analysisMicTitle").focus?.();
      // start() calls getUserMedia immediately in the original click gesture.
      return this.start();
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
      const live = this.phase === "live";
      this.$("analysisWorkspace").hidden = !this.active || this.open;
      this.$("analysisMicWorkspace").hidden = !this.active || !this.open;
      this.$("analysisMicRecord").hidden = this.recording;
      this.$("analysisMicRecordStop").hidden = !this.recording;
      this.$("analysisMicRecord").disabled = !live || this.finishing;
      this.$("analysisMicRecordStop").disabled = !live || this.finishing;
      this.$("analysisMicFinish").disabled = this.finishing;
      this.$("analysisMicDiscard").disabled = this.finishing;
      this.$("analysisMicRetry").hidden = this.phase !== "error";
      this.$("analysisMicRecordingStatus").hidden = !live;
      const indicator = this.$("analysisMicIndicator");
      indicator.dataset.state = live ? "live" : this.phase === "requesting" ? "requesting" : "off";
      this.put("analysisMicIndicator", this.text(live ? "on" : this.phase === "requesting" ? "pending" : "off"));
      this.put("analysisMicStatus", this.text(this.finishing ? "finishing" : this.statusKey));
      this.$("analysisMicStatus").classList.toggle("error", this.phase === "error");
      this.renderRecording();
    }
    renderRecording() {
      const digits = value => fmt(value || 0, 1);
      this.put("analysisMicRecordingStatus", this.recording ? this.text("recording", { seconds: digits(this.takeDuration) }) :
        this.takeReady ? this.text("saved", { seconds: digits(this.takeDuration) }) :
          this.text("rolling", { seconds: digits(this.available) }));
    }
    async start() {
      if (!this.active || !this.open || this.isActive()) return false;
      const navigator = this.window.navigator, Context = this.window.AudioContext || this.window.webkitAudioContext;
      if (this.window.isSecureContext === false || !navigator?.mediaDevices?.getUserMedia) {
        this.phase = "error"; this.statusKey = "unavailable"; this.render(); return false;
      }
      if (typeof Context !== "function" || typeof this.window.AudioWorkletNode !== "function") {
        this.phase = "error"; this.statusKey = "workletError"; this.render(); return false;
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
        if (ticket !== this.ticket || !this.active || !this.open || this.document.hidden) {
          stopTracks(stream); return false;
        }
        if (!stream.getAudioTracks?.().some(track => track.readyState !== "ended")) {
          throw Object.assign(new Error("No live audio track"), { name: "NotFoundError" });
        }
        const context = new Context();
        this.context = context; this.stream = stream;
        // Assign each node as soon as it exists so an intermediate failure can
        // disconnect every allocated node, not just close the context.
        if (!context.audioWorklet?.addModule) throw Object.assign(new Error("No AudioWorklet"), { code: "worklet" });
        await context.audioWorklet.addModule("./sound-mic-capture-worklet.js?v=s077");
        if (ticket !== this.ticket || !this.active || !this.open || this.document.hidden) {
          if (ticket === this.ticket) this.releaseGraph();
          return false;
        }
        const source = this.source = context.createMediaStreamSource(stream);
        const analyser = this.analyser = context.createAnalyser();
        const capture = this.capture = new this.window.AudioWorkletNode(context, "soundlab-mic-capture", {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1,
          channelCountMode: "explicit"
        });
        capture.port.onmessage = event => this.onCaptureMessage(event.data, ticket);
        capture.port.onmessageerror = () => { if (ticket === this.ticket) this.stop("captureError"); };
        const sink = this.sink = context.createGain();
        analyser.fftSize = FFT_SIZE; analyser.minDecibels = MIN_DB;
        analyser.maxDecibels = MAX_DB; analyser.smoothingTimeConstant = 0.18;
        // Keeping the graph connected ensures that the analyser runs on WebKit.
        // The output is always exactly zero; microphone samples never reach speakers.
        sink.gain.value = 0;
        source.connect(analyser); analyser.connect(capture); capture.connect(sink); sink.connect(context.destination);
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
        if (ticket !== this.ticket || !this.active || !this.open || this.document.hidden) {
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
        this.phase = "error"; this.statusKey = error?.code === "worklet" ? "workletError" : errorKey(error); this.render();
        return false;
      }
    }
    onCaptureMessage(message, ticket) {
      if (ticket !== this.ticket || !message || typeof message !== "object") return;
      if (message.type === "progress") {
        this.available = clamp(Number(message.available) || 0, 0, 30);
        if (this.recording) this.takeDuration = clamp(Number(message.take) || 0, 0, 30);
        this.renderRecording();
      } else if (message.type === "takeStopped" && message.takeId === this.takeId) {
        this.recording = false;
        this.takeReady = Number(message.frames) > 0;
        this.takeDuration = (Number(message.frames) || 0) / (Number(message.sampleRate) || 48000);
        if (message.reason === "limit") this.statusKey = "recordCap";
        this.render();
      } else if (message.type === "snapshot" && this.pendingSnapshot?.id === message.id) {
        const pending = this.pendingSnapshot;
        this.pendingSnapshot = null;
        this.window.clearTimeout(pending.timeout);
        pending.resolve(message);
      }
    }
    beginTake() {
      if (!this.open || this.phase !== "live" || !this.capture || this.finishing) return false;
      this.capture.port.postMessage({ type: "beginTake", takeId: ++this.takeId });
      this.recording = true; this.takeReady = false; this.takeDuration = 0;
      this.statusKey = "live"; this.render(); return true;
    }
    stopTake() {
      if (!this.recording || !this.capture || this.finishing) return false;
      this.capture.port.postMessage({ type: "stopTake" });
      this.recording = false; this.render(); return true;
    }
    async finish() {
      if (!this.open || this.finishing) return false;
      if (this.phase !== "live" || !this.capture) { this.stop(); return false; }
      const ticket = this.ticket, id = ++this.snapshotId, node = this.capture;
      this.finishing = true; this.render();
      try {
        const result = await new Promise((resolve, reject) => {
          const timeout = this.window.setTimeout(() => {
            if (this.pendingSnapshot?.id === id) this.pendingSnapshot = null;
            reject(new Error("Microphone snapshot timed out"));
          }, 2500);
          this.pendingSnapshot = { id, timeout, resolve, reject };
          node.port.postMessage({ type: "snapshot", id });
        });
        if (ticket !== this.ticket || !this.open) return false;
        const samples = result.samples;
        if (!(samples instanceof Float32Array) || samples.length === 0) {
          this.finishing = false; this.statusKey = "captureEmpty"; this.render(); return false;
        }
        const rate = result.sampleRate;
        const encoder = this.window.SoundLabWav;
        if (!encoder?.encodeWav || typeof this.window.Blob !== "function") throw new Error("WAV codec unavailable");
        const wav = encoder.encodeWav([samples], rate, { maxSeconds: 30 });
        const blob = new this.window.Blob([wav], { type: "audio/wav" });
        const recordedAt = new Date().toISOString();
        const name = "microphone-" + recordedAt.replace(/[:.]/g, "-") + ".wav";
        const origin = { kind: "microphone", classId: "microphone", name,
          origin: "microphone", captureMode: result.mode, recordedAt };
        // Release microphone *before* opening the target offline source.
        const destination = this.destination;
        this.stop();
        return await this.onCapture(blob, name, origin, destination);
      } catch (_) {
        if (ticket !== this.ticket || !this.open) return false;
        this.finishing = false; this.statusKey = "captureError"; this.render(); return false;
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
      if (this.pendingSnapshot) {
        const pending = this.pendingSnapshot;
        this.pendingSnapshot = null;
        this.window.clearTimeout(pending.timeout);
        pending.reject(new Error("Microphone closed"));
      }
      for (const node of [this.source, this.analyser, this.capture, this.sink]) {
        try { node?.disconnect(); } catch (_) { /* A browser may already have detached it. */ }
      }
      const context = this.context, stream = this.stream;
      if (this.capture?.port) this.capture.port.onmessage = null;
      this.context = null; this.stream = null; this.source = null; this.analyser = null; this.capture = null; this.sink = null;
      stopTracks(stream);
      if (context?.close) {
        try { Promise.resolve(context.close()).catch(() => {}); } catch (_) { /* Already closed. */ }
      }
      this.timeData = null; this.frequencyData = null;
    }
    stop(reason = "stopped") {
      const wasActive = this.isActive(), wasOpen = this.open, destination = this.destination;
      this.ticket++; this.releaseGraph();
      this.open = false; this.finishing = false;
      this.destination = "analysis";
      this.recording = false; this.takeReady = false; this.takeDuration = 0; this.available = 0;
      this.phase = "idle"; this.statusKey = wasActive ? reason : "ready";
      this.render();
      if (wasOpen) this.onViewChange(false);
      if (wasOpen && this.active && !this.document.hidden) {
        this.$(["A", "B"].includes(destination) ? `compare${destination}Mic` : "analysisMicOpen").focus?.();
      }
      if (wasActive) this.onStop();
    }
  }
  return Object.freeze({ Controller, FFT_SIZE, MIN_DB, MAX_DB, constraints, words, errorKey });
});
