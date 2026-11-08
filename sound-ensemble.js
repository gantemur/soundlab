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
  const drumPatterns = typeof module === "object" && module.exports ?
    require("./sound-drum-patterns.js") : root.SoundLabDrumPatterns;
  const api = factory(abc, score, player, presets, drums, drumPatterns);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabEnsemble = api;
})(typeof window !== "undefined" ? window : null, function (abc, scoreModel, playerModel, presets, drums, drumPatterns) {
  "use strict";
  const VOICES = Object.freeze({
    en: { flute: "Flute", clarinet: "Clarinet", violin: "Violin", morin: "Morin khuur", guitar: "Guitar",
      piano: "Acoustic piano", mandolin: "Mandolin", harp: "Harp", chimes: "Chimes", marimba: "Marimba", xylophone: "Xylophone",
      "organ-stopped": "Organ · Stopped Flute 8′", "organ-principal": "Organ · Principal 8′", accordion: "Accordion · Musette", bayan: "Bayan · Dry",
      sine: "Sine wave", triangle: "Triangle wave",
      square: "Square wave", sawtooth: "Sawtooth wave", fmep: "Electric piano" },
    mn: { flute: "Лимбэ", clarinet: "Кларнет", violin: "Хийл", morin: "Морин хуур", guitar: "Гитар",
      piano: "Төгөлдөр хуур", mandolin: "Мандолин", harp: "Ятга (арфа)", chimes: "Хонх", marimba: "Маримба", xylophone: "Ксилофон",
      "organ-stopped": "Орган · Битүү лимбэ 8′", "organ-principal": "Орган · Принципал 8′", accordion: "Аккордеон · Мюзет", bayan: "Баян хуур · Цэвэр хөг",
      sine: "Синус", triangle: "Гурвалжин",
      square: "Дөрвөлжин", sawtooth: "Хөрөө", fmep: "Цахилгаан хуур" }
  });
  const TEXT = Object.freeze({
    en: { heading: "Play several instruments", intro: "Tracks share one beat. Selecting a track edits it; Play sounds all unmuted tracks. Use Solo to hear just one.",
      tuning: "Tuning", equal: "Equal (12-TET)", pythagorean: "Pythagorean", just: "Just · C-centred",
      presets: "Arrangement examples", loadPreset: "Load", presetHint: "Load replaces the current arrangement. You can edit every instrument's ABC afterward.",
      presetStudies: "Writing exercises", presetDrumSolo: "Drum-only compositions", presetClassics: "Classical music",
      presetWestern: "European folk songs", presetRussian: "Russian folk and historical songs",
      presetPopular: "Historical popular songs",
      add: "+ Add melody", addDrums: "+ Add drums", drums: "Drums", play: "▶ Play ensemble", pause: "Ⅱ Pause", resume: "▶ Resume", stop: "■ Stop",
       ready: "Ready. Select a track to edit, or press Play.", playing: "Playing all active tracks.",
      starting: "Starting instruments…", paused: "Paused. Press Resume to continue.",
      stopped: "Stopped. Play starts from the beginning.",
       track: "Track", name: "Name", choose: "Edit", editHint: "Select to edit, not to solo. Use Solo to hear only this track.",
       remove: "Remove", mute: "Mute", unmute: "Unmute",
      solo: "Solo", unsolo: "Unsolo", volume: "Volume", instrument: "Instrument",
      drumFeel: "Rhythmic feel", feelStraight: "Straight", feelLight: "Light swing (58:42)",
      feelSwing: "Swing (2:1)", feelHint: "Drum attacks move within each quarter beat; ABC and linked patterns stay unchanged. Half-open and closed hi-hats progressively damp ringing open hats.",
      drumTouch: "Stroke dynamics", touchEven: "As written", touchExpressive: "Subtle natural accents",
      touchHint: "Optional, repeatable ~4–9% variation on regular strokes; written ghosts and accents stay exact. No random timing changes.",
      guitarTechnique: "Guitar technique", guitarPluck: "Pluck together",
      guitarDown: "↓ Downstroke", guitarUp: "↑ Upstroke", guitarAlternate: "↓↑ Alternating strokes",
      guitarSpacing: "Between notes", milliseconds: "ms",
      guitarHint: "Chords such as [C,E,G,CE] are strummed; single notes stay individually picked. Downstrokes go low to high, upstrokes in reverse. Short chords use a shorter sweep.",
      score: "ABC for the selected track", import: "Open .abc / .txt", timeline: "Shared timeline",
      inspect: "Notes in each track; the gold line marks the current beat.",
      help: "Edit one track at a time; the other tracks remain in place. Different keys are allowed, but every track needs the same M: and Q:.",
      limits: "Up to 4 tracks, with no fixed score-length or event-count cutoff. Playback and export support complete pieces; multi-voice ABC syntax is not yet supported.",
      drumHelp: "Drum ABC: C–G original kit; A floor tom, B mid tom, c high tom, d ride, e crash, f rimshot, g half-open hi-hat. [CE] plays simultaneous hits. !ghost!, !p!, !accent! change strength and timbre; !flam! adds a soft grace hit, !roll! plays four strokes. !R!/!L! mark the playing hand (flam = main hand, roll = first hand). (3 begins a triplet; edit off-grid triplets in text. A later half-open hat progressively dampens an open tail; a closed hat chokes both.",
      grid: "Drum grid · optional editor", gridHint: "A cell toggles a hit. Set strength, technique and optional R/L hand; the same markings appear in ABC. In flams the other hand plays the grace hit; in rolls hands alternate.",
      gridBar: "Bar", gridStep: "Spacing", gridStrength: "Hit strength", gridGhost: "Ghost", gridSoft: "Soft", gridNormal: "Normal", gridAccent: "Accent",
      gridArticulation: "Technique", gridPlain: "Single", gridFlam: "Flam", gridRoll: "4 strokes",
      gridHand: "Hand", gridHandAuto: "Unmarked", gridHandRight: "Right (R)", gridHandLeft: "Left (L)",
      gridEighth: "Eighths", gridSixteenth: "Sixteenths", gridFine: "Sixteenth notes present; showing all 16th steps.",
      gridError: "Grid unavailable for this text; the ABC has not been changed: ",
      patternsTitle: "Rhythm patterns", patternsEnable: "Find repeats", patternsIntro: "Choose a song bar, then a pattern to assign it there (longer patterns fill following bars). Changes to notes or T: names apply immediately.",
      patternsBar: "Song bar", patternsChoice: "Pattern", patternsUnique: "New pattern", patternsRepeat: "Repeat to end",
      patternsAdvanced: "Other arrangement actions", patternsLength: "Bars", patternsGroup: "New pattern here",
      patternsFrom: "From", patternsTo: "Through", patternsRange: "Fill range",
      patternsView: "ABC view", patternsPatternABC: "Selected pattern ABC", patternsFullABC: "Whole song ABC",
      patternsRevert: "Restore last valid pattern",
      patternsInactive: "This is a full ABC score. Find repeats to create linked patterns without changing the score.",
      patternsTextHint: "Editing whole-song ABC removes pattern links. You can find repeats again afterward.",
      patternsTextError: "Correct the pattern ABC before changing patterns: ",
      patternsNotGrid: "This ABC uses rhythms outside the sixteenth-note grid; it stays editable as text.",
      now: "Beat", selected: "Selected", maxTracks: "Four tracks is the current maximum.",
      minTracks: "Keep at least one track.", fileError: "Choose a .abc / .txt score up to 1 MiB.",
      error: "Score error", trackError: "Track", noAudio: "Sound could not start. Check audio settings." },
    mn: { heading: "Олон хөгжим тоглуулах", intro: "Бүгд нэг хэмнэлтэй. Хөгжим сонговол нотыг нь засна; тоглуулахад дуугүй болгоогүй бүгд дуугарна. «Ганцаар» нэгийг сонсгоно.",
      tuning: "Хөг", equal: "Тэнцүү (12-TET)", pythagorean: "Пифагорын", just: "Цэвэр · До төвтэй",
      presets: "Бэлэн найруулга", loadPreset: "Нээх", presetHint: "Нээхэд одоогийн нотууд солигдоно. Хөгжим тус бүрийн ABC-г өөрчилж болно.",
      presetStudies: "Нот бичих дасгал", presetDrumSolo: "Бөмбөрийн гоцлол", presetClassics: "Сонгодог хөгжим",
      presetWestern: "Европ ардын дуунууд", presetRussian: "Орос ардын болон түүхэн дуунууд",
      presetPopular: "Хуучны нийтийн дуунууд",
      add: "+ Аялгуу нэмэх", addDrums: "+ Бөмбөр нэмэх", drums: "Бөмбөр", play: "▶ Тоглуулах", pause: "Ⅱ Түр зогсоох", resume: "▶ Үргэлжлүүлэх", stop: "■ Зогсоох",
       ready: "Бэлэн. Засах хөгжмөө сонгох эсвэл тоглуулаарай.", playing: "Идэвхтэй хөгжмүүд зэрэг тоглож байна.",
      starting: "Хөгжмүүдийг бэлдэж байна…", paused: "Түр зогслоо. Үргэлжлүүлж болно.",
      stopped: "Зогслоо. Дахин тоглуулахад эхнээсээ эхэлнэ.",
       track: "Хөгжим", name: "Нэр", choose: "Засах", editHint: "Засах хөгжмөө сонгоно. Дангаар сонсох бол «Ганцаар».",
       remove: "Хасах", mute: "Дуугүй", unmute: "Дуутай",
      solo: "Ганцаар", unsolo: "Хамт", volume: "Чанга", instrument: "Зэмсэг",
      drumFeel: "Хэмнэлийн мэдрэмж", feelStraight: "Тэгш", feelLight: "Зөөлөн свинг (58:42)",
      feelSwing: "Свинг (2:1)", feelHint: "Бөмбөрийн завсрын цохилтын хугацаа өөрчлөгдөнө; ABC ба холбоотой загвар хэвээр. Хагас нээх, хаахад өмнө дуугарсан цан аажмаар эсвэл хурдан намдана.",
      drumTouch: "Цохилтын хүчний хэм", touchEven: "Бичсэнээр нь", touchExpressive: "Зөөлөн өргөлттэй",
      touchHint: "Энгийн цохилтын хүчийг ойролцоогоор 4–9%-иар жигд бус болгож өгнө; бичсэн маш сул ба хүчтэй цохилт өөрчлөгдөхгүй. Хугацаанд санамсаргүй хэлбэлзэл байхгүй.",
      guitarTechnique: "Гитар тоглох арга", guitarPluck: "Зэрэг татах",
      guitarDown: "↓ Доош цохих", guitarUp: "↑ Дээш цохих", guitarAlternate: "↓↑ Ээлжлэн цохих",
      guitarSpacing: "Нот хоорондын зай", milliseconds: "мсек",
      guitarHint: "[C,E,G,CE] зэрэг аккордыг цохино; дан нот тусдаа татагдана. Доош цохиход нам нотоос өндөр рүү, дээш цохиход эсрэг чиглэлээр дуугарна. Богино аккордын зай автоматаар багасна.",
      score: "Сонгосон хөгжмийн ABC нот", import: ".abc / .txt файл нээх", timeline: "Нэгдсэн цагийн шугам",
      inspect: "Мөр бүрийн нотууд; шар зураас нь тоглож буй цохилт.",
      help: "Нэг хөгжмийн нотыг засахад бусдынх хэвээр байна. Хөг өөр байж болно, харин M: хэмжээ ба Q: хурд ижил байх ёстой.",
      limits: "4 хүртэл мөртэй бүтэн зохиол тоглуулж, гаргаж болно; нот, цохилтын тоо болон 90 секундын хязгаар байхгүй. Олон хоолойтой ABC бичлэгийг хараахан дэмжихгүй.",
      drumHelp: "Бөмбөрийн ABC: C–G үндсэн тав, A суурь том, B дунд том, c өндөр том, d райд, e крэш, f хүрээтэй цохилт, g хагас нээлттэй цан. [CE] зэрэг цохилт. !ghost!, !p!, !accent! нь хүч ба дууны өнгийг; !flam! нь урьтал сул цохилт, !roll! нь 4 цохилтыг заана. !R!/!L! нь баруун/зүүн гарыг заана (фламд гол гар, роллд эхний гар). (3 нь триоль эхлүүлнэ. Хагас нээлттэй цан өмнөх нээлттэй цанг аажим, хаалттай цан хоёуланг нь хурдан дарна.",
      grid: "Бөмбөрийн тор · хүсвэл нээх", gridHint: "Нүдээр цохилт нэмэхдээ хүч, арга болон R/L гарыг сонгоно. Фламын урьтал цохилтыг нөгөө гар, роллын цохилтуудыг хоёр гар ээлжлэн тоглоно.",
      gridBar: "Такт", gridStep: "Алхам", gridStrength: "Цохилтын хүч", gridGhost: "Маш зөөлөн", gridSoft: "Зөөлөн", gridNormal: "Энгийн", gridAccent: "Хүчтэй",
      gridArticulation: "Цохих арга", gridPlain: "Дан", gridFlam: "Флам", gridRoll: "4 цохилт",
      gridHand: "Гар", gridHandAuto: "Заагаагүй", gridHandRight: "Баруун (R)", gridHandLeft: "Зүүн (L)",
      gridEighth: "Наймт", gridSixteenth: "Арван зургаат", gridFine: "Арван зургаатын цохилт байна; бүх алхмыг харуулж байна.",
      gridError: "Энэ бичигт тор нээх боломжгүй. ABC-г өөрчлөөгүй: ",
      patternsTitle: "Хэмнэлийн загвар", patternsEnable: "Давталт таних", patternsIntro: "Дууны тактаа сонгоод Загвар сонговол тэнд онооно (олон такттай загвар дараагийн тактуудыг хамарна). Нот, T: нэрний өөрчлөлт шууд хэрэгжинэ.",
      patternsBar: "Дууны такт", patternsChoice: "Загвар", patternsUnique: "Шинэ загвар", patternsRepeat: "Дуустал давтах",
      patternsAdvanced: "Бусад байрлуулах үйлдэл", patternsLength: "Такт", patternsGroup: "Эндээс шинэ загвар",
      patternsFrom: "Эхлэх", patternsTo: "Дуусах", patternsRange: "Хэсэгт давтах",
      patternsView: "ABC харагдац", patternsPatternABC: "Загварын ABC", patternsFullABC: "Бүтэн ABC",
      patternsRevert: "Сүүлийн зөв загварыг сэргээх",
      patternsInactive: "Энэ нь бүтэн ABC нот. Давталт таньж, загваруудыг холбоотой болгохдоо нотуудыг өөрчлөхгүй.",
      patternsTextHint: "Бүтэн ABC-г засвал загварын холбоос сална. Дараа нь давталтыг дахин таньж болно.",
      patternsTextError: "Өөр загварт шилжихээс өмнө ABC алдааг засна уу: ",
      patternsNotGrid: "ABC-д арван зургаатын торонд багтахгүй хэмнэл байна. Эх бичиг хэвээр үлдэнэ.",
      now: "Цохилт", selected: "Сонгосон", maxTracks: "Одоогоор дээд тал нь дөрвөн хөгжим.",
      minTracks: "Ядаж нэг хөгжмийг үлдээнэ.", fileError: "1 МиБ-аас бага .abc эсвэл .txt файл сонгоно уу.",
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
      // Preset track names follow the interface language until the owner edits
      // them. This is UI-only provenance; saved projects keep literal names.
      this.presetNames = new Map();
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
      this.$("ensembleGridArticulation").value = "plain";
      this.$("ensembleGridHand").value = "auto";
      this.$("ensembleText").value = this.tracks[0].abc;
      this.$("ensembleText").addEventListener("input", () => this.textInput());
      this.$("ensembleTuning").addEventListener("change", () => this.parse());
      this.$("ensembleApplyPreset").addEventListener("click", () => this.loadPreset());
      this.$("ensembleAdd").addEventListener("click", () => this.addTrack());
      this.$("ensembleAddDrums").addEventListener("click", () => this.addDrums());
      this.$("ensembleGridBar").addEventListener("change", () => {
        this.gridBar = Number(this.$("ensembleGridBar").value); this.renderDrumGrid();
      });
      this.$("ensembleGridStep").addEventListener("change", () => this.renderDrumGrid());
      this.$("ensemblePatternEnable").addEventListener("click", () => this.activatePatterns());
      this.$("ensemblePatternBar").addEventListener("change", () => this.chooseSongBar(Number(this.$("ensemblePatternBar").value)));
      this.$("ensemblePatternChoice").addEventListener("change", () => {
        const track = this.selected();
        if (track.patternDraft) return this.renderPatternPanel();
        const id = Number(this.$("ensemblePatternChoice").value);
        this.applyPatternOperation(() => ({
          project: drumPatterns.assignAtBar(track.patterns, id, track.patternBar),
          patternId: id, startBar: track.patternBar
        }));
      });
      this.$("ensemblePatternUnique").addEventListener("click", () => this.applyPatternOperation(() =>
        drumPatterns.makeUnique(this.selected().patterns, this.selected().patternBar)));
      this.$("ensemblePatternRepeat").addEventListener("click", () => this.applyPatternOperation(() => ({
        project: drumPatterns.replaceRange(this.selected().patterns, this.selected().patternId,
          this.selected().patternBar, this.selected().patterns.sequence.length),
        patternId: this.selected().patternId, startBar: this.selected().patternBar })));
      this.$("ensemblePatternGroup").addEventListener("click", () => this.applyPatternOperation(() =>
        drumPatterns.groupBars(this.selected().patterns, this.selected().patternBar,
          Number(this.$("ensemblePatternLength").value))));
      this.$("ensemblePatternRange").addEventListener("click", () => this.applyPatternOperation(() => ({
        project: drumPatterns.replaceRange(this.selected().patterns, this.selected().patternId,
          Number(this.$("ensemblePatternFrom").value), Number(this.$("ensemblePatternTo").value)),
        patternId: this.selected().patternId, startBar: Number(this.$("ensemblePatternFrom").value) })));
      this.$("ensemblePatternTextMode").addEventListener("change", () => {
        const track = this.selected();
        if (track.patternDraft) { this.$("ensemblePatternTextMode").value = track.textMode; return; }
        track.textMode = this.$("ensemblePatternTextMode").value;
        this.gridBar = 1; this.setEditorText(); this.renderPatternPanel(); this.renderDrumGrid();
      });
      this.$("ensemblePatternRevert").addEventListener("click", () => {
        const track = this.selected();
        if (!track.patternDraft) return;
        track.patternDraft = null;
        this.setEditorText(); this.parse();
      });
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
    captureProject() {
      // textInput updates the track/draft immediately, ahead of parse's debounce.
      // The codec makes the independent, explicit-field copy at the file boundary.
      return { tuning: this.$("ensembleTuning").value, tracks: this.tracks,
        selectedId: this.selectedId, nextId: this.nextId,
        editor: { gridBar: this.gridBar, gridStep: Number(this.$("ensembleGridStep").value),
          gridStrength: this.$("ensembleGridStrength").value,
          gridArticulation: this.$("ensembleGridArticulation").value,
          gridHand: this.$("ensembleGridHand").value } };
    }
    isProjectDraft() {
      if (this.tracks.some(track => track.patternDraft)) return true;
      try {
        parseTracks(this.tracks, this.$("ensembleTuning").value, this.temperamentModel);
        return false;
      } catch (_) { return true; }
    }
    restoreProject(content) {
      // Only normalized, independent project data reaches this method.
      this.resetTimer();
      this.player.stop();
      this.tracks = content.tracks;
      this.presetNames.clear(); // A saved project's names belong to its author.
      this.selectedId = content.selectedId;
      this.nextId = content.nextId;
      this.gridBar = content.editor.gridBar;
      this.$("ensembleTuning").value = content.tuning;
      this.$("ensembleGridStep").value = String(content.editor.gridStep);
      this.$("ensembleGridStrength").value = content.editor.gridStrength;
      this.$("ensembleGridArticulation").value = content.editor.gridArticulation || "plain";
      this.$("ensembleGridHand").value = content.editor.gridHand || "auto";
      this.setEditorText();
      this.parse();
    }
    textInput() {
      const track = this.selected(), text = this.$("ensembleText").value;
      if (track.instrument === "drums" && track.patterns && track.textMode === "pattern") {
        try {
          const previousName = drumPatterns.getPattern(track.patterns, track.patternId).name;
          const next = drumPatterns.updatePatternABC(track.patterns, track.patternId, text);
          track.abc = drumPatterns.toABC(next);
          track.patterns = next;
          track.patternDraft = null;
          if (drumPatterns.getPattern(next, track.patternId).name !== previousName) {
            this.renderEditorLabel(); this.renderPatternPanel();
          }
        } catch (error) {
          track.patternDraft = { id: track.patternId, text, error: error.message };
          this.$("ensemblePlayPause").disabled = true;
        }
      } else {
        // A raw score may be edited freely. Links are only removed on an actual edit.
        track.abc = text;
        track.patterns = null;
        track.patternDraft = null;
        track.textMode = "full";
      }
      this.player.stop(); this.resetTimer();
      this.parseTimer = setTimeout(() => { this.parseTimer = null; this.parse(); }, 180);
    }
    setEditorText() {
      const track = this.selected();
      this.$("ensembleText").value = track.instrument === "drums" && track.patterns && track.textMode === "pattern" ?
        (track.patternDraft?.text ?? drumPatterns.patternABC(track.patterns, track.patternId)) : track.abc;
      this.renderEditorLabel();
    }
    activatePatterns() {
      const track = this.selected();
      if (track.instrument !== "drums") return;
      try {
        track.patterns = drumPatterns.fromABC(track.abc);
        track.patternBar = 1;
        track.patternId = drumPatterns.atBar(track.patterns, 1).pattern.id;
        track.textMode = "pattern";
        track.patternDraft = null;
        this.gridBar = 1;
        this.setEditorText(); this.renderPatternPanel(); this.renderDrumGrid();
      } catch (error) {
        this.$("ensemblePatternMessage").textContent = this.t("patternsNotGrid") + " (" + error.message + ")";
      }
    }
    chooseSongBar(bar) {
      const track = this.selected();
      if (!track.patterns || track.patternDraft) return this.renderPatternPanel();
      try {
        const found = drumPatterns.atBar(track.patterns, bar);
        track.patternBar = bar;
        track.patternId = found.pattern.id;
        this.gridBar = found.offset + 1;
        this.setEditorText(); this.renderPatternPanel(); this.renderDrumGrid();
      } catch (error) { this.$("ensemblePatternMessage").textContent = error.message; }
    }
    applyPatternOperation(action) {
      const track = this.selected();
      if (!track.patterns || track.patternDraft) {
        this.$("ensemblePatternMessage").textContent = this.t("patternsTextError") +
          (track.patternDraft?.error || ""); return;
      }
      try {
        const { project, patternId, startBar } = action();
        track.patterns = project; track.abc = drumPatterns.toABC(project);
        track.patternId = patternId;
        track.patternBar = startBar;
        this.gridBar = 1;
        this.player.stop(); this.setEditorText(); this.parse();
      } catch (error) {
        this.renderPatternPanel(); // Restore the choice if assignment is rejected.
        this.$("ensemblePatternMessage").textContent = error.message;
      }
    }
    loadPreset() {
      const choice = this.$("ensemblePreset").value;
      if (choice !== "starter" && !presets.CATALOG.some(item => item.id === choice)) return;
      this.resetTimer();
      this.player.stop();
      this.tracks = choice === "starter" ? DEFAULTS.map(track => ({ ...track })) :
        presets.create(choice, this.language);
      this.presetNames.clear();
      if (choice !== "starter") {
        // Resolve the opposite labels once on load. Regenerating name metadata
        // never replaces any subsequently edited score, pattern or track.
        const otherLanguage = this.language === "mn" ? "en" : "mn";
        const otherNames = new Map(presets.create(choice, otherLanguage).map(track => [track.id, track.name]));
        for (const track of this.tracks) {
          this.presetNames.set(track.id, { [this.language]: track.name,
            [otherLanguage]: otherNames.get(track.id) ?? track.name });
        }
      }
      this.selectedId = this.tracks[0].id;
      this.nextId = Math.max(...this.tracks.map(track => track.id)) + 1;
      this.setEditorText();
      this.gridBar = 1;
      this.parse();
    }
    parse({ updateTracks = true } = {}) {
      this.resetTimer();
      try {
        const incomplete = this.tracks.find(track => track.patternDraft);
        if (incomplete) throw new Error(this.t("patternsTextError") + incomplete.patternDraft.error);
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
      if (updateTracks) this.renderTracks();
      this.renderTimeline();
      this.renderTransport();
      this.renderPatternPanel();
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
      if (next.guitar) next.guitar = { ...next.guitar };
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
      const project = drumPatterns.fromABC(text);
      this.tracks.push({ id, name: this.t("drums"), instrument: "drums", volume: 65,
        mute: false, solo: false, abc: text, patterns: project, textMode: "pattern",
        patternBar: 1, patternId: drumPatterns.atBar(project, 1).pattern.id });
      this.gridBar = 1;
      this.selectTrack(id);
      this.parse();
    }
    removeTrack(id) {
      if (this.tracks.length <= 1) { this.setStatus(this.t("minTracks"), true); return; }
      this.tracks = this.tracks.filter(track => track.id !== id);
      this.presetNames.delete(id);
      if (this.selectedId === id) this.selectedId = this.tracks[0].id;
      this.setEditorText();
      this.parse();
    }
    selectTrack(id) {
      if (!this.tracks.some(track => track.id === id)) return;
      this.resetTimer();
      this.selectedId = id;
      this.gridBar = 1;
      this.setEditorText();
      this.renderTracks();
      this.renderEditorLabel();
      this.renderPatternPanel();
      this.renderDrumGrid();
    }
    renderEditorLabel() {
      const track = this.selected();
      const title = track.patterns && track.textMode === "pattern" ?
        this.t("patternsPatternABC") + " · " + drumPatterns.getPattern(track.patterns, track.patternId).name : this.t("score");
      this.$("ensembleEditorTitle").textContent = title + " · " + track.name;
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
        select.title = this.t("editHint");
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
          const next = name.value.trim().slice(0, 40) || this.t("track") + " " + track.id;
          if (next !== track.name) this.presetNames.delete(track.id);
          track.name = next;
          this.renderTracks(); this.renderTimeline(); this.renderEditorLabel();
        });
        if (track.instrument === "drums") {
          this.make("span", "ensemble-drum-kind", "♩ " + this.t("drums"), row);
          this.renderDrumFeelControls(track, row);
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
        if (track.instrument === "guitar") this.renderGuitarControls(track, row);
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
    renderDrumFeelControls(track, row) {
      const controls = this.make("div", "ensemble-feel", undefined, row);
      const label = this.make("label", "field-title", this.t("drumFeel"), controls);
      const select = this.make("select", "ensemble-drum-feel", undefined, controls);
      select.id = "ensembleDrumFeel-" + track.id;
      label.htmlFor = select.id;
      select.setAttribute("aria-label", this.t("drumFeel") + " · " + track.name);
      for (const [value, caption] of [["straight", "feelStraight"], ["light", "feelLight"], ["swing", "feelSwing"]]) {
        this.make("option", "", this.t(caption), select).value = value;
      }
      select.value = track.drumFeel || "straight";
      select.addEventListener("change", () => {
        track.drumFeel = select.value;
        this.parse({ updateTracks: false });
      });
      const touchLabel = this.make("label", "field-title", this.t("drumTouch"), controls);
      const touch = this.make("select", "ensemble-drum-touch", undefined, controls);
      touch.id = "ensembleDrumTouch-" + track.id;
      touchLabel.htmlFor = touch.id;
      touch.setAttribute("aria-label", this.t("drumTouch") + " · " + track.name);
      for (const [value, key] of [["even", "touchEven"], ["expressive", "touchExpressive"]]) {
        this.make("option", "", this.t(key), touch).value = value;
      }
      touch.value = track.drumTouch || "even";
      touch.addEventListener("change", () => {
        track.drumTouch = touch.value;
        this.parse({ updateTracks: false });
      });
      if (track.id === this.selectedId) this.make("p", "field-help", this.t("feelHint"), controls);
      if (track.id === this.selectedId) this.make("p", "field-help", this.t("touchHint"), controls);
    }
    renderGuitarControls(track, row) {
      const settings = { mode: "pluck", spacingMs: 20, ...track.guitar };
      const controls = this.make("div", "guitar-technique", undefined, row);
      const label = this.make("label", "field-title", this.t("guitarTechnique"), controls);
      const mode = this.make("select", "ensemble-guitar-mode", undefined, controls);
      mode.id = "ensembleGuitarMode-" + track.id;
      label.htmlFor = mode.id;
      mode.setAttribute("aria-label", this.t("guitarTechnique") + " · " + track.name);
      for (const [value, key] of [["pluck", "guitarPluck"], ["down", "guitarDown"],
        ["up", "guitarUp"], ["alternate", "guitarAlternate"]]) {
        this.make("option", "", this.t(key), mode).value = value;
      }
      mode.value = settings.mode;
      mode.addEventListener("change", () => {
        settings.mode = mode.value;
        track.guitar = { ...settings };
        group.hidden = settings.mode === "pluck";
        this.parse({ updateTracks: false });
      });
      const group = this.make("div", "guitar-spacing", undefined, controls);
      group.hidden = settings.mode === "pluck";
      const title = this.make("div", "field-title", undefined, group);
      const spacingLabel = this.make("label", "", this.t("guitarSpacing"), title);
      const readout = this.make("output", "", settings.spacingMs + " " + this.t("milliseconds"), title);
      const spacing = this.make("input", "ensemble-guitar-spacing", undefined, group);
      spacing.id = "ensembleGuitarSpacing-" + track.id;
      spacingLabel.htmlFor = spacing.id;
      readout.setAttribute("for", spacing.id);
      spacing.type = "range"; spacing.min = "0"; spacing.max = "60"; spacing.step = "1";
      spacing.value = String(settings.spacingMs);
      spacing.setAttribute("aria-label", this.t("guitarSpacing") + " · " + track.name);
      spacing.addEventListener("input", () => {
        track.guitar = { ...settings, spacingMs: Number(spacing.value) };
        settings.spacingMs = track.guitar.spacingMs;
        readout.textContent = spacing.value + " " + this.t("milliseconds");
        // Keep the focused control in place throughout pointer and key edits.
        this.parse({ updateTracks: false });
      });
      if (track.id === this.selectedId) this.make("p", "field-help", this.t("guitarHint"), controls);
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
          const events = isDrum ? drums.scheduledEvents(parsed, track.drumFeel, track.drumTouch) : playerModel.scheduledEvents(parsed, 0,
            track.instrument === "guitar" ? track.guitar : undefined);
          // Keep the overview responsive for long full scores: subsample only
          // visual ticks, never the actual playback or saved note events.
          const stride = Math.max(1, Math.ceil(events.length / 2500));
          for (let i = 0; i < events.length; i += stride) {
            const event = events[i];
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
    renderPatternPanel() {
      const track = this.selected(), panel = this.$("ensemblePatternPanel");
      panel.hidden = track.instrument !== "drums";
      if (panel.hidden) return;
      const active = Boolean(track.patterns);
      this.$("ensemblePatternEnable").hidden = active;
      this.$("ensemblePatternTools").hidden = !active;
      this.$("ensemblePatternHint").textContent = this.t(active ?
        track.textMode === "full" ? "patternsTextHint" : "patternsIntro" : "patternsInactive");
      const message = this.$("ensemblePatternMessage");
      message.textContent = track.patternDraft ? this.t("patternsTextError") + track.patternDraft.error : "";
      if (!active) return;
      const project = track.patterns;
      if (!Number.isInteger(track.patternBar) || track.patternBar > project.sequence.length) track.patternBar = 1;
      if (!project.patterns.some(pattern => pattern.id === track.patternId)) {
        track.patternId = drumPatterns.atBar(project, track.patternBar).pattern.id;
      }
      const fillSelect = (id, items, selectedValue) => {
        const el = this.$(id);
        el.replaceChildren();
        for (const item of items) {
          const option = this.make("option", "", item.label, el);
          option.value = String(item.value);
        }
        el.value = String(selectedValue);
      };
      const barItems = project.sequence.map((slot, i) => ({ value: i + 1,
        label: (i + 1) + " · " + drumPatterns.getPattern(project, slot.id).name }));
      fillSelect("ensemblePatternBar", barItems, track.patternBar);
      fillSelect("ensemblePatternChoice", project.patterns.map(p => ({ value: p.id,
        label: p.name })), track.patternId);
      const from = Number(this.$("ensemblePatternFrom").value);
      const to = Number(this.$("ensemblePatternTo").value);
      fillSelect("ensemblePatternFrom", barItems, Number.isInteger(from) && from >= 1 &&
        from <= project.sequence.length ? from : track.patternBar);
      fillSelect("ensemblePatternTo", barItems, Number.isInteger(to) && to >= 1 &&
        to <= project.sequence.length ? to : project.sequence.length);
      this.$("ensemblePatternTextMode").value = track.textMode || "full";
      this.$("ensemblePatternRevert").hidden = !track.patternDraft;
      const occurrence = drumPatterns.atBar(project, track.patternBar);
      this.$("ensemblePatternRepeat").disabled = occurrence.offset !== 0;
      this.$("ensemblePatternUnique").disabled = track.patternId !== occurrence.pattern.id;
      const arrangement = this.$("ensemblePatternArrangement");
      arrangement.replaceChildren();
      for (const run of drumPatterns.runs(project)) {
        const button = this.make("button", "ensemble-pattern-chip" +
          (track.patternBar >= run.startBar && track.patternBar <= run.endBar ? " selected" : ""),
          run.name + (run.repeats > 1 ? " ×" + run.repeats : ""), arrangement);
        button.type = "button";
        button.title = this.t("patternsBar") + " " + run.startBar + "–" + run.endBar;
        button.setAttribute("aria-label", run.name + " · " + button.title);
        button.setAttribute("aria-pressed", String(track.patternBar >= run.startBar && track.patternBar <= run.endBar));
        button.addEventListener("click", () => this.chooseSongBar(run.startBar));
      }
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
      const track = this.selected();
      if (track.patternDraft) { info.textContent = this.t("patternsTextError") + track.patternDraft.error; return; }
      const inPattern = Boolean(track.patterns && track.textMode === "pattern");
      try { bars = drums.gridOf(drums.parse(inPattern ?
        drumPatterns.patternABC(track.patterns, track.patternId) : track.abc)); }
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
          const velocity = typeof value === "number" ? value : value?.velocity;
          const articulation = typeof value === "number" ? "plain" : value?.articulation || "plain";
          const hand = typeof value === "number" ? "auto" : value?.hand || "auto";
          const label = drum[this.language] + ", " + this.t("gridBar") + " " + this.gridBar +
            ", " + this.t("gridStep") + " " + (i + 1) +
            (articulation === "plain" ? "" : ", " + this.t(articulation === "flam" ? "gridFlam" : "gridRoll")) +
            (hand === "auto" ? "" : ", " + this.t(hand === "R" ? "gridHandRight" : "gridHandLeft"));
          const symbol = articulation === "plain" ? "●" : articulation === "flam" ? "F" : "R";
          const button = this.make("button", "ensemble-drum-cell" + (value ?
            " on " + (velocity === drums.VELOCITIES.accent ? "accent" :
              velocity === drums.VELOCITIES.p ? "soft" :
                velocity === drums.VELOCITIES.ghost ? "ghost" : "normal") : "") +
            (articulation === "plain" ? "" : " " + articulation) +
            (hand === "auto" ? "" : " marked-hand") +
            (i % 4 === 0 ? " quarter" : ""), value ?
            (hand === "auto" ? symbol : articulation === "plain" ? hand : symbol + hand) : "·", lane);
          button.type = "button";
          button.setAttribute("aria-label", label);
          button.setAttribute("aria-pressed", String(Boolean(value)));
          button.title = label + (value ? " (" + velocity + ")" : "");
          button.addEventListener("click", () => {
            try {
              const velocity = drums.VELOCITIES[this.$("ensembleGridStrength").value];
              const technique = this.$("ensembleGridArticulation").value;
              const hand = this.$("ensembleGridHand").value;
              if (inPattern) {
                track.patterns = drumPatterns.toggleHit(track.patterns, track.patternId, this.gridBar, i,
                  drum.id, velocity, technique, hand);
                track.abc = drumPatterns.toABC(track.patterns);
              } else {
                track.abc = drums.toggleGridHit(drums.parse(track.abc), this.gridBar, i,
                  drum.id, velocity, technique, hand);
                // A raw-score edit has no live links. Re-extract patterns explicitly.
                track.patterns = null; track.textMode = "full";
              }
              this.setEditorText();
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
      if (!/\.(abc|txt)$/i.test(file.name) || file.size === 0 || file.size > abc.MAX_SOURCE_CHARACTERS) {
        this.setStatus(this.t("fileError"), true); return;
      }
      try {
        const data = await file.text();
        if (data.length > abc.MAX_SOURCE_CHARACTERS) throw new RangeError("Oversized ABC file");
        const track = this.selected();
        track.abc = data;
        track.patterns = null;
        track.patternDraft = null;
        track.textMode = "full";
        this.setEditorText();
        this.parse();
      } catch (_) { this.setStatus(this.t("fileError"), true); }
      finally { this.$("ensembleLoad").value = ""; }
    }
    renderLanguage(language) {
      if (!TEXT[language]) return;
      if (language !== this.language) {
        for (const track of this.tracks) {
          const presetName = this.presetNames.get(track.id);
          if (presetName && track.name === presetName[this.language]) track.name = presetName[language];
        }
      }
      this.language = language;
      this.document.querySelectorAll("[data-ensemble-i18n]").forEach(element => {
        element.textContent = this.t(element.getAttribute("data-ensemble-i18n"));
      });
      this.document.querySelectorAll("[data-ensemble-group-i18n]").forEach(element => {
        element.label = this.t(element.getAttribute("data-ensemble-group-i18n"));
      });
      const presetList = this.$("ensemblePreset");
      for (const piece of presets.CATALOG) {
        const option = Array.from(presetList.options || []).find(option => option.value === piece.id);
        if (option) option.textContent = piece[language];
      }
      this.renderTracks();
      this.renderTimeline();
      this.renderTransport();
      this.updatePlayhead(this.player.currentBeat);
      this.renderPatternPanel();
      this.renderDrumGrid();
    }
  }

  return Object.freeze({ VOICES, TEXT, DEFAULTS, parseTracks, Controller });
});
