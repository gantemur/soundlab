/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * Compose C2A: independent monophonic ABC tracks, one shared audio clock.
 */
(function (root, factory) {
  const abc = typeof module === "object" && module.exports ? require("./sound-abc.js") : root.SoundLabABC;
  const score = typeof module === "object" && module.exports ? require("./sound-score.js") : root.SoundLabScore;
  const player = typeof module === "object" && module.exports ? require("./sound-score-player.js") : root.SoundLabScorePlayer;
  const api = factory(abc, score, player);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabEnsemble = api;
})(typeof window !== "undefined" ? window : null, function (abc, scoreModel, playerModel) {
  "use strict";
  const VOICES = Object.freeze({
    en: { flute: "Flute", violin: "Violin", morin: "Morin khuur", guitar: "Guitar",
      piano: "Acoustic piano", chimes: "Chimes", sine: "Sine wave", triangle: "Triangle wave",
      square: "Square wave", sawtooth: "Sawtooth wave", fmep: "Electric piano" },
    mn: { flute: "Лимбэ", violin: "Хийл", morin: "Морин хуур", guitar: "Гитар",
      piano: "Төгөлдөр хуур", chimes: "Хонх", sine: "Синус", triangle: "Гурвалжин",
      square: "Дөрвөлжин", sawtooth: "Хөрөө", fmep: "Цахилгаан хуур" }
  });
  const TEXT = Object.freeze({
    en: { heading: "Play several instruments", intro: "Each track has its own ABC score and instrument; every part shares one beat and tempo.",
      tuning: "Tuning", equal: "Equal (12-TET)", pythagorean: "Pythagorean", just: "Just · C-centred",
      add: "+ Add track", play: "▶ Play ensemble", pause: "Ⅱ Pause", resume: "▶ Resume", stop: "■ Stop",
      ready: "Ready. Choose a track or press Play.", playing: "Playing all active tracks.",
      starting: "Starting instruments…", paused: "Paused. Press Resume to continue.",
      stopped: "Stopped. Play starts from the beginning.",
      track: "Track", name: "Name", choose: "Edit", remove: "Remove", mute: "Mute", unmute: "Unmute",
      solo: "Solo", unsolo: "Unsolo", volume: "Volume", instrument: "Instrument",
      score: "ABC for the selected track", import: "Open .abc / .txt", timeline: "Shared timeline",
      inspect: "Notes in each track; the gold line marks the current beat.",
      help: "Edit one track at a time; the other tracks remain in place. Different keys are allowed, but every track needs the same M: and Q:.",
      limits: "Up to 4 melodic tracks, 512 events combined and 90 seconds. Multi-voice ABC and drum patterns come in later steps.",
      now: "Beat", selected: "Selected", maxTracks: "Four tracks is the current maximum.",
      minTracks: "Keep at least one track.", fileError: "Choose a .abc / .txt score up to 8 KB.",
      error: "Score error", trackError: "Track", noAudio: "Sound could not start. Check audio settings." },
    mn: { heading: "Олон хөгжим тоглуулах", intro: "Хөгжим тус бүр өөрийн ABC ноттой. Бүгд нэг хэмнэл, хурдтай зэрэг тоглоно.",
      tuning: "Хөг", equal: "Тэнцүү (12-TET)", pythagorean: "Пифагорын", just: "Цэвэр · До төвтэй",
      add: "+ Хөгжим нэмэх", play: "▶ Тоглуулах", pause: "Ⅱ Түр зогсоох", resume: "▶ Үргэлжлүүлэх", stop: "■ Зогсоох",
      ready: "Бэлэн. Хөгжим сонгох эсвэл тоглуулаарай.", playing: "Сонгосон хөгжмүүд зэрэг тоглож байна.",
      starting: "Хөгжмүүдийг бэлдэж байна…", paused: "Түр зогслоо. Үргэлжлүүлж болно.",
      stopped: "Зогслоо. Дахин тоглуулахад эхнээсээ эхэлнэ.",
      track: "Хөгжим", name: "Нэр", choose: "Засах", remove: "Хасах", mute: "Дуугүй", unmute: "Дуутай",
      solo: "Ганцаар", unsolo: "Хамт", volume: "Чанга", instrument: "Зэмсэг",
      score: "Сонгосон хөгжмийн ABC нот", import: ".abc / .txt файл нээх", timeline: "Нэгдсэн цагийн шугам",
      inspect: "Мөр бүрийн нотууд; шар зураас нь тоглож буй цохилт.",
      help: "Нэг хөгжмийн нотыг засахад бусдынх хэвээр байна. Хөг өөр байж болно, харин M: хэмжээ ба Q: хурд ижил байх ёстой.",
      limits: "4 хүртэл зэмсэг, нийт 512 нот/завсарлага, 90 секунд. Олон хоолойтой ABC болон бөмбөрийн хэмнэлийг дараа нэмнэ.",
      now: "Цохилт", selected: "Сонгосон", maxTracks: "Одоогоор дээд тал нь дөрвөн хөгжим.",
      minTracks: "Ядаж нэг хөгжмийг үлдээнэ.", fileError: "8 КБ-аас бага .abc эсвэл .txt файл сонгоно уу.",
      error: "Нотын алдаа", trackError: "Хөгжим", noAudio: "Дуу эхэлсэнгүй. Хөтчийн аудио тохиргоог шалгана уу." }
  });
  const DEFAULTS = Object.freeze([
    { id: 1, name: "Melody", instrument: "flute", volume: 50, mute: false, solo: false,
      abc: "X:1\nT:Melody\nM:4/4\nL:1/4\nQ:1/4=96\nK:C\nC D E G | A2 G2 | E F G2 | C4 |]" },
    { id: 2, name: "Bass", instrument: "triangle", volume: 32, mute: false, solo: false,
      abc: "X:2\nT:Bass\nM:4/4\nL:1/4\nQ:1/4=96\nK:C\nC,2 G,2 | F,2 G,2 | C,2 G,2 | C,4 |]" }
  ]);

  function parseTracks(tracks, tuning, temperamentModel) {
    const prepared = tracks.map(track => ({ ...track, score: abc.parse(track.abc) }));
    const summary = playerModel.validateEnsemble(prepared, tuning, temperamentModel);
    return { prepared, summary };
  }

  class Controller {
    constructor({ document, contextOwner, transientModel, sustainModel, temperamentModel }) {
      this.document = document;
      this.$ = id => document.getElementById(id);
      this.temperamentModel = temperamentModel;
      this.language = "mn";
      this.tracks = DEFAULTS.map(track => ({ ...track }));
      this.selectedId = 1;
      this.nextId = 3;
      this.summary = null;
      this.error = null;
      this.status = "ready";
      this.playheadNodes = [];
      this.parseTimer = null;
      this.skipClickUntil = 0;
      this.player = new playerModel.EnsemblePlayer({ contextOwner, transientModel, sustainModel,
        temperamentModel, onUpdate: update => this.onProgress(update) });
      this.$("ensembleTuning").value = "equal";
      this.$("ensembleText").value = this.tracks[0].abc;
      this.$("ensembleText").addEventListener("input", () => {
        this.selected().abc = this.$("ensembleText").value;
        this.player.stop();
        if (this.parseTimer !== null) clearTimeout(this.parseTimer);
        this.parseTimer = setTimeout(() => { this.parseTimer = null; this.parse(); }, 180);
      });
      this.$("ensembleTuning").addEventListener("change", () => this.parse());
      this.$("ensembleAdd").addEventListener("click", () => this.addTrack());
      this.$("ensembleStop").addEventListener("click", () => this.stop());
      // On Safari, pointerdown often arrives before a delayed/suppressed click.
      // Pause immediately, and consume the corresponding click to avoid Resume.
      this.$("ensemblePlayPause").addEventListener("pointerdown", () => {
        if (["playing", "starting"].includes(this.player.status)) {
          this.skipClickUntil = Date.now() + 450;
          this.player.pause();
        }
      });
      this.$("ensemblePlayPause").addEventListener("click", () => {
        if (Date.now() >= this.skipClickUntil) return this.togglePlay();
      });
      this.$("ensembleLoad").addEventListener("change", event => this.loadFile(event.target.files?.[0]));
      this.parse();
      this.renderLanguage("mn");
    }

    t(key) { return TEXT[this.language][key]; }
    selected() { return this.tracks.find(track => track.id === this.selectedId); }
    make(tag, className, textContent, parent) {
      const node = this.document.createElement(tag);
      if (className) node.className = className;
      if (textContent !== undefined) node.textContent = textContent;
      if (parent) parent.appendChild(node);
      return node;
    }
    setStatus(keyOrMessage, error = false) {
      this.status = error ? "error" : keyOrMessage;
      this.$("ensembleStatus").textContent = error ? keyOrMessage : this.t(keyOrMessage);
      this.$("ensembleStatus").classList.toggle("error", error);
    }
    resetTimer() {
      if (this.parseTimer !== null) { clearTimeout(this.parseTimer); this.parseTimer = null; }
    }
    parse() {
      this.resetTimer();
      try {
        const { prepared, summary } = parseTracks(this.tracks, this.$("ensembleTuning").value, this.temperamentModel);
        this.player.configure({ tracks: prepared, tuning: this.$("ensembleTuning").value });
        this.summary = summary;
        this.error = null;
        this.$("ensemblePlayPause").disabled = false;
        this.setStatus("ready");
      } catch (error) {
        this.player.stop();
        this.summary = null;
        this.error = error;
        this.$("ensemblePlayPause").disabled = true;
        this.setStatus(this.t("error") + ": " + error.message, true);
      }
      this.renderTracks();
      this.renderTimeline();
      this.renderTransport();
    }
    addTrack() {
      if (this.tracks.length >= playerModel.MAX_PARTS) {
        this.setStatus(this.t("maxTracks"), true); return;
      }
      const source = this.selected();
      const id = this.nextId++;
      const instrument = ["violin", "piano", "guitar", "fmep"][this.tracks.length - 1] || "flute";
      const next = { ...source, id, name: this.t("track") + " " + id, instrument,
        volume: 38, mute: false, solo: false, abc: source.abc.replace(/^X:.*$/m, "X:" + id) };
      this.tracks.push(next);
      this.selectTrack(id);
      this.parse();
    }
    removeTrack(id) {
      if (this.tracks.length <= 1) { this.setStatus(this.t("minTracks"), true); return; }
      this.tracks = this.tracks.filter(track => track.id !== id);
      if (this.selectedId === id) this.selectedId = this.tracks[0].id;
      this.$("ensembleText").value = this.selected().abc;
      this.parse();
    }
    selectTrack(id) {
      if (!this.tracks.some(track => track.id === id)) return;
      this.resetTimer();
      this.selectedId = id;
      this.$("ensembleText").value = this.selected().abc;
      this.renderTracks();
      this.renderEditorLabel();
    }
    renderEditorLabel() {
      this.$("ensembleEditorTitle").textContent = this.t("score") + " · " + this.selected().name;
    }
    renderTracks() {
      const list = this.$("ensembleTrackList");
      list.replaceChildren();
      for (const track of this.tracks) {
        const row = this.make("div", "ensemble-track" + (track.id === this.selectedId ? " selected" : ""), undefined, list);
        const title = this.make("div", "ensemble-track-head", undefined, row);
        const select = this.make("button", "ensemble-select", (track.id === this.selectedId ? "✎ " : "") + track.name, title);
        select.type = "button";
        select.setAttribute("aria-pressed", String(track.id === this.selectedId));
        select.addEventListener("click", () => this.selectTrack(track.id));
        const remove = this.make("button", "ensemble-remove", "×", title);
        remove.type = "button";
        remove.title = this.t("remove");
        remove.setAttribute("aria-label", this.t("remove") + " " + track.name);
        remove.disabled = this.tracks.length === 1;
        remove.addEventListener("click", () => this.removeTrack(track.id));
        const name = this.make("input", "ensemble-name", undefined, row);
        name.type = "text";
        name.maxLength = 40;
        name.value = track.name;
        name.setAttribute("aria-label", this.t("name") + " " + track.id);
        name.addEventListener("change", () => {
          track.name = name.value.trim().slice(0, 40) || this.t("track") + " " + track.id;
          this.renderTracks(); this.renderTimeline(); this.renderEditorLabel();
        });
        const instrument = this.make("select", "ensemble-instrument", undefined, row);
        instrument.setAttribute("aria-label", this.t("instrument") + " " + track.id);
        for (const key of playerModel.INSTRUMENTS) {
          const option = this.make("option", "", VOICES[this.language][key], instrument);
          option.value = key;
        }
        instrument.value = track.instrument;
        instrument.addEventListener("change", () => { track.instrument = instrument.value; this.parse(); });
        const mixRow = this.make("div", "ensemble-mix-row", undefined, row);
        const mute = this.make("button", track.mute ? "ensemble-mix active" : "ensemble-mix", this.t(track.mute ? "unmute" : "mute"), mixRow);
        mute.type = "button";
        mute.setAttribute("aria-pressed", String(track.mute));
        mute.addEventListener("click", () => {
          track.mute = !track.mute;
          this.player.updateMix(track.id, { mute: track.mute });
          this.renderTracks();
        });
        const solo = this.make("button", track.solo ? "ensemble-mix active" : "ensemble-mix", this.t(track.solo ? "unsolo" : "solo"), mixRow);
        solo.type = "button";
        solo.setAttribute("aria-pressed", String(track.solo));
        solo.addEventListener("click", () => {
          track.solo = !track.solo;
          this.player.updateMix(track.id, { solo: track.solo });
          this.renderTracks();
        });
        const sliderLabel = this.make("label", "ensemble-volume-label", undefined, mixRow);
        const sliderText = this.make("span", "", this.t("volume") + " " + track.volume + "%", sliderLabel);
        const slider = this.make("input", "ensemble-volume", undefined, sliderLabel);
        slider.type = "range";
        slider.min = "0"; slider.max = "100"; slider.step = "1"; slider.value = String(track.volume);
        slider.setAttribute("aria-label", this.t("volume") + " " + track.name);
        slider.addEventListener("input", () => {
          track.volume = Number(slider.value);
          sliderText.textContent = this.t("volume") + " " + track.volume + "%";
          this.player.updateMix(track.id, { volume: track.volume });
        });
      }
      this.$("ensembleAdd").disabled = this.tracks.length >= playerModel.MAX_PARTS;
      this.renderEditorLabel();
    }
    renderTimeline() {
      const panel = this.$("ensembleTimeline");
      panel.replaceChildren();
      this.playheadNodes = [];
      const max = this.summary?.totalBeats || 1;
      for (const track of this.tracks) {
        const row = this.make("div", "ensemble-timeline-row", undefined, panel);
        const label = this.make("span", "ensemble-timeline-name", track.name, row);
        label.title = track.name;
        const lane = this.make("div", "ensemble-lane", undefined, row);
        const playhead = this.make("div", "ensemble-playhead", undefined, lane);
        this.playheadNodes.push(playhead);
        try {
          const parsed = abc.parse(track.abc);
          for (const event of playerModel.scheduledEvents(parsed)) {
            const note = this.make("span", "ensemble-note", undefined, lane);
            note.style.left = (100 * event.startBeat / max) + "%";
            note.style.width = Math.max(.45, 100 * event.durationBeats / max) + "%";
            note.title = scoreModel.pitchName(event.pitch) + " · " + event.startBeat;
          }
        } catch (_) { /* Invalid track shown by status, not on the timeline. */ }
      }
      this.updatePlayhead(this.player.currentBeat);
    }
    updatePlayhead(beat) {
      const fraction = Math.min(1, Math.max(0, beat / (this.summary?.totalBeats || 1)));
      this.playheadNodes.forEach(node => { node.style.left = 100 * fraction + "%"; });
      this.$("ensembleNow").textContent = this.t("now") + " " + beat.toFixed(1) +
        " / " + (this.summary?.totalBeats || 0);
    }
    renderTransport() {
      this.$("ensemblePlayPause").textContent = this.t(["playing", "starting"].includes(this.player.status) ? "pause" :
        this.player.status === "paused" ? "resume" : "play");
      this.$("ensembleStop").textContent = this.t("stop");
      if (this.error) return;
      this.$("ensembleStatus").textContent = this.t(this.status) || this.t("ready");
    }
    onProgress(update) {
      if (this.error) return;
      this.status = update.status === "stopped" && this.status === "ready" ? "ready" : update.status;
      this.renderTransport();
      this.updatePlayhead(update.beat);
    }
    async togglePlay() {
      if (["playing", "starting"].includes(this.player.status)) { this.player.pause(); return; }
      if (this.parseTimer !== null) this.parse();
      if (this.error || !this.summary) return;
      try { await this.player.play(); }
      catch (error) { this.setStatus(this.t("noAudio") + " (" + error.message + ")", true); }
    }
    stop() { this.player.stop(); }
    hasSession() { return this.player.status !== "stopped"; }
    isPlaying() { return ["playing", "starting"].includes(this.player.status); }
    async loadFile(file) {
      if (!file) return;
      if (!/\.(abc|txt)$/i.test(file.name) || file.size === 0 || file.size > 8192) {
        this.setStatus(this.t("fileError"), true); return;
      }
      try {
        const data = await file.text();
        if (data.length > 8192) throw new RangeError("Oversized ABC file");
        this.selected().abc = data;
        this.$("ensembleText").value = data;
        this.parse();
      } catch (_) { this.setStatus(this.t("fileError"), true); }
      finally { this.$("ensembleLoad").value = ""; }
    }
    renderLanguage(language) {
      if (!TEXT[language]) return;
      this.language = language;
      this.document.querySelectorAll("[data-ensemble-i18n]").forEach(element => {
        element.textContent = this.t(element.getAttribute("data-ensemble-i18n"));
      });
      this.renderTracks();
      this.renderTransport();
      this.updatePlayhead(this.player.currentBeat);
    }
  }

  return Object.freeze({ VOICES, TEXT, DEFAULTS, parseTracks, Controller });
});
