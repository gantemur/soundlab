/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const examples = require("./sound-analysis-examples.js");

const expected = Object.freeze({
  "nature-rain": "725dd653790ab6f74264525652068d7225dfcdf4a27703d1b380b1f9991a239b",
  "nature-stream": "5fe2f03ef9ec397649891910da34c29aff901551e6cbbd0be0ca3a7b7434c4cf",
  "nature-drips": "22651acfc3dc1df12bf235c24d0a14a3a2d8a3f27f9bc99355fb61f4525aae80",
  "wildlife-bird": "47f3da762cfe1a75813c96795d6d4ef88d067da29315f37906aa6ba61963c76c",
  "wildlife-cricket": "9418e24c7908a0fbafe4cdeba54d7da95454eb53464164bd5cd69957a447896c",
  "object-wood": "cbcd861a183187156e134100984e23fa20b6df7b36db95e13110d10027815100",
  "object-metal": "e5206b1438b70f597d0de771c2ecd8ab1c2bb9d876d55be078c2385ff9f32de9",
  "object-latch": "2552b3172f02fd5387e326ea951aec3eeebdc0f0c17c1e372d933b620fbf6ad2",
  "footsteps-wood": "3c5875745469f875797a3a4f124fc95349085710d59a8035119721b562b48ea5",
  "footsteps-gravel": "75303676890c2794885c190d3fabba30c7aec475677666b0687d624ea1db606b",
  "mechanical-clock": "9008ff35bb8d788f3c5f598028cb035edfd946170d4183ffac989a3f450d7516"
});
const recorded = examples.CATALOGUE.filter(item => item.kind === "recorded");

test("A2b recording catalogue has exactly 11 locally bundled, credited and bilingual samples", () => {
  assert.equal(examples.CATALOGUE.length, 18);
  assert.equal(recorded.length, 11);
  assert.deepEqual(Object.keys(expected), recorded.map(item => item.id));
  assert.deepEqual(recorded.map(item => item.classId), [
    "nature", "nature", "nature", "wildlife", "wildlife",
    "objects", "objects", "objects", "footsteps", "footsteps", "mechanical"
  ]);
  let total = 0;
  for (const entry of recorded) {
    assert.equal(entry.path, `assets/analysis/${entry.id}.wav`);
    assert.ok(entry.credit.creator && entry.credit.sourceUrl.startsWith("https://"));
    assert.match(entry.credit.license, /^CC0 1\.0$|^CC BY [34]\.0$/);
    assert.ok(entry.credit.licenseUrl.startsWith("https://creativecommons.org/"));
    assert.ok(entry.title.mn && entry.title.en && entry.description.mn && entry.description.en);
    const file = path.join(__dirname, entry.path);
    const audio = fs.readFileSync(file);
    const sha = crypto.createHash("sha256").update(audio).digest("hex");
    assert.equal(sha, expected[entry.id], `unexpected bytes for ${entry.id}`);
    total += audio.length;
  }
  assert.ok(total < 12 * 1024 * 1024, "all recording assets fit the planned 12 MiB budget");
  assert.match(fs.readFileSync(path.join(__dirname, "assets/analysis/SOURCES.md"), "utf8"),
    /ESC-10 by Karol J\. Piczak/);
});

test("A2b each selected real WAV passes Sound Lab's existing bounded PCM decoder", async () => {
  for (const entry of recorded) {
    let requests = 0, progress = 0;
    const pcm = await examples.create(entry.id, {
      loadRecording: async url => {
        assert.equal(url, entry.path);
        requests++;
        return fs.readFileSync(path.join(__dirname, url));
      },
      onProgress: value => { progress = value; },
      yieldTask: async () => {}
    });
    assert.equal(requests, 1, "select one asset, do not eagerly load the catalogue");
    assert.equal(pcm.kind, "recorded"); assert.equal(pcm.exampleId, entry.id);
    assert.equal(pcm.sampleRate, 22050); assert.equal(pcm.channels.length, 1);
    assert.equal(pcm.encoding, "PCM16"); assert.ok(Math.abs(pcm.duration - entry.duration) < .002);
    assert.ok(pcm.peak > .02 && pcm.peak < 1, `the ${entry.id} example is audible and not clipped`);
    assert.equal(progress, 1);
  }
});

test("A2b cancelled or failed recorded selections cannot silently synthesize substitutes", async () => {
  const sample = recorded[0];
  await assert.rejects(examples.create(sample.id, {
    isCancelled: () => true,
    loadRecording: () => { throw new Error("must not download after cancel"); }
  }), error => error?.code === "cancelled");
  await assert.rejects(examples.create(sample.id, {
    loadRecording: async () => { throw new Error("offline"); }
  }), /offline/);
  await assert.rejects(examples.create("recorded-nonexistent"), error => error?.code === "invalid");
});
