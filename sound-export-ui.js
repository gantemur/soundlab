/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Local offline WAV export controls; no live-audio or recorder access.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabExportUI = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const TEXT = Object.freeze({
    mn: {
      button: "WAV гаргах", busy: "WAV бэлдэж байна…",
      hint: "Одоогийн хэсгийг тоглуулахгүйгээр WAV болгоно · моно · 44.1 кГц · 16 бит.",
      soloDefault: "Миний аялгуу", ensembleDefault: "Миний найруулга",
      rendering: "“{name}” файлыг одоогийн нот, тохиргооны хуулбараас бэлдэж байна…",
      ready: "Бэлэн: “{name}” · {duration} сек · моно · {rate} кГц · 16 бит PCM.",
      attenuation: "Оргил түвшин хэтрэхээс сэргийлж нийт дууг {db} дБ-ээр сулруулсан.",
      silent: "Файл чимээгүй байна. Хүсээгүй бол дуугүй/ганцаар тохиргоо, чанга, нотуудыг шалгаарай.",
      fallback: "Татаж эхлээгүй бол доорх холбоосыг дарна уу.",
      download: "Бэлдсэн WAV файлыг татах",
      analyze: "Шинжлэх",
      failed: "“{name}” файлыг бэлдэж чадсангүй.",
      unsupported: "Энэ хөтөч офлайн WAV экспорт дэмжихгүй байна.",
      invalid: "Дуугүй болгосон мөрийг оролцуулан бүх мөрийн ABC, нотын хязгаар, бөмбөрийн ноорог, хөгжмийн тохиргоог шалгана уу.",
      limit: "Төсөл экспортын хязгаараас хэтэрлээ. Нотыг богиносгох эсвэл мөрийн тоог цөөлөөд дахин оролдоно уу.",
      render: "WAV бэлдэхэд алдаа гарлаа. Дахин оролдох эсвэл найруулгыг богиносгоно уу.",
      unchanged: "Одоогийн ажил болон өмнө бэлдсэн файл өөрчлөгдөөгүй.",
      interrupted: "Хүлээгдэж буй экспортын файлыг татахгүй. Бэлдэх ажил дууссаны дараа WAV гаргахыг дахин дарж болно."
    },
    en: {
      button: "Export WAV", busy: "Rendering WAV…",
      hint: "Render the current workspace without playing · mono WAV · 44.1 kHz · 16-bit.",
      soloDefault: "My melody", ensembleDefault: "My arrangement",
      rendering: "Rendering “{name}” from the captured notes and settings…",
      ready: "Ready: “{name}” · {duration} s · mono · {rate} kHz · 16-bit PCM.",
      attenuation: "Whole mix reduced by {db} dB to prevent clipping.",
      silent: "The file is silent. Check mute/solo, volume and notes if that was not intended.",
      fallback: "Use the link below if the download did not start.",
      download: "Download prepared WAV",
      analyze: "Analyze",
      failed: "Could not prepare “{name}”.",
      unsupported: "This browser does not support offline WAV export.",
      invalid: "Check the ABC, score limits, drum drafts and instrument settings in every track, including muted ones.",
      limit: "The project exceeds the export limits. Shorten the score or use fewer parts, then try again.",
      render: "WAV rendering failed. Try again, or use a shorter arrangement.",
      unchanged: "Your work and any previously prepared file are unchanged.",
      interrupted: "The pending export will not download. Once rendering finishes, you can press Export WAV again."
    }
  });

  function filename(title) {
    let stem = typeof title === "string" ? title.trim() : "";
    stem = stem.replace(/(?:\.soundlab\.json|\.wav)$/i, "")
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "-")
      .replace(/\s+/g, " ").trim().replace(/^\.+/, "");
    // Keep Unicode intact while leaving room under common filesystem limits.
    let safe = "", bytes = 0, characters = 0;
    for (const character of stem) {
      const code = character.codePointAt(0);
      const value = code >= 0xd800 && code <= 0xdfff ? "-" : character;
      const count = value === "-" || code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
      if (characters >= 100 || bytes + count > 180) break;
      safe += value; bytes += count; characters++;
    }
    safe = safe.replace(/[. ]+$/, "");
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) safe = "sound-lab-" + safe;
    return (safe || "sound-lab") + ".wav";
  }

  function fail(code) {
    const error = new Error("WAV export " + code);
    error.code = code;
    throw error;
  }

  function validResult(result) {
    const bytes = result?.bytes;
    return ArrayBuffer.isView(bytes) && Object.prototype.toString.call(bytes) === "[object Uint8Array]" &&
      bytes.byteLength > 44 && Number.isFinite(result.duration) && result.duration > 0 &&
      Number.isInteger(result.sampleRate) && result.sampleRate >= 8000 && result.sampleRate <= 192000 &&
      Number.isFinite(result.peak) && result.peak >= 0 &&
      Number.isFinite(result.gain) && result.gain > 0 && result.gain <= 1;
  }

  class Controller {
    constructor({ document, capture, getTitle = () => "", render, onAnalyze = null,
      urlAPI = typeof URL !== "undefined" ? URL : null,
      BlobClass = typeof Blob !== "undefined" ? Blob : null }) {
      this.document = document;
      this.$ = id => document.getElementById(id);
      this.capture = capture;
      this.getTitle = getTitle;
      this.render = render;
      this.urlAPI = urlAPI;
      this.BlobClass = BlobClass;
      this.language = "mn";
      this.busy = false;
      this.disposed = false;
      this.generation = 0;
      this.activeJob = null;
      this.downloadUrl = null;
      this.downloadName = "";
      this.preparedBlob = null;
      this.onAnalyze = onAnalyze;
      this.status = null;
      this.onClick = () => this.exportWav();
      this.onAnalyzeClick = () => {
        if (this.disposed || this.busy || !this.preparedBlob || typeof this.onAnalyze !== "function") return;
        try { Promise.resolve(this.onAnalyze(this.preparedBlob, this.downloadName)).catch(() => {}); }
        catch (_) { /* The Analysis controller reports decoder errors in its own panel. */ }
      };
      this.$("exportWav").addEventListener("click", this.onClick);
      this.$("exportAnalyze").addEventListener("click", this.onAnalyzeClick);
      this.$("exportDownload").hidden = true;
      this.$("exportAnalyze").hidden = true;
      this.renderLanguage("mn");
    }

    t(key, values = {}) {
      return (TEXT[this.language][key] || "").replace(/\{(\w+)\}/g,
        (_, name) => String(values[name] ?? ""));
    }

    renderControls() {
      const button = this.$("exportWav");
      button.textContent = this.t(this.busy ? "busy" : "button");
      button.disabled = this.busy || this.disposed;
      button.setAttribute("aria-busy", String(this.busy));
      const link = this.$("exportDownload");
      link.textContent = this.t("download") + (this.downloadName ? ": " + this.downloadName : "");
      if (this.downloadName) link.setAttribute("aria-label", link.textContent);
      else link.removeAttribute?.("aria-label");
      const analyze = this.$("exportAnalyze");
      analyze.textContent = this.t("analyze");
      analyze.disabled = this.busy || this.disposed || !this.preparedBlob;
      analyze.hidden = !this.preparedBlob || typeof this.onAnalyze !== "function";
    }

    renderStatus() {
      const node = this.$("exportStatus"), status = this.status;
      let value = "";
      if (status?.key === "ready") {
        value = this.t("ready", { name: status.name,
          duration: status.duration.toFixed(2).replace(/\.?0+$/, ""),
          rate: String(status.sampleRate / 1000) });
        if (status.gain < 1) {
          const reduction = -20 * Math.log10(status.gain);
          value += " " + this.t("attenuation", { db: reduction < .1 ? "<0.1" : reduction.toFixed(1) });
        }
        if (status.peak === 0) value += " " + this.t("silent");
        value += " " + this.t("fallback");
      } else if (status?.key === "error") {
        value = (status.name ? this.t("failed", { name: status.name }) + " " : "") +
          this.t(status.code) + " " + this.t("unchanged");
      } else if (status) value = this.t(status.key, status);
      node.textContent = value;
      node.classList.toggle("error", status?.key === "error");
    }

    renderLanguage(language) {
      if (!TEXT[language] || this.disposed) return;
      this.language = language;
      this.$("exportHint").textContent = this.t("hint");
      this.renderControls();
      this.renderStatus();
    }

    releaseUrl(url) {
      if (!url) return;
      try { this.urlAPI?.revokeObjectURL?.(url); }
      catch (_) { /* Cleanup must not invalidate a successfully prepared file. */ }
    }

    async exportWav() {
      if (this.disposed || this.busy) return false;
      const job = { generation: ++this.generation };
      this.activeJob = job;
      this.busy = true;
      this.renderControls();
      let name = "";
      try {
        const snapshot = this.capture();
        if (!snapshot || !["solo", "ensemble"].includes(snapshot.mode)) fail("invalid");
        const title = this.getTitle(snapshot.mode);
        name = filename(typeof title === "string" && title.trim() ? title.trim() : this.t(snapshot.mode + "Default"));
        this.status = { key: "rendering", name };
        this.renderStatus();
        if (typeof this.BlobClass !== "function" || typeof this.urlAPI?.createObjectURL !== "function") fail("unsupported");
        // The renderer validates and copies the captured data before its first
        // await, so later edits cannot change the file being prepared.
        const result = await this.render(snapshot);
        if (this.disposed || job.generation !== this.generation) return false;
        if (!validResult(result)) fail("render");
        const blob = new this.BlobClass([result.bytes], { type: "audio/wav" });
        const nextUrl = this.urlAPI.createObjectURL(blob);
        if (typeof nextUrl !== "string" || !nextUrl.startsWith("blob:")) fail("render");
        const oldUrl = this.downloadUrl;
        this.downloadUrl = nextUrl;
        this.downloadName = name;
        this.preparedBlob = blob;
        const link = this.$("exportDownload");
        link.href = nextUrl;
        link.download = name;
        link.hidden = false;
        this.status = { key: "ready", name, duration: result.duration, sampleRate: result.sampleRate,
          peak: result.peak, gain: result.gain };
        this.renderControls();
        this.renderStatus();
        // Browsers may decline an automatic download after asynchronous work.
        // The explicit link always remains available for a fresh user gesture.
        try { link.click(); } catch (_) { /* Keep the prepared file link. */ }
        this.releaseUrl(oldUrl);
        return true;
      } catch (error) {
        if (this.disposed || job.generation !== this.generation) return false;
        const code = ["unsupported", "invalid", "limit", "render"].includes(error?.code) ? error.code : "render";
        this.status = { key: "error", code, name };
        this.renderStatus();
        return false;
      } finally {
        if (this.activeJob === job) {
          this.activeJob = null;
          this.busy = false;
          if (!this.disposed) this.renderControls();
        }
      }
    }

    invalidate() {
      if (this.disposed) return;
      ++this.generation;
      if (this.busy) {
        this.status = { key: "interrupted" };
        this.renderStatus();
      }
      // Offline rendering is not immediately cancellable. Keep the button
      // disabled until it settles, avoiding overlapping expensive renders.
    }

    dispose() {
      if (this.disposed) return;
      this.invalidate();
      this.disposed = true;
      this.busy = false;
      this.activeJob = null;
      this.$("exportWav").removeEventListener?.("click", this.onClick);
      this.$("exportAnalyze").removeEventListener?.("click", this.onAnalyzeClick);
      this.releaseUrl(this.downloadUrl);
      this.downloadUrl = null;
      this.downloadName = "";
      this.preparedBlob = null;
      this.$("exportDownload").hidden = true;
      this.$("exportAnalyze").hidden = true;
      this.$("exportDownload").removeAttribute?.("href");
      this.status = null;
      this.renderControls();
      this.renderStatus();
    }
  }

  return Object.freeze({ TEXT, filename, Controller });
});
