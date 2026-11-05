/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * Compose C2: independent melodic and percussion tracks, one shared audio clock.
 */
(function (root, factory) {
  const abc = typeof module === "object" && module.exports ? require("./sound-abc.js") : root.SoundLabABC;
  const score = typeof module === "object" && module.exports ? require("./sound-score.js") : root.SoundLabScore;
  const player = typeof module === "object" && module.exports ? require("./sound-score-player.js") : root.SoundLabScorePlayer;
  const presets = typeof module === "object" && module.exports ?
    require("./sound-ensemble-presets.js") : root.SoundLabEnsemblePresets;
  const drums = typeof module === "object" && module.exports ?
    require("./sound-drum-abc.js") : root.SoundLabDrumABC;
  const api = factory(abc, score, player, presets, drums);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabEnsemble = api;
})(typeof window !== "undefined" ? window : null, function (abc, scoreModel, playerModel, presets, drums) {
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
      presets: "Arrangement examples", loadPreset: "Load", presetHint: "Load replaces the current arrangement. You can edit every instrument's ABC afterward.",
      add: "+ Add melody", addDrums: "+ Add drums", drums: "Drums", play: "▶ Play ensemble", pause: "Ⅱ Pause", resume: "▶ Resume", stop: "■ Stop",
      ready: "Ready. Choose a track or press Play.", playing: "Playing all active tracks.",
      starting: "Starting instruments…", paused: "Paused. Press Resume to continue.",
      stopped: "Stopped. Play starts from the beginning.",
      track: "Track", name: "Name", choose: "Edit", remove: "Remove", mute: "Mute", unmute: "Unmute",
      solo: "Solo", unsolo: "Unsolo", volume: "Volume", instrument: "Instrument",
      score: "ABC for the selected track", import: "Open .abc / .txt", timeline: "Shared timeline",
      inspect: "Notes in each track; the gold line marks the current beat.",
      help: "Edit one track at a time; the other tracks remain in place. Different keys are allowed, but every track needs the same M: and Q:.",
      limits: "Up to 4 tracks, 1,024 note/drum events combined and 90 seconds. Multi-voice ABC import is not yet supported.",
      drumHelp: "Drum ABC: C bass drum · D snare · E closed hat · F open hat · G woodblock. [CE] means simultaneous hits; !p! and !accent! change individual hits. Use the grid below or edit the text directly.",
      grid: "Drum grid · optional editor", gridHint: "A cell toggles a hit in the selected bar. Select Soft, Normal or Accent to set its strength. Text and grid share the same rhythm.",
      gridBar: "Bar", gridStep: "Spacing", gridStrength: "Hit strength", gridSoft: "Soft", gridNormal: "Normal", gridAccent: "Accent",
      gridEighth: "Eighths", gridSixteenth: "Sixteenths", gridFine: "Sixteenth notes present; showing all 16th steps.",
      gridError: "Grid unavailable for this text; the ABC has not been changed: ",
      now: "Beat", selected: "Selected", maxTracks: "Four tracks is the current maximum.",
      minTracks: "Keep at least one track.", fileError: "Choose a .abc / .txt score up to 8 KB.",
      error: "Score error", trackError: "Track", noAudio: "Sound could not start. Check audio settings." },
    mn: { heading: "Олон хөгжим тоглуулах", intro: "Хөгжим тус бүр өөрийн ABC ноттой. Бүгд нэг хэмнэл, хурдтай зэрэг тоглоно.",
      tuning: "Хөг", equal: "Тэнцүү (12-TET)", pythagorean: "Пифагорын", just: "Цэвэр · До төвтэй",
      presets: "Бэлэн найруулга", loadPreset: "Нээх", presetHint: "Нээхэд одоогийн нотууд солигдоно. Хөгжим тус бүрийн ABC-г өөрчилж болно.",
      add: "+ Аялгуу нэмэх", addDrums: "+ Бөмбөр нэмэх", drums: "Бөмбөр", play: "▶ Тоглуулах", pause: "Ⅱ Түр зогсоох", resume: "▶ Үргэлжлүүлэх", stop: "■ Зогсоох",
      ready: "Бэлэн. Хөгжим сонгох эсвэл тоглуулаарай.", playing: "Сонгосон хөгжмүүд зэрэг тоглож байна.",
      starting: "Хөгжмүүдийг бэлдэж байна…", paused: "Түр зогслоо. Үргэлжлүүлж болно.",
      stopped: "Зогслоо. Дахин тоглуулахад эхнээсээ эхэлнэ.",
      track: "Хөгжим", name: "Нэр", choose: "Засах", remove: "Хасах", mute: "Дуугүй", unmute: "Дуутай",
      solo: "Ганцаар", unsolo: "Хамт", volume: "Чанга", instrument: "Зэмсэг",
      score: "Сонгосон хөгжмийн ABC нот", import: ".abc / .txt файл нээх", timeline: "Нэгдсэн цагийн шугам",
      inspect: "Мөр бүрийн нотууд; шар зураас нь тоглож буй цохилт.",
      help: "Нэг хөгжмийн нотыг засахад бусдынх хэвээр байна. Хөг өөр байж болно, харин M: хэмжээ ба Q: хурд ижил байх ёстой.",
      limits: "4 хүртэл мөр, нийт 1024 нот/цохилт, 90 секунд. Олон хоолойтой ABC-г дараа нэмж болно.",
      drumHelp: "Бөмбөрийн ABC: C их бөмбөр · D жижиг бөмбөр · E хаалттай цан · F нээлттэй цан · G модон цохилуур. [CE] нь зэрэг цохилт; !p!, !accent! нь цохилт тус бүрийн хүч. Доорх тороор эсвэл шууд бичиж болно.",
      grid: "Бөмбөрийн тор · хүсвэл нээх", gridHint: "Сонгосон тактын нүдийг дарж цохилт нэмнэ/хасна. Зөөлөн, энгийн, хүчтэй гэсэн түвшин сонгож болно. ABC бичиг ба тор нэг хэмнэлтэй.",
      gridBar: "Такт", gridStep: "Алхам", gridStrength: "Цохилтын хүч", gridSoft: "Зөөлөн", gridNormal: "Энгийн", gridAccent: "Хүчтэй",
      gridEighth: "Наймт", gridSixteenth: "Арван зургаат", gridFine: "Арван зургаатын цохилт байна; бүх алхмыг харуулж байна.",
      gridError: "Энэ бичигт тор нээх боломжгүй. ABC-г өөрчлөөгүй: ",
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
    const prepared = tracks.map(track => ({ ...track,
      score: track.instrument === "drums" ? drums.parse(track.abc) : abc.parse(track.abc) }));
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
      this.gridBar = 1;
      this.player = new playerModel.EnsemblePlayer({ contextOwner, transientModel, sustainModel,
        temperamentModel, onUpdate: update => this.onProgress(update) });
      this.$("ensembleTuning").value = "equal";
      this.$("ensembleGridStep").value = "16";
      this.$("ensembleGridStrength").value = "normal";
      this.$("ensembleText").value = this.tracks[0].abc;
      this.$("ensembleText").addEventListener("input", () => {
        this.selected().abc = this.$("ensembleText").value;
        this.player.stop();
        if (this.parseTimer !== null) clearTimeout(this.parseTimer);
        this.parseTimer = setTimeout(() => { this.parseTimer = null; this.parse(); }, 180);
      });
      this.$("ensembleTuning").addEventListener("change", () => this.parse());
      this.$("ensembleApplyPreset").addEventListener("click", () => this.loadPreset());
      this.$("ensembleAdd").addEventListener("click", () => this.addTrack());
      this.$("ensembleAddDrums").addEventListener("click", () => this.addDrums());
      this.$("ensembleGridBar").addEventListener("change", () => {
        this.gridBar = Number(this.$("ensembleGridBar").value); this.renderDrumGrid();
      });
      this.$("ensembleGridStep").addEventListener("change", () => this.renderDrumGrid());
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
    loadPreset() {
      const choice = this.$("ensemblePreset").value;
      if (choice !== "starter" && !presets.CATALOG.some(item => item.id === choice)) return;
      this.resetTimer();
      this.player.stop();
      this.tracks = choice === "starter" ? DEFAULTS.map(track => ({ ...track })) :
        presets.create(choice, this.language);
      this.selectedId = this.tracks[0].id;
      this.nextId = Math.max(...this.tracks.map(track => track.id)) + 1;
      this.$("ensembleText").value = this.selected().abc;
      this.gridBar = 1;
      this.parse();
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
      this.renderDrumGrid();
    }
    addTrack() {
      if (this.tracks.length >= playerModel.MAX_PARTS) {
        this.setStatus(this.t("maxTracks"), true); return;
      }
      const source = this.tracks.find(track => track.instrument !== "drums");
      const id = this.nextId++;
      const instrument = ["violin", "piano", "guitar", "fmep"][this.tracks.length - 1] || "flute";
      const fallback = this.summary;
      const meter = fallback?.meter;
      const measureCount = meter ? fallback.totalBeats / meter.quarterBeats : 0;
      const drumsOnlyBars = !source && this.selected().instrument === "drums" ?
        drums.parse(this.selected().abc).bars.map(bar => bar.durationBeats) : null;
      const emptyBars = drumsOnlyBars || (Number.isInteger(measureCount) ?
        Array.from({ length: measureCount }, () => meter.quarterBeats) : null);
      const emptyMelody = meter && emptyBars ?
        ["X:" + id, "T:Melody", "M:" + meter.numerator + "/" + meter.denominator, "L:1/16",
          "Q:1/4=" + fallback.tempoQuarter, "K:C", ...emptyBars.map((length, i) =>
            "z" + (length * 4) + (i === emptyBars.length - 1 ? " |]" : " |"))].join("\n") : DEFAULTS[0].abc;
      const next = { ...(source || DEFAULTS[0]), id, name: this.t("track") + " " + id, instrument,
        volume: 38, mute: false, solo: false, abc: source ? source.abc.replace(/^X:.*$/m, "X:" + id) : emptyMelody };
      this.tracks.push(next);
      this.selectTrack(id);
      this.parse();
    }
    addDrums() {
      if (this.tracks.length >= playerModel.MAX_PARTS) { this.setStatus(this.t("maxTracks"), true); return; }
      if (!this.summary) { this.setStatus(this.t("error") + ": correct the existing score first", true); return; }
      const id = this.nextId;
      let text;
      try {
        const length = this.summary.totalBeats;
        const longestTrack = this.tracks.map(track => track.instrument === "drums" ? drums.parse(track.abc) : abc.parse(track.abc))
          .find(score => Math.abs(score.totalBeats - length) < 1e-7);
        text = drums.groove({ ...this.summary, barDurations: longestTrack?.bars.map(bar => bar.durationBeats) },
          id, this.t("drums"));
      }
      catch (error) { this.setStatus(this.t("error") + ": " + error.message, true); return; }
      this.nextId++;
      this.tracks.push({ id, name: this.t("drums"), instrument: "drums", volume: 65,
        mute: false, solo: false, abc: text });
      this.gridBar = 1;
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
      this.gridBar = 1;
      this.$("ensembleText").value = this.selected().abc;
      this.renderTracks();
      this.renderEditorLabel();
      this.renderDrumGrid();
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
        if (track.instrument === "drums") {
          this.make("span", "ensemble-drum-kind", "♩ " + this.t("drums"), row);
        } else {
          const instrument = this.make("select", "ensemble-instrument", undefined, row);
          instrument.setAttribute("aria-label", this.t("instrument") + " " + track.id);
          for (const key of playerModel.INSTRUMENTS) {
            const option = this.make("option", "", VOICES[this.language][key], instrument);
            option.value = key;
          }
          instrument.value = track.instrument;
          instrument.addEventListener("change", () => { track.instrument = instrument.value; this.parse(); });
        }
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
      this.$("ensembleAddDrums").disabled = this.tracks.length >= playerModel.MAX_PARTS;
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
          const isDrum = track.instrument === "drums";
          const parsed = isDrum ? drums.parse(track.abc) : abc.parse(track.abc);
          const events = isDrum ? drums.scheduledEvents(parsed) : playerModel.scheduledEvents(parsed);
          for (const event of events) {
            const note = this.make("span", isDrum ? "ensemble-note ensemble-drum-hit" : "ensemble-note", undefined, lane);
            note.style.left = (100 * event.startBeat / max) + "%";
            note.style.width = isDrum ? ".8%" : Math.max(.45, 100 * event.durationBeats / max) + "%";
            note.title = (isDrum ? (drums.DRUMS.find(d => d.id === event.drum)?.[this.language] || event.drum) :
              scoreModel.pitchName(event.pitch)) + " · " + event.startBeat;
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
    renderDrumGrid() {
      const panel = this.$("ensembleDrumGrid");
      const isDrum = this.selected()?.instrument === "drums";
      panel.hidden = !isDrum;
      this.$("ensembleDrumHint").hidden = !isDrum;
      if (!isDrum) return;
      const container = this.$("ensembleGridCells");
      const info = this.$("ensembleGridMessage");
      container.replaceChildren();
      info.textContent = "";
      let bars;
      try { bars = drums.gridOf(drums.parse(this.selected().abc)); }
      catch (error) { info.textContent = this.t("gridError") + error.message; return; }
      const barSelect = this.$("ensembleGridBar");
      barSelect.replaceChildren();
      if (!bars.some(bar => bar.number === this.gridBar)) this.gridBar = 1;
      for (const bar of bars) {
        const option = this.make("option", "", String(bar.number), barSelect);
        option.value = String(bar.number);
      }
      barSelect.value = String(this.gridBar);
      const cells = bars[this.gridBar - 1].cells;
      const stepSelect = this.$("ensembleGridStep");
      let skip = stepSelect.value === "8" ? 2 : 1;
      if (skip === 2 && (cells.length % 2 || cells.some((cell, i) => i % 2 && Object.keys(cell).length))) {
        skip = 1; stepSelect.value = "16"; info.textContent = this.t("gridFine");
      }
      for (const drum of drums.DRUMS) {
        const row = this.make("div", "ensemble-drum-row", undefined, container);
        this.make("span", "ensemble-drum-label", drum[this.language], row);
        const lane = this.make("div", "ensemble-drum-cells", undefined, row);
        lane.style.gridTemplateColumns = "repeat(" + Math.ceil(cells.length / skip) + ", minmax(30px, 1fr))";
        for (let i = 0; i < cells.length; i += skip) {
          const value = cells[i][drum.id];
          const label = drum[this.language] + ", " + this.t("gridBar") + " " + this.gridBar +
            ", " + this.t("gridStep") + " " + (i + 1);
          const button = this.make("button", "ensemble-drum-cell" + (value ?
            " on " + (value === drums.VELOCITIES.accent ? "accent" :
              value === drums.VELOCITIES.p ? "soft" : "normal") : "") +
            (i % 4 === 0 ? " quarter" : ""), value ? "●" : "·", lane);
          button.type = "button";
          button.setAttribute("aria-label", label);
          button.setAttribute("aria-pressed", String(Boolean(value)));
          button.title = label + (value ? " (" + value + ")" : "");
          button.addEventListener("click", () => {
            try {
              const velocity = drums.VELOCITIES[this.$("ensembleGridStrength").value];
              const next = drums.toggleGridHit(drums.parse(this.selected().abc), this.gridBar, i, drum.id, velocity);
              this.selected().abc = next;
              this.$("ensembleText").value = next;
              this.player.stop(); this.parse();
            } catch (error) { info.textContent = this.t("gridError") + error.message; }
          });
        }
      }
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
      const presetList = this.$("ensemblePreset");
      for (const piece of presets.CATALOG) {
        const option = Array.from(presetList.options || []).find(option => option.value === piece.id);
        if (option) option.textContent = piece[language];
      }
      this.renderTracks();
      this.renderTransport();
      this.updatePlayhead(this.player.currentBeat);
      this.renderDrumGrid();
    }
  }

  return Object.freeze({ VOICES, TEXT, DEFAULTS, parseTracks, Controller });
});
