/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const exportUI = require("./sound-export-ui.js");

function element() {
  const events = new Map(), attributes = {}, classes = new Set();
  return { textContent: "", hidden: false, disabled: false, href: "", download: "", clicks: 0,
    set innerHTML(_) { throw new Error("Imported titles must not become HTML"); },
    classList: { toggle(key, active) { if (active) classes.add(key); else classes.delete(key); },
      contains(key) { return classes.has(key); } },
    setAttribute(key, value) { attributes[key] = String(value); },
    getAttribute(key) { return attributes[key]; },
    removeAttribute(key) { delete attributes[key]; if (key === "href") this.href = ""; },
    addEventListener(type, fn) { if (!events.has(type)) events.set(type, []); events.get(type).push(fn); },
    removeEventListener(type, fn) { events.set(type, (events.get(type) || []).filter(value => value !== fn)); },
    click() { this.clicks++; return Promise.all((events.get("click") || []).map(fn => fn({ target: this }))); }
  };
}

function result(overrides = {}) {
  const bytes = new Uint8Array(46);
  bytes.set([82, 73, 70, 70]); bytes.set([87, 65, 86, 69], 8);
  return { bytes, duration: 4.125, sampleRate: 44100, peak: .6, gain: 1, ...overrides };
}

function fixture() {
  const ids = ["exportWav", "exportHint", "exportStatus", "exportDownload", "projectSave", "projectOpen", "playButton", "recordButton"];
  const elements = new Map(ids.map(id => [id, element()]));
  const document = { getElementById: id => elements.get(id) };
  const created = [], revoked = [], requests = [];
  const urlAPI = { createObjectURL(blob) {
    const url = "blob:export-" + (created.length + 1); created.push({ url, blob }); return url;
  }, revokeObjectURL(url) { revoked.push(url); } };
  let title = "", mode = "solo", captures = 0;
  const contents = { solo: { abc: "C D E G |]", guitar: { mode: "down", spacingMs: 20 } },
    ensemble: { tracks: [{ abc: "C4 |]", volume: 38 }] } };
  const controller = new exportUI.Controller({ document, urlAPI, BlobClass: Blob,
    capture() { captures++; return { mode, content: contents[mode] }; },
    getTitle: () => title,
    render(snapshot) {
      // The engine's contract copies and validates before its first await.
      const captured = JSON.parse(JSON.stringify(snapshot));
      return new Promise((resolve, reject) => { requests.push({ captured, resolve, reject }); });
    }
  });
  return { controller, created, revoked, requests, contents, urlAPI, $: id => elements.get(id),
    setTitle(value) { title = value; }, setMode(value) { mode = value; }, captures: () => captures };
}

test("offline export defaults to Mongolian and only disables Export while rendering", async () => {
  const app = fixture();
  assert.equal(app.controller.language, "mn");
  assert.equal(app.$("exportWav").textContent, "WAV гаргах");
  assert.match(app.$("exportHint").textContent, /44\.1 кГц.*16 бит/);
  assert.equal(app.$("exportDownload").hidden, true);
  const pending = app.$("exportWav").click();
  assert.equal(app.controller.busy, true);
  assert.equal(app.$("exportWav").disabled, true);
  assert.equal(app.$("exportWav").getAttribute("aria-busy"), "true");
  assert.equal(app.captures(), 1);
  assert.equal(app.requests.length, 1);
  for (const id of ["projectSave", "projectOpen", "playButton", "recordButton"]) {
    assert.equal(app.$(id).disabled, false);
    assert.equal(app.$(id).clicks, 0, "Export neither plays nor operates REC");
  }
  const output = result();
  app.requests[0].resolve(output);
  assert.deepEqual(await pending, [true]);
  assert.equal(app.controller.busy, false);
  assert.equal(app.$("exportWav").disabled, false);
  assert.equal(app.$("exportWav").getAttribute("aria-busy"), "false");
  assert.equal(app.created[0].blob.type, "audio/wav");
  assert.deepEqual(new Uint8Array(await app.created[0].blob.arrayBuffer()), output.bytes);
  assert.equal(app.$("exportDownload").download, "Миний аялгуу.wav");
  assert.equal(app.$("exportDownload").href, app.created[0].url);
  assert.equal(app.$("exportDownload").hidden, false);
  assert.equal(app.$("exportDownload").clicks, 1);
  assert.match(app.$("exportStatus").textContent, /Миний аялгуу\.wav.*4\.13 сек.*44\.1 кГц.*16 бит PCM/);
});

test("the title, mode and latest editable inputs are captured before asynchronous rendering", async () => {
  const app = fixture();
  app.controller.renderLanguage("en");
  app.setMode("ensemble");
  app.setTitle("Гитарын найруулга");
  app.contents.ensemble.tracks[0].abc = "[CEG]4 |]";
  const pending = app.controller.exportWav();
  assert.equal(app.requests[0].captured.mode, "ensemble");
  assert.equal(app.requests[0].captured.content.tracks[0].abc, "[CEG]4 |]");
  app.contents.ensemble.tracks[0].abc = "z4 |]";
  app.setMode("solo"); app.setTitle("New title");
  assert.equal(await app.controller.exportWav(), false, "A busy click neither captures nor renders again");
  assert.equal(app.captures(), 1);
  app.requests[0].resolve(result());
  assert.equal(await pending, true);
  assert.equal(app.$("exportDownload").download, "Гитарын найруулга.wav");
  assert.match(app.$("exportStatus").textContent, /Гитарын найруулга\.wav/);
  assert.doesNotMatch(app.$("exportStatus").textContent, /New title/);
  assert.equal(app.contents.ensemble.tracks[0].abc, "z4 |]", "Export does not restore or alter current edits");
});

test("language changes preserve a pending filename and localize busy and result text", async () => {
  const app = fixture();
  app.setMode("ensemble");
  const pending = app.controller.exportWav();
  assert.match(app.$("exportStatus").textContent, /Миний найруулга\.wav/);
  app.controller.renderLanguage("en");
  assert.equal(app.$("exportWav").textContent, "Rendering WAV…");
  assert.match(app.$("exportStatus").textContent, /Rendering.*Миний найруулга\.wav/);
  app.requests[0].resolve(result({ duration: 20 }));
  await pending;
  assert.match(app.$("exportStatus").textContent, /20 s/);
  assert.match(app.$("exportDownload").textContent, /Download prepared WAV: Миний найруулга\.wav/);
  app.controller.renderLanguage("mn");
  assert.match(app.$("exportStatus").textContent, /20 сек/);
  assert.equal(app.$("exportDownload").download, "Миний найруулга.wav");
});

test("whole-mix attenuation is disclosed only when gain is reduced, never as a boost", async () => {
  const app = fixture(); app.controller.renderLanguage("en");
  let pending = app.controller.exportWav();
  app.requests[0].resolve(result({ peak: 1.96, gain: .5 }));
  await pending;
  assert.match(app.$("exportStatus").textContent, /Whole mix reduced by 6\.0 dB to prevent clipping/);
  pending = app.controller.exportWav();
  app.requests[1].resolve(result({ gain: .9999, peak: .9801 }));
  await pending;
  assert.match(app.$("exportStatus").textContent, /reduced by <0\.1 dB/);
  pending = app.controller.exportWav();
  app.requests[2].resolve(result({ gain: 1, peak: .01 }));
  await pending;
  assert.doesNotMatch(app.$("exportStatus").textContent, /reduced|boost|normaliz/i);
});

test("a fully silent result remains downloadable and is described without an error", async () => {
  const app = fixture(); app.controller.renderLanguage("en");
  const pending = app.controller.exportWav();
  app.requests[0].resolve(result({ peak: 0 }));
  assert.equal(await pending, true);
  assert.match(app.$("exportStatus").textContent, /file is silent.*mute\/solo/);
  assert.equal(app.$("exportStatus").classList.contains("error"), false);
  assert.equal(app.$("exportDownload").clicks, 1);
});

test("prepared file links survive errors and are replaced only by another successful export", async () => {
  const app = fixture(); app.controller.renderLanguage("en");
  app.setTitle("First file");
  let pending = app.controller.exportWav(); app.requests[0].resolve(result()); await pending;
  const first = app.$("exportDownload").href;
  app.setTitle("Failed file");
  pending = app.controller.exportWav(); app.requests[1].reject(Object.assign(new Error("invalid ABC"), { code: "invalid" }));
  assert.equal(await pending, false);
  assert.equal(app.$("exportDownload").href, first);
  assert.equal(app.$("exportDownload").download, "First file.wav");
  assert.match(app.$("exportStatus").textContent, /Failed file\.wav.*Check the ABC.*unchanged/);
  assert.deepEqual(app.revoked, []);
  app.setTitle("Second file");
  pending = app.controller.exportWav(); app.requests[2].resolve(result()); await pending;
  assert.deepEqual(app.revoked, [first]);
  assert.equal(app.$("exportDownload").download, "Second file.wav");
  assert.equal(app.$("exportDownload").clicks, 2);
  await app.$("exportDownload").click();
  assert.equal(app.requests.length, 3, "Repeating the prepared download does not rerender");
});

test("renderer errors and unsupported download APIs have local MN/EN explanations", async () => {
  for (const [code, english] of [
    ["unsupported", /does not support offline/], ["invalid", /including muted ones/],
    ["limit", /export limits/], ["render", /rendering failed/], ["unknown", /rendering failed/]
  ]) {
    const app = fixture();
    const pending = app.controller.exportWav();
    app.requests[0].reject(Object.assign(new Error("Untrusted diagnostic <script>"), { code }));
    assert.equal(await pending, false);
    assert.equal(app.$("exportStatus").classList.contains("error"), true);
    assert.match(app.$("exportStatus").textContent, /өөрчлөгдөөгүй/);
    app.controller.renderLanguage("en");
    assert.match(app.$("exportStatus").textContent, english);
    assert.doesNotMatch(app.$("exportStatus").textContent, /Untrusted diagnostic|<script>/);
    assert.equal(app.controller.busy, false);
    assert.equal(app.$("exportWav").disabled, false);
    assert.equal(app.created.length, 0);
  }
  const app = fixture(); app.controller.urlAPI = null;
  assert.equal(await app.controller.exportWav(), false);
  assert.equal(app.requests.length, 0);
  app.controller.renderLanguage("en");
  assert.match(app.$("exportStatus").textContent, /does not support offline/);
});

test("synchronous capture/render failures and invalid snapshots unlock Export without downloads", async () => {
  const app = fixture();
  app.controller.capture = () => { throw new Error("Missing editor"); };
  assert.equal(await app.controller.exportWav(), false);
  assert.equal(app.controller.busy, false);
  assert.equal(app.requests.length, 0);
  app.controller.capture = () => ({ mode: "unsupported", content: {} });
  assert.equal(await app.controller.exportWav(), false);
  assert.equal(app.controller.status.code, "invalid");
  app.controller.capture = () => ({ mode: "solo", content: {} });
  app.controller.render = () => { throw Object.assign(new Error("No offline audio"), { code: "unsupported" }); };
  assert.equal(await app.controller.exportWav(), false);
  assert.equal(app.controller.status.code, "unsupported");
  assert.equal(app.$("exportWav").disabled, false);
  assert.equal(app.created.length, 0);
});

test("invalidation suppresses the pending result without overlapping renders and remains reusable", async () => {
  const app = fixture(); app.controller.renderLanguage("en");
  const pending = app.controller.exportWav();
  app.controller.invalidate();
  assert.match(app.$("exportStatus").textContent, /pending export will not download/);
  assert.equal(app.controller.busy, true, "Native computation is not advertised as instantly cancelled");
  assert.equal(await app.controller.exportWav(), false);
  assert.equal(app.requests.length, 1);
  app.requests[0].resolve(result());
  assert.equal(await pending, false);
  assert.equal(app.created.length, 0);
  assert.equal(app.$("exportDownload").clicks, 0);
  assert.equal(app.controller.busy, false);
  const retry = app.controller.exportWav();
  app.requests[1].resolve(result());
  assert.equal(await retry, true);
  assert.equal(app.$("exportDownload").clicks, 1);
});

test("an invalidated rejection does not report an error or replace an earlier prepared file", async () => {
  const app = fixture();
  let pending = app.controller.exportWav(); app.requests[0].resolve(result()); await pending;
  const first = app.$("exportDownload").href;
  pending = app.controller.exportWav(); app.controller.invalidate();
  app.requests[1].reject(new Error("Late failure"));
  assert.equal(await pending, false);
  assert.equal(app.controller.status.key, "interrupted");
  assert.equal(app.$("exportStatus").classList.contains("error"), false);
  assert.equal(app.$("exportDownload").href, first);
  assert.deepEqual(app.revoked, []);
  app.controller.invalidate();
  assert.equal(app.$("exportDownload").href, first);
});

test("dispose prevents late downloads, revokes the prepared URL and removes the click listener", async () => {
  const app = fixture();
  let pending = app.controller.exportWav(); app.requests[0].resolve(result()); await pending;
  pending = app.controller.exportWav();
  app.controller.dispose(); app.controller.dispose();
  app.requests[1].resolve(result());
  assert.equal(await pending, false);
  assert.deepEqual(app.revoked, [app.created[0].url]);
  assert.equal(app.created.length, 1);
  assert.equal(app.$("exportDownload").hidden, true);
  assert.equal(app.$("exportDownload").href, "");
  assert.equal(app.$("exportWav").disabled, true);
  assert.equal(app.controller.busy, false);
  await app.$("exportWav").click();
  assert.equal(app.requests.length, 2);
  assert.equal(await app.controller.exportWav(), false);
});

test("automatic download failure retains the visible prepared-file link", async () => {
  const app = fixture(); app.controller.renderLanguage("en");
  app.$("exportDownload").click = () => { throw new Error("Download blocked"); };
  const pending = app.controller.exportWav();
  app.requests[0].resolve(result());
  assert.equal(await pending, true);
  assert.equal(app.$("exportDownload").hidden, false);
  assert.match(app.$("exportDownload").textContent, /My melody\.wav/);
  assert.match(app.$("exportStatus").textContent, /if the download did not start/);
  assert.equal(app.$("exportStatus").classList.contains("error"), false);
});

test("invalid result metadata is not offered as a file or described as boosted audio", async () => {
  for (const output of [
    result({ bytes: new Uint8Array(44) }), result({ duration: NaN }), result({ duration: 0 }),
    result({ sampleRate: Infinity }), result({ peak: -1 }), result({ gain: 1.1 }), result({ gain: 0 })
  ]) {
    const app = fixture();
    const pending = app.controller.exportWav(); app.requests[0].resolve(output);
    assert.equal(await pending, false);
    assert.equal(app.created.length, 0);
    assert.equal(app.controller.status.code, "render");
  }
});

test("Blob preparation preserves a typed-array slice and URL failures keep the earlier file", async () => {
  const app = fixture();
  const backing = new Uint8Array(80).fill(7), bytes = backing.subarray(12, 60);
  let pending = app.controller.exportWav(); app.requests[0].resolve(result({ bytes })); await pending;
  assert.deepEqual(new Uint8Array(await app.created[0].blob.arrayBuffer()), bytes);
  const first = app.$("exportDownload").href;
  app.urlAPI.createObjectURL = () => { throw new Error("No file URL available"); };
  pending = app.controller.exportWav(); app.requests[1].resolve(result());
  assert.equal(await pending, false);
  assert.equal(app.$("exportDownload").href, first);
  assert.deepEqual(app.revoked, []);
});

test("WAV filenames preserve Unicode but remove path, reserved-name and direction-control hazards", () => {
  assert.equal(exportUI.filename("Миний найруулга"), "Миний найруулга.wav");
  assert.equal(exportUI.filename("Melody.WAV"), "Melody.wav");
  assert.equal(exportUI.filename("  Melody.wav  "), "Melody.wav");
  assert.equal(exportUI.filename("Melody.soundlab.json"), "Melody.wav");
  assert.equal(exportUI.filename("CON"), "sound-lab-CON.wav");
  assert.equal(exportUI.filename("...   "), "sound-lab.wav");
  assert.equal(exportUI.filename(null), "sound-lab.wav");
  assert.doesNotMatch(exportUI.filename("../Folder\\<x>:*?\u202E.wav"), /[/\\<>:*?\u202e]/);
  const long = exportUI.filename("🎸".repeat(120));
  assert.ok(Buffer.byteLength(long) <= 184);
  assert.match(long, /^(?:🎸)+\.wav$/u);
  assert.equal(exportUI.filename("a\ud800b"), "a-b.wav");
});

test("title text is never inserted as HTML and the captured safe filename stays visible", async () => {
  const app = fixture();
  app.setTitle("<img src=x onerror=alert(1)>");
  const pending = app.controller.exportWav();
  app.requests[0].resolve(result()); await pending;
  const name = exportUI.filename("<img src=x onerror=alert(1)>");
  assert.equal(app.$("exportDownload").download, name);
  assert.ok(app.$("exportStatus").textContent.includes(name));
  assert.ok(app.$("exportDownload").textContent.includes(name));
  assert.equal(app.$("exportDownload").getAttribute("aria-label"), app.$("exportDownload").textContent);
});
