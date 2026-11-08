/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Local, editable project files. Opening always requires an explicit replacement.
 */
(function (root, factory) {
  const project = typeof module === "object" && module.exports ?
    require("./sound-project.js") : root.SoundLabProject;
  const api = factory(project);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabProjectUI = api;
})(typeof window !== "undefined" ? window : null, function (project) {
  "use strict";

  const TEXT = Object.freeze({
    en: {
      files: "Files · Save / Open / WAV",
      name: "Project name", save: "Save project", open: "Open project…",
      download: "Download prepared file", replace: "Replace workspace", cancel: "Cancel",
      hint: "Save the current One instrument or Many instruments workspace as an editable .soundlab.json file. Files stay on your device; audio is not included.",
      soloDefault: "My melody", ensembleDefault: "My arrangement",
      soloWorkspace: "One instrument", ensembleWorkspace: "Many instruments",
      reading: "Reading the project file…",
      review: "Project checked. Review the replacement below before opening it.",
      confirm: "Open “{title}” in {workspace}? This replaces that workspace's notes and settings. Save its current work first if you want to keep it. The other Compose workspace is unchanged.",
      saved: "Project file is ready. Use Download prepared file if the download did not start.",
      savedDraft: "Draft project file is ready. Your unfinished text is included; correct score errors before playback. Use Download prepared file if needed.",
      opened: "Opened “{title}”. Nothing plays until you press Play.",
      openedDraft: "Opened “{title}” as a draft. Your text is preserved; correct the score errors before playback.",
      cancelled: "Open cancelled. Your current work is unchanged.",
      fileError: "Choose a Sound Lab project (.soundlab.json or .json) up to {max} MiB.",
      sizeError: "This project file is too large. The limit is {max} MiB; your current work is unchanged.",
      formatError: "This is not a Sound Lab project file. Your current work is unchanged.",
      versionError: "This project uses an unsupported file version. Your current work is unchanged.",
      invalidError: "The project file is incomplete or damaged. Your current work is unchanged.",
      readError: "The file could not be read. Your current work is unchanged.",
      saveError: "The project file could not be prepared. Each ABC score or pattern draft has a 1 MiB text safety budget; check the project name and settings too. Your work is unchanged.",
      saveSizeError: "This project exceeds the {max} MiB file limit. Reduce the project before saving; your work is unchanged.",
      restoreError: "The project could not be opened. Please try again."
    },
    mn: {
      files: "Файл · Хадгалах / Нээх / WAV",
      name: "Төслийн нэр", save: "Төсөл хадгалах", open: "Төсөл нээх…",
      download: "Бэлдсэн файлыг татах", replace: "Одоогийн ажлыг солих", cancel: "Болих",
      hint: "Нэг хөгжим эсвэл Олон хөгжим хэсгийн одоогийн ажлыг засах боломжтой .soundlab.json файл болгон хадгална. Файлыг серверт илгээхгүй; аудио орохгүй.",
      soloDefault: "Миний аялгуу", ensembleDefault: "Миний найруулга",
      soloWorkspace: "Нэг хөгжим", ensembleWorkspace: "Олон хөгжим",
      reading: "Төслийн файлыг уншиж байна…",
      review: "Төслийн файлыг шалгалаа. Нээхийн өмнө доорх солих үйлдлийг баталгаажуулна уу.",
      confirm: "“{title}” төслийг {workspace} хэсэгт нээх үү? Тус хэсгийн нот, тохиргоо солигдоно. Одоогийн ажлаа үлдээх бол эхлээд хадгалаарай. Ая зохиохын нөгөө хэсэг өөрчлөгдөхгүй.",
      saved: "Төслийн файл бэлэн. Татаж эхлээгүй бол Бэлдсэн файлыг татах холбоосыг дараарай.",
      savedDraft: "Ноорог төслийн файл бэлэн. Дуусаагүй бичгийг оруулсан; тоглуулахын өмнө нотын алдааг засаарай. Шаардлагатай бол Бэлдсэн файлыг татах холбоосыг дарна уу.",
      opened: "“{title}” төслийг нээлээ. Тоглуулах товч дарах хүртэл дуугарахгүй.",
      openedDraft: "“{title}” төслийг нооргоор нээлээ. Эх бичиг хэвээр; тоглуулахын өмнө нотын алдааг засаарай.",
      cancelled: "Нээх үйлдлийг болилоо. Одоогийн ажил өөрчлөгдөөгүй.",
      fileError: "{max} МиБ-аас ихгүй Sound Lab төслийн файл (.soundlab.json эсвэл .json) сонгоно уу.",
      sizeError: "Төслийн файл хэт том байна. Хязгаар нь {max} МиБ; одоогийн ажил өөрчлөгдөөгүй.",
      formatError: "Энэ нь Sound Lab төслийн файл биш байна. Одоогийн ажил өөрчлөгдөөгүй.",
      versionError: "Төслийн файлын энэ хувилбарыг одоогоор дэмжихгүй. Одоогийн ажил өөрчлөгдөөгүй.",
      invalidError: "Төслийн файл дутуу эсвэл гэмтсэн байна. Одоогийн ажил өөрчлөгдөөгүй.",
      readError: "Файлыг уншиж чадсангүй. Одоогийн ажил өөрчлөгдөөгүй.",
      saveError: "Төслийн файлыг бэлдэж чадсангүй. ABC нот болон загварын ноорог тус бүр 1 МиБ хүртэл бичвэртэй байж болно; төслийн нэр, тохиргоог мөн шалгана уу. Одоогийн ажил өөрчлөгдөөгүй.",
      saveSizeError: "Төсөл {max} МиБ файлын хязгаараас хэтэрлээ. Хадгалахын өмнө хэмжээг нь багасгана уу; одоогийн ажил өөрчлөгдөөгүй.",
      restoreError: "Төслийг нээж чадсангүй. Дахин оролдоно уу."
    }
  });

  class Controller {
    constructor({ document, getCurrentMode, capture, restore, isDraft = () => false,
      urlAPI = typeof URL !== "undefined" ? URL : null,
      BlobClass = typeof Blob !== "undefined" ? Blob : null }) {
      this.document = document;
      this.$ = id => document.getElementById(id);
      this.getCurrentMode = getCurrentMode;
      this.capture = capture;
      this.restore = restore;
      this.isDraft = isDraft;
      this.urlAPI = urlAPI;
      this.BlobClass = BlobClass;
      this.language = "mn";
      this.mode = getCurrentMode();
      this.names = { solo: "", ensemble: "" };
      this.pending = null;
      this.loading = false;
      this.loadGeneration = 0;
      this.downloadUrl = null;
      this.downloadName = "";
      this.status = null;
      this.disposed = false;
      this.listeners = [];
      this.on("projectName", "input", () => { this.names[this.mode] = this.$("projectName").value; });
      this.on("projectSave", "click", () => this.save());
      this.on("projectOpen", "click", () => {
        this.$("projectFile").value = "";
        this.$("projectFile").click();
      });
      this.on("projectFile", "change", event => this.openFile(event.target.files?.[0]));
      this.on("projectReplace", "click", () => this.replacePending());
      this.on("projectCancel", "click", () => this.cancelPending());
      this.$("projectConfirm").hidden = true;
      this.$("projectDownload").hidden = true;
      this.renderLanguage("mn");
    }

    on(id, type, listener) {
      const node = this.$(id);
      node.addEventListener(type, listener);
      this.listeners.push({ node, type, listener });
    }

    t(key, values = {}) {
      return (TEXT[this.language][key] || "").replace(/\{(\w+)\}/g,
        (_, name) => String(values[name] ?? ""));
    }

    setStatus(key, values = {}, error = false) {
      this.status = key ? { key, values, error } : null;
      this.renderStatus();
    }

    renderStatus() {
      const node = this.$("projectStatus");
      node.textContent = this.status ? this.t(this.status.key, this.status.values) : "";
      node.classList.toggle("error", Boolean(this.status?.error));
    }

    renderDownload() {
      const link = this.$("projectDownload");
      link.textContent = this.t("download") + (this.downloadName ? ": " + this.downloadName : "");
      if (this.downloadName) link.setAttribute("aria-label", link.textContent);
      else link.removeAttribute?.("aria-label");
    }

    renderPending() {
      this.$("projectConfirm").hidden = !this.pending;
      if (!this.pending) {
        this.$("projectConfirmText").textContent = "";
        return;
      }
      this.$("projectConfirmText").textContent = this.t("confirm", {
        title: this.pending.title || this.t(this.pending.mode + "Default"),
        workspace: this.t(this.pending.mode + "Workspace")
      });
    }

    renderLanguage(language) {
      if (!TEXT[language] || this.disposed) return;
      this.language = language;
      this.document.querySelectorAll("[data-project-i18n]").forEach(node => {
        node.textContent = this.t(node.getAttribute("data-project-i18n"));
      });
      this.$("projectName").placeholder = this.t(this.mode + "Default");
      this.renderDownload();
      this.renderStatus();
      this.renderPending();
    }

    modeChanged() {
      if (this.disposed) return;
      const mode = this.getCurrentMode();
      if (mode !== "solo" && mode !== "ensemble") return;
      if (mode !== this.mode) {
        this.names[this.mode] = this.$("projectName").value;
        this.mode = mode;
        this.$("projectName").value = this.names[mode];
        if (!this.pending && !this.loading) this.setStatus(null);
      }
      this.$("projectName").placeholder = this.t(mode + "Default");
    }

    save() {
      if (this.disposed) return false;
      this.modeChanged();
      try {
        const title = this.$("projectName").value.trim() || this.t(this.mode + "Default");
        const encoded = project.encode({ format: project.FORMAT, version: project.VERSION,
          title, mode: this.mode, content: this.capture(this.mode) });
        const blob = new this.BlobClass([encoded], { type: "application/json;charset=utf-8" });
        const name = project.filename(title);
        const nextUrl = this.urlAPI.createObjectURL(blob);
        const oldUrl = this.downloadUrl;
        const link = this.$("projectDownload");
        this.downloadUrl = nextUrl;
        this.downloadName = name;
        link.href = nextUrl;
        link.download = name;
        link.hidden = false;
        this.renderDownload();
        if (oldUrl) this.urlAPI.revokeObjectURL(oldUrl);
        // Keep the visible link if the browser declines a programmatic download.
        try { link.click(); } catch (_) { /* The user can follow the link directly. */ }
        this.setStatus(this.isDraft(this.mode) ? "savedDraft" : "saved");
        return true;
      } catch (error) {
        this.setStatus(error?.code === "size" ? "saveSizeError" : "saveError",
          { max: project.MAX_BYTES / (1024 * 1024) }, true);
        return false;
      }
    }

    async openFile(file) {
      this.$("projectFile").value = "";
      if (this.disposed || !file) return false;
      const generation = ++this.loadGeneration;
      this.pending = null;
      this.renderPending();
      this.loading = false;
      const values = { max: project.MAX_BYTES / (1024 * 1024) };
      if (typeof file.name !== "string" || !/\.json$/i.test(file.name) ||
        typeof file.text !== "function" || !Number.isSafeInteger(file.size) || file.size < 0) {
        this.setStatus("fileError", values, true);
        return false;
      }
      if (file.size > project.MAX_BYTES) {
        this.setStatus("sizeError", values, true);
        return false;
      }
      this.loading = true;
      this.setStatus("reading");
      let text;
      try {
        text = await file.text();
      } catch (_) {
        if (generation === this.loadGeneration && !this.disposed) {
          this.loading = false;
          this.setStatus("readError", {}, true);
        }
        return false;
      }
      if (generation !== this.loadGeneration || this.disposed) return false;
      this.loading = false;
      try {
        this.pending = project.decode(text);
      } catch (error) {
        const key = { format: "formatError", version: "versionError", size: "sizeError" }[error?.code] || "invalidError";
        this.setStatus(key, values, true);
        return false;
      }
      this.renderPending();
      this.setStatus("review");
      this.$("projectReplace").focus?.();
      return true;
    }

    replacePending() {
      if (this.disposed || !this.pending) return false;
      try {
        // The callback may change tabs and render this controller synchronously.
        const next = project.validate(this.pending);
        this.restore(next);
        ++this.loadGeneration;
        this.loading = false;
        this.names[next.mode] = next.title;
        this.mode = this.getCurrentMode();
        this.$("projectName").value = this.names[this.mode];
        this.pending = null;
        this.renderPending();
        this.$("projectName").placeholder = this.t(this.mode + "Default");
        this.setStatus(this.isDraft(next.mode) ? "openedDraft" : "opened", {
          title: next.title || this.t(next.mode + "Default")
        });
        this.$("projectName").focus?.();
        return true;
      } catch (_) {
        this.setStatus("restoreError", {}, true);
        return false;
      }
    }

    cancelPending() {
      if (this.disposed) return;
      ++this.loadGeneration;
      this.pending = null;
      this.loading = false;
      this.renderPending();
      this.setStatus("cancelled");
      this.$("projectOpen").focus?.();
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      ++this.loadGeneration;
      this.loading = false;
      this.pending = null;
      this.renderPending();
      for (const { node, type, listener } of this.listeners) {
        node.removeEventListener?.(type, listener);
      }
      this.listeners = [];
      if (this.downloadUrl) this.urlAPI.revokeObjectURL(this.downloadUrl);
      this.downloadUrl = null;
      this.downloadName = "";
      this.$("projectDownload").hidden = true;
      this.$("projectDownload").removeAttribute("href");
      this.renderDownload();
    }
  }

  return Object.freeze({ TEXT, Controller });
});
