"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const model = require("./sound-model.js");
const transientModel = require("./sound-transient.js");
const sustainModel = require("./sound-sustain.js");
const heldVoiceModel = require("./sound-held-voice.js");
const marimbaModel = require("./sound-marimba.js");
const xylophoneModel = require("./sound-xylophone.js");
const mandolinModel = require("./sound-mandolin.js");
const harpModel = require("./sound-harp.js");
const i3HeldModel = require("./sound-i3-held.js");
const spectrumModel = require("./sound-spectrum.js");
const motionModel = require("./sound-motion.js");
const beatsModel = require("./sound-beats.js");
const intervalModel = require("./sound-intervals.js");
const earModel = require("./sound-ear-tune.js");
const scaleModel = require("./sound-scales.js");
const limit5Model = require("./sound-limit5.js");
const tempModel = require("./sound-temperaments.js");
const harmonicModel = require("./sound-harmonics.js");
const noiseModel = require("./sound-noise.js");
const recorderModel = require("./sound-recorder.js");
const composeModel = require("./sound-compose.js");
const ensembleModel = require("./sound-ensemble.js");
const ensemblePresets = require("./sound-ensemble-presets.js");
const drumABC = require("./sound-drum-abc.js");
const drumPatterns = require("./sound-drum-patterns.js");
const projectCodec = require("./sound-project.js");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "sound-lab.css"), "utf8");
const browserCode = fs.readFileSync(path.join(__dirname, "sound-lab.js"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);

test("every ensemble preset in the catalog is selectable in the published HTML", () => {
  const presetMenu = html.match(/<select id="ensemblePreset">([\s\S]*?)<\/select>/);
  assert.ok(presetMenu, "Missing ensemble preset selector");
  const options = [...presetMenu[1].matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)];
  const optionIds = options.map(match => match[1]);
  assert.deepEqual(new Set(optionIds), new Set(ensemblePresets.CATALOG.map(piece => piece.id)));
  assert.equal(optionIds.length, new Set(optionIds).size, "Duplicate ensemble preset options");
  for (const [, id, label] of options) {
    const preset = ensemblePresets.CATALOG.find(piece => piece.id === id);
    assert.equal(label, preset.mn, `Initial Mongolian label for ${id}`);
  }
});

test("the HTML has unique IDs and all scripted controls exist", () => {
  assert.equal(ids.length, new Set(ids).size);
  const usedIds = [...browserCode.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]);
  for (const id of usedIds) assert.ok(ids.includes(id), "Missing #" + id);
  for (const wave of model.WAVEFORMS) assert.match(html, new RegExp('data-wave="' + wave + '"'));
  assert.match(html, /id="stopAll"/);
  assert.match(html, /id="frequencyInput"[^>]*type="number"/);
  assert.match(html, /<html lang="mn">/);
  assert.match(html, /id="modeStrike"[^>]*>Цохих\/татах<\/button>/);
  assert.match(html, /id="modeSustain"[^>]*>Үлээх\/нумдах<\/button>/);
  assert.match(html, /id="fixedTimeCheck" checked/);
  assert.match(html, /src="sound-string\.js\?v=s062"/);
  assert.match(html, /src="sound-mandolin\.js\?v=s063"/);
  assert.match(html, /src="sound-piano\.js\?v=s019"/);
  assert.match(html, /src="sound-marimba\.js\?v=s059"/);
  assert.match(html, /src="sound-xylophone\.js\?v=s060"/);
  assert.match(html, /src="sound-harp\.js\?v=s066"/);
  assert.match(html, /src="sound-transient\.js\?v=s073"/);
  assert.match(html, /src="sound-clarinet\.js\?v=s061"/);
  assert.match(html, /src="sound-sustain\.js\?v=s061"/);
  assert.match(html, /src="sound-held-voice\.js\?v=s061"/);
  assert.match(html, /src="sound-i3-held\.js\?v=s066"/);
  assert.ok(html.indexOf('src="sound-marimba.js') < html.indexOf('src="sound-transient.js'));
  assert.ok(html.indexOf('src="sound-xylophone.js') < html.indexOf('src="sound-transient.js'));
  assert.ok(html.indexOf('src="sound-string.js') < html.indexOf('src="sound-mandolin.js'));
  assert.ok(html.indexOf('src="sound-mandolin.js') < html.indexOf('src="sound-transient.js'));
  assert.ok(html.indexOf('src="sound-clarinet.js') < html.indexOf('src="sound-sustain.js'));
  assert.ok(html.indexOf('src="sound-sustain.js') < html.indexOf('src="sound-held-voice.js'));
  assert.ok(html.indexOf('src="sound-held-voice.js') < html.indexOf('src="sound-score-player.js'));
  assert.match(html, /src="sound-fft\.js\?v=s058"/);
  assert.match(html, /src="sound-spectrum\.js\?v=s058"/);
  assert.match(html, /src="sound-motion\.js\?v=s020c"/);
  assert.match(html, /src="sound-beats\.js"/);
  assert.match(html, /src="sound-intervals\.js\?v=s021"/);
  assert.match(html, /src="sound-ear-tune\.js\?v=s028"/);
  assert.match(html, /src="sound-harmonics\.js"/);
  assert.match(html, /src="sound-noise\.js"/);
  assert.match(html, /src="sound-scales\.js\?v=s031"/);
  assert.match(html, /src="sound-limit5\.js\?v=s036"/);
  assert.match(html, /src="sound-temperaments\.js\?v=s036"/);
  assert.match(html, /src="sound-score\.js\?v=s051"/);
  assert.match(html, /src="sound-abc\.js\?v=s051"/);
  assert.match(html, /src="sound-fm\.js\?v=s044"/);
  assert.match(html, /src="sound-drum-abc\.js\?v=s074"/);
  assert.match(html, /src="sound-drum-patterns\.js\?v=s072"/);
  assert.match(html, /src="sound-score-player\.js\?v=s074"/);
  assert.match(html, /src="sound-compose\.js\?v=s066"/);
  assert.match(html, /src="sound-ensemble-presets\.js\?v=s074"/);
  assert.match(html, /src="sound-ensemble\.js\?v=s074"/);
  assert.match(html, /src="sound-project\.js\?v=s072"/);
  assert.match(html, /src="sound-project-ui\.js\?v=s057"/);
  assert.match(html, /src="sound-wav\.js\?v=s056"/);
  assert.match(html, /src="sound-export\.js\?v=s059"/);
  assert.match(html, /src="sound-export-ui\.js\?v=s064"/);
  assert.match(html, /src="sound-lab\.js\?v=s079"/);
  assert.match(html, /src="sound-compare\.js\?v=s081"/);
  assert.ok(html.indexOf('src="sound-compare.js') < html.indexOf('src="sound-lab.js'));
  assert.match(html, /src="sound-analysis-examples\.js\?v=s065"/);
  for (const module of ["wave-reader", "analysis-dsp"]) {
    assert.match(html, new RegExp('src="sound-' + module + '\\.js\\?v=s058"'));
    assert.ok(html.indexOf('src="sound-' + module + '.js') < html.indexOf('src="sound-lab.js'));
  }
  for (const module of ["analysis-spectrogram", "analysis"]) {
    assert.match(html, new RegExp('src="sound-' + module + '\\.js\\?v=' +
      (module === "analysis" ? "s081" : "s065") + '"'));
    assert.ok(html.indexOf('src="sound-' + module + '.js') < html.indexOf('src="sound-lab.js'));
  }
  assert.match(html, /src="sound-microphone\.js\?v=s078"/);
  assert.ok(html.indexOf('src="sound-analysis.js') < html.indexOf('src="sound-microphone.js'));
  assert.ok(html.indexOf('src="sound-microphone.js') < html.indexOf('src="sound-lab.js'));
  assert.ok(html.indexOf('src="sound-fft.js') < html.indexOf('src="sound-spectrum.js'));
  assert.ok(html.indexOf('src="sound-export.js') < html.indexOf('src="sound-analysis-examples.js'));
  assert.ok(html.indexOf('src="sound-wav.js') < html.indexOf('src="sound-recorder.js'));
  assert.ok(html.indexOf('src="sound-project.js') < html.indexOf('src="sound-export.js'));
  assert.ok(html.indexOf('src="sound-export.js') < html.indexOf('src="sound-export-ui.js'));
  assert.ok(html.indexOf('src="sound-export-ui.js') < html.indexOf('src="sound-lab.js'));
  assert.ok(html.indexOf('src="sound-project.js') < html.indexOf('src="sound-project-ui.js'));
  assert.ok(html.indexOf('src="sound-project-ui.js') < html.indexOf('src="sound-lab.js'));
  assert.ok(html.indexOf('src="sound-fm.js') < html.indexOf('src="sound-transient.js'),
    "FM must load before the shared transient synthesizer");
  assert.match(html, /href="sound-lab\.css\?v=s081"/);
  assert.match(html, /id="recordAnalyze"[^>]*data-i18n="recordAnalyze"/);
  assert.match(html, /id="exportAnalyze"[^>]*hidden/);
  assert.match(html, /id="projectToolbar"[^>]*hidden/);
  assert.match(html, /id="projectName"[^>]*maxlength="120"/);
  assert.match(html, /id="projectFile"[^>]*type="file"[^>]*accept="[^"]*\.soundlab\.json/);
  assert.match(html, /id="projectStatus"[^>]*role="status"/);
  assert.match(html, /id="projectConfirm"[^>]*hidden/);
  assert.match(html, /id="langMn"[^>]*>MN<\/button>[\s\S]*id="langEn"[^>]*>EN<\/button>/);
  assert.match(html, /href="LICENSE" data-i18n="licenseLink"/);
  assert.match(html, /data-i18n="designCredit">Гантөмөрийн бүтээл/);
  assert.doesNotMatch(html, /data-i18n="future"/);
  assert.match(browserCode, /designCredit: "Designed by Gantumur", licenseLink: "App code: MIT License"/);
  assert.match(html, /id="scaleGapToggle" type="checkbox"/);
  assert.match(html, /id="scaleGapPanel" hidden/);
  assert.match(html, /src="sound-recorder\.js\?v=s057"/);
  assert.match(html, /id="exportWav"[^>]*aria-describedby="exportHint"/);
  assert.match(html, /id="exportStatus"[^>]*role="status"/);
  assert.match(html, /id="exportDownload"[^>]*hidden/);
  assert.match(html, /id="recordPreview"[^>]*controls/);
  assert.match(html, /id="recordDownload"[^>]*download="sound-lab\.wav"/);
  assert.match(html, /class="top-actions"[\s\S]*id="recordButton"[\s\S]*id="stopAll"/);
  assert.doesNotMatch(html, /class="record-panel"/);
  assert.match(html, /id="recordResult"[^>]*hidden/);
  assert.match(html, /id="strikeWorkspace"[^>]*hidden/);
  assert.match(html, /id="sustainWorkspace"[^>]*hidden/);
  assert.match(html, /id="sustainChallenge"[^>]*hidden/);
  assert.match(html, /id="sustainExplanation"[^>]*hidden/);
  assert.match(html, /id="motionWorkspace"[^>]*hidden/);
  assert.match(html, /id="mixWorkspace"[^>]*hidden/);
  assert.match(html, /id="mixExplanation"[^>]*hidden/);
  assert.match(html, /id="mixChallenge"[^>]*hidden/);
  assert.match(html, /id="harmonicWorkspace"[^>]*hidden/);
  assert.match(html, /id="intervalWorkspace"[^>]*hidden/);
  assert.match(html, /id="earWorkspace"[^>]*hidden/);
  assert.match(html, /id="earOctavePanel"[^>]*hidden/);
  const earMarkup = html.slice(html.indexOf('id="earWorkspace"'), html.indexOf('id="scaleWorkspace"'));
  const earOrder = ['id="earTaskSelect"', 'id="earPlayModes"', 'id="earAdjust"',
    'id="earSounds"', 'id="earHelpModes"', 'id="earCheck"'];
  assert.ok(earOrder.every((item, i) => i === 0 || earMarkup.indexOf(earOrder[i - 1]) < earMarkup.indexOf(item)),
    "Ear challenge, play toggles, slider, timbre, help and check follow the compact order");
  assert.equal([...earMarkup.matchAll(/<option value="(?:fifth|third|fourth|octaveUp|downFourth|downFifth|octaveDown)"/g)].length, 7);
  assert.doesNotMatch(earMarkup, /id="earButton"/);
  assert.match(html, /id="earChallenge"[^>]*hidden/);
  assert.match(html, /id="earExplanation"[^>]*hidden/);
  const intervalMarkup = html.slice(html.indexOf('id="intervalWorkspace"'), html.indexOf('id="scaleWorkspace"'));
  assert.ok(intervalMarkup.indexOf('id="intervalRatioSelect"') < intervalMarkup.indexOf('id="intervalPlayModes"') &&
    intervalMarkup.indexOf('id="intervalPlayModes"') < intervalMarkup.indexOf('id="intervalStatus"'),
  "Interval dropdown and two play buttons must appear in compact order");
  assert.doesNotMatch(intervalMarkup, /id="intervalButton"|id="intervalPresets"/);
  assert.match(html, /id="intervalChallenge"[^>]*hidden/);
  assert.match(html, /id="intervalExplanation"[^>]*hidden/);
  assert.match(html, /id="modeTuning"[^>]*>Хөг<\/button>/);
  assert.match(html, /id="scaleWorkspace"[^>]*hidden/);
  assert.match(html, /id="scaleChallenge"[^>]*hidden/);
  assert.match(html, /id="scaleExplanation"[^>]*hidden/);
  assert.match(html, /id="limit5Workspace"[^>]*hidden/);
  assert.match(html, /id="limit5Challenge"[^>]*hidden/);
  assert.match(html, /id="limit5Explanation"[^>]*hidden/);
  assert.match(html, /id="temperamentWorkspace"[^>]*hidden/);
  assert.match(html, /id="tempChallenge"[^>]*hidden/);
  assert.match(html, /id="tempExplanation"[^>]*hidden/);
  assert.match(html, /id="tempCircleCanvas"/);
  assert.match(html, /id="tempLatticeCanvas" width="920" height="300"/);
  assert.match(html, /id="tempLatticeConstructionFact"/);
  assert.match(html, /id="tempFifthsCanvas"/);
  assert.match(html, /id="tempFifthsBody"/);
  assert.equal([...html.matchAll(/data-temp-play="/g)].length, 2);
  const scaleMarkup = html.slice(html.indexOf('id="scaleWorkspace"'), html.indexOf('id="harmonicWorkspace"'));
  assert.ok(scaleMarkup.indexOf('id="scalePresetSelect"') < scaleMarkup.indexOf('id="scalePlayModes"') &&
    scaleMarkup.indexOf('id="scalePlayModes"') < scaleMarkup.indexOf('id="scaleStatus"'),
  "3-limit dropdown and two play buttons must appear in compact order");
  const limit5Markup = html.slice(html.indexOf('id="limit5Workspace"'), html.indexOf('id="temperamentWorkspace"'));
  const limit5Order = ['id="limit5PresetSelect"', 'id="limit5PlaybackModes"', 'id="limit5BaseSlider"',
    'id="limit5ShowRoutes"', 'id="limit5Volume"'];
  assert.ok(limit5Order.every((item, i) => i === 0 || limit5Markup.indexOf(limit5Order[i - 1]) < limit5Markup.indexOf(item)),
    "5-limit presets, playback toggles, frequency and advanced options follow the compact order");
  assert.doesNotMatch(limit5Markup, /id="limit5Button"|id="limit5CompareButton"|id="limit5Presets"/);
  assert.equal([...limit5Markup.matchAll(/data-limit5-play="/g)].length, 2);
  assert.equal([...limit5Markup.matchAll(/<option value="(?:major|minor|gmajor|dminor|seven|just12|fifths|commaE|commaD|diaschisma|custom)"/g)].length, 11);
  assert.match(limit5Markup, /id="limit5JustHint"/);
  assert.match(html, /<option value="just" data-i18n="tempJust"/);
  assert.match(html, /id="tempJustGuide"[^>]*hidden/);
  assert.match(html, /id="tempOpenJustLattice"/);
  assert.match(limit5Markup, /id="limit5LatticeCanvas"/);
  assert.match(limit5Markup, /id="limit5OctaveCanvas"/);
  assert.match(limit5Markup, /id="limit5FourierCanvas"/);
  assert.ok(limit5Markup.indexOf('id="limit5LatticeCanvas"') < limit5Markup.indexOf('id="limit5FourierCanvas"') &&
    limit5Markup.indexOf('id="limit5FourierCanvas"') < limit5Markup.indexOf('id="limit5OctaveCanvas"'),
  "5-limit Fourier panel is between lattice and octave panels");
  assert.match(limit5Markup, /id="limit5PointInfo"/);
  assert.match(limit5Markup, /id="limit5CommaRuler"[^>]*hidden/);
  assert.match(html, /id="noiseWorkspace"[^>]*hidden/);
  assert.match(html, /id="modeCompose"[^>]*data-i18n="modeCompose"/);
  assert.match(html, /id="composeWorkspace"[^>]*hidden/);
  assert.match(html, /id="composeSubtabs"[^>]*data-i18n-aria="composeModesAria"/);
  assert.match(html, /id="ensembleSubtabs"[^>]*data-i18n-aria="composeModesAria"/);
  assert.match(html, /id="composeEnsembleWorkspace"[^>]*hidden/);
  assert.equal([...html.matchAll(/data-compose-subtab="/g)].length, 4);
  for (const group of ["exampleStudies", "exampleClassics", "exampleWestern", "examplePopular", "exampleRussian"]) {
    assert.match(html, new RegExp('data-compose-group-i18n="' + group + '"'));
  }
  for (const group of ["presetStudies", "presetClassics", "presetWestern", "presetPopular", "presetRussian"]) {
    assert.match(html, new RegExp('data-ensemble-group-i18n="' + group + '"'));
  }
  for (const choice of ["bella", "chopin7", "chopin20", "greensleeves", "daisy", "paloma"]) {
    assert.match(html, new RegExp('<option value="' + choice + '"'));
  }
  for (const id of ["ensembleText", "ensembleTuning", "ensemblePreset", "ensembleApplyPreset", "ensembleAdd", "ensembleAddDrums",
    "ensemblePlayPause", "ensembleStop", "ensembleStatus", "ensembleLoad", "ensembleTimeline", "ensembleTrackList",
    "ensembleDrumGrid", "ensembleDrumHint", "ensembleGridBar", "ensembleGridStep", "ensembleGridStrength", "ensembleGridArticulation", "ensembleGridHand", "ensembleGridCells",
    "ensemblePatternPanel", "ensemblePatternTools", "ensemblePatternEnable", "ensemblePatternArrangement", "ensemblePatternBar",
    "ensemblePatternChoice", "ensemblePatternUnique", "ensemblePatternRepeat", "ensemblePatternGroup", "ensemblePatternRange",
    "ensemblePatternFrom", "ensemblePatternTo", "ensemblePatternLength", "ensemblePatternTextMode", "ensemblePatternRevert", "ensemblePatternMessage"]) {
    assert.ok(ids.includes(id), "Missing Ensemble control #" + id);
  }
  assert.match(html, /id="ensemblePatternUnique"[^>]*>Шинэ загвар<\/button>/);
  assert.match(html, /id="ensemblePatternRepeat"[^>]*>Дуустал давтах<\/button>/);
  for (const id of ["composeText", "composeExample", "composeInstrument", "composeTuning",
    "composePlayPause", "composeStop", "composeVolume", "composeLoad", "composeScoreSvg"]) {
    assert.ok(ids.includes(id), "Missing Compose control #" + id);
  }
  for (const kind of ["sine", "triangle", "square", "sawtooth", "fmep"]) {
    assert.match(html, new RegExp('<option value="' + kind + '" data-compose-i18n="' + kind + '"'));
  }
  assert.match(html, /id="harmonicChallenge"[^>]*hidden/);
  assert.match(html, /id="noiseChallenge"[^>]*hidden/);
  assert.doesNotMatch(html, /id="mixExperimentSwitch"/);
  assert.equal([...html.matchAll(/class="experiment-switch /g)].length, 15);
  assert.equal([...html.matchAll(/data-mix-kind="/g)].length, 4);
  assert.equal([...html.matchAll(/data-tuning-kind="/g)].length, 25);
  for (const kind of ["waves", "harmonics"]) {
    assert.equal([...html.matchAll(new RegExp('data-pure-kind="' + kind + '"', 'g'))].length, 2);
  }
  for (const kind of ["beats", "noise"]) {
    assert.equal([...html.matchAll(new RegExp('data-mix-kind="' + kind + '"', 'g'))].length, 2);
  }
  for (const kind of ["intervals", "ear", "scales", "limit5", "temperaments"]) {
    assert.equal([...html.matchAll(new RegExp('data-tuning-kind="' + kind + '"', 'g'))].length, 5);
  }
  assert.ok(html.indexOf('id="mixWorkspace"') < html.indexOf('class="experiment-switch mix-experiment-switch"'),
    "Experiment choices belong within left panels, not under the main tabs");
  for (const kind of ["pluck", "kick", "piano"]) assert.match(html, new RegExp('data-strike="' + kind + '"'));
  assert.match(html, /data-i18n="strikePitched">Ноттой<\/span>/);
  const pitchedMenu = html.match(/<select id="strikePianoType">([\s\S]*?)<\/select>/)[1];
  assert.deepEqual([...pitchedMenu.matchAll(/value="([^"]+)"/g)].map(match => match[1]),
    ["acoustic", "electric", "chimes", "marimba", "xylophone", "mandolin", "harp"]);
  assert.match(html, /data-i18n="pluck">Гитар<\/span>/);
  assert.doesNotMatch(html.match(/<select id="strikeDrumVoice">([\s\S]*?)<\/select>/)[1], /value="chimes"/);
  for (const family of transientModel.DRUM_VOICES) {
    assert.match(html, new RegExp('<option value="' + family + '" data-i18n="strikeDrum'));
  }
  for (const drum of drumABC.DRUMS) {
    assert.match(html, new RegExp('data-strike-kit-drum="' + drum.id + '"'));
  }
  assert.match(html, /data-strike-drum-view="kit"/);
  assert.match(html, /data-strike-drum-view="models"/);
  assert.match(html, /id="strikeDrumModelsGroup" hidden/);
  for (const chord of Object.keys(transientModel.STRUM_CHORDS)) {
    assert.match(html, new RegExp('data-guitar-chord="' + chord + '"'));
  }
  for (const touch of transientModel.PIANO_TOUCHES) {
    assert.match(html, new RegExp('data-strike-play="' + touch + '"'));
  }
  assert.doesNotMatch(html, /id="pianoKeyboard"|class="piano-keys"/);
  for (const family of ["air", "bow", "organ", "reed"]) assert.match(html, new RegExp('data-sustain-family="' + family + '"'));
  assert.match(html, /id="sustainInstrument"/);
  assert.doesNotMatch(html, /data-sustain="/);
  assert.match(html, /id="sustainHoldButton"/);
  assert.match(html, /id="sustainToggleButton"/);
  assert.match(html, /id="sustainBreath" type="range" min="0" max="100"/);
  assert.match(html, /id="sustainBowPressure" type="range" min="0" max="100"/);
  const mainNavigation = html.match(/<nav[^>]*id="modeSwitch"[^>]*>[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...mainNavigation.matchAll(/id="(mode\w+)"/g)].map(match => match[1]),
    ["modeSwitch", "modePure", "modeMotion", "modeSustain", "modeStrike", "modeMix", "modeTuning", "modeCompose", "modeAnalysis"]);
  assert.equal([...html.matchAll(/data-pure-kind="/g)].length, 4);
  assert.equal([...html.matchAll(/data-mix-kind="/g)].length, 4);
  assert.doesNotMatch(html, /data-mix-kind="harmonics"/);
  assert.match(html, /id="modeMix"[^>]*data-i18n="modeMix"/);
  assert.match(html, /id="mixBaseInput"[^>]*type="number"/);
  assert.match(html, /data-i18n="unitHz">Гц<\/span>/);
  assert.match(html, /data-i18n="strikePresetOneSecond">1 сек<\/option>/);
  for (const pattern of motionModel.PATTERNS) {
    assert.match(html, new RegExp('data-siren-pattern="' + pattern + '"'));
  }
  for (const timbre of motionModel.TIMBRES) {
    assert.match(html, new RegExp('data-theremin-timbre="' + timbre + '"'));
  }
  for (const vowel of motionModel.VOWELS) {
    assert.match(html, new RegExp('data-theremin-vowel="' + vowel + '"'));
  }
  assert.match(html, /id="thereminHarmonic" type="range" min="2" max="12"/);
  assert.equal([...html.matchAll(/data-theremin-timbre="/g)].length, 4);
  assert.equal([...html.matchAll(/data-siren-pattern="/g)].length, 3);
  assert.equal([...html.matchAll(/data-mix-gap="/g)].length, 4);
  assert.equal([...intervalMarkup.matchAll(/<option value="(?:1:1|2:1|3:2|4:3|5:4|6:5)"/g)].length, 6);
  assert.equal([...html.matchAll(/data-interval-play="/g)].length, 2);
  assert.equal([...html.matchAll(/data-scale-play="/g)].length, 2);
  assert.equal([...html.matchAll(/data-interval-tuning="/g)].length, 2);
  assert.equal([...html.matchAll(/data-interval-color="/g)].length, 2);
  assert.match(html, /id="mixZoomIn"/);
  assert.match(html, /id="mixZoomOut"/);
  assert.match(html, /id="mixZoomValue"/);
  assert.doesNotMatch(html, /data-mix-window=/);
  assert.doesNotMatch(html, /data-siren-pattern="sweep"/);
  assert.match(browserCode, /Нотод тааруулах/);
  assert.doesNotMatch(browserCode, /ноот/i);
});

test("compact header removes the redundant mode introductions but keeps one page heading", () => {
  assert.match(html, /<h1>Sound Lab<\/h1>/);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  assert.match(html, /class="mode-bar"/);
  assert.doesNotMatch(html, /id="page(?:Eyebrow|Title|Intro|Phase)"/);
  assert.doesNotMatch(browserCode, /\$\("pagePhase"\)/);
  assert.doesNotMatch(browserCode, /strikeEyebrow|strikeTitle|strikeIntro/);
  assert.match(html, /Дууны долгион яагаад өөр өөр сонсогддог вэ\?/);
});

test("firetruck Play/Stop icon forwards taps to its enclosing button", () => {
  assert.match(html, /<button id="sirenButton"[^>]*>[\s\S]*?<span class="play-icon" id="sirenPlayIcon"/);
  assert.match(css, /\.siren-button\s*>\s*span\s*\{\s*pointer-events:\s*none;/);
});

function fakePage(search = "", supportWorklets = true, analysisController = null, deferStops = false,
  microphoneController = null, compareController = null) {
  const contexts = [];
  const offlineContexts = [];
  const exportRequests = [];
  const analyzedAt = [];
  const objectUrls = [];
  const revokedUrls = [];
  const animationFrames = new Map();
  let nextFrameId = 0;
  const timers = new Map();
  let nextTimerId = 0;
  const classList = () => {
    const values = new Set();
    return {
      toggle(name, condition) {
        if (condition) values.add(name);
        else values.delete(name);
      },
      contains(name) { return values.has(name); }
    };
  };
  function element(dataset = {}) {
    const attributes = {};
    const drawnText = [];
    const drawnRects = [];
    const drawnArcs = [];
    return {
      dataset,
      drawnText,
      drawnRects,
      drawnArcs,
      children: [],
      events: {},
      value: "",
      checked: false,
      open: false,
      textContent: "",
      style: {},
      classList: classList(),
      setAttribute(name, value) { attributes[name] = String(value); },
      getAttribute(name) { return attributes[name]; },
      removeAttribute(name) { delete attributes[name]; delete this[name]; },
      appendChild(node) { this.children.push(node); return node; },
      replaceChildren(...nodes) { this.children = nodes; },
      addEventListener(name, callback) { this.events[name] = callback; },
      click() { this.clickCount = (this.clickCount || 0) + 1; if (this.events.click) return this.events.click(); },
      focus() { this.focused = true; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 710, height: 210 }; },
      setPointerCapture() {}, releasePointerCapture() {},
      pause() { this.paused = true; },
      getContext() {
        const noop = () => {};
        return {
          setTransform: noop, clearRect: noop, setLineDash: noop,
          save: noop, restore: noop, closePath: noop,
          fillRect(x, y, width, height) { drawnRects.push({ x, y, width, height, color: this.fillStyle }); },
          beginPath: noop,
          moveTo: noop, lineTo: noop, stroke: noop, fillText(value) { drawnText.push(String(value)); },
          arc(x, y, radius) { drawnArcs.push({ x, y, radius, fillStyle: this.fillStyle }); },
          fill: noop
        };
      }
    };
  }

  const elements = new Map(ids.map(id => [id, element()]));
  const projectLabels = [...html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*\bdata-project-i18n="([^"]+)"[^>]*>/g)]
    .map(match => {
      const node = elements.get(match[1]);
      node.setAttribute("data-project-i18n", match[2]);
      return node;
    });
  const waveButtons = model.WAVEFORMS.map(wave => element({ wave }));
  const strikeButtons = ["pluck", "kick", "piano"].map(strike => element({ strike }));
  const strikePlayButtons = ["single", "strum", "press", "tap", "pick", "tremolo"].map(strikePlay => element({ strikePlay }));
  const guitarPlayButtons = strikePlayButtons.slice(0, 2);
  const guitarChordButtons = Object.keys(transientModel.STRUM_CHORDS).map(guitarChord => element({ guitarChord }));
  const pianoTouchButtons = strikePlayButtons.slice(2, 4);
  const mandolinPlayButtons = strikePlayButtons.slice(4);
  const sustainButtons = ["air", "bow", "organ", "reed"].map(sustainFamily => element({ sustainFamily }));
  const drumButtons = Object.keys(transientModel.KICK_SIZES).map(drumSize => element({ drumSize }));
  const drumViewButtons = ["kit", "models"].map(strikeDrumView => element({ strikeDrumView }));
  const drumKitButtons = drumABC.DRUMS.map(drum => element({ strikeKitDrum: drum.id }));
  const spectrumButtons = ["local", "overall"].map(spectrumView => element({ spectrumView }));
  const motionButtons = ["theremin", "siren"].map(motion => element({ motion }));
  const sirenPatternButtons = motionModel.PATTERNS.map(sirenPattern => element({ sirenPattern }));
  const timbreButtons = motionModel.TIMBRES.map(thereminTimbre => element({ thereminTimbre }));
  const vowelButtons = motionModel.VOWELS.map(thereminVowel => element({ thereminVowel }));
  const mixGapButtons = [0, 2, 4, 10].map(mixGap => element({ mixGap: String(mixGap) }));
  const pureKindButtons = [...html.matchAll(/<button\b[^>]*\bdata-pure-kind="([^"]+)"[^>]*>/g)].map(match => {
    const button = element({ pureKind: match[1] });
    const key = match[0].match(/data-i18n="([^"]+)"/)[1];
    button.setAttribute("data-i18n", key);
    return button;
  });
  const pureKindGroups = [...html.matchAll(/data-i18n-aria="pureExperimentsAria"/g)].map(() => {
    const group = element();
    group.setAttribute("data-i18n-aria", "pureExperimentsAria");
    return group;
  });
  const mixKindButtons = Array.from({ length: 2 }, () =>
    ["beats", "noise"].map(mixKind => element({ mixKind }))).flat();
  const tuningKindButtons = Array.from({ length: 5 }, () =>
    ["intervals", "ear", "scales", "limit5", "temperaments"].map(tuningKind => element({ tuningKind }))).flat();
  const earHelpButtons = ["guided", "blind"].map(earHelp => element({ earHelp }));
  const earSoundButtons = earModel.SOUNDS.map(earSound => element({ earSound }));
  const earPlayButtons = earModel.PATTERNS.map(earPlay => element({ earPlay }));
  const limit5PlayButtons = ["melody", "chord"].map(limit5Play => element({ limit5Play }));
  const tempPlayButtons = ["melody", "chord"].map(tempPlay => element({ tempPlay }));
  const tempNarrowButtons = ["pythagorean", "equal", "no-wolf", "meantone"]
    .map(tempNarrowPreset => element({ tempNarrowPreset }));
  const scalePlayButtons = ["melody", "chord"].map(scalePlay => element({ scalePlay }));
  const scaleTonicButtons = Array.from({ length: scaleModel.MAX_NOTES }, (_, scaleTonic) =>
    element({ scaleTonic: String(scaleTonic) }));
  const intervalPlayButtons = ["alternating", "together"].map(intervalPlay => element({ intervalPlay }));
  const intervalOptions = intervalModel.PRESETS.map(preset => ({ ...element(), value: preset.ratio }));
  const intervalTuningButtons = ["just", "equal"].map(intervalTuning => element({ intervalTuning }));
  const composeSubtabButtons = ["solo", "ensemble"].flatMap(composeOwner =>
    ["solo", "ensemble"].map(composeSubtab => {
      const button = element({ composeSubtab, composeOwner });
      button.setAttribute("data-i18n", composeSubtab === "solo" ? "composeSolo" : "composeEnsemble");
      return button;
    }));
  const composeKindGroups = ["composeSubtabs", "ensembleSubtabs"].map(id => {
    const group = elements.get(id);
    group.setAttribute("data-i18n-aria", "composeModesAria");
    return group;
  });
  const intervalColorButtons = ["pure", "rich"].map(intervalColor => element({ intervalColor }));
  const harmonicPresetButtons = ["pure", "odd", "rich"].map(harmonicPreset => element({ harmonicPreset }));
  const harmonicLevelInputs = Array.from({ length: harmonicModel.COUNT }, (_, i) =>
    element({ harmonicLevel: String(i + 1) }));
  const noiseColorButtons = noiseModel.COLORS.map(noiseColor => element({ noiseColor }));
  const noteButtons = [60, 69, 72].map(note => element({ note: String(note) }));
  const hzLabels = [...html.matchAll(/data-unit-hz="([^"]+)"/g)].map(match => element({ unitHz: match[1] }));
  const noteGroup = element(), langGroup = element();
  const document = {
    documentElement: {},
    hidden: false,
    events: {},
    getElementById(id) { return elements.get(id) || null; },
    createElement(name) { const node = element(); node.tagName = name; return node; },
    createElementNS(_ns, name) { const node = element(); node.tagName = name; return node; },
    querySelectorAll(selector) {
      if (selector === "[data-wave]") return waveButtons;
      if (selector === "[data-strike]") return strikeButtons;
      if (selector === "[data-strike-play]") return strikePlayButtons;
      if (selector === "[data-guitar-chord]") return guitarChordButtons;
      if (selector === "[data-sustain-family]") return sustainButtons;
      if (selector === "[data-drum-size]") return drumButtons;
      if (selector === "[data-strike-drum-view]") return drumViewButtons;
      if (selector === "[data-strike-kit-drum]") return drumKitButtons;
      if (selector === "[data-spectrum-view]") return spectrumButtons;
      if (selector === "[data-motion]") return motionButtons;
      if (selector === "[data-siren-pattern]") return sirenPatternButtons;
      if (selector === "[data-theremin-timbre]") return timbreButtons;
      if (selector === "[data-theremin-vowel]") return vowelButtons;
      if (selector === "[data-mix-gap]") return mixGapButtons;
      if (selector === "[data-pure-kind]") return pureKindButtons;
      if (selector === "[data-mix-kind]") return mixKindButtons;
      if (selector === "[data-i18n]") return [...pureKindButtons, ...composeSubtabButtons];
      if (selector === "[data-i18n-aria]") return [...pureKindGroups, ...composeKindGroups];
      if (selector === "[data-tuning-kind]") return tuningKindButtons;
      if (selector === "[data-compose-subtab]") return composeSubtabButtons;
      if (selector === "[data-project-i18n]") return projectLabels;
      if (selector === "[data-ear-help]") return earHelpButtons;
      if (selector === "[data-ear-sound]") return earSoundButtons;
      if (selector === "[data-ear-play]") return earPlayButtons;
      if (selector === "[data-scale-play]") return scalePlayButtons;
      if (selector === "[data-scale-tonic]") return scaleTonicButtons;
      if (selector === "[data-limit5-play]") return limit5PlayButtons;
      if (selector === "[data-temp-play]") return tempPlayButtons;
      if (selector === "[data-temp-narrow-preset]") return tempNarrowButtons;
      if (selector === "[data-interval-play]") return intervalPlayButtons;
      if (selector === "#intervalRatioSelect option") return intervalOptions;
      if (selector === "[data-interval-tuning]") return intervalTuningButtons;
      if (selector === "[data-interval-color]") return intervalColorButtons;
      if (selector === "[data-harmonic-preset]") return harmonicPresetButtons;
      if (selector === "[data-harmonic-level]") return harmonicLevelInputs;
      if (selector === "[data-noise-color]") return noiseColorButtons;
      if (selector === "[data-note]") return noteButtons;
      if (selector === "[data-unit-hz]") return hzLabels;
      return [];
    },
    querySelector(selector) {
      if (selector === ".note-presets") return noteGroup;
      if (selector === ".lang-group") return langGroup;
      throw new Error("Unknown selector " + selector);
    },
    addEventListener(type, callback) { this.events[type] = callback; }
  };
  const window = {
    SoundLabModel: model,
    SoundLabTransientModel: transientModel,
    SoundLabSustain: sustainModel,
    SoundLabHeldVoice: heldVoiceModel,
    SoundLabI3Held: i3HeldModel,
    SoundLabHarp: harpModel,
    SoundLabMarimba: marimbaModel,
    SoundLabXylophone: xylophoneModel,
    SoundLabMandolin: mandolinModel,
    SoundLabMotionModel: motionModel,
    SoundLabBeats: beatsModel,
    SoundLabIntervals: intervalModel,
    SoundLabEarTune: earModel,
    SoundLabScales: scaleModel,
    SoundLabLimit5: limit5Model,
    SoundLabTemperaments: tempModel,
    SoundLabHarmonics: harmonicModel,
    SoundLabNoise: noiseModel,
    SoundLabRecorder: recorderModel,
    SoundLabSpectrum: {
      ...spectrumModel,
      spectrumAt(model, recipe, time) {
        analyzedAt.push(time);
        return spectrumModel.spectrumAt(model, recipe, time);
      }
    },
    location: { href: "https://example.org/soundlab/" + search, search },
    history: { replaceState() {} },
    devicePixelRatio: 1,
    requestAnimationFrame(callback) {
      const id = ++nextFrameId;
      animationFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { animationFrames.delete(id); },
    setInterval(callback, delay) {
      const id = ++nextTimerId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearInterval(id) { timers.delete(id); },
    setTimeout(callback, delay) { return setTimeout(callback, delay); },
    events: {},
    addEventListener(type, callback) { this.events[type] = callback; }
  };

  class FakeAudioContext {
    constructor({ offline = false } = {}) {
      this.state = "suspended";
      this.currentTime = 0;
      this.destination = {};
      this.oscillators = [];
      this.sampleRate = 44100;
      this.buffers = [];
      this.sources = [];
      this.gains = [];
      this.worklets = [];
      this.constantSources = [];
      this.periodicWaves = [];
      this.filters = [];
      this.shapers = [];
      this.addedModules = [];
      this.audioWorklet = {
        addModule: async url => { this.addedModules.push(url); }
      };
      (offline ? offlineContexts : contexts).push(this);
    }
    async resume() { this.state = "running"; }
    async suspend() { this.state = "suspended"; }
    createOscillator() {
      const osc = {
        type: "sine",
        setPeriodicWave(wave) { this.periodicWave = wave; },
        frequency: {
          value: null,
          setValueAtTime(value) { this.value = value; },
          setTargetAtTime(value) { this.value = value; }
        },
        started: false,
        stopped: false,
        connect() {},
        disconnect() {},
        start() { this.started = true; },
        stop() {
          this.stopped = true;
          if (this.onended) this.onended();
        }
      };
      this.oscillators.push(osc);
      return osc;
    }
    createBuffer(channels, length, sampleRate) {
      const data = new Float32Array(length);
      const buffer = { channels, length, sampleRate, duration: length / sampleRate,
        getChannelData() { return data; } };
      this.buffers.push(buffer);
      return buffer;
    }
    createPeriodicWave(real, imag, options = {}) {
      const wave = { real, imag, options };
      this.periodicWaves.push(wave);
      return wave;
    }
    createWaveShaper() {
      const shaper = { curve: null, oversample: "none", connect() {}, disconnect() {} };
      this.shapers.push(shaper);
      return shaper;
    }
    createBiquadFilter() {
      const filter = {
        type: "lowpass",
        Q: { value: 0,
          setValueAtTime(value) { this.value = value; },
          setTargetAtTime(value) { this.value = value; } },
        gain: { value: 0,
          setValueAtTime(value) { this.value = value; },
          setTargetAtTime(value) { this.value = value; } },
        frequency: { value: 0,
          setValueAtTime(value) { this.value = value; },
          setTargetAtTime(value) { this.value = value; } },
        connect(target) { this.connected = target; }, disconnect() { this.disconnected = true; }
      };
      this.filters.push(filter);
      return filter;
    }
    createBufferSource() {
      const context = this;
      const source = {
        buffer: null, started: false, stopped: false,
        connect() {}, disconnect() {},
        start(at, offset = 0) { this.started = true; this.startedAt = at; this.offset = offset; },
        stop(at) {
          this.stopped = true;
          this.stoppedAt = at;
          if (this.onended && (!deferStops || !Number.isFinite(at) || at <= context.currentTime)) this.onended();
        }
      };
      this.sources.push(source);
      return source;
    }
    createGain() {
      const gain = {
        gain: {
          value: 0, records: [],
          setValueAtTime(value, at) { this.value = value; this.records.push(["set", value, at]); },
          linearRampToValueAtTime(value, at) { this.value = value; this.records.push(["ramp", value, at]); },
          setTargetAtTime(value, at, tau) { this.value = value; this.records.push(["target", value, at, tau]); },
          cancelScheduledValues(at) { this.records.push(["cancel", at]); }
        },
        connect() {},
        disconnect() {}
      };
      this.gains.push(gain);
      return gain;
    }
    createConstantSource() {
      const source = {
        offset: { value: 1 }, started: false, stopped: false,
        connect() {}, disconnect() {},
        start() { this.started = true; },
        stop() { this.stopped = true; }
      };
      this.constantSources.push(source);
      return source;
    }
  }
  // A graph/scheduling test double, not a physical audio renderer. Native
  // offline rendering is also exercised through the deployed browser UI.
  class FakeOfflineAudioContext extends FakeAudioContext {
    constructor(channels, length, sampleRate) {
      super({ offline: true });
      this.numberOfChannels = channels;
      this.length = length;
      this.sampleRate = sampleRate;
      this.state = "running";
    }
    async startRendering() {
      this.rendered = true;
      const buffer = this.createBuffer(this.numberOfChannels, this.length, this.sampleRate);
      buffer.numberOfChannels = this.numberOfChannels;
      if (this.oscillators.length || this.sources.length) buffer.getChannelData(0).fill(.125);
      this.state = "closed";
      return buffer;
    }
    async resume() { throw new Error("Offline export must not resume a live context"); }
  }
  class FakeAudioWorkletNode {
    constructor(context, processorName, options) {
      this.processorName = processorName;
      this.options = options;
      this.port = {
        onmessage: null, lastPosted: null,
        postMessage(message) { this.lastPosted = message; },
        close() { this.closed = true; }
      };
      context.worklets.push(this);
    }
    connect() {} disconnect() {}
    send(message) { if (this.port.onmessage) this.port.onmessage({ data: message }); }
  }
  class FakeURL extends URL {
    static createObjectURL(blob) {
      const url = `blob:https://example.org/${objectUrls.length + 1}`;
      objectUrls.push({ url, blob });
      return url;
    }
    static revokeObjectURL(url) { revokedUrls.push(url); }
  }
  window.AudioContext = FakeAudioContext;
  window.OfflineAudioContext = FakeOfflineAudioContext;
  window.AudioWorkletNode = supportWorklets ? FakeAudioWorkletNode : undefined;
  const sandbox = { document, window, URL: FakeURL, Blob, TextEncoder, URLSearchParams,
    Float32Array, Uint8Array, ArrayBuffer, DataView, ResizeObserver: undefined,
    setInterval: (...args) => window.setInterval(...args), clearInterval: id => window.clearInterval(id),
    setTimeout, clearTimeout };
  const vmContext = vm.createContext(sandbox);
  // Load the new modules as a browser would, not via Node require: their audio
  // scheduler must see this sandbox's clock/timers rather than real Node timers.
  for (const name of ["sound-score.js", "sound-abc.js", "sound-drum-abc.js", "sound-drum-patterns.js", "sound-fm.js", "sound-score-player.js",
    "sound-compose.js", "sound-ensemble-presets.js", "sound-ensemble.js", "sound-project.js", "sound-project-ui.js",
    "sound-wav.js", "sound-export.js", "sound-export-ui.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, name), "utf8"), vmContext,
      { filename: name });
    // globalThis and window are the same object in an actual browser.
    if (name === "sound-wav.js") window.SoundLabWav = vmContext.SoundLabWav;
  }
  const offlineExport = window.SoundLabExport;
  if (analysisController) window.SoundLabAnalysis = { Controller: analysisController };
  if (microphoneController) window.SoundLabMicrophone = { Controller: microphoneController };
  if (compareController) window.SoundLabCompare = { Controller: compareController };
  window.SoundLabExport = { ...offlineExport, render(snapshot, dependencies) {
    exportRequests.push(JSON.parse(JSON.stringify(snapshot)));
    return offlineExport.render(snapshot, dependencies);
  } };
  vm.runInContext(browserCode, vmContext, { filename: "sound-lab.js" });
  return {
    contexts, offlineContexts, exportRequests, elements, document, window, waveButtons, strikeButtons,
    guitarPlayButtons, guitarChordButtons, pianoTouchButtons, mandolinPlayButtons, strikePlayButtons, sustainButtons,
    drumButtons, drumViewButtons, drumKitButtons, spectrumButtons,
    motionButtons, sirenPatternButtons, timbreButtons, vowelButtons, mixGapButtons, pureKindButtons, pureKindGroups, mixKindButtons,
    tuningKindButtons, composeSubtabButtons, scalePlayButtons, scaleTonicButtons,
    earHelpButtons, earSoundButtons, earPlayButtons, timers, animationFrames,
    limit5PlayButtons, tempPlayButtons, tempNarrowButtons,
    intervalOptions, intervalPlayButtons, intervalTuningButtons, intervalColorButtons,
    harmonicPresetButtons, harmonicLevelInputs, noiseColorButtons,
    hzLabels, objectUrls, revokedUrls,
    analyzedAt,
    tick(seconds) {
      if (contexts[0]) contexts[0].currentTime += seconds;
      const callbacks = [...animationFrames.values()];
      animationFrames.clear();
      callbacks.forEach(callback => callback());
    },
    fire(id, type, event) {
      const target = elements.get(id);
      return target.events[type]({ target, preventDefault() {}, button: 0, pointerId: 1, ...(event || {}) });
    },
    selectScalePreset(id) {
      elements.get("scalePresetSelect").value = id;
      return this.fire("scalePresetSelect", "change");
    },
    selectIntervalRatio(ratio) {
      elements.get("intervalRatioSelect").value = ratio;
      return this.fire("intervalRatioSelect", "change");
    }
  };
}

test("Analysis integrates with navigation, language, resize and the shared Stop lifecycle", () => {
  const calls = { active: [], languages: [], stops: 0, draws: 0 };
  let running = false;
  class AnalysisFixture {
    constructor(dependencies) { calls.owner = dependencies.contextOwner; }
    setActive(active) { calls.active.push(active); }
    renderLanguage(lang) { calls.languages.push(lang); }
    stop() { calls.stops++; running = false; }
    isPlaying() { return running; }
    draw() { calls.draws++; }
  }
  const app = fakePage("?lang=mn", true, AnalysisFixture);
  assert.equal(app.elements.get("analysisWorkspace").hidden, true);
  assert.equal(app.contexts.length, 0);
  app.fire("modeAnalysis", "click");
  assert.equal(app.elements.get("analysisWorkspace").hidden, false);
  assert.equal(app.elements.get("pureWorkspace").hidden, true);
  assert.equal(app.elements.get("projectToolbar").hidden, true);
  assert.equal(app.elements.get("modeAnalysis").getAttribute("aria-pressed"), "true");
  assert.equal(calls.active.at(-1), true);
  app.fire("langEn", "click");
  assert.equal(calls.languages.at(-1), "en");
  const previousDraws = calls.draws;
  app.window.events.resize();
  assert.ok(calls.draws > previousDraws);
  const stops = calls.stops;
  running = true;
  app.window.events.blur();
  assert.equal(running, false);
  assert.ok(calls.stops > stops);
  running = true;
  app.fire("stopAll", "click");
  assert.equal(running, false);
  app.fire("modeCompose", "click");
  assert.equal(calls.active.at(-1), false);
  assert.equal(app.elements.get("analysisWorkspace").hidden, true);
  assert.equal(app.contexts.length, 0, "Mode changes and language never open live audio");
  assert.equal(typeof calls.owner.readyContext, "function");
});

test("S079 Analysis kind tabs switch at peer level and remember Single source inner view", () => {
  const a = { views: [], stopPlayback: 0, draws: 0 }, b = { active: [], draws: 0, stops: 0 };
  class AnalysisFixture {
    setActive() {}
    renderLanguage() {}
    isPlaying() { return false; }
    stop() {}
    stopPlayback() { a.stopPlayback++; }
    setView(view) { a.views.push(view); }
    draw() { a.draws++; }
  }
  class CompareFixture {
    setActive(value) { b.active.push(value); }
    renderLanguage() {}
    stop() { b.stops++; }
    draw() { b.draws++; }
  }
  const app = fakePage("?lang=en", true, AnalysisFixture, false, null, CompareFixture);
  app.fire("modeAnalysis", "click");
  assert.equal(app.elements.get("analysisWorkspace").hidden, false);
  assert.equal(app.elements.get("analysisKindSingle").getAttribute("aria-pressed"), "true");
  app.fire("analysisKindCompare", "click");
  assert.equal(app.elements.get("analysisWorkspace").hidden, true);
  assert.equal(app.elements.get("analysisCompareWorkspace").hidden, false);
  assert.equal(app.elements.get("compareKindCompare").getAttribute("aria-pressed"), "true");
  assert.equal(b.active.at(-1), true);
  assert.ok(a.stopPlayback > 0, "Comparison must stop single-source playback");
  assert.ok(b.draws > 0);
  app.fire("compareKindSingle", "click");
  assert.equal(app.elements.get("analysisWorkspace").hidden, false);
  assert.equal(app.elements.get("analysisCompareWorkspace").hidden, true);
  assert.equal(app.elements.get("analysisKindSingle").getAttribute("aria-pressed"), "true");
  assert.equal(b.active.at(-1), false);
  assert.deepEqual(a.views, [], "Returning to Single source keeps its Spectrum/Spectrogram setting");
  assert.equal(app.contexts.length, 0, "Changing analysis sub-tabs never autoplays");
});

test("M2 mic controller stays lazy and participates in navigation, language and global Stop", () => {
  const micCalls = { active: [], languages: [], stops: 0 };
  const wavCalls = { stops: 0, playsStopped: 0, draws: 0 };
  let microphone;
  class AnalysisFixture {
    setActive() {} renderLanguage() {} isPlaying() { return false; }
    stop() { wavCalls.stops++; }
    stopPlayback() { wavCalls.playsStopped++; }
    draw() { wavCalls.draws++; }
  }
  class MicrophoneFixture {
    constructor(options) { this.options = options; microphone = this; }
    setActive(active) { micCalls.active.push(active); }
    renderLanguage(lang) { micCalls.languages.push(lang); }
    stop() { micCalls.stops++; }
  }
  const app = fakePage("?lang=mn", true, AnalysisFixture, false, MicrophoneFixture);
  assert.equal(app.contexts.length, 0);
  assert.equal(micCalls.active.at(-1), false);
  app.fire("modeAnalysis", "click");
  assert.equal(micCalls.active.at(-1), true);
  app.fire("langEn", "click");
  assert.equal(micCalls.languages.at(-1), "en");
  microphone.options.onBegin();
  assert.equal(wavCalls.playsStopped, 1, "Mic takeover stops WAV playback, not its saved PCM");
  const beforeReturn = wavCalls.draws;
  microphone.options.onStop();
  assert.equal(wavCalls.draws, beforeReturn + 1, "Mic return restores the WAV display");
  const prior = micCalls.stops;
  app.fire("stopAll", "click");
  assert.ok(micCalls.stops > prior, "Master Stop must release microphone input");
  app.fire("modeCompose", "click");
  assert.equal(micCalls.active.at(-1), false, "Leaving Analysis stops microphone capture");
  assert.equal(app.contexts.length, 0);
});

test("M2 microphone workspace is separate from Analysis and hands captured WAV to the normal controller", async () => {
  const handoffs = [];
  let microphone;
  class AnalysisFixture {
    setActive() {} renderLanguage() {} isPlaying() { return false; }
    stop() {} stopPlayback() {} draw() {}
    openPrepared(blob, name, source) { handoffs.push({ blob, name, source }); return Promise.resolve(true); }
  }
  class MicrophoneFixture {
    constructor(options) { this.options = options; microphone = this; this.open = false; }
    setActive() {} renderLanguage() {} stop() {}
  }
  const app = fakePage("?lang=en", true, AnalysisFixture, false, MicrophoneFixture);
  app.fire("modeAnalysis", "click");
  assert.equal(app.elements.get("analysisWorkspace").hidden, false);
  assert.equal(app.elements.get("analysisMicWorkspace").hidden, true);
  microphone.open = true;
  microphone.options.onViewChange(true);
  assert.equal(app.elements.get("analysisWorkspace").hidden, true);
  assert.equal(app.elements.get("analysisMicWorkspace").hidden, false);
  microphone.open = false;
  microphone.options.onViewChange(false);
  assert.equal(app.elements.get("analysisWorkspace").hidden, false);
  assert.equal(app.elements.get("analysisMicWorkspace").hidden, true);
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" });
  const provenance = { kind: "microphone", origin: "microphone", captureMode: "rolling" };
  assert.equal(await microphone.options.onCapture(blob, "captured.wav", provenance), true);
  assert.deepEqual(handoffs, [{ blob, name: "captured.wav", source: provenance }]);
});

test("A2a REC Analyze reuses the prepared audio Blob and enters Analysis without another download", async () => {
  const handoffs = [];
  class AnalysisFixture {
    setActive() {} renderLanguage() {} stop() {} isPlaying() { return false; } draw() {}
    openPrepared(blob, name) { handoffs.push({ blob, name }); return Promise.resolve(true); }
  }
  const app = fakePage("?lang=en", true, AnalysisFixture);
  await app.fire("recordButton", "click");
  const worklet = app.contexts[0].worklets[0];
  worklet.send({ type: "samples", samples: new Float32Array([0, .5, -.25, .75]) });
  await app.fire("recordButton", "click");
  worklet.send({ type: "done" });
  assert.equal(app.elements.get("recordResult").hidden, false);
  const count = app.elements.get("recordDownload").clickCount;
  app.fire("recordAnalyze", "click");
  assert.equal(app.elements.get("analysisWorkspace").hidden, false);
  assert.equal(app.elements.get("recordResult").hidden, true);
  assert.equal(app.elements.get("recordPreview").paused, true);
  assert.equal(app.elements.get("recordDownload").clickCount, count);
  assert.equal(handoffs.length, 1);
  assert.equal(handoffs[0].blob, app.objectUrls[0].blob);
  assert.equal(handoffs[0].name, app.elements.get("recordDownload").download);
  assert.equal(app.objectUrls.length, 1, "Analyze does not create another object URL");
});

test("A2a Compose Analyze reuses rendered WAV and switches modes without rerendering", async () => {
  const handoffs = [];
  class AnalysisFixture {
    setActive() {} renderLanguage() {} stop() {} isPlaying() { return false; } draw() {}
    openPrepared(blob, name) { handoffs.push({ blob, name }); return Promise.resolve(true); }
  }
  const app = fakePage("?lang=en", true, AnalysisFixture);
  app.fire("modeCompose", "click");
  assert.equal(app.elements.get("exportAnalyze").hidden, true);
  assert.equal(await app.fire("exportWav", "click"), true);
  assert.equal(app.elements.get("exportAnalyze").hidden, false);
  const downloads = app.elements.get("exportDownload").clickCount;
  const renders = app.exportRequests.length;
  app.fire("exportAnalyze", "click");
  assert.equal(app.elements.get("analysisWorkspace").hidden, false);
  assert.equal(handoffs.length, 1);
  assert.equal(handoffs[0].blob, app.objectUrls[0].blob);
  assert.equal(handoffs[0].name, app.elements.get("exportDownload").download);
  assert.equal(app.elements.get("exportDownload").clickCount, downloads);
  assert.equal(app.exportRequests.length, renders);
  assert.equal(app.contexts.length, 0, "Analyze does not start playback");
});

test("held flute plays only while pressed, and release follows the chosen decay", async () => {
  const app = fakePage();
  assert.equal(app.contexts.length, 0, "No audio until a deliberate gesture");
  app.fire("modeSustain", "click");
  assert.equal(app.elements.get("sustainWorkspace").hidden, false);
  assert.equal(app.elements.get("strikeWorkspace").hidden, true);
  assert.equal(app.elements.get("modeSustain").getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("sustainHoldButton").getAttribute("aria-pressed"), "false");

  // A normal pointer click after press/release must not restart hold mode.
  await app.fire("sustainHoldButton", "pointerdown", { pointerId: 11 });
  assert.equal(app.contexts.length, 1);
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].started, true);
  assert.equal(context.oscillators[0].type, "sine");
  assert.equal(context.shapers.length, 1);
  assert.equal(context.shapers[0].curve.length, 2049);
  assert.equal(context.shapers[0].oversample, "4x");
  assert.equal(context.filters[0].type, "highpass");
  assert.equal(context.filters[1].type, "lowpass");
  assert.equal(context.filters[2].type, "lowpass", "the third filter colors breath noise");
  assert.equal(context.sources.length, 1, "Gentle breath noise is generated locally");
  assert.equal(context.sources[0].loop, true);
  assert.equal(app.elements.get("sustainBreathValue").textContent, "60%");
  assert.equal(app.elements.get("sustainHoldButton").getAttribute("aria-pressed"), "true");
  app.tick(.08);
  app.fire("sustainHoldButton", "pointerup", { pointerId: 11 });
  assert.equal(app.elements.get("sustainHoldButton").getAttribute("aria-pressed"), "false");
  assert.equal(context.oscillators[0].stopped, true);
  assert.equal(context.sources[0].stopped, true);
  assert.match(app.elements.get("sustainStatus").textContent, /намдаж/);
  await app.fire("sustainHoldButton", "click", { detail: 1 });
  assert.equal(context.oscillators.length, 1, "Pointer-generated click is ignored after release");

  // Bowed instruments now use two phase-locked stick/slip source waves,
  // blended smoothly and passed through a separate body-filter chain.
  app.sustainButtons[1].events.click();
  assert.equal(app.elements.get("sustainBreathGroup").hidden, true);
  assert.equal(app.elements.get("sustainBowGroup").hidden, false);
  assert.match(app.elements.get("sustainDescription").textContent, /хурц/);
  assert.equal(app.elements.get("sustainAttackValue").textContent, "0.18 сек");
  await app.fire("sustainHoldButton", "pointerdown", { pointerId: 12 });
  assert.equal(context.oscillators.length, 3);
  assert.equal(context.periodicWaves.length, 2);
  assert.equal(context.periodicWaves[0].imag.length, sustainModel.BOW_PARTIALS + 1);
  assert.equal(context.periodicWaves[0].options.disableNormalization, true);
  assert.equal(context.filters[3].type, "peaking");
  assert.equal(context.filters[4].type, "peaking");
  assert.equal(context.filters[5].type, "lowpass");
  app.fire("stopAll", "click");
  assert.equal(app.elements.get("sustainHoldButton").getAttribute("aria-pressed"), "false");
  assert.equal(context.oscillators[1].stopped, true);
  assert.equal(context.oscillators[2].stopped, true);
});

test("bow pressure smoothly crossfades both bowed strings and keeps plots and language in sync", async () => {
  const app = fakePage();
  app.fire("modeSustain", "click");
  assert.equal(app.elements.get("sustainBowGroup").hidden, true, "flute has no bow control");
  app.sustainButtons[1].events.click();
  assert.equal(app.elements.get("sustainBowGroup").hidden, false);
  assert.equal(app.elements.get("sustainBowValue").textContent, "60%");
  assert.match(app.elements.get("sustainChallengeText").textContent, /нумын даралтыг/);
  await app.fire("sustainHoldButton", "pointerdown", { pointerId: 24 });
  const context = app.contexts[0];
  const weights = sustainModel.bowPressureWeights(60);
  const soft = context.gains.find(g => Math.abs(g.gain.value - weights.soft) < 1e-9).gain;
  const hard = context.gains.find(g => Math.abs(g.gain.value - weights.hard) < 1e-9).gain;
  const noise = context.gains.find(g =>
    Math.abs(g.gain.value - sustainModel.bowNoiseGain("violin", 60)) < 1e-9).gain;
  assert.equal(context.oscillators.length, 2);
  assert.equal(context.periodicWaves.length, 2);
  app.elements.get("sustainBowPressure").value = "100";
  app.fire("sustainBowPressure", "input");
  assert.equal(soft.value, 0);
  assert.ok(hard.value > weights.hard);
  assert.ok(noise.value > sustainModel.bowNoiseGain("violin", 60));
  assert.equal(app.elements.get("sustainBowValue").textContent, "100%");
  assert.equal(context.oscillators.length, 2, "the held note is not restarted when pressure changes");
  app.elements.get("sustainFrequencyInput").value = "330";
  app.fire("sustainFrequencyInput", "change");
  assert.equal(context.oscillators[0].frequency.value, 330);
  assert.equal(context.oscillators[1].frequency.value, 330);
  app.elements.get("sustainBowPressure").value = "0";
  app.fire("sustainBowPressure", "input");
  assert.equal(soft.value, 0);
  assert.equal(hard.value, 0);
  assert.equal(noise.value, 0);
  app.fire("langEn", "click");
  assert.match(app.elements.get("sustainDescription").textContent, /stick–slip/);
  assert.match(app.elements.get("sustainDetailHint").textContent, /body filters/);
  assert.match(app.elements.get("sustainChallengeText").textContent, /bow pressure/);
  app.elements.get("sustainInstrument").value = "morin";
  app.fire("sustainInstrument", "change");
  assert.equal(context.oscillators[0].stopped, true);
  assert.equal(context.oscillators[1].stopped, true);
  assert.equal(app.elements.get("sustainBowValue").textContent, "0%");
  await app.fire("sustainHoldButton", "pointerdown", { pointerId: 25 });
  assert.equal(context.oscillators.length, 4);
  assert.ok(context.filters.some(f => f.type === "peaking" && f.frequency.value === 310),
    "morin khuur has a distinct illustrative body response");
  app.fire("sustainReset", "click");
  assert.equal(app.elements.get("sustainBowGroup").hidden, true);
  assert.equal(app.elements.get("sustainBowValue").textContent, "60%");
  assert.ok(context.oscillators.every(osc => osc.stopped));
});

test("flute blowing strength alters the running jet smoothly and updates both plotted and spoken language", async () => {
  const app = fakePage();
  app.fire("modeSustain", "click");
  assert.equal(app.elements.get("sustainBreathGroup").hidden, false);
  assert.equal(app.elements.get("sustainBreathValue").textContent, "60%");
  assert.match(app.elements.get("sustainDetailHint").textContent, /агаарын баганын/);
  await app.fire("sustainHoldButton", "pointerdown", { pointerId: 22 });
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 1);
  const drive = context.gains.find(gain =>
    Math.abs(gain.gain.value - sustainModel.fluteDrive(60)) < 1e-8).gain;
  const original = drive.value;
  const noise = context.gains.find(gain =>
    Math.abs(gain.gain.value - sustainModel.fluteNoiseGain(60)) < 1e-8).gain;
  app.elements.get("sustainBreath").value = "100";
  app.fire("sustainBreath", "input");
  assert.ok(drive.value > original);
  assert.ok(noise.value > sustainModel.fluteNoiseGain(60));
  assert.equal(app.elements.get("sustainBreathValue").textContent, "100%");
  assert.equal(context.oscillators.length, 1, "no oscillator restart while moving the breath slider");
  app.elements.get("sustainBreath").value = "0";
  app.fire("sustainBreath", "input");
  assert.equal(drive.value, 0);
  assert.equal(noise.value, 0);
  app.fire("langEn", "click");
  assert.match(app.elements.get("sustainDescription").textContent, /air-jet/);
  assert.match(app.elements.get("sustainDetailHint").textContent, /air-column/);
  assert.equal(app.elements.get("sustainBreathValue").textContent, "0%");
  app.fire("sustainReset", "click");
  assert.equal(app.elements.get("sustainBreathValue").textContent, "60%");
  assert.equal(context.oscillators[0].stopped, true);
});

test("held note toggle, keyboard access, pitch snap, language and mode cleanup", async () => {
  const app = fakePage();
  app.fire("modeSustain", "click");
  assert.match(app.elements.get("sustainToggleButton").textContent, /Товшиж асаах/);
  await app.fire("sustainToggleButton", "click");
  const context = app.contexts[0];
  assert.equal(app.elements.get("sustainToggleButton").getAttribute("aria-pressed"), "true");
  assert.match(app.elements.get("sustainToggleButton").textContent, /^■ Товшиж асаах$/);
  app.elements.get("sustainFrequencyInput").value = "437";
  app.fire("sustainFrequencyInput", "change");
  assert.equal(context.oscillators[0].frequency.value, 437);
  app.elements.get("sustainSnap").checked = true;
  app.fire("sustainSnap", "change");
  assert.equal(context.oscillators[0].frequency.value, 440);
  app.elements.get("sustainVolume").value = "70";
  app.fire("sustainVolume", "input");
  assert.equal(app.elements.get("sustainVolumeValue").textContent, "70%");
  app.fire("langEn", "click");
  assert.match(app.elements.get("sustainToggleButton").textContent, /^■ Tap to toggle$/);
  assert.match(app.elements.get("sustainEnvelopeBadge").textContent, /s/);
  await app.fire("sustainToggleButton", "click");
  assert.equal(context.oscillators[0].stopped, true);

  await app.fire("sustainHoldButton", "keydown", { key: " " });
  assert.equal(context.oscillators.length, 2);
  assert.equal(app.elements.get("sustainHoldButton").getAttribute("aria-pressed"), "true");
  app.fire("sustainHoldButton", "keyup", { key: " " });
  assert.equal(context.oscillators[1].stopped, true);
  await new Promise(resolve => setTimeout(resolve, 0));
  await app.fire("sustainHoldButton", "click", { detail: 0 });
  assert.equal(context.oscillators.length, 3, "Assistive-technology click can toggle hold mode");
  app.fire("modeMotion", "click");
  assert.equal(context.oscillators[2].stopped, true);
  assert.equal(app.elements.get("sustainWorkspace").hidden, true);
  assert.equal(app.elements.get("modeMotion").getAttribute("aria-pressed"), "true");
});

test("quick lift cancels pending audio start; tab hide and blur silence held notes", async () => {
  const app = fakePage();
  app.fire("modeSustain", "click");
  const pending = app.fire("sustainHoldButton", "pointerdown", { pointerId: 5 });
  app.fire("sustainHoldButton", "pointercancel", { pointerId: 5 });
  await pending;
  assert.equal(app.contexts[0].oscillators.length, 0, "Released before resume; no late ghost note");

  await app.fire("sustainHoldButton", "pointerdown", { pointerId: 6 });
  assert.equal(app.contexts[0].oscillators.length, 1);
  app.window.events.blur();
  assert.equal(app.contexts[0].oscillators[0].stopped, true);
  assert.equal(app.elements.get("sustainHoldButton").getAttribute("aria-pressed"), "false");

  await app.fire("sustainToggleButton", "click");
  assert.equal(app.contexts[0].oscillators.length, 2);
  app.document.hidden = true;
  app.document.events.visibilitychange();
  assert.equal(app.contexts[0].oscillators[1].stopped, true);
  assert.equal(app.elements.get("sustainToggleButton").getAttribute("aria-pressed"), "false");
});

test("initialization is silent; Play, live Hz, note snap, shape and Stop work", async () => {
  const app = fakePage();
  assert.equal(app.document.documentElement.lang, "mn", "Mongolian is the default");
  assert.equal(app.elements.get("langMn").getAttribute("aria-pressed"), "true");
  assert.equal(app.contexts.length, 0, "No AudioContext before Play");
  assert.equal(app.elements.get("playButton").getAttribute("aria-pressed"), "false");
  await app.fire("playButton", "click");
  assert.equal(app.contexts.length, 1);
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].type, "sine");
  assert.equal(context.oscillators[0].started, true);
  assert.equal(app.elements.get("playButton").getAttribute("aria-pressed"), "true");

  app.elements.get("frequencyInput").value = "437";
  app.fire("frequencyInput", "change");
  assert.equal(context.oscillators[0].frequency.value, 437);
  assert.equal(app.elements.get("frequencyInput").value, "437");

  app.elements.get("snapCheck").checked = true;
  app.fire("snapCheck", "change");
  assert.equal(context.oscillators[0].frequency.value, 440);
  assert.equal(app.elements.get("frequencyInput").value, "440");

  app.waveButtons[2].events.click();
  assert.equal(context.oscillators.length, 2);
  assert.equal(context.oscillators[1].type, "square");
  app.fire("stopAll", "click");
  assert.equal(app.elements.get("playButton").getAttribute("aria-pressed"), "false");
  assert.equal(context.oscillators[1].stopped, true);
});

test("Record starts silently, captures generated sound, previews and downloads a valid WAV", async () => {
  const app = fakePage();
  assert.equal(app.elements.get("recordResult").hidden, true);
  assert.equal(app.elements.get("recordButton").getAttribute("aria-pressed"), "false");
  assert.equal(app.elements.get("recordButtonLabel").textContent, "REC");
  assert.equal(app.elements.get("recordSymbol").textContent, "●");
  assert.match(app.elements.get("recordButton").getAttribute("aria-label"), /30 сек/);
  assert.equal(app.elements.get("recordButton").title,
    app.elements.get("recordButton").getAttribute("aria-label"));
  assert.equal(app.contexts.length, 0);
  await app.fire("recordButton", "click");
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 0, "Recording alone must not start a tone");
  assert.deepEqual(context.addedModules, ["sound-recorder-worklet.js"]);
  assert.equal(context.worklets.length, 1);
  assert.equal(context.worklets[0].processorName, "sol-wav-capture");
  assert.equal(context.constantSources[0].started, true);
  assert.equal(app.elements.get("recordButton").getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("recordButtonLabel").textContent, "WAV");
  assert.equal(app.elements.get("recordSymbol").textContent, "⬇");
  assert.match(app.elements.get("recordButton").getAttribute("aria-label"), /хадгалах/);
  assert.match(app.elements.get("recordStatus").textContent, /Дуу бичиж байна/);

  await app.fire("playButton", "click");
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].started, true);
  app.tick(0.12);
  assert.equal(app.elements.get("recordTimer").textContent, "0.1/30");
  assert.equal(app.elements.get("recordTimer").hidden, false);
  const capture = context.worklets[0];
  capture.send({ type: "samples", samples: new Float32Array([0, 0.5, -0.5, 1]) });
  await app.fire("recordButton", "click");
  assert.deepEqual(capture.port.lastPosted, { type: "stop" });
  assert.equal(app.elements.get("recordButton").disabled, true);
  capture.send({ type: "done" });
  assert.equal(context.constantSources[0].stopped, true);
  assert.equal(capture.port.closed, true);
  assert.equal(app.objectUrls.length, 1);
  assert.equal(app.objectUrls[0].blob.type, "audio/wav");
  const bytes = new Uint8Array(await app.objectUrls[0].blob.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(bytes.subarray(8, 12)), "WAVE");
  assert.equal(new DataView(bytes.buffer).getUint32(24, true), 44100);
  assert.equal(new DataView(bytes.buffer).getInt16(46, true), 16384);
  assert.equal(app.elements.get("recordResult").hidden, false);
  assert.equal(app.elements.get("recordDownload").clickCount, 1, "Stop/Save starts a real download");
  assert.equal(app.elements.get("recordPreview").src, app.objectUrls[0].url);
  assert.equal(app.elements.get("recordDownload").href, app.objectUrls[0].url);
  assert.match(app.elements.get("recordDownload").download, /^sound-lab-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.wav$/);
  assert.equal(app.elements.get("recordButton").disabled, false);
  assert.equal(app.elements.get("recordButton").getAttribute("aria-pressed"), "false");
  assert.equal(app.elements.get("recordButtonLabel").textContent, "REC");
  assert.equal(app.elements.get("recordTimer").hidden, true);
  app.fire("recordDismiss", "click");
  assert.equal(app.elements.get("recordResult").hidden, true, "The preview closes without clearing saved audio");
  app.fire("stopAll", "click");
  assert.equal(context.oscillators[0].stopped, true);
});

test("recording continues across modes, Stop ends it, and new captures replace old URLs", async () => {
  const app = fakePage();
  await app.fire("recordButton", "click");
  const context = app.contexts[0];
  app.fire("modeStrike", "click");
  await app.guitarPlayButtons[0].click();
  assert.equal(context.sources.length, 1);
  assert.equal(context.worklets.length, 1);
  assert.equal(app.elements.get("recordButton").getAttribute("aria-pressed"), "true");
  context.worklets[0].send({ type: "samples", samples: new Float32Array([0.2]) });
  app.fire("stopAll", "click");
  assert.equal(context.sources[0].stopped, true);
  assert.deepEqual(context.worklets[0].port.lastPosted, { type: "stop" });
  context.worklets[0].send({ type: "done" });
  const previous = app.elements.get("recordDownload").href;
  assert.equal(app.elements.get("recordDownload").clickCount, 1, "Master Stop saves an active recording");

  app.fire("modeMotion", "click");
  app.motionButtons[1].events.click();
  await app.fire("recordButton", "click");
  assert.equal(context.addedModules.length, 1, "The worklet module loads only once");
  await app.fire("sirenButton", "click");
  assert.equal(context.oscillators.length, 1);
  context.worklets[1].send({ type: "samples", samples: new Float32Array([0.3, -0.3]) });
  app.window.events.pagehide();
  assert.equal(context.oscillators[0].stopped, true);
  context.worklets[1].send({ type: "done" });
  assert.equal(app.objectUrls.length, 2);
  assert.equal(app.elements.get("recordDownload").clickCount, 1, "Page hiding finalizes without starting a new download");
  assert.deepEqual(app.revokedUrls, [previous]);
  assert.notEqual(app.elements.get("recordDownload").href, previous);
  app.fire("langEn", "click");
  assert.equal(app.elements.get("recordButtonLabel").textContent, "REC");
  assert.match(app.elements.get("recordButton").getAttribute("aria-label"), /30 seconds/);
  assert.equal(app.elements.get("recordTimer").hidden, true);
});

test("pagehide during recording preparation cancels before worklet installation", async () => {
  const app = fakePage();
  const pending = app.fire("recordButton", "click");
  app.window.events.pagehide();
  await pending;
  assert.equal(app.contexts[0].worklets.length, 0);
  assert.equal(app.elements.get("recordButton").getAttribute("aria-pressed"), "false");
  assert.equal(app.elements.get("recordResult").hidden, true);
});

test("the 30-second limit automatically downloads, and unsupported browsers show a visible error", async () => {
  const app = fakePage();
  await app.fire("recordButton", "click");
  const context = app.contexts[0];
  app.tick(16);
  assert.equal(app.elements.get("recordButton").getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("recordTimer").textContent, "16.0/30");
  assert.equal(app.elements.get("recordResult").hidden, true);
  context.worklets[0].send({ type: "samples", samples: new Float32Array(44100 * 30) });
  context.worklets[0].send({ type: "done" });
  assert.equal(app.elements.get("recordResult").hidden, false);
  assert.equal(app.elements.get("recordDownload").clickCount, 1);
  assert.equal(app.objectUrls[0].blob.size, 44 + 44100 * 30 * 2);
  const bytes = new Uint8Array(await app.objectUrls[0].blob.arrayBuffer());
  assert.equal(new DataView(bytes.buffer).getUint32(40, true), 44100 * 30 * 2);
  assert.equal(app.elements.get("recordButton").getAttribute("aria-pressed"), "false");

  const unsupported = fakePage("", false);
  await unsupported.fire("recordButton", "click");
  assert.equal(unsupported.elements.get("recordButton").disabled, false);
  assert.match(unsupported.elements.get("recordStatus").textContent, /боломжгүй/);
  assert.equal(unsupported.elements.get("recordStatus").classList.contains("error"), true);
  assert.equal(unsupported.elements.get("recordStatus").classList.contains("sr-only"), false);
  assert.equal(unsupported.elements.get("recordResult").hidden, true);
});

test("fixed time view shows changing cycle counts; four-period zoom is optional", () => {
  const app = fakePage();
  assert.equal(app.elements.get("fixedTimeCheck").checked, true);
  assert.equal(app.elements.get("windowLabel").textContent, "0–20 мсек · 8.8 үе");
  app.elements.get("frequencyInput").value = "880";
  app.fire("frequencyInput", "change");
  assert.equal(app.elements.get("windowLabel").textContent, "0–20 мсек · 17.6 үе");
  assert.match(app.elements.get("waveSubtitle").textContent, /20 мсек/);
  app.elements.get("fixedTimeCheck").checked = false;
  app.fire("fixedTimeCheck", "change");
  assert.equal(app.elements.get("windowLabel").textContent, "0–4.55 мсек · 4 үе");
  assert.match(app.elements.get("waveSubtitle").textContent, /Дөрвөн үе/);
  app.fire("resetButton", "click");
  assert.equal(app.elements.get("fixedTimeCheck").checked, true);
  assert.equal(app.elements.get("windowLabel").textContent, "0–20 мсек · 8.8 үе");
});

test("language, volume, reset and hiding the page cannot trigger autoplay", async () => {
  const app = fakePage();
  app.fire("langEn", "click");
  assert.equal(app.document.documentElement.lang, "en");
  app.fire("langMn", "click");
  assert.equal(app.document.documentElement.lang, "mn");
  assert.equal(app.contexts.length, 0);
  app.elements.get("volumeSlider").value = "20";
  app.fire("volumeSlider", "input");
  assert.equal(app.elements.get("volumeReadout").textContent, "20%");
  await app.fire("playButton", "click");
  app.document.hidden = true;
  app.document.events.visibilitychange();
  assert.equal(app.elements.get("playButton").getAttribute("aria-pressed"), "false");
  app.fire("resetButton", "click");
  assert.equal(app.elements.get("frequencyInput").value, "440");
  assert.equal(app.elements.get("volumeReadout").textContent, "40%");
});

test("pure tones gain extra headroom without autoplay or exceeding the bounded peak", async () => {
  const app = fakePage();
  assert.equal(app.contexts.length, 0);
  await app.fire("playButton", "click");
  const context = app.contexts[0];
  assert.equal(context.gains.at(-1).gain.value, 0.12, "Default 40% produces 0.12 amplitude");
  app.elements.get("volumeSlider").value = "100";
  app.fire("volumeSlider", "input");
  assert.equal(context.gains.at(-1).gain.value, 0.3);
  app.fire("stopAll", "click");
  assert.equal(context.oscillators[0].stopped, true);
});

test("an explicit English URL overrides the Mongolian default", () => {
  const app = fakePage("?lang=en");
  assert.equal(app.document.documentElement.lang, "en");
  assert.equal(app.elements.get("windowLabel").textContent, "0–20 ms · 8.8 cycles");
});

test("Mongolian units cover static ranges, readouts and plotted axes; English remains unchanged", () => {
  const app = fakePage();
  assert.equal(app.hzLabels.length, 6);
  assert.equal(app.elements.get("strikePitchMin").textContent, "110 Гц",
    "The lower range is now instrument-dependent, like the upper range");
  assert.equal(app.elements.get("strikePitchMax").textContent, "880 Гц",
    "The eighth range label is instrument-dependent rather than static");
  assert.ok(app.hzLabels.every(label => label.textContent.endsWith(" Гц")));
  assert.equal(app.elements.get("frequencyInput").getAttribute("aria-valuetext"), "440 Гц");
  assert.equal(app.elements.get("fundamentalBadge").textContent, "f₀ = 440 Гц");
  assert.match(app.elements.get("noteLabel").title, /440 Гц$/);
  assert.match(app.elements.get("periodBadge").textContent, /мсек$/);
  assert.ok(app.elements.get("spectrumCanvas").drawnText.some(label => label.endsWith(" кГц")));
  assert.ok(app.elements.get("waveCanvas").drawnText.some(label => label.endsWith(" мсек")));
  app.fire("modeStrike", "click");
  assert.equal(app.elements.get("strikeDecayValue").textContent, "0.65 сек");
  assert.ok(app.elements.get("strikeSpectrumCanvas").drawnText.some(label => label.endsWith(" Гц")));
  app.fire("modeMotion", "click");
  assert.equal(app.elements.get("motionCurrentHz").textContent, "440 Гц");
  assert.ok(app.elements.get("motionPitchCanvas").drawnText.some(label => label.endsWith(" сек")));
  assert.ok(app.elements.get("motionSpectrumCanvas").drawnText.some(label => label.endsWith(" Гц")));
  app.motionButtons[1].events.click();
  assert.equal(app.elements.get("sirenRateValue").textContent, "0.8 удаа/сек");
  app.sirenPatternButtons[1].events.click();
  assert.match(app.elements.get("motionPitchSubtitle").textContent, /Синусоид замнал/);
  app.sirenPatternButtons[2].events.click();
  assert.match(app.elements.get("motionPitchSubtitle").textContent, /Логарифм графикт шулуун/);
  app.fire("langEn", "click");
  assert.ok(app.hzLabels.every(label => label.textContent.endsWith(" Hz")));
  assert.equal(app.elements.get("strikePitchMax").textContent, "880 Hz");
  assert.equal(app.elements.get("sirenRateValue").textContent, "0.8 /s");
  assert.match(app.elements.get("motionPitchSubtitle").textContent, /semitones per second/);
  app.sirenPatternButtons[1].events.click();
  assert.match(app.elements.get("motionPitchSubtitle").textContent, /Sinusoidal in Hz/);
  assert.equal(app.elements.get("motionPitchBadge").textContent, "440 Hz");
  assert.equal(app.elements.get("strikeDecayValue").textContent, "0.65 s");
});

test("revised Mongolian wave descriptions, examples and mode labels render correctly", () => {
  const app = fakePage();
  assert.equal(app.elements.has("pagePhase"), false);
  assert.equal(app.elements.get("challengeText").textContent, "Давтамжийг хоёр дахин өсгө. Дууны өнгө болон үе хэрхэн өөрчлөгдөж байна вэ?");
  app.waveButtons[1].events.click();
  assert.equal(app.elements.get("soundDescription").textContent, "Дээд сондгой гармоникууд нь сул.");
  assert.match(app.elements.get("challengeText").textContent, /дөрвөлжин/);
  app.waveButtons[2].events.click();
  assert.equal(app.elements.get("soundDescription").textContent, "Сондгой гармоникууд нь хүчтэй.");
  app.waveButtons[3].events.click();
  assert.equal(app.elements.get("soundDescription").textContent, "Олон гармониктой, баялаг өнгөтэй.");
  app.fire("modeStrike", "click");
  assert.equal(app.elements.get("modeStrike").getAttribute("aria-pressed"), "true");
  app.fire("langEn", "click");
  assert.equal(app.document.documentElement.lang, "en");
});

test("Strike & Pluck begins silently, triggers modeled buffers and bounds simultaneous voices", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  assert.equal(app.elements.get("pureWorkspace").hidden, true);
  assert.equal(app.elements.get("strikeWorkspace").hidden, false);
  assert.equal(app.contexts.length, 0, "Changing category does not initialize audio");

  await app.guitarPlayButtons[0].click();
  assert.equal(app.contexts.length, 1);
  const context = app.contexts[0];
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].started, true);
  assert.ok(Math.abs(context.gains.at(-1).gain.value - 0.1155) < 1e-10);
  assert.ok(context.buffers[0].length > 10000);
  assert.ok(context.buffers[0].getChannelData(0).some(x => Math.abs(x) > 0.05));

  app.elements.get("strikeStrength").value = "100";
  app.fire("strikeStrength", "input");
  await app.guitarPlayButtons[0].click();
  assert.equal(context.gains.at(-1).gain.value, 0.21, "Max impact keeps per-voice amplitude bounded");

  app.strikeButtons[1].events.click();
  assert.equal(app.elements.get("strikePitchGroup").hidden, true, "Kick has no fake musical note control");
  app.drumViewButtons[1].click();
  await app.fire("strikeButton", "click");
  assert.equal(context.sources[0].stopped, true, "Switching recipes stops the old sound");
  for (let n = 0; n < 5; n++) await app.fire("strikeButton", "click");
  assert.ok(context.sources.filter(x => !x.stopped).length <= 4);
  assert.ok(context.sources.filter(x => !x.stopped).length * 0.21 < 1);
  app.fire("stopAll", "click");
  assert.ok(context.sources.every(x => x.stopped), "Master Stop silences all transient voices");

  app.fire("modePure", "click");
  await app.fire("playButton", "click");
  assert.equal(app.contexts.length, 1, "Both categories share one AudioContext");
  app.fire("stopAll", "click");
});

test("transient controls change modeled decay and category changes cancel pending starts", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  app.elements.get("strikeDecay").value = "1.1";
  app.fire("strikeDecay", "input");
  assert.equal(app.elements.get("strikeDurationBadge").textContent, "τ = 1.1 сек");
  assert.equal(app.elements.get("strikeWindowLabel").textContent, "0 мсек – 3 сек");
  app.elements.get("strikeFrequencyInput").value = "440";
  app.fire("strikeFrequencyInput", "change");
  assert.equal(app.elements.get("strikeNote").textContent, "A4 · Ля4");
  const pending = app.guitarPlayButtons[0].click();
  app.fire("modePure", "click");
  await pending;
  assert.equal(app.contexts[0].sources.length, 0, "No delayed sound after changing category");
  app.fire("modeStrike", "click");
  app.fire("strikeReset", "click");
  assert.equal(app.elements.get("strikeFrequencyInput").value, "220");
  assert.equal(app.elements.get("strikeDecayValue").textContent, "0.65 сек");
});

test("string snap and small/medium/large drum pads play immediately and repeat", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  app.elements.get("strikeFrequencyInput").value = "437";
  app.fire("strikeFrequencyInput", "change");
  assert.equal(app.elements.get("strikeFrequencyInput").value, "437");
  app.elements.get("strikeSnap").checked = true;
  app.fire("strikeSnap", "change");
  assert.equal(app.elements.get("strikeFrequencyInput").value, "440");
  assert.equal(app.elements.get("strikeNote").textContent, "A4 · Ля4");
  app.strikeButtons[1].events.click();
  assert.equal(app.elements.get("strikePitchGroup").hidden, true);
  assert.equal(app.elements.get("strikeDrumSizeGroup").hidden, false);
  app.drumViewButtons[1].click();
  await app.drumButtons[0].click();
  assert.equal(app.drumButtons[0].getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("strikeDrumFrequencies").textContent, "81 Гц");
  const context = app.contexts[0];
  assert.equal(context.sources.length, 1, "Choosing Large also strikes the drum");
  await app.drumButtons[0].click();
  assert.equal(context.sources.length, 2, "Tapping the same pad produces a second attack");
  assert.equal(context.buffers.length, 1, "Repeated hits reuse synthesized drum samples");
  assert.equal(context.sources[0].stopped, false, "The first hit continues ringing");
  assert.equal(context.sources[0].buffer, context.sources[1].buffer);
  await app.drumButtons[2].click();
  assert.equal(app.elements.get("strikeDrumFrequencies").textContent, "157 Гц");
  assert.equal(context.sources.length, 3, "Choosing Small strikes it immediately");
  assert.equal(context.sources[0].stopped, false);
  await app.fire("strikeButton", "click");
  const first = app.contexts[0].buffers[0].getChannelData(0);
  const second = app.contexts[0].buffers[1].getChannelData(0);
  assert.notEqual(first[400], second[400], "Drum size changes actual audio samples");
});

test("guitar pluck, strum and chord pads always retrigger without stopping earlier attacks", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  assert.equal(app.elements.get("strikeGuitarPlayModes").hidden, false);
  assert.equal(app.elements.get("strikeChordGroup").hidden, false);
  assert.equal(app.contexts.length, 0, "Opening guitar is silent");
  await app.guitarPlayButtons[1].click();
  assert.equal(app.contexts.length, 1, "The Strum button both chooses and plays the gesture");
  assert.equal(app.elements.get("strikePitchGroup").hidden, true);
  assert.equal(app.elements.get("strikeChordGroup").hidden, false);
  assert.equal(app.guitarPlayButtons[1].getAttribute("aria-pressed"), undefined,
    "Momentary trigger buttons must not claim a persistent pressed state");
  assert.match(app.guitarPlayButtons[1].textContent, /^▶/);
  const em = app.contexts[0].buffers[0].getChannelData(0);
  assert.ok(em.some(value => Math.abs(value) > .02));
  await app.guitarPlayButtons[1].click();
  const context = app.contexts[0];
  assert.equal(context.sources.length, 2, "Tapping Strum again launches another stroke");
  assert.equal(context.sources[0].stopped, false);
  assert.equal(context.buffers.length, 1, "Repeating a chord reuses its audio buffer");
  await app.guitarChordButtons[1].click();
  assert.equal(context.sources.length, 3, "G chord pad itself starts a strum");
  assert.equal(app.guitarChordButtons[1].getAttribute("aria-pressed"), "true");
  const g = app.contexts[0].buffers[1].getChannelData(0);
  assert.notEqual(em[3000], g[3000], "Different fret patterns produce different audio");
  await app.guitarChordButtons[1].click();
  assert.equal(context.sources.length, 4);
  assert.equal(context.buffers.length, 2, "G pad repeated without resynthesizing its notes");
  assert.equal(context.sources[2].stopped, false);
  await app.guitarPlayButtons[0].click();
  assert.equal(context.sources.length, 5);
  assert.equal(context.sources[0].stopped, true, "Oldest active voice is evicted at the four-voice limit");
  assert.equal(context.sources[3].stopped, false, "Newest chord keeps ringing");
  assert.equal(app.elements.get("strikePitchGroup").hidden, false);
  assert.equal(app.elements.get("strikeChordGroup").hidden, false,
    "Chord rhythm pads remain accessible when Pluck is selected");
  app.elements.get("strikePluckPosition").value = "48";
  app.fire("strikePluckPosition", "input");
  assert.equal(app.elements.get("strikePluckPositionValue").textContent, "48%");
  await app.guitarPlayButtons[0].click();
  assert.equal(context.sources.length, 6);
  assert.equal(app.elements.get("strikePitchGroup").hidden, false);
  app.strikeButtons[1].click();
  assert.equal(app.elements.get("strikeGuitarPlayModes").hidden, true);
  app.drumViewButtons[1].click();
  app.elements.get("strikeDrumTension").value = "200";
  app.fire("strikeDrumTension", "input");
  assert.equal(app.elements.get("strikeDrumTensionValue").textContent, "200%");
  assert.equal(app.elements.get("strikeDrumFrequencies").textContent, "158 Гц");
});

test("rapid pending chord and drum pad taps capture the intended sound recipes", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  const emPending = app.guitarChordButtons[0].click();
  const cPending = app.guitarChordButtons[2].click();
  await Promise.all([emPending, cPending]);
  const context = app.contexts[0];
  assert.equal(context.sources.length, 2, "Both quick chord taps are audible");
  assert.equal(context.buffers.length, 2, "Each pending tap used its own selected chord recipe");
  const em = context.sources[0].buffer.getChannelData(0);
  const c = context.sources[1].buffer.getChannelData(0);
  assert.notEqual(em[3000], c[3000]);
  assert.equal(context.sources[0].stopped, false);
  assert.equal(context.sources[1].stopped, false);

  app.strikeButtons[1].click();
  app.drumViewButtons[1].click();
  const largePending = app.drumButtons[0].click();
  const smallPending = app.drumButtons[2].click();
  await Promise.all([largePending, smallPending]);
  assert.equal(context.sources.length, 4);
  assert.notEqual(context.sources[2].buffer.getChannelData(0)[400],
    context.sources[3].buffer.getChannelData(0)[400]);
  assert.equal(context.sources[2].stopped, false);
  assert.equal(context.sources[3].stopped, false);
  app.fire("strikeWaveCanvas", "click", { offsetX: 250 });
  assert.equal(context.sources[3].stopped, false, "Manual waveform inspection changes cursor only");
  await app.drumButtons[2].click();
  assert.equal(context.sources.length, 5, "The same size can be hit again straight away");
  assert.equal(context.sources[3].buffer, context.sources[4].buffer);
});

test("one transient waveform supports zoom, pan, presets and time scrubbing", () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  assert.equal(app.elements.get("strikeWindowLabel").textContent, "0 мсек – 3 сек");
  app.elements.get("strikeViewPreset").value = "0.02";
  app.fire("strikeViewPreset", "change");
  assert.equal(app.elements.get("strikeWindowLabel").textContent, "0 мсек – 20 мсек");
  app.fire("strikeViewZoomOut", "click");
  assert.equal(app.elements.get("strikeWindowLabel").textContent, "0 мсек – 40 мсек");
  app.fire("strikeViewRight", "click");
  assert.equal(app.elements.get("strikeWindowLabel").textContent, "20 мсек – 60 мсек");
  app.fire("strikeViewFit", "click");
  assert.equal(app.elements.get("strikeWindowLabel").textContent, "0 мсек – 3 сек");
  app.elements.get("strikeTimeSlider").value = "1500";
  app.fire("strikeTimeSlider", "input");
  assert.equal(app.elements.get("strikeTimeValue").textContent, "t = 1.50 сек");
  assert.equal(app.analyzedAt.at(-1), 1.5);
  app.spectrumButtons[1].events.click();
  assert.equal(app.spectrumButtons[1].getAttribute("aria-pressed"), "true");
  assert.match(app.elements.get("strikeSpectrumHint").textContent, /дундаж/);
});

test("Hit follows Web Audio playback time, then allows manual passive inspection", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  assert.equal(app.contexts.length, 0);
  await app.guitarPlayButtons[0].click();
  assert.equal(app.elements.get("strikeTimeValue").textContent, "t = 0.00 сек");
  app.tick(0.08);
  assert.equal(app.elements.get("strikeTimeValue").textContent, "t = 0.08 сек");
  assert.ok(app.analyzedAt.at(-1) >= 0.08 - 1e-9);
  app.tick(0.15);
  assert.equal(app.elements.get("strikeTimeValue").textContent, "t = 0.23 сек");
  app.elements.get("strikeTimeSlider").value = "450";
  app.fire("strikeTimeSlider", "input");
  assert.equal(app.analyzedAt.at(-1), 0.45);
  app.tick(0.3);
  assert.equal(app.elements.get("strikeTimeValue").textContent, "t = 0.45 сек", "Manual scrub overrides visual follow");
  await app.guitarPlayButtons[0].click();
  await app.guitarPlayButtons[0].click();
  assert.equal(app.elements.get("strikeTimeValue").textContent, "t = 0.00 сек", "New hit restarts follow");
  app.tick(0.10);
  app.fire("stopAll", "click");
  const stoppedAt = app.elements.get("strikeTimeValue").textContent;
  app.tick(0.1);
  assert.equal(app.elements.get("strikeTimeValue").textContent, stoppedAt);
});

test("Moving Pitch theremin uses a pointer gesture, shared audio, live pitch and release-to-stop", async () => {
  const app = fakePage();
  app.fire("modeMotion", "click");
  assert.equal(app.elements.get("pureWorkspace").hidden, true);
  assert.equal(app.elements.get("motionWorkspace").hidden, false);
  assert.match(app.elements.get("motionStatus").textContent, /^Бэлэн\./,
    "A newly opened sound category must say Ready, not Stopped");
  assert.equal(app.contexts.length, 0, "Mode switching remains silent");
  await app.fire("thereminPad", "pointerdown", { clientX: 355, clientY: 105 });
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].started, true);
  assert.equal(app.elements.get("thereminPad").getAttribute("aria-pressed"), "true");
  assert.match(app.elements.get("motionStatus").textContent, /Гараа авах/);
  const firstHz = context.oscillators[0].frequency.value;
  app.fire("thereminPad", "pointermove", { clientX: 600, clientY: 15 });
  assert.ok(context.oscillators[0].frequency.value > firstHz);
  assert.ok(context.gains.at(-1).gain.value > 0);
  assert.ok(context.gains.at(-1).gain.value <= 0.24);
  app.tick(0.05);
  assert.match(app.elements.get("motionPitchBadge").textContent, /Гц/);
  app.fire("thereminPad", "pointerup", { clientX: 600, clientY: 15 });
  assert.equal(context.oscillators[0].stopped, true);
  assert.equal(app.elements.get("thereminPad").getAttribute("aria-pressed"), "false");
});

test("theremin keyboard arrows change pitch; Space toggles and Escape safely stops", async () => {
  const app = fakePage();
  app.fire("modeMotion", "click");
  const before = parseFloat(app.elements.get("motionCurrentHz").textContent);
  app.fire("thereminPad", "keydown", { key: "ArrowRight" });
  assert.ok(parseFloat(app.elements.get("motionCurrentHz").textContent) > before);
  await app.fire("thereminPad", "keydown", { key: " " });
  assert.equal(app.contexts[0].oscillators[0].started, true);
  app.fire("thereminPad", "keydown", { key: "Escape" });
  assert.equal(app.contexts[0].oscillators[0].stopped, true);
});

test("theremin timbres are silent presets that crossfade when sounding and update harmonic plots", async () => {
  const app = fakePage();
  app.fire("modeMotion", "click");
  assert.equal(app.timbreButtons.length, 4);
  assert.equal(app.timbreButtons[0].getAttribute("aria-pressed"), "true");
  app.timbreButtons[2].events.click();
  assert.equal(app.contexts.length, 0, "Changing timbre does not autoplay");
  assert.equal(app.timbreButtons[2].getAttribute("aria-pressed"), "true");
  assert.equal(app.timbreButtons[0].getAttribute("aria-pressed"), "false");
  assert.ok(app.elements.get("motionSpectrumCanvas").drawnText.includes("4f₀"));
  assert.equal(app.elements.get("thereminVowelGroup").hidden, false);
  assert.equal(app.elements.get("thereminOvertoneGroup").hidden, true);

  await app.fire("thereminPad", "keydown", { key: " " });
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.periodicWaves.length, 1);
  assert.equal(context.oscillators[0].periodicWave.imag[3], Math.fround(Math.pow(3, -1.2)));
  assert.equal(context.filters.length, 4, "Three vocal formants and one lowpass filter");
  assert.equal(context.filters[0].type, "peaking");
  assert.equal(context.filters[0].frequency.value, 750);

  app.timbreButtons[1].events.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.oscillators.length, 2, "New color crossfades into a new oscillator");
  assert.equal(context.oscillators[0].stopped, true);
  assert.equal(context.oscillators[1].periodicWave.imag[2], Math.fround(.60));
  assert.equal(context.oscillators[1].frequency.value, 440);
  app.timbreButtons[0].events.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.oscillators.length, 3);
  assert.equal(context.oscillators[1].stopped, true);
  assert.equal(context.oscillators[2].type, "sine");
  assert.equal(app.elements.get("thereminPad").getAttribute("aria-pressed"), "true");
  app.fire("stopAll", "click");
  assert.ok(context.oscillators.every(osc => osc.stopped));

  app.fire("motionReset", "click");
  assert.equal(app.timbreButtons[0].getAttribute("aria-pressed"), "true");
  app.fire("langEn", "click");
  assert.equal(app.elements.get("thereminTimbres").getAttribute("aria-label"), "Theremin timbre options");
});

test("vowel and overtone controls stay silent until played and shape the same source live", async () => {
  const app = fakePage();
  app.fire("modeMotion", "click");
  app.timbreButtons[2].events.click();
  app.vowelButtons[2].events.click(); // И
  assert.equal(app.contexts.length, 0);
  assert.equal(app.vowelButtons[2].getAttribute("aria-pressed"), "true");
  await app.fire("thereminPad", "keydown", { key: " " });
  const context = app.contexts[0];
  const firstOsc = context.oscillators[0];
  assert.equal(context.filters[0].frequency.value, 310);
  app.vowelButtons[4].events.click(); // У: formants change, no new oscillator
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.filters[0].frequency.value, 340);
  assert.equal(context.filters[1].frequency.value, 810);
  app.fire("thereminPad", "keydown", { key: "ArrowLeft" });
  assert.equal(context.filters[0].frequency.value, 340, "Formant Hz remains fixed when pitch changes");
  assert.ok(firstOsc.frequency.value < 440);

  app.timbreButtons[3].events.click(); // One glottal-like source, focus filter
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(firstOsc.stopped, true);
  assert.equal(app.elements.get("thereminVowelGroup").hidden, true);
  assert.equal(app.elements.get("thereminOvertoneGroup").hidden, false);
  assert.equal(context.oscillators.length, 2);
  assert.equal(context.filters.length, 6, "Overtone model adds one peaking and one lowpass filter");
  const focusFilter = context.filters[4];
  assert.equal(focusFilter.type, "peaking");
  const hz = context.oscillators[1].frequency.value;
  assert.ok(Math.abs(focusFilter.frequency.value - 6 * hz) < 1e-7);
  app.elements.get("thereminHarmonic").value = "9";
  app.fire("thereminHarmonic", "input");
  assert.equal(context.oscillators.length, 2, "Selecting a harmonic does not start a second voice");
  assert.ok(Math.abs(focusFilter.frequency.value - 9 * hz) < 1e-7);
  assert.match(app.elements.get("thereminHarmonicValue").textContent, /^9f₀ = /);
  app.fire("thereminPad", "keydown", { key: "ArrowRight" });
  assert.ok(Math.abs(focusFilter.frequency.value - 9 * context.oscillators[1].frequency.value) < 1e-7);
  app.fire("stopAll", "click");
  assert.ok(context.oscillators.every(osc => osc.stopped));
  assert.ok(context.filters.every(filter => filter.disconnected));
  app.fire("motionReset", "click");
  assert.equal(app.elements.get("thereminVowelGroup").hidden, true);
  assert.equal(app.elements.get("thereminOvertoneGroup").hidden, true);
  assert.equal(app.elements.get("thereminHarmonic").value, "6");
  assert.equal(app.vowelButtons[0].getAttribute("aria-pressed"), "true");
  app.fire("langEn", "click");
  assert.equal(app.elements.get("thereminVowels").getAttribute("aria-label"), "Vowel resonance selection");
});

test("siren changes two-tone/sweep pitch with its clock; Stop and mode switch cancel sound", async () => {
  const app = fakePage();
  app.fire("modeMotion", "click");
  app.motionButtons[1].events.click();
  assert.equal(app.elements.get("thereminControls").hidden, true);
  assert.equal(app.elements.get("sirenControls").hidden, false);
  app.elements.get("sirenHigh").value = "1000";
  app.fire("sirenHigh", "input");
  assert.equal(app.elements.get("sirenHighValue").textContent, "1,000 Гц");
  await app.fire("sirenButton", "click");
  const context = app.contexts[0];
  assert.equal(context.gains.at(-1).gain.value, 0.096, "Default siren level is louder but capped");
  assert.match(app.elements.get("motionStatus").textContent, /Дохио зогсоох/);
  assert.doesNotMatch(app.elements.get("motionStatus").textContent, /Гараа авах/);
  assert.equal(context.oscillators[0].frequency.value, 440);
  app.tick(0.7); // 0.8 cycles/s: after half a cycle, the high tone sounds.
  assert.equal(context.oscillators[0].frequency.value, 1000);
  app.sirenPatternButtons[1].events.click();
  app.tick(0.1);
  assert.ok(context.oscillators[0].frequency.value > 440);
  assert.ok(context.oscillators[0].frequency.value < 1000);
  app.fire("stopAll", "click");
  assert.equal(context.oscillators[0].stopped, true);
  assert.equal(app.elements.get("sirenButton").getAttribute("aria-pressed"), "false");
  await app.fire("sirenButton", "click");
  app.fire("modePure", "click");
  assert.equal(context.oscillators[1].stopped, true);
  assert.equal(app.elements.get("motionWorkspace").hidden, true);
});

test("Siren Stop cancels a Safari-style delayed start and mutes even if onended is delayed", async () => {
  const app = fakePage();
  app.fire("modeMotion", "click");
  app.motionButtons[1].events.click();

  let releaseResume;
  const resumeGate = new Promise(resolve => { releaseResume = resolve; });
  const BaseAudioContext = app.window.AudioContext;
  app.window.AudioContext = class DelayedAudioContext extends BaseAudioContext {
    async resume() {
      await resumeGate;
      return super.resume();
    }
  };

  // The second tap must be Stop, even before an asynchronous Safari resume finishes.
  const pending = app.fire("sirenButton", "click");
  assert.equal(app.contexts.length, 1);
  assert.equal(app.elements.get("sirenButton").getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("sirenPlayIcon").textContent, "■");
  assert.match(app.elements.get("sirenPlayLabel").textContent, /зогсоох/);
  app.fire("sirenButton", "click");
  assert.equal(app.elements.get("sirenButton").getAttribute("aria-pressed"), "false");
  releaseResume();
  await pending;
  assert.equal(app.contexts[0].oscillators.length, 0, "Cancelled resume cannot start a ghost siren");

  await app.fire("sirenButton", "click");
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 1);
  const voice = context.oscillators[0];
  const gain = context.gains.at(-1).gain;
  const rampCalls = [];
  const ramp = gain.linearRampToValueAtTime;
  gain.linearRampToValueAtTime = function (value, time) {
    rampCalls.push({ value, time });
    return ramp.call(this, value, time);
  };
  // On some engines onended can arrive late. Audio must be muted independently.
  voice.stop = time => { voice.scheduledStop = time; };
  app.fire("sirenButton", "click");
  assert.equal(app.elements.get("sirenButton").getAttribute("aria-pressed"), "false");
  assert.equal(gain.value, 0);
  assert.deepEqual(rampCalls, [{ value: 0, time: 0.004 }]);
  assert.equal(voice.scheduledStop, 0.012);
  assert.equal(app.animationFrames.size, 0, "Stopped siren has no queued animation frame");

  await app.fire("sirenButton", "click");
  assert.equal(context.oscillators.length, 2, "Siren can restart after a cancelled start and stop");
  app.fire("sirenButton", "click");
  assert.equal(context.gains.at(-1).gain.value, 0);
});

test("three siren trajectories change both the ideal readout and the playing oscillator without restarting audio", async () => {
  const app = fakePage();
  app.fire("modeMotion", "click");
  app.motionButtons[1].events.click();
  const patterns = motionModel.PATTERNS;
  assert.equal(app.sirenPatternButtons.length, 3);
  for (let i = 0; i < patterns.length; i++) {
    app.sirenPatternButtons[i].events.click();
    assert.equal(app.sirenPatternButtons[i].getAttribute("aria-pressed"), "true");
    for (let j = 0; j < patterns.length; j++) {
      if (j !== i) assert.equal(app.sirenPatternButtons[j].getAttribute("aria-pressed"), "false");
    }
  }
  assert.equal(app.contexts.length, 0, "Changing trajectory must not start sound");

  app.sirenPatternButtons[0].events.click();
  await app.fire("sirenButton", "click");
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 1);
  app.tick(0.15625); // 0.8 repetitions/s puts us one eighth of a cycle in.
  const observed = [];
  for (let i = 0; i < patterns.length; i++) {
    app.sirenPatternButtons[i].events.click();
    const expected = motionModel.sirenHzAt(0.15625, {
      pattern: patterns[i], lowHz: 440, highHz: 880, rate: 0.8
    });
    const actual = context.oscillators[0].frequency.value;
    assert.ok(Math.abs(actual - expected) < 1e-9, `${patterns[i]}: ${actual} != ${expected}`);
    assert.equal(app.elements.get("motionPitchBadge").textContent, `${Number(expected.toFixed(2)).toLocaleString("en-US")} Гц`);
    observed.push(actual);
  }
  assert.equal(new Set(observed.map(Math.round)).size, 3, "All three paths give distinct mid-sweep pitches");
  assert.equal(context.oscillators.length, 1, "Live switching reuses the same oscillator");
  app.fire("stopAll", "click");
  assert.equal(context.oscillators[0].stopped, true);
});

test("pending siren start does not produce an orphan voice after leaving Moving Pitch", async () => {
  const app = fakePage();
  app.fire("modeMotion", "click");
  app.motionButtons[1].events.click();
  const pending = app.fire("sirenButton", "click");
  app.fire("modeStrike", "click");
  await pending;
  assert.equal(app.contexts[0].oscillators.length, 0);
});

test("Combine Waves is silent until Play and begins with 440 + 444 Hz in one shared audio context", async () => {
  const app = fakePage();
  app.fire("modeMix", "click");
  assert.equal(app.contexts.length, 0);
  assert.equal(app.elements.get("pureWorkspace").hidden, true);
  assert.equal(app.elements.get("mixWorkspace").hidden, false);
  assert.equal(app.elements.get("mixChallenge").hidden, false);
  assert.equal(app.elements.get("mixExplanation").hidden, false);
  assert.equal(app.elements.get("mixPairValue").textContent, "440 + 444 Гц");
  assert.equal(app.elements.get("mixBeatValue").textContent, "4 удаа/сек");
  assert.equal(app.mixGapButtons[2].getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("mixButton").getAttribute("aria-pressed"), "false");
  await app.fire("mixButton", "click");
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 2);
  assert.ok(context.oscillators.every(oscillator => oscillator.type === "sine" && oscillator.started));
  assert.deepEqual(context.oscillators.map(oscillator => oscillator.frequency.value), [440, 444]);
  assert.equal(context.gains.at(-1).gain.value, 0.048);
  assert.equal(app.elements.get("mixButton").getAttribute("aria-pressed"), "true");
  assert.match(app.elements.get("mixStatus").textContent, /Зөрүүг өөрчилж/);
  await app.fire("mixButton", "click");
  assert.ok(context.oscillators.every(oscillator => oscillator.stopped));
  assert.equal(app.elements.get("mixButton").getAttribute("aria-pressed"), "false");
});

test("Combine Waves keeps two synchronized left-panel choices and uniform Play/Stop labels", async () => {
  const app = fakePage();
  app.fire("modeMix", "click");
  assert.equal(app.mixKindButtons.length, 4);
  assert.equal(app.elements.get("mixPlayLabel").textContent, "Тоглуулах");
  app.mixKindButtons[1].events.click();
  assert.equal(app.elements.get("noiseWorkspace").hidden, false);
  assert.equal(app.elements.get("harmonicWorkspace").hidden, true);
  assert.equal(app.elements.get("noisePlayLabel").textContent, "Тоглуулах");
  for (const index of [1, 3]) {
    assert.equal(app.mixKindButtons[index].getAttribute("aria-pressed"), "true");
  }
  assert.equal(app.contexts.length, 0, "Changing sub-experiment does not autoplay");
  await app.fire("noiseButton", "click");
  assert.equal(app.elements.get("noisePlayLabel").textContent, "Зогсоох");
  app.fire("langEn", "click");
  assert.equal(app.elements.get("noisePlayLabel").textContent, "Stop");
  app.mixKindButtons[0].events.click();
  assert.equal(app.elements.get("mixPlayLabel").textContent, "Play");
  assert.ok(app.contexts[0].sources.every(source => source.stopped));
});

test("S021 intervals switch exact/12-TET tuning and Pure/Rich voices without autoplay or leaks", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  assert.equal(app.contexts.length, 0, "Preset selection remains silent");
  assert.equal(app.elements.get("intervalName").textContent, "Цэвэр квинт · 3:2");
  assert.equal(app.elements.get("intervalNotesValue").textContent, "220 + 330 Гц");
  assert.equal(app.elements.get("intervalOverlapValue").textContent, "3f₁ = 2f₂ = 660 Гц");
  assert.match(app.elements.get("intervalWaveFoot").textContent, /доод нот 2, дээд нот 3/);
  assert.match(app.elements.get("intervalSpectrumFoot").textContent, /3 × 220 = 2 × 330/);
  assert.ok(app.elements.get("intervalWaveCanvas").drawnText.includes("f₁+f₂"));
  assert.ok(app.elements.get("intervalSpectrumCanvas").drawnText.includes("f₂"));

  app.selectIntervalRatio("5:4");
  assert.equal(app.elements.get("intervalNotesValue").textContent, "220 + 275 Гц");
  app.intervalTuningButtons[1].events.click(); // 12-TET
  assert.match(app.elements.get("intervalNotesValue").textContent, /277\.18 Гц/);
  assert.match(app.elements.get("intervalCents").textContent, /\+13\.686/);
  assert.match(app.elements.get("intervalCents").textContent, /8\.73 Гц/);
  assert.match(app.elements.get("intervalWaveFoot").textContent, /яг ижил давталт үгүй/);
  app.intervalColorButtons[0].events.click(); // Pure, still silent
  assert.equal(app.contexts.length, 0);
  assert.match(app.elements.get("intervalSpectrumFoot").textContent, /зөвхөн үндсэн давтамж/);

  await app.intervalPlayButtons[1].click();
  const ctx = app.contexts[0];
  assert.equal(ctx.oscillators.length, 2);
  assert.ok(ctx.oscillators.every(osc => osc.type === "sine" && osc.started));
  assert.ok(ctx.gains.some(g => Math.abs(g.gain.value - 0.12 * 0.38) < 1e-12));
  assert.equal(app.intervalPlayButtons[1].getAttribute("aria-pressed"), "true");
  app.selectIntervalRatio("3:2"); // retune without restart
  app.intervalTuningButtons[0].events.click();
  assert.equal(ctx.oscillators.length, 2);
  assert.deepEqual(ctx.oscillators.map(osc => osc.frequency.value), [220, 330]);
  app.intervalColorButtons[1].events.click(); // rich, crossfade
  assert.equal(ctx.oscillators.length, 4);
  assert.ok(ctx.oscillators.slice(0, 2).every(osc => osc.stopped));
  assert.ok(ctx.oscillators.slice(2).every(osc => osc.periodicWave?.options?.disableNormalization));
  app.elements.get("intervalBaseInput").value = "999";
  app.fire("intervalBaseInput", "change");
  assert.equal(app.elements.get("intervalBaseInput").value, "220");
  assert.equal(app.elements.get("intervalStatus").classList.contains("error"), true);
  app.fire("langEn", "click");
  assert.equal(app.elements.get("intervalName").textContent, "Perfect fifth · 3:2");
  assert.match(app.intervalPlayButtons[1].textContent, /Together/);
  app.fire("intervalReset", "click");
  assert.ok(ctx.oscillators.every(osc => osc.stopped));
  assert.equal(app.intervalPlayButtons[1].getAttribute("aria-pressed"), "false");
  assert.equal(app.elements.get("intervalVolumeValue").textContent, "38%");
  assert.equal(app.elements.get("intervalRatioValue").textContent, "3:2 = 1.5");
});

test("S021 interval playback reaches the shared recorder and cancels a pending start", async () => {
  const app = fakePage();
  await app.fire("recordButton", "click");
  app.fire("modeTuning", "click");
  await app.intervalPlayButtons[0].click();
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 2);
  const capture = context.worklets[0];
  capture.send({ type: "samples", samples: new Float32Array([0.15, -0.15]) });
  app.fire("stopAll", "click");
  assert.ok(context.oscillators.every(oscillator => oscillator.stopped));
  assert.deepEqual(capture.port.lastPosted, { type: "stop" });
  capture.send({ type: "done" });
  assert.equal(app.elements.get("recordDownload").clickCount, 1);

  const pending = app.intervalPlayButtons[1].click();
  app.tuningKindButtons[2].events.click(); // switch to scales before context resolves
  await pending;
  assert.equal(context.oscillators.length, 2, "No extra interval voices created after leaving the experiment");
  assert.equal(app.intervalPlayButtons[1].getAttribute("aria-pressed"), "false");
});

test("S026 Хөг keeps Interval, 3-limit and 5-limit in sync without autoplay", () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  assert.equal(app.elements.get("intervalWorkspace").hidden, false);
  assert.equal(app.elements.get("scaleWorkspace").hidden, true);
  assert.equal(app.tuningKindButtons.length, 25);
  for (const index of [0, 5, 10, 15, 20]) assert.equal(app.tuningKindButtons[index].getAttribute("aria-pressed"), "true");

  app.tuningKindButtons[2].events.click();
  assert.equal(app.elements.get("intervalWorkspace").hidden, true);
  assert.equal(app.elements.get("scaleWorkspace").hidden, false);
  assert.equal(app.elements.get("scaleChallenge").hidden, false);
  assert.equal(app.elements.get("scaleExplanation").hidden, false);
  assert.equal(app.elements.get("scaleCountValue").textContent, "5 нот");
  assert.equal(app.scaleTonicButtons.filter(button => !button.hidden).length, 5);
  assert.equal(app.elements.get("scaleTonicValue").textContent, "220 Гц");
  assert.match(app.elements.get("scaleGapsValue").textContent, /204/);
  assert.ok(app.elements.get("scaleSpiralCanvas").drawnText.includes("+4"));
  assert.ok(app.elements.get("scaleFourierCanvas").drawnText.includes("1/1"));
  assert.ok(app.elements.get("scaleFourierCanvas").drawnText.includes("+4"));
  assert.match(app.elements.get("scaleNowValue").textContent, /өсөх, буурах/);
  for (const index of [2, 7, 12, 17, 22]) assert.equal(app.tuningKindButtons[index].getAttribute("aria-pressed"), "true");
  assert.equal(app.contexts.length, 0, "Selecting experiments and tonics never autoplays");

  app.fire("langEn", "click");
  assert.match(app.scalePlayButtons[0].textContent, /In sequence/);
  assert.equal(app.elements.get("scaleTonicValue").textContent, "220 Hz");
  app.tuningKindButtons[0].events.click();
  assert.equal(app.elements.get("intervalWorkspace").hidden, false);
  assert.match(app.intervalPlayButtons[1].textContent, /Together/);
  assert.equal(app.elements.get("scaleWorkspace").hidden, true);
});

test("S029 ear tuning: compact controls, no target dots, and live notes never build buffers", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[1].events.click();
  assert.equal(app.elements.get("earWorkspace").hidden, false);
  assert.equal(app.elements.get("earChallenge").hidden, false);
  assert.equal(app.elements.get("earExplanation").hidden, false);
  assert.equal(app.elements.get("intervalWorkspace").hidden, true);
  assert.equal(app.contexts.length, 0);
  assert.equal(app.elements.get("earTaskSelect").value, "fifth");
  assert.match(app.elements.get("earStatus").textContent, /«Ээлжлэн» эсвэл «Хамт»/);
  assert.match(app.elements.get("earHarmonicsCanvas").getAttribute("aria-label"), /гармоникуудын/);
  assert.equal(app.elements.get("earHarmonicsCanvas").drawnArcs.length, 0,
    "The matching harmonics are never singled out by moving circles");
  assert.equal(app.elements.get("earOctavePanel").hidden, true,
    "The octave result panel is not shown before checking");

  await app.earPlayButtons[0].events.click();
  const ctx = app.contexts[0];
  assert.equal(ctx.oscillators.length, 16, "Eight lightweight partials per note");
  assert.equal(ctx.buffers.length, 0, "No heavy sample generation on start");
  assert.equal(app.timers.size, 1);
  assert.equal(app.earPlayButtons[0].getAttribute("aria-pressed"), "true");
  assert.equal(app.earPlayButtons[1].getAttribute("aria-pressed"), "false");
  assert.match(app.earPlayButtons[0].textContent, /■ Ээлжлэн/);
  const initial = ctx.oscillators[8].frequency.value;
  app.fire("earAdjust", "input", { target: { value: "-18" } });
  assert.ok(ctx.oscillators[8].frequency.value < initial);
  assert.ok(Math.abs(ctx.oscillators[8].frequency.value / ctx.oscillators[0].frequency.value - 1.5) < 1e-12);
  for (let i = 0; i < 100; i++) app.fire("earAdjust", "input", { target: { value: "-18" } });
  assert.equal(app.animationFrames.size, 1, "Repeated slider inputs draw at most once per frame");
  app.tick(.016);
  assert.equal(app.animationFrames.size, 0);
  assert.equal(ctx.buffers.length, 0);
  app.fire("earCheck", "click");
  assert.equal(app.elements.get("earResult").hidden, false);
  assert.equal(app.elements.get("earOctavePanel").hidden, true,
    "Fifths already in C4–C5 do not require a separate octave plot");
  assert.match(app.elements.get("earResult").textContent, /0\.00 цент/);
  app.earHelpButtons[1].events.click();
  assert.equal(app.elements.get("earHarmonicsBadge").textContent, "♪");
  app.fire("earTaskSelect", "change", { target: { value: "third" } });
  assert.equal(ctx.oscillators.every(osc => osc.stopped), true);
  assert.equal(app.timers.size, 0, "Task changes release the repeating sound timer");
  assert.equal(app.elements.get("earResult").hidden, true);
  assert.match(app.elements.get("earInstruction").textContent, /5:4/);
  app.fire("langEn", "click");
  assert.equal(app.earPlayButtons[0].textContent, "▶ In sequence");
  assert.equal(app.earPlayButtons[1].textContent, "▶ Together");
  assert.match(app.elements.get("earStatus").textContent, /In sequence or Together/);
  assert.match(app.elements.get("earHarmonicsCanvas").getAttribute("aria-label"), /Modeled harmonic lines/);
  assert.match(app.elements.get("earOctaveCanvas").getAttribute("aria-label"), /octave-equivalent copy/);
  assert.match(app.elements.get("earInstruction").textContent, /C4 → E4/);
});

test("S029 descending ratios reveal the octave diagram only after Check, and play toggles switch immediately", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[1].events.click();
  app.fire("earTaskSelect", "change", { target: { value: "downFourth" } }); // C4 -> G3
  assert.equal(app.contexts.length, 0);
  assert.equal(app.elements.get("earOctavePanel").hidden, true);
  app.fire("earAdjust", "input", { target: { value: "23" } });
  app.fire("earCheck", "click");
  assert.equal(app.elements.get("earOctavePanel").hidden, false);
  assert.equal(app.elements.get("earOctaveBadge").textContent, "До4 → Соль3");
  assert.match(app.elements.get("earResult").textContent, /× 2/);
  assert.match(app.elements.get("earResult").textContent, /Соль4/);
  assert.ok(app.elements.get("earOctaveCanvas").drawnText.includes("×2"));

  app.earSoundButtons[2].events.click(); // guitar
  assert.equal(app.contexts.length, 0, "Choosing a sound never autoplays");
  await app.earPlayButtons[1].events.click(); // together
  const ctx = app.contexts[0];
  assert.equal(ctx.oscillators.length, 16);
  assert.equal(ctx.buffers.length, 0);
  assert.equal(app.timers.size, 1);
  assert.equal(app.earPlayButtons[1].getAttribute("aria-pressed"), "true");
  await app.earPlayButtons[0].events.click(); // switch to sequence without intermediate stop tap
  assert.equal(ctx.oscillators.length, 32);
  assert.equal(ctx.oscillators.slice(0, 16).every(osc => osc.stopped), true,
    "Switching modes retires every oscillator from the previous mode");
  assert.equal(app.timers.size, 1, "Exactly one interval remains on mode switch");
  assert.equal(app.earPlayButtons[1].getAttribute("aria-pressed"), "false");
  assert.equal(app.earPlayButtons[0].getAttribute("aria-pressed"), "true");
  await app.earPlayButtons[0].events.click(); // tap active choice to stop
  assert.equal(app.timers.size, 0);
  assert.equal(app.earPlayButtons[0].getAttribute("aria-pressed"), "false");
  assert.equal(ctx.oscillators.every(osc => osc.stopped), true);
  app.earSoundButtons[3].events.click(); // piano
  assert.equal(app.timers.size, 0);
  assert.equal(ctx.oscillators.every(osc => osc.stopped), true);
  await app.earPlayButtons[0].events.click();
  assert.equal(app.timers.size, 1);
  assert.ok(ctx.oscillators.at(-3).frequency.value > 0);
  app.fire("stopAll", "click");
  assert.equal(app.timers.size, 0, "Master Stop releases the timer");
  assert.equal(ctx.oscillators.every(osc => osc.stopped), true);
  app.fire("earReset", "click");
  assert.equal(app.elements.get("earResult").hidden, true);
  assert.equal(app.elements.get("earOctavePanel").hidden, true);
  assert.equal(app.elements.get("earAdjust").value, "0");

  const pending = app.earPlayButtons[1].events.click();
  app.tuningKindButtons[2].events.click(); // cancel a pending start
  await pending;
  assert.equal(app.timers.size, 0, "No orphan repeating sound after switching to 3-limit");
  assert.equal(app.earPlayButtons[1].textContent, "▶ Хамт");
});

test("S029 switching play choices during a pending start retires the first request", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[1].events.click();
  const pendingFirst = app.earPlayButtons[0].events.click();
  const pendingSecond = app.earPlayButtons[1].events.click();
  await Promise.all([pendingFirst, pendingSecond]);
  assert.equal(app.timers.size, 1);
  assert.equal(app.earPlayButtons[0].getAttribute("aria-pressed"), "false");
  assert.equal(app.earPlayButtons[1].getAttribute("aria-pressed"), "true");
  await app.earPlayButtons[1].events.click();
  assert.equal(app.timers.size, 0);
  assert.equal(app.contexts[0].oscillators.every(osc => osc.stopped), true);
});

test("S030 5-limit presets, layers, lattice inspection and 12-TET guides never autoplay", () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[3].events.click();
  assert.equal(app.elements.get("limit5Workspace").hidden, false);
  assert.equal(app.elements.get("scaleWorkspace").hidden, true);
  assert.equal(app.elements.get("limit5Challenge").hidden, false);
  assert.equal(app.elements.get("limit5Explanation").hidden, false);
  assert.equal(app.elements.get("limit5Count").textContent, "3 нот");
  assert.equal(app.elements.get("limit5CommaRuler").hidden, true,
    "Commas are optional comparisons rather than decorations on every scale");
  assert.ok(app.elements.get("limit5LatticeCanvas").drawnArcs.length >= 28);
  assert.ok(app.elements.get("limit5OctaveCanvas").drawnArcs.length >= 3);
  assert.ok(app.elements.get("limit5FourierCanvas").drawnText.length >= 3);
  assert.match(app.elements.get("limit5FourierFact").textContent, /3 × 1\/1 = 2 × 3\/2 \(3:2\)/);
  assert.match(app.elements.get("limit5FourierFact").textContent, /5 × 1\/1 = 4 × 5\/4 \(5:4\)/);
  assert.match(app.elements.get("limit5PointInfo").textContent, /1\/1/);
  assert.equal(app.contexts.length, 0);
  app.fire("limit5PresetSelect", "change", { target: { value: "seven" } });
  assert.equal(app.elements.get("limit5Count").textContent, "7 нот");
  app.fire("limit5PresetSelect", "change", { target: { value: "commaD" } });
  assert.equal(app.elements.get("limit5CommaRuler").hidden, false);
  assert.match(app.elements.get("limit5CommaFact").textContent, /10\/9.*9\/8/);
  assert.match(app.elements.get("limit5RulerValue").textContent, /81:80/);
  app.fire("limit5PresetSelect", "change", { target: { value: "diaschisma" } });
  assert.match(app.elements.get("limit5RulerValue").textContent, /2048:2025/);
  assert.match(app.elements.get("limit5RulerValue").textContent, /19\.55/);
  app.fire("limit5TetGuides", "change", { target: { checked: true } });
  app.fire("langEn", "click");
  assert.equal(app.limit5PlayButtons[0].textContent, "▶ In sequence");
  assert.equal(app.limit5PlayButtons[1].textContent, "▶ Together");
  assert.equal(app.elements.get("limit5RulerValue").textContent.includes("cents"), true);
  assert.equal(app.contexts.length, 0);
  // Add an unselected point near the middle-left of the lattice.
  app.fire("limit5LatticeCanvas", "click", { clientX: 710 * (.335 + .115 * (0 + .5 * 0)), clientY: 210 * .55 });
  assert.equal(app.elements.get("limit5Count").textContent, "3 notes");
  assert.equal(app.elements.get("limit5PresetSelect").value, "custom");
  app.fire("limit5Reset", "click");
  assert.equal(app.elements.get("limit5Count").textContent, "3 notes");
  assert.equal(app.elements.get("limit5TetGuides").checked, false);
  assert.equal(app.elements.get("limit5CommaRuler").hidden, true);
  app.fire("limit5LatticeCanvas", "focus");
  app.fire("limit5LatticeCanvas", "keydown", { key: "ArrowRight" });
  app.fire("limit5LatticeCanvas", "keydown", { key: "Enter" });
  assert.equal(app.elements.get("limit5Count").textContent, "2 notes", "Keyboard selects the focused lattice dot");
  app.fire("limit5LatticeCanvas", "blur");
});

test("S030 5-limit sequence and chord buttons switch/stop through the recorder bus", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[3].events.click();
  await app.limit5PlayButtons[0].events.click();
  const context = app.contexts[0];
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].buffer.length, Math.ceil(3 * limit5Model.STEP_SECONDS * context.sampleRate));
  assert.equal(app.limit5PlayButtons[0].getAttribute("aria-pressed"), "true");
  assert.equal(app.limit5PlayButtons[1].getAttribute("aria-pressed"), "false");
  app.tick(.39);
  assert.match(app.elements.get("limit5Now").textContent, /5\/4/);
  assert.ok(app.elements.get("limit5OctaveCanvas").drawnArcs.some(arc => arc.fillStyle === "#ffe0a1"));
  await app.limit5PlayButtons[1].events.click();
  assert.equal(context.sources.length, 2);
  assert.equal(context.sources[0].stopped, true);
  assert.equal(app.limit5PlayButtons[0].getAttribute("aria-pressed"), "false");
  assert.equal(app.limit5PlayButtons[1].getAttribute("aria-pressed"), "true");
  assert.equal(context.sources[1].buffer.length, Math.ceil(limit5Model.CHORD_SECONDS * context.sampleRate));
  assert.match(app.elements.get("limit5Now").textContent, /хамт/);
  assert.equal(app.elements.get("limit5LatticeCanvas").drawnArcs.slice(-32)
    .filter(arc => arc.radius === 13).length, 3,
  "The final 28-point lattice render gives halos only to the three chosen chord notes");
  await app.limit5PlayButtons[1].events.click();
  assert.equal(app.limit5PlayButtons[1].getAttribute("aria-pressed"), "false");
  assert.equal(context.sources[1].stopped, true);
});

test("S030 chosen comma pairs beat in chord mode, cancel on navigation, and end naturally", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[3].events.click();
  app.fire("limit5PresetSelect", "change", { target: { value: "commaE" } });
  assert.match(app.elements.get("limit5BeatFact").textContent, /Гц/);
  await app.limit5PlayButtons[1].events.click();
  const context = app.contexts[0];
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].buffer.length, Math.ceil(limit5Model.CHORD_SECONDS * context.sampleRate));
  assert.equal(app.limit5PlayButtons[1].getAttribute("aria-pressed"), "true");
  app.tuningKindButtons[0].events.click();
  assert.equal(context.sources[0].stopped, true);
  assert.equal(app.limit5PlayButtons[1].getAttribute("aria-pressed"), "false");
  app.tuningKindButtons[3].events.click();
  await app.limit5PlayButtons[1].events.click();
  context.sources[1].onended();
  assert.equal(app.limit5PlayButtons[1].getAttribute("aria-pressed"), "false");
  assert.equal(app.elements.get("limit5Now").textContent.includes("тоглуулахад"), true);
  assert.equal(context.sources.length, 2);
});

test("S022 fifth chains grow in both directions and tonic choice changes mode, not pitch collection", () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[2].events.click();
  assert.equal(app.scaleTonicButtons[0].textContent, "1 · 1/1");
  assert.equal(app.scaleTonicButtons[4].textContent, "5 · 27/16");
  const firstGaps = app.elements.get("scaleGapsValue").textContent;
  app.scaleTonicButtons[4].events.click(); // last generated note, A relative to C
  assert.equal(app.elements.get("scaleTonicValue").textContent, "371.25 Гц");
  assert.equal(app.scaleTonicButtons[4].getAttribute("aria-pressed"), "true");
  assert.notEqual(app.elements.get("scaleGapsValue").textContent, firstGaps,
    "Rotating the tonic rotates the actual interval sequence");
  assert.ok(app.elements.get("scaleFourierCanvas").drawnText.includes("27/16"));

  app.selectScalePreset("five-center"); // two down, two up
  assert.equal(app.elements.get("scaleCountValue").textContent, "5 нот");
  assert.equal(app.elements.get("scaleRangeValue").textContent, "−2 … +2");
  assert.equal(app.elements.get("scaleTonicValue").textContent, "220 Гц",
    "When the selected tonic leaves the new chain it returns to the reference");
  app.fire("scaleAddDown", "click");
  app.fire("scaleAddUp", "click");
  assert.equal(app.elements.get("scaleCountValue").textContent, "7 нот");
  assert.equal(app.scaleTonicButtons.filter(button => !button.hidden).length, 7);
  assert.match(app.elements.get("scaleGapsValue").textContent, /90/);
  assert.equal(app.elements.get("scaleRemoveDown").disabled, false);
  app.selectScalePreset("twelve");
  assert.equal(app.elements.get("scaleCountValue").textContent, "12 нот");
  assert.equal(app.elements.get("scaleAddUp").disabled, true);
  assert.equal(app.elements.get("scaleAddDown").disabled, true);
  assert.match(app.elements.get("scaleClosureValue").textContent, /23\.46/);
  app.fire("scaleReset", "click");
  assert.equal(app.elements.get("scaleRangeValue").textContent, "−0 … +4");
  assert.equal(app.scaleTonicButtons.filter(button => !button.hidden).length, 5);
  assert.equal(app.contexts.length, 0);
});

test("S022 scale player uses bounded samples and recorder output, then cleans up on navigation", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[2].events.click();
  await app.scalePlayButtons[0].click();
  const context = app.contexts[0];
  assert.equal(context.sources.length, 1);
  assert.ok(context.sources[0].started);
  assert.equal(context.gains.at(-1).gain.value, .28 * .38);
  const data = context.buffers[0].getChannelData();
  assert.ok(data.length > 44100);
  assert.ok(data.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
  assert.equal(app.scalePlayButtons[0].getAttribute("aria-pressed"), "true");
  app.elements.get("scaleVolume").value = "25";
  app.fire("scaleVolume", "input");
  assert.equal(context.gains.at(-1).gain.value, .28 * .25);
  app.selectScalePreset("seven"); // seven notes while playing
  assert.equal(context.sources[0].stopped, true);
  assert.equal(app.scalePlayButtons[0].getAttribute("aria-pressed"), "false");
  await app.scalePlayButtons[0].click();
  assert.equal(context.sources.length, 2);
  app.tuningKindButtons[0].events.click();
  assert.equal(context.sources[1].stopped, true);

  app.tuningKindButtons[2].events.click();
  const pending = app.scalePlayButtons[0].click();
  app.fire("modeMix", "click");
  await pending;
  assert.equal(context.sources.length, 2, "Pending playback is canceled when leaving Хөг");
  assert.equal(app.scalePlayButtons[0].getAttribute("aria-pressed"), "false");
});

test("S022 scale melody records on the shared bus and returns to idle at natural end", async () => {
  const app = fakePage();
  await app.fire("recordButton", "click");
  app.fire("modeTuning", "click");
  app.tuningKindButtons[2].events.click();
  await app.scalePlayButtons[0].click();
  const context = app.contexts[0];
  assert.equal(context.worklets.length, 1);
  assert.ok(context.sources[0].started);
  const worklet = context.worklets[0];
  worklet.send({ type: "samples", samples: new Float32Array([.2, -.2]) });
  context.sources[0].onended();
  assert.equal(app.scalePlayButtons[0].getAttribute("aria-pressed"), "false");
  app.fire("stopAll", "click");
  assert.deepEqual(worklet.port.lastPosted, { type: "stop" });
  worklet.send({ type: "done" });
  assert.equal(app.elements.get("recordDownload").clickCount, 1);
});

test("S023 spiral and harmonic rows follow the audible pitch order, then clear on stop", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[2].events.click();
  const spiral = app.elements.get("scaleSpiralCanvas");
  const fourier = app.elements.get("scaleFourierCanvas");
  assert.ok(spiral.drawnText.includes("+1"), "Spiral labels fifth-chain steps");
  assert.ok(fourier.drawnText.includes("2^" + 2 + " f₀"), "Harmonic rows use a logarithmic octave axis");
  assert.ok(fourier.drawnText.includes("нэг октав"), "The highlighted octave is labeled");
  const oneOctave = () => fourier.drawnRects.filter(rect => rect.color === "#eaf7f0").at(-1);
  assert.ok(oneOctave().width > 0, "A shaded octave selection exists");
  assert.equal(fourier.style.height, "260px", "Five rows fit the compact cartoon");
  const activeMarks = () => fourier.drawnArcs.filter(arc =>
    arc.fillStyle === "#e3a33b" && arc.radius === 6.7);
  await app.scalePlayButtons[0].click();
  assert.match(app.elements.get("scaleNowValue").textContent, /алхам 0 · 1\/1/);
  assert.equal(app.elements.get("scaleNowValue").classList.contains("active"), true);
  assert.equal(activeMarks().length, 1, "Only the sounding octave marker is filled gold");
  const firstX = activeMarks().at(-1).x;
  app.tick(.33);
  assert.match(app.elements.get("scaleNowValue").textContent, /алхам \+2 · 9\/8/,
    "Second played note is k=2, not the next generated fifth k=1");
  assert.ok(activeMarks().at(-1).x > firstX, "The highlighted marker moves right within the octave");
  app.tick(.32);
  assert.match(app.elements.get("scaleNowValue").textContent, /алхам \+4 · 81\/64/);
  const thirdX = activeMarks().at(-1).x;
  app.tick(1.0);
  assert.match(app.elements.get("scaleNowValue").textContent, /алхам 0 · 1\/1 · дээд октав/);
  assert.ok(activeMarks().at(-1).x > thirdX);
  assert.ok(Math.abs(activeMarks().at(-1).x - (oneOctave().x + oneOctave().width)) < 1e-6,
    "Upper tonic highlights the right boundary, not the tonic at the left");
  const beforeStop = activeMarks().length;
  app.fire("stopAll", "click");
  assert.equal(activeMarks().length, beforeStop, "Stop clears active marker without another gold highlight");
  assert.equal(app.elements.get("scaleNowValue").classList.contains("active"), false);
  assert.match(app.elements.get("scaleNowValue").textContent, /өсөх, буурах/);
  assert.equal(app.scalePlayButtons[0].getAttribute("aria-pressed"), "false");
});

test("S024 five-down actually means four downward fifths, not three down and one up", () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[2].events.click();
  app.selectScalePreset("five-down");
  assert.equal(app.elements.get("scaleRangeValue").textContent, "−4 … +0");
  assert.equal(app.elements.get("scaleCountValue").textContent, "5 нот");
  assert.equal(app.scaleTonicButtons.filter(button => !button.hidden).length, 5);
});

test("S025 comma demonstration is opt-in, distinguishes a five-note near-return from twelve-step comma", () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[2].events.click();
  const toggle = app.elements.get("scaleGapToggle");
  const panel = app.elements.get("scaleGapPanel");
  const spiral = app.elements.get("scaleSpiralCanvas");
  const zoom = app.elements.get("scaleGapCanvas");
  assert.equal(toggle.checked, false);
  assert.equal(panel.hidden, true);
  assert.equal(app.elements.get("scaleClosureFact").hidden, true,
    "The numeric return discrepancy stays out of sight until requested");
  assert.equal(zoom.drawnArcs.length, 0, "Opted-out comparison never renders its extra graph");
  assert.equal(spiral.drawnText.some(value => value.includes("?")), false,
    "The sixth ghost note is absent from the ordinary five-note scale");
  assert.equal(app.contexts.length, 0);

  toggle.checked = true;
  app.fire("scaleGapToggle", "change");
  assert.equal(panel.hidden, false);
  assert.equal(app.elements.get("scaleClosureFact").hidden, false);
  assert.equal(app.elements.get("scaleGapInfo").hidden, false);
  assert.match(app.elements.get("scaleGapInfo").textContent, /\+5/);
  assert.match(app.elements.get("scaleGapSummary").textContent, /−90\.22 цент/);
  assert.match(app.elements.get("scaleGapSummary").textContent, /−27\.07°/);
  assert.ok(spiral.drawnText.includes("+5 ?"), "The ghost is a labeled extra step on the spiral");
  assert.ok(zoom.drawnText.includes("хийсвэр буцах нот"));
  assert.equal(zoom.drawnArcs.length, 2, "Two cents-comparison markers are drawn");

  const beforeDown = spiral.drawnText.length;
  app.selectScalePreset("five-down");
  const downLabels = spiral.drawnText.slice(beforeDown);
  assert.match(app.elements.get("scaleGapInfo").textContent, /-5/);
  assert.match(app.elements.get("scaleGapSummary").textContent, /\+90\.22 цент/);
  assert.equal(downLabels.filter(label => label.endsWith(" ?")).at(-1), "-5 ?",
    "The final rendered all-down chain continues to −5, not to a positive fifth");

  app.selectScalePreset("twelve");
  assert.match(app.elements.get("scaleGapSummary").textContent, /Пифагорын комма/);
  assert.match(app.elements.get("scaleGapSummary").textContent, /\+23\.46 цент/);
  assert.match(app.elements.get("scaleGapSummary").textContent, /\+7\.04°/);
  assert.ok(spiral.drawnText.includes("+7 ?"));
  app.fire("langEn", "click");
  assert.match(app.elements.get("scaleGapSummary").textContent, /Pythagorean comma/);
  assert.match(app.elements.get("scaleGapInfo").textContent, /23\.46 cents/);
  assert.equal(app.contexts.length, 0, "Toggling and editing overlays never trigger audio");

  app.fire("scaleReset", "click");
  assert.equal(toggle.checked, false);
  assert.equal(panel.hidden, true);
  assert.equal(app.elements.get("scaleClosureFact").hidden, true);
  assert.equal(app.elements.get("scaleGapButton").getAttribute("aria-pressed"), "false");
});

test("S025 comparison is an explicit short audio gesture on the recorder bus and cleans up safely", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[2].events.click();
  app.elements.get("scaleGapToggle").checked = true;
  app.fire("scaleGapToggle", "change");
  assert.equal(app.contexts.length, 0);
  await app.fire("scaleGapButton", "click");
  const context = app.contexts[0];
  assert.equal(context.sources.length, 1);
  assert.equal(context.buffers[0].length, Math.ceil(scaleModel.GAP_SECONDS * context.sampleRate));
  assert.ok(context.sources[0].started);
  assert.equal(app.elements.get("scaleGapButton").getAttribute("aria-pressed"), "true");
  assert.equal(app.scalePlayButtons[0].getAttribute("aria-pressed"), "false");
  context.sources[0].onended();
  assert.equal(app.elements.get("scaleGapButton").getAttribute("aria-pressed"), "false");
  assert.match(app.elements.get("scaleStatus").textContent, /Харьцуулалт дууслаа/);

  await app.fire("recordButton", "click");
  await app.fire("scaleGapButton", "click");
  assert.equal(context.sources.length, 2);
  assert.equal(context.worklets.length, 1);
  const capture = context.worklets[0];
  capture.send({ type: "samples", samples: new Float32Array([.12, -.12]) });
  app.fire("stopAll", "click");
  assert.ok(context.sources[1].stopped);
  assert.equal(app.elements.get("scaleGapButton").getAttribute("aria-pressed"), "false");
  assert.deepEqual(capture.port.lastPosted, { type: "stop" });
  capture.send({ type: "done" });
  assert.equal(app.elements.get("recordDownload").clickCount, 1);

  await app.fire("scaleGapButton", "click");
  assert.equal(context.sources.length, 3);
  app.elements.get("scaleGapToggle").checked = false;
  app.fire("scaleGapToggle", "change");
  assert.ok(context.sources[2].stopped, "Disabling the overlay stops its comparison audio");
  assert.equal(app.elements.get("scaleGapPanel").hidden, true);
  assert.equal(app.elements.get("scaleGapButton").getAttribute("aria-pressed"), "false");
});

test("beating controls retune both voices; gap zero resynchronizes the pair without lingering voices", async () => {
  const app = fakePage();
  app.fire("modeMix", "click");
  await app.fire("mixButton", "click");
  const context = app.contexts[0];
  app.elements.get("mixGapSlider").value = "10";
  app.fire("mixGapSlider", "input");
  assert.deepEqual(context.oscillators.map(oscillator => oscillator.frequency.value), [440, 450]);
  assert.equal(app.elements.get("mixBeatValue").textContent, "10 удаа/сек");
  assert.equal(app.mixGapButtons[3].getAttribute("aria-pressed"), "true");
  app.elements.get("mixBaseInput").value = "500";
  app.fire("mixBaseInput", "change");
  assert.deepEqual(context.oscillators.map(oscillator => oscillator.frequency.value), [500, 510]);
  assert.equal(app.elements.get("mixSpectrumBadge").textContent, "500 + 510 Гц");
  assert.equal(context.oscillators.length, 2, "Normal retuning preserves both oscillators");
  app.mixGapButtons[0].events.click();
  assert.equal(context.oscillators.length, 4, "Returning to zero resynchronizes the pair's relative phase");
  assert.ok(context.oscillators.slice(0, 2).every(oscillator => oscillator.stopped));
  assert.deepEqual(context.oscillators.slice(2).map(oscillator => oscillator.frequency.value), [500, 500]);
  assert.equal(app.elements.get("mixBeatValue").textContent, "0 удаа/сек");
  assert.match(app.elements.get("mixSpectrumFoot").textContent, /нэг оргил/);
  assert.equal(app.mixGapButtons[0].getAttribute("aria-pressed"), "true");
  app.elements.get("mixVolume").value = "100";
  app.fire("mixVolume", "input");
  assert.equal(context.gains.at(-1).gain.value, 0.12, "Each oscillator receives at most .12 amplitude");
  app.elements.get("mixBaseInput").value = "12";
  app.fire("mixBaseInput", "change");
  assert.equal(app.elements.get("mixBaseInput").value, "500", "Invalid input restores last valid frequency");
  assert.equal(app.elements.get("mixStatus").classList.contains("error"), true);
  app.mixGapButtons[2].events.click();
  assert.match(app.elements.get("mixSpectrumFoot").textContent, /хоёр давтамж/);
  assert.equal(context.oscillators.length, 4, "Leaving zero also reuses the synchronized pair");
  app.fire("mixReset", "click");
  assert.ok(context.oscillators.every(oscillator => oscillator.stopped));
  assert.equal(app.elements.get("mixBaseInput").value, "440");
  assert.equal(app.elements.get("mixGapValue").textContent, "4 Гц");
  assert.equal(app.elements.get("mixVolumeValue").textContent, "40%");
  assert.equal(app.elements.get("mixStatus").classList.contains("error"), false);
});

test("beats waveform zoom, pan and spectrum remain bilingual and show nearby frequencies", () => {
  const app = fakePage();
  app.fire("modeMix", "click");
  assert.equal(app.elements.get("mixWindowLabel").textContent, "0 сек – 1 сек · 4 удаа/сек");
  assert.equal(app.elements.get("mixZoomValue").textContent, "1 сек");
  assert.equal(app.elements.get("mixZoomOut").disabled, false);
  assert.equal(app.elements.get("mixZoomIn").disabled, false);
  assert.ok(app.elements.get("mixSpectrumCanvas").drawnText.some(label => label.endsWith(" Гц")));
  assert.match(app.elements.get("mixWaveHint").textContent, /\+ дарж/);
  app.fire("mixZoomIn", "click");
  assert.equal(app.elements.get("mixZoomValue").textContent, "250 мсек");
  app.fire("mixZoomIn", "click");
  assert.equal(app.elements.get("mixZoomValue").textContent, "62.5 мсек");
  app.fire("mixZoomIn", "click");
  assert.equal(app.elements.get("mixZoomValue").textContent, "15.63 мсек");
  assert.match(app.elements.get("mixWaveHint").textContent, /Цэнхэр шугам/);
  assert.equal(app.elements.get("mixViewLeft").disabled, true);
  app.fire("mixViewRight", "click");
  assert.equal(app.elements.get("mixWindowLabel").textContent, "7.81 мсек – 23.44 мсек · 4 удаа/сек");
  assert.equal(app.elements.get("mixViewLeft").disabled, false);
  app.fire("mixZoomIn", "click");
  app.fire("mixZoomIn", "click");
  assert.equal(app.elements.get("mixZoomValue").textContent, "2 мсек");
  assert.equal(app.elements.get("mixZoomIn").disabled, true);
  assert.equal(app.elements.get("mixWindowLabel").textContent, "7.81 мсек – 9.81 мсек · 4 удаа/сек");
  app.fire("langEn", "click");
  assert.equal(app.elements.get("mixBeatValue").textContent, "4 pulses/s");
  assert.equal(app.elements.get("mixWindowLabel").textContent, "7.81 ms – 9.81 ms · 4 pulses/s");
  assert.equal(app.elements.get("mixZoomIn").getAttribute("aria-label"), "Zoom in to individual vibrations");
  assert.match(app.elements.get("mixWaveHint").textContent, /actual combined oscillation/);
  assert.equal(app.elements.get("mixBaseInput").getAttribute("aria-label"), "First frequency in hertz");
  for (let i = 0; i < 6; i++) app.fire("mixZoomOut", "click");
  assert.equal(app.elements.get("mixZoomValue").textContent, "4 s");
  assert.equal(app.elements.get("mixZoomOut").disabled, true);
  assert.equal(app.elements.get("mixViewRight").disabled, true);
  assert.match(app.elements.get("mixWaveHint").textContent, /Press \+ to zoom/);
  app.fire("mixReset", "click");
  assert.equal(app.elements.get("mixZoomValue").textContent, "1 s");
  app.mixGapButtons[0].events.click();
  assert.match(app.elements.get("mixSpectrumFoot").textContent, /one spectral peak/);
  assert.match(browserCode, /recordSave: "Download WAV"/);
  assert.match(browserCode, /recordSave: "WAV татах"/);
  assert.doesNotMatch(browserCode, /Download WAV again|WAV дахин хадгалах/);
});

test("global Stop saves a recording of the combined tones, and modes cancel both voices", async () => {
  const app = fakePage();
  await app.fire("recordButton", "click");
  app.fire("modeMix", "click");
  await app.fire("mixButton", "click");
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 2);
  const capture = context.worklets[0];
  capture.send({ type: "samples", samples: new Float32Array([0.2, -0.2]) });
  app.fire("stopAll", "click");
  assert.ok(context.oscillators.every(oscillator => oscillator.stopped));
  assert.deepEqual(capture.port.lastPosted, { type: "stop" });
  capture.send({ type: "done" });
  assert.equal(app.elements.get("recordDownload").clickCount, 1);
  assert.equal(app.elements.get("recordResult").hidden, false);
  await app.fire("mixButton", "click");
  app.fire("modeMotion", "click");
  assert.ok(context.oscillators.every(oscillator => oscillator.stopped));
  assert.equal(app.elements.get("mixWorkspace").hidden, true);
  assert.equal(app.elements.get("motionWorkspace").hidden, false);
});

test("pending beat start is canceled when the tab changes or the page closes", async () => {
  const app = fakePage();
  app.fire("modeMix", "click");
  const pending = app.fire("mixButton", "click");
  app.fire("modePure", "click");
  await pending;
  assert.equal(app.contexts[0].oscillators.length, 0);
  app.fire("modeMix", "click");
  await app.fire("mixButton", "click");
  assert.equal(app.contexts[0].oscillators.length, 2);
  app.window.events.pagehide();
  assert.ok(app.contexts[0].oscillators.every(oscillator => oscillator.stopped));
  assert.equal(app.elements.get("mixButton").getAttribute("aria-pressed"), "false");
});

test("modeled piano has press and gentle tap gestures with matching audio and UI", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  const piano = app.strikeButtons.find(button => button.dataset.strike === "piano");
  piano.events.click();
  assert.equal(app.contexts.length, 0, "Switching instrument must stay silent");
  assert.equal(app.elements.get("strikePitchGroup").hidden, false);
  assert.equal(app.elements.get("strikeDrumSizeGroup").hidden, true);
  assert.equal(app.elements.get("strikePianoPlayModes").hidden, false);
  assert.equal(app.elements.get("strikePianoTypeGroup").hidden, false);
  assert.equal(app.elements.get("strikePianoType").value, "acoustic");
  assert.match(app.pianoTouchButtons[0].textContent, /Товчлуур дарах/);
  assert.equal(app.pianoTouchButtons[0].getAttribute("aria-pressed"), undefined);
  assert.match(app.elements.get("strikeDescription").textContent, /Алх цохиход/);
  assert.equal(app.elements.get("strikeDecayValue").textContent, "0.8 сек");
  await app.pianoTouchButtons[0].click();
  const context = app.contexts[0];
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].started, true);
  assert.ok(context.buffers[0].getChannelData().some(sample => Math.abs(sample) > .005));
  assert.ok(app.elements.get("strikeSpectrumCanvas").drawnText.some(label => label.includes("кГц")));
  const softerBuffer = context.buffers[0].getChannelData().slice(0, 256);
  app.elements.get("strikeStrength").value = "90";
  app.fire("strikeStrength", "input");
  assert.equal(context.buffers.length, 1, "Changing strength alone must not start audio");
  await app.pianoTouchButtons[0].click();
  const harderBuffer = context.buffers[1].getChannelData();
  assert.ok(harderBuffer.some((sample, i) => i < 256 &&
    Math.abs(sample - softerBuffer[i]) > 0.001),
  "Hammer strength changes the underlying synthesized piano waveform");
  await app.pianoTouchButtons[1].click();
  assert.match(app.pianoTouchButtons[1].textContent, /Товших/);
  assert.equal(app.pianoTouchButtons[1].getAttribute("aria-pressed"), undefined);
  assert.equal(context.buffers.length, 3, "Tap starts immediately as a different gesture");
  assert.equal(context.sources[1].stopped, false, "Press may decay under the next Tap");
  await app.pianoTouchButtons[1].click();
  assert.equal(context.sources.length, 4, "Repeated Tap starts a separate note");
  assert.equal(context.buffers.length, 3, "Repeated Tap uses the cached piano samples");
  const tapped = context.buffers[2].getChannelData();
  const rms = (buffer, start, count = 1024) => {
    const from = Math.round(start * context.sampleRate);
    let energy = 0;
    for (let i = from; i < from + count; i++) energy += buffer[i] * buffer[i];
    return Math.sqrt(energy / count);
  };
  assert.ok(rms(tapped, .05) < rms(harderBuffer, .05), "Tap uses a softer hammer");
  assert.ok(rms(tapped, .5) < .03 * rms(harderBuffer, .5),
    "The early-returning damper shortens a tapped note");
  app.fire("langEn", "click");
  assert.match(app.pianoTouchButtons[1].textContent, /Tap/);
  await app.pianoTouchButtons[0].click();
  assert.match(app.pianoTouchButtons[0].textContent, /Press a key/);
  assert.equal(app.elements.get("strikePianoPlayModes").hidden, false);
  app.strikeButtons[1].events.click();
  assert.equal(app.elements.get("strikePianoPlayModes").hidden, true);
  assert.equal(app.elements.get("strikePianoTypeGroup").hidden, true);
  app.fire("stopAll", "click");
  assert.equal(context.sources[0].stopped, true);
});

test("electric piano dropdown shares the FM voice, preserves tap/press and updates its plots", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  app.strikeButtons.find(button => button.dataset.strike === "piano").events.click();
  const type = app.elements.get("strikePianoType");
  const hint = app.elements.get("strikePianoHint");
  assert.equal(type.value, "acoustic");
  assert.equal(app.contexts.length, 0);

  await app.pianoTouchButtons[0].click();
  const context = app.contexts[0];
  const acoustic = context.buffers[0].getChannelData();
  type.value = "electric";
  app.fire("strikePianoType", "change");
  assert.equal(type.value, "electric");
  assert.equal(context.buffers.length, 1, "Selecting an instrument does not autoplay");
  assert.match(hint.textContent, /FM/);
  assert.match(app.elements.get("strikeDescription").textContent, /модуляц/);
  await app.pianoTouchButtons[0].click();
  const electric = context.buffers[1].getChannelData();
  assert.notDeepEqual(electric.slice(100, 200), acoustic.slice(100, 200),
    "Electric and acoustic models must actually sound different");
  assert.ok(electric.some(sample => Math.abs(sample) > .01));
  assert.ok(app.elements.get("strikeSpectrumCanvas").drawnText.length > 0);
  await app.pianoTouchButtons[1].click();
  const tap = context.buffers[2].getChannelData();
  assert.ok(Math.abs(tap[1000] - electric[1000]) > .00001,
    "Electric Tap is a distinct modeled gesture");
  app.fire("langEn", "click");
  assert.equal(type.value, "electric");
  assert.equal(hint.textContent.includes("FM"), true);
  assert.equal(app.elements.get("strikePianoTypeGroup").hidden, false);
  type.value = "acoustic";
  app.fire("strikePianoType", "change");
  assert.match(app.elements.get("strikeDescription").textContent, /Hammer/);
  app.fire("strikeReset", "click");
  app.strikeButtons.find(button => button.dataset.strike === "piano").events.click();
  assert.equal(type.value, "acoustic", "Reset restores acoustic as the default piano");
});

test("S031 ratio dropdown and two interval play buttons switch without overlapping voices", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  assert.equal(app.elements.get("intervalRatioSelect").value, "3:2");
  assert.equal(app.intervalOptions[2].textContent, "Цэвэр квинт · 3:2");
  assert.equal(app.contexts.length, 0);
  await app.intervalPlayButtons[0].click();
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 2);
  assert.equal(app.intervalPlayButtons[0].getAttribute("aria-pressed"), "true");
  assert.equal(app.timers.size, 1, "Alternating notes use exactly one timed envelope");
  await app.intervalPlayButtons[1].click();
  assert.ok(context.oscillators.slice(0, 2).every(voice => voice.stopped));
  assert.equal(context.oscillators.length, 4);
  assert.equal(app.timers.size, 0, "Together mode retires the alternating timer");
  assert.equal(app.intervalPlayButtons[0].getAttribute("aria-pressed"), "false");
  assert.equal(app.intervalPlayButtons[1].getAttribute("aria-pressed"), "true");
  app.selectIntervalRatio("5:4");
  assert.deepEqual(context.oscillators.slice(2).map(voice => voice.frequency.value), [220, 275]);
  await app.intervalPlayButtons[1].click();
  assert.ok(context.oscillators.every(voice => voice.stopped));
  assert.equal(app.intervalPlayButtons[1].getAttribute("aria-pressed"), "false");
  app.fire("langEn", "click");
  assert.equal(app.intervalOptions[4].textContent, "Major third · 5:4");
});

test("S031 3-limit dropdown and chord button use bounded audio and stop on switching", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[2].click();
  assert.equal(app.elements.get("scalePresetSelect").value, "five-up");
  app.selectScalePreset("seven");
  assert.equal(app.elements.get("scaleCountValue").textContent, "7 нот");
  assert.equal(app.contexts.length, 0, "Changing dropdown never autoplays");
  await app.scalePlayButtons[0].click();
  const context = app.contexts[0];
  assert.equal(context.sources.length, 1);
  assert.equal(app.scalePlayButtons[0].getAttribute("aria-pressed"), "true");
  await app.scalePlayButtons[1].click();
  assert.equal(context.sources[0].stopped, true);
  assert.equal(context.sources.length, 2);
  assert.equal(context.buffers[1].length, Math.ceil(scaleModel.CHORD_SECONDS * context.sampleRate));
  assert.ok(context.buffers[1].getChannelData().every(value => Math.abs(value) <= .75 + 1e-6));
  assert.equal(app.scalePlayButtons[1].getAttribute("aria-pressed"), "true");
  assert.match(app.elements.get("scaleNowValue").textContent, /хамт/);
  await app.scalePlayButtons[1].click();
  assert.equal(context.sources[1].stopped, true);
  assert.equal(app.scalePlayButtons[1].getAttribute("aria-pressed"), "false");
  app.fire("scaleAddUp", "click");
  assert.equal(app.elements.get("scalePresetSelect").value, "custom");
  app.fire("scaleReset", "click");
  assert.equal(app.elements.get("scalePresetSelect").value, "five-up");
});

test("S032 momentary guitar strokes and exclusive bowed hold/toggle controls stay distinct", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  await app.guitarPlayButtons[0].click();
  const context = app.contexts[0];
  assert.equal(app.guitarPlayButtons[0].getAttribute("aria-pressed"), undefined);
  assert.match(app.guitarPlayButtons[0].textContent, /^▶/);
  context.sources[0].onended();
  assert.match(app.guitarPlayButtons[0].textContent, /^▶/,
    "A note naturally ending does not turn the momentary play button into a toggle");
  await app.guitarPlayButtons[0].click();
  await app.guitarPlayButtons[1].click();
  assert.equal(context.sources[1].stopped, false, "A strum can ring over the previous pluck");
  assert.equal(app.guitarPlayButtons[1].getAttribute("aria-pressed"), undefined);
  app.fire("modeSustain", "click");
  assert.equal(context.sources[2].stopped, true);
  app.sustainButtons[1].click(); // violin
  await app.fire("sustainToggleButton", "click");
  assert.equal(app.elements.get("sustainToggleButton").getAttribute("aria-pressed"), "true");
  const oldOscillator = context.oscillators[0];
  await app.fire("sustainHoldButton", "pointerdown", { pointerId: 44 });
  assert.equal(oldOscillator.stopped, true, "Holding stops the toggled note first");
  assert.equal(app.elements.get("sustainHoldButton").getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("sustainToggleButton").getAttribute("aria-pressed"), "false");
  app.fire("sustainHoldButton", "pointerup", { pointerId: 44 });
  assert.equal(app.elements.get("sustainHoldButton").getAttribute("aria-pressed"), "false");
});

test("S037 additional guitar chords and strokes remain momentary and quiet until tapped", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  assert.equal(app.guitarChordButtons.length, 11);
  for (const pattern of transientModel.STRUM_PATTERNS) {
    assert.match(html, new RegExp('value="' + pattern + '" data-i18n="strikePattern'));
  }
  assert.equal(app.contexts.length, 0);
  app.elements.get("strikeGuitarPattern").value = "fingerpick";
  app.fire("strikeGuitarPattern", "change");
  assert.equal(app.contexts.length, 0, "Changing a gesture must not start sound");
  await app.guitarChordButtons[10].click(); // Dsus4
  const context = app.contexts[0];
  const firstBuffer = context.sources[0].buffer.getChannelData(0);
  assert.equal(app.guitarChordButtons[10].getAttribute("aria-pressed"), "true");
  await app.guitarChordButtons[10].click();
  assert.equal(context.sources.length, 2, "Repeated Dsus4 hits overlap");
  assert.equal(context.sources[0].stopped, false);
  assert.equal(context.sources[1].buffer, context.sources[0].buffer, "Same gesture reuses samples");
  app.elements.get("strikeGuitarPattern").value = "up";
  app.fire("strikeGuitarPattern", "change");
  assert.equal(context.sources[0].stopped, true, "Changing the synthesis recipe stops the old tail");
  assert.equal(context.sources.length, 2, "A change alone does not play a chord");
  await app.guitarChordButtons[10].click();
  const upBuffer = context.sources[2].buffer.getChannelData(0);
  assert.notEqual(firstBuffer[1800], upBuffer[1800], "Upstroke has distinct onset order");
  app.fire("langEn", "click");
  assert.equal(app.elements.get("strikeGuitarPattern").value, "up");
  assert.equal(app.contexts.length, 1, "Language change cannot create a second audio context");
});

test("percussion pads keep the existing drum mappings and stronger default after chimes relocation", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  assert.equal(app.elements.get("strikeStrengthValue").textContent, "55%");
  app.strikeButtons[1].click();
  assert.equal(app.elements.get("strikeStrengthValue").textContent, "78%",
    "Default drum strength increases without altering the guitar default");
  app.drumViewButtons[1].click();
  assert.equal(app.contexts.length, 0);
  assert.equal(app.elements.get("strikeDrumVoice").value, "membrane");
  await app.drumButtons[1].click();
  const context = app.contexts[0];
  assert.ok(Math.abs(context.gains.at(-1).gain.value - .21 * .78) < 1e-10,
    "Drum gain applies the distinct default strength through the original safety cap");
  const previous = context.sources[0];
  const families = [
    "snare", "cymbal", "steelpan", "woodblock"
  ];
  const waveforms = [];
  let hits = 1;
  for (const family of families) {
    app.elements.get("strikeDrumVoice").value = family;
    app.fire("strikeDrumVoice", "change");
    assert.equal(context.sources.length, hits, "Selecting percussion is silent");
    assert.equal(previous.stopped, true, "Changing to another family stops the old membrane");
    assert.equal(app.elements.get("strikeDrumVoice").value, family);
    assert.equal(app.elements.get("strikeDrumTensionGroup").hidden,
      family !== "snare", "Tension only applies to membranous percussion");
    assert.equal(app.elements.get("strikeStrengthValue").textContent, "78%");
    assert.ok(app.elements.get("strikeSpectrumHint").textContent.length > 0);
    assert.equal(app.drumButtons[1].textContent,
      { snare: "Дунд", cymbal: "Райд", steelpan: "Ми4",
        woodblock: "Дунд" }[family]);
    await app.drumButtons[1].click();
    hits++;
    waveforms.push(context.sources.at(-1).buffer.getChannelData(0)[400]);
    assert.equal(context.gains.at(-1).gain.value, .21 * .78);
    if (family === "cymbal") {
      assert.equal(app.elements.get("strikeDrumFrequencies").textContent, "Тогтмол нотгүй");
      assert.ok(app.elements.get("strikeSpectrumCanvas").drawnText.some(t => t.includes("6 кГц")),
        "Cymbal plot has a high-frequency axis, not the membrane-only axis");
    }
    if (family === "steelpan") {
      assert.equal(app.elements.get("strikeDrumFrequencies").textContent, "330 Гц");
      assert.ok(app.elements.get("strikeSpectrumCanvas").drawnText.some(t => t.includes("4 кГц")));
    }
    if (family === "woodblock") {
      assert.equal(app.elements.get("strikeDrumFrequencies").textContent, "Тогтмол нотгүй");
      assert.ok(app.elements.get("strikeSpectrumCanvas").drawnText.some(t => t.includes("5 кГц")));
    }
  }
  assert.equal(new Set(waveforms).size, 4, "Each remaining percussion family has distinct audio");
  app.fire("langEn", "click");
  assert.equal(app.drumButtons[1].textContent, "Mid");
  assert.equal(app.elements.get("strikeDrumFrequencies").textContent, "No fixed note");
  app.strikeButtons[0].click();
  assert.equal(app.elements.get("strikeStrengthValue").textContent, "55%",
    "Guitar maintains its original strength after playing percussion");
  app.strikeButtons[1].click();
  assert.equal(app.elements.get("strikeStrengthValue").textContent, "78%");
  app.fire("stopAll", "click");
  assert.ok(context.sources.every(source => source.stopped), "Global Stop silences the last hit");
});

test("D2e Strike/Pluck Kit plays the exact twelve Compose recipes while Models preserves size experiments", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  app.strikeButtons[1].click();
  assert.equal(app.elements.get("strikeDrumKitGroup").hidden, false);
  assert.equal(app.elements.get("strikeDrumModelsGroup").hidden, true);
  assert.equal(app.elements.get("strikeButton").hidden, true, "Kit pads replace the redundant single-hit button");
  const expected = require("./sound-score-player.js").DRUM_RECIPES;
  const waveformHeads = [];
  for (const drum of drumABC.DRUMS) {
    const pad = app.drumKitButtons.find(button => button.dataset.strikeKitDrum === drum.id);
    await pad.click();
    const context = app.contexts[0], played = context.sources.at(-1).buffer.getChannelData(0);
    const recipe = expected[drum.id];
    assert.equal(pad.getAttribute("aria-pressed"), "true", drum.id);
    assert.equal(app.elements.get("strikeDecay").value, String(recipe.decay), drum.id);
    assert.equal(context.gains.at(-1).gain.value, .21 * .78, drum.id);
    const reference = transientModel.makeSamples("kick", 220, recipe.decay,
      context.sampleRate, recipe.size, { position: .22, drumVoice: recipe.voice, drumTension: 1 });
    assert.equal(played[400], reference[400], drum.id + " uses the shared synthesis recipe");
    waveformHeads.push(Array.from(played.slice(380, 430)).map(x => x.toFixed(5)).join(","));
    assert.ok(context.sources.filter(source => !source.stopped).length <= 4,
      "Safety cap still limits overlapping drum hits");
  }
  assert.equal(new Set(waveformHeads).size, drumABC.DRUMS.length, "Every kit voice sounds different");
  app.fire("langEn", "click");
  assert.equal(app.drumKitButtons.find(button => button.dataset.strikeKitDrum === "highTom").textContent, "High tom");
  assert.equal(app.drumKitButtons.find(button => button.dataset.strikeKitDrum === "halfHat").textContent,
    "Half-open hi-hat");
  app.drumViewButtons[1].click();
  assert.equal(app.elements.get("strikeDrumKitGroup").hidden, true);
  assert.equal(app.elements.get("strikeDrumModelsGroup").hidden, false);
  await app.drumButtons[0].click();
  assert.equal(app.drumButtons[0].getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("strikeButton").hidden, false);
  app.drumViewButtons[0].click();
  assert.equal(app.elements.get("strikeDrumKitGroup").hidden, false);
  assert.equal(app.drumKitButtons.at(-1).getAttribute("aria-pressed"), "true");
});

test("D2c striking a closed kit hi-hat damps the earlier open hat, without choking other drums", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  app.strikeButtons[1].click();
  const hit = async id => app.drumKitButtons.find(button => button.dataset.strikeKitDrum === id).click();
  await hit("openHat");
  const open = app.contexts[0].sources.at(-1);
  assert.equal(open.stopped, false);
  await hit("snare");
  assert.equal(open.stopped, false, "Snare must not damp the open cymbal");
  await hit("hat");
  assert.equal(open.stopped, true, "Pedal-closed pad damps the previously open cymbal");
  const closed = app.contexts[0].sources.at(-1);
  assert.equal(closed.stopped, false, "The new closed-hat strike is still audible");
  await hit("halfHat");
  const half = app.contexts[0].sources.at(-1);
  await hit("ride");
  assert.equal(half.stopped, false, "Ride does not damp a half-open hi-hat");
  await hit("hat");
  assert.equal(half.stopped, true, "Closed pad damps the half-open hi-hat too");
  app.fire("stopAll", "click");
  assert.equal(closed.stopped, true);
});

test("D2f live Kit pedal changes a ringing cymbal without creating another strike", async () => {
  const app = fakePage("", true, null, true);
  app.fire("modeStrike", "click");
  app.strikeButtons[1].click();
  const hit = id => app.drumKitButtons.find(button => button.dataset.strikeKitDrum === id).click();
  await hit("openHat");
  const context = app.contexts[0], first = context.sources.at(-1);
  const firstGain = context.gains.at(-1).gain;
  assert.equal(app.elements.get("strikeHatPedalValue").textContent, "100%");
  const count = context.sources.length;
  app.tick(.08);
  app.elements.get("strikeHatPedal").value = "75";
  app.fire("strikeHatPedal", "input");
  assert.equal(context.sources.length, count, "Moving the pedal must not synthesize another hit");
  assert.equal(app.elements.get("strikeHatPedalValue").textContent, "75%");
  assert.ok(firstGain.records.some(record => record[0] === "target" &&
    record[3] === drumABC.hatPedalRelease(.75).timeConstant));
  assert.equal(first.stopped, true, "Live pedal schedules a finite end for the damped tail");
  app.tick(.02);
  app.elements.get("strikeHatPedal").value = "50";
  app.fire("strikeHatPedal", "input");
  assert.ok(Math.abs(first.stoppedAt - (context.currentTime + drumABC.hatPedalRelease(.5).seconds)) < 1e-9);
  app.tick(.02);
  app.elements.get("strikeHatPedal").value = "100";
  app.fire("strikeHatPedal", "input");
  assert.ok(Math.abs(first.stoppedAt - (first.startedAt + first.buffer.duration)) < 1e-9,
    "Reopening extends the surviving sample to natural decay");
  const held = firstGain.records.at(-1);
  assert.equal(held[0], "set", "Reopening cancels the extra release without creating new energy");
  assert.ok(held[1] > 0 && held[1] < .21 * .78);
  app.tick(.03);
  app.elements.get("strikeHatPedal").value = "0";
  app.fire("strikeHatPedal", "input");
  assert.ok(Math.abs(first.stoppedAt - (context.currentTime + .06)) < 1e-9);
  assert.equal(context.sources.length, count);

  await hit("openHat");
  const secondGain = context.gains.at(-1).gain;
  await hit("halfHat");
  assert.equal(app.elements.get("strikeHatPedal").value, "50");
  assert.ok(secondGain.records.some(record => record[0] === "target" &&
    record[3] === drumABC.hatPedalRelease(.5).timeConstant),
  "Striking a half-open hat also partly damps the previous open one");
  const halfGain = context.gains.at(-1).gain;
  await hit("hat");
  assert.equal(app.elements.get("strikeHatPedal").value, "0");
  assert.ok(halfGain.records.some(record => record[0] === "target" && record[3] === .009));
  app.fire("langEn", "click");
  assert.equal(app.elements.get("strikeHatPedal").value, "0", "Language does not reset the foot position");
  app.fire("strikeReset", "click");
  assert.equal(app.elements.get("strikeHatPedal").value, "100");
});

test("D2e Strike/Pluck strength changes drum waveform shape as well as live gain", async () => {
  const app = fakePage();
  app.fire("modeStrike", "click");
  app.strikeButtons[1].click();
  const snarePad = app.drumKitButtons.find(button => button.dataset.strikeKitDrum === "snare");
  const strikeAt = async strength => {
    app.elements.get("strikeStrength").value = String(strength);
    app.fire("strikeStrength", "input");
    await snarePad.click();
    const context = app.contexts[0];
    return { samples: context.sources.at(-1).buffer.getChannelData(0), gain: context.gains.at(-1).gain.value };
  };
  const quiet = await strikeAt(20), strong = await strikeAt(100);
  assert.equal(quiet.gain, .21 * .2);
  assert.equal(strong.gain, .21);
  assert.notEqual(quiet.samples[170], strong.samples[170], "Buffer content changes with force");
  assert.ok(strong.samples.slice(0, 320).reduce((sum, x) => sum + x * x, 0) >
    quiet.samples.slice(0, 320).reduce((sum, x) => sum + x * x, 0),
  "The louder strike has a stronger short, bright attack even before the gain stage");
});

test("D2b drum grid edits ghost, flam and roll without altering the untouched repeat pattern", () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.elements.get("ensemblePreset").value = "snareRudiments";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(app.elements.get("ensembleGridArticulation").value, "plain");
  const first = drumABC.parse(app.elements.get("ensembleText").value);
  assert.ok(drumABC.scheduledEvents(first).some(hit => hit.stroke === "flam-grace"));
  const originalPatterns = app.elements.get("ensemblePatternArrangement").children.map(x => x.textContent);
  app.elements.get("ensembleGridStrength").value = "ghost";
  app.elements.get("ensembleGridArticulation").value = "roll";
  app.elements.get("ensembleGridCells").children[1].children[1].children[2].click();
  const edited = drumABC.parse(app.elements.get("ensembleText").value);
  assert.ok(drumABC.scheduledEvents(edited).some(hit => hit.stroke === "roll-4"));
  assert.deepEqual(drumABC.gridOf(edited)[0].cells[2].snare,
    { velocity: drumABC.VELOCITIES.ghost, articulation: "roll" });
  assert.deepEqual(app.elements.get("ensemblePatternArrangement").children.map(x => x.textContent), originalPatterns);
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
  app.fire("langEn", "click");
  assert.equal(app.elements.get("ensembleGridArticulation").value, "roll",
    "Changing languages keeps the user's selected stroke technique");
});

test("held families keep morin khuur selectable, remember it, and never autoplay on navigation or translation", async () => {
  const app = fakePage();
  app.fire("modeSustain", "click");
  const menu = app.elements.get("sustainInstrument");
  assert.deepEqual(menu.children.map(option => option.value), ["flute", "clarinet"]);
  app.sustainButtons[1].click();
  assert.deepEqual(menu.children.map(option => option.value), ["violin", "morin"]);
  menu.value = "morin";
  app.fire("sustainInstrument", "change");
  assert.equal(menu.value, "morin");
  assert.equal(app.elements.get("sustainAttackValue").textContent, "0.11 сек");
  app.fire("langEn", "click");
  assert.equal(menu.value, "morin");
  assert.equal(menu.children[1].textContent, "Morin khuur");
  app.sustainButtons[0].click();
  assert.deepEqual(menu.children.map(option => option.value), ["flute", "clarinet"]);
  app.sustainButtons[1].click();
  assert.equal(menu.value, "morin", "returning to the bowed family remembers its instrument");
  assert.equal(app.contexts.length, 0);
  await app.fire("sustainToggleButton", "click");
  assert.equal(app.contexts[0].oscillators.length, 2);
  app.sustainButtons[0].click();
  assert.equal(app.elements.get("sustainToggleButton").getAttribute("aria-pressed"), "false");
  assert.ok(app.contexts[0].oscillators.every(source => source.stopped));
});

test("I2b Clarinet shows bounded Aerophone controls, odd harmonics and a releasable tongued voice", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeSustain", "click");
  const menu = app.elements.get("sustainInstrument");
  assert.deepEqual(menu.children.map(option => option.value), ["flute", "clarinet"]);
  menu.value = "clarinet";
  app.fire("sustainInstrument", "change");
  assert.equal(menu.value, "clarinet");
  assert.equal(app.contexts.length, 0, "selection never requests audio");
  assert.equal(app.elements.get("sustainBowGroup").hidden, true);
  assert.equal(app.elements.get("sustainBreathGroup").hidden, false);
  assert.equal(app.elements.get("sustainFrequencyInput").min, String(sustainModel.clarinet.MIN_HZ));
  assert.equal(app.elements.get("sustainFrequencyInput").max, String(sustainModel.clarinet.MAX_HZ));
  assert.match(app.elements.get("sustainMinHz").textContent, /146/);
  assert.match(app.elements.get("sustainMaxHz").textContent, /659/);
  assert.match(app.elements.get("sustainBreathHint").textContent, /odd harmonics/);
  assert.match(app.elements.get("sustainDetailHint").textContent, /reed-inspired/);
  assert.match(app.elements.get("sustainDescription").textContent, /concert pitch/i);
  const pitch = app.elements.get("sustainFrequencyInput");
  pitch.value = "100";
  app.fire("sustainFrequencyInput", "change");
  assert.match(app.elements.get("sustainStatus").textContent, /displayed range/);
  assert.equal(pitch.value, "440", "invalid frequency does not change the model");
  app.elements.get("sustainBreath").value = "88";
  app.fire("sustainBreath", "input");
  assert.equal(app.elements.get("sustainBreathValue").textContent, "88%");
  await app.fire("sustainToggleButton", "click");
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 2);
  assert.ok(context.filters.some(node => node.type === "bandpass"), "the tongue/air texture is filtered");
  const totalNodes = context.oscillators.length;
  app.elements.get("sustainBreath").value = "45";
  app.fire("sustainBreath", "input");
  assert.equal(context.oscillators.length, totalNodes, "live colour change does not create voices");
  app.fire("langMn", "click");
  assert.equal(menu.value, "clarinet");
  assert.equal(menu.children[1].textContent, "Кларнет");
  assert.match(app.elements.get("sustainBreathHint").textContent, /гармоник/);
  app.sustainButtons[1].click();
  app.sustainButtons[0].click();
  assert.equal(menu.value, "clarinet", "returning to Aerophones remembers Clarinet");
  assert.ok(context.oscillators.every(source => source.stopped), "switching families releases the note");
  app.fire("stopAll", "click");
  assert.equal(app.elements.get("sustainToggleButton").getAttribute("aria-pressed"), "false");
});

test("Pitched moves chimes without changing its recipe and gives bar voices a momentary Strike", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeStrike", "click");
  app.strikeButtons[2].click();
  const menu = app.elements.get("strikePianoType");
  menu.value = "chimes";
  app.fire("strikePianoType", "change");
  assert.equal(app.contexts.length, 0);
  assert.equal(app.elements.get("strikePianoPlayModes").hidden, true);
  assert.equal(app.elements.get("strikeButton").hidden, false);
  assert.equal(app.elements.get("strikeDrumSizeGroup").hidden, true);
  assert.equal(app.elements.get("strikePitchGroup").hidden, false);
  assert.equal(app.elements.get("strikeFrequencyInput").value, "659.26");
  assert.match(app.elements.get("strikeDescription").textContent, /inharmonic/);
  await app.fire("strikeButton", "click");
  const context = app.contexts[0];
  const samples = context.sources[0].buffer.getChannelData(0);
  const expected = transientModel.makeSamples("kick", 659.255114, .7, context.sampleRate,
    "medium", { drumVoice: "chimes", chimeHz: 659.255114, drumTension: 1 });
  assert.deepEqual(samples, expected, "UI relocation does not change the underlying chime sound");
  await app.fire("strikeButton", "click");
  assert.equal(context.sources.length, 2);
  assert.equal(context.sources[0].stopped, false, "repeated hits may ring together");
  menu.value = "acoustic";
  app.fire("strikePianoType", "change");
  assert.ok(context.sources.every(source => source.stopped));
  assert.equal(app.elements.get("strikePianoPlayModes").hidden, false);
  assert.equal(app.elements.get("strikeButton").hidden, true);
});

test("Marimba explorer uses the shared bar samples, full range, retained pitches and safe Stop", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeStrike", "click");
  app.strikeButtons[2].click();
  const menu = app.elements.get("strikePianoType");
  menu.value = "marimba";
  app.fire("strikePianoType", "change");
  assert.equal(app.contexts.length, 0);
  assert.equal(app.elements.get("strikeFrequencyInput").max, "1760");
  assert.equal(app.elements.get("strikeStrength").value, "62");
  assert.equal(app.elements.get("strikeDecay").value, "0.65");
  assert.match(app.elements.get("strikeSpectrumHint").textContent, /1 : 4 : 10/);
  app.elements.get("strikeFrequencyInput").value = "1760";
  app.fire("strikeFrequencyInput", "change");
  await app.fire("strikeButton", "click");
  const context = app.contexts[0];
  const actual = context.sources[0].buffer.getChannelData(0);
  const expected = transientModel.makeSamples("marimba", 1760, .65, context.sampleRate,
    "medium", { velocity: .62 });
  assert.deepEqual(actual, expected);
  app.elements.get("strikeFrequencyInput").value = "1761";
  app.fire("strikeFrequencyInput", "change");
  assert.match(app.elements.get("strikeStatus").textContent, /displayed range/);
  assert.equal(app.elements.get("strikeFrequencyInput").value, "1760");
  menu.value = "chimes";
  app.fire("strikePianoType", "change");
  assert.equal(app.elements.get("strikeFrequencyInput").value, "659.26");
  assert.equal(app.elements.get("strikeFrequencyInput").max, "880");
  menu.value = "marimba";
  app.fire("strikePianoType", "change");
  assert.equal(app.elements.get("strikeFrequencyInput").value, "1760");
  app.fire("langMn", "click");
  assert.equal(menu.value, "marimba");
  assert.match(app.elements.get("strikeDescription").textContent, /модон хавтан/);
  await app.fire("strikeButton", "click");
  app.fire("stopAll", "click");
  assert.ok(context.sources.every(source => source.stopped));
});

test("I2a Guitar sub-tab stays concise and Xylophone uses its own range and one-shot sample", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeStrike", "click");
  assert.match(browserCode, /pluck: "Guitar", kick:/);
  assert.doesNotMatch(browserCode, /pluck: "Guitar string", kick:/);
  app.strikeButtons[2].click();
  const menu = app.elements.get("strikePianoType");
  menu.value = "xylophone";
  app.fire("strikePianoType", "change");
  assert.equal(app.contexts.length, 0, "Selecting instruments never plays sound");
  assert.equal(app.elements.get("strikePianoPlayModes").hidden, true);
  assert.equal(app.elements.get("strikeButton").hidden, false);
  assert.equal(app.elements.get("strikeFrequencyInput").min, String(xylophoneModel.MIN_HZ));
  assert.equal(app.elements.get("strikeFrequencyInput").max, String(xylophoneModel.MAX_HZ));
  assert.equal(app.elements.get("strikeFrequencyInput").value, "523.25");
  assert.equal(app.elements.get("strikeStrength").value, "66");
  assert.equal(app.elements.get("strikeDecay").value, "0.32");
  assert.match(app.elements.get("strikeSpectrumHint").textContent, /1 : 3 : 6.16/);
  app.elements.get("strikeFrequencyInput").value = "523.251131";
  app.fire("strikeFrequencyInput", "change");
  await app.fire("strikeButton", "click");
  const context = app.contexts[0];
  assert.deepEqual(context.sources[0].buffer.getChannelData(0),
    transientModel.makeSamples("xylophone", 523.251131, .32, context.sampleRate,
      "medium", { velocity: .66 }));
  app.elements.get("strikeFrequencyInput").value = "220";
  app.fire("strikeFrequencyInput", "change");
  assert.match(app.elements.get("strikeStatus").textContent, /displayed range/);
  assert.equal(app.elements.get("strikeFrequencyInput").value, "523.25");
  menu.value = "marimba";
  app.fire("strikePianoType", "change");
  assert.equal(app.elements.get("strikeFrequencyInput").min, "110");
  menu.value = "xylophone";
  app.fire("strikePianoType", "change");
  assert.equal(app.elements.get("strikeFrequencyInput").value, "523.25");
  app.fire("langMn", "click");
  assert.equal(menu.value, "xylophone");
  assert.match(app.elements.get("strikeDescription").textContent, /Хатуу цохиур/);
  assert.match(app.elements.get("strikePitchMin").textContent, /Гц/);
  assert.equal(app.contexts.length, 1);
  app.fire("stopAll", "click");
  assert.ok(context.sources.every(source => source.stopped));
});

test("I2c Mandolin uses the Pitched picker, pluck/tremolo buttons and shared model plots", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeStrike", "click");
  app.strikeButtons[2].click();
  const menu = app.elements.get("strikePianoType");
  menu.value = "mandolin";
  app.fire("strikePianoType", "change");
  assert.equal(app.contexts.length, 0, "Selecting a string instrument cannot autoplay");
  assert.equal(app.elements.get("strikePianoPlayModes").hidden, true);
  assert.equal(app.elements.get("strikeMandolinPlayModes").hidden, false);
  assert.equal(app.elements.get("strikeButton").hidden, true);
  assert.equal(app.elements.get("strikeFrequencyInput").min, String(mandolinModel.MIN_HZ));
  assert.equal(app.elements.get("strikeFrequencyInput").max, String(mandolinModel.MAX_HZ));
  assert.equal(app.elements.get("strikeFrequencyInput").value, "440");
  assert.equal(app.elements.get("strikeStrength").value, "64");
  assert.equal(app.elements.get("strikeDecay").value, String(mandolinModel.DEFAULT_DECAY));
  assert.match(app.elements.get("strikeSpectrumHint").textContent, /detuning/);
  await app.mandolinPlayButtons[0].click();
  const context = app.contexts[0];
  assert.deepEqual(context.sources[0].buffer.getChannelData(0),
    transientModel.makeSamples("mandolin", 440, mandolinModel.DEFAULT_DECAY, context.sampleRate,
      "medium", { velocity: .64, articulation: "pick" }));
  await app.mandolinPlayButtons[1].click();
  assert.deepEqual(context.sources[1].buffer.getChannelData(0),
    transientModel.makeSamples("mandolin", 440, mandolinModel.DEFAULT_DECAY, context.sampleRate,
      "medium", { velocity: .64, articulation: "tremolo" }));
  assert.equal(context.sources[0].stopped, false, "New strokes can overlap naturally");
  app.fire("langMn", "click");
  assert.match(app.mandolinPlayButtons[0].textContent, /Татах/);
  assert.match(app.mandolinPlayButtons[1].textContent, /Тремоло/);
  app.fire("stopAll", "click");
  assert.ok(context.sources.every(source => source.stopped));
  menu.value = "acoustic";
  app.fire("strikePianoType", "change");
  assert.equal(app.elements.get("strikeMandolinPlayModes").hidden, true);
});

test("I3 harp appears in Pitched, strikes once, and plots the same deterministic long-tail model", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeStrike", "click"); app.strikeButtons[2].click();
  const menu = app.elements.get("strikePianoType");
  menu.value = "harp"; app.fire("strikePianoType", "change");
  assert.equal(app.contexts.length, 0);
  assert.equal(app.elements.get("strikePianoPlayModes").hidden, true);
  assert.equal(app.elements.get("strikeButton").hidden, false);
  assert.equal(app.elements.get("strikeButtonLabel").textContent, "Pluck");
  assert.equal(app.elements.get("strikeFrequencyInput").min, String(harpModel.MIN_HZ));
  assert.equal(app.elements.get("strikeFrequencyInput").max, String(harpModel.MAX_HZ));
  assert.equal(app.elements.get("strikeDecay").value, String(harpModel.DEFAULT_DECAY));
  assert.match(app.elements.get("strikeSpectrumHint").textContent, /soundboard/i);
  await app.fire("strikeButton", "click");
  const context = app.contexts[0];
  assert.equal(context.sources[0].buffer.length, 3 * context.sampleRate);
  assert.ok(context.sources[0].buffer.getChannelData(0).some(value => Math.abs(value) > .001));
  app.fire("langMn", "click");
  assert.equal(app.elements.get("strikeButtonLabel").textContent, "Татах");
  assert.match(app.elements.get("strikeDescription").textContent, /чавхдас/);
  app.fire("stopAll", "click");
  assert.equal(context.sources[0].stopped, true);
});

test("I3 organ and free-reed families keep selection, control pressure and release on switch", async () => {
  const app = fakePage("?lang=en"); app.fire("modeSustain", "click");
  const menu = app.elements.get("sustainInstrument");
  app.sustainButtons[2].click();
  assert.deepEqual(menu.children.map(option => option.value), ["organ-stopped", "organ-principal"]);
  assert.equal(menu.value, "organ-stopped");
  assert.equal(app.elements.get("sustainBowGroup").hidden, true);
  assert.match(app.elements.get("sustainBreathLabel").textContent, /Wind pressure/);
  assert.match(app.elements.get("sustainDescription").textContent, /stopped flue pipe/);
  menu.value = "organ-principal"; app.fire("sustainInstrument", "change");
  assert.match(app.elements.get("sustainChallengeText").textContent, /second harmonic/);
  assert.equal(app.contexts.length, 0, "changing the family never starts sound");
  await app.fire("sustainToggleButton", "click");
  const context = app.contexts[0];
  assert.ok(context.oscillators.some(source => source.periodicWave));
  app.sustainButtons[3].click();
  assert.ok(context.oscillators.every(source => source.stopped));
  assert.deepEqual(menu.children.map(option => option.value), ["accordion", "bayan"]);
  assert.match(app.elements.get("sustainBreathLabel").textContent, /Bellows pressure/);
  await app.fire("sustainToggleButton", "click");
  assert.equal(context.oscillators.filter(source => source.periodicWave && source.started && !source.stopped).length, 2,
    "musette uses two genuine detuned sound sources");
  app.elements.get("sustainBreath").value = "82"; app.fire("sustainBreath", "input");
  assert.equal(app.elements.get("sustainBreathValue").textContent, "82%");
  menu.value = "bayan"; app.fire("sustainInstrument", "change");
  assert.ok(context.oscillators.every(source => source.stopped));
  await app.fire("sustainToggleButton", "click");
  assert.equal(context.oscillators.filter(source => source.periodicWave && source.started && !source.stopped).length, 1,
    "bayan uses the dry single rank");
  app.sustainButtons[2].click();
  assert.equal(menu.value, "organ-principal", "organ selection survives another family");
  app.fire("stopAll", "click");
});

test("restoring an instrument pitch respects Snap even when its saved pitch was unsnapped", () => {
  const app = fakePage("?lang=en");
  app.fire("modeStrike", "click");
  app.elements.get("strikeFrequencyInput").value = "217";
  app.fire("strikeFrequencyInput", "change");
  app.strikeButtons[2].click();
  app.elements.get("strikeFrequencyInput").value = "437";
  app.fire("strikeFrequencyInput", "change");
  const menu = app.elements.get("strikePianoType");
  menu.value = "marimba";
  app.fire("strikePianoType", "change");
  app.elements.get("strikeSnap").checked = true;
  app.fire("strikeSnap", "change");
  menu.value = "acoustic";
  app.fire("strikePianoType", "change");
  assert.equal(app.elements.get("strikeFrequencyInput").value, "440");
  assert.equal(app.elements.get("strikeSnap").checked, true);
  assert.doesNotMatch(app.elements.get("strikeNote").textContent, /≈/);
  app.strikeButtons[0].click();
  assert.equal(app.elements.get("strikeFrequencyInput").value, "220");
  assert.equal(app.contexts.length, 0);
});

test("Compose C1 renders a four-bar staff, stays silent until Play and responds to global Stop", async () => {
  const app = fakePage();
  assert.equal(app.contexts.length, 0, "Loading the page or parsing the default score is silent");
  app.fire("modeCompose", "click");
  assert.equal(app.elements.get("composeWorkspace").hidden, false);
  assert.match(app.elements.get("composeStatus").textContent, /Бэлэн/,
    "Opening Compose before playback shows Ready, not Stopped");
  assert.equal(app.elements.get("pureWorkspace").hidden, true);
  assert.match(app.elements.get("composeMeta").textContent, /4 такт/);
  assert.ok(app.elements.get("composeScoreSvg").children.length >= 14,
    "Staff lines, note groups and bar numbers are drawn from the parsed notes");
  assert.equal(app.contexts.length, 0);

  await app.fire("composePlayPause", "click");
  assert.equal(app.contexts.length, 1);
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 1);
  assert.ok(context.oscillators[0].started);
  assert.ok(app.elements.get("composeNow").textContent.includes("До") ||
    app.elements.get("composeNow").textContent.includes("C4"));
  assert.ok([...app.timers.values()].some(timer => timer.delay === 35),
    "The composer schedules notes against the Web Audio clock");
  app.fire("composePlayPause", "click");
  assert.match(app.elements.get("composeStatus").textContent, /Түр зогслоо/);
  assert.ok(![...app.timers.values()].some(timer => timer.delay === 35));
  await app.fire("composePlayPause", "click");
  assert.ok([...app.timers.values()].some(timer => timer.delay === 35));
  app.fire("stopAll", "click");
  assert.ok(![...app.timers.values()].some(timer => timer.delay === 35));
  assert.match(app.elements.get("composeStatus").textContent, /Зогслоо/);

  app.fire("langEn", "click");
  assert.match(app.elements.get("composeMeta").textContent, /4 bars/);
  assert.equal(app.contexts.length, 1, "Language switching doesn't start audio");
});

test("Compose Pause during delayed Safari audio startup cancels the note and then resumes", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  let unlock;
  const gate = new Promise(resolve => { unlock = resolve; });
  const BaseAudioContext = app.window.AudioContext;
  app.window.AudioContext = class DelayedAudioContext extends BaseAudioContext {
    async resume() { await gate; return super.resume(); }
  };
  const pending = app.fire("composePlayPause", "click");
  assert.equal(app.contexts.length, 1);
  assert.match(app.elements.get("composePlayPause").textContent, /Түр зогсоох/,
    "Pause must be available even while AudioContext is unlocking");
  app.fire("composePlayPause", "click");
  assert.match(app.elements.get("composeStatus").textContent, /Түр зогслоо/);
  unlock();
  await pending;
  assert.equal(app.contexts[0].oscillators.length, 0, "Pause prevents a late ghost note");
  await app.fire("composePlayPause", "click");
  assert.equal(app.contexts[0].oscillators.length, 1);
  app.fire("composeStop", "click");
});

test("Compose C1 validates edits and loads local ABC scores without autoplay", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.elements.get("composeExample").value = "waltz";
  app.fire("composeExample", "change");
  assert.match(app.elements.get("composeText").value, /M:3\/4/);
  assert.equal(app.contexts.length, 0);
  assert.match(app.elements.get("composeMeta").textContent, /4 такт/);
  app.elements.get("composeText").value = "M:4/4\nL:1/4\nQ:1/4=100\nK:C\nC3 D2 | E4 |]";
  app.fire("composeText", "input");
  await app.fire("composePlayPause", "click");
  assert.equal(app.elements.get("composePlayPause").disabled, true);
  assert.match(app.elements.get("composeStatus").textContent, /алдаа/);
  assert.equal(app.contexts.length, 0);
  app.fire("langEn", "click");
  assert.match(app.elements.get("composeStatus").textContent, /Score error/,
    "An invalid ABC score must remain visibly invalid when switching language");
  assert.equal(app.elements.get("composeStop").textContent, "■ Stop");
  assert.equal(app.elements.get("composeNow").textContent, "No valid score yet");
  app.fire("langMn", "click");

  const source = composeModel.EXAMPLES.minor;
  const file = { name: "little.abc", size: source.length, text: async () => source };
  await app.fire("composeLoad", "change", { target: { files: [file] } });
  assert.equal(app.elements.get("composePlayPause").disabled, false);
  assert.equal(app.elements.get("composeText").value, source);
  assert.match(app.elements.get("composeMeta").textContent, /Minor melody · 4 такт/);
  assert.equal(app.contexts.length, 0, "Importing an ABC file never autoplays");

  app.elements.get("composeInstrument").value = "chimes";
  app.fire("composeInstrument", "change");
  await app.fire("composePlayPause", "click");
  assert.equal(app.contexts.length, 1);
  assert.ok(app.contexts[0].sources.length > 0);
  app.fire("modeStrike", "click");
  assert.equal(app.elements.get("composeWorkspace").hidden, true);
  assert.ok(![...app.timers.values()].some(timer => timer.delay === 35));
});

test("Compose electronic voices switch without autoplay and follow MN/EN labels", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  for (const instrument of ["sine", "triangle", "square", "sawtooth", "fmep"]) {
    app.elements.get("composeInstrument").value = instrument;
    app.fire("composeInstrument", "change");
    assert.equal(app.contexts.length, 0, "Changing timbres must remain silent");
    assert.equal(app.elements.get("composePlayPause").disabled, false);
  }
  app.fire("langEn", "click");
  assert.equal(app.elements.get("composeInstrument").value, "fmep");
  assert.equal(composeModel.UI.en.fmep, "FM electric piano");
  assert.equal(composeModel.UI.mn.fmep, "Цахилгаан хуур");
  assert.equal(composeModel.UI.mn.square, "Дөрвөлжин долгион");
  await app.fire("composePlayPause", "click");
  assert.equal(app.contexts.length, 1);
  assert.equal(app.contexts[0].sources.length, 1,
    app.elements.get("composeStatus").textContent + " · buffers=" + app.contexts[0].buffers.length);
  app.fire("composeStop", "click");
  assert.ok(![...app.timers.values()].some(timer => timer.delay === 35));
});

test("published melody choices, including Russian folk tunes, load silently and remain bilingual", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  for (const [choice, bars] of [["ode", 16], ["minuetG", 32], ["lightly", 16],
    ["mozart40", 20], ["frere", 8], ["twinkle", 12],
    ["korobeiniki", 16], ["kalinka", 27], ["birch", 8]]) {
    app.elements.get("composeExample").value = choice;
    app.fire("composeExample", "change");
    assert.equal(app.elements.get("composeText").value, composeModel.EXAMPLES[choice], choice);
    assert.match(app.elements.get("composeMeta").textContent, new RegExp(`${bars} такт`), choice);
    assert.equal(app.elements.get("composePlayPause").disabled, false, choice);
    assert.equal(app.elements.get("composeInstrument").value, composeModel.EXAMPLE_INFO[choice].instrument);
    assert.equal(app.elements.get("composePresetInfo").hidden, false);
    assert.equal(app.elements.get("composeSource").href, composeModel.EXAMPLE_INFO[choice].source);
    assert.equal(app.contexts.length, 0, `${choice} loads without autoplay`);
  }
  app.fire("langEn", "click");
  assert.match(app.elements.get("composeMeta").textContent, /8 bars/);
  app.elements.get("composeExample").value = "mozart40";
  app.fire("composeExample", "change");
  assert.match(app.elements.get("composeMeta").textContent, /20 bars/);
  assert.equal(app.elements.get("composeSource").textContent, "Score source");
  app.elements.get("composeInstrument").value = "guitar";
  app.fire("composeInstrument", "change");
  app.fire("langMn", "click");
  assert.equal(app.elements.get("composeInstrument").value, "guitar",
    "Language switching preserves the instrument chosen after loading a preset");
  assert.equal(app.elements.get("composeSource").textContent, "Нотын эх сурвалж");
  assert.equal(app.contexts.length, 0);
});

test("Compose guitar controls preserve technique across language/instrument changes and stop every strummed voice", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  assert.equal(app.elements.get("composeGuitarControls").hidden, true);
  app.elements.get("composeExample").value = "strum";
  app.fire("composeExample", "change");
  assert.equal(app.elements.get("composeInstrument").value, "guitar");
  assert.equal(app.elements.get("composeGuitarControls").hidden, false);
  assert.equal(app.elements.get("composeGuitarMode").value, "alternate");
  assert.equal(app.elements.get("composePlayPause").disabled, false, "Low G2 in the exercise is supported");
  assert.equal(app.contexts.length, 0);
  app.elements.get("composeGuitarSpacing").value = "30";
  app.fire("composeGuitarSpacing", "input");
  app.fire("langEn", "click");
  assert.equal(app.elements.get("composeGuitarSpacingValue").textContent, "30 ms");
  app.elements.get("composeInstrument").value = "piano";
  app.fire("composeInstrument", "change");
  assert.equal(app.elements.get("composeGuitarControls").hidden, true);
  app.elements.get("composeInstrument").value = "guitar";
  app.fire("composeInstrument", "change");
  assert.equal(app.elements.get("composeGuitarMode").value, "alternate");
  assert.equal(app.elements.get("composeGuitarSpacing").value, "30");
  const source = "M:4/4\nL:1/4\nQ:1/4=100\nK:C\n[C,E,G,CE]4 |]";
  await app.fire("composeLoad", "change", { target: { files: [{ name: "chord.abc", size: source.length,
    text: async () => source }] } });
  await app.fire("composePlayPause", "click");
  const voices = app.contexts[0].sources;
  assert.equal(voices.length, 5);
  for (let i = 1; i < voices.length; i++) {
    assert.ok(Math.abs(voices[i].startedAt - voices[i - 1].startedAt - .03) < 1e-8,
      "The chosen spacing reaches the audio scheduler");
  }
  app.fire("stopAll", "click");
  assert.ok(voices.every(voice => voice.stopped), "Global Stop includes delayed string attacks");
  app.elements.get("composeGuitarMode").value = "pluck";
  app.fire("composeGuitarMode", "change");
  assert.equal(app.elements.get("composeGuitarSpacingGroup").hidden, true);
});

test("ensemble guitar controls belong to one track, survive selection/language changes, and reset on preset load", () => {
  const app = fakePage();
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  const guitarControls = () => {
    const nodes = descendants(app.elements.get("ensembleTrackList"));
    return { mode: nodes.find(node => node.className === "ensemble-guitar-mode"),
      spacing: nodes.find(node => node.className === "ensemble-guitar-spacing") };
  };
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.elements.get("ensemblePreset").value = "guitarStrum";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(app.elements.get("ensembleTrackList").children.length, 3);
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
  assert.equal(guitarControls().mode.value, "alternate");
  let controls = guitarControls();
  controls.mode.value = "up";
  controls.mode.events.change();
  assert.equal(guitarControls().mode, controls.mode, "Changing direction keeps the keyboard-focused select");
  controls = guitarControls();
  controls.spacing.value = "45";
  controls.spacing.events.input();
  assert.equal(guitarControls().spacing, controls.spacing, "Dragging does not rebuild or lose the slider");
  app.elements.get("ensembleTrackList").children[1].children[0].children[0].click();
  assert.match(app.elements.get("ensembleText").value, /original bass/);
  app.fire("langEn", "click");
  controls = guitarControls();
  assert.equal(controls.mode.value, "up");
  assert.equal(controls.spacing.value, "45");
  assert.match(controls.mode.getAttribute("aria-label"), /Guitar technique/);
  assert.equal(app.contexts.length, 0, "Changing technique or language never autoplays");
  app.fire("ensembleApplyPreset", "click");
  assert.equal(guitarControls().mode.value, "alternate");
  assert.equal(guitarControls().spacing.value, "20");
  app.elements.get("ensemblePreset").value = "chopin7";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(guitarControls().mode, undefined, "Piano tracks have no guitar controls");
});

test("D2c drum feel is a per-track bilingual control, persists through Save/Open and leaves ABC untouched", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.elements.get("ensemblePreset").value = "swingHats";
  app.fire("ensembleApplyPreset", "click");
  const before = app.elements.get("ensembleText").value;
  const findFeel = () => projectTrackControl(app, 0, "ensemble-drum-feel");
  assert.equal(findFeel().value, "swing");
  assert.match(findFeel().getAttribute("aria-label"), /Rhythmic feel/);
  let select = findFeel();
  select.value = "light";
  select.events.change();
  assert.equal(findFeel().value, "light");
  assert.equal(app.elements.get("ensembleText").value, before,
    "Rhythmic feel changes scheduling, not the written percussion part");
  app.fire("langMn", "click");
  assert.equal(findFeel().value, "light");
  assert.match(findFeel().getAttribute("aria-label"), /Хэмнэлийн мэдрэмж/);
  const saved = await saveNativeProject(app);
  assert.equal(saved.data.content.tracks[0].drumFeel, "light");
  assert.equal(saved.data.content.tracks[0].abc, ensemblePresets.create("swingHats", "en")[0].abc,
    "The saved song contains every repeated bar, not only the selected pattern editor's ABC");
  app.elements.get("ensemblePreset").value = "drumKitSolo";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(findFeel().value, "straight", "Other existing examples default to straight timing");
  assert.equal(await offerNativeProject(app, saved.text), true);
  assert.equal(app.fire("projectReplace", "click"), true);
  assert.equal(findFeel().value, "light");
  assert.equal(app.elements.get("ensembleText").value, before);
  assert.equal(app.contexts.length, 0, "Translation and file operations must not start audio");
});

test("D2d drum touch and sticking stay bilingual and editable with linked patterns and Save/Open", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.elements.get("ensemblePreset").value = "stickingRudiments";
  app.fire("ensembleApplyPreset", "click");
  const findTouch = () => projectTrackControl(app, 0, "ensemble-drum-touch");
  assert.equal(findTouch().value, "expressive");
  assert.match(findTouch().getAttribute("aria-label"), /Stroke dynamics/);
  const source = app.elements.get("ensembleText").value;
  assert.match(source, /!R!/);
  assert.match(source, /!L!/);
  findTouch().value = "even";
  findTouch().events.change();
  assert.equal(app.elements.get("ensembleText").value, source,
    "Changing stroke dynamics does not rewrite authored notes or pattern links");
  app.elements.get("ensembleGridStrength").value = "p";
  app.elements.get("ensembleGridArticulation").value = "flam";
  app.elements.get("ensembleGridHand").value = "L";
  app.elements.get("ensembleGridCells").children[1].children[1].children[1].click();
  const edited = drumABC.parse(app.elements.get("ensembleText").value);
  assert.deepEqual(drumABC.gridOf(edited)[0].cells[1].snare,
    { velocity: .55, articulation: "flam", hand: "L" });
  const saved = await saveNativeProject(app);
  const full = drumABC.gridOf(drumABC.parse(saved.data.content.tracks[0].abc));
  assert.equal(full[1].cells[1].snare.hand, "L",
    "Editing linked pattern A also changes its repeated occurrence");
  assert.equal(saved.data.content.editor.gridHand, "L");
  assert.equal(saved.data.content.tracks[0].drumTouch, "even");
  app.fire("langMn", "click");
  assert.equal(findTouch().value, "even");
  assert.match(findTouch().getAttribute("aria-label"), /Цохилтын хүчний хэм/);
  assert.equal(app.elements.get("ensembleGridHand").value, "L");
  app.elements.get("ensemblePreset").value = "snareStudy";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(findTouch().value, "even");
  assert.equal(await offerNativeProject(app, saved.text), true);
  assert.equal(app.fire("projectReplace", "click"), true);
  assert.equal(app.elements.get("ensembleGridHand").value, "L");
  assert.equal(app.elements.get("ensembleText").value,
    drumPatterns.patternABC(saved.data.content.tracks[0].patterns,
      saved.data.content.tracks[0].patternId));
  assert.equal(app.contexts.length, 0, "Editing and restoring patterns never starts sound");
});

test("the three sourced songs load silently in Solo and Ensemble with editable guitar parts", () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  for (const [choice, title, count] of [
    ["greensleeves", /Greensleeves/, 3], ["daisy", /Daisy Bell/, 4], ["paloma", /La Paloma/, 4]
  ]) {
    app.composeSubtabButtons[0].click();
    app.elements.get("composeExample").value = choice;
    app.fire("composeExample", "change");
    assert.match(app.elements.get("composeText").value, title);
    assert.match(app.elements.get("composeText").value, /% Source: https:\/\//);
    assert.equal(app.elements.get("composePlayPause").disabled, false);
    assert.equal(app.elements.get("composePresetInfo").hidden, false);
    assert.match(app.elements.get("composeSource").href, /^https:\/\//);
    app.composeSubtabButtons[1].click();
    app.elements.get("ensemblePreset").value = choice;
    app.fire("ensembleApplyPreset", "click");
    assert.equal(app.elements.get("ensembleTrackList").children.length, count);
    assert.equal(app.elements.get("ensembleTimeline").children.length, count);
    assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
    assert.match(app.elements.get("ensembleText").value, title);
    app.elements.get("ensembleTrackList").children[1].children[0].children[0].click();
    assert.match(app.elements.get("ensembleText").value, /original guitar/);
    const descendants = node => [node, ...node.children.flatMap(descendants)];
    const mode = descendants(app.elements.get("ensembleTrackList"))
      .find(node => node.className === "ensemble-guitar-mode");
    assert.ok(["down", "alternate"].includes(mode.value), "The accompaniment starts with strumming enabled");
    app.fire("langEn", "click");
    assert.match(app.elements.get("ensembleEditorTitle").textContent, /ABC for the selected track/);
    app.fire("langMn", "click");
    assert.equal(app.contexts.length, 0, "Loading, selecting and translating song parts never autoplays");
  }
});

test("Compose draws ties across staff rows and keeps long-score playback visible", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  const scroll = app.elements.get("composeScoreScroll");
  scroll.clientWidth = 390;
  scroll.clientHeight = 300;
  const positions = [];
  scroll.scrollTo = position => positions.push(position);
  const source = "T:Tied pickup\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nC | C4 | C4 | C4- | C4 |]";
  await app.fire("composeLoad", "change", { target: { files: [{ name: "ties.abc", size: source.length,
    text: async () => source }] } });
  const svg = app.elements.get("composeScoreSvg");
  assert.equal(svg.children.find(node => node.getAttribute("class") === "compose-bar-number").textContent, "0");
  const paths = svg.children.flatMap(node => node.children).filter(node => node.tagName === "path");
  assert.equal(paths.filter(node => node.getAttribute("class") === "compose-tie").length, 2,
    "A tie crossing a row break is visible at both row edges");
  assert.equal(app.contexts.length, 0, "Rendering a tied imported score is silent");
  await app.fire("composePlayPause", "click");
  app.contexts[0].currentTime = 7;
  [...app.timers.values()].find(timer => timer.delay === 35).callback();
  assert.ok(positions.at(-1).top > 0, "The staff follows playback into the next row");
  app.fire("stopAll", "click");
});

test("Pure tones keeps waveforms and timbre together with independent settings and bilingual accessible selectors", () => {
  const app = fakePage();
  assert.equal(app.pureKindButtons.length, 4);
  assert.equal(app.pureKindGroups.length, 2);
  assert.deepEqual(app.pureKindButtons.map(button => button.textContent),
    ["Долгионы хэлбэр", "Өнгө бүтээх", "Долгионы хэлбэр", "Өнгө бүтээх"]);
  assert.ok(app.pureKindGroups.every(group => /Долгионы хэлбэр ба өнгөний/.test(group.getAttribute("aria-label"))));
  assert.equal(app.elements.get("pureWorkspace").hidden, false);
  assert.equal(app.elements.get("pureChallenge").hidden, false);
  assert.equal(app.elements.get("pureExplanation").hidden, false);
  assert.equal(app.elements.get("harmonicWorkspace").hidden, true);
  assert.equal(app.elements.get("harmonicChallenge").hidden, true);
  assert.equal(app.elements.get("harmonicExplanation").hidden, true);
  app.waveButtons[1].click();
  app.elements.get("frequencyInput").value = "660";
  app.fire("frequencyInput", "change");
  app.elements.get("volumeSlider").value = "63";
  app.fire("volumeSlider", "input");
  app.pureKindButtons[1].click();
  assert.equal(app.elements.get("modePure").getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("modeMix").getAttribute("aria-pressed"), "false");
  assert.equal(app.elements.get("pureWorkspace").hidden, true);
  assert.equal(app.elements.get("pureChallenge").hidden, true);
  assert.equal(app.elements.get("pureExplanation").hidden, true);
  assert.equal(app.elements.get("harmonicWorkspace").hidden, false);
  assert.equal(app.elements.get("harmonicChallenge").hidden, false);
  assert.equal(app.elements.get("harmonicExplanation").hidden, false);
  assert.equal(app.elements.get("mixWorkspace").hidden, true);
  assert.equal(app.elements.get("noiseWorkspace").hidden, true);
  for (const index of [1, 3]) assert.equal(app.pureKindButtons[index].getAttribute("aria-pressed"), "true");
  for (const index of [0, 2]) assert.equal(app.pureKindButtons[index].getAttribute("aria-pressed"), "false");
  app.elements.get("harmonicBaseInput").value = "330";
  app.fire("harmonicBaseInput", "change");
  app.elements.get("harmonicVolume").value = "28";
  app.fire("harmonicVolume", "input");
  app.harmonicPresetButtons[2].click();
  app.harmonicLevelInputs[2].events.input({ target: { value: "70" } });
  app.fire("langEn", "click");
  assert.deepEqual(app.pureKindButtons.map(button => button.textContent),
    ["Waveforms", "Build timbre", "Waveforms", "Build timbre"]);
  assert.ok(app.pureKindGroups.every(group => group.getAttribute("aria-label") === "Wave shapes and timbre experiments"));
  assert.equal(app.pureKindButtons[3].getAttribute("aria-pressed"), "true");
  app.pureKindButtons[2].click();
  assert.equal(app.elements.get("pureWorkspace").hidden, false);
  assert.equal(app.elements.get("harmonicWorkspace").hidden, true);
  assert.equal(app.elements.get("frequencyInput").value, "660");
  assert.equal(app.elements.get("volumeSlider").value, "63");
  assert.equal(app.waveButtons[1].getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("harmonicBaseInput").value, "330");
  assert.equal(app.elements.get("harmonicVolume").value, "28");
  assert.equal(app.elements.get("harmonicLevelValue3").textContent, "70%");
  const harmonicDraws = app.elements.get("harmonicWaveCanvas").drawnText.length;
  app.harmonicLevelInputs[3].events.input({ target: { value: "65" } });
  assert.equal(app.elements.get("harmonicWaveCanvas").drawnText.length, harmonicDraws,
    "An inactive timbre panel does not redraw its plots");
  app.pureKindButtons[1].click();
  assert.ok(app.elements.get("harmonicWaveCanvas").drawnText.length > harmonicDraws);
  assert.equal(app.elements.get("harmonicLevelValue4").textContent, "65%");
  app.fire("modeMotion", "click");
  assert.equal(app.elements.get("harmonicWorkspace").hidden, true);
  app.fire("modePure", "click");
  assert.equal(app.elements.get("harmonicWorkspace").hidden, false, "Returning to Pure tones keeps its chosen subpanel");
  assert.equal(app.elements.get("harmonicBaseInput").value, "330");
  assert.equal(app.elements.get("harmonicLevelValue3").textContent, "70%");
  assert.equal(app.contexts.length, 0, "Panel changes, language and settings never autoplay");
});

test("switching Pure-tone panels silences the previous voice and hidden Play controls cannot start audio", async () => {
  const app = fakePage();
  await app.fire("harmonicButton", "click");
  assert.equal(app.contexts.length, 0, "A hidden timbre Play control cannot initialize audio");
  await app.fire("playButton", "click");
  const context = app.contexts[0], wave = context.oscillators[0];
  assert.equal(wave.stopped, false);
  app.pureKindButtons[1].click();
  assert.equal(wave.stopped, true);
  assert.equal(app.elements.get("playButton").getAttribute("aria-pressed"), "false");
  await app.fire("playButton", "click");
  assert.equal(context.oscillators.length, 1, "Hidden waveform Play is inert in the timbre panel");
  await app.fire("harmonicButton", "click");
  const timbre = context.oscillators[1];
  assert.equal(timbre.stopped, false);
  assert.equal(app.elements.get("harmonicButton").getAttribute("aria-pressed"), "true");
  app.pureKindButtons[2].click();
  assert.equal(timbre.stopped, true);
  assert.equal(app.elements.get("harmonicButton").getAttribute("aria-pressed"), "false");
  assert.equal(context.oscillators.length, 2, "Switching panels does not start a replacement voice");
  app.fire("modeMix", "click");
  app.pureKindButtons[1].click();
  await app.fire("harmonicButton", "click");
  await app.fire("playButton", "click");
  assert.equal(context.oscillators.length, 2, "Hidden Pure controls remain inert in another top-level tab");
  app.fire("modePure", "click");
  assert.equal(app.elements.get("pureWorkspace").hidden, false, "A hidden selector cannot change the remembered subpanel");
});

test("Pure-tone panel changes cancel pending wave and timbre starts in both directions", async () => {
  for (const startingKind of ["waves", "harmonics"]) {
    const app = fakePage();
    if (startingKind === "harmonics") app.pureKindButtons[1].click();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const BaseAudioContext = app.window.AudioContext;
    app.window.AudioContext = class DelayedAudioContext extends BaseAudioContext {
      async resume() { await gate; return super.resume(); }
    };
    const pending = app.fire(startingKind === "waves" ? "playButton" : "harmonicButton", "click");
    assert.equal(app.contexts.length, 1);
    app.pureKindButtons[startingKind === "waves" ? 1 : 2].click();
    release();
    await pending;
    assert.equal(app.contexts[0].oscillators.length, 0, startingKind + " must not start after its panel is hidden");
    assert.equal(app.elements.get("playButton").getAttribute("aria-pressed"), "false");
    assert.equal(app.elements.get("harmonicButton").getAttribute("aria-pressed"), "false");
    assert.equal(app.elements.get("harmonicWorkspace").hidden, startingKind === "harmonics");
  }
});

test("a late rejected Pure-tone start cannot suspend or relabel the newer panel's playing voice", async () => {
  for (const failingKind of ["waves", "harmonics"]) {
    const app = fakePage("?lang=en");
    if (failingKind === "harmonics") app.pureKindButtons[1].click();
    let rejectFirst;
    const gate = new Promise((_, reject) => { rejectFirst = reject; });
    const BaseAudioContext = app.window.AudioContext;
    app.window.AudioContext = class FirstResumeFailsLate extends BaseAudioContext {
      async resume() {
        this.resumeCount = (this.resumeCount || 0) + 1;
        if (this.resumeCount === 1) await gate;
        return super.resume();
      }
    };
    const pending = app.fire(failingKind === "waves" ? "playButton" : "harmonicButton", "click");
    app.pureKindButtons[failingKind === "waves" ? 1 : 2].click();
    const nextButton = failingKind === "waves" ? "harmonicButton" : "playButton";
    await app.fire(nextButton, "click");
    const context = app.contexts[0], current = context.oscillators.at(-1);
    assert.equal(context.state, "running");
    assert.equal(context.oscillators.length, 1);
    rejectFirst(new Error("late browser resume failure"));
    await pending;
    assert.equal(context.state, "running", "An obsolete rejection must not suspend the shared context");
    assert.equal(current.stopped, false);
    assert.equal(app.elements.get(nextButton).getAttribute("aria-pressed"), "true");
    assert.equal(app.elements.get("audioStatus").classList.contains("error"), false);
    assert.equal(app.elements.get("harmonicStatus").classList.contains("error"), false);
    app.fire("stopAll", "click");
  }
});

test("harmonic builder is an interactive eight-partial synthesis without autoplay", async () => {
  const app = fakePage();
  app.pureKindButtons[1].events.click();
  assert.equal(app.contexts.length, 0);
  assert.equal(app.elements.get("mixWorkspace").hidden, true);
  assert.equal(app.elements.get("harmonicWorkspace").hidden, false);
  assert.equal(app.elements.get("harmonicExplanation").hidden, false);
  assert.equal(app.elements.get("noiseWorkspace").hidden, true);
  assert.equal(app.elements.get("pureWorkspace").hidden, true);
  assert.equal(app.elements.get("modePure").getAttribute("aria-pressed"), "true");
  assert.equal(app.harmonicLevelInputs.length, 8);
  assert.equal(app.elements.get("harmonicLevelValue1").textContent, "100%");
  app.harmonicPresetButtons[2].events.click();
  assert.equal(app.elements.get("harmonicLevelValue2").textContent, "50%");
  app.harmonicLevelInputs[2].events.input({ target: { value: "70" } });
  assert.equal(app.elements.get("harmonicLevelValue3").textContent, "70%");
  assert.ok(app.elements.get("harmonicWaveCanvas").drawnText.some(label => label.endsWith("мсек")));
  await app.fire("harmonicButton", "click");
  const context = app.contexts[0];
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].periodicWave.imag[3], Math.fround(0.7));
  assert.equal(context.oscillators[0].frequency.value, 220);
  assert.ok(Math.abs(context.gains.at(-1).gain.value - .084) < 1e-12);
  app.elements.get("harmonicBaseInput").value = "330";
  app.fire("harmonicBaseInput", "change");
  assert.equal(context.oscillators[0].frequency.value, 330);
  app.harmonicPresetButtons[0].events.click();
  assert.equal(context.oscillators.length, 2, "New periodic wave crossfades to a new oscillator");
  assert.equal(context.oscillators[0].stopped, true);
  app.elements.get("harmonicBaseInput").value = "9999";
  app.fire("harmonicBaseInput", "change");
  assert.equal(app.elements.get("harmonicBaseInput").value, "330");
  assert.equal(app.elements.get("harmonicStatus").classList.contains("error"), true);
  app.fire("harmonicReset", "click");
  assert.equal(app.elements.get("harmonicBaseInput").value, "220");
  assert.equal(app.elements.get("harmonicLevelValue3").textContent, "0%");
  assert.ok(context.oscillators.every(oscillator => oscillator.stopped));
});

test("noise colors loop filtered model buffers safely; changing experiment silences them", async () => {
  const app = fakePage();
  app.fire("modeMix", "click");
  app.mixKindButtons[1].events.click();
  assert.equal(app.contexts.length, 0);
  assert.equal(app.elements.get("noiseWorkspace").hidden, false);
  assert.equal(app.elements.get("noiseChallenge").hidden, false);
  assert.match(app.elements.get("noiseColorDescription").textContent, /герцийн зурвас/);
  assert.ok(app.elements.get("noiseSpectrumCanvas").drawnText.some(label => label.includes("Гц")));
  await app.fire("noiseButton", "click");
  const context = app.contexts[0];
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].loop, true);
  assert.equal(context.filters.length, 1);
  assert.equal(context.filters[0].type, "lowpass");
  assert.equal(context.gains.at(-1).gain.value, .2 * .25);
  app.noiseColorButtons[1].events.click();
  assert.equal(context.sources.length, 2);
  assert.equal(context.sources[0].stopped, true);
  assert.match(app.elements.get("noiseColorDescription").textContent, /октав/);
  app.elements.get("noiseCutoff").value = "1200";
  app.fire("noiseCutoff", "input");
  assert.equal(context.filters.at(-1).frequency.value, 1200);
  app.elements.get("noiseVolume").value = "100";
  app.fire("noiseVolume", "input");
  assert.equal(context.gains.at(-1).gain.value, .2);
  app.mixKindButtons[0].events.click();
  assert.ok(context.sources.every(source => source.stopped));
  assert.equal(app.elements.get("noiseButton").getAttribute("aria-pressed"), "false");
  assert.equal(app.elements.get("mixWorkspace").hidden, false);
  assert.equal(app.elements.get("noiseWorkspace").hidden, true);
});

test("harmonic and noise pending playback are canceled before any orphan sound starts", async () => {
  const app = fakePage();
  app.pureKindButtons[1].events.click();
  const pendingHarmonics = app.fire("harmonicButton", "click");
  app.fire("modeMix", "click");
  app.mixKindButtons[1].events.click();
  await pendingHarmonics;
  assert.equal(app.contexts[0].oscillators.length, 0);
  const pendingNoise = app.fire("noiseButton", "click");
  app.fire("modePure", "click");
  await pendingNoise;
  assert.equal(app.contexts[0].sources.length, 0);
  assert.equal(app.elements.get("harmonicWorkspace").hidden, false);
  await app.fire("harmonicButton", "click");
  app.fire("langEn", "click");
  assert.equal(app.pureKindButtons[1].textContent, "Build timbre");
  assert.equal(app.elements.get("harmonicPlayLabel").textContent, "Stop");
  app.fire("stopAll", "click");
  assert.equal(app.contexts[0].oscillators.at(-1).stopped, true);
});

test("S034 temperament lattice, fifths and chord experiments stay synchronized without autoplay", () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[4].click();
  assert.equal(app.elements.get("temperamentWorkspace").hidden, false);
  assert.equal(app.elements.get("tempChallenge").hidden, false);
  assert.equal(app.elements.get("tempExplanation").hidden, false);
  assert.equal(app.elements.get("limit5Workspace").hidden, true);
  assert.equal(app.elements.get("tempSystemSelect").value, "adjustable");
  assert.equal(app.elements.get("tempTaskSelect").value, "build");
  assert.match(app.elements.get("tempNarrowValue").textContent, /5\.38/);
  assert.equal(app.elements.get("tempKeySelect").value, "0");
  assert.equal(app.elements.get("tempQualitySelect").value, "major");
  assert.ok(app.elements.get("tempLatticeCanvas").drawnArcs.length >= 12);
  assert.match(app.elements.get("tempLatticeCanvas").drawnText.join(" "), /D♯/);
  assert.match(app.elements.get("tempLatticeConstructionFact").textContent, /386\.31/);
  assert.match(app.elements.get("tempLatticeConstructionFact").textContent, /таарлаа/);
  assert.ok(app.elements.get("tempLatticeCanvas").drawnText.includes("n = −1"),
    "The lattice's three rows include the minor-third construction");
  assert.ok(app.elements.get("tempLatticeCanvas").drawnText.includes("E · 5:4 ✓"),
    "Quarter-comma meantone identifies C→E with the exact 5:4 target");
  assert.match(app.elements.get("tempLatticeFact").textContent, /386\.31/);
  assert.match(app.elements.get("tempBeatFact").textContent, /Hz|Гц/);
  assert.equal(app.elements.get("tempPartialCanvas").drawnText
    .filter(value => /^[1-6]f$/.test(value)).length, 12,
  "The harmonic comparison has exactly two six-partial rows, even for a three-note chord");
  assert.ok(app.elements.get("tempCircleCanvas").drawnArcs.length >= 12);
  assert.ok(app.elements.get("tempFifthsCanvas").drawnRects.length >= 13);
  assert.equal([...app.elements.get("tempFifthsBody").innerHTML.matchAll(/<tr/g)].length, 12);
  assert.match(app.elements.get("tempChordBadge").textContent, /C4 · E4 · G4/);
  assert.match(app.elements.get("tempNoteHz0").textContent, /263\.18/);
  assert.equal(app.contexts.length, 0);

  app.fire("tempSystemSelect", "change", { target: { value: "meantone" } });
  assert.match(app.elements.get("tempWolfFact").textContent, /G♯–E♭/);
  assert.match(app.elements.get("tempWolfFact").textContent, /737\.64/);
  assert.match(app.elements.get("tempChordFact").textContent, /386\.31/);
  app.fire("tempKeySelect", "change", { target: { value: "8" } });
  assert.match(app.elements.get("tempChordFact").textContent, /427\.37/);
  // Lattice coordinates are deliberately not keyboard-order coordinates.
  // In the fake 710×210 canvas, G's tempered fifth-chain dot is near (253,105).
  app.fire("tempLatticeCanvas", "click", { clientX: 253, clientY: 105 });
  assert.equal(app.elements.get("tempKeySelect").value, "7");
  app.fire("tempQualitySelect", "change", { target: { value: "minor" } });
  assert.match(app.elements.get("tempCircleBadge").textContent, /Минор/);
  app.fire("tempCircleCanvas", "keydown", { key: "ArrowRight", preventDefault() {} });
  assert.equal(app.elements.get("tempKeySelect").value, "2");

  app.fire("langEn", "click");
  assert.equal(app.tempPlayButtons[0].textContent, "▶ In sequence");
  assert.equal(app.tempPlayButtons[1].textContent, "▶ Together");
  app.fire("tempTaskSelect", "change", { target: { value: "wolf" } });
  assert.equal(app.elements.get("tempChordFields").hidden, true);
  assert.equal(app.tempPlayButtons[0].textContent, "▶ Ordinary fifth");
  assert.equal(app.tempPlayButtons[1].textContent, "▶ Wolf fifth");
  app.fire("tempSystemSelect", "change", { target: { value: "equal" } });
  assert.equal(app.tempPlayButtons[1].textContent, "▶ Closing fifth");
  assert.match(app.elements.get("tempTaskHint").textContent, /has no wolf/);
  assert.match(app.elements.get("tempLatticeFact").textContent, /without a single wolf/);
  assert.match(app.elements.get("tempLatticeConstructionFact").textContent, /400\.00/);
  assert.match(app.elements.get("tempLatticeConstructionFact").textContent, /\+13\.69/);
  app.fire("tempSystemSelect", "change", { target: { value: "meantone" } });
  assert.equal(app.tempPlayButtons[1].textContent, "▶ Wolf fifth");
  app.fire("tempTaskSelect", "change", { target: { value: "third" } });
  assert.equal(app.tempPlayButtons[0].textContent, "▶ Tuned third");
  assert.equal(app.tempPlayButtons[1].textContent, "▶ Pure third");
  app.tempNarrowButtons[0].click();
  assert.match(app.elements.get("tempNarrowValue").textContent, /0\.00/);
  app.tempNarrowButtons[2].click();
  assert.match(app.elements.get("tempWolfFact").textContent, /without a single wolf/);
  assert.match(app.elements.get("tempNarrowValue").textContent, /2\.13/);
  app.fire("tempNarrowSlider", "input", { target: { value: "3.50" } });
  assert.match(app.elements.get("tempNarrowValue").textContent, /3\.50/);
  app.fire("tempReset", "click");
  assert.equal(app.elements.get("tempSystemSelect").value, "adjustable");
  assert.equal(app.elements.get("tempTaskSelect").value, "build");
  assert.equal(app.elements.get("tempKeySelect").value, "0");
  assert.equal(app.elements.get("tempQualitySelect").value, "major");
  assert.equal(app.contexts.length, 0, "Switching and diagram interaction must not start audio");
});

test("S034 sequential/together rich audio uses the shared recording bus, stops and switches exclusively", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[4].click();
  await app.tempPlayButtons[0].click();
  const context = app.contexts[0];
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].buffer.length, Math.ceil(3 * .64 * context.sampleRate));
  assert.equal(app.tempPlayButtons[0].getAttribute("aria-pressed"), "true");
  assert.equal(app.tempPlayButtons[1].getAttribute("aria-pressed"), "false");
  assert.equal(context.gains.at(-1).gain.value, .28 * .38);
  const sampleData = context.sources[0].buffer.getChannelData(0);
  assert.ok(sampleData.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
  await app.tempPlayButtons[1].click();
  assert.equal(context.sources[0].stopped, true);
  assert.equal(context.sources.length, 2);
  assert.equal(context.sources[1].buffer.length, Math.ceil(4 * context.sampleRate));
  assert.equal(app.tempPlayButtons[0].getAttribute("aria-pressed"), "false");
  assert.equal(app.tempPlayButtons[1].getAttribute("aria-pressed"), "true");
  app.fire("tempVolume", "input", { target: { value: "25" } });
  assert.equal(context.gains.at(-1).gain.value, .28 * .25);
  app.fire("tempSystemSelect", "change", { target: { value: "equal" } });
  assert.equal(context.sources[1].stopped, true);
  assert.equal(app.tempPlayButtons[1].getAttribute("aria-pressed"), "false");
  await app.tempPlayButtons[1].click();
  context.sources.at(-1).onended();
  assert.equal(app.tempPlayButtons[1].getAttribute("aria-pressed"), "false");
  await app.tempPlayButtons[1].click();
  app.fire("stopAll", "click");
  assert.equal(context.sources.at(-1).stopped, true);
});

test("S034 wolf and third experiments compare actual harmonic gaps without changing playback semantics", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[4].click();
  app.fire("langEn", "click");
  app.fire("tempTaskSelect", "change", { target: { value: "wolf" } });
  const ordinaryGap = Number(app.elements.get("tempBeatFact").textContent.match(/by (\d+\.\d+) Hz/)[1]);
  await app.tempPlayButtons[0].click();
  assert.equal(app.contexts[0].sources.at(-1).buffer.length, 4 * 44100,
    "An ordinary fifth must sound simultaneously, not as a short melody");
  await app.tempPlayButtons[1].click();
  const wolfGap = Number(app.elements.get("tempBeatFact").textContent.match(/by (\d+\.\d+) Hz/)[1]);
  assert.ok(wolfGap > ordinaryGap + 10);
  assert.equal(app.contexts[0].sources.length, 2);
  app.fire("tempTaskSelect", "change", { target: { value: "third" } });
  assert.equal(app.contexts[0].sources.at(-1).stopped, true);
  app.fire("tempSystemSelect", "change", { target: { value: "pythagorean" } });
  const tunedGap = Number(app.elements.get("tempBeatFact").textContent.match(/by (\d+\.\d+) Hz/)[1]);
  await app.tempPlayButtons[1].click();
  const pureGap = Number(app.elements.get("tempBeatFact").textContent.match(/by (\d+\.\d+) Hz/)[1]);
  assert.ok(tunedGap > 10);
  assert.equal(pureGap, 0);
  assert.equal(app.contexts[0].sources.at(-1).buffer.length, 4 * 44100);
});

test("S036 C-centred just selection shows exact lattice ratios, impure D–A and the 5-limit shortcut", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[4].click();
  assert.equal(app.elements.get("tempJustGuide").hidden, true);
  app.fire("tempSystemSelect", "change", { target: { value: "just" } });
  assert.equal(app.elements.get("tempJustGuide").hidden, false);
  assert.equal(app.elements.get("tempAdjustGroup").hidden, true);
  assert.equal(app.elements.get("tempTaskSelect").value, "chord");
  assert.equal([...app.elements.get("tempJustRatioGrid").innerHTML.matchAll(/<span/g)].length, 12);
  assert.match(app.elements.get("tempJustRatioGrid").innerHTML, /16:15/);
  assert.match(app.elements.get("tempJustRatioGrid").innerHTML, /45:32/);
  assert.match(app.elements.get("tempNoteHz0").textContent, /264/);
  assert.match(app.elements.get("tempLatticeHint").textContent, /гурван мөр/);
  assert.match(app.elements.get("tempLatticeScale").textContent, /томруулалтгүй/);
  assert.match(app.elements.get("tempWolfFact").textContent, /9 квинт/);
  assert.match(app.elements.get("tempLatticeConstructionFact").textContent, /386\.31/);
  assert.ok(app.elements.get("tempLatticeCanvas").drawnText.includes("E · 5:4 ✓"));
  assert.equal(app.contexts.length, 0, "Choosing a tuning must not start audio");
  app.fire("tempKeySelect", "change", { target: { value: "2" } });
  assert.match(app.elements.get("tempChordFact").textContent, /680\.45/);
  assert.match(app.elements.get("tempLatticeFact").textContent, /-21\.51/);
  app.fire("tempTaskSelect", "change", { target: { value: "wolf" } });
  assert.match(app.elements.get("tempTaskHint").textContent, /Ре–Ля/);
  assert.match(app.elements.get("tempLatticeBadge").textContent, /D–A/);
  app.fire("langEn", "click");
  assert.match(app.elements.get("tempJustRatioGrid").innerHTML, /1:1/);
  assert.match(app.elements.get("tempJustGuide").hidden === false ?
    app.elements.get("tempLatticeHint").textContent : "", /three rows/);
  assert.equal(app.tempPlayButtons[1].textContent, "▶ Narrow D–A fifth");
  await app.tempPlayButtons[1].click();
  assert.equal(app.contexts[0].sources.length, 1);
  assert.match(app.elements.get("tempBeatFact").textContent, /11\.00 Hz/);
  app.fire("tempOpenJustLattice", "click");
  assert.equal(app.elements.get("temperamentWorkspace").hidden, true);
  assert.equal(app.elements.get("limit5Workspace").hidden, false);
  assert.equal(app.elements.get("limit5PresetSelect").value, "just12");
  assert.equal(app.elements.get("limit5Count").textContent, "12 notes");
  assert.equal(app.elements.get("limit5BaseValue").textContent, "264 Hz");
  assert.equal(app.elements.get("limit5JustHint").hidden, false);
  assert.equal(app.contexts[0].sources[0].stopped, true, "Changing experiment stops the previous sound");
});

test("S033 pending browser audio is canceled on tab switch and page hide", async () => {
  const app = fakePage();
  app.fire("modeTuning", "click");
  app.tuningKindButtons[4].click();
  const pending = app.tempPlayButtons[0].click();
  app.tuningKindButtons[0].click();
  await pending;
  assert.equal(app.contexts[0].sources.length, 0);
  app.tuningKindButtons[4].click();
  await app.tempPlayButtons[1].click();
  assert.equal(app.contexts[0].sources.length, 1);
  app.window.events.pagehide();
  assert.equal(app.contexts[0].sources[0].stopped, true);
  assert.equal(app.tempPlayButtons[1].getAttribute("aria-pressed"), "false");
});

test("Compose mode pickers live inside the left cards and preserve focus, drafts and translations", () => {
  for (const [workspace, picker, field] of [
    ["composeWorkspace", "composeSubtabs", "composeExample"],
    ["composeEnsembleWorkspace", "ensembleSubtabs", "ensemblePreset"]
  ]) {
    const card = html.slice(html.indexOf('id="' + workspace + '"'));
    const controls = card.slice(0, card.indexOf("</section>"));
    assert.match(controls, /class="panel controls compose-controls"/);
    assert.ok(controls.includes('id="' + picker + '"'));
    assert.ok(controls.indexOf('id="' + picker + '"') < controls.indexOf('id="' + field + '"'));
    assert.equal([...controls.matchAll(/data-compose-subtab="/g)].length, 2);
  }
  assert.ok(html.indexOf('id="projectToolbar"') > html.indexOf('id="ensembleGridCells"'),
    "the shared collapsed file row follows both workspaces");
  assert.doesNotMatch(css, /\.compose-subtabs/);
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.elements.get("composeText").value += "\n% keep this draft";
  app.fire("composeText", "input");
  const draft = app.elements.get("composeText").value;
  app.composeSubtabButtons[1].click();
  assert.equal(app.elements.get("composeEnsembleWorkspace").hidden, false);
  assert.equal(app.composeSubtabButtons[3].focused, true, "focus follows the visible ensemble picker");
  for (const [index, button] of app.composeSubtabButtons.entries()) {
    assert.equal(button.getAttribute("aria-pressed"), String(index % 2 === 1));
  }
  app.fire("langEn", "click");
  assert.equal(app.elements.get("ensembleSubtabs").getAttribute("aria-label"), "Compose mode");
  assert.equal(app.composeSubtabButtons[2].textContent, "Single instrument");
  app.composeSubtabButtons[2].click();
  assert.equal(app.elements.get("composeWorkspace").hidden, false);
  assert.equal(app.composeSubtabButtons[0].focused, true, "focus returns to the visible solo picker");
  assert.equal(app.elements.get("composeText").value, draft);
  assert.equal(app.contexts.length, 0, "changing cards or language never starts audio");
});

test("Compose ensemble swaps in a compact shared timeline and synchronizes two instrument parts", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  assert.equal(app.elements.get("composeWorkspace").hidden, false);
  app.composeSubtabButtons[1].click();
  assert.equal(app.elements.get("composeWorkspace").hidden, true);
  assert.equal(app.elements.get("composeEnsembleWorkspace").hidden, false);
  assert.equal(app.composeSubtabButtons[1].getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("ensembleTrackList").children.length, 2);
  assert.equal(app.elements.get("ensembleTimeline").children.length, 2);
  assert.equal(app.contexts.length, 0, "Ensemble does not autoplay");
  await app.fire("ensemblePlayPause", "click");
  assert.equal(app.contexts.length, 1);
  assert.equal(app.contexts[0].oscillators.length, 2, "Two notes start on the same beat");
  assert.equal(app.contexts[0].sources.length, 1, "The flute adds its shared breath-noise source");
  assert.equal(app.contexts[0].sources[0].loop, true);
  assert.match(app.elements.get("ensemblePlayPause").textContent, /Түр зогсоох/);
  app.fire("ensemblePlayPause", "pointerdown");
  await app.fire("ensemblePlayPause", "click");
  assert.match(app.elements.get("ensemblePlayPause").textContent, /Үргэлжлүүлэх/,
    "Safari pointerdown and delayed click must not cause an accidental Resume");
  assert.match(app.elements.get("ensembleStatus").textContent, /Түр зогслоо/);
  app.fire("ensembleStop", "click");
  assert.match(app.elements.get("ensemblePlayPause").textContent, /Тоглуулах/);
  app.composeSubtabButtons[0].click();
  assert.equal(app.elements.get("composeWorkspace").hidden, false);
  assert.equal(app.elements.get("composeEnsembleWorkspace").hidden, true);
});

test("Compose ensemble edits tracks separately, adds and removes parts, changes languages", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.fire("ensembleAdd", "click");
  assert.equal(app.elements.get("ensembleTrackList").children.length, 3);
  assert.equal(app.elements.get("ensembleTimeline").children.length, 3);
  app.fire("ensembleAdd", "click");
  assert.equal(app.elements.get("ensembleTrackList").children.length, 4);
  assert.equal(app.elements.get("ensembleAdd").disabled, true);
  // Remove newly-added part from its row, restoring a three-part ensemble.
  const fourth = app.elements.get("ensembleTrackList").children[3];
  fourth.children[0].children[1].click();
  assert.equal(app.elements.get("ensembleTrackList").children.length, 3);
  assert.equal(app.contexts.length, 0, "Score/mixer edits remain silent");
  app.fire("langEn", "click");
  assert.match(app.elements.get("ensembleStatus").textContent, /Ready/);
  assert.match(app.elements.get("ensembleEditorTitle").textContent, /ABC/);
  const second = app.elements.get("ensembleTrackList").children[1];
  second.children[0].children[0].click();
  assert.match(app.elements.get("ensembleText").value, /T:Bass/);
  const file = { name: "new-part.abc", size: 82,
    text: async () => "M:4/4\nL:1/4\nQ:1/4=96\nK:D\nD2 A2 | D4 |]" };
  await app.fire("ensembleLoad", "change", { target: { files: [file] } });
  assert.match(app.elements.get("ensembleText").value, /K:D/);
  assert.equal(app.elements.get("ensembleTimeline").children.length, 3);
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
});

test("Compose ensemble loads complete arrangements with three synchronized editable parts", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  for (const [choice, title, count] of [
    ["minuet", /Minuet in G/, 3],
    ["korobeiniki", /Korobeiniki/, 3],
    ["kalinka", /Kalinka/, 3]
  ]) {
    app.elements.get("ensemblePreset").value = choice;
    app.fire("ensembleApplyPreset", "click");
    assert.equal(app.elements.get("ensembleTrackList").children.length, count);
    assert.equal(app.elements.get("ensembleTimeline").children.length, count);
    assert.match(app.elements.get("ensembleText").value, title);
    assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
    assert.match(app.elements.get("ensembleStatus").textContent, /Бэлэн/);
    assert.equal(app.contexts.length, 0, "Loading a full preset must not start audio");
  }
  app.fire("langEn", "click");
  assert.match(app.elements.get("ensembleEditorTitle").textContent, /ABC/);
  const second = app.elements.get("ensembleTrackList").children[1];
  second.children[0].children[0].click();
  assert.match(app.elements.get("ensembleText").value, /original accompaniment/);
  app.elements.get("ensemblePreset").value = "starter";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(app.elements.get("ensembleTrackList").children.length, 2);
  assert.match(app.elements.get("ensembleText").value, /T:Melody/);
});

test("D1 drum-only compositions open a working reusable pattern grid with no melodic tracks or autoplay", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  for (const [choice, count] of [["drumKitSolo", 1], ["snareStudy", 1], ["drumDialogue", 2]]) {
    app.elements.get("ensemblePreset").value = choice;
    app.fire("ensembleApplyPreset", "click");
    assert.equal(app.elements.get("ensembleTrackList").children.length, count, choice);
    assert.equal(app.elements.get("ensembleTimeline").children.length, count, choice);
    assert.equal(app.elements.get("ensemblePatternPanel").hidden, false, choice);
    assert.equal(app.elements.get("ensembleDrumGrid").hidden, false, choice);
    assert.equal(app.elements.get("ensembleGridCells").children.length, drumABC.DRUMS.length, choice);
    assert.equal(app.elements.get("ensemblePlayPause").disabled, false, choice);
    assert.match(app.elements.get("ensembleText").value, /%%MIDI channel 10/, choice);
    assert.equal(app.contexts.length, 0, "Preset loading must not autoplay");
  }
  const first = app.elements.get("ensembleText").value;
  const second = app.elements.get("ensembleTrackList").children[1];
  second.children[0].children[0].click();
  assert.notEqual(app.elements.get("ensembleText").value, first,
    "Dialogue tracks expose independently editable percussion parts");
  app.elements.get("ensembleGridCells").children[1].children[1].children[0].click();
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false, "Grid edits keep the arrangement valid");
  await app.fire("ensemblePlayPause", "click");
  assert.equal(app.contexts.length, 1);
  assert.ok(app.contexts[0].sources.length > 0, "Drum-only playback schedules audible hits");
  app.fire("ensembleStop", "click");
});

test("S068 every built-in ensemble preset translates its untouched track and timeline names in both directions", () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  const trackNames = () => app.elements.get("ensembleTrackList").children.map((_, index) =>
    projectTrackControl(app, index, "ensemble-name").value);
  const timelineNames = () => app.elements.get("ensembleTimeline").children.map(row => row.children[0].textContent);
  for (const preset of ensemblePresets.CATALOG.filter(piece => piece.id !== "starter")) {
    app.elements.get("ensemblePreset").value = preset.id;
    app.fire("ensembleApplyPreset", "click");
    const mongolian = ensemblePresets.create(preset.id, "mn").map(track => track.name);
    const english = ensemblePresets.create(preset.id, "en").map(track => track.name);
    assert.deepEqual(trackNames(), mongolian, preset.id + " initially in Mongolian");
    app.fire("langEn", "click");
    assert.deepEqual(trackNames(), english, preset.id + " names after switching to English");
    assert.deepEqual(timelineNames(), english, preset.id + " timeline after switching to English");
    assert.ok(app.elements.get("ensembleEditorTitle").textContent.endsWith(english[0]), preset.id);
    app.fire("langMn", "click");
    assert.deepEqual(trackNames(), mongolian, preset.id + " names after switching back");
    assert.deepEqual(timelineNames(), mongolian, preset.id + " timeline after switching back");
  }
  assert.equal(app.contexts.length, 0, "Changing language never starts an arrangement");
});

test("D2a new tom/cymbal arrangement offers all editable drum lanes and linked repeat edits", () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.elements.get("ensemblePreset").value = "tomCymbalStudy";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(app.elements.get("ensembleTrackList").children.length, 1);
  assert.equal(app.elements.get("ensembleGridCells").children.length, drumABC.DRUMS.length);
  assert.equal(app.elements.get("ensembleDrumGrid").hidden, false);
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
  assert.match(app.elements.get("ensembleText").value, /%%MIDI drummap A 41/);
  assert.equal(app.contexts.length, 0, "Drum preset must not autoplay");
  const rows = app.elements.get("ensembleGridCells").children;
  assert.equal(rows[5].children[0].textContent, "Суурь том");
  rows[5].children[1].children[1].click(); // New floor-tom hit in linked pattern A.
  const pattern = drumABC.parse(app.elements.get("ensembleText").value);
  assert.equal(drumABC.gridOf(pattern)[0].cells[1].floorTom, .8);
  app.fire("langEn", "click");
  assert.equal(projectTrackControl(app, 0, "ensemble-name").value, "Kit · tom fills");
  assert.equal(app.elements.get("ensembleGridCells").children[5].children[0].textContent, "Floor tom");
  assert.equal(app.contexts.length, 0, "Changing languages must not play a drum sound");
});

test("S068 edited names and restored project names are never silently retranslated", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.elements.get("ensemblePreset").value = "drumDialogue";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(projectTrackControl(app, 0, "ensemble-name").value, "Low drums · call");
  const first = projectTrackControl(app, 0, "ensemble-name");
  first.value = "My custom low drum";
  first.events.change();
  app.fire("langMn", "click");
  assert.equal(projectTrackControl(app, 0, "ensemble-name").value, "My custom low drum");
  assert.equal(projectTrackControl(app, 1, "ensemble-name").value, "Өндөр цохилуур · хариулт");
  assert.ok(app.elements.get("ensembleEditorTitle").textContent.endsWith("My custom low drum"));
  app.fire("langEn", "click");
  assert.equal(projectTrackControl(app, 0, "ensemble-name").value, "My custom low drum");
  assert.equal(projectTrackControl(app, 1, "ensemble-name").value, "High drums · answer");
  app.fire("langMn", "click");
  const saved = await saveNativeProject(app);
  assert.deepEqual(saved.data.content.tracks.map(track => track.name),
    ["My custom low drum", "Өндөр цохилуур · хариулт"]);
  app.elements.get("ensemblePreset").value = "guitarStrum";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(await offerNativeProject(app, saved.text), true);
  assert.equal(app.fire("projectReplace", "click"), true);
  app.fire("langEn", "click");
  assert.equal(projectTrackControl(app, 0, "ensemble-name").value, "My custom low drum");
  assert.equal(projectTrackControl(app, 1, "ensemble-name").value, "Өндөр цохилуур · хариулт",
    "Opening a saved project preserves its authored literal names");
});

test("Compose drum part edits the same score through text and optional grid without autoplay", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  assert.equal(app.elements.get("ensembleDrumGrid").hidden, true);
  app.fire("ensembleAddDrums", "click");
  assert.equal(app.elements.get("ensembleTrackList").children.length, 3);
  assert.equal(app.elements.get("ensembleTimeline").children.length, 3);
  assert.match(app.elements.get("ensembleText").value, /%%MIDI channel 10/);
  assert.equal(app.elements.get("ensemblePatternPanel").hidden, false);
  assert.equal(app.elements.get("ensemblePatternTools").hidden, false);
  assert.equal(app.elements.get("ensemblePatternArrangement").children.length, 1);
  assert.equal(app.elements.get("ensemblePatternBar").children.length, 4);
  assert.equal(app.elements.get("ensembleDrumGrid").hidden, false);
  assert.equal(app.elements.get("ensembleGridCells").children.length, drumABC.DRUMS.length);
  assert.equal(app.elements.get("ensembleGridBar").children.length, 1, "Pattern grid edits one reusable bar");
  assert.equal(app.contexts.length, 0);
  const first = drumABC.parse(app.elements.get("ensembleText").value);
  assert.equal(drumABC.gridOf(first)[0].cells[0].kick, 1);
  // Click the kick in the first cell: Normal replaces Accent, then clears it.
  app.elements.get("ensembleGridCells").children[0].children[1].children[0].click();
  assert.equal(drumABC.gridOf(drumABC.parse(app.elements.get("ensembleText").value))[0].cells[0].kick, .8);
  app.elements.get("ensembleGridCells").children[0].children[1].children[0].click();
  assert.equal(drumABC.gridOf(drumABC.parse(app.elements.get("ensembleText").value))[0].cells[0].kick, undefined);
  app.elements.get("ensembleGridStrength").value = "p";
  app.elements.get("ensembleGridCells").children[4].children[1].children[3].click();
  let edited = drumABC.parse(app.elements.get("ensembleText").value);
  assert.equal(drumABC.gridOf(edited)[0].cells[3].woodblock, .55);
  assert.equal(edited.totalBeats, first.totalBeats);
  app.elements.get("ensembleGridStep").value = "8";
  app.fire("ensembleGridStep", "change");
  assert.equal(app.elements.get("ensembleGridStep").value, "16", "Offbeat drum must remain visible");
  assert.match(app.elements.get("ensembleGridMessage").textContent, /арван зургаат/i);
  app.fire("langEn", "click");
  assert.equal(app.elements.get("ensembleGridCells").children[0].children[0].textContent, "Bass drum");
  await app.fire("ensemblePlayPause", "click");
  assert.equal(app.contexts.length, 1);
  assert.equal(app.contexts[0].oscillators.length, 2);
  assert.equal(app.contexts[0].sources.filter(source => !source.loop).length, 1,
    "Only the hi-hat remains on the first beat, apart from held-instrument noise");
  app.fire("ensembleStop", "click");
  const invalid = app.elements.get("ensembleText").value.replace("channel 10", "channel 9");
  app.elements.get("ensembleText").value = invalid;
  app.fire("ensembleText", "input");
  await new Promise(resolve => setTimeout(resolve, 220));
  assert.equal(app.elements.get("ensembleText").value, invalid, "Invalid ABC must remain untouched");
  assert.equal(app.elements.get("ensemblePlayPause").disabled, true);
  assert.match(app.elements.get("ensembleGridMessage").textContent, /Correct the pattern ABC/i);
  assert.equal(app.elements.get("ensemblePatternRevert").hidden, false);
  app.fire("ensemblePatternRevert", "click");
  assert.equal(app.elements.get("ensemblePatternRevert").hidden, true);
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
});

test("Compose Add Drums fits all full arrangements, including Kalinka's pickup", () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  for (const preset of ["minuet", "korobeiniki", "kalinka"]) {
    app.elements.get("ensemblePreset").value = preset;
    app.fire("ensembleApplyPreset", "click");
    assert.equal(app.elements.get("ensembleTrackList").children.length, 3);
    app.fire("ensembleAddDrums", "click");
    assert.equal(app.elements.get("ensembleTrackList").children.length, 4, preset);
    assert.equal(app.elements.get("ensemblePlayPause").disabled, false, preset);
    assert.equal(app.elements.get("ensembleDrumGrid").hidden, false);
    app.elements.get("ensemblePatternTextMode").value = "full";
    app.fire("ensemblePatternTextMode", "change");
    const score = drumABC.parse(app.elements.get("ensembleText").value);
    assert.equal(score.bars.length, preset === "kalinka" ? 27 : preset === "minuet" ? 32 : 16);
    if (preset === "kalinka") assert.equal(score.bars[0].pickup, true);
  }
  assert.equal(app.contexts.length, 0);
});

test("D1 linked drum pattern edits all bars; Make unique edits one bar and full ABC remains available", () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.fire("ensembleAddDrums", "click");
  const grid = app.elements.get("ensembleGridCells");
  assert.equal(app.elements.get("ensemblePatternArrangement").children[0].textContent, "A ×4");
  grid.children[4].children[1].children[3].click();
  app.elements.get("ensemblePatternTextMode").value = "full";
  app.fire("ensemblePatternTextMode", "change");
  const full = drumABC.parse(app.elements.get("ensembleText").value);
  assert.equal(drumABC.gridOf(full).filter(bar => bar.cells[3].woodblock === .8).length, 4);
  // Return to pattern ABC, select bar 2, and make that occurrence unique.
  app.elements.get("ensemblePatternTextMode").value = "pattern";
  app.fire("ensemblePatternTextMode", "change");
  app.elements.get("ensemblePatternBar").value = "2";
  app.fire("ensemblePatternBar", "change");
  app.fire("ensemblePatternUnique", "click");
  assert.deepEqual(app.elements.get("ensemblePatternArrangement").children.map(button => button.textContent),
    ["A", "B", "A ×2"]);
  app.elements.get("ensembleGridStrength").value = "accent";
  app.elements.get("ensembleGridCells").children[4].children[1].children[5].click();
  app.elements.get("ensemblePatternTextMode").value = "full";
  app.fire("ensemblePatternTextMode", "change");
  const altered = drumABC.gridOf(drumABC.parse(app.elements.get("ensembleText").value));
  assert.equal(altered[1].cells[5].woodblock, 1);
  assert.equal(altered.filter(bar => bar.cells[5].woodblock === 1).length, 1);
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
  assert.equal(app.contexts.length, 0, "Arrangement editing must not play sound");
});

test("D1 pattern menu assigns a reusable rhythm to the chosen bar and T: renames it live", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.fire("ensembleAddDrums", "click");
  app.elements.get("ensemblePatternBar").value = "2";
  app.fire("ensemblePatternBar", "change");
  app.fire("ensemblePatternUnique", "click");
  assert.deepEqual(app.elements.get("ensemblePatternChoice").children.map(option => option.textContent),
    ["A", "B"], "Pattern choices show only names, not bar counts");
  app.elements.get("ensembleGridCells").children[4].children[1].children[7].click();
  app.elements.get("ensemblePatternBar").value = "4";
  app.fire("ensemblePatternBar", "change");
  assert.equal(app.elements.get("ensemblePatternChoice").value, "1", "Song bar chooses its current pattern");
  app.elements.get("ensemblePatternChoice").value = "2";
  app.fire("ensemblePatternChoice", "change");
  assert.equal(app.elements.get("ensemblePatternBar").value, "4", "Assignment does not change the chosen song bar");
  assert.equal(app.elements.get("ensemblePatternChoice").value, "2");
  assert.deepEqual(app.elements.get("ensemblePatternArrangement").children.map(el => el.textContent),
    ["A", "B", "A", "B"]);
  app.elements.get("ensemblePatternTextMode").value = "full";
  app.fire("ensemblePatternTextMode", "change");
  const full = drumABC.gridOf(drumABC.parse(app.elements.get("ensembleText").value));
  assert.equal(full[1].cells[7].woodblock, .8);
  assert.equal(full[3].cells[7].woodblock, .8);
  assert.equal(full[0].cells[7].woodblock, undefined);
  app.elements.get("ensemblePatternTextMode").value = "pattern";
  app.fire("ensemblePatternTextMode", "change");
  const editor = app.elements.get("ensembleText");
  editor.value = editor.value.replace("T:B", "T:DDDD");
  app.fire("ensembleText", "input");
  assert.match(app.elements.get("ensembleEditorTitle").textContent, /DDDD/);
  await new Promise(resolve => setTimeout(resolve, 220));
  assert.deepEqual(app.elements.get("ensemblePatternArrangement").children.map(el => el.textContent),
    ["A", "DDDD", "A", "DDDD"]);
  assert.equal(app.elements.get("ensemblePatternChoice").children[1].textContent, "DDDD");
  app.elements.get("ensemblePatternBar").value = "2";
  app.fire("ensemblePatternBar", "change");
  assert.equal(app.elements.get("ensemblePatternChoice").value, "2", "The renamed pattern stays linked");
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
  assert.equal(app.contexts.length, 0, "Pattern changes remain silent until Play");
});

test("D1 rejects a too-long pattern assignment without changing the current song bar", () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.fire("ensembleAddDrums", "click");
  app.elements.get("ensemblePatternLength").value = "2";
  app.fire("ensemblePatternGroup", "click"); // Pattern B covers bars 1–2.
  assert.deepEqual(app.elements.get("ensemblePatternChoice").children.map(option => option.textContent),
    ["A", "B"], "Multi-bar patterns also show only their names");
  app.elements.get("ensemblePatternBar").value = "4";
  app.fire("ensemblePatternBar", "change");
  assert.equal(app.elements.get("ensemblePatternChoice").value, "1");
  app.elements.get("ensemblePatternChoice").value = "2";
  app.fire("ensemblePatternChoice", "change");
  assert.equal(app.elements.get("ensemblePatternBar").value, "4");
  assert.equal(app.elements.get("ensemblePatternChoice").value, "1", "Rejected selection is restored");
  assert.match(app.elements.get("ensemblePatternMessage").textContent, /needs 2 bar/i);
  assert.deepEqual(app.elements.get("ensemblePatternArrangement").children.map(el => el.textContent),
    ["B", "A ×2"]);
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
});

test("D1 text edits propagate through linked bars; an invalid draft stays visible until corrected", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.fire("ensembleAddDrums", "click");
  const editor = app.elements.get("ensembleText");
  const original = editor.value;
  assert.match(original, /\[!accent!CE\]2/);
  editor.value = original.replace("[!accent!CE]2", "E2");
  app.fire("ensembleText", "input");
  await new Promise(resolve => setTimeout(resolve, 220));
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
  app.elements.get("ensemblePatternTextMode").value = "full";
  app.fire("ensemblePatternTextMode", "change");
  const bars = drumABC.gridOf(drumABC.parse(editor.value));
  assert.equal(bars.length, 4);
  assert.ok(bars.every(bar => bar.cells[0].kick === undefined),
    "A valid edit to the shared Pattern ABC changes all four linked bars");
  app.elements.get("ensemblePatternTextMode").value = "pattern";
  app.fire("ensemblePatternTextMode", "change");
  editor.value = editor.value.replace("channel 10", "channel 9");
  app.fire("ensembleText", "input");
  await new Promise(resolve => setTimeout(resolve, 220));
  assert.match(editor.value, /channel 9/);
  assert.equal(app.elements.get("ensemblePlayPause").disabled, true);
  editor.value = editor.value.replace("channel 9", "channel 10");
  app.fire("ensembleText", "input");
  await new Promise(resolve => setTimeout(resolve, 220));
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
  assert.equal(app.elements.get("ensemblePatternRevert").hidden, true);
  assert.equal(app.contexts.length, 0);
});

test("D1 can group two bars, repeat over a range, and restore raw ABC without silent loss", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.fire("ensembleAddDrums", "click");
  app.elements.get("ensemblePatternLength").value = "2";
  app.fire("ensemblePatternGroup", "click");
  assert.equal(app.elements.get("ensemblePatternChoice").children.length, 2);
  app.elements.get("ensemblePatternFrom").value = "3";
  app.elements.get("ensemblePatternTo").value = "4";
  app.fire("ensemblePatternRange", "click");
  assert.equal(app.elements.get("ensemblePatternArrangement").children[0].textContent, "B ×2");
  app.elements.get("ensemblePatternTextMode").value = "full";
  app.fire("ensemblePatternTextMode", "change");
  const expanded = app.elements.get("ensembleText").value;
  assert.equal(drumABC.parse(expanded).bars.length, 4);
  app.elements.get("ensembleText").value = expanded.replace("%%MIDI channel 10", "%%MIDI channel 9");
  app.fire("ensembleText", "input");
  await new Promise(resolve => setTimeout(resolve, 220));
  assert.equal(app.elements.get("ensemblePatternTools").hidden, true, "Direct full-ABC edits detach links");
  assert.equal(app.elements.get("ensemblePlayPause").disabled, true);
  assert.match(app.elements.get("ensembleText").value, /channel 9/, "Invalid source is retained");
  app.elements.get("ensembleText").value = expanded;
  app.fire("ensembleText", "input");
  await new Promise(resolve => setTimeout(resolve, 220));
  app.fire("ensemblePatternEnable", "click");
  assert.equal(app.elements.get("ensemblePatternTools").hidden, false);
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
});

test("Compose solo Pause works on pointerdown even when Safari does not send a click", async () => {
  const app = fakePage();
  app.fire("modeCompose", "click");
  await app.fire("composePlayPause", "click");
  assert.equal(app.contexts[0].oscillators.length, 1);
  app.fire("composePlayPause", "pointerdown");
  assert.match(app.elements.get("composePlayPause").textContent, /Үргэлжлүүлэх/);
  app.fire("composePlayPause", "click");
  assert.match(app.elements.get("composePlayPause").textContent, /Үргэлжлүүлэх/);
  app.fire("composeStop", "click");
});

async function saveNativeProject(app) {
  const count = app.objectUrls.length;
  assert.equal(app.fire("projectSave", "click"), true, app.elements.get("projectStatus").textContent);
  assert.equal(app.objectUrls.length, count + 1, "Saving creates one local file");
  const output = app.objectUrls.at(-1);
  assert.match(output.blob.type, /^application\/json/);
  const text = await output.blob.text();
  return { text, data: JSON.parse(text), url: output.url };
}

function offerNativeProject(app, text, overrides = {}) {
  const file = { name: "roundtrip.soundlab.json", size: Buffer.byteLength(text), text: async () => text, ...overrides };
  return app.fire("projectFile", "change", { target: { files: [file] } });
}

function projectDescendants(node) {
  return [node, ...node.children.flatMap(projectDescendants)];
}

function projectTrackControl(app, index, className) {
  return projectDescendants(app.elements.get("ensembleTrackList").children[index])
    .find(node => node.className === className);
}

test("Compose file tools start collapsed and preserve the chosen disclosure state, names and prepared files", async () => {
  const markup = html.match(/<details id="projectToolbar"[\s\S]*?<\/details>/)?.[0];
  assert.ok(markup, "Project controls use a native keyboard-operable disclosure");
  assert.doesNotMatch(markup.slice(0, markup.indexOf(">") + 1), /\sopen(?:\s|=|>)/);
  assert.match(markup, /<summary id="projectSummary" data-project-i18n="files">/);
  for (const id of ["projectName", "projectSave", "projectOpen", "exportWav", "projectStatus", "exportStatus", "projectConfirm"]) {
    assert.ok(markup.includes('id="' + id + '"'), id + " belongs inside the disclosure");
  }
  assert.match(css, /\.project-toolbar\s*>\s*summary\s*\{\s*min-height:\s*44px/);

  const app = fakePage();
  const files = app.elements.get("projectToolbar");
  app.fire("modeCompose", "click");
  assert.equal(files.hidden, false);
  assert.equal(files.open, false);
  assert.equal(app.elements.get("projectSummary").textContent, "Файл · Хадгалах / Нээх / WAV");
  files.open = true; // Native summary keyboard/click toggling is checked in the live browser.
  app.elements.get("projectName").value = "Keep this name";
  app.fire("projectName", "input");
  app.fire("langEn", "click");
  assert.equal(app.elements.get("projectSummary").textContent, "Files · Save / Open / WAV");
  assert.equal(files.open, true);
  const saved = await saveNativeProject(app);
  files.open = false;
  app.fire("langMn", "click");
  app.composeSubtabButtons[1].click();
  app.composeSubtabButtons[0].click();
  app.fire("modePure", "click");
  assert.equal(files.hidden, true);
  app.fire("modeCompose", "click");
  assert.equal(files.open, false, "Mode and language changes do not force the file controls open");
  files.open = true;
  assert.equal(app.elements.get("projectName").value, "Keep this name");
  assert.equal(app.elements.get("projectDownload").href, saved.url);
  assert.equal(app.elements.get("projectDownload").hidden, false);
  assert.equal(app.contexts.length, 0);
});

test("native project toolbar round-trips the latest solo text and settings without replacing the other workspace", async () => {
  const app = fakePage();
  assert.equal(app.elements.get("projectToolbar").hidden, true);
  app.fire("modeCompose", "click");
  assert.equal(app.elements.get("projectToolbar").hidden, false);
  assert.equal(app.elements.get("projectSave").textContent, "Төсөл хадгалах");
  assert.equal(app.elements.get("projectName").placeholder, "Миний аялгуу");
  app.elements.get("projectName").value = "Миний аялгуу 🌊";
  app.fire("projectName", "input");
  for (const [id, value, event] of [
    ["composeInstrument", "guitar", "change"], ["composeTuning", "just", "change"],
    ["composeVolume", "47", "input"], ["composeGuitarMode", "up", "change"],
    ["composeGuitarSpacing", "31", "input"]
  ]) {
    app.elements.get(id).value = value;
    app.fire(id, event);
  }
  const source = "\n% Монгол тайлбар · editable source\n" + composeModel.EXAMPLES.strum + "\n  ";
  app.elements.get("composeText").value = source;
  app.fire("composeText", "input");
  const saved = await saveNativeProject(app); // Save before the 180 ms parse debounce.
  assert.deepEqual(Object.keys(saved.data), ["format", "version", "title", "mode", "content"]);
  assert.equal(saved.data.format, "soundlab-project");
  assert.equal(saved.data.version, 1);
  assert.equal(saved.data.mode, "solo");
  assert.equal(saved.data.title, "Миний аялгуу 🌊");
  assert.deepEqual(saved.data.content, { abc: source, instrument: "guitar", tuning: "just", volume: 47,
    guitar: { mode: "up", spacingMs: 31 } });
  assert.equal(app.elements.get("projectDownload").href, saved.url);
  assert.match(app.elements.get("projectDownload").download, /\.soundlab\.json$/);
  assert.equal(app.elements.get("projectDownload").clickCount, 1);
  assert.equal(app.elements.get("projectDownload").hidden, false);
  assert.equal(app.contexts.length, 0, "Save does not initialize or play audio");

  app.elements.get("composeText").value = "unfinished replacement";
  app.fire("composeText", "input");
  app.composeSubtabButtons[1].click();
  app.elements.get("projectName").value = "Keep this arrangement";
  app.fire("projectName", "input");
  const otherText = "% This workspace stays independent.\n" + app.elements.get("ensembleText").value;
  app.elements.get("ensembleText").value = otherText;
  app.fire("ensembleText", "input");
  app.fire("projectOpen", "click");
  assert.equal(app.elements.get("projectFile").clickCount, 1);
  assert.equal(await offerNativeProject(app, saved.text), true);
  assert.equal(app.elements.get("projectFile").value, "");
  assert.equal(app.elements.get("projectConfirm").hidden, false);
  assert.match(app.elements.get("projectConfirmText").textContent, /Нэг хөгжим/);
  assert.equal(app.elements.get("composeEnsembleWorkspace").hidden, false, "Reading alone does not switch modes");
  assert.equal(app.elements.get("projectName").value, "Keep this arrangement");
  app.fire("langEn", "click");
  assert.equal(app.elements.get("projectSave").textContent, "Save project");
  assert.match(app.elements.get("projectConfirmText").textContent, /One instrument/);
  assert.match(app.elements.get("projectConfirmText").textContent, /Миний аялгуу 🌊/);
  assert.equal(app.fire("projectReplace", "click"), true);
  assert.equal(app.elements.get("projectConfirm").hidden, true);
  assert.equal(app.elements.get("composeWorkspace").hidden, false);
  assert.equal(app.elements.get("composeText").value, source);
  assert.equal(app.elements.get("composeGuitarControls").hidden, false);
  assert.equal(app.elements.get("composeGuitarMode").value, "up");
  assert.equal(app.elements.get("composeGuitarSpacing").value, "31");
  assert.equal(app.elements.get("composeTuning").value, "just");
  assert.equal(app.elements.get("composeVolume").value, "47");
  assert.equal(app.elements.get("composePlayPause").disabled, false);
  assert.equal(app.document.documentElement.lang, "en", "Project files do not change interface language");
  assert.equal(app.elements.get("ensembleText").value, otherText);
  const restored = await saveNativeProject(app);
  assert.deepEqual(restored.data, saved.data);
  assert.ok(app.revokedUrls.includes(saved.url), "A new save revokes the previous prepared-file URL");
  app.composeSubtabButtons[1].click();
  assert.equal(app.elements.get("projectName").value, "Keep this arrangement");
  assert.equal(app.elements.get("ensembleText").value, otherText);
  assert.equal(app.contexts.length, 0, "Opening a project remains silent");
});

test("native ensemble projects retain mixer state, IDs, selection and reusable one-, two- and four-bar patterns", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.elements.get("ensemblePreset").value = "guitarStrum";
  app.fire("ensembleApplyPreset", "click");
  app.elements.get("projectName").value = "Linked rhythm study";
  app.fire("projectName", "input");
  let control = projectTrackControl(app, 0, "ensemble-name");
  control.value = "Хуур · accompaniment";
  control.events.change();
  control = projectTrackControl(app, 0, "ensemble-guitar-mode");
  control.value = "down";
  control.events.change();
  control = projectTrackControl(app, 0, "ensemble-guitar-spacing");
  control.value = "43";
  control.events.input();
  control = projectTrackControl(app, 0, "ensemble-volume");
  control.value = "61";
  control.events.input();
  projectDescendants(app.elements.get("ensembleTrackList").children[0])
    .find(node => node.textContent === "Solo").click();
  projectDescendants(app.elements.get("ensembleTrackList").children[1])
    .find(node => node.textContent === "Mute").click();
  app.fire("ensembleAdd", "click");
  app.elements.get("ensembleTrackList").children[3].children[0].children[1].click();
  app.fire("ensembleAdd", "click"); // An intentional ID gap must survive a file round-trip.
  app.elements.get("ensembleTuning").value = "pythagorean";
  app.fire("ensembleTuning", "change");
  app.elements.get("ensembleTrackList").children[2].children[0].children[0].click();
  app.elements.get("ensemblePatternLength").value = "2";
  app.fire("ensemblePatternGroup", "click");
  app.elements.get("ensemblePatternBar").value = "3";
  app.fire("ensemblePatternBar", "change");
  app.elements.get("ensemblePatternLength").value = "4";
  app.fire("ensemblePatternGroup", "click");
  app.elements.get("ensemblePatternBar").value = "7";
  app.fire("ensemblePatternBar", "change");
  app.elements.get("ensemblePatternChoice").value = "2";
  app.fire("ensemblePatternChoice", "change"); // B repeats at 1–2 and 7–8; A is now unused.
  app.elements.get("ensemblePatternBar").value = "3";
  app.fire("ensemblePatternBar", "change");
  app.elements.get("ensembleText").value = app.elements.get("ensembleText").value.replace("T:C", "T:Дөрвөн такт");
  app.fire("ensembleText", "input");
  app.elements.get("ensembleGridBar").value = "2";
  app.fire("ensembleGridBar", "change");
  app.elements.get("ensembleGridStep").value = "8";
  app.fire("ensembleGridStep", "change");
  app.elements.get("ensembleGridStrength").value = "p";
  const saved = await saveNativeProject(app);
  const content = saved.data.content;
  assert.equal(saved.data.mode, "ensemble");
  assert.equal(content.tuning, "pythagorean");
  assert.deepEqual(content.tracks.map(track => track.id), [1, 2, 3, 5]);
  assert.equal(content.nextId, 6);
  assert.equal(content.selectedId, 3);
  assert.deepEqual(content.editor, { gridBar: 2, gridStep: 8, gridStrength: "p", gridArticulation: "plain", gridHand: "auto" });
  assert.equal(content.tracks[0].name, "Хуур · accompaniment");
  assert.equal(content.tracks[0].volume, 61);
  assert.equal(content.tracks[0].solo, true);
  assert.equal(content.tracks[1].mute, true);
  assert.deepEqual(content.tracks[0].guitar, { mode: "down", spacingMs: 43 });
  const savedDrums = content.tracks[2];
  assert.deepEqual(savedDrums.patterns.patterns.map(pattern => pattern.bars.length), [1, 2, 4]);
  assert.equal(savedDrums.patterns.patterns[2].name, "Дөрвөн такт");
  assert.ok(!savedDrums.patterns.sequence.some(slot => slot.id === 1), "Unused A definition is retained");
  assert.equal(savedDrums.patternBar, 3);
  assert.equal(savedDrums.patternId, 3);
  assert.equal(savedDrums.textMode, "pattern");
  assert.equal(app.contexts.length, 0);

  app.elements.get("ensemblePreset").value = "starter";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(app.elements.get("ensembleTrackList").children.length, 2);
  assert.equal(await offerNativeProject(app, saved.text), true);
  assert.equal(app.elements.get("ensembleTrackList").children.length, 2, "A checked candidate is not yet applied");
  assert.equal(app.fire("projectReplace", "click"), true);
  assert.equal(app.elements.get("ensembleTrackList").children.length, 4);
  assert.equal(app.elements.get("ensembleGridBar").value, "2");
  assert.equal(app.elements.get("ensembleGridStep").value, "8");
  assert.equal(app.elements.get("ensembleGridStrength").value, "p");
  assert.equal(app.elements.get("ensemblePatternChoice").value, "3");
  assert.match(app.elements.get("ensembleText").value, /T:Дөрвөн такт/);
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
  assert.deepEqual((await saveNativeProject(app)).data, saved.data);
  app.elements.get("ensemblePatternBar").value = "1";
  app.fire("ensemblePatternBar", "change");
  app.elements.get("ensembleGridCells").children[4].children[1].children[0].click();
  app.elements.get("ensemblePatternTextMode").value = "full";
  app.fire("ensemblePatternTextMode", "change");
  const bars = drumABC.gridOf(drumABC.parse(app.elements.get("ensembleText").value));
  assert.equal(bars[0].cells[0].woodblock, .55);
  assert.equal(bars[6].cells[0].woodblock, .55, "The reopened repeated pattern still edits both occurrences");
  assert.equal(bars.filter(bar => bar.cells[0].woodblock === .55).length, 2);
  assert.equal(savedDrums.patterns.patterns[1].bars[0].cells[0].woodblock, undefined);
  assert.equal(app.contexts.length, 0);
});

test("native projects preserve invalid and empty solo drafts before parsing has caught up", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  for (const draft of ["", "% unfinished\nM:4/4\nL:1/4\nQ:1/4=96\nK:C\n[CE"]) {
    app.elements.get("composeText").value = draft;
    app.fire("composeText", "input");
    const saved = await saveNativeProject(app);
    assert.equal(saved.data.content.abc, draft);
    assert.match(app.elements.get("projectStatus").textContent, /Draft project/i);
    app.elements.get("composeExample").value = "first";
    app.fire("composeExample", "change");
    assert.equal(app.elements.get("composePlayPause").disabled, false);
    assert.equal(await offerNativeProject(app, saved.text), true);
    assert.equal(app.fire("projectReplace", "click"), true);
    assert.equal(app.elements.get("composeText").value, draft);
    assert.equal(app.elements.get("composePlayPause").disabled, true);
    assert.match(app.elements.get("projectStatus").textContent, /as a draft/);
    assert.deepEqual((await saveNativeProject(app)).data, saved.data);
  }
  assert.equal(app.contexts.length, 0);
});

test("native ensemble files keep an empty pattern draft, last valid links, and detached raw drafts", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  app.composeSubtabButtons[1].click();
  app.fire("ensembleAddDrums", "click");
  app.elements.get("ensembleText").value = "";
  app.fire("ensembleText", "input");
  const saved = await saveNativeProject(app);
  const drums = saved.data.content.tracks[2];
  assert.equal(drums.patternDraft.text, "");
  assert.match(drums.abc, /%%MIDI channel 10/);
  assert.equal(drums.patterns.sequence.length, 4);
  assert.match(app.elements.get("projectStatus").textContent, /Draft project/i);
  app.elements.get("ensemblePreset").value = "starter";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(await offerNativeProject(app, saved.text), true);
  assert.equal(app.fire("projectReplace", "click"), true);
  assert.equal(app.elements.get("ensembleText").value, "", "Empty text is a real draft, not a missing field");
  assert.equal(app.elements.get("ensemblePlayPause").disabled, true);
  assert.equal(app.elements.get("ensemblePatternRevert").hidden, false);
  app.fire("langMn", "click");
  assert.match(app.elements.get("projectStatus").textContent, /нооргоор/);
  app.elements.get("ensembleTrackList").children[0].children[0].children[0].click();
  app.elements.get("ensembleTrackList").children[2].children[0].children[0].click();
  assert.equal(app.elements.get("ensembleText").value, "", "Track redraw must not replace an empty draft with valid pattern ABC");
  assert.deepEqual((await saveNativeProject(app)).data, saved.data);
  app.fire("ensemblePatternRevert", "click");
  assert.equal(app.elements.get("ensemblePlayPause").disabled, false);
  assert.match(app.elements.get("ensembleText").value, /%%MIDI channel 10/);

  app.elements.get("ensemblePatternTextMode").value = "full";
  app.fire("ensemblePatternTextMode", "change");
  const rawDraft = app.elements.get("ensembleText").value.replace("channel 10", "channel 9") + "\n% unfinished whole song";
  app.elements.get("ensembleText").value = rawDraft;
  app.fire("ensembleText", "input");
  const rawSaved = await saveNativeProject(app);
  assert.equal(rawSaved.data.content.tracks[2].patterns, null);
  assert.equal(rawSaved.data.content.tracks[2].abc, rawDraft);
  app.elements.get("ensemblePreset").value = "starter";
  app.fire("ensembleApplyPreset", "click");
  assert.equal(await offerNativeProject(app, rawSaved.text), true);
  assert.equal(app.fire("projectReplace", "click"), true);
  assert.equal(app.elements.get("ensembleText").value, rawDraft);
  assert.equal(app.elements.get("ensemblePatternTools").hidden, true);
  assert.equal(app.elements.get("ensemblePlayPause").disabled, true);
  assert.deepEqual((await saveNativeProject(app)).data, rawSaved.data);
  assert.equal(app.contexts.length, 0);
});

test("failed and cancelled project opens preserve running music; confirmed replacement stops without autoplay", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  app.elements.get("projectName").value = "Do not lose this";
  app.fire("projectName", "input");
  app.elements.get("composeInstrument").value = "guitar";
  app.fire("composeInstrument", "change");
  await app.fire("composePlayPause", "click");
  const context = app.contexts[0], active = context.sources[0];
  const saved = await saveNativeProject(app);
  assert.match(app.elements.get("composePlayPause").textContent, /Pause/);
  assert.notEqual(active.stopped, true, "Saving must not stop playback");
  const current = app.elements.get("composeText").value;
  const malformed = ["{ broken", JSON.stringify({ ...saved.data, version: 99 }),
    JSON.stringify({ ...saved.data, format: "unrelated-file" }),
    JSON.stringify({ ...saved.data, content: { ...saved.data.content, volume: "47" } })];
  for (const bad of malformed) {
    assert.equal(await offerNativeProject(app, bad), false);
    assert.equal(app.elements.get("projectConfirm").hidden, true);
    assert.equal(app.elements.get("composeText").value, current);
    assert.equal(app.elements.get("projectName").value, "Do not lose this");
    assert.match(app.elements.get("projectStatus").textContent, /unchanged/);
    assert.match(app.elements.get("composePlayPause").textContent, /Pause/);
    assert.notEqual(active.stopped, true);
  }
  let read = false;
  assert.equal(await offerNativeProject(app, saved.text, { size: 16 * 1024 * 1024 + 1,
    text: async () => { read = true; return saved.text; } }), false);
  assert.equal(read, false, "An oversized file is rejected before reading");
  assert.equal(await offerNativeProject(app, saved.text, { text: async () => { throw new Error("unreadable"); } }), false);
  assert.match(app.elements.get("projectStatus").textContent, /could not be read/);
  assert.equal(app.elements.get("composeText").value, current);
  assert.notEqual(active.stopped, true);
  const next = JSON.stringify({ ...saved.data, title: "Replacement", content: { ...saved.data.content, volume: 22 } });
  assert.equal(await offerNativeProject(app, next), true);
  assert.equal(app.elements.get("composeVolume").value, "38");
  assert.notEqual(active.stopped, true, "Reviewing a candidate does not change the current transport");
  app.fire("projectCancel", "click");
  assert.equal(app.elements.get("projectConfirm").hidden, true);
  assert.match(app.elements.get("projectStatus").textContent, /cancelled/);
  assert.equal(app.elements.get("composeText").value, current);
  assert.notEqual(active.stopped, true);
  assert.equal(await offerNativeProject(app, next), true);
  const voicesBefore = context.oscillators.length + context.sources.length;
  assert.equal(app.fire("projectReplace", "click"), true);
  assert.equal(active.stopped, true);
  assert.equal(context.oscillators.length + context.sources.length, voicesBefore,
    "Opening initializes no new playback voices");
  assert.equal(app.elements.get("composeVolume").value, "22");
  assert.match(app.elements.get("composePlayPause").textContent, /Play/);
  assert.match(app.elements.get("projectStatus").textContent, /Nothing plays until/);
  assert.equal(app.elements.get("projectName").value, "Replacement");
});

test("a late project-file read cannot replace a newer candidate or reopen after cancellation", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  const saved = await saveNativeProject(app);
  const oldText = JSON.stringify({ ...saved.data, title: "Older request" });
  const newText = JSON.stringify({ ...saved.data, title: "Newest request" });
  let resolveOld;
  const delayed = offerNativeProject(app, oldText, { text: () => new Promise(resolve => { resolveOld = resolve; }) });
  assert.equal(await offerNativeProject(app, newText), true);
  resolveOld(oldText);
  assert.equal(await delayed, false);
  assert.match(app.elements.get("projectConfirmText").textContent, /Newest request/);
  assert.equal(app.fire("projectReplace", "click"), true);
  assert.equal(app.elements.get("projectName").value, "Newest request");
  let resolveCancelled;
  const cancelled = offerNativeProject(app, oldText, { text: () => new Promise(resolve => { resolveCancelled = resolve; }) });
  app.fire("projectCancel", "click");
  resolveCancelled(oldText);
  assert.equal(await cancelled, false);
  assert.equal(app.elements.get("projectConfirm").hidden, true);
  assert.equal(app.elements.get("projectName").value, "Newest request");
  assert.equal(app.contexts.length, 0);
});

async function exportedWav(app) {
  const output = app.objectUrls.at(-1);
  assert.equal(output.blob.type, "audio/wav");
  const bytes = new Uint8Array(await output.blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), "RIFF");
  assert.equal(Buffer.from(bytes.subarray(8, 12)).toString(), "WAVE");
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), bytes.length - 44);
  return { bytes, seconds: (bytes.length - 44) / 2 / 44100, url: output.url };
}

test("Compose exports the latest solo text beyond 30 seconds without a live audio context or recorder", async () => {
  const app = fakePage("", false); // Export does not require AudioWorklet support.
  assert.equal(app.elements.get("exportWav").textContent, "WAV гаргах");
  assert.equal(app.elements.get("exportDownload").hidden, true);
  app.fire("modeCompose", "click");
  app.fire("langEn", "click");
  assert.equal(app.elements.get("exportWav").textContent, "Export WAV");
  app.elements.get("projectName").value = "Миний аялгуу";
  app.elements.get("composeInstrument").value = "guitar";
  app.fire("composeInstrument", "change");
  const text = "X:1\nT:Latest unparsed text\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\n" +
    "C4 | D4 | E4 | F4 | G4 | A4 | B4 | c4 | " +
    "C4 | D4 | E4 | F4 | G4 | A4 | B4 | c4 |]";
  app.elements.get("composeText").value = text;
  app.fire("composeText", "input");
  const pending = app.fire("exportWav", "click");
  assert.equal(app.elements.get("exportWav").disabled, true);
  assert.equal(await app.fire("exportWav", "click"), false, "Repeated clicks cannot overlap renders");
  assert.equal(await pending, true, app.elements.get("exportStatus").textContent);
  assert.equal(app.exportRequests.length, 1);
  assert.equal(app.exportRequests[0].content.abc, text, "Uses the raw editor before parse debounce");
  assert.equal(app.elements.get("composeText").value, text);
  assert.equal(app.elements.get("exportDownload").download, "Миний аялгуу.wav");
  assert.equal(app.elements.get("exportDownload").hidden, false);
  const wav = await exportedWav(app);
  assert.ok(wav.seconds > 32 && wav.seconds < 35, "Written duration and final guitar tail included");
  assert.equal(app.offlineContexts.length, 1);
  assert.equal(app.offlineContexts[0].rendered, true);
  assert.equal(app.contexts.length, 0, "Export never constructs the live AudioContext");
  assert.equal(app.timers.size, 0, "No live look-ahead scheduler is started");
  assert.equal(app.elements.get("exportWav").disabled, false);
});

test("ensemble WAV snapshots tuning, strumming, mix and expanded linked drums without touching the solo workspace", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  const soloText = app.elements.get("composeText").value;
  app.composeSubtabButtons[1].click();
  app.elements.get("ensemblePreset").value = "guitarStrum";
  app.fire("ensembleApplyPreset", "click");
  app.elements.get("ensembleTuning").value = "pythagorean";
  app.fire("ensembleTuning", "change");
  const technique = projectTrackControl(app, 0, "ensemble-guitar-mode");
  technique.value = "up";
  technique.events.change();
  const spacing = projectTrackControl(app, 0, "ensemble-guitar-spacing");
  spacing.value = "43";
  spacing.events.input();
  projectDescendants(app.elements.get("ensembleTrackList").children[1])
    .find(node => node.textContent === "Mute").click();
  app.elements.get("ensembleTrackList").children[2].children[0].children[0].click();
  const patternText = app.elements.get("ensembleText").value.replace("T:A", "T:Export rhythm");
  app.elements.get("ensembleText").value = patternText;
  app.fire("ensembleText", "input");
  const saved = (await saveNativeProject(app)).data;
  assert.equal(await app.fire("exportWav", "click"), true, app.elements.get("exportStatus").textContent);
  const snapshot = app.exportRequests[0];
  assert.equal(snapshot.mode, "ensemble");
  assert.deepEqual(projectCodec.validate({ ...saved, content: snapshot.content }).content, saved.content);
  assert.equal(snapshot.content.tuning, "pythagorean");
  assert.deepEqual(snapshot.content.tracks[0].guitar, { mode: "up", spacingMs: 43 });
  assert.equal(snapshot.content.tracks[1].mute, true);
  assert.equal(snapshot.content.tracks[2].patterns.patterns[0].name, "Export rhythm");
  assert.ok(app.offlineContexts[0].sources.length > 0, "Guitar/drum buffer sources were scheduled");
  assert.equal(app.elements.get("composeText").value, soloText);
  assert.deepEqual((await saveNativeProject(app)).data, saved, "Export leaves all editable state intact");
  assert.equal(app.contexts.length, 0);
});

test("invalid latest notation and empty pattern drafts cannot export an older playable score", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  app.elements.get("composeText").value = "";
  app.fire("composeText", "input");
  assert.equal(await app.fire("exportWav", "click"), false);
  assert.equal(app.elements.get("exportStatus").classList.contains("error"), true);
  assert.equal(app.elements.get("composeText").value, "");
  assert.equal(app.objectUrls.length, 0);
  app.composeSubtabButtons[1].click();
  app.fire("ensembleAddDrums", "click");
  app.elements.get("ensembleText").value = "";
  app.fire("ensembleText", "input");
  const previousRevertVisibility = app.elements.get("ensemblePatternRevert").hidden;
  assert.equal(await app.fire("exportWav", "click"), false);
  assert.equal(app.elements.get("ensembleText").value, "");
  assert.equal(app.exportRequests.at(-1).content.tracks[2].patternDraft.text, "");
  assert.equal(app.elements.get("ensemblePatternRevert").hidden, previousRevertVisibility,
    "Export does not force editor parsing/redrawing before the pending debounce");
  assert.equal(app.offlineContexts.length, 0, "Invalid drafts fail before offline allocation");
  assert.equal(app.contexts.length, 0);
});

test("WAV export and an unsupported retry preserve live playback and the previous prepared file", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  app.elements.get("composeInstrument").value = "guitar";
  app.fire("composeInstrument", "change");
  await app.fire("composePlayPause", "click");
  const live = app.contexts[0], ringing = live.sources[0];
  const liveSources = live.sources.length;
  assert.equal(await app.fire("exportWav", "click"), true, app.elements.get("exportStatus").textContent);
  const oldUrl = app.elements.get("exportDownload").href;
  assert.equal(live.sources.length, liveSources);
  assert.equal(ringing.stopped, false);
  assert.match(app.elements.get("composePlayPause").textContent, /Pause/);
  assert.equal(live.worklets.length, 0);
  app.window.OfflineAudioContext = undefined;
  assert.equal(await app.fire("exportWav", "click"), false);
  assert.equal(app.elements.get("exportDownload").href, oldUrl);
  assert.equal(app.elements.get("exportDownload").hidden, false);
  assert.equal(app.elements.get("exportStatus").classList.contains("error"), true);
  assert.equal(ringing.stopped, false);
  assert.equal(app.contexts.length, 1);
  assert.equal(app.offlineContexts.length, 1);
  app.fire("composeStop", "click");
});

test("pagehide suppresses a pending WAV download and permits retry only after the native render settles", async () => {
  const app = fakePage("?lang=en");
  app.fire("modeCompose", "click");
  const nativeRender = app.window.OfflineAudioContext.prototype.startRendering;
  let finish;
  let began;
  const ready = new Promise(resolve => { began = resolve; });
  app.window.OfflineAudioContext.prototype.startRendering = function () {
    return new Promise(resolve => {
      finish = async () => resolve(await nativeRender.call(this));
      began();
    });
  };
  const pending = app.fire("exportWav", "click");
  await ready;
  app.window.events.pagehide();
  assert.equal(app.elements.get("exportWav").disabled, true);
  assert.equal(await app.fire("exportWav", "click"), false);
  await finish();
  assert.equal(await pending, false);
  assert.equal(app.objectUrls.length, 0, "No stale automatic file download after leaving the page");
  assert.equal(app.elements.get("exportWav").disabled, false);
  app.window.OfflineAudioContext.prototype.startRendering = nativeRender;
  assert.equal(await app.fire("exportWav", "click"), true, app.elements.get("exportStatus").textContent);
  assert.equal(app.objectUrls.length, 1);
  assert.equal(app.contexts.length, 0);
});
