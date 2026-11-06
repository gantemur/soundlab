/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const project = require("./sound-project.js");
const projectUI = require("./sound-project-ui.js");

const ABC = "X:1\nT:Melody\nM:4/4\nL:1/4\nQ:1/4=96\nK:C\nC D E G |]";
const clone = value => JSON.parse(JSON.stringify(value));
const solo = () => ({ abc: ABC, instrument: "guitar", tuning: "equal", volume: 38,
  guitar: { mode: "alternate", spacingMs: 27 } });
const ensemble = () => ({ tuning: "equal", tracks: [
  { id: 1, name: "Melody", instrument: "flute", volume: 38, mute: false, solo: false, abc: ABC }
], selectedId: 1, nextId: 2, editor: { gridBar: 1, gridStep: 16, gridStrength: "normal" } });
const sample = (mode = "solo", title = "A project") => ({
  format: project.FORMAT, version: project.VERSION, title, mode,
  content: mode === "solo" ? solo() : ensemble()
});

function element() {
  const handlers = new Map(), attrs = {}, classes = new Set();
  return { value: "", textContent: "", hidden: false, disabled: false, clicks: 0, focused: false,
    files: [], placeholder: "", href: "", download: "",
    set innerHTML(_) { throw new Error("Imported text must not become HTML"); },
    classList: { toggle(name, active) { if (active) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); } },
    setAttribute(name, value) { attrs[name] = String(value); },
    getAttribute(name) { return attrs[name]; },
    removeAttribute(name) { delete attrs[name]; if (name === "href") this.href = ""; },
    addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
    removeEventListener(type, fn) { handlers.set(type, (handlers.get(type) || []).filter(item => item !== fn)); },
    emit(type, values = {}) { return Promise.all((handlers.get(type) || []).map(fn => fn({ target: this, ...values }))); },
    click() { this.clicks++; return this.emit("click"); },
    focus() { this.focused = true; }
  };
}

function fixture() {
  const ids = ["projectName", "projectSave", "projectOpen", "projectFile", "projectDownload",
    "projectStatus", "projectConfirm", "projectConfirmText", "projectReplace", "projectCancel"];
  const elements = new Map(ids.map(id => [id, element()]));
  const labels = ["name", "save", "open", "download", "hint", "replace", "cancel", "files"].map(key => {
    const node = element(); node.setAttribute("data-project-i18n", key); return node;
  });
  const document = { getElementById: id => elements.get(id),
    querySelectorAll: selector => selector === "[data-project-i18n]" ? labels : [] };
  const created = [], revoked = [], restored = [], captured = [];
  const urlAPI = { createObjectURL(blob) {
    const url = "blob:project-" + (created.length + 1); created.push({ url, blob }); return url;
  }, revokeObjectURL: url => revoked.push(url) };
  let mode = "solo", draft = false, restoreFailure = false;
  const work = { solo: solo(), ensemble: ensemble() };
  const controller = new projectUI.Controller({ document, urlAPI, BlobClass: Blob,
    getCurrentMode: () => mode,
    capture(which) { captured.push(which); return clone(work[which]); },
    restore(next) {
      if (restoreFailure) throw new Error("Restore failed");
      restored.push(clone(next)); mode = next.mode; work[mode] = clone(next.content);
      controller.modeChanged(); controller.renderLanguage(controller.language);
    },
    isDraft: () => draft
  });
  return { controller, elements, labels, work, created, revoked, restored, captured, urlAPI,
    $: id => elements.get(id),
    mode: () => mode,
    setMode(value) { mode = value; controller.modeChanged(); },
    setDraft(value) { draft = value; },
    setRestoreFailure(value) { restoreFailure = value; }
  };
}

function fileFrom(value, name = "a-project.soundlab.json") {
  const text = typeof value === "string" ? value : project.encode(value);
  return { name, size: Buffer.byteLength(text), async text() { return text; } };
}

test("the compact Files disclosure label is translated without changing the workspace", () => {
  const app = fixture();
  const label = app.labels.find(node => node.getAttribute("data-project-i18n") === "files");
  const before = clone(app.work);
  assert.equal(label.textContent, "Файл · Хадгалах / Нээх / WAV");
  app.controller.renderLanguage("en");
  assert.equal(label.textContent, "Files · Save / Open / WAV");
  app.controller.renderLanguage("mn");
  assert.equal(label.textContent, "Файл · Хадгалах / Нээх / WAV");
  assert.deepEqual(app.work, before);
  assert.equal(app.captured.length, 0);
  assert.equal(app.restored.length, 0);
});

test("project Save is local, defaults to Mongolian and prepares editable JSON with a fallback link", async () => {
  const app = fixture();
  assert.equal(app.controller.language, "mn");
  assert.equal(app.labels[0].textContent, "Төслийн нэр");
  assert.equal(app.$("projectName").placeholder, "Миний аялгуу");
  assert.equal(app.$("projectConfirm").hidden, true);
  assert.equal(app.$("projectDownload").hidden, true);
  app.$("projectName").value = "  Гитарын аялгуу  ";
  await app.$("projectSave").click();
  assert.deepEqual(app.captured, ["solo"]);
  assert.equal(app.restored.length, 0, "Saving never replaces work or starts playback");
  assert.equal(app.created.length, 1);
  assert.equal(app.created[0].blob.type, "application/json;charset=utf-8");
  const decoded = project.decode(await app.created[0].blob.text());
  assert.equal(decoded.title, "Гитарын аялгуу");
  assert.equal(decoded.mode, "solo");
  assert.deepEqual(decoded.content, solo());
  assert.equal(app.$("projectDownload").href, app.created[0].url);
  assert.equal(app.$("projectDownload").download, project.filename(decoded.title));
  assert.ok(app.$("projectDownload").textContent.includes(project.filename(decoded.title)));
  assert.equal(app.$("projectDownload").hidden, false);
  assert.equal(app.$("projectDownload").clicks, 1);
  assert.equal(app.$("projectStatus").classList.contains("error"), false);
  assert.match(app.$("projectStatus").textContent, /файл бэлэн/);
});

test("project Save preserves invalid raw ABC as a draft without requiring playback", async () => {
  const app = fixture();
  app.controller.renderLanguage("en");
  app.work.solo.abc = "unfinished [C";
  app.setDraft(true);
  assert.equal(app.controller.save(), true);
  const decoded = project.decode(await app.created[0].blob.text());
  assert.equal(decoded.content.abc, "unfinished [C");
  assert.match(app.$("projectStatus").textContent, /Draft.*unfinished text/);
  assert.equal(app.$("projectStatus").classList.contains("error"), false);
});

test("each Compose workspace keeps its own project name through mode and language changes", () => {
  const app = fixture();
  app.$("projectName").value = "Solo idea";
  app.setMode("ensemble");
  assert.equal(app.$("projectName").value, "");
  assert.equal(app.$("projectName").placeholder, "Миний найруулга");
  app.controller.renderLanguage("en");
  assert.equal(app.$("projectName").placeholder, "My arrangement");
  app.$("projectName").value = "Ensemble idea";
  app.setMode("solo");
  assert.equal(app.$("projectName").value, "Solo idea");
  app.controller.renderLanguage("mn");
  assert.equal(app.$("projectName").value, "Solo idea");
  app.setMode("ensemble");
  assert.equal(app.$("projectName").value, "Ensemble idea");
});

test("opening a project validates first and requires explicit replacement of its own workspace", async () => {
  const app = fixture(), before = clone(app.work);
  app.$("projectName").value = "Keep this solo name";
  app.controller.renderLanguage("en");
  app.$("projectFile").value = "selected-file";
  assert.equal(await app.controller.openFile(fileFrom(sample("ensemble", "Ensemble from disk"))), true);
  assert.equal(app.$("projectFile").value, "");
  assert.equal(app.$("projectConfirm").hidden, false);
  assert.match(app.$("projectConfirmText").textContent, /Ensemble from disk.*Many instruments/);
  assert.match(app.$("projectConfirmText").textContent, /other Compose workspace is unchanged/);
  assert.equal(app.$("projectReplace").focused, true);
  assert.deepEqual(app.work, before);
  assert.equal(app.restored.length, 0);
  assert.equal(app.mode(), "solo");
  assert.equal(app.controller.replacePending(), true);
  assert.equal(app.restored.length, 1);
  assert.equal(app.mode(), "ensemble");
  assert.equal(app.$("projectName").value, "Ensemble from disk");
  assert.equal(app.$("projectConfirm").hidden, true);
  assert.match(app.$("projectStatus").textContent, /Opened.*Nothing plays/);
  assert.deepEqual(app.work.solo, before.solo);
  app.setMode("solo");
  assert.equal(app.$("projectName").value, "Keep this solo name");
});

test("a project can be saved before confirming an open, or cancelled without losing current work", async () => {
  const app = fixture(), before = clone(app.work);
  await app.controller.openFile(fileFrom(sample("ensemble")));
  assert.equal(app.controller.save(), true);
  assert.ok(app.controller.pending, "Saving current work does not dismiss the pending open");
  await app.$("projectCancel").click();
  assert.equal(app.$("projectConfirm").hidden, true);
  assert.equal(app.$("projectOpen").focused, true);
  assert.equal(app.controller.replacePending(), false);
  assert.equal(app.restored.length, 0);
  assert.deepEqual(app.work, before);
});

test("project Open rejects corrupt, unrelated and unsupported-version files before touching work", async () => {
  const app = fixture(), before = clone(app.work);
  app.controller.renderLanguage("en");
  for (const [data, message] of [
    ["{not json", /incomplete or damaged/],
    [JSON.stringify({ ...sample(), format: "another-app" }), /not a Sound Lab project/],
    [JSON.stringify({ ...sample(), version: 9000 }), /unsupported file version/],
    [JSON.stringify({ ...sample(), content: { abc: ABC } }), /incomplete or damaged/]
  ]) {
    await app.controller.openFile(fileFrom(sample("ensemble")));
    assert.equal(await app.controller.openFile(fileFrom(data)), false);
    assert.equal(app.controller.pending, null);
    assert.equal(app.$("projectConfirm").hidden, true);
    assert.match(app.$("projectStatus").textContent, message);
    assert.equal(app.$("projectStatus").classList.contains("error"), true);
    assert.deepEqual(app.work, before);
    assert.equal(app.restored.length, 0);
  }
  app.controller.renderLanguage("mn");
  assert.match(app.$("projectStatus").textContent, /Одоогийн ажил өөрчлөгдөөгүй/);
});

test("file size and file-kind guards reject before reading and reset the chooser", async () => {
  const app = fixture();
  app.controller.renderLanguage("en");
  let reads = 0;
  const read = async () => { reads++; return project.encode(sample()); };
  for (const bad of [
    { name: "score.abc", size: 12, text: read },
    { name: "score.json", size: -1, text: read },
    { name: "score.json", size: NaN, text: read },
    { name: "score.json", size: 12 },
    { name: "score.json", size: project.MAX_BYTES + 1, text: read }
  ]) {
    app.$("projectFile").value = "chosen-file";
    assert.equal(await app.controller.openFile(bad), false);
    assert.equal(app.$("projectFile").value, "");
    assert.equal(app.$("projectStatus").classList.contains("error"), true);
  }
  assert.equal(reads, 0);
  assert.match(app.$("projectStatus").textContent, /too large/);
  assert.match(app.$("projectStatus").textContent, new RegExp(String(project.MAX_BYTES / 1048576) + " MiB"));
  assert.equal(app.restored.length, 0);
});

test("file read failures are localized and do not replace work", async () => {
  const app = fixture(), before = clone(app.work);
  const failure = { name: "read-failure.json", size: 30,
    async text() { throw new Error("Device unavailable"); } };
  assert.equal(await app.controller.openFile(failure), false);
  assert.match(app.$("projectStatus").textContent, /уншиж чадсангүй/);
  app.controller.renderLanguage("en");
  assert.match(app.$("projectStatus").textContent, /could not be read/);
  assert.equal(app.controller.loading, false);
  assert.deepEqual(app.work, before);
  assert.equal(app.restored.length, 0);
});

test("older asynchronous file reads cannot replace a newer candidate or cancelled operation", async () => {
  const app = fixture();
  let finishFirst, finishSecond;
  const first = app.controller.openFile({ name: "first.json", size: 500,
    text: () => new Promise(resolve => { finishFirst = resolve; }) });
  const second = app.controller.openFile({ name: "second.json", size: 500,
    text: () => new Promise(resolve => { finishSecond = resolve; }) });
  finishSecond(project.encode(sample("ensemble", "Second file")));
  assert.equal(await second, true);
  finishFirst(project.encode(sample("solo", "First file")));
  assert.equal(await first, false);
  assert.equal(app.controller.pending.title, "Second file");
  assert.match(app.$("projectConfirmText").textContent, /Second file/);
  let finishCancelled;
  const cancelled = app.controller.openFile({ name: "cancelled.json", size: 500,
    text: () => new Promise(resolve => { finishCancelled = resolve; }) });
  app.controller.cancelPending();
  finishCancelled(project.encode(sample()));
  assert.equal(await cancelled, false);
  assert.equal(app.controller.pending, null);
  assert.equal(app.$("projectConfirm").hidden, true);
  assert.equal(app.restored.length, 0);
});

test("a stale rejected read cannot erase a later successful candidate", async () => {
  const app = fixture();
  let rejectOld;
  const old = app.controller.openFile({ name: "old.json", size: 10,
    text: () => new Promise((_, reject) => { rejectOld = reject; }) });
  await app.controller.openFile(fileFrom(sample("ensemble", "New file")));
  rejectOld(new Error("Old failure"));
  assert.equal(await old, false);
  assert.equal(app.controller.pending.title, "New file");
  assert.equal(app.$("projectStatus").classList.contains("error"), false);
});

test("download URLs are replaced and disposed without invalidating a previous successful file on save error", () => {
  const app = fixture();
  assert.equal(app.controller.save(), true);
  assert.equal(app.controller.save(), true);
  assert.deepEqual(app.revoked, [app.created[0].url]);
  const kept = app.$("projectDownload").href;
  app.work.solo.instrument = "unknown instrument";
  assert.equal(app.controller.save(), false);
  assert.equal(app.$("projectDownload").href, kept);
  assert.equal(app.created.length, 2);
  assert.deepEqual(app.revoked, [app.created[0].url]);
  app.controller.dispose();
  assert.deepEqual(app.revoked, app.created.map(item => item.url));
  assert.equal(app.$("projectDownload").hidden, true);
  assert.equal(app.$("projectDownload").href, "");
  app.controller.dispose();
  assert.equal(app.revoked.length, 2);
});

test("a blocked automatic download retains a usable explicit link", () => {
  const app = fixture();
  app.controller.renderLanguage("en");
  app.$("projectDownload").click = () => { throw new Error("Automatic download blocked"); };
  assert.equal(app.controller.save(), true);
  assert.equal(app.$("projectDownload").hidden, false);
  assert.equal(app.$("projectDownload").href, app.created[0].url);
  assert.match(app.$("projectStatus").textContent, /if the download did not start/);
  assert.equal(app.$("projectStatus").classList.contains("error"), false);
});

test("Save errors explain text and file-size bounds without discarding the prepared download", () => {
  const app = fixture();
  app.controller.renderLanguage("en");
  app.$("projectName").value = "Prepared melody";
  app.controller.save();
  const previousUrl = app.$("projectDownload").href;
  app.work.solo.abc = "C".repeat(8193);
  assert.equal(app.controller.save(), false);
  assert.match(app.$("projectStatus").textContent, /8,192 characters/);
  assert.equal(app.$("projectDownload").href, previousUrl);
  app.controller.capture = () => { throw new project.ProjectError("size", "Oversized project"); };
  assert.equal(app.controller.save(), false);
  assert.match(app.$("projectStatus").textContent, /MiB file limit/);
  app.setMode("ensemble");
  assert.match(app.$("projectDownload").textContent, /Prepared melody\.soundlab\.json/);
  app.controller.renderLanguage("mn");
  assert.match(app.$("projectDownload").textContent, /Бэлдсэн файлыг татах: Prepared melody/);
  assert.equal(app.$("projectDownload").href, previousUrl);
});

test("open controls can read the same file again; imported titles are only text", async () => {
  const app = fixture();
  const title = "<img src=x onerror=alert(1)>";
  const file = fileFrom(sample("solo", title), "TITLE.JSON");
  await app.$("projectOpen").click();
  assert.equal(app.$("projectFile").clicks, 1);
  app.$("projectFile").files = [file];
  app.$("projectFile").value = "selected";
  await app.$("projectFile").emit("change");
  assert.equal(app.$("projectFile").value, "");
  assert.ok(app.$("projectConfirmText").textContent.includes(title));
  app.controller.renderLanguage("en");
  assert.ok(app.$("projectConfirmText").textContent.includes(title));
  assert.match(app.$("projectConfirmText").textContent, /One instrument/);
  app.controller.replacePending();
  assert.equal(app.$("projectName").value, title);
  assert.ok(app.$("projectStatus").textContent.includes(title));
  await app.$("projectFile").emit("change");
  assert.equal(app.$("projectConfirm").hidden, false);
  assert.equal(app.restored.length, 1, "A repeated selection still requires confirmation");
});

test("opening a draft reports it and a restore failure is never reported as success", async () => {
  const app = fixture();
  app.controller.renderLanguage("en");
  const draft = sample("solo", "Unfinished");
  draft.content.abc = "[C";
  app.setDraft(true);
  await app.controller.openFile(fileFrom(draft));
  assert.equal(app.controller.replacePending(), true);
  assert.equal(app.work.solo.abc, "[C");
  assert.match(app.$("projectStatus").textContent, /as a draft.*text is preserved/);
  await app.controller.openFile(fileFrom(sample("ensemble")));
  app.setRestoreFailure(true);
  assert.equal(app.controller.replacePending(), false);
  assert.match(app.$("projectStatus").textContent, /could not be opened/);
  assert.equal(app.$("projectStatus").classList.contains("error"), true);
  assert.equal(app.$("projectConfirm").hidden, false);
});

test("disposing cancels pending reads and removes event handlers", async () => {
  const app = fixture();
  let finish;
  const opening = app.controller.openFile({ name: "pending.json", size: 500,
    text: () => new Promise(resolve => { finish = resolve; }) });
  app.controller.dispose();
  finish(project.encode(sample()));
  assert.equal(await opening, false);
  await app.$("projectSave").click();
  assert.equal(app.created.length, 0);
  assert.equal(app.controller.pending, null);
  assert.equal(app.$("projectConfirm").hidden, true);
});
