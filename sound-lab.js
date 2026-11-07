/* Sound Lab: pure tones, modeled transients, moving pitch, and two-tone interference. */
(() => {
  "use strict";
  const model = window.SoundLabModel;
  const transientModel = window.SoundLabTransientModel;
  const drumModel = window.SoundLabDrumABC;
  const sustainModel = window.SoundLabSustain;
  const heldVoiceModel = window.SoundLabHeldVoice;
  const i3HeldModel = window.SoundLabI3Held;
  const spectrumModel = window.SoundLabSpectrum;
  const motionModel = window.SoundLabMotionModel;
  const beatsModel = window.SoundLabBeats;
  const intervalModel = window.SoundLabIntervals;
  const earModel = window.SoundLabEarTune;
  const scaleModel = window.SoundLabScales;
  const limit5Model = window.SoundLabLimit5;
  const tempModel = window.SoundLabTemperaments;
  const harmonicModel = window.SoundLabHarmonics;
  const noiseModel = window.SoundLabNoise;
  const recorderModel = window.SoundLabRecorder;
  const composeModel = window.SoundLabCompose;
  const ensembleModel = window.SoundLabEnsemble;
  const projectUI = window.SoundLabProjectUI;
  const exportModel = window.SoundLabExport;
  const exportUI = window.SoundLabExportUI;
  const analysisModel = window.SoundLabAnalysis;
  const microphoneModel = window.SoundLabMicrophone;
  const compareModel = window.SoundLabCompare;
  const $ = id => document.getElementById(id);
  const heldFamily = kind => ["flute", "clarinet"].includes(kind) ? "air" :
    ["violin", "morin"].includes(kind) ? "bow" :
      kind.startsWith("organ-") ? "organ" : "reed";
  const heldModelFor = kind => i3HeldModel.KINDS.includes(kind) ? i3HeldModel : sustainModel;

  const messages = {
    en: {
      backLabel: "Back to Sol tools", stop: "■ Stop",
      chooseShape: "Choose a wave shape",
      sine: "Sine", triangle: "Triangle", square: "Square", sawtooth: "Sawtooth",
      play: "Play tone", playCaption: "Tap or click to hear",
      stopTone: "Stop tone", stopCaption: "Sound is playing · tap to stop",
      frequency: "Frequency", snap: "Snap to notes",
      sliderHint: "The slider is logarithmic. Type a frequency for values outside its range.",
      sliderOutside: "The typed frequency is beyond the slider range; the exact value is still used.",
      tryNote: "Try a note:", volume: "Volume",
      safeVolume: "Start at a low volume and increase carefully, especially with headphones.",
      settings: "⚙ Settings", tuning: "Tuning for snapped notes",
      tuningHint: "The note names use 12-tone equal temperament for now.",
      equal: "12-tone equal", fixedTime: "Keep the time window fixed at 20 ms",
      unitHz: "Hz", unitKHz: "kHz", unitSeconds: "s", unitMilliseconds: "ms",
      strikePresetOneSecond: "1 s", strikePreset200Ms: "200 ms", strikePreset20Ms: "20 ms",
      fixedHint: "Uncheck to zoom into four periods and examine the wave shape. The time scale then changes with frequency.",
      waveTitle: "Waveform over time", waveSubtitle: "Same 20 ms at every frequency: higher pitch means more cycles.",
      waveSubtitleZoom: "Zoomed to four periods: the time scale now changes with frequency.",
      cyclesUnit: "cycles",
      spectrumTitle: "Harmonics", spectrumSubtitle: "Ideal frequency components, relative to the first",
      timeAxis: "time →", frequencyAxis: "frequency →",
      tryThis: "TRY THIS", reset: "↺ Reset",
      learnMore: "Why do sound waves sound different?",
      lessonOne: "A periodic wave has a lowest frequency, called its fundamental. This determines the pitch we hear. Higher harmonics occur at whole-number multiples of it: 2f, 3f, 4f, and so on.",
      lessonTwo: "The wave shape determines the mixture of harmonics. A pure sine wave has only its fundamental. Two instruments can play the same pitch yet sound different because their harmonic mixtures are different.",
      footer: "Sound Lab · Sound and recordings stay on your device; nothing is uploaded.",
      designCredit: "Designed by Gantumur", licenseLink: "App code: MIT License",
      recordStart: "REC", recordStop: "SAVE", recordSave: "Download WAV", recordAnalyze: "Analyze",
      recordStartAria: "Start recording up to {seconds} seconds of Sound Lab audio; no microphone",
      recordStopAria: "Stop recording and save the WAV file",
      recordSavedShort: "Your WAV is ready", recordResultAria: "Last recorded sound",
      recordDismissAria: "Close recorded sound preview",
      recordReady: "Press Record, then play a tone, strike, or move the theremin.",
      recordPreparing: "Preparing local recording…", recordRecording: "Recording this tool's sound…",
      recordSaving: "Preparing WAV…", recordSaved: "Ready. Listen or save the WAV file.",
      recordEmpty: "No samples captured. Try again.",
      recordUnsupported: "This browser does not support local sound recording.",
      recordError: "Recording failed. Please try again.", recordPreviewAria: "Recorded sound preview",
      waveAria: "Modeled waveform over time", spectrumAria: "Modeled harmonic magnitude spectrum",
      sliderAria: "Logarithmic frequency slider", frequencyAria: "Exact frequency in hertz",
      presetsAria: "Musical note presets", waveGroupAria: "Waveform shape",
      langGroupAria: "Interface language", amplitude: "amplitude",
      ready: "Ready. Sound begins only when you press Play.",
      starting: "Starting sound…",
      playing: "Playing. Use the large button or Stop to silence it.",
      stopped: "Stopped. Press Play to hear this wave.",
      hidden: "Sound stopped when you left the page.",
      unsupported: "This browser does not support Web Audio playback.",
      blocked: "The sound could not start. Check browser audio permission and try Play again.",
      invalid: "Enter a frequency between 20 and 12,000 Hz.",
      modePure: "Pure tones", modeStrike: "Strike/Pluck", modeSustain: "Blow/Bow", modeMotion: "Moving pitch",
      modeMix: "Combine waves", modeTuning: "Tuning", modeCompose: "Compose", modeAnalysis: "Analysis",
      composeSolo: "Single instrument", composeEnsemble: "Many instruments",
      composeModesAria: "Compose mode",
      modeSwitchAria: "Sound categories",
      pureExperimentsAria: "Wave shapes and timbre experiments",
      pureExperimentWaves: "Waveforms", pureExperimentHarmonics: "Build timbre",
      mixExperimentsAria: "Explore combined and complex sounds",
      mixExperimentBeats: "Two frequencies",
      mixExperimentIntervals: "Interval", mixExperimentNoise: "Noise",
      intervalExperiment: "Ratios", earExperiment: "Tune",
      tuningExperimentsAria: "Tuning experiments", scaleExperiment: "3-limit", limit5Experiment: "5-limit", tempExperiment: "Temperaments",
      earChoose: "Tune the next note",
      earDescription: "Choose a ratio and tune the second note by ear. Try downward intervals and octave shifts too.",
      earPlay: "Hear the two notes", earStop: "Stop listening",
      earPlayCaption: "Compare in sequence or together", earPlaySequential: "First note, then second · repeated",
      earPlayTogether: "Both notes together · repeated",
      earTasksTitle: "Choose a challenge", earTasksAria: "Ear-tuning exercise choices",
      earTaskFifth: "3:2 · Fifth", earTaskThird: "5:4 · Third",
      earTaskFourth: "4:3 · Fourth", earTaskOctaveUp: "2:1 · Up an octave",
      earTaskDownFourth: "3:4 · Down a fourth", earTaskDownFifth: "2:3 · Down a fifth",
      earTaskOctaveDown: "1:2 · Down an octave",
      earSoundTitle: "Sound color", earSoundAria: "Choose a model sound for ear tuning",
      earSoundPure: "Pure sine", earSoundRich: "Rich harmonics",
      earSoundGuitar: "Guitar pluck", earSoundPiano: "Piano strike",
      earSoundHint: "A sine has no upper partials. Guitar and piano are simplified struck-string models; piano partials are slightly inharmonic.",
      earCompareTitle: "How to compare?", earCompareAria: "Alternate the notes or play them together",
      earAlternating: "In sequence", earTogether: "Together",
      earHelpTitle: "Learning mode", earHelpAria: "Harmonic or ears-only tuning",
      earGuided: "Show harmonics", earBlind: "Listen only",
      earHelpHint: "All the visible harmonics are drawn equally; none is specially marked as the answer. Then try with the graph hidden.",
      earAdjustTitle: "Tune the second note", earAdjustAria: "Raise or lower the second note while listening",
      earAdjustHint: "The second pitch begins slightly mistuned. Listen and adjust it, then press Check.",
      earCheck: "Check my tuning", earHarmonicsTitle: "The two sets of harmonics",
      earHarmonicsHint: "Compare up to eight partials of each sound. No sliding target circles or matching pairs are marked.",
      earHarmonicsAria: "Modeled harmonic lines for the reference and adjustable notes",
      earOctaveTitle: "Bring the note into one octave", earOctaveHint: "The orange dot is the note you tuned; the green dot is the same note class moved into C4–C5 by multiplying or dividing its frequency by two.",
      earOctaveAria: "Checked note and its octave-equivalent copy on a C3 to C5 pitch scale",
      earOctaveAxis: "C3 · C4 · C5 →", earChallenge: "Tune 3:4 and 2:3 downward. After checking, use ×2 to see where each pitch lands in the C4 octave. Which upward ratios produce those same pitches?",
      earLearnMore: "How can you tune by listening for beating?",
      earLessonOne: "For 3:2, 3f of the reference coincides with 2f of the tuned note. For 5:4, the 5th and 4th coincide; for 3:4, 3f of the reference and 4f of the lower note coincide. Off-tuning creates beating if those partials are audible. Pure sines lack those upper partials, and piano-string inharmonicity shifts them slightly.",
      earLessonTwo: "Multiplying C4 by 3/4, 2/3 or 1/2 makes a pitch below C4. Multiplying that result by 2 moves it into the C4–C5 octave without changing its pitch class: 3/4 × 2 = 3/2 and 2/3 × 2 = 4/3. Repeated ratio steps are explored in the 3-limit and 5-limit tabs.",
      earReady: "Ready. Tap In sequence or Together to listen, then tune the second note.", earStarting: "Preparing two tones…",
      earPlaying: "Compare the notes. Together, listen for beating; in sequence, compare their pitches.",
      earStopped: "Stopped. You can still adjust the note and check it.",
      earHidden: "The two notes stopped when you left the page.",
      earBlocked: "Could not start sound. Check the browser's audio settings.",
      earInstruction: "Tune {from} → {to} by multiplying by {ratio}. The exact frequency remains hidden until Check.",
      earSliderLabel: "← lower · higher →", earCheckExcellent: "Excellent! The ratio is very close.",
      earCheckClose: "Close! Listen and refine it further.",
      earCheckRetry: "Try again: the second note is still noticeably off.",
      earCheckResult: "{rating}\nExact goal: {target} Hz · yours: {actual} Hz · error: {error} cents.\nIdeal-partial beat rate: {beats} Hz (when those partials are present).",
      earFoldFact: "Same pitch class: {from} Hz {operation} = {to} Hz ({note}).",
      earNoFold: "Already in the C4–C5 octave; no octave shift needed.",
      earHarmonicsFoot: "Blue: reference · orange: adjustable. Heights show modeled partial strengths.",
      earHarmonicsHiddenFoot: "Harmonics hidden. Tune by hearing alone.",
      earOctaveFoot: "Check your tuning to reveal the note's position.",
      earOctaveFoldFoot: "The dotted link connects octave-equivalent pitches.",
      scaleChoose: "Build a scale with 3:2", scaleDescription: "Walk upward or downward by exact 3:2 steps. Fold the notes into one octave, then choose which note acts as the tonic.",
      scalePlay: "Hear the scale", scaleStop: "Stop", scalePlayCaption: "Play ascending and descending",
      scalePresetsTitle: "Scale patterns", scalePresetsAria: "Fifth-chain patterns",
      scaleCustom: "Custom chain", scalePlaybackAria: "Play the fifth-chain notes in sequence or together",
      scaleFiveUp: "5 · Up", scaleFiveCenter: "5 · Both", scaleFiveDown: "5 · Down",
      scaleSeven: "7 notes", scaleTwelve: "12 notes", scaleNotesUnit: "notes",
      scaleGapToggle: "Show the return gap", scaleGapTitle: "How close is the ghost return?",
      scaleGapPlay: "Hear both pitches", scaleGapStop: "Stop comparison",
      scaleGapInfo: "After {count} fifths ({direction}), compare ghost step {ghost} with the starting pitch shifted by {octaves} octaves: {cents} cents ({angle}°) apart.",
      scaleGapDirectionUp: "up", scaleGapDirectionDown: "down",
      scaleGapPythagorean: "Pythagorean comma", scaleGapOther: "Return gap",
      scaleGapSummary: "{name}: {cents} cents · {angle}° · {beats} Hz apart",
      scaleGapFoot: "Magnified pitch comparison, not a spectrum. Play both octave-adjusted pitches together to hear their interference beats.",
      scaleGapFrom: "starting pitch", scaleGapGhost: "ghost return", scaleGapUnit: "cents",
      scaleGapCanvasAria: "Magnified cents comparison of the starting fifth-chain pitch with the octave-adjusted ghost return",
      scaleGrowTitle: "Grow the 3:2 chain", scaleDirectionsAria: "Add or remove fifth-chain steps",
      scaleAddDown: "← Down 3:2", scaleAddUp: "Up 3:2 →",
      scaleRemoveDownAria: "Remove the lowest fifth-chain step", scaleRemoveUpAria: "Remove the highest fifth-chain step",
      scaleGrowHint: "Each step is multiplied or divided by 3:2, then brought into one octave using powers of 2.",
      scaleBase: "Starting frequency", scaleBaseSliderAria: "Starting note frequency slider",
      scaleBaseInputAria: "Starting note frequency in hertz",
      scaleTonicTitle: "Choose the tonic", scaleTonicHint: "The generated pitch collection stays the same; choosing a different tonic changes the order and character of the scale.",
      scaleTonicAria: "Choose a scale tonic from the generated pitches",
      scaleTonicFact: "Tonic frequency", scaleReturnFact: "Distance from nearest octave",
      scaleStepsFact: "Adjacent pitch gaps", scaleOctaveFact: "Fifth steps · octaves",
      scaleSpiralTitle: "Octave spiral of 3:2 steps", scaleSpiralHint: "Start at step 0. Fifths spiral outward or inward; faint spokes show pitch order in an octave. Green marks the tonic; gold follows playback.",
      scaleSpiralAria: "Octave spiral: numbered 3:2 fifth steps across several octaves",
      scaleSpiralFoot: "Spiral steps show generation order; faint rays show the different ascending pitch order around one octave.",
      scaleSpiralAxis: "3:2 ↻ 210.6°",
      scaleFourierTitle: "Notes and harmonics", scaleFourierHint: "Each higher row is 3:2 above the one below. Circles: original fundamentals; diamonds: possible harmonics; gray dots: the same notes moved by octaves.",
      scaleFourierAria: "Log-frequency harmonic rows of the fifth chain with virtual octave references",
      scaleFourierAxis: "log₂ f →", scaleFourierFoot: "Read note pitches left to right inside the green one-octave window. Gray copies can be played after transposition; they are not extra simultaneous overtones. 3f₁ = 2f₂.",
      scaleWindowLabel: "one octave",
      scaleNowIdle: "Play to hear the notes in rising and falling pitch order.",
      scaleNowPlaying: "Playing: step {step} · {ratio}{octave}", scaleNowUpperOctave: " · upper octave",
      scaleChallenge: "Build five pitches, then add a step on either end to reach seven. Change the tonic: how does the melody sound?",
      scaleLearnMore: "How can the same notes make different scales?",
      scaleLessonOne: "Repeated exact 3:2 ratios create a chain of fifths. Dividing or multiplying by powers of two puts every generated pitch into one octave. A sequence of five consecutive fifths produces a pentatonic collection; seven produces a diatonic one.",
      scaleLessonTwo: "The tonic is a choice of musical center, not a new frequency ratio. For example, C–D–E–G–A is C major pentatonic, while the same pitches starting and ending on A form A minor pentatonic. Twelve exact fifths miss seven octaves by about 23.46 cents: the Pythagorean comma.",
      scaleReady: "Ready. Play the scale, or change its notes.", scaleStarting: "Preparing the melody…",
      scalePlaying: "Playing in sequence. Tap the same button to stop.",
      scaleChordPlaying: "Playing all notes together. Tap Together again to stop.",
      scaleGapPlaying: "Playing the starting pitch and ghost return together.",
      scaleGapDone: "Comparison finished. Change the number of fifths to hear another gap.",
      scaleStopped: "Stopped. Try another tonic or direction.", scaleHidden: "Melody stopped when you left the page.",
      scaleUnsupported: "This browser cannot play the generated scale.",
      scaleBlocked: "The melody could not start. Check your browser audio settings.",
      scaleInvalid: "Enter a starting frequency from 110 to 330 Hz.",
      limit5Choose: "Build notes with 3:2 and 5:4", limit5Description: "Move horizontally by a pure fifth (3:2), diagonally by a major third (5:4). Fold the points into one octave and choose your own notes.",
      limit5Play: "Hear the notes", limit5Stop: "Stop", limit5PlayCaption: "In sequence or together",
      limit5PresetsTitle: "Examples and exercises", limit5PresetsAria: "Five-limit examples and comma routes",
      limit5Major: "C major", limit5Minor: "E minor", limit5GMajor: "G major", limit5DMinor: "D minor", limit5Seven: "7 notes", limit5Just12: "12 just notes · C-centred", limit5Fifths: "Only 3:2",
      limit5JustHint: "Twelve exact lattice notes, one per keyboard key. For A4 = 440 Hz the reference is C4 = 264 Hz. This is one C-centred choice: chords in other keys need not be pure. Play in sequence to hear the scale; all twelve together sound dense.",
      limit5CommaE: "E: two routes (81:80)", limit5CommaD: "D: two routes (81:80)",
      limit5Diaschisma: "Second 5:4 layer (2048:2025)", limit5Custom: "My selection",
      limit5PickHint: "Tap a lattice point to add or remove it (up to 12). Its octave pitch is shown on the right.",
      limit5BaseTitle: "Reference C frequency", limit5BaseHint: "261.63 Hz is middle C. Changing it transposes the entire tuning together.",
      limit5PlaybackAria: "Play or stop the selected notes in sequence or together", limit5Melody: "In sequence", limit5Chord: "Together",
      limit5DisplayOptions: "Paths and guides", limit5Routes: "Show the two routes for a selected near-return",
      limit5TetGuides: "Connect points with the same 12-TET name", limit5TetHint: "Dashed links have similar nominal pitches, not necessarily equal exact frequencies.",
      limit5CommaFact: "{name}: {just} versus {pyth} · {cents} cents", limit5BeatFact: "{low} and {high} Hz · {beats} Hz beats",
      limit5LatticeTitle: "The 3–5 lattice", limit5LatticeHint: "→ is 3:2, ↗ is 5:4; the third edge is 6:5. Colored points form your selection.",
      limit5LatticeFoot: "Each layer adds a 5:4 step; select a point to inspect where it lands in the octave.", limit5GridAxis: "→ 3:2 · ↗ 5:4",
      limit5LatticeAria: "3:2 and 5:4 lattice: tap a note; keyboard arrows move, Enter selects", limit5NowIdle: "Play to see the sounding notes.", limit5NowPlaying: "Playing {ratio} · {hz}",
      limit5NowChord: "Playing the selected notes together.",
      limit5OctaveTitle: "Where the notes land in one octave", limit5OctaveHint: "Selected points are folded into C4–C5 and placed by cents; 12-TET ticks are only guides.",
      limit5OctaveFoot: "Only when a near-return pair is selected do we magnify its difference below; not every note receives an arbitrary comma.",
      limit5OctaveAria: "Selected octave-folded pitches with optional close-pair markers", limit5RulerTitle: "Difference between selected routes", limit5RulerValue: "{ratio} ≈ {cents} cents",
      limit5PointFact: "{name} · {ratio} · {cents} cents · {hz} · (m={m}, n={n}) · {fold}",
      limit5PairFact: "{name}: {just} and {pyth} · {cents} cents", limit5NoMatches: "Choose neighboring notes on the lattice to reveal exact harmonic coincidences.",
      limit5FourierTitle: "Notes and their harmonics", limit5FourierHint: "Each pitch-ordered row is a selected note. Circles: octave-folded fundamentals; diamonds: illustrative harmonics.",
      limit5FourierBadge: "3:2 · 5:4", limit5FourierAria: "Pitch-ordered harmonic rows, octave copies and harmonic coincidences for fifths and thirds",
      limit5FourierFoot: "Blue connections use 3:2; green use 5:4; gray diamonds are possible harmonics, not measured sound. Pale octave copies are not extra partials.",
      limit5Challenge: "Play C–E–G together, then select ‘E: two routes’ and listen for beats. Try the second 5:4 layer: does a different small gap appear?",
      limit5LearnMore: "How can one note have two exact pitches?",
      limit5LessonOne: "The 3-limit uses powers of 2 and 3. The 5-limit adds pure 5:4 major thirds, creating a second direction on the lattice. Choosing which pitches make a useful scale is also a musical decision, not only mathematics.",
      limit5LessonTwo: "Four pure fifths produce 81:64, while one 5:4 step gives 5:4: their 81:80 syntonic comma is 21.51 cents. With two 5:4 steps a different close-return example gives 2048:2025, the 19.55-cent diaschisma. These are relations between particular routes, not gaps attached to every note.",
      limit5Ready: "Ready. Choose a preset or lattice notes, then tap a blue playback button.", limit5Starting: "Preparing the sound…", limit5Playing: "Playing. Tap the active button to stop.",
      limit5Stopped: "Stopped. Try another selection.",
      limit5Hidden: "Sound stopped when you left the page.", limit5Invalid: "Enter a starting frequency from 110 to 330 Hz.",
      limit5NoNotes: "Choose at least one note before playing.", limit5Blocked: "Cannot start playback. Check your browser sound settings.",
      limit5Limit: "You can choose at most 12 notes.",
      tempChoose: "Twelve-note tuning systems", tempDescription: "Why do we change pure intervals? Compare a twelve-note just scale with temperaments, chord triangles, and imperfect fifths.",
      tempTaskTitle: "Listening experiment", tempTaskBuild: "Adjust the fifths", tempTaskWolf: "Compare fifths / wolf",
      tempTaskThird: "Compare pure thirds", tempTaskChord: "Chords in different keys",
      tempTaskHintBuild: "Move the slider: ordinary fifths get narrower, major thirds improve, but the closing fifth may become a wolf.",
      tempTaskHintWolf: "Compare an ordinary fifth C–G and the closing fifth G♯–E♭ in the same tuning. Listen for fast rough beating.",
      tempTaskHintWolfFree: "This system has no wolf. Compare C–G and the closing G♯–E♭ fifth: both stay near 700¢.",
      tempTaskHintJustFifth: "Just tuning gives nine pure fifths, but D–A and B♭–F are 21.51¢ narrow and F♯–C♯ is 19.55¢ wide. Compare C–G with D–A.",
      tempTaskHintJustBuild: "This is a fixed selection of twelve exact pitches, not a fifth-narrowing slider. Choose a chord root or quality to see which lattice triangles remain pure.",
      tempTaskHintThird: "Compare the selected tuning's third with an exact 5:4 major or 6:5 minor third. Listen for beating, not just pitch.",
      tempTaskHintChord: "Move the same major or minor triangle around the keys. Some temperaments change its sound greatly.",
      tempSystemTitle: "Tuning system", tempKeyTitle: "Chord root", tempQualityTitle: "Chord quality",
      tempEqual: "12-TET · Equal", tempPythagorean: "Pythagorean", tempMeantone: "Quarter-comma meantone",
      tempWerckmeister: "Werckmeister III", tempVallotti: "Vallotti", tempJust: "12-note just intonation · C", tempAdjustable: "Adjustable fifths",
      tempMajor: "Major", tempMinor: "Minor", tempNarrowTitle: "Narrow eleven fifths by", tempPresetAria: "Examples of fifth narrowing",
      tempPythShort: "Pythagorean", tempEqualShort: "Equal", tempNoWolfShort: "Pure closing fifth", tempMeantoneShort: "Quarter-comma",
      tempAdjustFact: "Ordinary fifth: {regular}¢ · closing fifth: {wolf}¢ · C–E third: {third}¢.",
      tempListenBuild: "Play the chosen chord while adjusting the fifths. Exact major thirds have a 5:4 ratio (386.31¢).",
      tempListenWolf: "Hear the wolf's rapid roughness: the lower note's third harmonic no longer lines up with the upper note's second.",
      tempListenWolfFree: "Here the closing fifth is deliberately tempered. Switch to Pythagorean or meantone to hear an actual wolf.",
      tempListenJustFifth: "Compare the pure C–G (701.96¢) and narrow D–A (680.45¢) fifths. The latter may beat noticeably with rich harmonics.",
      tempListenJustBuild: "C major is a pure 4:5:6 chord. Move the root to D major: its third is pure, but its fifth is no longer 3:2.",
      tempListenThird: "The fifth harmonic of the lower note and fourth of the higher note match in a pure major third.",
      tempListenThirdMinor: "In a pure minor third, the lower note's sixth harmonic matches the upper note's fifth.",
      tempListenChord: "Compare C major and G♯ major in meantone, then try equal temperament.",
      tempPlaybackAria: "Play the notes in sequence or together; tap again to stop", tempMelody: "In sequence", tempChord: "Together",
      tempRegularPlay: "Ordinary fifth", tempWolfPlay: "Wolf fifth", tempClosingPlay: "Closing fifth", tempJustImperfectPlay: "Narrow D–A fifth", tempTunedPlay: "Tuned third", tempPurePlay: "Pure third",
      tempReference: "A4 stays at 440 Hz in every system; the other pitches change.",
      tempLatticeTitle: "The 3:2–5:4 triangular lattice",
      tempLatticeHint: "Three exact-ratio rows: hollow points are 3:2–5:4 constructions. Colored pitches are shown beside fifth-chain shadows, not against every possible pure target. Displacements are magnified.",
      tempJustLatticeHint: "All twelve chosen pitches are exact 3:2–5:4 lattice points (three rows). Gold shows the ideal chord triangle; teal connects the actual notes. Different keys may make different triangles.",
      tempJustTunedLegend: "Chosen exact lattice notes",
      tempJustIntro: "One exact ratio per keyboard key, chosen around C. The highlighted chord may not be a pure triangle in another key. No single twelve-note just scale makes all keys pure.",
      tempJustRatioAria: "The twelve exact frequency ratios of the selected C-centred just scale",
      tempJustLatticeAria: "Three-row 3:2 and 5:4 lattice with twelve exact note points, an ideal chord triangle and the actual chord; click a named note to change root",
      tempJustFifthsAria: "Twelve fifths of the C-centred just scale: nine pure, two narrow and one wide",
      tempOpenJustLattice: "Explore the twelve exact points in 5-limit →",
      tempExactLegend: "Exact ratio lattice", tempTunedLegend: "Tuned pitches (fifth-chain view)", tempTriangleLegend: "Pure chord triangle",
      tempLatticeScale: "Pitch displacements ×8 (diagram only)",
      tempJustLatticeScale: "Actual lattice points · no magnification",
      tempLatticeFoot: "→ is a 3:2 fifth; ↗ a 5:4 third. The pure D♯ and E♭ fifth-chain endpoints differ by the Pythagorean comma (23.46¢).",
      tempJustLatticeFoot: "→ is an exact 3:2 fifth; ↗ an exact 5:4 third. Distinct octave-folded paths can have similar note names but different frequencies.",
      tempLatticeAria: "Three-row exact-ratio lattice, fifth-chain shadows of tuned notes, marked pure C to E target and chord triangles; click a named note to change root",
      tempLatticeFact: "The selected {quality} chord has a {third}¢ third ({thirdError}¢ from pure) and {fifth}¢ fifth ({fifthError}¢ from pure). Where visible, the dashed line shows the 21.51¢ third discrepancy.",
      tempLatticeWolf: "The ordinary C–G and the G♯–E♭ closing fifth are different. The 23.46¢ Pythagorean comma is why a pure-fifth D♯ cannot replace E♭ without changing the keyboard.",
      tempLatticeWolfFree: "This tuning distributes the closure without a single wolf. The exact lattice nevertheless has distinct E♭ and D♯ points, separated by 23.46¢.",
      tempJustLatticeFifths: "The fixed C-centred choice contains nine pure fifths and three altered fifths. The narrow D–A fifth demonstrates the cost of selecting only twelve exact pitches.",
      tempJustChordFact: "This {quality} chord has a {third}¢ third ({thirdError}¢ from pure) and a {fifth}¢ fifth ({fifthError}¢ from pure). Gold is the ideal triangle; teal is the chosen set of notes.",
      tempLatticeConstruction: "C→E by four tuned fifths: {actual}¢. Exact 5:4 target: 386.31¢ (difference {error}¢). {outcome}",
      tempLatticeConstructionExact: "The two constructions agree: E lands on the exact 5:4 point, even though its Pythagorean shadow is elsewhere.",
      tempJustConstructionExact: "C–E is an exact 5:4 third. This does not guarantee an exact third in every other key.",
      tempJustConstruction: "C→E through the chosen fifths: {actual}¢; pure 5:4: 386.31¢ (difference {error}¢). {outcome}",
      tempLatticeConstructionOther: "The two constructions differ. A colored note missing its Pythagorean shadow does not mean every pure interval is missed.",
      tempPartialTitle: "Matching harmonics and beating", tempPartialHint: "A pure fifth shares 3f of the low note with 2f of the high one; a pure major third shares 5f and 4f.",
      tempPartialHintMinor: "A pure minor third shares 6f of its lower note with 5f of its upper note.",
      tempPartialAria: "Harmonic frequency ladders for the two compared notes, highlighting near matching upper partials",
      tempBeatFact: "{lower}–{upper}: highlighted {a}f and {b}f differ by {beat} Hz. When heard together, rich tones may beat or sound rough.",
      tempCircleTitle: "Circle of fifths", tempCircleHint: "Select a root by tapping a note. Link colors show which fifths are pure, narrowed, or wolves.",
      tempCircleAria: "Interactive circle of fifths; tap a note to choose a chord root; left and right arrow keys rotate selection",
      tempPure: "Pure 3:2", tempNarrow: "Narrowed", tempWolfLegend: "Wolf fifth", tempJustWide: "Widened fifth",
      tempFifthsTitle: "How each fifth differs", tempFifthsHint: "Each bar is measured in cents relative to a pure 3:2 fifth. The horizontal line marks 0.",
      tempFifthsAria: "Twelve fifths: cents difference from a pure fifth; wolf fifth highlighted",
      tempFifthsTable: "Numerical table of twelve fifths", tempTableFifth: "Fifth", tempTableSize: "Size (cents)", tempTableDeviation: "From 3:2 (cents)",
      tempCommaBadge: "Pythagorean comma: {cents} cents", tempWolfFact: "Wolf fifth: {from}–{to}, {cents} cents ({deviation} from pure).",
      tempNoWolfFact: "All fifths close the circle without a single wolf interval. {narrow} of twelve fifths are tempered.",
      tempJustFifthsFact: "9 pure fifths; D–A and B♭–F are 21.51¢ narrow, F♯–C♯ is 19.55¢ wide. These are different fifths, not one closing wolf.",
      tempJustCircleFoot: "12 exact notes · 3 altered fifths",
      tempJustCircleHint: "Tap a note to choose a chord root. Green connections are exact 3:2 fifths, blue are narrow and orange are wide; there is no single closing wolf.",
      tempChordTitle: "Chord frequencies", tempChordHint: "All systems use A4 = 440 Hz. The deviations below compare each named note with 12-TET.",
      tempChordFoot: "Switch the tuning system or the root to hear how the same chord changes.",
      tempChordFact: "Root–third: {third} cents · root–fifth: {fifth} cents. (12-TET: {expected} and 700 cents.)",
      tempChallengeText: "Use Adjust the fifths: at 0¢ the major third is wide; at 5.38¢ it is pure, but the wolf grows. Then listen to the ordinary and wolf fifths with rich harmonics.",
      tempLearnMore: "Why is there more than one way to close the circle of fifths?",
      tempLessonOne: "A pure 3:2 fifth spans 701.955 cents, but twelve pure fifths exceed seven octaves by 23.46 cents (the Pythagorean comma). A closed twelve-note keyboard must distribute this difference.",
      tempLessonTwo: "Four pure fifths generate a 407.82-cent Pythagorean major third, while 5:4 is 386.31 cents. Quarter-comma meantone narrows each fifth by one fourth of their 21.51-cent syntonic comma, obtaining pure thirds at the cost of a wide wolf. The lattice shows alternative constructions, not unique coordinates for every frequency; pitch displacements are enlarged visually. This is a twelve-key reconstruction rather than a universal historical keyboard.",
      tempReady: "Ready. Select a tuning and listen to your chord.", tempStarting: "Preparing the notes…",
      tempPlaying: "Playing. Tap the active button again to stop.", tempStopped: "Stopped. Try a different tuning.",
      tempHidden: "Sound stopped when you left the page.", tempBlocked: "Playback failed. Check browser audio settings.",
      intervalChoose: "Two-note frequency ratios",
      intervalDescription: "Compare two independent notes in simple ratios and see where their harmonics overlap.",
      intervalPresetsTitle: "Ratio (upper : lower)", intervalPresetsAria: "Simple two-note frequency ratios",
      intervalNames: { "1:1": "Unison", "2:1": "Octave", "3:2": "Perfect fifth", "4:3": "Perfect fourth", "5:4": "Major third", "6:5": "Minor third" },
      intervalBase: "Lower-note pitch", intervalBaseSliderAria: "Lower note frequency slider",
      intervalBaseInputAria: "Lower note frequency in hertz",
      intervalTuningTitle: "Tuning", intervalTuningAria: "Two-note tuning system",
      intervalJust: "Just ratio", intervalEqual: "12-TET",
      intervalColorTitle: "Source color", intervalColorAria: "Pure or harmonic-rich tones",
      intervalPure: "Pure", intervalRich: "Rich",
      intervalColorHint: "Pure notes contain only their fundamentals. Rich notes contain upper harmonics, which can overlap or nearly overlap.",
      intervalPlay: "Play both", intervalStop: "Stop both",
      intervalNotes: "Two note pitches", intervalActualRatio: "Actual ratio",
      intervalPeriod: "Shared period", intervalReferencePeriod: "Just-ratio reference period",
      intervalOverlap: "First shared harmonics", intervalAlmost: "Near-shared partials",
      intervalJustStatus: "The chosen ratio is exact; these harmonics coincide.",
      intervalEqualStatus: "12-TET is {cents} cents from the just ratio. Near-shared partials differ by {hz}; in Rich mode they may beat.",
      intervalWaveTitle: "Two-note waveforms",
      intervalWaveHint: "Lower note, upper note, and their sum. An exact just interval repeats after a shared period.",
      intervalWaveFootJust: "Lower {low} cycles · upper {high} cycles in one shared period",
      intervalWaveFootEqual: "Window from just ratio: no exact joint repeat in 12-TET",
      intervalSpectrumTitle: "Harmonics of the two notes",
      intervalSpectrumHint: "Blue: lower note; orange: upper note. The first shared or near-shared partial pair is circled.",
      intervalSpectrumHintPure: "Pure sound has only two fundamental frequencies. Choose Rich to reveal matching upper harmonics.",
      intervalSpectrumJust: "{p} × {low} = {q} × {high} Hz",
      intervalSpectrumEqual: "{p} × {low} versus {q} × {high} Hz · difference {delta}",
      intervalSpectrumPure: "Only fundamentals are present in Pure mode; upper overlaps are hypothetical.",
      intervalChallenge: "Choose 4:3. Predict the shared period and matching harmonics, then compare with 12-TET.",
      intervalLearnMore: "How does a two-note ratio differ from one note's overtones?",
      intervalLessonOne: "A ratio such as 3:2 compares the fundamental frequencies of two separate notes. The overtones of one note instead occur at 2, 3, 4… times its own fundamental.",
      intervalLessonTwo: "At 3:2 the lower note's third harmonic equals the upper note's second harmonic. In 12-TET the frequencies differ slightly; with Rich tones the nearby harmonics may beat. Pleasantness is not determined by ratios alone.",
      intervalReady: "Ready. Choose In sequence or Together.", intervalStarting: "Starting two notes…",
      intervalPlaying: "Playing. Tap the active button to stop or switch comparison.",
      intervalStopped: "Stopped. Try another ratio.", intervalHidden: "Sound stopped when you left the page.",
      intervalUnsupported: "This browser cannot synthesize interval tones.",
      intervalBlocked: "The tones could not start. Check your browser's audio settings.",
      intervalInvalid: "Enter a lower-note frequency from 110 to 440 Hz.",
      intervalWaveAria: "Modeled lower, upper and summed note waveforms over a just-ratio reference period",
      intervalSpectrumAria: "Two harmonic ladders and their shared or near-shared partials",
      harmonicChoose: "Add harmonics", harmonicDescription: "Combine whole-number multiples of a frequency to build a new sound.",
      harmonicPlay: "Play", harmonicStop: "Stop", harmonicBase: "Fundamental frequency",
      harmonicPresetsTitle: "Example mixtures", harmonicPure: "Pure", harmonicOdd: "Odd harmonics",
      harmonicRich: "Rich", harmonicStrengths: "Strength of each harmonic", harmonicNotation: "f, 2f, 3f…",
      harmonicWaveTitle: "Combined waveform", harmonicWaveHint: "Add harmonics and watch the wave change shape.",
      harmonicSpectrumTitle: "Harmonic ingredients", harmonicSpectrumHint: "Each bar represents a multiple of the fundamental frequency.",
      harmonicSpectrumFoot: "Change the pitch to shift all eight frequencies together.",
      harmonicChallenge: "Keep the fundamental fixed. Add the 3f and 5f harmonics. What changes in the sound?",
      harmonicLearnMore: "How do harmonics shape a sound?",
      harmonicLessonOne: "Adding waves at f, 2f, 3f and other whole-number multiples changes their combined waveform and timbre.",
      harmonicLessonTwo: "You control the strength of each harmonic, while its frequency stays an exact multiple of the fundamental.",
      harmonicReady: "Ready. Press Play to hear your mixture.", harmonicStarting: "Starting your sound…",
      harmonicPlaying: "Playing. Move any harmonic slider to hear the change.",
      harmonicStopped: "Stopped. Build another mixture.", harmonicUnsupported: "This browser cannot play synthesized sound.",
      harmonicBlocked: "Sound could not start. Try again after checking browser audio settings.",
      harmonicInvalid: "Use a fundamental between 120 and 1,000 Hz.",
      harmonicWaveAria: "Waveform generated by eight additive sine harmonics",
      harmonicSpectrumAria: "Strengths and frequencies of eight harmonics",
      harmonicPresetsAria: "Example harmonic mixtures", harmonicSlidersAria: "Eight harmonic strengths",
      noiseChoose: "Choose a noise color", noiseDescription: "Listen to random vibrations with different frequency mixtures.",
      noiseWhite: "White", noisePink: "Pink", noiseBrown: "Brown", noisePlay: "Play", noiseStop: "Stop",
      noiseColorDescription: {
        white: "Roughly equal power in each hertz-wide frequency band.",
        pink: "More power in low frequencies, with about equal power per octave.",
        brown: "Low frequencies dominate even more strongly."
      },
      noiseCutoff: "Filter high frequencies", noiseCutoffHint: "Move left to make the noise softer and less bright.",
      noiseSafety: "Noise can sound loud. Start at a low volume, especially with headphones.",
      noiseWaveTitle: "Noise waveform", noiseWaveHint: "An example 40 ms random segment, not a repeating cycle.",
      noiseSpectrumTitle: "Frequency distribution", noiseSpectrumHint: "A broad trend rather than individual harmonic peaks.",
      noiseSpectrumFoot: "The curve is a predicted overall shape, not a live measurement.",
      noiseChallenge: "Compare white, pink and brown noise at the same volume. Then lower the cutoff.",
      noiseLearnMore: "Why does noise sound unlike a pure tone?",
      noiseLessonOne: "Noise combines many random vibrations. Unlike a pure tone, it has no regular repeating period.",
      noiseLessonTwo: "White noise has roughly equal power per hertz. Pink and brown noise favor lower frequencies. Filtering the highs darkens the sound.",
      noiseReady: "Ready. Press Play to hear the noise.", noiseStarting: "Starting noise…",
      noisePlaying: "Playing. Try another color or move the filter.",
      noiseStopped: "Stopped. Explore another noise color.", noiseUnsupported: "This browser cannot play synthesized noise.",
      noiseBlocked: "Noise could not start. Check the browser's audio settings.",
      noiseWaveAria: "Modeled example of a nonperiodic noise waveform",
      noiseSpectrumAria: "Expected frequency magnitude profile of colored and filtered noise",
      noiseChoicesAria: "Noise color choices",
      mixChoose: "Combine two tones", mixDescription: "Two nearby frequencies reinforce and cancel, making the volume pulse.",
      mixPlay: "Play", mixStop: "Stop",
      mixBase: "First frequency", mixGap: "Frequency difference (Δf)",
      mixTryGap: "Try:", mixZeroGap: "0 Hz", mixTwoGap: "2 Hz", mixFourGap: "4 Hz", mixTenGap: "10 Hz",
      mixTwoFrequencies: "Two frequencies", mixBeatRate: "Volume pulses", mixBeatUnit: "pulses/s",
      mixWaveTitle: "Combined waveform", mixWaveHint: "Long windows show the loudness envelope. Press + to zoom in and see the actual vibrations.",
      mixWaveHintFine: "Blue: the actual combined oscillation. Green: its loudness envelope.",
      mixSpectrumTitle: "Frequency components", mixSpectrumHint: "Pulsing loudness does not create a new low-frequency tone.",
      mixSpectrumFoot: "Only the original two frequencies appear in the ideal spectrum.",
      mixSpectrumZeroFoot: "At zero difference, the two identical frequencies merge into one spectral peak.",
      mixZoomLabel: "Zoom", mixPanLabel: "Move", mixZoomValueAria: "Visible time span",
      mixZoomOutAria: "Zoom out in time", mixZoomInAria: "Zoom in to individual vibrations",
      mixWaveAria: "Sum of two sine waves and its ideal beat envelope over time",
      mixSpectrumAria: "Ideal spectrum with one or two distinct sine frequency components",
      mixBaseSliderAria: "First frequency slider", mixBaseInputAria: "First frequency in hertz",
      mixGapSliderAria: "Difference between two frequencies in hertz",
      mixGapPresetsAria: "Frequency difference examples", mixPlotToolsAria: "Waveform time zoom and navigation",
      mixLeftAria: "Show earlier time", mixRightAria: "Show later time",
      mixChallenge: "Try differences of 0, 2, 4 and 10 Hz. How does the pulsing change?",
      mixLearnMore: "Why do two nearby tones make the loudness pulse?",
      mixLessonOne: "When two sine waves have nearly the same frequency, their vibrations sometimes reinforce each other and sometimes nearly cancel. These changes in loudness are called beats.",
      mixLessonTwo: "The number of loudness pulses each second is the frequency difference Δf = |f₂ − f₁|. For 440 and 444 Hz, you hear four pulses per second. The ideal spectrum still contains just the original two frequencies, not an extra 4 Hz tone.",
      mixReady: "Ready. Press Play to hear the two tones.", mixStarting: "Starting both tones…",
      mixPlaying: "Playing. Adjust the difference to hear the pulses speed up or slow down.",
      mixStopped: "Stopped. Try another difference.", mixHidden: "Sound stopped when you left the page.",
      mixUnsupported: "This browser does not support synthesized sound playback.",
      mixBlocked: "Could not start sound. Check browser audio permission and try again.",
      mixInvalid: "Enter a first frequency between 120 and 1,000 Hz.",
      strikeChoose: "Choose a modeled sound",
      pluck: "Guitar", kick: "Drum", piano: "Piano", strikeGroupAria: "Transient sound model",
      strikeCaption: "Tap to sound; tap again to repeat",
      strikePluckButton: "Pluck", strikeStrumButton: "Strum", strikeKickButton: "Strike",
      strikePianoButton: "Press a key", strikePianoTapButton: "Tap",
      strikePianoTouchTitle: "How to play", strikePianoPress: "Press", strikePianoTap: "Tap",
      strikePianoTypeTitle: "Instrument", strikePitched: "Pitched", strikeMarimba: "Marimba", strikeXylophone: "Xylophone", strikeMandolin: "Mandolin", strikeHarp: "Harp",
      strikeMandolinPick: "Pick", strikeMandolinTremolo: "Tremolo", strikeMandolinPlayTitle: "Mandolin technique",
      strikePianoAcoustic: "Acoustic piano",
      strikePianoElectric: "Electric piano",
      strikePianoTouchHint: "Press models a held key with free decay. Tap is gentler and brings the damper back after a short press.",
      strikePianoElectricHint: "A bright FM attack settles into a warmer tone. Tap returns a modeled damper early; Strength also changes brightness.",
      strikeDescElectric: "Electronic frequency modulation gives a metallic attack and a mellow, beating tail. Compare it with the acoustic piano model.",
      strikeDescChimes: "Strike a pitched chime and follow its bright, inharmonic ringing modes as they decay.",
      strikeDescMarimba: "A soft mallet excites a tuned wooden-bar model. Its upper modes fade faster than the rounded low note.",
      strikeDescXylophone: "A harder mallet excites a brighter wooden-bar model. Compare its 1 : 3 : 6.16 modes and short ring with the marimba's softer 1 : 4 : 10 sound.",
      strikeDescMandolin: "Two slightly detuned plucked strings ring as one course. Compare a single pick with tremolo: eight distinct alternating strokes, not a volume oscillation.",
      strikeDescHarp: "A gently plucked string with long, register-dependent decay and a resonant soundboard colour. The pitch stays fixed while upper modes fade sooner.",
      strikeMarimbaHint: "An original teaching model, not a recording: tuned bar modes, a soft mallet and a low-mode resonator. Strength changes both level and attack colour.",
      strikeMarimbaSpectrumHint: "The low bar modes are tuned near 1 : 4 : 10, rather than a complete harmonic series. The upper modes fade faster; these are illustrative parameters, not measurements.",
      strikeXylophoneHint: "A modeled hard strike on a tuned wooden bar, not a recording. It has a brighter onset and shorter decay than the marimba; Strength changes level and overtone content.",
      strikeXylophoneSpectrumHint: "The early bar modes follow approximate ratios 1 : 3 : 6.16 (one published bar example). Higher modes fade quickly; the chosen damping and strengths are illustrative.",
      strikeMandolinHint: "A simplified doubled-course string and compact-body model, not a recording. Pick sounds once; tremolo makes eight fresh plucks about 0.1 s apart. Strength changes the tone as well as loudness.",
      strikeHarpHint: "A finger-pluck and soundboard approximation, not a harp recording. Compared with guitar or mandolin it has a softer attack, fewer bright harmonics and a longer ring.",
      strikeMandolinSpectrumHint: "Slight course detuning gives a moving harmonic pattern. Tremolo re-excites both strings at each pick, adding separate attacks instead of a slow amplitude envelope.",
      strikeHarpSpectrumHint: "Plucking position suppresses some harmonics, while the soundboard gives a few frequency-dependent boosts. These are illustrative, not measured resonances.",
      strikePitchedChimesHint: "Choose a note, then strike once. The metal-like modes ring after the hit; there is no piano key or damper to hold.",
      strikeGuitarPlay: "Play guitar", strikeSingle: "One string", strikeStrum: "Several strings",
      strikeChord: "Strum a chord", strikeMoreChords: "More chords",
      strikePatternTitle: "Strumming pattern", strikePatternDown: "Downstroke", strikePatternUp: "Upstroke",
      strikePatternAlternate: "Down–up", strikePatternArpeggio: "Arpeggio", strikePatternFingerpick: "Fingerpicking",
      strikeChordHint: "Tap a chord pad for an immediate stroke. Try down, up, alternating strokes, a slow arpeggio or a thumb–finger pattern. Each tap makes a new sound.",
      strikePluckPosition: "Pluck position", strikePluckPositionHint: "Plucking nearer the end brings out more high harmonics.",
      strikePitch: "Note frequency", strikePitchSliderAria: "Note pitch slider",
      strikePitchInputAria: "Note frequency in hertz",
      strikeStrength: "Strength", strikeDecay: "Decay time",
      strikeDrumVoiceTitle: "Percussion family", strikeDrumMembrane: "Bass drum / tom",
      strikeDrumViewTitle: "Drum exploration mode", strikeDrumKit: "Kit", strikeDrumModels: "Models",
      strikeDrumKitHint: "Tap a pad to hear it. Strength changes timbre; the hi-hat pedal can damp a cymbal while it rings.",
      strikeKitDrums: "Drums", strikeKitCymbals: "Cymbals", strikeKitOther: "Other percussion",
      strikeHatPedal: "Hi-hat pedal", strikeHatClosed: "Closed", strikeHatHalf: "Half-open", strikeHatOpen: "Open",
      strikeHatPedalHint: "Strike the open hi-hat, then move the pedal left while it is ringing. Moving the pedal does not strike again.",
      strikeKitKick: "Bass drum", strikeKitSnare: "Snare", strikeKitRimshot: "Rimshot",
      strikeKitFloorTom: "Floor tom", strikeKitMidTom: "Mid tom", strikeKitHighTom: "High tom",
      strikeKitHat: "Closed hi-hat", strikeKitHalfHat: "Half-open hi-hat", strikeKitOpenHat: "Open hi-hat", strikeKitRide: "Ride", strikeKitCrash: "Crash",
      strikeKitWoodblock: "Woodblock",
      strikeDrumSnare: "Snare", strikeDrumCymbal: "Cymbals", strikeDrumSteelpan: "Steel pan",
      strikeDrumChimes: "Chimes", strikeDrumWoodblock: "Woodblock",
      strikeDrumSize: "Hit a drum", strikeLarge: "Large", strikeMedium: "Medium", strikeSmall: "Small",
      strikeSnareLow: "Low", strikeSnareMid: "Mid", strikeSnareHigh: "High",
      strikeCymbalCrash: "Crash", strikeCymbalRide: "Ride", strikeCymbalHat: "Hi-hat",
      strikePanC: "C4", strikePanE: "E4", strikePanG: "G4", strikeNoSinglePitch: "No fixed note",
      strikeChimeC: "C5", strikeChimeE: "E5", strikeChimeG: "G5",
      strikeWoodLow: "Low", strikeWoodMid: "Mid", strikeWoodHigh: "High",
      strikeDrumHint: "Tap any size repeatedly to make a rhythm. Larger membranes vibrate more slowly; their modes are not integer harmonics.",
      strikeSnareHint: "A snare adds a short broadband rattle to a vibrating membrane. Tap low, mid and high to compare.",
      strikeCymbalHint: "Crash, ride and hi-hat use inharmonic plate-like modes and deterministic noise. They do not have a single pitched note.",
      strikePanHint: "The steel pan has tuned pitches with a prominent octave and near-twelfth overtone. Try C4, E4 and G4 as a three-note melody.",
      strikeChimesHint: "Strike a high C5, E5 or G5 chime. One clean hit excites a few bright, inharmonic metal modes.",
      strikeWoodHint: "Strike a low, mid or high wooden block. Short, uneven resonances make a dry tok rather than a lasting metallic jingle.",
      strikeDrumTension: "Membrane tension", strikeDrumTensionHint: "Tighten the membrane to raise all its natural frequencies.",
      strikeWaveTitle: "Waveform · zoom and explore",
      strikeWaveSubtitle: "See the full decay; zoom in to reveal individual vibrations.",
      strikeZoomOutAria: "Zoom out", strikeZoomInAria: "Zoom in",
      strikePanLeftAria: "Move earlier", strikePanRightAria: "Move later",
      strikeFit: "Fit", strikeCustom: "Custom", strikeViewPresetLabel: "Visible time span",
      strikePlotToolsAria: "Waveform zoom and navigation",
      strikeTime: "Explore the sound at time", strikeTimeAria: "Time selected for the frequency spectrum",
      strikeTimeHint: "After Pluck or Strike, the spectrum follows the sound. Drag this slider to inspect any moment.",
      strikeLocalSpectrumTitle: "Frequency spectrum",
      strikeLocalSpectrumSubtitle: "Fourier analysis of a 128 ms window around the selected time",
      strikeSpectrumHere: "At selected time", strikeSpectrumWhole: "Whole sound",
      strikeSpectrumModesAria: "Spectrum time range",
      strikeSpectrumHint: "String harmonics fade at different speeds. Drum modes do not follow integer frequency ratios.",
      strikeSnareSpectrumHint: "The snare has both membrane resonances and a broad rattling spectrum.",
      strikeCymbalSpectrumHint: "A cymbal spreads energy over many inharmonic, noisy high frequencies.",
      strikePanSpectrumHint: "A steel pan concentrates energy at its tuned pitch, octave and near-twelfth.",
      strikeChimesSpectrumHint: "One pitched strike rings with several high, non-integer-related partials.",
      strikeWoodSpectrumHint: "A short contact click and a few strongly damped inharmonic modes make the wooden tap.",
      strikeSpectrumWholeHint: "Average frequency content across the whole modeled hit.",
      strikeWaveAria: "Modeled waveform with a movable time cursor",
      strikeSpectrumAria: "Short-time Fourier magnitude spectrum of the modeled sound",
      strikeSafety: "Each sound fades by itself. Begin quietly, especially with headphones.",
      strikeEnvelopeTitle: "How does the sound fade?",
      strikeEnvelopeSubtitle: "Same three-second time scale for every strike",
      strikeZoomTitle: "Waveform: first 20 ms",
      strikeZoomSubtitle: "A magnified view of the fast vibration",
      strikeEnvelopeAria: "Modeled decay envelope over time",
      strikeZoomAria: "Modeled waveform of the first 20 milliseconds",
      strikeChallenge: "Change the decay time. What happens to the sound and its envelope?",
      strikeLearnMore: "Why do these sounds fade away?",
      strikeLessonOne: "A plucked string vibrates at several frequencies. Its higher harmonics fade faster than its fundamental.",
      strikeLessonTwo: "A circular membrane has non-integer mode ratios, determined by Bessel functions. A snare adds broadband rattling; cymbals ring inharmonically; a tuned steel pan emphasizes pitch. Chimes ring after a single metal strike, while woodblocks decay quickly. Compare their spectra.",
      strikeReady: "Ready. Sound starts only when you tap the pad.",
      strikeStarting: "Preparing the sound…", strikeDone: "Sound triggered. Tap again to make a rhythm.",
      strikeStopped: "Stopped. Tap the pad to try again.",
      strikeHidden: "Sound stopped when you left the page.",
      strikeUnsupported: "This browser does not support synthesized sound playback.",
      strikeBlocked: "Sound could not start. Check browser audio permission and try again.",
      strikeInvalid: "Enter a note frequency within this instrument’s displayed range.",
      strikeDesc: {
        pluck: "A plucked string repeatedly reflects its vibration, losing some energy each cycle. Several strings can form a chord.",
        kick: "Compare drums, cymbals, a steel pan and woodblocks. Tap the pads to build a rhythm.",
        piano: "Hammer force changes the brightness of slightly detuned, stiff strings. Their overtones fade at different rates."
      },
      sustainChoose: "Choose a held sound",
      sustainFlute: "Flute", sustainClarinet: "Clarinet", sustainViolin: "Violin", sustainMorin: "Morin khuur",
      sustainOrganStopped: "Stopped Flute 8′", sustainOrganPrincipal: "Principal 8′", sustainAccordion: "Accordion · Musette", sustainBayan: "Bayan · Dry",
      sustainAir: "Aerophones", sustainBowed: "Bowed strings", sustainOrgan: "Pipe organ", sustainFreeReed: "Free reeds",
      sustainGroupAria: "Held instrument models", sustainGestureTitle: "How to play",
      sustainGestureAria: "Hold or toggle the sound", sustainHold: "Press and hold", sustainToggle: "Tap to toggle",
      sustainPress: "Hold to play", sustainPressing: "Sounding…", sustainPressCaption: "Hold the button; release to fade.",
      sustainTogglePlay: "Play", sustainToggleStop: "Stop", sustainToggleCaption: "Tap again to release the note.",
      sustainPitch: "Note frequency", sustainPitchSliderAria: "Held note pitch slider",
      sustainPitchInputAria: "Held note frequency in hertz", sustainAttack: "Attack time", sustainRelease: "Release time",
      sustainBreath: "Blowing strength", sustainBreathHint: "A stronger air jet changes the flute's loudness, harmonics and breath noise.",
      sustainClarinetBreathHint: "Stronger blowing emphasizes upper odd harmonics. Each note begins with a brief tongued onset.",
      sustainOrganPressure: "Wind pressure", sustainReedPressure: "Bellows pressure",
      sustainOrganPressureHint: "Pressure brightens the pipe spectrum. The stopped 8′ flute has mostly odd harmonics; the open Principal 8′ is brighter, with a brief chiff.",
      sustainReedPressureHint: "More bellows pressure brightens the prescribed reed spectrum. Musette has two slightly detuned ranks; bayan uses a single dry rank.",
      sustainBow: "Bow pressure", sustainBowHint: "More bow pressure makes the tone stronger and sharpens the stick–slip harmonics in this simplified model.",
      sustainEnvelopeHelp: "Attack applies to the next note; release applies when you let go.",
      sustainEnvelopeTitle: "Loudness over time", sustainEnvelopeHint: "Normalized attack and release of a 1.2 s note; blowing or bow pressure also changes loudness.",
      sustainEnvelopeFoot: "The vertical mark is the release at 1.2 s.",
      sustainDetailTitle: "Waveform and harmonics", sustainDetailHint: "20 ms stick–slip approximation after illustrative body filters. Random bow noise is omitted.",
      sustainFluteDetailHint: "20 ms modeled flute tone after jet shaping and air-column filtering; random breath noise is omitted.",
      sustainClarinetDetailHint: "20 ms settled reed-inspired tone after bore filters. The brief tongue noise is omitted from this periodic plot.",
      sustainI3DetailHint: "Steady-state harmonic-source model. Brief attacks and the musette's beating between separate ranks are not shown in the single-period plot.",
      sustainWaveTitle: "Waveform", sustainSpectrumTitle: "Harmonics",
      sustainEnvelopeAria: "Example held-note attack, sustain and release curve",
      sustainWaveAria: "Modeled twenty millisecond sustained periodic waveform",
      sustainSpectrumAria: "Strengths of modeled periodic harmonics",
      sustainChallenge: "Keep the flute's pitch fixed. Try gentle and strong blowing: what happens to loudness and the upper harmonics?",
      sustainClarinetChallenge: "Compare the flute and clarinet at the same pitch. Then blow gently and strongly: which odd harmonics change?",
      sustainBowChallenge: "Keep the note fixed. Change bow pressure, then compare violin and morin khuur. Which harmonics stand out?",
      sustainOrganChallenge: "Compare Stopped Flute and Principal at the same pitch. Which stop emphasizes the second harmonic?",
      sustainReedChallenge: "Hold a note on accordion and bayan. Can you hear the musette beat that the dry bayan registration lacks?",
      sustainLearnMore: "Why can these sounds continue?",
      sustainLessonOne: "Blowing a flute or clarinet, or bowing a string, keeps feeding energy into its vibration. A plucked string is set moving once and then fades.",
      sustainLessonTwo: "The flute has a simplified nonlinear jet. The clarinet uses a prescribed odd-rich reed spectrum, a short tongued attack and bore filters. Bowed strings use idealized stick–slip motion and body filters. None solves full physical feedback or clarinet register changes.",
      sustainReady: "Ready. Hold the button or use tap-to-toggle mode.", sustainStarting: "Starting the note…",
      sustainPlayingHold: "Sounding. Release the button to fade.", sustainPlayingToggle: "Sounding. Tap again to release.",
      sustainReleased: "Released. The sound fades away.", sustainStopped: "Stopped. Try another instrument.",
      sustainHidden: "Sound stopped when you left the page.",
      sustainUnsupported: "This browser cannot play generated instruments.",
      sustainBlocked: "The sound could not start. Check browser sound permission.",
      sustainInvalid: "Enter a frequency within this instrument’s displayed range.",
      sustainDesc: {
        flute: "A flute-like air-jet model: stronger blowing makes the sound louder and brings out more upper harmonics.",
        clarinet: "A lower/middle-register reed-inspired model: hollow, odd-rich tone, changing colour with blowing and a short tongued onset. Concert pitch; no register switching.",
        violin: "A bright bowed-string source with pressure-controlled stick–slip sharpness and illustrative body resonances.",
        morin: "The same bowed-string mechanism with a different slip duration and warmer body response, inspired by the morin khuur.",
        "organ-stopped": "A stopped flue pipe's mainly odd-harmonic 8′ tone, with a gentle wind onset. Illustrative additive stop model, not measured pipes.",
        "organ-principal": "An open principal 8′ stop with strong even and higher harmonics and a small chiff at the beginning.",
        accordion: "Free-reed model with two 8′ ranks tuned slightly apart for musette tremolo. Bellows pressure controls harmonic colour.",
        bayan: "The same free-reed source model in a dry single-rank registration with a less beating, compact tone."
      },
      motionChoose: "Choose a moving sound",
      theremin: "Theremin", siren: "Fire-truck siren",
      motionDesc: {
        theremin: "Move your finger to change the pitch and loudness continuously.",
        siren: "Hear how different paths between the same two frequencies change the sound."
      },
      motionGroupAria: "Moving sound choices", thereminHelp: "Press and move: right makes the pitch higher; up makes it louder. Release to stop.",
      thereminTimbreLabel: "Sound color", thereminTimbresAria: "Theremin timbre options",
      timbrePure: "Pure", timbreRich: "Rich", timbreVoice: "Vowels", timbreOvertones: "Focus overtone",
      timbreNotes: {
        pure: "A sine wave contains only its fundamental frequency f₀.",
        rich: "A harmonic-rich electronic tone contains f₀, 2f₀, 3f₀…",
        voice: "One harmonic-rich source is filtered by vowel resonances (formants), which stay at roughly fixed frequencies as the pitch moves.",
        overtones: "The same source contains many harmonics. A narrow resonance emphasizes one, as in a simplified overtone-singing demonstration."
      },
      thereminVowelLabel: "Choose vowel", thereminVowelsAria: "Vowel resonance selection",
      vowelA: "A", vowelE: "E", vowelI: "I", vowelO: "O", vowelU: "U",
      thereminVowelHint: "Vocal-tract resonances do not simply follow the sung pitch. Try 120–350 Hz for clearer vowels.",
      thereminHarmonicLabel: "Emphasized harmonic", thereminOvertoneHint: "A single source supplies f₀, 2f₀, 3f₀…; a filter emphasizes one upper harmonic. This is not two independent voices.",
      padLoud: "Louder ↑", padStart: "Press and move", padHigh: "Higher pitch →",
      padAria: "Theremin touch pad", thereminKeyboardHelp: "Keyboard: use arrow keys to move; Space or Enter toggles the sound. Escape stops.",
      sirenPatternAria: "Frequency trajectory", sirenTwoTone: "Abrupt", sirenSineSweep: "Smooth",
      sirenPitchSweep: "Linear",
      sirenPlay: "Play siren", sirenStop: "Stop siren", sirenCaption: "Tap again to stop",
      sirenLow: "Low frequency", sirenHigh: "High frequency", sirenRate: "Repetitions per second", sirenRateUnit: "/s",
      motionReady: "Ready. Press the pad or Play to hear.", motionStarting: "Starting sound…",
      motionPlayingTheremin: "Playing. Release the pad or press Stop.",
      motionPlayingSiren: "Siren playing. Press Stop siren or the red Stop button.",
      motionStopped: "Stopped. Try another pitch pattern.",
      motionHidden: "Sound stopped when you left the page.", motionUnsupported: "This browser does not support synthesized sound playback.",
      motionBlocked: "Sound could not start. Check browser sound permission and try again.",
      motionSafety: "Start quietly, especially with headphones. Changing category or pressing Stop ends playback.",
      motionPitchTitle: "Pitch over time", motionPitchTheremin: "The last four seconds of your finger movement.",
      motionPitchSiren: "Abruptly alternates two frequencies: a rectangular trajectory.",
      motionPitchSirenPitch: "Equal semitones per second: a straight path on the logarithmic frequency chart.",
      motionPitchSirenSine: "Sinusoidal in Hz: slow near the extremes and fastest in the middle.",
      motionPitchScale: "Logarithmic frequency · 120–1600 Hz", motionPitchAria: "Ideal pitch path over time",
      motionDetailTitle: "At this moment", motionDetailHint: "Different harmonic colors at the same fundamental pitch, shown as waves and components.",
      motionWaveTitle: "20 ms waveform", motionComponentTitle: "Harmonics",
      motionWaveAria: "Modeled 20 millisecond waveform at current pitch and timbre", motionComponentAria: "Harmonics of the current moving sound",
      motionChallenge: {
        theremin: "At a low pitch, compare vowels A and I; then select an upper harmonic. Is the high note a second oscillator?",
        siren: "Keep the low and high frequencies and speed fixed. How do the three trajectories sound different?"
      },
      motionLearnMore: "Why does moving the pitch change the sound?",
      motionLessonOne: "Moving right raises pitch; moving up increases volume. Vowels have relatively fixed vocal-tract resonances (formants); overtone singing focuses one harmonic of a single voiced source.",
      motionLessonTwo: "Three paths connect the same two frequencies. Abrupt switches directly between two tones. Smooth follows a sinusoidal curve, slowing near the extremes. Linear changes by equal musical-pitch intervals and looks straight on the logarithmic graph.",
      desc: {
        sine: "One smooth vibration, with a single frequency.",
        triangle: "Weak upper odd harmonics.",
        square: "Strong odd harmonics.",
        sawtooth: "Many harmonics, with a rich tone."
      },
      insight: {
        sine: "Only the fundamental is present in an ideal sine wave.",
        triangle: "Odd harmonics are present, but fade very quickly.",
        square: "The 3rd, 5th, 7th… harmonics are present; even ones are absent.",
        sawtooth: "Every whole-number harmonic is present, decreasing in strength."
      },
      challenge: {
        sine: "Double the frequency. How do the pitch and period change?",
        triangle: "Compare triangle and square at the same frequency. Which has weaker high harmonics?",
        square: "Change from sine to square without changing frequency. Does the pitch stay the same?",
        sawtooth: "Compare the spectrum of a sine and a sawtooth. How many peaks appear?"
      }
    },
    mn: {
      backLabel: "Sol-ийн хэрэгслүүд рүү буцах", stop: "■ Зогсоох",
      chooseShape: "Долгионы хэлбэр сонгох",
      sine: "Синус", triangle: "Гурвалжин", square: "Дөрвөлжин", sawtooth: "Хөрөө",
      play: "Авиа тоглуулах", playCaption: "Сонсохын тулд товшино уу",
      stopTone: "Авиа зогсоох", stopCaption: "Авиа дуугарч байна · зогсоохын тулд товшино уу",
      frequency: "Давтамж", snap: "Нотод тааруулах",
      sliderHint: "Гулсуур нь логарифм хуваарьтай. Хязгаараас гадуур утгыг гараар оруулж болно.",
      sliderOutside: "Гараар оруулсан давтамж гулсуурын хязгаараас гадуур боловч яг тэр утгыг хэрэглэнэ.",
      tryNote: "Нот турших:", volume: "Дууны хэмжээ",
      safeVolume: "Ялангуяа чихэвч хэрэглэвэл дууны хэмжээг багаас эхлүүлж, болгоомжтой нэмээрэй.",
      settings: "⚙ Тохиргоо", tuning: "Нотод тааруулах хөглөлт",
      tuningHint: "Одоохондоо 12 тэнцүү хагас авианы хөглөлт ашиглана.",
      equal: "12 тэнцүү хуваарь", fixedTime: "Хугацааны цонхыг 20 мсек-д тогтмол байлгах",
      unitHz: "Гц", unitKHz: "кГц", unitSeconds: "сек", unitMilliseconds: "мсек",
      strikePresetOneSecond: "1 сек", strikePreset200Ms: "200 мсек", strikePreset20Ms: "20 мсек",
      fixedHint: "Долгионы хэлбэрийг сайн харахын тулд тэмдэглэгээг арилгаж дөрвөн үеийг томруулна. Ингэвэл хугацааны хуваарь өөрчлөгдөнө.",
      waveTitle: "Хугацааны дагуух долгион", waveSubtitle: "Хугацаа 20 мсек хэвээр: давтамж ихсэхэд олон үе багтана.",
      waveSubtitleZoom: "Дөрвөн үеийг томруулж харуулав. Давтамжтай хамт хугацааны хуваарь өөрчлөгдөнө.",
      cyclesUnit: "үе",
      spectrumTitle: "Гармоникууд", spectrumSubtitle: "Үндсэн давтамжтай харьцуулсан идеал бүрэлдэхүүн",
      timeAxis: "хугацаа →", frequencyAxis: "давтамж →",
      tryThis: "ТУРШИЖ ҮЗ", reset: "↺ Эхнээс нь",
      learnMore: "Дууны долгион яагаад өөр өөр сонсогддог вэ?",
      lessonOne: "Үелэх долгионд хамгийн нам давтамж гэж байх ба үүнийг нь үндсэн давтамж гэдэг. Энэ нь дууны өндрийг тодорхойлно. Үүнээс өндөр давтамжууд буюу дээд гармоникууд нь үндсэн давтамжаасаа үргэлж бүхэл тоо дахин их: 2f, 3f, 4f гэх мэт.",
      lessonTwo: "Долгионы хэлбэрээс хамааран гармоникуудын найрлага өөрчлөгдөнө. Жишээ нь, цэвэр синусоид долгионд үндсэн давтамжаас өөр найрлага байхгүй. Өөр өөр хөгжмийн зэмсгүүд ижил өндөртэй авиа гаргасан ч ялгаатай сонсогддог нь гармоникуудынх нь найрлага өөр байгаа хэрэг.",
      footer: "Дууны лаборатори · Дуу, бичлэг зөвхөн таны төхөөрөмж дээр байна. Хаашаа ч илгээхгүй.",
      designCredit: "Гантөмөрийн бүтээл", licenseLink: "Программын код: MIT лиценз",
      recordStart: "REC", recordStop: "WAV", recordSave: "WAV татах", recordAnalyze: "Шинжлэх",
      recordStartAria: "Дууны лабораторийн авиаг {seconds} сек хүртэл бичих. Микрофон ашиглахгүй",
      recordStopAria: "Бичлэг дуусгаж WAV файл хадгалах",
      recordSavedShort: "WAV бэлэн", recordResultAria: "Сүүлийн бичлэг",
      recordDismissAria: "Бичлэгийг сонсох цонхыг хаах",
      recordReady: "Бичлэг эхлүүлээд авиа тоглуулж эсвэл цохиж үзээрэй.",
      recordPreparing: "Бичлэг бэлтгэж байна…", recordRecording: "Дуу бичиж байна…",
      recordSaving: "WAV файл бэлдэж байна…", recordSaved: "Бичлэг бэлэн. Сонсоод WAV болгон хадгалж болно.",
      recordEmpty: "Бичлэг хоосон байна. Дахин туршаарай.",
      recordUnsupported: "Энэ хөтөч дуу бичих боломжгүй байна.",
      recordError: "Бичлэг амжилтгүй. Дахин оролдоно уу.", recordPreviewAria: "Бичлэгийг сонсох",
      waveAria: "Хугацааны дагуух долгионы загвар", spectrumAria: "Гармоникийн далайцын загвар",
      sliderAria: "Логарифм давтамжийн гулсуур", frequencyAria: "Давтамжийг герцээр оруулах",
      presetsAria: "Хөгжмийн нотын жишээ", waveGroupAria: "Долгионы хэлбэр",
      langGroupAria: "Хэл сонгох", amplitude: "далайц",
      ready: "Бэлэн. «Тоглуулах» товчийг дарахад л авиа гарна.",
      starting: "Авиа эхлүүлж байна…",
      playing: "Авиа дуугарч байна. Том товч эсвэл «Зогсоох»-ыг дарна уу.",
      stopped: "Зогслоо. «Тоглуулах» товчийг дарж сонсоорой.",
      hidden: "Хуудсаас гарахад авиа зогслоо.",
      unsupported: "Энэ хөтөч Web Audio-гаар авиа тоглуулах боломжгүй байна.",
      blocked: "Авиа эхэлсэнгүй. Хөтчийн дууны зөвшөөрлийг шалгаад дахин оролдоно уу.",
      invalid: "20–12,000 Гц-ийн хооронд давтамж оруулна уу.",
      modePure: "Цэвэр авиа", modeStrike: "Цохих/татах", modeSustain: "Үлээх/нумдах", modeMotion: "Хувирдаг давтамж",
      modeMix: "Долгион холих", modeTuning: "Хөг", modeCompose: "Ая зохиох", modeAnalysis: "Шинжлэх",
      composeSolo: "Нэг хөгжим", composeEnsemble: "Олон хөгжим",
      composeModesAria: "Ая зохиох горим",
      modeSwitchAria: "Дууны бүлэг",
      pureExperimentsAria: "Долгионы хэлбэр ба өнгөний туршилтууд",
      pureExperimentWaves: "Долгионы хэлбэр", pureExperimentHarmonics: "Өнгө бүтээх",
      mixExperimentsAria: "Холимог ба нийлмэл авианы туршилтууд",
      mixExperimentBeats: "Хоёр давтамж",
      mixExperimentIntervals: "Интервал", mixExperimentNoise: "Шуугиан",
      intervalExperiment: "Харьцаа", earExperiment: "Тааруулах",
      tuningExperimentsAria: "Хөгийн туршилтууд", scaleExperiment: "3-хязгаар", limit5Experiment: "5-хязгаар", tempExperiment: "Темперамент",
      earChoose: "Нот тааруулах",
      earDescription: "Харьцаагаа сонгоод хоёр дахь нотыг чихээр тааруул. Доош алхам, октаваар шилжүүлэхийг ч бас туршаарай.",
      earPlay: "Хоёр нотыг сонсох", earStop: "Зогсоох",
      earPlayCaption: "Ээлжлэн эсвэл хамт сонсоорой", earPlaySequential: "Эхний нот, дараа нь хоёр дахь · давтана",
      earPlayTogether: "Хоёр нот хамт · давтана",
      earTasksTitle: "Даалгавар", earTasksAria: "Чихээр тааруулах даалгаврууд",
      earTaskFifth: "3:2 · Квинт", earTaskThird: "5:4 · Терц",
      earTaskFourth: "4:3 · Дөрөвт", earTaskOctaveUp: "2:1 · Дээш октав",
      earTaskDownFourth: "3:4 · Доош дөрөвт", earTaskDownFifth: "2:3 · Доош квинт",
      earTaskOctaveDown: "1:2 · Доош октав",
      earSoundTitle: "Авианы өнгө", earSoundAria: "Чихээр тааруулах авианы загвар",
      earSoundPure: "Цэвэр синус", earSoundRich: "Гармоник ихтэй",
      earSoundGuitar: "Гитарын таталт", earSoundPiano: "Төгөлдөр хуур",
      earSoundHint: "Синусад дээд гармоник байхгүй. Гитар, төгөлдөр хуурын цохилтууд нь хялбаршуулсан загвар; төгөлдөр хуурын гармоникууд бага зэрэг зөрдөг.",
      earCompareTitle: "Хэрхэн сонсох вэ?", earCompareAria: "Нотуудыг ээлжлэн эсвэл хамт сонсох",
      earAlternating: "Ээлжлэн", earTogether: "Хамт",
      earHelpTitle: "Тусламж", earHelpAria: "Гармоникаар харах эсвэл зөвхөн сонсох",
      earGuided: "Гармоник харах", earBlind: "Зөвхөн сонсох",
      earHelpHint: "Графикт бүх гармоник жигд харагдана; аль нь давхцахыг заагаагүй. Дараа нь зөвхөн чихээрээ оролдоорой.",
      earAdjustTitle: "Хоёр дахь нотыг тааруулах", earAdjustAria: "Сонсож байхдаа хоёр дахь нотын давтамжийг өөрчлөх",
      earAdjustHint: "Хоёр дахь нот зориуд бага зэрэг зөрүүтэй. Чихээр тааруулаад «Шалгах» дар.",
      earCheck: "Шалгах", earHarmonicsTitle: "Хоёр нотын гармоникууд",
      earHarmonicsHint: "Хоёр авианы 8 хүртэл гармоникийг харьцуул. Зорилтот давхцлыг заасан тэмдэглэгээ байхгүй.",
      earHarmonicsAria: "Эхний болон тааруулах нотын гармоникуудын загвар шугамууд",
      earOctaveTitle: "Нэг октавт буцаах", earOctaveHint: "Улбар цэг нь тааруулсан нот; ногоон цэг нь түүнийг 2-оор үржүүлж эсвэл хувааж До4–До5 октавт оруулсан байрлал.",
      earOctaveAria: "Шалгасан нот ба түүний октаваар шилжүүлсэн хувилбарын До3–До5 хуваарь",
      earOctaveAxis: "До3 · До4 · До5 →", earChallenge: "3:4 ба 2:3-ыг доош тааруулж, дараа нь ×2-оор До4-ийн октавт оруул. Ямар дээш харьцаануудтай ижил нот гарав?",
      earLearnMore: "Яагаад биениеийг сонсож тааруулж болдог вэ?",
      earLessonOne: "3:2 үед эхний авианы 3f ба хоёр дахь авианы 2f гармоник давхцана. 5:4-д 5f ба 4f, харин 3:4-д 3f ба 4f давхцана. Хэрэв эдгээр гармоник сонсогдож байвал зөрүүгээс биение үүснэ. Цэвэр синусад дээд гармоник байхгүй, төгөлдөр хуурын чавхдасны гармоник бага зэрэг зөрдөг.",
      earLessonTwo: "До4-ийг 3/4, 2/3, 1/2-оор үржүүлбэл До4-өөс нам болно. Үр дүнг 2-оор үржүүлбэл нотын нэр өөрчлөгдөхгүй, До4–До5 октавт орно: 3/4 × 2 = 3/2, 2/3 × 2 = 4/3. Дараагийн 3-хязгаар, 5-хязгаар туршилтад ийм алхмыг давтана.",
      earReady: "Бэлэн. «Ээлжлэн» эсвэл «Хамт» дарж сонсоод хоёр дахь нотыг тааруулаарай.", earStarting: "Хоёр авиаг эхлүүлж байна…",
      earPlaying: "Ээлжлэн сонсвол нотын өндрийг, хамт сонсвол гармоникуудын биениеийг харьцуул.",
      earStopped: "Зогслоо. Тохируулах, шалгах боломжтой хэвээр.",
      earHidden: "Хуудсаас гарахад хоёр авиа зогслоо.",
      earBlocked: "Авиа эхэлсэнгүй. Хөтчийн дууны тохиргоог шалгаарай.",
      earInstruction: "{from} → {to}: {ratio}-оор үржүүлж чихээр тааруул. Зөв давтамж «Шалгах» хүртэл нуугдана.",
      earSliderLabel: "← нам · өндөр →", earCheckExcellent: "Маш сайн! Харьцаа бараг яг таарлаа.",
      earCheckClose: "Ойртлоо! Дахин сонсоод жаахан тохируул.",
      earCheckRetry: "Дахин оролдоорой: хоёр дахь нот зөрүүтэй хэвээр.",
      earCheckResult: "{rating}\nЯг зорилт: {target} Гц · чиний нот: {actual} Гц · алдаа: {error} цент.\nОнолын гармоникуудын биение: {beats} Гц (гармоникууд сонсогдож байвал).",
      earFoldFact: "Ижил нот: {from} Гц {operation} = {to} Гц ({note}).",
      earNoFold: "До4–До5 октавт байна; октаваар шилжүүлэх шаардлагагүй.",
      earHarmonicsFoot: "Цэнхэр нь эхний, улбар нь тааруулах нот. Өндөр нь гармоникийн хүч.",
      earHarmonicsHiddenFoot: "Гармоникуудыг нуусан. Зөвхөн чихээрээ оролд.",
      earOctaveFoot: "Нотын байрлалыг харахын тулд «Шалгах» дар.",
      earOctaveFoldFoot: "Тасархай холбоос нь нэг нотын октаваар ялгаатай хоёр байрлал.",
      scaleChoose: "3:2 харьцаагаар шатлал бүтээх", scaleDescription: "Эхлэх авианаас 3:2 алхмаар дээш, доош явж нот үүсгэ. Нэг октавт багтаагаад, дурын нотыг үндсэн нот болгон сонго.",
      scalePlay: "Шатлалыг сонсох", scaleStop: "Зогсоох", scalePlayCaption: "Өгсөж, уруудаж тоглоно",
      scalePresetsTitle: "Шатлалын жишээ", scalePresetsAria: "3:2 гинжийн жишээнүүд",
      scaleCustom: "Өөрийн сонголт", scalePlaybackAria: "3:2 шатлалын нотуудыг ээлжлэн эсвэл хамт тоглуулах",
      scaleFiveUp: "5 · Дээш", scaleFiveCenter: "5 · Дундаас", scaleFiveDown: "5 · Доош",
      scaleSeven: "7 нот", scaleTwelve: "12 нот", scaleNotesUnit: "нот",
      scaleGapToggle: "Буцах зөрүүг харуулах", scaleGapTitle: "Буцах нот хэр ойр байна вэ?",
      scaleGapPlay: "Хоёр нотыг сонсох", scaleGapStop: "Харьцуулалтыг зогсоох",
      scaleGapInfo: "{count} квинтээр ({direction}) алхсан хийсвэр {ghost} нотыг эхлэх нотоос {octaves} октаваар шилжүүлсэн ноттой харьцуулбал: {cents} цент ({angle}°) зөрүүтэй.",
      scaleGapDirectionUp: "дээш", scaleGapDirectionDown: "доош",
      scaleGapPythagorean: "Пифагорын комма", scaleGapOther: "Буцах зөрүү",
      scaleGapSummary: "{name}: {cents} цент · {angle}° · {beats} Гц зөрүү",
      scaleGapFoot: "Центийн зайг томруулсан зураг, жинхэнэ спектр биш. Хоёр октаваар тохируулсан нотыг хамтад нь тоглуулж цохилтыг сонсоорой.",
      scaleGapFrom: "эхлэх нот", scaleGapGhost: "хийсвэр буцах нот", scaleGapUnit: "цент",
      scaleGapCanvasAria: "Эхлэх нот ба октаваар тохируулсан хийсвэр буцах нотын зайг центээр харьцуулсан зураг",
      scaleGrowTitle: "3:2 гинжийг сунгах", scaleDirectionsAria: "Гинжийн алхам нэмэх, хасах",
      scaleAddDown: "← Доош 3:2", scaleAddUp: "Дээш 3:2 →",
      scaleRemoveDownAria: "Доод захын алхмыг хасах", scaleRemoveUpAria: "Дээд захын алхмыг хасах",
      scaleGrowHint: "Алхам бүрийг 2-ын зэрэгт үржүүлж эсвэл хуваагаад нэг октавт оруулна.",
      scaleBase: "Эхлэх давтамж", scaleBaseSliderAria: "Эхлэх давтамжийн гулсуур",
      scaleBaseInputAria: "Эхлэх давтамжийг герцээр оруулах",
      scaleTonicTitle: "Үндсэн нотыг сонгох", scaleTonicHint: "Нотуудын давтамж хэвээр; харин аль нотыг төв болгосноос шатлалын эхлэл ба ая өөрчлөгдөнө.",
      scaleTonicAria: "Үүссэн нотоос үндсэн нот сонгох",
      scaleTonicFact: "Үндсэн нотын давтамж", scaleReturnFact: "Хамгийн ойр октаваас зөрөх зай",
      scaleStepsFact: "Зэргэлдээ нотын зай", scaleOctaveFact: "3:2 алхам · октав",
      scaleSpiralTitle: "3:2 алхмын октавын спираль", scaleSpiralHint: "0-ээс эхэлнэ. Квинтээр дээш, доош алхахад спираль гадагш, дотогш эргэнэ. Бүдэг цацрагууд нэг октав дахь нотын эрэмбийг харуулна.",
      scaleSpiralAria: "Олон октавын спираль дээр дугаарласан 3:2 квинтийн алхмууд",
      scaleSpiralFoot: "Спиралийн алхмууд үүсгэх дарааллыг, төвөөс татсан цацрагууд нэг октав дахь давтамжаар эрэмбэлэх дарааллыг заана.",
      scaleSpiralAxis: "3:2 ↻ 210.6°",
      scaleFourierTitle: "Нот ба гармоникууд", scaleFourierHint: "Дээд мөр нь доод мөрөөсөө 3:2 дахин өндөр. Дугуй нь анхны давтамж, ромбо нь үүсэж болох гармоник; саарал нь октаваар шилжүүлсэн мөнөөх нот.",
      scaleFourierAria: "Квинтийн гинжийн үндсэн давтамж, гармоник, октавын хийсвэр хуулбарууд",
      scaleFourierAxis: "log₂ f →", scaleFourierFoot: "Ногоон нэг октав доторх цэгүүдийг зүүнээс баруун тийш уншихад нотын эрэмбэ гарна. Саарал хуулбарыг октаваар шилжүүлж тоглож болно; нэмэлт зэрэг дуугарах гармоник биш. 3f₁ = 2f₂.",
      scaleWindowLabel: "нэг октав",
      scaleNowIdle: "Давтамжаар өсөх, буурах нотуудыг сонсохын тулд тоглуулна уу.",
      scaleNowPlaying: "Одоо: алхам {step} · {ratio}{octave}", scaleNowUpperOctave: " · дээд октав",
      scaleChallenge: "Таван нот үүсгээд гинжийн хоёр захад тус бүр нэгийг нэмэн долоон нот болго. Үндсэн нотыг сольж сонсоход юу өөрчлөгдөх вэ?",
      scaleLearnMore: "Ижил нотоор өөр шатлал яаж үүсэх вэ?",
      scaleLessonOne: "3:2 харьцааг давтан хэрэглэвэл квинтийн гинж үүснэ. Нотуудыг 2-ын зэрэгт үржүүлж, хувааж нэг октавт оруулна. Дараалсан таван квинтээс таван нотын, долоон квинтээс долоон нотын шатлал үүснэ.",
      scaleLessonTwo: "Үндсэн нот бол шинэ давтамжийн харьцаа биш, аяны төвийг сонгож буй хэрэг. Жишээ нь C–D–E–G–A нотуудыг C-ээс тогловол мажор пентатоник, A-гаас тогловол минор пентатоник болно. Яг 3:2 харьцааг 12 удаа хэрэглэхэд 7 октаваас 23.46 центээр зөрнө: Пифагорын комма.",
      scaleReady: "Бэлэн. Шатлалыг сонсож, нотуудыг өөрчилж үзээрэй.", scaleStarting: "Аяыг бэлтгэж байна…",
      scalePlaying: "Нотууд ээлжлэн дуугарч байна. Идэвхтэй товчийг дахин дарж зогсооно.",
      scaleChordPlaying: "Бүх нот хамт дуугарч байна. Хамт товчийг дахин дарж зогсооно.",
      scaleGapPlaying: "Эхлэх нот ба хийсвэр буцах нот хамт дуугарч байна.",
      scaleGapDone: "Харьцуулалт дууслаа. Өөр тооны квинтээр туршаарай.",
      scaleStopped: "Зогслоо. Өөр үндсэн нот, чиглэл туршаарай.", scaleHidden: "Хуудсаас гарахад ая зогслоо.",
      scaleUnsupported: "Энэ хөтөч шатлалын авиаг тоглуулах боломжгүй байна.",
      scaleBlocked: "Ая эхэлсэнгүй. Хөтчийн дууны тохиргоог шалгана уу.",
      scaleInvalid: "Эхлэх давтамж 110–330 Гц байх ёстой.",
      limit5Choose: "3:2 ба 5:4-өөр нот бүтээх", limit5Description: "Хэвтээ алхам нь 3:2 квинт, ташуу алхам нь 5:4 их терц. Нэг октавт шилжүүлсэн цэгүүдээс өөрийн хөгийг сонго.",
      limit5Play: "Нотуудыг сонсох", limit5Stop: "Зогсоох", limit5PlayCaption: "Ээлжлэн эсвэл хамтад нь",
      limit5PresetsTitle: "Жишээ ба даалгавар", limit5PresetsAria: "5-хязгаарын жишээ болон коммагийн замууд",
      limit5Major: "До мажор", limit5Minor: "Ми минор", limit5GMajor: "Соль мажор", limit5DMinor: "Ре минор", limit5Seven: "7 нот", limit5Just12: "12 цэвэр нот · До төвтэй", limit5Fifths: "Зөвхөн 3:2",
      limit5JustHint: "Төгөлдөр хуурын 12 товчлуур бүрд нэг цэвэр торын цэг сонгосон. Ля4 = 440 Гц бол До4 = 264 Гц. Энэ нь До төвтэй нэг хувилбар; бусад тоналийн бүх аккорд цэвэр болохгүй. Шатлалыг ээлжлэн сонс; 12 нотыг хамт эгшиглүүлбэл нягт сонсогдоно.",
      limit5CommaE: "Ми: хоёр зам (81:80)", limit5CommaD: "Ре: хоёр зам (81:80)",
      limit5Diaschisma: "Хоёр дахь 5:4 давхар (2048:2025)", limit5Custom: "Миний сонголт",
      limit5PickHint: "Тор дээрх цэгийг дарж нот нэмэх, хасах (ихдээ 12). Октав дахь байрлалыг баруун талд харна.",
      limit5BaseTitle: "До (C) нотын давтамж", limit5BaseHint: "261.63 Гц бол До4. Давтамжийг өөрчилбөл бүх шатлал хамт шилжинэ.",
      limit5PlaybackAria: "Сонгосон нотуудыг ээлжлэн эсвэл хамт тоглуулж, зогсоох", limit5Melody: "Ээлжлэн", limit5Chord: "Хамт",
      limit5DisplayOptions: "Зам ба тэмдэглэгээ", limit5Routes: "Ойролцоо хоёр нотын замыг харуулах",
      limit5TetGuides: "12-TET-д ижил нэртэй цэгүүдийг холбох", limit5TetHint: "Тасархай шугамын үзүүрүүд ойролцоо нэртэй боловч яг ижил давтамжтай биш байж болно.",
      limit5CommaFact: "{name}: {just} ба {pyth} · {cents} цент", limit5BeatFact: "{low} ба {high} Гц · {beats} Гц биение",
      limit5LatticeTitle: "3 ба 5-ын тор", limit5LatticeHint: "→ нь 3:2, ↗ нь 5:4, гурав дахь тал нь 6:5. Тэмдэглэсэн цэгүүд тоглоход оролцоно.",
      limit5LatticeFoot: "Давхар бүрд 5:4-ийн алхам нэмэгдэнэ; цэг сонгоход октав дахь байрлалыг нь харна.", limit5GridAxis: "→ 3:2 · ↗ 5:4",
      limit5LatticeAria: "3:2 ба 5:4-ийн тор: цэг дарж нот сонго; гарын сум ба Enter-ээр бас сонгоно", limit5NowIdle: "Нотуудын эгшиглэх ээлжийг тоглуулахад харна.", limit5NowPlaying: "Эгшиглэж байна: {ratio} · {hz}",
      limit5NowChord: "Сонгосон нотууд хамт эгшиглэж байна.",
      limit5OctaveTitle: "Нэг октавт нот хаана буух вэ?", limit5OctaveHint: "Сонгосон цэг бүрийг До4–До5 дотор оруулж центээр байрлуулна. 12-TET бол зөвхөн жишиг.",
      limit5OctaveFoot: "Хоёр ойролцоо цэг сонговол ялгааг доор томруулна; бүх нотод коммаг хүчээр оноохгүй.",
      limit5OctaveAria: "Октавт шилжүүлсэн сонгосон нот, ойрхон хосын тэмдэглэгээ", limit5RulerTitle: "Сонгосон хоёр замын зөрүү", limit5RulerValue: "{ratio} ≈ {cents} цент",
      limit5PointFact: "{name} · {ratio} · {cents} цент · {hz} · (m={m}, n={n}) · {fold}",
      limit5PairFact: "{name}: {just} ба {pyth} · {cents} цент", limit5NoMatches: "Хоёр хөрш цэг сонговол гармоникуудын яг давхцах байрыг харуулна.",
      limit5FourierTitle: "Нот ба гармоникийн мөрүүд", limit5FourierHint: "Нэг мөрд нэг сонгосон нот. Дугуй нь октав дахь үндсэн давтамж, ромб нь боломжит гармоник.",
      limit5FourierBadge: "3:2 · 5:4", limit5FourierAria: "Өндрөөр эрэмбэлсэн нотын гармоникууд, октавын хувилбар ба квинт, терцийн давхцал",
      limit5FourierFoot: "Цэнхэр нь 3:2, ногоон нь 5:4 алхмын гармоникийн давхцал. Ромбууд бол жишээ гармоникууд, хэмжсэн спектр биш; саарал цэг шинэ гармоник биш.",
      limit5Challenge: "До–Ми–Соль-ийг хамт сонс. Дараа нь «Ми: хоёр зам»-ыг сонгож биений хэмнэлийг ажигла. Хоёр дахь 5:4 давхарт өөр жижиг зөрүү гарч байна уу?",
      limit5LearnMore: "Яагаад нэг нотоос хоёр өөр давтамж үүсэв?",
      limit5LessonOne: "3-хязгаарын хөгт 2 ба 3-ын зэрэг хангалттай. 5-хязгаарын хөгт 5:4 их терцийг нэмж, торын нөгөө чиглэлд алхана. Нотуудаа сонгох нь зөвхөн математикийн биш, хөгжмийн шийдвэр.",
      limit5LessonTwo: "Дөрвөн квинт 81:64, нэг 5:4 алхам 5:4 үүсгэнэ: тэдний 81:80 синтоник комма 21.51 цент. Харин хоёр 5:4 алхамтай өөр замууд 2048:2025 буюу 19.55 центийн диасхизма өгч болно. Эдгээр нь бүх нотод наасан зөрүү бус, тодорхой хоёр замын харьцаа юм.",
      limit5Ready: "Бэлэн. Жишээ эсвэл цэгүүдээ сонгоод цэнхэр товчийг дар.", limit5Starting: "Авиа бэлтгэж байна…", limit5Playing: "Эгшиглэж байна. Идэвхтэй товчийг дарж зогсооно.",
      limit5Stopped: "Зогслоо. Өөр сонголт туршаарай.",
      limit5Hidden: "Хуудсаас гарахад дуу зогслоо.", limit5Invalid: "Эхлэх давтамж 110–330 Гц байх ёстой.",
      limit5NoNotes: "Тоглуулахын өмнө ядаж нэг нот сонго.", limit5Blocked: "Дуу эхэлсэнгүй. Хөтчийн дууны тохиргоог шалгаарай.",
      limit5Limit: "Ихдээ 12 нот сонгож болно.",
      tempChoose: "Арван хоёр нотын хөг", tempDescription: "Цэвэр интервалуудыг яагаад өөрчилдөг вэ? 12 нотын цэвэр хөг ба темперамент, аккордын гурвалжин, өөрчлөгдсөн квинтийг харьцуул.",
      tempTaskTitle: "Юуг судлах вэ?", tempTaskBuild: "Квинтийг өөрчилж үзэх", tempTaskWolf: "Квинт / чоныг харьцуулах",
      tempTaskThird: "Цэвэр терцтэй харьцуулах", tempTaskChord: "Аккорд ба тональ",
      tempTaskHintBuild: "Гулсуурыг хөдөлгө: энгийн квинт нарийсахад их терц сайжирна, харин хаалтын квинт чоно болж болно.",
      tempTaskHintWolf: "Нэг хөгт До–Соль квинт ба Соль♯–Ми♭ хаалтын квинтийг харьцуул. Түргэн биение, барзгар авиаг сонс.",
      tempTaskHintWolfFree: "Энэ хөгт чоно квинт байхгүй. До–Соль ба Соль♯–Ми♭ хаалтын квинт хоёулаа 700 центэд ойр.",
      tempTaskHintJustFifth: "Энэ цэвэр хөгт 9 квинт яг 3:2, харин Ре–Ля ба Си♭–Фа 21.51 центээр нарийн, Фа♯–До♯ 19.55 центээр өргөн. До–Соль ба Ре–Ля-г харьцуул.",
      tempTaskHintJustBuild: "Энд 12 цэвэр нотыг тогтмол сонгосон тул квинт нарийсгах гулсуур байхгүй. Аккордын үндэс, төрлийг сольж торын гурвалжин хаана цэвэр байгааг үз.",
      tempTaskHintThird: "Сонгосон хөгийн терцийг яг 5:4 их, эсвэл 6:5 бага терцтэй харьцуул. Дууны өндөр бус, биениеийг анзаар.",
      tempTaskHintChord: "Нэг гурвалжныг өөр тональ руу шилжүүл. Зарим хөгт аккордын өнгө их өөрчлөгдөнө.",
      tempSystemTitle: "Хөгийн систем", tempKeyTitle: "Аккордын үндэс", tempQualityTitle: "Аккордын төрөл",
      tempEqual: "12-TET · Тэнцүү", tempPythagorean: "Пифагорын", tempMeantone: "1/4-комма дундаж",
      tempWerckmeister: "Веркмайстер III", tempVallotti: "Валлотти", tempJust: "12 цэвэр нот · До төвтэй", tempAdjustable: "Өөрөө тохируулах",
      tempMajor: "Мажор", tempMinor: "Минор", tempNarrowTitle: "11 квинтийг нарийсгах хэмжээ", tempPresetAria: "Квинтийг нарийсгах жишээнүүд",
      tempPythShort: "Пифагор", tempEqualShort: "Тэнцүү", tempNoWolfShort: "Цэвэр хаалт", tempMeantoneShort: "1/4-комма",
      tempAdjustFact: "Энгийн квинт: {regular} цент · хаалтын квинт: {wolf} цент · До–Ми терц: {third} цент.",
      tempListenBuild: "Квинтийг өөрчлөөд аккордыг сонс. Цэвэр их терц 5:4 буюу 386.31 цент.",
      tempListenWolf: "Квинтийн үед доод нотын 3f ба дээд нотын 2f гармоник хэрхэн зөрж байгааг харьцуул.",
      tempListenWolfFree: "Энд хаалтын квинтийг зохицуулсан. Жинхэнэ чоно квинтийг сонсохын тулд Пифагор эсвэл дундаж хөг сонго.",
      tempListenJustFifth: "Цэвэр До–Соль (701.96 цент) ба нарийн Ре–Ля (680.45 цент)-г харьцуул. Гармониктай авианд хоёр дахь нь биение үүсгэж болно.",
      tempListenJustBuild: "До мажор 4:5:6 цэвэр аккорд. Үндсийг Ре мажор болгоод үз: терц нь цэвэр, харин квинт нь 3:2 биш.",
      tempListenThird: "Цэвэр их терцэд доод нотын 5 дахь, дээд нотын 4 дэх гармоник давхцана.",
      tempListenThirdMinor: "Цэвэр бага терцэд доод нотын 6 дахь, дээд нотын 5 дахь гармоник давхцана.",
      tempListenChord: "До мажор ба Соль♯ мажорыг дундаж хөгт харьцуул. Дараа нь тэнцүү хөгт турш.",
      tempPlaybackAria: "Нотуудыг ээлжлэн эсвэл хамт сонсох, дахин дарж зогсоох", tempMelody: "Ээлжлэн", tempChord: "Хамт",
      tempRegularPlay: "Энгийн квинт", tempWolfPlay: "Чоно квинт", tempClosingPlay: "Хаалтын квинт", tempJustImperfectPlay: "Нарийн Ре–Ля квинт", tempTunedPlay: "Хөгийн терц", tempPurePlay: "Цэвэр терц",
      tempReference: "Бүх системд Ля4 = 440 Гц хэвээр; бусад нотын өндөр өөрчлөгдөнө.",
      tempLatticeTitle: "3:2 ба 5:4-ийн гурвалжин тор",
      tempLatticeHint: "Цэвэр харьцааны гурван мөр: хөндий цэгүүд 3:2 ба 5:4-ийн зам. Өнгөт нотыг квинтийн замын жишигтэй харьцуулсан; энэ нь цэвэр терцийн бүх боломж биш. Зөрөөг томруулсан.",
      tempJustLatticeHint: "Сонгосон бүх 12 нот 3:2 ба 5:4-ийн торын яг цэг дээр (гурван мөр) байна. Алтан нь цэвэр аккордын гурвалжин, хөх ногоон нь бодит сонгосон гурван нот; өөр тональд хэлбэр нь өөрчлөгдөнө.",
      tempJustTunedLegend: "Тороос сонгосон цэвэр нот",
      tempJustIntro: "До төвтэйгээр 12 товчлуур бүрд нэг яг цэвэр харьцаа сонгосон. Өөр тональд аккордын гурвалжин цэвэр биш байж болно: ямар ч 12 нотын тогтмол цэвэр хөг бүх тональд нэгэн зэрэг таарахгүй.",
      tempJustRatioAria: "До төвтэй сонгосон цэвэр хөгжийн арван хоёр яг давтамжийн харьцаа",
      tempJustLatticeAria: "3:2 ба 5:4 торын гурван мөр дээрх яг цэвэр 12 нот, цэвэр гурвалжин ба бодит аккорд; нот дээр дарж үндэс сонгоно",
      tempJustFifthsAria: "До төвтэй цэвэр хөгжийн арван хоёр квинт: ес нь цэвэр, хоёр нь нарийн, нэг нь өргөн",
      tempOpenJustLattice: "Энэ 12 цэгийг 5-хязгаарт үзэх →",
      tempExactLegend: "Цэвэр тор", tempTunedLegend: "Хөглөсөн нот (квинтийн зам)", tempTriangleLegend: "Цэвэр аккордын гурвалжин",
      tempLatticeScale: "Зөрөөг зурагт ×8 томруулав",
      tempJustLatticeScale: "Торын яг цэгүүд · томруулалтгүй",
      tempLatticeFoot: "→ нь 3:2 квинт, ↗ нь 5:4 терц. Цэвэр Ре♯ ба Ми♭-ийн замын төгсгөл Пифагорын коммагаар (23.46 цент) зөрнө.",
      tempJustLatticeFoot: "→ нь яг 3:2 квинт, ↗ нь яг 5:4 терц. Нэр ойролцоо ч зам өөр бол октавт оруулсан давтамж ялгаатай байж болно.",
      tempLatticeAria: "Цэвэр харьцааны гурван мөр, квинтийн замын жишиг, До–Ми цэвэр 5:4 зорилтот цэг ба аккордын гурвалжин; нот дээр дарж үндэс сонгоно",
      tempLatticeFact: "{quality} аккордын терц {third} цент (цэвэрээс {thirdError}), квинт {fifth} цент (цэвэрээс {fifthError}). Харагдаж буй тасархай холбоос нь терцийн хоёр замын 21.51 центийн зөрүүг заана.",
      tempLatticeWolf: "До–Соль энгийн квинт ба Соль♯–Ми♭ хаалтын квинт ялгаатай. Пифагорын 23.46 центийн коммаас шалтгаалж цэвэр Ре♯-ийг Ми♭-ээр шууд орлуулж болохгүй.",
      tempLatticeWolfFree: "Энэ хөг хаалтын зөрөөг нэг чоно квинтгүйгээр хуваарилсан. Гэхдээ цэвэр торын Ми♭ ба Ре♯ цэгүүд 23.46 центээр ялгаатай хэвээр.",
      tempJustLatticeFifths: "До төвтэй энэ 12 нотод 9 квинт цэвэр, 3 квинт өөрчлөгдсөн. Ре–Ля-ийн нарийн квинт бол торын цэгүүдээс зөвхөн 12-ыг сонгосны үр дагавар.",
      tempJustChordFact: "Энэ {quality} аккордын терц {third} цент (цэвэрээс {thirdError}), квинт {fifth} цент (цэвэрээс {fifthError}). Алтан нь цэвэр гурвалжин, хөх ногоон нь сонгосон гурван нот.",
      tempLatticeConstruction: "До→Ми дөрвөн хөглөсөн квинтээр: {actual} цент. Цэвэр 5:4 зорилт: 386.31 цент (зөрүү {error} цент). {outcome}",
      tempLatticeConstructionExact: "Хоёр зам таарлаа: Ми яг 5:4-ийн цэгт хүрнэ. Гэвч Пифагорын жишиг нь торын өөр цэгт байна.",
      tempJustConstructionExact: "До–Ми яг 5:4 терц. Гэхдээ бусад тональд терц бүр цэвэр байх албагүй.",
      tempJustConstruction: "Сонгосон квинтээр До→Ми: {actual} цент; цэвэр 5:4: 386.31 цент (зөрүү {error} цент). {outcome}",
      tempLatticeConstructionOther: "Хоёр зам зөрж байна. Нот Пифагорын жишгээс зөрсөн нь бүх цэвэр интервалыг алдсан гэсэн үг биш.",
      tempPartialTitle: "Гармоникийн давхцал ба биение", tempPartialHint: "Цэвэр квинтэд доод 3f, дээд 2f, цэвэр их терцэд доод 5f, дээд 4f гармоник давхцана.",
      tempPartialHintMinor: "Цэвэр бага терцэд доод нотын 6f, дээд нотын 5f гармоник давхцана.",
      tempPartialAria: "Хоёр нотын гармоникийн шугам болон ойролцоо давхцах дээд гармоникууд",
      tempBeatFact: "{lower}–{upper}: {a}f ба {b}f гармоник {beat} Гц-ээр зөрнө. Хамт эгшиглэхэд биение, барзгар өнгө сонсогдож болно.",
      tempCircleTitle: "Квинтийн тойрог", tempCircleHint: "Нот дээр товшиж үндсийг сонго. Холбоосын өнгөөр цэвэр, нарийссан, чоно квинтийг ялгана.",
      tempCircleAria: "Интерактив квинтийн тойрог; нот дээр товшиж үндэс сонгоно, зүүн ба баруун сум сонголтыг эргүүлнэ",
      tempPure: "Цэвэр 3:2", tempNarrow: "Нарийссан", tempWolfLegend: "Чоно квинт", tempJustWide: "Өргөссөн квинт",
      tempFifthsTitle: "Квинт бүрийн зөрүү", tempFifthsHint: "Баганууд нь цэвэр 3:2 квинтээс хэдэн центээр зөрснийг харуулна. Хэвтээ шугам 0.",
      tempFifthsAria: "Цэвэр квинтээс зөрөх арван хоёр багана; чоно квинтийг ялган тэмдэглэсэн",
      tempFifthsTable: "12 квинтийн хүснэгт", tempTableFifth: "Квинт", tempTableSize: "Хэмжээ (цент)", tempTableDeviation: "3:2-оос (цент)",
      tempCommaBadge: "Пифагорын комма: {cents} цент", tempWolfFact: "Чоно квинт: {from}–{to}, {cents} цент (цэвэр квинтээс {deviation}).",
      tempNoWolfFact: "Тусдаа чоно квинтгүйгээр тойрог хаагдана. Арван хоёр квинтийн {narrow} нь нарийссан.",
      tempJustFifthsFact: "9 квинт цэвэр; Ре–Ля ба Си♭–Фа 21.51 центээр нарийн, Фа♯–До♯ 19.55 центээр өргөн. Эдгээр нь нэг хаалтын чоно квинт биш.",
      tempJustCircleFoot: "Яг 12 нот · 3 өөр квинт",
      tempJustCircleHint: "Нот дээр дарж үндсийг сонго. Ногоон шугам яг 3:2 квинт, цэнхэр нь нарийн, улбар шар нь өргөн. Тусдаа нэг хаалтын чоно квинт байхгүй.",
      tempChordTitle: "Аккордын давтамж", tempChordHint: "Бүх хөгт Ля4 = 440 Гц. Доорх зөрүү нь ижил нэртэй 12-TET нотоос хэдэн центээр өөр байгааг харуулна.",
      tempChordFoot: "Ижил аккордыг өөрөөр сонсохын тулд систем эсвэл үндсэн нотоо солиорой.",
      tempChordFact: "Үндэс–терц: {third} цент · үндэс–квинт: {fifth} цент. (12-TET-д: {expected} ба 700 цент.)",
      tempChallengeText: "Квинтийг өөрчилж үз: 0 центэд их терц өргөн, 5.38 центэд цэвэр боловч чоно квинт томорно. Дараа нь хоёр квинтийг гармониктай сонс.",
      tempLearnMore: "Квинтийн тойргийг яагаад олон аргаар хаадаг вэ?",
      tempLessonOne: "Цэвэр 3:2 квинт 701.955 цент боловч арван хоёр цэвэр квинт долоон октаваас 23.46 центээр их: энэ нь Пифагорын комма. Арван хоёр нотыг тойрог болгохын тулд үүнийг хуваарилна.",
      tempLessonTwo: "Дөрвөн цэвэр квинтээс 407.82 центийн Пифагорын их терц, харин 5:4-өөс 386.31 центийн цэвэр терц гарна. 1/4-комма дундаж хөг квинт бүрийг синтоник коммагийн дөрөвний нэгээр нарийсгаж, их терцийг цэвэр болгохдоо өргөн чоно квинт үүсгэнэ. Торын цэг нь ижил нэртэй нотыг бүтээх өөр зам болохоос давтамж бүрийн цорын ганц координат биш; зөрөөг зурагт томруулсан. Энэ нь арван хоёр товчлууртай хөгжмийн хялбаршуулсан загвар.",
      tempReady: "Бэлэн. Хөг, аккордоо сонгоод сонсоорой.", tempStarting: "Нотуудыг бэлтгэж байна…",
      tempPlaying: "Эгшиглэж байна. Идэвхтэй товчийг дахин дарж зогсооно.", tempStopped: "Зогслоо. Өөр хөг туршаарай.",
      tempHidden: "Хуудсаас гарахад дуу зогслоо.", tempBlocked: "Авиа эхэлсэнгүй. Хөтчийн дууны тохиргоог шалгаарай.",
      intervalChoose: "Хоёр нотын харьцаа",
      intervalDescription: "Хоёр тусдаа авианы давтамжийг энгийн харьцаагаар тохируулж, гармоникууд нь хаана давхцахыг харьцуул.",
      intervalPresetsTitle: "Давтамжийн харьцаа (дээд : доод)", intervalPresetsAria: "Хоёр нотын энгийн харьцаа",
      intervalNames: { "1:1": "Унисон", "2:1": "Октав", "3:2": "Цэвэр квинт", "4:3": "Цэвэр кварт", "5:4": "Их терц", "6:5": "Бага терц" },
      intervalBase: "Доод нотын давтамж", intervalBaseSliderAria: "Доод нотын давтамжийн гулсуур",
      intervalBaseInputAria: "Доод нотын давтамжийг герцээр оруулах",
      intervalTuningTitle: "Хөг", intervalTuningAria: "Хоёр нотын хөг сонгох",
      intervalJust: "Энгийн харьцаа", intervalEqual: "12-TET",
      intervalColorTitle: "Авианы найрлага", intervalColorAria: "Цэвэр эсвэл гармониктай авиа",
      intervalPure: "Цэвэр", intervalRich: "Гармониктай",
      intervalColorHint: "Цэвэр авиа зөвхөн үндсэн давтамжтай. Гармониктай хоёр авианы дээд хэсгүүд давхцах эсвэл ойртох боломжтой.",
      intervalPlay: "Тоглуулах", intervalStop: "Зогсоох",
      intervalNotes: "Хоёр нот", intervalActualRatio: "Бодит харьцаа",
      intervalPeriod: "Хамтын үе", intervalReferencePeriod: "Энгийн харьцааны жишиг үе",
      intervalOverlap: "Анхны давхцах гармоник", intervalAlmost: "Ойролцоо гармоникууд",
      intervalJustStatus: "Харьцаа яг таарсан тул эдгээр гармоник давхцана.",
      intervalEqualStatus: "12-TET хөг нь энгийн харьцаанаас {cents} центээр зөрнө. Ойролцоо гармоникуудын зөрүү {hz}; «Гармониктай» үед биение сонсогдож болно.",
      intervalWaveTitle: "Хоёр нотын долгион",
      intervalWaveHint: "Доод, дээд нот ба нийлбэр долгион. Энгийн харьцаанд хамтын үеийн дараа давтагдана.",
      intervalWaveFootJust: "Хамтын нэг үед доод нот {low}, дээд нот {high} бүтэн хэлбэлзэнэ",
      intervalWaveFootEqual: "Энгийн харьцааны жишиг цонх; 12-TET-д яг ижил давталт үгүй",
      intervalSpectrumTitle: "Хоёр нотын гармоникууд",
      intervalSpectrumHint: "Цэнхэр нь доод, улбар нь дээд нот. Давхцсан эсвэл ойртсон хосыг хүрээлэв.",
      intervalSpectrumHintPure: "«Цэвэр» авианд хоёр үндсэн давтамж л байна. Давхцах дээд гармоникийг «Гармониктай» үед харна.",
      intervalSpectrumJust: "{p} × {low} = {q} × {high} Гц",
      intervalSpectrumEqual: "{p} × {low} ба {q} × {high} Гц · зөрүү {delta}",
      intervalSpectrumPure: "«Цэвэр» үед зөвхөн үндсэн давтамжууд байна; дээд гармоникууд үүсээгүй.",
      intervalChallenge: "4:3 сонгоод хамтын үе, давхцах гармоникийг таа. Дараа нь 12-TET хөгтэй харьцуул.",
      intervalLearnMore: "Хоёр нотын харьцаа ба нэг нотын гармоник юугаараа ялгаатай вэ?",
      intervalLessonOne: "3:2 бол хоёр тусдаа нотын үндсэн давтамжийн харьцаа. Харин нэг нотын дээд гармоникууд нь өөрийн үндсэн давтамжаас 2, 3, 4… дахин их давтамжтай.",
      intervalLessonTwo: "3:2 үед доод нотын 3 дахь, дээд нотын 2 дахь гармоник давхцана. 12-TET хөгтэй бол эдгээр нь ойртож, бага зэрэг зөрнө. «Гармониктай» үед биение үүсч болно. Таатай эсэхийг ганц харьцаагаар тодорхойлохгүй.",
      intervalReady: "Бэлэн. Ээлжлэн эсвэл Хамт сонсоорой.", intervalStarting: "Хоёр нот эхэлж байна…",
      intervalPlaying: "Дуугарч байна. Идэвхтэй товчийг дахин дарж зогсооно, эсвэл нөгөө товч руу шилжинэ.",
      intervalStopped: "Зогслоо. Өөр харьцаа туршаарай.", intervalHidden: "Хуудсаас гарахад авиа зогслоо.",
      intervalUnsupported: "Энэ хөтөч хоёр нотын авиа үүсгэж чадахгүй байна.",
      intervalBlocked: "Авиа эхэлсэнгүй. Хөтчийн дууны тохиргоог шалгана уу.",
      intervalInvalid: "Доод нотын давтамж 110–440 Гц байх ёстой.",
      intervalWaveAria: "Доод, дээд болон нийлбэр нотын долгионы загвар",
      intervalSpectrumAria: "Хоёр нотын гармоникуудын давхцал ба ойролцоох хос",
      harmonicChoose: "Гармоникуудыг нэмэх", harmonicDescription: "Нэг давтамжийн бүхэл тоон үржвэрүүдийг нийлүүлж шинэ авиа бүтээнэ.",
      harmonicPlay: "Тоглуулах", harmonicStop: "Зогсоох", harmonicBase: "Үндсэн давтамж",
      harmonicPresetsTitle: "Бэлэн найрлагууд", harmonicPure: "Цэвэр", harmonicOdd: "Сондгой",
      harmonicRich: "Олон гармоник", harmonicStrengths: "Гармоник бүрийн хүч", harmonicNotation: "f, 2f, 3f…",
      harmonicWaveTitle: "Нийлбэр долгион", harmonicWaveHint: "Гармоник нэмж, долгионы хэлбэр хэрхэн өөрчлөгдөхийг хараарай.",
      harmonicSpectrumTitle: "Гармоникийн найрлага", harmonicSpectrumHint: "Багана бүр f, 2f, 3f… давтамжийн хүчийг харуулна.",
      harmonicSpectrumFoot: "Үндсэн давтамжийг өөрчлөхөд бүх оргил хамт шилжинэ.",
      harmonicChallenge: "Үндсэн давтамжийг хэвээр үлдээгээд 3f, 5f гармоникуудыг нэм. Дууны өнгө хэрхэн өөрчлөгдөв?",
      harmonicLearnMore: "Гармоникууд дууны өнгийг хэрхэн бүтээдэг вэ?",
      harmonicLessonOne: "Үндсэн давтамж f дээр 2f, 3f, 4f… долгионуудыг нэмэхэд нийлбэр долгионы хэлбэр, дууны өнгө өөрчлөгдөнө.",
      harmonicLessonTwo: "Гармоник тус бүрийн хүчийг өөрчилж болно. Харин давтамж нь үндсэн давтамжийн бүхэл тоон үржвэр хэвээр байна.",
      harmonicReady: "Бэлэн. Авиа тоглуулах товчийг дарна уу.", harmonicStarting: "Авиа эхэлж байна…",
      harmonicPlaying: "Дуугарч байна. Гармоникийн хүчийг өөрчилж сонсоорой.",
      harmonicStopped: "Зогслоо. Өөр найрлага туршаарай.", harmonicUnsupported: "Энэ хөтөч загварчилсан авиа тоглуулах боломжгүй байна.",
      harmonicBlocked: "Авиа эхэлсэнгүй. Хөтчийн дууны тохиргоог шалгаад дахин оролдоно уу.",
      harmonicInvalid: "Үндсэн давтамжийг 120–1,000 Гц-ийн хооронд оруулна уу.",
      harmonicWaveAria: "Найман синус гармоникаар бүтсэн долгионы загвар",
      harmonicSpectrumAria: "Найман гармоникийн хүч болон давтамж",
      harmonicPresetsAria: "Гармоникийн бэлэн найрлага", harmonicSlidersAria: "Найман гармоникийн далайц",
      noiseChoose: "Шуугианы өнгө сонгох", noiseDescription: "Олон давтамжийн санамсаргүй хэлбэлзлийг сонсож, найрлагыг нь ажиглаарай.",
      noiseWhite: "Цагаан", noisePink: "Ягаан", noiseBrown: "Бор", noisePlay: "Тоглуулах", noiseStop: "Зогсоох",
      noiseColorDescription: {
        white: "Давтамжийн нэг герцийн зурвас бүрд ойролцоогоор ижил чадалтай.",
        pink: "Нам давтамж илүү хүчтэй; октав бүрийн чадал ойролцоогоор ижил.",
        brown: "Нам давтамжууд бүр ч хүчтэй давамгайлна."
      },
      noiseCutoff: "Өндөр давтамжийг шүүх", noiseCutoffHint: "Багасгахад дээд давтамж суларч, авиа бүдгэрнэ.",
      noiseSafety: "Шуугиан чанга сонсогдож болно. Ялангуяа чихэвчтэй бол багаас эхлээрэй.",
      noiseWaveTitle: "Шуугианы долгион", noiseWaveHint: "40 мсек үргэлжлэх санамсаргүй хэсгийн жишээ. Үелэхгүй.",
      noiseSpectrumTitle: "Давтамжийн тархалт", noiseSpectrumHint: "Нэг нэг оргил биш, олон давтамжийн ерөнхий чиг хандлага.",
      noiseSpectrumFoot: "Энэ нь хэмжилт биш, хүлээгдэх ерөнхий хэлбэр юм.",
      noiseChallenge: "Цагаан, ягаан, бор шуугианыг ижил хэмжээнд сонсоод харьцуул. Дараа нь шүүлтүүрийг багасга.",
      noiseLearnMore: "Шуугиан яагаад цэвэр авианаас өөр вэ?",
      noiseLessonOne: "Цэвэр авиа нэг давтамжтай. Харин шуугиан олон давтамжийн санамсаргүй хэлбэлзлээс бүтдэг тул тогтмол давтагдах үе байхгүй.",
      noiseLessonTwo: "Цагаан шуугианд давтамжийн нэг герцийн зурвас бүрийн чадал ойролцоогоор ижил. Ягаан, бор шуугианд нам давтамжууд харьцангуй хүчтэй. Дээд давтамжийг шүүхэд авиа бүдгэрнэ.",
      noiseReady: "Бэлэн. Шуугиан сонсох товчийг дарна уу.", noiseStarting: "Шуугиан эхэлж байна…",
      noisePlaying: "Шуугиан дуугарч байна. Өнгө, шүүлтүүрийг өөрчилж сонсоорой.",
      noiseStopped: "Зогслоо. Өөр шуугиан туршаарай.", noiseUnsupported: "Энэ хөтөч загварчилсан шуугиан тоглуулах боломжгүй байна.",
      noiseBlocked: "Шуугиан эхэлсэнгүй. Хөтчийн дууны тохиргоог шалгана уу.",
      noiseWaveAria: "Үелдэггүй шуугианы долгионы загвар",
      noiseSpectrumAria: "Өнгөт болон шүүсэн шуугианы давтамжийн хүлээгдэх тархалт",
      noiseChoicesAria: "Шуугианы өнгө сонгох",
      mixChoose: "Хоёр авиа нийлүүлэх", mixDescription: "Ойролцоо хоёр давтамж нийлээд дууны чанга, сул нь ээлжлэн өөрчлөгдөнө.",
      mixPlay: "Тоглуулах", mixStop: "Зогсоох",
      mixBase: "Эхний давтамж", mixGap: "Давтамжийн зөрүү (Δf)",
      mixTryGap: "Туршиж үз:", mixZeroGap: "0 Гц", mixTwoGap: "2 Гц", mixFourGap: "4 Гц", mixTenGap: "10 Гц",
      mixTwoFrequencies: "Хоёр давтамж", mixBeatRate: "Чангарч, сулрах хурд", mixBeatUnit: "удаа/сек",
      mixWaveTitle: "Хоёр долгионы нийлбэр", mixWaveHint: "Том цонхонд дууны чанга, сулын хүрээ харагдана. + дарж томруулбал жинхэнэ хэлбэлзлийг харна.",
      mixWaveHintFine: "Цэнхэр шугам: хоёр долгионы жинхэнэ нийлбэр. Ногоон шугам: далайцын хүрээ.",
      mixSpectrumTitle: "Давтамжийн бүрэлдэхүүнүүд", mixSpectrumHint: "Чангарч, сулрах нь шинэ нам давтамж үүсгээгүй.",
      mixSpectrumFoot: "Спектрт зөвхөн анхныхаа хоёр давтамж харагдана.",
      mixSpectrumZeroFoot: "Зөрүү 0 байхад ижил хоёр давтамж спектрт нэг оргил болж нийлнэ.",
      mixZoomLabel: "Томруулах", mixPanLabel: "Шилжүүлэх", mixZoomValueAria: "Харагдах хугацаа",
      mixZoomOutAria: "Томруулалтыг багасгах", mixZoomInAria: "Долгионыг томруулах",
      mixWaveAria: "Хоёр синус долгионы нийлбэр ба цохилтын далайцын хээ",
      mixSpectrumAria: "Нэг эсвэл хоёр синус давтамжийн бүрэлдэхүүний идеал спектр",
      mixBaseSliderAria: "Эхний давтамжийн гулсуур", mixBaseInputAria: "Эхний давтамжийг герцээр оруулах",
      mixGapSliderAria: "Хоёр давтамжийн зөрүүг герцээр сонгох",
      mixGapPresetsAria: "Давтамжийн зөрүүний жишээ", mixPlotToolsAria: "Долгионы хугацааны хуваарь",
      mixLeftAria: "Өмнөх хугацааг харах", mixRightAria: "Дараах хугацааг харах",
      mixChallenge: "Зөрүүг 0, 2, 4, 10 Гц болгож сонсоод, чангарч сулрах хээ хэрхэн өөрчлөгдөхийг ажиглаарай.",
      mixLearnMore: "Хоёр авиа нийлээд яагаад чангарч, сулардаг вэ?",
      mixLessonOne: "Ойролцоо давтамжтай хоёр синус долгион зарим үед бие биеэ дэмжиж, зарим үед бие биеэ сулруулна. Дууны чанга, сул ээлжлэхийг биение буюу цохилт гэнэ.",
      mixLessonTwo: "Чангарч, сулрах хурд нь хоёр давтамжийн зөрүү: Δf = |f₂ − f₁|. Жишээ нь, 440 ба 444 Гц-д секундэд 4 удаа чангарч сонсогдоно. Спектрт харин 4 Гц-ийн гурав дахь авиа шинээр үүсэхгүй.",
      mixReady: "Бэлэн. Хоёр авиа тоглуулах товчийг дарна уу.", mixStarting: "Хоёр авиа эхэлж байна…",
      mixPlaying: "Авиа дуугарч байна. Зөрүүг өөрчилж чангарч, сулрах хурдыг сонсоорой.",
      mixStopped: "Зогслоо. Өөр давтамжийн зөрүү туршаарай.", mixHidden: "Хуудаснаас гарахад авиа зогслоо.",
      mixUnsupported: "Энэ хөтөч авиа тоглуулах боломжгүй байна.",
      mixBlocked: "Авиа эхэлсэнгүй. Хөтчийн дууны зөвшөөрлийг шалгаад дахин оролдоно уу.",
      mixInvalid: "Эхний давтамжийг 120–1,000 Гц-ийн хооронд оруулна уу.",
      strikeChoose: "Дууны загвар сонгох",
      pluck: "Гитар", kick: "Бөмбөр", piano: "Төгөлдөр хуур", strikeGroupAria: "Цохилтын дууны загвар",
      strikeCaption: "Дарж сонсоод, дахин дарж давтаарай",
      strikePluckButton: "Татах", strikeStrumButton: "Цохих", strikeKickButton: "Цохих",
      strikePianoButton: "Товчлуур дарах", strikePianoTapButton: "Товших",
      strikePianoTouchTitle: "Тоглох арга", strikePianoPress: "Дарах", strikePianoTap: "Товших",
      strikePianoTypeTitle: "Хөгжмийн зэмсэг", strikePitched: "Ноттой", strikeMarimba: "Маримба", strikeXylophone: "Ксилофон", strikeMandolin: "Мандолин", strikeHarp: "Ятга (арфа)",
      strikeMandolinPick: "Татах", strikeMandolinTremolo: "Тремоло", strikeMandolinPlayTitle: "Мандолин тоглох арга",
      strikePianoAcoustic: "Төгөлдөр хуур",
      strikePianoElectric: "Цахилгаан хуур",
      strikePianoTouchHint: "Дарахад товчлуурыг барьсан үеийн авиа чөлөөтэй намдана. Товшиход алх зөөлөн цохиж, намжаагч удахгүй буцна.",
      strikePianoElectricHint: "FM загварын эхний авиа тод, төмөрлөг, дараа нь зөөлөн болно. Товшиход намжаагч эрт буцна; цохилтын хүч нь дууны өнгийг ч өөрчилнө.",
      strikeDescElectric: "Давтамжийн модуляцтай цахим авиа эхэндээ тод, сүүлдээ зөөлөрч намдана. Ердийн төгөлдөр хууртай харьцуулаарай.",
      strikeDescChimes: "Ноттой хоолойт хонхыг цохиж, бүхэл тоон харьцаагүй тод хэлбэлзлүүд нь хэрхэн намдахыг ажиглаарай.",
      strikeDescMarimba: "Зөөлөн цохиураар хөглөсөн модон хавтанг цохих загвар. Дээд хэлбэлзлүүд нь нам, зөөлөн авианаасаа хурдан намдана.",
      strikeDescXylophone: "Хатуу цохиур тод эхлэлтэй модон хавтанг хэлбэлзүүлнэ. 1 : 3 : 6.16 харьцаатай богино цуурайг маримбагийн 1 : 4 : 10-тай харьцуулаарай.",
      strikeDescMandolin: "Бага зэрэг өөр давтамжтай хос чавхдас нэг нот үүсгэнэ. Нэг удаа татах болон найман тусдаа цохилтоор тремоло тоглуулахыг харьцуулаарай.",
      strikeDescHarp: "Зөөлөн татсан чавхдас удаан цуурайтаж, царыг нь дууриасан резонанс өнгө оруулна. Дээд гармоникууд нам авиагаасаа түрүүн намдана.",
      strikeMarimbaHint: "Бичлэг биш, сургалтын загвар: хөглөсөн модон хавтан, зөөлөн цохиур ба нам авианы резонатор. Цохилтын хүч нь дууны хэмжээ болон өнгийг өөрчилнө.",
      strikeMarimbaSpectrumHint: "Нам хэлбэлзлүүдийн давтамж ойролцоогоор 1 : 4 : 10 харьцаатай, бүх гармоник оролцохгүй. Дээд хэлбэлзлүүд хурдан намдана. Эдгээр нь хэмжилт биш, жишээ параметрүүд юм.",
      strikeXylophoneHint: "Бичлэг биш, хатуу цохиуртай модон хавтангийн загвар. Маримбагаас тод эхлэлтэй, богино намдалттай; цохилтын хүч чанга болон өнгийг өөрчилнө.",
      strikeXylophoneSpectrumHint: "Эхний хэлбэлзлүүд ойролцоогоор 1 : 3 : 6.16 харьцаатай (хэвлэгдсэн нэг хавтангийн жишээ). Дээд хэлбэлзлүүд хурдан намдана; хүч ба намдалтын утгууд нь сургалтын жишээ юм.",
      strikeMandolinHint: "Бичлэг биш, давхар чавхдас ба жижиг царны хялбарчилсан загвар. «Татах» нь нэг удаа, «Тремоло» нь ойролцоогоор 0.1 сек зайтай найман удаа татна. Хүч нь өнгийг өөрчилнө.",
      strikeHarpHint: "Арфын бичлэг биш, хуруугаар татах ба царны хялбар загвар. Гитар, мандолиноос зөөлөн эхэлж, дээд гармоникууд цөөн, удаан цуурайтана.",
      strikeMandolinSpectrumHint: "Хос чавхдасны давтамж бага зэрэг зөрөхөд гармоникуудын далайц өөрчлөгдөнө. Тремолод цохилт бүрээр хоёр чавхдас дахин хэлбэлзэнэ.",
      strikeHarpSpectrumHint: "Татах байрлал зарим гармоникийг сулруулна; царны загвар тодорхой давтамжийг өсгөнө. Эдгээр нь хэмжилт биш, тайлбарлах параметрүүд юм.",
      strikePitchedChimesHint: "Нотоо сонгоод нэг удаа цохино. Металл мэт хэлбэлзлүүд үргэлжлэн эгшиглэнэ; төгөлдөр хуурын товчлуур, намжаагч байхгүй.",
      strikeGuitarPlay: "Гитар тоглуулах", strikeSingle: "Нэг чавхдас", strikeStrum: "Олон чавхдас",
      strikeChord: "Аккорд цохих", strikeMoreChords: "Бусад аккорд",
      strikePatternTitle: "Цохих арга", strikePatternDown: "Доош цохих", strikePatternUp: "Дээш цохих",
      strikePatternAlternate: "Доош–дээш", strikePatternArpeggio: "Арпеджио", strikePatternFingerpick: "Хуруугаар татах",
      strikeChordHint: "Аккордын товчийг дарахад шууд дуугарна. Доош, дээш, ээлжлэн цохих, арпеджио, эрхий–хурууны таталтыг туршаарай. Товшилт бүр шинэ авиа үүсгэнэ.",
      strikePluckPosition: "Татах байрлал", strikePluckPositionHint: "Үзүүрт нь ойр татахад дээд гармоникууд тодордог.",
      strikePitch: "Нотын давтамж", strikePitchSliderAria: "Нотын давтамжийн гулсуур",
      strikePitchInputAria: "Нотын давтамжийг герцээр оруулах",
      strikeStrength: "Цохилтын хүч", strikeDecay: "Намдах хугацаа",
      strikeDrumVoiceTitle: "Цохивор хөгжмийн төрөл", strikeDrumMembrane: "Басс бөмбөр / том",
      strikeDrumViewTitle: "Бөмбөр шинжлэх горим", strikeDrumKit: "Иж бүрдэл", strikeDrumModels: "Загварууд",
      strikeDrumKitHint: "Цохилуурыг товшиж сонсоорой. Цохилтын хүч нь дууны өнгийг өөрчилнө; цан дуугарч байхад дөрөөгөөр намдааж болно.",
      strikeKitDrums: "Бөмбөр", strikeKitCymbals: "Цан", strikeKitOther: "Бусад цохивор",
      strikeHatPedal: "Хай-хэт дөрөө", strikeHatClosed: "Хаалттай", strikeHatHalf: "Хагас", strikeHatOpen: "Нээлттэй",
      strikeHatPedalHint: "Нээлттэй цанг товшоод дуу нь намдахаас өмнө дөрөөг зүүн тийш хөдөлгө. Дөрөө өөрөө цохилт үүсгэхгүй.",
      strikeKitKick: "Их бөмбөр", strikeKitSnare: "Жижиг бөмбөр", strikeKitRimshot: "Хүрээтэй цохилт",
      strikeKitFloorTom: "Суурь том", strikeKitMidTom: "Дунд том", strikeKitHighTom: "Өндөр том",
      strikeKitHat: "Хаалттай цан", strikeKitHalfHat: "Хагас нээлттэй цан", strikeKitOpenHat: "Нээлттэй цан", strikeKitRide: "Райд", strikeKitCrash: "Крэш",
      strikeKitWoodblock: "Модон цохилуур",
      strikeDrumSnare: "Бага бөмбөр", strikeDrumCymbal: "Цан", strikeDrumSteelpan: "Ган бөмбөр",
      strikeDrumChimes: "Хоолойт хонх", strikeDrumWoodblock: "Модон товшуур",
      strikeDrumSize: "Бөмбөр цохих", strikeLarge: "Том", strikeMedium: "Дунд", strikeSmall: "Жижиг",
      strikeSnareLow: "Нам", strikeSnareMid: "Дунд", strikeSnareHigh: "Өндөр",
      strikeCymbalCrash: "Крэш", strikeCymbalRide: "Райд", strikeCymbalHat: "Хай-хэт",
      strikePanC: "До4", strikePanE: "Ми4", strikePanG: "Соль4", strikeNoSinglePitch: "Тогтмол нотгүй",
      strikeChimeC: "До5", strikeChimeE: "Ми5", strikeChimeG: "Соль5",
      strikeWoodLow: "Нам", strikeWoodMid: "Дунд", strikeWoodHigh: "Өндөр",
      strikeDrumHint: "Том, дунд, жижиг бөмбөрийг шууд товшиж хэмнэл үүсгээрэй. Том мембран нам хэлбэлздэг; өөрийн модын давтамжууд бүхэл тоон харьцаатай биш.",
      strikeSnareHint: "Бага бөмбөрт мембраны доргион дээр богино шуугиантай цуурай нэмэгдэнэ. Нам, дунд, өндөр цохилтыг харьцуул.",
      strikeCymbalHint: "Цангийн гурван төрөл нь хоорондоо үл бүхэл харьцаатай хэлбэлзэл ба шуугиантай. Тогтсон ганц нотгүй.",
      strikePanHint: "Ган бөмбөр нь октав болон ойролцоо 3 дахин давтамжийн хүчтэй өнгөтэй, хөглөгдсөн цохивор хөгжим. До4, Ми4, Соль4-өөр аялгуу бүтээ.",
      strikeChimesHint: "До5, Ми5, Соль5 өндөртэй жижиг хоолойт хонхыг цохиорой. Нэг цохилтоор үл бүхэл харьцаатай металл хэлбэлзлүүд жингэнэнэ.",
      strikeWoodHint: "Нам, дунд эсвэл өндөр модон товшуурыг цохиорой. Богино, үл бүхэл харьцаатай хэлбэлзэл нь металлын жингэнээнээс өөр хуурай тог тог авиа гаргана.",
      strikeDrumTension: "Мембраны таталт", strikeDrumTensionHint: "Мембраныг чангалахад бүх хэлбэлзлийн давтамж өснө.",
      strikeWaveTitle: "Дууны долгион · томруулж үзэх",
      strikeWaveSubtitle: "Бүхэлд нь намдлыг, томруулбал нэг нэг хэлбэлзлийг харна.",
      strikeZoomOutAria: "Томруулалтыг багасгах", strikeZoomInAria: "Томруулах",
      strikePanLeftAria: "Өмнөх хэсэг", strikePanRightAria: "Дараах хэсэг",
      strikeFit: "Бүгд", strikeCustom: "Өөр", strikeViewPresetLabel: "Хугацааны хуваарь",
      strikePlotToolsAria: "Долгионы графикийн удирдлага",
      strikeTime: "Дууны хугацааг шинжлэх", strikeTimeAria: "Спектрт шинжлэх хугацаа",
      strikeTimeHint: "Цохиход спектр дууг дагана. Дараа нь гулсуураар хугацааг сонгоорой.",
      strikeLocalSpectrumTitle: "Давтамжийн спектр",
      strikeLocalSpectrumSubtitle: "Сонгосон хугацааны орчмын 128 мсек долгионы Фурье шинжилгээ",
      strikeSpectrumHere: "Энэ мөчид", strikeSpectrumWhole: "Бүх дуу",
      strikeSpectrumModesAria: "Спектрийн хугацааны сонголт",
      strikeSpectrumHint: "Чавхдасны гармоникууд өөр өөр хурдтай намдана. Бөмбөрийн модын давтамжууд бүхэл тоон харьцаатай биш.",
      strikeSnareSpectrumHint: "Бага бөмбөрт мембраны оргилууд дээр шуугианы өргөн спектр нэмэгдэнэ.",
      strikeCymbalSpectrumHint: "Цангийн энерги дээд давтамжийн олон үл бүхэл харьцаатай хэлбэлзэлд тархана.",
      strikePanSpectrumHint: "Ган бөмбөрийн спектрт үндсэн нот, октав ба ойролцоогоор 3 дахин давтамж тодорно.",
      strikeChimesSpectrumHint: "Нэг цохилтын дараа өндөр, үл бүхэл харьцаатай хэдэн давтамж үргэлжлэн эгшиглэнэ.",
      strikeWoodSpectrumHint: "Богино цохилт ба хурдан намдах цөөн үл бүхэл харьцаатай модын хэлбэлзэл нийлнэ.",
      strikeSpectrumWholeHint: "Загварчилсан цохилтын турших хугацааны дундаж спектр.",
      strikeWaveAria: "Хугацаа сонгох тэмдэглэгээтэй загвар долгион",
      strikeSpectrumAria: "Загварчилсан дууны хугацааны хэсгийн Фурье спектр",
      strikeSafety: "Дуу өөрөө намдана. Ялангуяа чихэвчтэй бол эхэндээ аяархан сонсоорой.",
      strikeEnvelopeTitle: "Дууны хүч хэрхэн намдах вэ?",
      strikeEnvelopeSubtitle: "Бүх цохилтыг нэг ижил 3 секундийн хуваарьт харуулав",
      strikeZoomTitle: "Эхний 20 мсек-ийн долгион",
      strikeZoomSubtitle: "Түргэн хэлбэлзлийг томруулж харах",
      strikeEnvelopeAria: "Намдах далайцын математик загвар",
      strikeZoomAria: "Эхний 20 мсек-ийн долгионы загвар",
      strikeChallenge: "Намдах хугацааг өөрчил. Дуу болон график хэрхэн өөрчлөгдөж байна вэ?",
      strikeLearnMore: "Яагаад эдгээр дуу намддаг вэ?",
      strikeLessonOne: "Чавхдас олон давтамжаар хэлбэлзэнэ. Өндөр гармоникууд нь үндсэн давтамжаас хурдан намдана.",
      strikeLessonTwo: "Дугуй мембраны модын давтамжууд Бесселийн функцээс хамаарах тул бүхэл тоон харьцаатай биш. Бага бөмбөр шуугиантай, цан үл бүхэл харьцаатай хэлбэлзэлтэй, харин ган бөмбөр хөглөгдсөн. Хоолойт хонх нэг цохилтын дараа жингэнэж, модон товшуур богино хугацаанд намддаг. Спектрийг нь харьцуул.",
      strikeReady: "Бэлэн. Дарахад л дуу гарна.",
      strikeStarting: "Дууг бэлтгэж байна…", strikeDone: "Цохилоо. Дахин дахин товшоод хэмнэл үүсгээрэй.",
      strikeStopped: "Зогслоо. Дахин дарж сонсоорой.",
      strikeHidden: "Хуудсаас гарахад дуу зогслоо.",
      strikeUnsupported: "Энэ хөтөч дуу үүсгэж тоглуулах боломжгүй байна.",
      strikeBlocked: "Авиа эхэлсэнгүй. Хөтчийн дууны зөвшөөрлийг шалгаад дахин оролдоно уу.",
      strikeInvalid: "Нотын давтамжийг энэ зэмсгийн заасан хязгаарт оруулна уу.",
      strikeDesc: {
        pluck: "Чавхдасны хэлбэлзэл эргэж ойж, энергиэ бага багаар алддаг. Хэд хэдэн чавхдас аккорд үүсгэнэ.",
        kick: "Бөмбөр, цан, ган бөмбөр, модон товшуурыг харьцуул. Товшиж хэмнэл үүсгээрэй.",
        piano: "Алх цохиход өчүүхэн зөрүүтэй чавхдас зэрэг хэлбэлзэнэ. Цохилтын хүчийг өсгөхөд дээд гармоникууд тодорч, авиа хурц болно."
      },
      sustainChoose: "Үргэлжлэх дуу сонгох",
      sustainFlute: "Лимбэ", sustainClarinet: "Кларнет", sustainViolin: "Хийл", sustainMorin: "Морин хуур",
      sustainOrganStopped: "Битүү лимбэ 8′", sustainOrganPrincipal: "Принципал 8′", sustainAccordion: "Аккордеон · Мюзет", sustainBayan: "Баян хуур · Цэвэр хөг",
      sustainAir: "Үлээвэр", sustainBowed: "Нумт чавхдас", sustainOrgan: "Хоолойт орган", sustainFreeReed: "Чөлөөт хэлт",
      sustainGroupAria: "Үргэлжлэх авианы загвар", sustainGestureTitle: "Дуугаргах арга",
      sustainGestureAria: "Дууг барих эсвэл товшиж асаах", sustainHold: "Дарж барих", sustainToggle: "Товшиж асаах",
      sustainPress: "Дарж дуугаргах", sustainPressing: "Дуугарч байна…", sustainPressCaption: "Дараад барина, тавихад аажмаар намдана.",
      sustainTogglePlay: "Тоглуулах", sustainToggleStop: "Зогсоох", sustainToggleCaption: "Дахин товшиж намдаана.",
      sustainPitch: "Нотын давтамж", sustainPitchSliderAria: "Нотын давтамжийн гулсуур",
      sustainPitchInputAria: "Нотын давтамжийг герцээр оруулах", sustainAttack: "Эхлэх хугацаа", sustainRelease: "Намдах хугацаа",
      sustainBreath: "Үлээлтийн хүч", sustainBreathHint: "Илүү хүчтэй үлээхэд дуу чангарч, гармоникууд болон амьсгалын шуугиан өөрчлөгдөнө.",
      sustainClarinetBreathHint: "Илүү хүчтэй үлээхэд сондгой дээд гармоникууд тодорно. Нот богино хэлээр тасалсан эхлэлтэй.",
      sustainOrganPressure: "Агаарын даралт", sustainReedPressure: "Хөөргийн даралт",
      sustainOrganPressureHint: "Даралт нэмэгдэхэд гармоникууд тодорно. Битүү лимбэ 8′ нь голдуу сондгой гармониктай; Принципал 8′ нь илүү тод, богино эхлэлтэй.",
      sustainReedPressureHint: "Хөөргийн даралт гармоникийн өнгийг өөрчилнө. Мюзет хоёр бага зэрэг зөрүүтэй хэлтэй, баян хуур ганц цэвэр бүртгэлтэй.",
      sustainBow: "Нумын даралт", sustainBowHint: "Нумын даралтыг нэмэхэд авиа чангарч, наалдах–гулсах хэлбэлзлийн дээд гармоникууд тодорно. Энэ бол хялбаршуулсан загвар.",
      sustainEnvelopeHelp: "Эхлэх хугацаа дараагийн нотод, намдах хугацаа тавихад үйлчилнэ.",
      sustainEnvelopeTitle: "Дууны хүч хугацаанд", sustainEnvelopeHint: "1.2 сек үргэлжилсэн авианы хэвийн болгосон эхлэл, намдалт. Үлээлт, нумын даралт бас чанга сулд нөлөөлнө.",
      sustainEnvelopeFoot: "Босоо шугам нь тавих мөч (1.2 сек).",
      sustainDetailTitle: "Долгион ба гармоникууд", sustainDetailHint: "Чавхдасны наалдах–гулсах хөдөлгөөний хялбар загвар, их биеийн шүүлтүүрээр гаргасан 20 мсек долгион. Санамсаргүй шуугианыг зураагүй.",
      sustainFluteDetailHint: "Үлээлт ба агаарын баганын шүүлтүүрээр загварчилсан 20 мсек-ийн долгион. Санамсаргүй шуугианыг оруулаагүй.",
      sustainClarinetDetailHint: "Кларнетийн үлээсэн тогтвортой авианы 20 мсек долгион. Хэлээр тасалсан эхлэлийн шуугианыг зурагт оруулаагүй.",
      sustainI3DetailHint: "Тогтвортой үелэх авианы гармоник загвар. Эхлэлийн түр зуурын авиа, мюзетийн хос хэлний цохилтыг ганц үеийн зурагт оруулаагүй.",
      sustainWaveTitle: "Долгион", sustainSpectrumTitle: "Гармоникууд",
      sustainEnvelopeAria: "Дууг эхлүүлж, барьж, тавих үеийн далайцын загвар",
      sustainWaveAria: "20 мсек-ийн үргэлжлэх долгионы загвар",
      sustainSpectrumAria: "Загварчилсан үелэх долгионы гармоникуудын хүч",
      sustainChallenge: "Лимбэний давтамжийг тогтмол байлгаад зөөлөн, хүчтэй үлээхийг харьцуул. Дээд гармоникууд хэрхэн өөрчлөгдөв?",
      sustainClarinetChallenge: "Лимбэ, кларнет хоёрыг ижил нот дээр харьцуул. Кларнетийг зөөлөн, хүчтэй үлээхэд сондгой гармоникууд яаж өөрчлөгдөв?",
      sustainBowChallenge: "Нотын давтамжийг өөрчлөлгүй нумын даралтыг өсгөж, хийл ба морин хуурыг харьцуул. Аль гармоникууд тодров?",
      sustainOrganChallenge: "Битүү лимбэ, Принципал хоёрыг ижил нот дээр харьцуул. Аль нь хоёрдугаар гармоникийг илүү тод гаргаж байна вэ?",
      sustainReedChallenge: "Аккордеон, баян хуур дээр ижил нотыг удаан барь. Мюзетийн хоёр хэлний цохилт сонсогдож байна уу?",
      sustainLearnMore: "Эдгээр дуу яагаад үргэлжилдэг вэ?",
      sustainLessonOne: "Лимбэ, кларнетийг үлээх, хийл болон морин хуур нумдах үед хэлбэлзэлд энерги тасралтгүй өгөгдөнө. Татаж тавьсан чавхдас харин аажмаар намдана.",
      sustainLessonTwo: "Лимбэний загвар шугаман бус үлээлттэй, кларнетийн загвар сондгой гармоник давамгайлсан үелэх эх үүсвэр, богино хэлээр эхлэлт, хоолойн шүүлтүүртэй. Нумт чавхдас наалдах–гулсах хөдөлгөөний хялбар загвартай. Бодит харилцан үйлчлэл, кларнетийн регистр солигдохыг энд тооцоогүй.",
      sustainReady: "Бэлэн. Дарж барих эсвэл товшиж асаах аргыг сонгоорой.", sustainStarting: "Дууг эхлүүлж байна…",
      sustainPlayingHold: "Дуугарч байна. Гараа авахад намдана.", sustainPlayingToggle: "Дуугарч байна. Дахин товшиж намдаана.",
      sustainReleased: "Тавилаа. Дуу аажмаар намдаж байна.", sustainStopped: "Зогслоо. Өөр зэмсэг туршаарай.",
      sustainHidden: "Хуудаснаас гарахад авиа зогслоо.",
      sustainUnsupported: "Энэ хөтөч загварчилсан зэмсэг тоглуулах боломжгүй байна.",
      sustainBlocked: "Дуу эхэлсэнгүй. Хөтчийн дууны зөвшөөрлийг шалгана уу.",
      sustainInvalid: "Нотын давтамжийг энэ зэмсгийн заасан хязгаарт оруулна уу.",
      sustainDesc: {
        flute: "Үлээлтийн хүчнээс дууны хэмжээ, дээд гармоникууд нь өөрчлөгдөх лимбэний хялбаршуулсан загвар.",
        clarinet: "Доод, дунд регистрийн кларнетийн хялбар загвар: сондгой гармоник давамгайлсан өнгө, үлээлтээс хамаарах хурц байдал, богино хэлээр эхлэлт. Бодит регистр солигдохгүй.",
        violin: "Нумын даралтаар наалдах–гулсах хөдөлгөөний хурц байдлыг өөрчилж, их биеийн шүүлтүүрээр өнгө оруулсан хийлийн загвар.",
        morin: "Нумдсан чавхдасны ижил зарчимтай боловч гулсах үе, их биеийн өнгө нь өөр морин хуураас санаа авсан загвар.",
        "organ-stopped": "Битүү хоолойт органын 8′ регистр: голдуу сондгой гармоник, зөөлөн эхлэл. Бодит хоолойн хэмжилт биш.",
        "organ-principal": "Нээлттэй Принципал 8′ регистр: хос болон дээд гармоник тод, эхэндээ богино үлээх өнгөтэй.",
        accordion: "Бага зэрэг зөрүүтэй хоёр 8′ хэлт дуугарах мюзет бүртгэл; хөөргийн даралт өнгийг өөрчилнө.",
        bayan: "Чөлөөт хэлний ижил загварын ганц, цэвэр бүртгэл. Мюзетээс бага цохилттой, авсаархан өнгөтэй."
      },
      motionChoose: "Хөдөлгөөнт дуу сонгох",
      theremin: "Теремин", siren: "Галын машины дохио",
      motionDesc: {
        theremin: "Гараа хөдөлгөж давтамж ба дууны хэмжээг өөрчил.",
        siren: "Ижил хоёр давтамжийн хооронд өөр өөр замаар шилжүүлж сонсоорой."
      },
      motionGroupAria: "Хөдөлгөөнт дууны төрөл", thereminHelp: "Талбар дээр дарж хөдөлгөнө: баруун тийш өндөр, дээш чанга дуугарна. Гараа авахад зогсоно.",
      thereminTimbreLabel: "Дууны өнгө", thereminTimbresAria: "Тереминий дууны өнгө сонгох",
      timbrePure: "Цэвэр", timbreRich: "Баян", timbreVoice: "Эгшиг авиа", timbreOvertones: "Дээд гармоник",
      timbreNotes: {
        pure: "Синус долгион зөвхөн үндсэн давтамж f₀-той.",
        rich: "Баян авиа нь f₀, 2f₀, 3f₀… гармоникуудтай.",
        voice: "Нэг үелэх авиа амны хөндийн резонансаар (формант) шүүгдэж эгшиг шиг сонсогдоно. Резонанс нь нотын давтамжийг шууд дагахгүй.",
        overtones: "Нэг эх үүсвэрийн олон гармоникаас нарийн резонансаар нэгийг онцолно. Хөөмийн зарчмыг хялбарчилсан загвар."
      },
      thereminVowelLabel: "Эгшиг сонгох", thereminVowelsAria: "Эгшиг авиа сонгох",
      vowelA: "А", vowelE: "Э", vowelI: "И", vowelO: "О", vowelU: "У",
      thereminVowelHint: "Эгшгийн өнгө нь нотын давтамжтай хамт шилждэггүй амны хөндийн резонансаас үүснэ. 120–350 Гц-д туршаарай.",
      thereminHarmonicLabel: "Онцлох гармоник", thereminOvertoneHint: "Нэг эх үүсвэрийн f₀, 2f₀, 3f₀… гармоникуудаас нэгийг онцолно. Хоёр тусдаа хоолой биш.",
      padLoud: "Чанга ↑", padStart: "Дараад хөдөлгөөрэй", padHigh: "Өндөр авиа →",
      padAria: "Теремин тоглох талбар", thereminKeyboardHelp: "Гарын товчлуураар: сумаар хөдөлгөж, Space/Enter-ээр дууг асааж эсвэл зогсооно. Escape зогсооно.",
      sirenPatternAria: "Давтамжийн замнал", sirenTwoTone: "Огцом", sirenSineSweep: "Аажим",
      sirenPitchSweep: "Шугаман",
      sirenPlay: "Дохио тоглуулах", sirenStop: "Дохио зогсоох", sirenCaption: "Дахин дарж зогсооно",
      sirenLow: "Нам давтамж", sirenHigh: "Өндөр давтамж", sirenRate: "Давтах хурд", sirenRateUnit: "удаа/сек",
      motionReady: "Бэлэн. Талбар дээр дарж эсвэл дохиог тоглуулаарай.", motionStarting: "Дууг эхлүүлж байна…",
      motionPlayingTheremin: "Дуугарч байна. Гараа авах эсвэл Зогсоох дээр дарна уу.",
      motionPlayingSiren: "Дохио дуугарч байна. «Дохио зогсоох» эсвэл улаан «Зогсоох» товчийг дарна уу.",
      motionStopped: "Зогслоо. Өөр давтамж туршаарай.",
      motionHidden: "Хуудсаас гарахад авиа зогслоо.", motionUnsupported: "Энэ хөтөч дуу үүсгэж тоглуулах боломжгүй байна.",
      motionBlocked: "Авиа эхэлсэнгүй. Хөтчийн дууны зөвшөөрлийг шалгаад дахин оролдоно уу.",
      motionSafety: "Ялангуяа чихэвчтэй бол эхэндээ аяархан сонсоорой. Өөр бүлэгт орох эсвэл Зогсоох дээр дарахад дуу зогсоно.",
      motionPitchTitle: "Давтамжийн өөрчлөлт", motionPitchTheremin: "Сүүлийн дөрвөн секундийн давтамжийг ажиглаарай.",
      motionPitchSiren: "Хоёр давтамжийн хооронд огцом шилжинэ: дөрвөлжин замнал.",
      motionPitchSirenPitch: "Хагас тоноор жигд өөрчлөгдөнө. Логарифм графикт шулуун харагдана.",
      motionPitchSirenSine: "Синусоид замналын захад удаан, дунд хэсэгт хурдан өөрчлөгдөнө.",
      motionPitchScale: "Логарифм давтамж · 120–1600 Гц", motionPitchAria: "Хугацаанд өөрчлөгдөх давтамжийн загвар",
      motionDetailTitle: "Энэ мөчийн дохио", motionDetailHint: "Ижил үндсэн давтамжтай өөр өөр өнгийн долгион ба гармоникууд.",
      motionWaveTitle: "20 мсек-ийн долгион", motionComponentTitle: "Гармоникууд",
      motionWaveAria: "Тухайн мөчийн давтамж ба өнгийн 20 мсек долгион", motionComponentAria: "Энэ мөчийн гармоникийн бүрэлдэхүүн",
      motionChallenge: {
        theremin: "Нам нот дээр А ба И эгшгийн өнгийг харьцуулаад нэг дээд гармоник сонго. Өндөр авиа нь тусдаа эх үүсвэр үү?",
        siren: "Хоёр захын давтамж, хурдыг өөрчлөхгүйгээр гурван замналыг сонс. Ямар ялгаа байна вэ?"
      },
      motionLearnMore: "Давтамж өөрчлөгдөхөд яагаад авиа өөр сонсогддог вэ?",
      motionLessonOne: "Баруун тийш шилжихэд нот өндөрсөж, дээш шилжихэд авиа чангарна. Эгшгийн формант нь амны хөндийн резонанс; хөөмийд нэг эх үүсвэрийн дээд гармоникийг нарийн резонансаар онцолж болно.",
      motionLessonTwo: "Ижил хоёр давтамжийг гурван замаар холбож болно. Огцом замналд хоёр авиа шууд солигдоно. Аажим замнал нь синусоид хэлбэрээр өсөж буурч, захын цэгүүддээ удааширна. Шугаман замналд авиа хагас тоноор жигд өөрчлөгдөж, логарифм графикт шулуун харагдана.",
      desc: {
        sine: "Нэг үндсэн давтамжтай жигд хэлбэлзэл.",
        triangle: "Дээд сондгой гармоникууд нь сул.",
        square: "Сондгой гармоникууд нь хүчтэй.",
        sawtooth: "Олон гармониктой, баялаг өнгөтэй."
      },
      insight: {
        sine: "Идеал синус долгион зөвхөн үндсэн давтамжтай.",
        triangle: "Сондгой гармоникууд бий, гэхдээ хурдан суларна.",
        square: "3, 5, 7…-р гармоникууд бий; тэгш дугаартай нь байхгүй.",
        sawtooth: "Бүхэл тоон гармоник бүр бий, хүч нь аажмаар суларна."
      },
      challenge: {
        sine: "Давтамжийг хоёр дахин өсгө. Дууны өнгө болон үе хэрхэн өөрчлөгдөж байна вэ?",
        triangle: "Ижил давтамжтай гурвалжин ба дөрвөлжин долгионыг харьцуул. Алиных нь дээд гармоник сул вэ?",
        square: "Давтамжаа өөрчлөхгүйгээр синусыг дөрвөлжин болго. Авиа өндөр хэвээр үлдэх үү?",
        sawtooth: "Синус ба хөрөө хэлбэрийн спектрийг харьцуул. Хэдэн оргил харагдаж байна вэ?"
      }
    }
  };

  const params = new URLSearchParams(window.location.search);
  const state = {
    language: params.get("lang") === "en" ? "en" : "mn",
    mode: "pure",
    pureKind: "waves",
    composeSubtab: "solo",
    waveform: "sine",
    frequency: 440,
    volume: 40,
    snap: false,
    fixedTime: true,
    playing: false,
    status: "ready",
    error: false,
    strikeKind: "pluck",
    strikePitch: 220,
    strikeSnap: false,
    strikeDrumSize: "medium",
    strikeDrumVoice: "membrane",
      strikeDrumView: "kit",
      strikeDrumKit: "kick",
    strikeHatPedal: 100,
    strikeDrumTension: 1,
    strikeGuitarPlay: "single",
    strikeChord: "em",
    strikeGuitarPattern: "down",
    strikePluckPosition: .22,
    strikePianoVoice: "acoustic",
    strikePitchByVoice: { pluck: 220, acoustic: 220, electric: 220, chimes: 659.255114,
      marimba: 220, xylophone: 523.251131, mandolin: 440, harp: 440 },
    strikePianoTouch: "press",
    strikeMandolinStyle: "pick",
    strikeStrength: 55,
    strikeStrengthByKind: { pluck: 55, kick: 78, piano: 55 },
    strikeDecay: 0.65,
    strikeStatus: "strikeReady",
    strikeError: false,
    strikeViewStart: 0,
    strikeViewSpan: 3,
    strikeCursor: 0,
    strikeSpectrumView: "local",
    strikeFollowing: false,
    sustainKind: "flute",
    sustainAirKind: "flute",
    sustainBowKind: "violin",
    sustainOrganKind: "organ-stopped",
    sustainReedKind: "accordion",
    sustainGesture: "hold",
    sustainPitch: 440,
    sustainSnap: false,
    sustainBreath: sustainModel.DEFAULT_BREATH,
    sustainBowPressure: sustainModel.DEFAULT_BOW_PRESSURE,
    sustainAttack: sustainModel.defaults("flute").attack,
    sustainRelease: sustainModel.defaults("flute").release,
    sustainVolume: 40,
    sustainPlaying: false,
    sustainStatus: "sustainReady",
    sustainError: false,
    motionKind: "theremin",
    motionTimbre: "pure",
    motionVowel: "a",
    motionHarmonic: 6,
    motionX: motionModel.padFraction(440),
    motionY: 0.5,
    motionHz: 440,
    motionLevel: 0.5,
    motionElapsed: 0,
    motionHistory: [],
    motionPlaying: false,
    motionStatus: "motionReady",
    motionError: false,
    sirenPattern: "two-tone",
    sirenLow: 440,
    sirenHigh: 880,
    sirenRate: 0.8,
    sirenVolume: 40,
    mixBase: 440,
    mixGap: 4,
    mixVolume: 40,
    mixWindowStart: 0,
    mixWindowSpan: 1,
    mixPlaying: false,
    mixStatus: "mixReady",
    mixError: false,
    mixKind: "beats",
    tuningKind: "intervals",
    intervalRatio: "3:2",
    intervalBase: 220,
    intervalTuning: "just",
    intervalColor: "rich",
    intervalPattern: "together",
    intervalVolume: 38,
    intervalPlaying: false,
    intervalStatus: "intervalReady",
    intervalError: false,
    earTask: "fifth",
    earHelp: "guided",
    earSound: "rich",
    earPattern: "alternating",
    earAdjustment: 0,
    earChecked: false,
    earVolume: 38,
    earPlaying: false,
    earStarting: false,
    earStatus: "earReady",
    earError: false,
    scaleDown: 0,
    scaleUp: 4,
    scaleTonicK: 0,
    scaleBase: 220,
    scaleVolume: 38,
    scaleMode: "melody",
    scaleShowGap: false,
    scalePlaying: false,
    scaleGapPlaying: false,
    scaleStatus: "scaleReady",
    scaleError: false,
    limit5Coords: limit5Model.PRESETS.major.map(pair => [...pair]),
    limit5Preset: "major",
    limit5Mode: "melody",
    limit5Base: 261.63,
    limit5Volume: 38,
    limit5TetGuides: false,
    limit5ShowRoutes: false,
    limit5Playing: false,
    limit5Starting: false,
    limit5Status: "limit5Ready",
    limit5Error: false,
    limit5Cursor: [0, 0],
    limit5Focus: [0, 0],
    limit5GridFocused: false,
    tempSystem: "adjustable",
    tempTask: "build",
    tempNarrow: tempModel.MEANTONE_NARROWING,
    tempKey: 0,
    tempQuality: "major",
    tempMode: "melody",
    tempVolume: 38,
    tempPlaying: false,
    tempStarting: false,
    tempStatus: "tempReady",
    tempError: false,
    harmonicBase: 220,
    harmonicPartials: harmonicModel.preset("pure"),
    harmonicPreset: "pure",
    harmonicVolume: 35,
    harmonicPlaying: false,
    harmonicStatus: "harmonicReady",
    harmonicError: false,
    noiseColor: "white",
    noiseCutoff: 8000,
    noiseVolume: 25,
    noisePlaying: false,
    noiseStatus: "noiseReady",
    noiseError: false
  };
  const text = key => messages[state.language][key];
  const frequencyText = hz => Number(hz.toFixed(2)).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const hzText = hz => frequencyText(hz) + " " + text("unitHz");
  const kHzText = (hz, oneDecimal = false) =>
    (oneDecimal ? (hz / 1000).toFixed(1) : frequencyText(hz / 1000)) + " " + text("unitKHz");
  const secondsText = seconds => frequencyText(seconds) + " " + text("unitSeconds");
  const secondsFixedText = seconds => seconds.toFixed(2) + " " + text("unitSeconds");
  const millisecondsText = ms => frequencyText(ms) + " " + text("unitMilliseconds");
  // More headroom for small built-in speakers; still bounded below full-scale output.
  // Four simultaneous triggered voices have a total worst-case gain below 1.
  const maxGain = Object.freeze({ tone: 0.30, transient: 0.21, sustain: 0.22, motion: 0.24,
    beatVoice: 0.12, intervalVoice: 0.12, scaleVoice: 0.28, harmonics: 0.24, noise: 0.20 });
  const MIX_MIN_VIEW_SECONDS = 0.002;
  const MIX_MAX_VIEW_SECONDS = 4;
  const MIX_ZOOM_FACTOR = 4;

  class ToneEngine {
    constructor() {
      this.context = null;
      this.output = null;
      this.currentVoice = null;
      this.voices = new Set();
      this.generation = 0;
    }

    gainForVolume() {
      return maxGain.tone * state.volume / 100;
    }

    createVoice() {
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = state.waveform;
      oscillator.frequency.setValueAtTime(state.frequency, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.gainForVolume(), now + 0.035);
      oscillator.connect(gain);
      gain.connect(this.output);
      const voice = { oscillator: oscillator, gain: gain, stopping: false };
      this.voices.add(voice);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
        if (this.currentVoice === voice) this.currentVoice = null;
      };
      oscillator.start(now);
      this.currentVoice = voice;
    }

    fadeAndStop(voice, immediate) {
      if (!this.context || (voice.stopping && !immediate)) return;
      if (voice.stopping && immediate) {
        const now = this.context.currentTime;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(0, now);
        return;
      }
      voice.stopping = true;
      const now = this.context.currentTime;
      const param = voice.gain.gain;
      param.cancelScheduledValues(now);
      if (immediate) param.setValueAtTime(0, now);
      else param.setTargetAtTime(0, now, 0.012);
      try { voice.oscillator.stop(now + (immediate ? 0.001 : 0.09)); }
      catch (_) { /* A voice may already have stopped. */ }
    }

    async readyContext() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("unsupported");
      if (!this.context) {
        this.context = new AudioContextClass();
        this.output = this.context.createGain();
        this.output.connect(this.context.destination);
      }
      await this.context.resume();
      if (this.context.state !== "running") throw new Error("blocked");
      return this.context;
    }

    async start() {
      const ticket = ++this.generation;
      await this.readyContext();
      if (ticket !== this.generation || state.mode !== "pure" || state.pureKind !== "waves") return false;
      this.createVoice();
      return true;
    }

    changeWaveform() {
      if (!this.currentVoice) return;
      const previous = this.currentVoice;
      this.createVoice();
      this.fadeAndStop(previous, false);
    }

    changeFrequency() {
      if (!this.currentVoice) return;
      const now = this.context.currentTime;
      this.currentVoice.oscillator.frequency.setTargetAtTime(state.frequency, now, 0.018);
    }

    changeVolume() {
      if (!this.currentVoice) return;
      const now = this.context.currentTime;
      const param = this.currentVoice.gain.gain;
      param.cancelScheduledValues(now);
      param.setTargetAtTime(this.gainForVolume(), now, 0.012);
    }

    stop(immediate = false) {
      this.generation++;
      for (const voice of this.voices) this.fadeAndStop(voice, immediate);
      this.currentVoice = null;
      if (immediate && this.context && this.context.state === "running") {
        this.context.suspend().catch(() => {});
      }
    }
  }

  class TransientEngine {
    constructor(contextOwner) {
      this.contextOwner = contextOwner;
      this.voices = new Set();
      this.generation = 0;
      // A fresh AudioBufferSourceNode per hit can reuse the same immutable
      // buffer. This avoids regenerating expensive strings for every beat.
      this.bufferCache = new Map();
    }

    stopVoice(voice, immediate) {
      if (voice.stopping) return;
      voice.stopping = true;
      const now = this.contextOwner.context.currentTime;
      const gain = voice.gain.gain;
      gain.cancelScheduledValues(now);
      if (immediate) gain.setValueAtTime(0, now);
      else gain.setTargetAtTime(0, now, 0.012);
      try { voice.source.stop(now + (immediate ? 0.002 : 0.07)); }
      catch (_) { /* This one-shot voice may already have ended. */ }
    }

    stop(immediate = false) {
      this.generation++;
      for (const voice of this.voices) this.stopVoice(voice, immediate);
    }

    setHatPedal(openness) {
      const context = this.contextOwner.context;
      if (!context) return;
      const now = context.currentTime;
      const release = drumModel.hatPedalRelease(openness);
      for (const voice of this.voices) {
        // More-open positions relax or cancel damping, but never restore gain
        // already lost. A fully ended sample cannot be revived.
        if (voice.stopping || voice.hatPosition === null || openness === voice.hatPosition) continue;
        voice.hatPosition = openness;
        const previous = voice.hatTimeConstant;
        const level = previous === null ? voice.hatAmplitude :
          voice.hatAmplitude * Math.exp(-Math.max(0, now - voice.hatChangeAt) / previous);
        const param = voice.gain.gain;
        param.cancelScheduledValues(now);
        param.setValueAtTime(level, now);
        if (release) param.setTargetAtTime(0, now, release.timeConstant);
        voice.hatAmplitude = level;
        voice.hatChangeAt = now;
        voice.hatTimeConstant = release ? release.timeConstant : null;
        const naturalEnd = voice.hatStartAt + voice.source.buffer.duration;
        const stopAt = release ? Math.min(naturalEnd, now + release.seconds) : naturalEnd;
        // SourceNode.stop may be rescheduled until the source has actually
        // ended. Reopening lets a surviving tail decay naturally again.
        if (stopAt < naturalEnd || voice.hatStopAt < naturalEnd) {
          try { voice.source.stop(stopAt); }
          catch (_) { /* The sample may have ended between pedal movements. */ }
        }
        voice.hatStopAt = stopAt;
      }
    }

    async trigger(recipe, strength) {
      const ticket = this.generation;
      const context = await this.contextOwner.readyContext();
      if (ticket !== this.generation || state.mode !== "strike") return false;
      const key = JSON.stringify([context.sampleRate, recipe]);
      let buffer = this.bufferCache.get(key);
      if (buffer) this.bufferCache.delete(key); // Refresh LRU position.
      else {
        const samples = transientModel.makeSamples(
          recipe.kind, recipe.pitchHz, recipe.decaySec, context.sampleRate,
          recipe.kickSize, recipe.options);
        buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.getChannelData(0).set(samples);
      }
      this.bufferCache.set(key, buffer);
      if (this.bufferCache.size > 8) this.bufferCache.delete(this.bufferCache.keys().next().value);
      const source = context.createBufferSource();
      const gain = context.createGain();
      const now = context.currentTime;
      source.buffer = buffer;
      // The acoustic piano samples have much less RMS energy than the FM
      // piano. Correct perceived balance, with a ceiling for overlapping hits.
      const pianoBoost = recipe.kind === "piano" && recipe.options?.pianoVoice !== "electric" ? 2.35 : 1;
      const level = Math.min(.37, maxGain.transient * strength / 100 * pianoBoost);
      gain.gain.setValueAtTime(level, now);
      source.connect(gain);
      gain.connect(this.contextOwner.output);

      // All struck instruments can overlap for rhythms, but the number of
      // simultaneously sounding voices and summed peak gain remain bounded.
      while (this.voices.size >= 4) {
        const oldest = this.voices.values().next().value;
        this.stopVoice(oldest, true);
        this.voices.delete(oldest);
      }
      const hatPosition = Object.hasOwn(drumModel.HAT_PEDAL_POSITIONS, recipe.drumKitId) ?
        drumModel.HAT_PEDAL_POSITIONS[recipe.drumKitId] : null;
      const voice = { source, gain, drumKitId: recipe.drumKitId || null, stopping: false,
        hatPosition, hatAmplitude: level, hatChangeAt: now, hatStartAt: now,
        hatTimeConstant: null, hatStopAt: Infinity };
      this.voices.add(voice);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
      };
      source.start(now);
      if (hatPosition !== null) this.setHatPedal(state.strikeHatPedal / 100);
      return { context, startedAt: now, duration: buffer.length / context.sampleRate };
    }
  }

  // Explore and Compose/offline rendering share one held-instrument graph.
  // This wrapper owns UI cancellation and the bounded overlap of release tails.
  class SustainEngine {
    constructor(contextOwner) {
      this.contextOwner = contextOwner;
      this.voices = new Set();
      this.currentVoice = null;
      this.generation = 0;
    }

    volumeGain() {
      return maxGain.sustain * state.sustainVolume / 100;
    }

    fadeAndStop(voice, immediate, duration = .05) {
      if (immediate) {
        voice.stop();
        this.voices.delete(voice);
      } else voice.release(this.contextOwner.context.currentTime, duration);
    }

    async start() {
      const ticket = ++this.generation;
      const context = await this.contextOwner.readyContext();
      if (ticket !== this.generation || state.mode !== "sustain") return null;
      for (const voice of this.voices) this.fadeAndStop(voice, false);
      while (this.voices.size >= 2) this.fadeAndStop(this.voices.values().next().value, true);
      let voice;
      const voiceModel = i3HeldModel.KINDS.includes(state.sustainKind) ? i3HeldModel : heldVoiceModel;
      voice = voiceModel.createVoice({
        context, output: this.contextOwner.output, model: sustainModel,
        kind: state.sustainKind, hz: state.sustainPitch,
        strength: heldFamily(state.sustainKind) === "bow" ? state.sustainBowPressure : state.sustainBreath,
        attack: state.sustainAttack, release: state.sustainRelease,
        level: this.volumeGain(), at: context.currentTime,
        onended: () => {
          if (!voice) return;
          this.voices.delete(voice);
          if (this.currentVoice === voice) this.currentVoice = null;
        }
      });
      this.voices.add(voice);
      this.currentVoice = voice;
      return { context, startedAt: context.currentTime };
    }

    release() {
      ++this.generation;
      if (!this.currentVoice) return;
      this.currentVoice.release(this.contextOwner.context.currentTime, state.sustainRelease);
      this.currentVoice = null;
    }

    update() {
      if (!this.currentVoice) return;
      this.currentVoice.update({
        hz: state.sustainPitch,
        strength: heldFamily(state.sustainKind) === "bow" ? state.sustainBowPressure : state.sustainBreath,
        level: this.volumeGain()
      });
    }

    stop(immediate = false) {
      ++this.generation;
      for (const voice of this.voices) this.fadeAndStop(voice, immediate);
      this.currentVoice = null;
    }
  }

  class MotionEngine {
    constructor(contextOwner) {
      this.contextOwner = contextOwner;
      this.voices = new Set();
      this.currentVoice = null;
      this.generation = 0;
    }

    fadeAndStop(voice, immediate) {
      if (voice.stopping && !immediate) return;
      const now = this.contextOwner.context.currentTime;
      const gain = voice.gain.gain;
      gain.cancelScheduledValues(now);
      // Reach exactly zero before stopping the oscillator. In particular, do not
      // leave a setTargetAtTime tail on Safari if oscillator.onended is delayed.
      const fade = immediate ? 0.004 : 0.025;
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0, now + fade);
      if (voice.stopping) return;
      voice.stopping = true;
      try { voice.oscillator.stop(now + fade + 0.008); }
      catch (_) { /* An earlier stop may already be scheduled. */ }
    }

    async start() {
      const ticket = ++this.generation;
      const context = await this.contextOwner.readyContext();
      if (ticket !== this.generation || state.mode !== "motion") return false;
      for (const voice of this.voices) this.fadeAndStop(voice, false);
      while (this.voices.size >= 2) {
        const oldest = this.voices.values().next().value;
        this.fadeAndStop(oldest, true);
        this.voices.delete(oldest);
      }
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      if (state.motionKind === "theremin" && state.motionTimbre !== "pure") {
        const partials = motionModel.timbrePartials(state.motionTimbre);
        const real = new Float32Array(partials.length + 1);
        const imag = new Float32Array([0, ...partials]);
        oscillator.setPeriodicWave(context.createPeriodicWave(real, imag));
      }
      oscillator.frequency.setValueAtTime(state.motionHz, now);
      gain.gain.setValueAtTime(0, now);
      const color = state.motionKind === "theremin" ? state.motionTimbre : "pure";
      // Resonant vocal colors can exceed the excitation peak; leave headroom.
      const scale = color === "voice" ? .50 : color === "overtones" ? .48 : 1;
      gain.gain.linearRampToValueAtTime(maxGain.motion * scale * state.motionLevel, now + 0.035);
      const filters = [], formants = [];
      let tail = oscillator;
      const addFilter = (type, frequency, q, db = 0) => {
        const filter = context.createBiquadFilter();
        filter.type = type;
        filter.frequency.setValueAtTime(frequency, now);
        filter.Q.value = q;
        if (type === "peaking") filter.gain.value = db;
        tail.connect(filter);
        tail = filter;
        filters.push(filter);
        return filter;
      };
      let focus = null;
      if (color === "voice") {
        for (const [frequency, q, db] of motionModel.vowelFormants(state.motionVowel)) {
          formants.push(addFilter("peaking", frequency, q, db));
        }
        addFilter("lowpass", 4300, Math.SQRT1_2);
      } else if (color === "overtones") {
        const target = motionModel.overtoneFocus(state.motionHz, state.motionHarmonic);
        focus = addFilter("peaking", target.frequency, target.q, target.gain);
        addFilter("lowpass", 5800, Math.SQRT1_2);
      }
      tail.connect(gain);
      gain.connect(this.contextOwner.output);
      const voice = { oscillator, gain, filters, formants, focus, scale, stopping: false };
      this.voices.add(voice);
      oscillator.onended = () => {
        oscillator.disconnect();
        for (const filter of filters) filter.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
        if (this.currentVoice === voice) this.currentVoice = null;
      };
      oscillator.start(now);
      this.currentVoice = voice;
      return { context, startedAt: now };
    }

    update() {
      if (!this.currentVoice) return;
      const now = this.contextOwner.context.currentTime;
      this.currentVoice.oscillator.frequency.setTargetAtTime(state.motionHz, now, 0.018);
      if (this.currentVoice.formants.length) {
        motionModel.vowelFormants(state.motionVowel).forEach(([frequency, q, db], index) => {
          const filter = this.currentVoice.formants[index];
          filter.frequency.setTargetAtTime(frequency, now, 0.035);
          filter.Q.setTargetAtTime(q, now, 0.035);
          filter.gain.setTargetAtTime(db, now, 0.035);
        });
      }
      if (this.currentVoice.focus) {
        const focus = motionModel.overtoneFocus(state.motionHz, state.motionHarmonic);
        this.currentVoice.focus.frequency.setTargetAtTime(focus.frequency, now, 0.018);
        this.currentVoice.focus.gain.setTargetAtTime(focus.gain, now, 0.035);
      }
      const gain = this.currentVoice.gain.gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(maxGain.motion * this.currentVoice.scale * state.motionLevel, now, 0.012);
    }

    stop(immediate = false) {
      this.generation++;
      for (const voice of this.voices) this.fadeAndStop(voice, immediate);
      this.currentVoice = null;
    }
  }

  class BeatsEngine {
    constructor(contextOwner) {
      this.contextOwner = contextOwner;
      this.voices = new Set();
      this.currentPair = null;
      this.generation = 0;
    }

    gainForVolume() {
      // Two simultaneous oscillators: combined steady-state peak stays at or below 0.24.
      return maxGain.beatVoice * state.mixVolume / 100;
    }

    fadeAndStop(pair, immediate) {
      const now = this.contextOwner.context.currentTime;
      const gain = pair.gain.gain;
      gain.cancelScheduledValues(now);
      if (immediate) gain.setValueAtTime(0, now);
      else gain.setTargetAtTime(0, now, 0.012);
      if (pair.stopping) return;
      pair.stopping = true;
      for (const oscillator of pair.oscillators) {
        try { oscillator.stop(now + (immediate ? 0.002 : 0.09)); }
        catch (_) { /* The oscillator may already have stopped. */ }
      }
    }

    createSyncedPair(context) {
      const now = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.gainForVolume(), now + 0.035);
      gain.connect(this.contextOwner.output);
      const pair = { oscillators: [], gain, stopping: false, ended: 0 };
      for (const hz of beatsModel.frequencies({ baseHz: state.mixBase, gapHz: state.mixGap })) {
        const oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(hz, now);
        oscillator.connect(gain);
        oscillator.onended = () => {
          oscillator.disconnect();
          pair.ended++;
          if (pair.ended === 2) {
            gain.disconnect();
            this.voices.delete(pair);
            if (this.currentPair === pair) this.currentPair = null;
          }
        };
        pair.oscillators.push(oscillator);
      }
      this.voices.add(pair);
      this.currentPair = pair;
      for (const oscillator of pair.oscillators) oscillator.start(now);
    }

    async start() {
      const ticket = ++this.generation;
      const context = await this.contextOwner.readyContext();
      if (ticket !== this.generation || state.mode !== "mix") return false;
      for (const pair of this.voices) this.fadeAndStop(pair, false);
      this.createSyncedPair(context);
      return true;
    }

    resyncAtZeroGap() {
      if (!this.currentPair) return;
      // Oscillators retain their relative phase after a pitch change. If the
      // gap reaches zero, that phase could freeze at near-perfect cancellation.
      // Start an aligned pair so 0 Hz difference always means a steady tone.
      const oldPair = this.currentPair;
      const context = this.contextOwner.context;
      this.createSyncedPair(context);
      const now = context.currentTime;
      const gain = oldPair.gain.gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(0, now, 0.006);
      oldPair.stopping = true;
      for (const oscillator of oldPair.oscillators) {
        try { oscillator.stop(now + 0.07); }
        catch (_) { /* The old pair may already have ended. */ }
      }
    }

    update() {
      if (!this.currentPair) return;
      const now = this.contextOwner.context.currentTime;
      const frequencies = beatsModel.frequencies({ baseHz: state.mixBase, gapHz: state.mixGap });
      this.currentPair.oscillators.forEach((oscillator, index) => {
        oscillator.frequency.setTargetAtTime(frequencies[index], now, 0.018);
      });
      const gain = this.currentPair.gain.gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(this.gainForVolume(), now, 0.012);
    }

    stop(immediate = false) {
      this.generation++;
      for (const pair of this.voices) this.fadeAndStop(pair, immediate);
      this.currentPair = null;
    }
  }

  class IntervalEngine {
    constructor(contextOwner) {
      this.contextOwner = contextOwner;
      this.voices = new Set();
      this.currentPair = null;
      this.generation = 0;
      this.patternTimer = null;
    }

    gainForVolume() {
      // Each modeled waveform has absolute amplitude at most 1; both together
      // therefore stay at or below 0.24 even at the maximum volume setting.
      return maxGain.intervalVoice * state.intervalVolume / 100;
    }

    active() { return state.mode === "tuning" && state.tuningKind === "intervals"; }

    frequencies() {
      const { baseHz, highHz } = intervalModel.analyze(intervalRecipe());
      return [baseHz, highHz];
    }

    color() { return state.intervalColor; }

    fadeAndStop(pair, immediate = false) {
      const now = this.contextOwner.context.currentTime;
      const gain = pair.gain.gain;
      gain.cancelScheduledValues(now);
      if (immediate) gain.setValueAtTime(0, now);
      else gain.setTargetAtTime(0, now, 0.012);
      if (pair.stopping) return;
      pair.stopping = true;
      for (const oscillator of pair.oscillators) {
        try { oscillator.stop(now + (immediate ? 0.002 : 0.09)); }
        catch (_) { /* The oscillator might have been stopped already. */ }
      }
    }

    createPair(context) {
      const now = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.gainForVolume(), now + 0.035);
      gain.connect(this.contextOwner.output);
      const pair = { gain, oscillators: [], noteGains: [], ended: 0, stopping: false };
      const { real, imag } = intervalModel.coefficients("rich");
      const wave = this.color() === "rich" ?
        context.createPeriodicWave(real, imag, { disableNormalization: true }) : null;
      for (const hz of this.frequencies()) {
        const oscillator = context.createOscillator();
        const noteGain = context.createGain();
        noteGain.gain.setValueAtTime(0, now);
        if (wave) oscillator.setPeriodicWave(wave);
        else oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(hz, now);
        oscillator.connect(noteGain);
        noteGain.connect(gain);
        oscillator.onended = () => {
          oscillator.disconnect();
          pair.ended++;
          if (pair.ended === pair.oscillators.length) {
            pair.noteGains.forEach(node => node.disconnect());
            gain.disconnect();
            this.voices.delete(pair);
            if (this.currentPair === pair) this.currentPair = null;
          }
        };
        pair.noteGains.push(noteGain);
        pair.oscillators.push(oscillator);
      }
      this.currentPair = pair;
      this.voices.add(pair);
      pair.oscillators.forEach(oscillator => oscillator.start(now));
      this.startPattern(pair);
    }

    pulsePattern(pair) {
      if (this.currentPair !== pair || !this.active() || state.intervalPattern !== "alternating") return;
      const now = this.contextOwner.context.currentTime + .012;
      pair.noteGains.forEach((node, index) => {
        const start = now + index * .78;
        const param = node.gain;
        param.cancelScheduledValues(now);
        param.setValueAtTime(0, now);
        param.setValueAtTime(0, start);
        param.linearRampToValueAtTime(1, start + .025);
        param.setValueAtTime(1, start + .64);
        param.linearRampToValueAtTime(0, start + .70);
      });
    }

    startPattern(pair) {
      if (this.patternTimer !== null) window.clearInterval(this.patternTimer);
      this.patternTimer = null;
      if (state.intervalPattern === "alternating") {
        this.pulsePattern(pair);
        this.patternTimer = window.setInterval(() => this.pulsePattern(pair), 1600);
      } else {
        const now = this.contextOwner.context.currentTime;
        pair.noteGains.forEach(node => node.gain.setValueAtTime(1, now));
      }
    }

    async start() {
      const ticket = ++this.generation;
      const context = await this.contextOwner.readyContext();
      if (ticket !== this.generation || !this.active()) return false;
      for (const pair of this.voices) this.fadeAndStop(pair);
      this.createPair(context);
      return true;
    }

    update() {
      if (!this.currentPair) return;
      const now = this.contextOwner.context.currentTime;
      const frequencies = this.frequencies();
      this.currentPair.oscillators.forEach((oscillator, index) => {
        oscillator.frequency.setTargetAtTime(frequencies[index], now, 0.018);
      });
      const gain = this.currentPair.gain.gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(this.gainForVolume(), now, 0.012);
    }

    changeColor() {
      if (!this.currentPair) return;
      const previous = this.currentPair;
      this.createPair(this.contextOwner.context);
      this.fadeAndStop(previous);
      while (this.voices.size > 3) {
        const oldest = this.voices.values().next().value;
        this.fadeAndStop(oldest, true);
        this.voices.delete(oldest);
      }
    }

    stop(immediate = false) {
      this.generation++;
      if (this.patternTimer !== null) window.clearInterval(this.patternTimer);
      this.patternTimer = null;
      for (const pair of this.voices) this.fadeAndStop(pair, immediate);
      this.currentPair = null;
    }
  }

  class EarEngine {
    constructor(contextOwner) {
      this.contextOwner = contextOwner;
      this.generation = 0;
      this.voices = [];
      this.master = null;
      this.timer = null;
    }

    active() { return state.mode === "tuning" && state.tuningKind === "ear"; }
    gainForVolume() { return maxGain.intervalVoice * state.earVolume / 100; }

    createVoice(context, frequency, recipe, master) {
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.connect(master);
      const oscillators = recipe.map(part => {
        const oscillator = context.createOscillator();
        const weight = context.createGain();
        weight.gain.setValueAtTime(part.amplitude, context.currentTime);
        oscillator.frequency.setValueAtTime(frequency * part.multiplier, context.currentTime);
        oscillator.connect(weight);
        weight.connect(gain);
        oscillator.start();
        return { oscillator, weight, multiplier: part.multiplier };
      });
      return { gain, oscillators };
    }

    pulse() {
      if (!this.master || !this.active()) return;
      const now = this.contextOwner.context.currentTime + .012;
      const struck = state.earSound === "guitar" || state.earSound === "piano";
      const sequential = state.earPattern === "alternating";
      const duration = sequential ? .60 : 1.30;
      this.voices.forEach((voice, index) => {
        const start = now + (sequential ? index * .75 : 0);
        const gain = voice.gain.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0, start);
        gain.linearRampToValueAtTime(1, start + (struck ? .008 : .03));
        if (struck) {
          gain.setTargetAtTime(0, start + .008, state.earSound === "guitar" ? .19 : .28);
          gain.linearRampToValueAtTime(0, start + duration);
        } else {
          gain.setValueAtTime(1, start + duration - .045);
          gain.linearRampToValueAtTime(0, start + duration);
        }
      });
    }

    async start() {
      const ticket = ++this.generation;
      const context = await this.contextOwner.readyContext();
      if (ticket !== this.generation || !this.active()) return false;
      this.stop(false);
      const master = context.createGain();
      master.gain.setValueAtTime(this.gainForVolume(), context.currentTime);
      master.connect(this.contextOwner.output);
      this.master = master;
      const { referenceHz, tunedHz } = earStep();
      const recipe = earModel.partials(state.earSound);
      this.voices = [referenceHz, tunedHz].map(hz => this.createVoice(context, hz, recipe, master));
      this.pulse();
      this.timer = window.setInterval(() => this.pulse(), 1700);
      return true;
    }

    update() {
      if (!this.master) return;
      const now = this.contextOwner.context.currentTime;
      const data = earStep();
      [data.referenceHz, data.tunedHz].forEach((hz, index) => {
        this.voices[index].oscillators.forEach(part => {
          part.oscillator.frequency.setTargetAtTime(hz * part.multiplier, now, .018);
        });
      });
      this.master.gain.setTargetAtTime(this.gainForVolume(), now, .012);
    }

    stop(immediate = false) {
      this.generation++;
      if (this.timer !== null) window.clearInterval(this.timer);
      this.timer = null;
      if (!this.master) return;
      const now = this.contextOwner.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      if (immediate) this.master.gain.setValueAtTime(0, now);
      else this.master.gain.setTargetAtTime(0, now, .012);
      const oldMaster = this.master;
      let remainingVoices = this.voices.length;
      for (const voice of this.voices) {
        voice.gain.gain.cancelScheduledValues(now);
        if (immediate) voice.gain.gain.setValueAtTime(0, now);
        else voice.gain.gain.setTargetAtTime(0, now, .012);
        let remainingPartials = voice.oscillators.length;
        for (const part of voice.oscillators) {
          part.oscillator.onended = () => {
            part.oscillator.disconnect(); part.weight.disconnect();
            if (--remainingPartials === 0) {
              voice.gain.disconnect();
              if (--remainingVoices === 0) oldMaster.disconnect();
            }
          };
          try { part.oscillator.stop(now + (immediate ? .002 : .08)); }
          catch (_) { /* Already stopped. */ }
        }
      }
      this.voices = [];
      this.master = null;
    }
  }

  class ScaleEngine {
    constructor(contextOwner) {
      this.contextOwner = contextOwner;
      this.generation = 0;
      this.voices = new Set();
      this.currentVoice = null;
    }

    fadeAndStop(voice, immediate = false) {
      const now = this.contextOwner.context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      if (immediate) voice.gain.gain.setValueAtTime(0, now);
      else voice.gain.gain.setTargetAtTime(0, now, .012);
      if (voice.stopping) return;
      voice.stopping = true;
      try { voice.source.stop(now + (immediate ? .002 : .07)); }
      catch (_) { /* The buffer may already have finished. */ }
    }

    async startSampled(scale, comparison = false, mode = "melody") {
      const ticket = ++this.generation;
      const context = await this.contextOwner.readyContext();
      if (ticket !== this.generation || state.mode !== "tuning" || state.tuningKind !== "scales") return false;
      for (const voice of this.voices) this.fadeAndStop(voice, true);
      const samples = comparison ? scaleModel.makeGapSamples(scale, context.sampleRate) :
        mode === "chord" ? scaleModel.makeChordSamples(scale, context.sampleRate) :
          scaleModel.makeSamples(scale, context.sampleRate);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.getChannelData(0).set(samples);
      const source = context.createBufferSource();
      const gain = context.createGain();
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(maxGain.scaleVoice * state.scaleVolume / 100, now + .016);
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.contextOwner.output);
      const voice = { source, gain, stopping: false, startedAt: now,
        steps: comparison || mode === "chord" ? [] : scaleModel.melodySteps(scale) };
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
        if (this.currentVoice === voice) {
          this.currentVoice = null;
          if (comparison) {
            state.scaleGapPlaying = false;
            setScaleStatus("scaleGapDone");
          } else {
            state.scalePlaying = false;
            stopScaleTracking();
            setScaleStatus("scaleStopped");
          }
          renderScaleControls();
        }
      };
      this.voices.add(voice);
      this.currentVoice = voice;
      source.start(now);
      return true;
    }

    async start(scale, mode = "melody") { return this.startSampled(scale, false, mode); }
    async startGap(scale) { return this.startSampled(scale, true); }

    updateVolume() {
      if (!this.currentVoice) return;
      const now = this.contextOwner.context.currentTime;
      const gain = this.currentVoice.gain.gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(maxGain.scaleVoice * state.scaleVolume / 100, now, .015);
    }

    stop(immediate = false) {
      this.generation++;
      this.currentVoice = null;
      for (const voice of this.voices) this.fadeAndStop(voice, immediate);
    }
  }

  class Limit5Engine {
    constructor(contextOwner) {
      this.contextOwner = contextOwner;
      this.generation = 0;
      this.voices = new Set();
      this.currentVoice = null;
    }
    fadeAndStop(voice, immediate = false) {
      const now = this.contextOwner.context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      if (immediate) voice.gain.gain.setValueAtTime(0, now);
      else voice.gain.gain.setTargetAtTime(0, now, .012);
      if (voice.stopping) return;
      voice.stopping = true;
      try { voice.source.stop(now + (immediate ? .002 : .08)); }
      catch (_) { /* The source may already have ended. */ }
    }
    async start(notes, mode) {
      const ticket = ++this.generation;
      const context = await this.contextOwner.readyContext();
      if (ticket !== this.generation || state.mode !== "tuning" || state.tuningKind !== "limit5") return false;
      for (const voice of this.voices) this.fadeAndStop(voice, true);
      const samples = limit5Model.makeSamples(notes, context.sampleRate, mode);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.getChannelData(0).set(samples);
      const source = context.createBufferSource();
      const gain = context.createGain();
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(maxGain.scaleVoice * state.limit5Volume / 100, now + .02);
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.contextOwner.output);
      const voice = { source, gain, notes, mode, startedAt: now, stopping: false };
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
        if (this.currentVoice === voice) {
          this.currentVoice = null;
          state.limit5Playing = false;
          state.limit5Starting = false;
          stopLimit5Tracking();
          setLimit5Status("limit5Stopped");
          renderLimit5Controls();
        }
      };
      this.voices.add(voice);
      this.currentVoice = voice;
      source.start(now);
      return true;
    }
    updateVolume() {
      if (!this.currentVoice) return;
      const now = this.contextOwner.context.currentTime;
      this.currentVoice.gain.gain.cancelScheduledValues(now);
      this.currentVoice.gain.gain.setTargetAtTime(maxGain.scaleVoice * state.limit5Volume / 100, now, .015);
    }
    stop(immediate = false) {
      this.generation++;
      this.currentVoice = null;
      for (const voice of this.voices) this.fadeAndStop(voice, immediate);
    }
  }

  // Buffered notes share the 5-limit lab's gentle harmonic tone envelope.
  // Only the fundamental frequencies come from the selected temperament.
  class TemperamentEngine extends Limit5Engine {
    async start(notes, mode) {
      const ticket = ++this.generation;
      const context = await this.contextOwner.readyContext();
      if (ticket !== this.generation || state.mode !== "tuning" || state.tuningKind !== "temperaments") return false;
      for (const voice of this.voices) this.fadeAndStop(voice, true);
      // Temperament comparisons require harmonic 3 of the lower fifth and
      // harmonic 5 of the lower third, absent from the old two-partial voice.
      const samples = tempModel.makeSamples(notes, context.sampleRate, mode);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.getChannelData(0).set(samples);
      const source = context.createBufferSource();
      const gain = context.createGain();
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(maxGain.scaleVoice * state.tempVolume / 100, now + .02);
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.contextOwner.output);
      const voice = { source, gain, stopping: false };
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
        if (this.currentVoice === voice) {
          this.currentVoice = null;
          state.tempPlaying = false;
          setTempStatus("tempStopped");
          renderTempControls();
        }
      };
      this.voices.add(voice);
      this.currentVoice = voice;
      source.start(now);
      return true;
    }
    updateVolume() {
      if (!this.currentVoice) return;
      const now = this.contextOwner.context.currentTime;
      const gain = this.currentVoice.gain.gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(maxGain.scaleVoice * state.tempVolume / 100, now, .015);
    }
  }

  class HarmonicEngine {
    constructor(contextOwner) {
      this.contextOwner = contextOwner;
      this.voices = new Set();
      this.currentVoice = null;
      this.generation = 0;
    }

    gainForVolume() { return maxGain.harmonics * state.harmonicVolume / 100; }

    fadeAndStop(voice, immediate = false) {
      const now = this.contextOwner.context.currentTime;
      const gain = voice.gain.gain;
      gain.cancelScheduledValues(now);
      if (immediate) gain.setValueAtTime(0, now);
      else gain.setTargetAtTime(0, now, 0.012);
      if (voice.stopping) return;
      voice.stopping = true;
      try { voice.oscillator.stop(now + (immediate ? 0.002 : 0.09)); }
      catch (_) { /* A replaced sound might already be ending. */ }
    }

    createVoice(context) {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const coefficients = harmonicModel.periodicCoefficients(state.harmonicPartials);
      oscillator.setPeriodicWave(context.createPeriodicWave(coefficients.real, coefficients.imag));
      oscillator.frequency.setValueAtTime(state.harmonicBase, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.gainForVolume(), now + 0.035);
      oscillator.connect(gain);
      gain.connect(this.contextOwner.output);
      const voice = { oscillator, gain, stopping: false };
      this.voices.add(voice);
      this.currentVoice = voice;
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
        if (this.currentVoice === voice) this.currentVoice = null;
      };
      oscillator.start(now);
    }

    async start() {
      const ticket = ++this.generation;
      const context = await this.contextOwner.readyContext();
      if (ticket !== this.generation || state.mode !== "pure" || state.pureKind !== "harmonics") return false;
      this.createVoice(context);
      return true;
    }

    changeMixture() {
      if (!this.currentVoice) return;
      const previous = this.currentVoice;
      this.createVoice(this.contextOwner.context);
      this.fadeAndStop(previous);
      while (this.voices.size > 3) {
        const oldest = this.voices.values().next().value;
        this.fadeAndStop(oldest, true);
        this.voices.delete(oldest);
      }
    }

    update() {
      if (!this.currentVoice) return;
      const now = this.contextOwner.context.currentTime;
      this.currentVoice.oscillator.frequency.setTargetAtTime(state.harmonicBase, now, 0.018);
      const gain = this.currentVoice.gain.gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(this.gainForVolume(), now, 0.012);
    }

    stop(immediate = false) {
      this.generation++;
      for (const voice of this.voices) this.fadeAndStop(voice, immediate);
      this.currentVoice = null;
    }
  }

  class NoiseEngine {
    constructor(contextOwner) {
      this.contextOwner = contextOwner;
      this.voices = new Set();
      this.currentVoice = null;
      this.generation = 0;
      this.buffers = new Map();
    }

    gainForVolume() { return maxGain.noise * state.noiseVolume / 100; }

    getBuffer(context) {
      const key = state.noiseColor + ":" + context.sampleRate;
      if (this.buffers.has(key)) return this.buffers.get(key);
      const samples = noiseModel.makeSamples(state.noiseColor, context.sampleRate, 2);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.getChannelData(0).set(samples);
      this.buffers.set(key, buffer);
      return buffer;
    }

    fadeAndStop(voice, immediate = false) {
      const now = this.contextOwner.context.currentTime;
      const gain = voice.gain.gain;
      gain.cancelScheduledValues(now);
      if (immediate) gain.setValueAtTime(0, now);
      else gain.setTargetAtTime(0, now, 0.012);
      if (voice.stopping) return;
      voice.stopping = true;
      try { voice.source.stop(now + (immediate ? 0.002 : 0.09)); }
      catch (_) { /* A replaced buffer might already be ending. */ }
    }

    createVoice(context) {
      const now = context.currentTime;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = this.getBuffer(context);
      source.loop = true;
      filter.type = "lowpass";
      filter.Q.setValueAtTime(Math.SQRT1_2, now);
      filter.frequency.setValueAtTime(state.noiseCutoff, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.gainForVolume(), now + 0.035);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.contextOwner.output);
      const voice = { source, filter, gain, stopping: false };
      this.voices.add(voice);
      this.currentVoice = voice;
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
        if (this.currentVoice === voice) this.currentVoice = null;
      };
      source.start(now);
    }

    async start() {
      const ticket = ++this.generation;
      const context = await this.contextOwner.readyContext();
      if (ticket !== this.generation || state.mode !== "mix" || state.mixKind !== "noise") return false;
      this.createVoice(context);
      return true;
    }

    changeColor() {
      if (!this.currentVoice) return;
      const previous = this.currentVoice;
      this.createVoice(this.contextOwner.context);
      this.fadeAndStop(previous);
      while (this.voices.size > 3) {
        const oldest = this.voices.values().next().value;
        this.fadeAndStop(oldest, true);
        this.voices.delete(oldest);
      }
    }

    update() {
      if (!this.currentVoice) return;
      const now = this.contextOwner.context.currentTime;
      this.currentVoice.filter.frequency.setTargetAtTime(state.noiseCutoff, now, 0.025);
      const gain = this.currentVoice.gain.gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(this.gainForVolume(), now, 0.012);
    }

    stop(immediate = false) {
      this.generation++;
      for (const voice of this.voices) this.fadeAndStop(voice, immediate);
      this.currentVoice = null;
    }
  }

  const audio = new ToneEngine();
  const transientAudio = new TransientEngine(audio);
  const sustainAudio = new SustainEngine(audio);
  const motionAudio = new MotionEngine(audio);
  const mixAudio = new BeatsEngine(audio);
  const intervalAudio = new IntervalEngine(audio);
  const earAudio = new EarEngine(audio);
  let earDrawFrame = null;
  let earPlaybackRequest = 0;
  const scaleAudio = new ScaleEngine(audio);
  let scaleFrame = null;
  let scaleActive = null;
  const limit5Audio = new Limit5Engine(audio);
  let limit5Frame = null;
  let limit5Active = null;
  let limit5PlaybackRequest = 0;
  const tempAudio = new TemperamentEngine(audio);
  let tempPlaybackRequest = 0;
  const harmonicAudio = new HarmonicEngine(audio);
  const noiseAudio = new NoiseEngine(audio);
  const recorder = new recorderModel.Recorder(audio, window.AudioWorkletNode);
  const compose = composeModel ? new composeModel.Controller({ document, contextOwner: audio,
    transientModel, sustainModel, temperamentModel: tempModel }) : null;
  const ensemble = ensembleModel ? new ensembleModel.Controller({ document, contextOwner: audio,
    transientModel, sustainModel, temperamentModel: tempModel }) : null;
  const projectFiles = projectUI && compose && ensemble ? new projectUI.Controller({ document,
    getCurrentMode: () => state.composeSubtab,
    capture: mode => (mode === "solo" ? compose : ensemble).captureProject(),
    isDraft: mode => (mode === "solo" ? compose : ensemble).isProjectDraft(),
    restore: project => {
      stopAllAudio(true);
      selectMode("compose");
      selectComposeSubtab(project.mode);
      (project.mode === "solo" ? compose : ensemble).restoreProject(project.content);
      renderTexts();
    }
  }) : null;
  const wavExport = exportUI && exportModel && compose && ensemble ? new exportUI.Controller({ document,
    capture: () => {
      const mode = state.composeSubtab;
      return { mode, content: (mode === "solo" ? compose : ensemble).captureProject() };
    },
    getTitle: () => $("projectName").value,
    render: snapshot => exportModel.render(snapshot, { transientModel, sustainModel,
      temperamentModel: tempModel,
      OfflineAudioContext: window.OfflineAudioContext || window.webkitOfflineAudioContext }),
    onAnalyze: (blob, name) => {
      selectMode("analysis");
      switchAnalysisScreen("spectrum");
      return analysis?.openPrepared(blob, name);
    }
  }) : null;
  const analysis = analysisModel ? new analysisModel.Controller({ document, window,
    contextOwner: audio, transientModel, sustainModel, temperamentModel: tempModel,
    OfflineAudioContext: window.OfflineAudioContext || window.webkitOfflineAudioContext }) : null;
  let analysisScreen = "normal";
  const compare = compareModel ? new compareModel.Controller({ document, window, contextOwner: audio,
    transientModel, sustainModel, temperamentModel: tempModel,
    OfflineAudioContext: window.OfflineAudioContext || window.webkitOfflineAudioContext,
    getAnalysis: () => ({ pcm: analysis?.pcm, source: analysis?.source }),
    onMic: key => microphone?.openView(key) }) : null;
  const microphone = microphoneModel ? new microphoneModel.Controller({ document, window,
    onBegin: () => { analysis?.stopPlayback?.(true); compare?.stopPlayback?.(); },
    onStop: () => { analysis?.draw?.(); compare?.draw?.(); },
    onViewChange: () => updateAnalysisScreens(),
    onCapture: (blob, name, source, destination) =>
      ["A", "B"].includes(destination) ? compare?.openPrepared(destination, blob, name, source) :
        analysis?.openPrepared(blob, name, source) }) : null;

  function updateAnalysisScreens() {
    const active = state.mode === "analysis", micOpen = Boolean(microphone?.open);
    $("analysisWorkspace").hidden = !active || micOpen || analysisScreen === "compare";
    $("analysisCompareWorkspace").hidden = !active || micOpen || analysisScreen !== "compare";
    $("analysisMicWorkspace").hidden = !active || !micOpen;
    const isCompare = analysisScreen === "compare";
    for (const [id, selected] of [
      ["analysisKindSingle", !isCompare], ["analysisKindCompare", isCompare],
      ["compareKindSingle", !isCompare], ["compareKindCompare", isCompare]
    ]) {
      $(id).classList.toggle("selected", Boolean(selected));
      $(id).setAttribute("aria-pressed", String(Boolean(selected)));
    }
  }
  function switchAnalysisScreen(view) {
    if (view === "compare") {
      analysis?.stopPlayback?.(true);
      analysisScreen = "compare";
      if (state.mode === "analysis") compare?.setActive(true);
    } else {
      analysisScreen = "normal";
      compare?.setActive(false);
      if (["spectrum", "spectrogram"].includes(view)) analysis?.setView?.(view);
    }
    updateAnalysisScreens();
    if (analysisScreen === "compare") compare?.draw();
    else analysis?.draw();
  }
  let recordStatusKey = "recordReady";
  let recordError = false;
  let recordUrl = null;
  let recordPreparedBlob = null;
  let showRecordResult = false;
  let saveWhenDone = false;
  let recordFrame = null;

  function stopRecordFrame() {
    if (recordFrame !== null) window.cancelAnimationFrame(recordFrame);
    recordFrame = null;
  }

  function renderRecordControls() {
    const active = recorder.state === "recording";
    const busy = recorder.state === "starting" || recorder.state === "stopping";
    const button = $("recordButton");
    button.disabled = busy;
    button.classList.toggle("recording", active);
    button.setAttribute("aria-pressed", String(active));
    const action = text(active ? "recordStopAria" : "recordStartAria")
      .replace("{seconds}", recorderModel.MAX_SECONDS);
    button.setAttribute("aria-label", action);
    button.title = action;
    $("recordSymbol").textContent = active ? "⬇" : "●";
    $("recordButtonLabel").textContent = text(active ? "recordStop" : "recordStart");
    $("recordTimer").hidden = !active;
    $("recordTimer").textContent = recorder.elapsed.toFixed(1) + "/" + recorderModel.MAX_SECONDS;
    $("recordStatus").textContent = text(recordStatusKey);
    $("recordStatus").classList.toggle("error", recordError);
    $("recordStatus").classList.toggle("sr-only", !recordError);
    $("recordResult").hidden = !showRecordResult;
  }

  function followRecording() {
    if (recorder.state !== "recording") return;
    renderRecordControls();
    recordFrame = window.requestAnimationFrame(followRecording);
  }

  function stopRecording(save = false) {
    if (recorder.state === "recording") saveWhenDone = save;
    if (!recorder.stop()) return;
    stopRecordFrame();
    recordStatusKey = recorder.state === "stopping" ? "recordSaving" : "recordReady";
    renderRecordControls();
  }

  recorder.onDone = (bytes, duration) => {
    stopRecordFrame();
    const download = saveWhenDone || duration >= recorderModel.MAX_SECONDS - 0.05;
    saveWhenDone = false;
    if (bytes && bytes.length > 44) {
      if (recordUrl) URL.revokeObjectURL(recordUrl);
      recordPreparedBlob = new Blob([bytes], { type: "audio/wav" });
      recordUrl = URL.createObjectURL(recordPreparedBlob);
      $("recordPreview").src = recordUrl;
      $("recordDownload").href = recordUrl;
      $("recordDownload").download = "sound-lab-" +
        new Date().toISOString().slice(0, 19).replace(/:/g, "-") + ".wav";
      recordStatusKey = "recordSaved";
      showRecordResult = true;
    } else {
      recordPreparedBlob = null;
      recordStatusKey = "recordEmpty";
      showRecordResult = false;
    }
    recordError = false;
    renderRecordControls();
    // The action is the child's Stop/Save press. The visible link remains as a fallback
    // when a browser blocks a download begun after the worklet's async finalization.
    if (download && bytes && bytes.length > 44) $("recordDownload").click();
  };
  recorder.onError = () => {
    stopRecordFrame();
    saveWhenDone = false;
    recordStatusKey = "recordError";
    recordError = true;
    showRecordResult = false;
    renderRecordControls();
  };

  async function toggleRecording() {
    if (recorder.state === "recording") { stopRecording(true); return; }
    if (recorder.state !== "idle") return;
    showRecordResult = false;
    recordPreparedBlob = null;
    saveWhenDone = false;
    recordStatusKey = "recordPreparing";
    recordError = false;
    renderRecordControls();
    try {
      const started = await recorder.start();
      if (!started) { recordStatusKey = "recordReady"; renderRecordControls(); return; }
      $("recordPreview").pause();
      recordStatusKey = "recordRecording";
      renderRecordControls();
      followRecording();
    } catch (error) {
      recordStatusKey = error.message === "unsupported" ? "recordUnsupported" : "recordError";
      recordError = true;
      renderRecordControls();
    }
  }

  let motionFrame = null;
  let motionStarting = false;
  let motionStartGeneration = 0;
  let motionStartedAt = 0;
  let motionLastDraw = -1;
  let motionPointerId = null;
  let sustainPointerId = null;
  let sustainKeyboardHeld = false;
  let sustainIgnoreHoldClick = false;
  let followFrame = null;
  let followInfo = null;
  let strikeTicket = 0;
  let overallSpectrumCache = null;
  let lastAnimatedSpectrumTime = -1;
  let lastAnimatedWaveTime = -1;

  function isPianoStrike() {
    return state.strikeKind === "piano" && ["acoustic", "electric"].includes(state.strikePianoVoice);
  }

  function isMandolinStrike() {
    return state.strikeKind === "piano" && state.strikePianoVoice === "mandolin";
  }

  function strikePitchKey() {
    return state.strikeKind === "piano" ? state.strikePianoVoice : "pluck";
  }

  function strikeMaxPitch() {
    if (isMandolinStrike()) return window.SoundLabMandolin.MAX_HZ;
    if (state.strikeKind === "piano" && state.strikePianoVoice === "harp") return window.SoundLabHarp.MAX_HZ;
    if (state.strikeKind === "piano" && state.strikePianoVoice === "xylophone") {
      return window.SoundLabXylophone.MAX_HZ;
    }
    return state.strikeKind === "piano" && state.strikePianoVoice === "marimba" ? 1760 : 880;
  }

  function strikeMinPitch() {
    if (isMandolinStrike()) return window.SoundLabMandolin.MIN_HZ;
    if (state.strikeKind === "piano" && state.strikePianoVoice === "harp") return window.SoundLabHarp.MIN_HZ;
    return state.strikeKind === "piano" && state.strikePianoVoice === "xylophone" ?
      window.SoundLabXylophone.MIN_HZ : 110;
  }

  function restoreStrikePitch() {
    const key = strikePitchKey();
    const stored = state.strikePitchByVoice[key];
    state.strikePitch = state.strikeSnap ?
      Math.max(strikeMinPitch(), Math.min(strikeMaxPitch(), model.snapFrequency(stored))) : stored;
    state.strikePitchByVoice[key] = state.strikePitch;
  }

  function pitchedStrikeDecay() {
    if (isMandolinStrike()) return window.SoundLabMandolin.DEFAULT_DECAY;
    if (state.strikePianoVoice === "harp") return window.SoundLabHarp.DEFAULT_DECAY;
    return { acoustic: .8, electric: .8, chimes: .7, marimba: .65, xylophone: .32,
    }[state.strikePianoVoice];
  }

  function activeStrikeDrumRecipe() {
    return state.strikeDrumView === "kit" ? window.SoundLabScorePlayer.DRUM_RECIPES[state.strikeDrumKit] :
      { voice: state.strikeDrumVoice, size: state.strikeDrumSize };
  }

  function strikeRecipe() {
    const pitchedChimes = state.strikeKind === "piano" && state.strikePianoVoice === "chimes";
    const marimba = state.strikeKind === "piano" && state.strikePianoVoice === "marimba";
    const xylophone = state.strikeKind === "piano" && state.strikePianoVoice === "xylophone";
    const mandolin = isMandolinStrike();
    const harp = state.strikeKind === "piano" && state.strikePianoVoice === "harp";
    const drum = state.strikeKind === "kick" ? activeStrikeDrumRecipe() : null;
    return { kind: pitchedChimes ? "kick" : marimba ? "marimba" : xylophone ? "xylophone" : mandolin ? "mandolin" : harp ? "harp" :
      state.strikeKind, pitchHz: state.strikePitch,
      decaySec: state.strikeDecay, kickSize: drum?.size || state.strikeDrumSize,
      ...(drum && state.strikeDrumView === "kit" ? { drumKitId: state.strikeDrumKit } : {}),
      options: {
        position: state.strikePluckPosition,
        drumVoice: pitchedChimes ? "chimes" : drum?.voice || state.strikeDrumVoice,
        drumTension: drum ? 1 : state.strikeDrumTension,
        ...(pitchedChimes ? { chimeHz: state.strikePitch } : {}),
        ...(marimba || xylophone || mandolin || harp ? { velocity: state.strikeStrength / 100 } : {}),
        ...(drum ? { velocity: Math.round(state.strikeStrength / 20) / 5 } : {}),
        ...(mandolin ? { articulation: state.strikeMandolinStyle } : {}),
        ...(isPianoStrike() ?
          { velocity: state.strikeStrength / 100, touch: state.strikePianoTouch,
            pianoVoice: state.strikePianoVoice } : {}),
        ...(state.strikeKind === "pluck" && state.strikeGuitarPlay === "strum" ?
          { strumChord: state.strikeChord, strumPattern: state.strikeGuitarPattern } : {})
      } };
  }

  function strikeDrumSpectrumMaxHz() {
    const drum = activeStrikeDrumRecipe(), voice = drum.voice;
    if (["snare", "rimshot"].includes(voice)) return 5200;
    if (["cymbal", "halfhat", "ride", "crash"].includes(voice)) return 6000;
    if (voice === "steelpan") return 4000;
    if (voice === "chimes") return 8000;
    if (voice === "woodblock") return 5000;
    if (voice === "tom") return 2500;
    return Math.max(600, transientModel.kickFrequency(0,
      drum.size, state.strikeDrumView === "kit" ? 1 : state.strikeDrumTension) * 4);
  }

  function strikeSpectrumMaxHz() {
    if (state.strikeKind === "piano") {
      if (state.strikePianoVoice === "chimes") return 8000;
      if (state.strikePianoVoice === "marimba") return Math.min(8000, Math.max(3000, state.strikePitch * 10.5));
      if (state.strikePianoVoice === "xylophone") return Math.min(8000, Math.max(3000, state.strikePitch * 6.5));
      if (state.strikePianoVoice === "mandolin") return Math.min(8000, Math.max(2500, state.strikePitch * 12));
      if (state.strikePianoVoice === "harp") return Math.min(8000, Math.max(2100, state.strikePitch * 9));
      return Math.min(8000, Math.max(3000, state.strikePitch * 8.5));
    }
    if (state.strikeKind === "pluck") return state.strikeGuitarPlay === "strum" ? 4000 :
      Math.min(8000, Math.max(1200, state.strikePitch * 8.3));
    return strikeDrumSpectrumMaxHz();
  }

  function stopStrikeFollow() {
    if (followFrame !== null) window.cancelAnimationFrame(followFrame);
    followFrame = null;
    followInfo = null;
    state.strikeFollowing = false;
  }

  function stopStrikeForEdit() {
    strikeTicket++;
    transientAudio.stop(false);
    stopStrikeFollow();
    overallSpectrumCache = null;
    setStrikeStatus("strikeReady");
  }

  function keepStrikeCursorVisible() {
    if (state.strikeViewSpan >= 3) return;
    const right = state.strikeViewStart + state.strikeViewSpan;
    if (state.strikeCursor < state.strikeViewStart || state.strikeCursor > right) {
      state.strikeViewStart = Math.max(0, Math.min(3 - state.strikeViewSpan,
        state.strikeCursor - state.strikeViewSpan * 0.5));
    }
  }

  function strikeTimeText(time) {
    return time < 0.1 ? millisecondsText(time * 1000) : secondsText(time);
  }

  function renderStrikeTime() {
    $("strikeTimeSlider").value = String(Math.round(state.strikeCursor * 1000));
    $("strikeTimeValue").textContent = "t = " + secondsFixedText(state.strikeCursor);
    $("strikeSpectrumBadge").textContent = state.strikeSpectrumView === "local" ?
      "t = " + secondsFixedText(state.strikeCursor) : text("strikeSpectrumWhole");
    const voiceHints = { snare: "strikeSnareSpectrumHint", cymbal: "strikeCymbalSpectrumHint",
      steelpan: "strikePanSpectrumHint", chimes: "strikeChimesSpectrumHint",
      woodblock: "strikeWoodSpectrumHint" };
    const hint = state.strikeKind === "kick" ? voiceHints[activeStrikeDrumRecipe().voice] :
      state.strikeKind === "piano" && state.strikePianoVoice === "chimes" ? "strikeChimesSpectrumHint" :
      state.strikeKind === "piano" && state.strikePianoVoice === "marimba" ? "strikeMarimbaSpectrumHint" :
      state.strikeKind === "piano" && state.strikePianoVoice === "xylophone" ? "strikeXylophoneSpectrumHint" :
      isMandolinStrike() ? "strikeMandolinSpectrumHint" :
        state.strikePianoVoice === "harp" ? "strikeHarpSpectrumHint" : null;
    $("strikeSpectrumHint").textContent = text(state.strikeSpectrumView === "local" ?
      hint || "strikeSpectrumHint" : "strikeSpectrumWholeHint");
  }

  function setStrikeView(span, center = state.strikeCursor) {
    state.strikeViewSpan = Math.max(0.01, Math.min(3, span));
    state.strikeViewStart = Math.max(0, Math.min(3 - state.strikeViewSpan,
      center - state.strikeViewSpan / 2));
    drawStrikeWave();
  }

  function panStrikeView(direction) {
    state.strikeViewStart = Math.max(0, Math.min(3 - state.strikeViewSpan,
      state.strikeViewStart + direction * state.strikeViewSpan / 2));
    drawStrikeWave();
  }

  function startStrikeFollow(info) {
    stopStrikeFollow();
    followInfo = info;
    state.strikeFollowing = true;
    state.strikeCursor = 0;
    lastAnimatedSpectrumTime = -1;
    lastAnimatedWaveTime = -1;
    renderStrikeTime();
    drawStrikeWave();
    drawStrikeSpectrum();
    const advance = () => {
      if (!state.strikeFollowing || !followInfo || state.mode !== "strike") return;
      const elapsed = Math.max(0, info.context.currentTime - info.startedAt);
      state.strikeCursor = Math.min(3, info.duration, elapsed);
      if (state.strikeViewSpan < 3 && state.strikeCursor >
          state.strikeViewStart + state.strikeViewSpan * 0.82) {
        state.strikeViewStart = Math.max(0, Math.min(3 - state.strikeViewSpan,
          state.strikeCursor - state.strikeViewSpan * 0.65));
      }
      renderStrikeTime();
      if (elapsed - lastAnimatedWaveTime >= 0.04) {
        drawStrikeWave();
        lastAnimatedWaveTime = elapsed;
      }
      if (elapsed - lastAnimatedSpectrumTime >= 0.045) {
        drawStrikeSpectrum();
        lastAnimatedSpectrumTime = elapsed;
      }
      if (elapsed >= info.duration) {
        stopStrikeFollow();
        drawStrikeWave();
        drawStrikeSpectrum();
      } else followFrame = window.requestAnimationFrame(advance);
    };
    followFrame = window.requestAnimationFrame(advance);
  }

  function setStatus(status, error = false) {
    state.status = status;
    state.error = error;
    $("audioStatus").textContent = text(status);
    $("audioStatus").classList.toggle("error", error);
  }

  function setStrikeStatus(status, error = false) {
    state.strikeStatus = status;
    state.strikeError = error;
    $("strikeStatus").textContent = text(status);
    $("strikeStatus").classList.toggle("error", error);
  }

  function setSustainStatus(status, error = false) {
    state.sustainStatus = status;
    state.sustainError = error;
    $("sustainStatus").textContent = text(status);
    $("sustainStatus").classList.toggle("error", error);
  }

  function setMotionStatus(status, error = false) {
    state.motionStatus = status;
    state.motionError = error;
    $("motionStatus").textContent = text(status);
    $("motionStatus").classList.toggle("error", error);
  }

  function setMixStatus(status, error = false) {
    state.mixStatus = status;
    state.mixError = error;
    $("mixStatus").textContent = text(status);
    $("mixStatus").classList.toggle("error", error);
  }

  function setIntervalStatus(status, error = false) {
    state.intervalStatus = status;
    state.intervalError = error;
    $("intervalStatus").textContent = text(status);
    $("intervalStatus").classList.toggle("error", error);
  }

  function setScaleStatus(status, error = false) {
    state.scaleStatus = status;
    state.scaleError = error;
    $("scaleStatus").textContent = text(status);
    $("scaleStatus").classList.toggle("error", error);
  }

  function setLimit5Status(status, error = false) {
    state.limit5Status = status;
    state.limit5Error = error;
    $("limit5Status").textContent = text(status);
    $("limit5Status").classList.toggle("error", error);
  }

  function setTempStatus(status, error = false) {
    state.tempStatus = status;
    state.tempError = error;
    $("tempStatus").textContent = text(status);
    $("tempStatus").classList.toggle("error", error);
  }

  function setHarmonicStatus(status, error = false) {
    state.harmonicStatus = status;
    state.harmonicError = error;
    $("harmonicStatus").textContent = text(status);
    $("harmonicStatus").classList.toggle("error", error);
  }

  function setNoiseStatus(status, error = false) {
    state.noiseStatus = status;
    state.noiseError = error;
    $("noiseStatus").textContent = text(status);
    $("noiseStatus").classList.toggle("error", error);
  }

  function renderHarmonicControls() {
    $("harmonicBaseSlider").value = String(state.harmonicBase);
    $("harmonicBaseInput").value = String(state.harmonicBase);
    const note = model.nearestNote(state.harmonicBase);
    $("harmonicNote").textContent = note.english + " · " + note.mongolian;
    $("harmonicWaveBadge").textContent = "f = " + hzText(state.harmonicBase);
    $("harmonicSpectrumBadge").textContent = harmonicModel.COUNT + " × f";
    $("harmonicVolume").value = String(state.harmonicVolume);
    $("harmonicVolumeValue").textContent = state.harmonicVolume + "%";
    for (let i = 0; i < harmonicModel.COUNT; i++) {
      const strength = Math.round(state.harmonicPartials[i] * 100);
      $("harmonicLevel" + (i + 1)).value = String(strength);
      $("harmonicLevelValue" + (i + 1)).textContent = strength + "%";
    }
    document.querySelectorAll("[data-harmonic-preset]").forEach(button => {
      const selected = state.harmonicPreset === button.dataset.harmonicPreset;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $("harmonicButton").classList.toggle("playing", state.harmonicPlaying);
    $("harmonicButton").setAttribute("aria-pressed", String(state.harmonicPlaying));
    $("harmonicPlayIcon").textContent = state.harmonicPlaying ? "■" : "▶";
    $("harmonicPlayLabel").textContent = text(state.harmonicPlaying ? "harmonicStop" : "harmonicPlay");
    $("harmonicPlayCaption").textContent = text(state.harmonicPlaying ? "stopCaption" : "playCaption");
  }

  function renderNoiseControls() {
    document.querySelectorAll("[data-noise-color]").forEach(button => {
      const selected = state.noiseColor === button.dataset.noiseColor;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $("noiseColorDescription").textContent = text("noiseColorDescription")[state.noiseColor];
    $("noiseSpectrumBadge").textContent = text("noise" + state.noiseColor[0].toUpperCase() + state.noiseColor.slice(1));
    $("noiseWaveBadge").textContent = millisecondsText(40);
    $("noiseCutoff").value = String(state.noiseCutoff);
    $("noiseCutoffValue").textContent = hzText(state.noiseCutoff);
    $("noiseVolume").value = String(state.noiseVolume);
    $("noiseVolumeValue").textContent = state.noiseVolume + "%";
    $("noiseButton").classList.toggle("playing", state.noisePlaying);
    $("noiseButton").setAttribute("aria-pressed", String(state.noisePlaying));
    $("noisePlayIcon").textContent = state.noisePlaying ? "■" : "▶";
    $("noisePlayLabel").textContent = text(state.noisePlaying ? "noiseStop" : "noisePlay");
    $("noisePlayCaption").textContent = text(state.noisePlaying ? "stopCaption" : "playCaption");
  }

  function stopHarmonicSound(immediate = false, message = "harmonicStopped") {
    harmonicAudio.stop(immediate);
    state.harmonicPlaying = false;
    setHarmonicStatus(message);
    renderHarmonicControls();
  }

  function stopNoiseSound(immediate = false, message = "noiseStopped") {
    noiseAudio.stop(immediate);
    state.noisePlaying = false;
    setNoiseStatus(message);
    renderNoiseControls();
  }

  async function toggleHarmonicSound() {
    if (state.harmonicPlaying) { stopHarmonicSound(); return; }
    if (state.mode !== "pure" || state.pureKind !== "harmonics") return;
    setHarmonicStatus("harmonicStarting");
    const generation = harmonicAudio.generation + 1;
    try {
      if (await harmonicAudio.start()) {
        state.harmonicPlaying = true;
        setHarmonicStatus("harmonicPlaying");
        renderHarmonicControls();
      }
    } catch (error) {
      if (generation !== harmonicAudio.generation || state.mode !== "pure" || state.pureKind !== "harmonics") return;
      stopHarmonicSound(true, error.message === "unsupported" ? "harmonicUnsupported" : "harmonicBlocked");
      setHarmonicStatus(state.harmonicStatus, true);
    }
  }

  async function toggleNoiseSound() {
    if (state.noisePlaying) { stopNoiseSound(); return; }
    if (state.mode !== "mix" || state.mixKind !== "noise") return;
    setNoiseStatus("noiseStarting");
    try {
      if (await noiseAudio.start()) {
        state.noisePlaying = true;
        setNoiseStatus("noisePlaying");
        renderNoiseControls();
      }
    } catch (error) {
      stopNoiseSound(true, error.message === "unsupported" ? "noiseUnsupported" : "noiseBlocked");
      setNoiseStatus(state.noiseStatus, true);
    }
  }

  function setHarmonicBase(input) {
    const hz = Number(input);
    if (!Number.isFinite(hz) || hz < harmonicModel.MIN_HZ || hz > harmonicModel.MAX_HZ) {
      setHarmonicStatus("harmonicInvalid", true);
      renderHarmonicControls();
      return;
    }
    state.harmonicBase = hz;
    if (state.harmonicError) setHarmonicStatus(state.harmonicPlaying ? "harmonicPlaying" : "harmonicReady");
    harmonicAudio.update();
    renderHarmonicControls();
    if (state.mode === "pure" && state.pureKind === "harmonics") drawHarmonicPlots();
  }

  function setHarmonicPreset(name) {
    if (!Object.hasOwn(harmonicModel.PRESETS, name)) return;
    state.harmonicPartials = harmonicModel.preset(name);
    state.harmonicPreset = name;
    harmonicAudio.changeMixture();
    renderHarmonicControls();
    if (state.mode === "pure" && state.pureKind === "harmonics") drawHarmonicPlots();
  }

  function setHarmonicLevel(number, percent) {
    const index = Number(number) - 1;
    const level = Number(percent);
    if (!Number.isInteger(index) || index < 0 || index >= harmonicModel.COUNT || !Number.isFinite(level)) return;
    state.harmonicPartials[index] = Math.max(index === 0 ? 0.1 : 0, Math.min(1, level / 100));
    state.harmonicPreset = "custom";
    harmonicAudio.changeMixture();
    renderHarmonicControls();
    if (state.mode === "pure" && state.pureKind === "harmonics") drawHarmonicPlots();
  }

  function resetHarmonics() {
    stopHarmonicSound();
    state.harmonicBase = 220;
    state.harmonicPartials = harmonicModel.preset("pure");
    state.harmonicPreset = "pure";
    state.harmonicVolume = 35;
    setHarmonicStatus("harmonicReady");
    renderHarmonicControls();
    drawPlots();
  }

  function resetNoise() {
    stopNoiseSound();
    state.noiseColor = "white";
    state.noiseCutoff = 8000;
    state.noiseVolume = 25;
    setNoiseStatus("noiseReady");
    renderNoiseControls();
    drawPlots();
  }

  function intervalRecipe() {
    return { ratio: state.intervalRatio, baseHz: state.intervalBase, tuning: state.intervalTuning };
  }

  function intervalAnalysis() { return intervalModel.analyze(intervalRecipe()); }

  function intervalPhrase(key, replacements) {
    return Object.entries(replacements).reduce((message, [name, value]) =>
      message.replaceAll("{" + name + "}", String(value)), text(key));
  }

  function renderIntervalControls() {
    const data = intervalAnalysis();
    $("intervalBaseSlider").value = String(state.intervalBase);
    $("intervalBaseInput").value = String(state.intervalBase);
    $("intervalBaseInput").setAttribute("aria-valuetext", hzText(state.intervalBase));
    $("intervalBaseValue").textContent = hzText(state.intervalBase);
    $("intervalName").textContent = text("intervalNames")[state.intervalRatio] + " · " + state.intervalRatio;
    $("intervalNotesValue").textContent = frequencyText(data.baseHz) + " + " + hzText(data.highHz);
    $("intervalRatioValue").textContent = state.intervalTuning === "just" ?
      state.intervalRatio + " = " + frequencyText(data.actualRatio) :
      "12-TET ≈ " + data.actualRatio.toFixed(5);
    $("intervalPeriodLabel").textContent = text(data.exactOverlap ? "intervalPeriod" : "intervalReferencePeriod");
    $("intervalPeriodValue").textContent = millisecondsText(data.referencePeriod * 1000);
    $("intervalOverlapValue").textContent = data.p + "f₁ " + (data.exactOverlap ? "= " : "≈ ") +
      data.q + "f₂" + (data.exactOverlap ? " = " + hzText(data.sharedLowHz) : "");
    $("intervalWaveBadge").textContent = "T* = " + millisecondsText(data.referencePeriod * 1000);
    $("intervalSpectrumBadge").textContent = data.p + "f₁ ↔ " + data.q + "f₂";
    const cents = (data.cents > 0 ? "+" : "") + data.cents.toFixed(3);
    $("intervalCents").textContent = data.exactOverlap ? text("intervalJustStatus") :
      intervalPhrase("intervalEqualStatus", { cents, hz: hzText(data.discrepancyHz) });
    $("intervalVolume").value = String(state.intervalVolume);
    $("intervalVolumeValue").textContent = state.intervalVolume + "%";
    $("intervalRatioSelect").value = state.intervalRatio;
    document.querySelectorAll("#intervalRatioSelect option").forEach(option => {
      option.textContent = text("intervalNames")[option.value] + " · " + option.value;
    });
    document.querySelectorAll("[data-interval-play]").forEach(button => {
      const active = state.intervalPlaying && button.dataset.intervalPlay === state.intervalPattern;
      button.classList.toggle("playing", active);
      button.setAttribute("aria-pressed", String(active));
      button.textContent = (active ? "■ " : "▶ ") + text(button.dataset.intervalPlay === "alternating" ?
        "earAlternating" : "earTogether");
    });
    for (const [selector, attribute, active] of [
      ["[data-interval-tuning]", "intervalTuning", state.intervalTuning],
      ["[data-interval-color]", "intervalColor", state.intervalColor]
    ]) {
      document.querySelectorAll(selector).forEach(button => {
        const selected = button.dataset[attribute] === active;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }
  }

  function stopIntervalSound(immediate = false, message = "intervalStopped") {
    intervalAudio.stop(immediate);
    state.intervalPlaying = false;
    setIntervalStatus(message);
    renderIntervalControls();
  }

  async function toggleIntervalSound(mode) {
    if (!["alternating", "together"].includes(mode)) return;
    if (state.intervalPlaying && state.intervalPattern === mode) { stopIntervalSound(); return; }
    if (state.mode !== "tuning" || state.tuningKind !== "intervals") return;
    stopIntervalSound(true, "intervalReady");
    state.intervalPattern = mode;
    setIntervalStatus("intervalStarting");
    try {
      if (await intervalAudio.start()) {
        state.intervalPlaying = true;
        setIntervalStatus("intervalPlaying");
        renderIntervalControls();
      }
    } catch (error) {
      stopIntervalSound(true, error.message === "unsupported" ? "intervalUnsupported" : "intervalBlocked");
      setIntervalStatus(state.intervalStatus, true);
    }
  }

  function setIntervalBase(input) {
    const value = Number(input);
    if (!Number.isFinite(value) || value < intervalModel.MIN_BASE_HZ || value > intervalModel.MAX_BASE_HZ) {
      setIntervalStatus("intervalInvalid", true);
      renderIntervalControls();
      return;
    }
    state.intervalBase = value;
    if (state.intervalError) setIntervalStatus(state.intervalPlaying ? "intervalPlaying" : "intervalReady");
    intervalAudio.update();
    renderIntervalControls();
    if (state.mode === "tuning" && state.tuningKind === "intervals") drawIntervalPlots();
  }

  function selectIntervalRatio(ratio) {
    if (!intervalModel.PRESETS.some(preset => preset.ratio === ratio) || state.intervalRatio === ratio) return;
    state.intervalRatio = ratio;
    intervalAudio.update();
    renderIntervalControls();
    if (state.mode === "tuning" && state.tuningKind === "intervals") drawIntervalPlots();
  }

  function selectIntervalTuning(tuning) {
    if (!["just", "equal"].includes(tuning) || state.intervalTuning === tuning) return;
    state.intervalTuning = tuning;
    intervalAudio.update();
    renderIntervalControls();
    if (state.mode === "tuning" && state.tuningKind === "intervals") drawIntervalPlots();
  }

  function selectIntervalColor(color) {
    if (!["pure", "rich"].includes(color) || state.intervalColor === color) return;
    state.intervalColor = color;
    intervalAudio.changeColor();
    renderIntervalControls();
    if (state.mode === "tuning" && state.tuningKind === "intervals") drawIntervalPlots();
  }

  function resetInterval() {
    stopIntervalSound();
    state.intervalRatio = "3:2";
    state.intervalBase = 220;
    state.intervalTuning = "just";
    state.intervalColor = "rich";
    state.intervalPattern = "together";
    state.intervalVolume = 38;
    setIntervalStatus("intervalReady");
    renderIntervalControls();
    drawPlots();
  }

  function earStep() {
    return earModel.step({ taskId: state.earTask, adjustment: state.earAdjustment });
  }

  function earName(note, octave = "") {
    const names = state.language === "mn" ? { C: "До", G: "Соль", D: "Ре", A: "Ля", E: "Ми", F: "Фа" } :
      { C: "C", G: "G", D: "D", A: "A", E: "E", F: "F" };
    return names[note] + octave;
  }

  function earPhrase(key, values = {}) { return intervalPhrase(key, values); }

  function earSigned(value) { return (value > 0 ? "+" : "") + value.toFixed(2); }

  function queueEarDraw() {
    if (earDrawFrame !== null) return;
    earDrawFrame = window.requestAnimationFrame(() => {
      earDrawFrame = null;
      if (state.mode === "tuning" && state.tuningKind === "ear") drawEarPlots();
    });
  }

  function setEarStatus(status, error = false) {
    state.earStatus = status;
    state.earError = error;
    $("earStatus").textContent = text(status);
    $("earStatus").classList.toggle("error", error);
  }

  function renderEarControls() {
    const data = earStep();
    $("earTaskSelect").value = state.earTask;
    $("earInstruction").textContent = earPhrase("earInstruction", {
      from: earName("C", "4"), to: earName(data.note, data.octave), ratio: data.p + ":" + data.q
    });
    $("earAdjust").value = String(state.earAdjustment);
    $("earAdjustLabel").textContent = text("earSliderLabel");
    $("earVolume").value = String(state.earVolume);
    $("earVolumeValue").textContent = state.earVolume + "%";
    document.querySelectorAll("[data-ear-play]").forEach(button => {
      const active = (state.earPlaying || state.earStarting) && button.dataset.earPlay === state.earPattern;
      button.classList.toggle("playing", active);
      button.setAttribute("aria-pressed", String(active));
      button.textContent = (active ? "■ " : "▶ ") + text(button.dataset.earPlay === "alternating" ? "earAlternating" : "earTogether");
    });
    for (const [selector, key, active] of [
      ["[data-ear-help]", "earHelp", state.earHelp], ["[data-ear-sound]", "earSound", state.earSound]
    ]) {
      document.querySelectorAll(selector).forEach(button => {
        const selected = button.dataset[key] === active;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }
    const result = $("earResult");
    result.hidden = !state.earChecked;
    $("earOctavePanel").hidden = !state.earChecked || !data.shifts;
    result.classList.toggle("good", state.earChecked && earModel.rating(data.errorCents) === "excellent");
    if (state.earChecked) {
      const rating = text({ excellent: "earCheckExcellent", close: "earCheckClose", retry: "earCheckRetry" }[
        earModel.rating(data.errorCents)]);
      const check = earPhrase("earCheckResult", { rating, error: earSigned(data.errorCents),
        beats: frequencyText(data.nearBeatHz), target: frequencyText(data.targetHz),
        actual: frequencyText(data.tunedHz) });
      const fold = data.shifts ? earPhrase("earFoldFact", {
        operation: data.shifts > 0 ? "× 2" : "÷ 2",
        from: frequencyText(data.tunedHz), to: frequencyText(data.foldedHz),
        note: earName(data.note, data.octave + data.shifts)
      }) : text("earNoFold");
      result.textContent = check + "\n" + fold;
    }
    $("earHarmonicsBadge").textContent = state.earHelp === "blind" ? "♪" :
      earModel.partials(state.earSound).length + " f";
  }

  function stopEarSound(immediate = false, message = "earStopped") {
    earPlaybackRequest++;
    earAudio.stop(immediate);
    state.earPlaying = false;
    state.earStarting = false;
    setEarStatus(message);
    renderEarControls();
  }

  async function toggleEarPlayback(pattern) {
    if (!earModel.PATTERNS.includes(pattern) || state.mode !== "tuning" || state.tuningKind !== "ear") return;
    if ((state.earPlaying || state.earStarting) && state.earPattern === pattern) {
      stopEarSound();
      return;
    }
    // A new choice replaces the old playback, even if AudioContext.resume() is pending.
    const request = ++earPlaybackRequest;
    earAudio.stop(true);
    state.earPlaying = false;
    state.earStarting = true;
    state.earPattern = pattern;
    setEarStatus("earStarting");
    renderEarControls();
    try {
      const started = await earAudio.start();
      if (request !== earPlaybackRequest) return;
      state.earStarting = false;
      if (started) {
        state.earPlaying = true;
        setEarStatus("earPlaying");
      } else {
        setEarStatus("earReady");
      }
      renderEarControls();
    } catch (_) {
      if (request !== earPlaybackRequest) return;
      stopEarSound(true, "earBlocked");
      setEarStatus("earBlocked", true);
    }
  }

  function selectEarTask(task) {
    if (!earModel.TASKS[task]) return;
    stopEarSound();
    state.earTask = task;
    state.earAdjustment = 0;
    state.earChecked = false;
    setEarStatus("earReady");
    renderEarControls();
    drawPlots();
  }

  function setEarAdjustment(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    state.earAdjustment = Math.max(-60, Math.min(60, number));
    state.earChecked = false;
    earAudio.update();
    renderEarControls();
    queueEarDraw();
  }

  function checkEar() {
    state.earChecked = true;
    renderEarControls();
    drawPlots();
  }

  function selectEarSound(sound) {
    if (!earModel.SOUNDS.includes(sound) || state.earSound === sound) return;
    stopEarSound();
    state.earSound = sound;
    setEarStatus("earReady");
    renderEarControls();
    drawPlots();
  }

  function resetEar() {
    selectEarTask("fifth");
    state.earHelp = "guided";
    state.earSound = "rich";
    state.earPattern = "alternating";
    state.earVolume = 38;
    renderEarControls();
    drawPlots();
  }

  function scaleAnalysis() {
    return scaleModel.build({ down: state.scaleDown, up: state.scaleUp,
      tonicK: state.scaleTonicK, baseHz: state.scaleBase });
  }

  function renderScaleControls() {
    const scale = scaleAnalysis();
    $("scaleBaseSlider").value = String(state.scaleBase);
    $("scaleBaseInput").value = String(state.scaleBase);
    $("scaleBaseInput").setAttribute("aria-valuetext", hzText(state.scaleBase));
    $("scaleBaseValue").textContent = hzText(state.scaleBase);
    $("scaleVolume").value = String(state.scaleVolume);
    $("scaleVolumeValue").textContent = state.scaleVolume + "%";
    $("scaleCountValue").textContent = scale.count + " " + text("scaleNotesUnit");
    $("scaleSpiralBadge").textContent = $("scaleCountValue").textContent;
    const range = "−" + scale.down + " … +" + scale.up;
    $("scaleRangeValue").textContent = range;
    $("scaleFourierBadge").textContent = range;
    $("scaleTonicValue").textContent = hzText(scale.tonicHz);
    $("scaleClosureValue").textContent = (scale.closureCents < 0 ? "−" : "+") +
      Math.abs(scale.closureCents).toFixed(2) + " " + (state.language === "mn" ? "цент" : "cents");
    $("scaleGapsValue").textContent = scale.gaps.map(gap => Math.round(gap)).join(" · ") +
      " " + (state.language === "mn" ? "цент" : "cents");
    $("scaleOctaveValue").textContent = scale.count + " · " + scale.octaveCount;
    $("scaleGapToggle").checked = state.scaleShowGap;
    $("scaleClosureFact").hidden = !state.scaleShowGap;
    $("scaleGapInfo").hidden = !state.scaleShowGap;
    $("scaleGapPanel").hidden = !state.scaleShowGap;
    if (state.scaleShowGap) {
      const gap = scaleModel.returnGap(scale);
      const signed = (value, decimals) => (value < 0 ? "−" : "+") + Math.abs(value).toFixed(decimals);
      const cents = signed(gap.signedCents, 2);
      const angle = signed(gap.angleDegrees, 2);
      $("scaleGapInfo").textContent = intervalPhrase("scaleGapInfo", {
        count: scale.count, direction: text(gap.direction < 0 ? "scaleGapDirectionDown" : "scaleGapDirectionUp"),
        ghost: (gap.ghostK > 0 ? "+" : "") + gap.ghostK,
        octaves: gap.octaveCount, cents, angle
      });
      $("scaleGapSummary").textContent = intervalPhrase("scaleGapSummary", {
        name: text(gap.isPythagoreanComma ? "scaleGapPythagorean" : "scaleGapOther"),
        cents, angle, beats: Math.abs(gap.toHz - gap.fromHz).toFixed(2)
      });
    }
    $("scaleGapButton").textContent = text(state.scaleGapPlaying ? "scaleGapStop" : "scaleGapPlay");
    $("scaleGapButton").classList.toggle("playing", state.scaleGapPlaying);
    $("scaleGapButton").setAttribute("aria-pressed", String(state.scaleGapPlaying));
    renderScaleNow();
    document.querySelectorAll("[data-scale-play]").forEach(button => {
      const active = state.scalePlaying && state.scaleMode === button.dataset.scalePlay;
      button.classList.toggle("playing", active);
      button.setAttribute("aria-pressed", String(active));
      button.textContent = (active ? "■ " : "▶ ") + text(button.dataset.scalePlay === "melody" ?
        "earAlternating" : "earTogether");
    });
    $("scaleRemoveDown").disabled = state.scaleDown === 0;
    $("scaleRemoveUp").disabled = state.scaleUp === 0;
    $("scaleAddDown").disabled = scale.count >= scaleModel.MAX_NOTES || state.scaleDown >= 11;
    $("scaleAddUp").disabled = scale.count >= scaleModel.MAX_NOTES || state.scaleUp >= 11;
    const preset = scaleModel.PRESETS.find(p => p.down === state.scaleDown && p.up === state.scaleUp);
    $("scalePresetSelect").value = preset ? preset.id : "custom";
    document.querySelectorAll("[data-scale-tonic]").forEach(button => {
      const index = Number(button.dataset.scaleTonic);
      const note = scale.notes[index];
      button.hidden = !note;
      if (!note) return;
      button.textContent = (index + 1) + " · " + note.numerator + "/" + note.denominator;
      button.setAttribute("title", hzText(note.hz) + " · k=" + note.k);
      const selected = note.k === scale.tonicK;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function renderScaleNow() {
    const current = scaleActive;
    const label = $("scaleNowValue");
    if (state.scalePlaying && current) {
      const note = scaleAnalysis().chain.find(item => item.k === current.k);
      label.textContent = intervalPhrase("scaleNowPlaying", {
        step: (current.k > 0 ? "+" : "") + current.k,
        ratio: note.numerator + "/" + note.denominator,
        octave: current.octaveUp ? text("scaleNowUpperOctave") : ""
      });
    } else label.textContent = state.scalePlaying && state.scaleMode === "chord" ?
      text("scaleChordPlaying") : text("scaleNowIdle");
    label.classList.toggle("active", state.scalePlaying && Boolean(current));
  }

  function stopScaleTracking() {
    if (scaleFrame !== null) window.cancelAnimationFrame(scaleFrame);
    scaleFrame = null;
    scaleActive = null;
    renderScaleNow();
    if (state.mode === "tuning" && state.tuningKind === "scales") drawScalePlots();
  }

  function followScalePlayback() {
    scaleFrame = null;
    const voice = scaleAudio.currentVoice;
    if (!state.scalePlaying || !voice || state.mode !== "tuning" || state.tuningKind !== "scales") return;
    const elapsed = Math.max(0, audio.context.currentTime - voice.startedAt);
    const index = Math.floor(elapsed / scaleModel.STEP_SECONDS);
    const current = elapsed - index * scaleModel.STEP_SECONDS < scaleModel.NOTE_SECONDS ?
      voice.steps[index] || null : null;
    if (current !== scaleActive) {
      scaleActive = current;
      renderScaleNow();
      drawScalePlots();
    }
    if (index < voice.steps.length) scaleFrame = window.requestAnimationFrame(followScalePlayback);
  }

  function stopScaleSound(immediate = false, message = "scaleStopped") {
    scaleAudio.stop(immediate);
    state.scalePlaying = false;
    state.scaleGapPlaying = false;
    stopScaleTracking();
    setScaleStatus(message);
    renderScaleControls();
  }

  async function toggleScaleSound(mode) {
    if (!["melody", "chord"].includes(mode)) return;
    if (state.scalePlaying && state.scaleMode === mode) { stopScaleSound(); return; }
    if (state.mode !== "tuning" || state.tuningKind !== "scales") return;
    stopScaleSound(true, "scaleReady");
    state.scaleMode = mode;
    setScaleStatus("scaleStarting");
    try {
      if (await scaleAudio.start(scaleAnalysis(), mode)) {
        state.scalePlaying = true;
        setScaleStatus(mode === "chord" ? "scaleChordPlaying" : "scalePlaying");
        renderScaleControls();
        if (mode === "melody") followScalePlayback();
      }
    } catch (error) {
      stopScaleSound(true, error.message === "unsupported" ? "scaleUnsupported" : "scaleBlocked");
      setScaleStatus(state.scaleStatus, true);
    }
  }

  async function toggleScaleGapSound() {
    if (state.scaleGapPlaying) { stopScaleSound(); return; }
    if (!state.scaleShowGap || state.mode !== "tuning" || state.tuningKind !== "scales") return;
    if (state.scalePlaying) stopScaleSound(true, "scaleReady");
    setScaleStatus("scaleStarting");
    try {
      if (await scaleAudio.startGap(scaleAnalysis())) {
        state.scaleGapPlaying = true;
        setScaleStatus("scaleGapPlaying");
        renderScaleControls();
      }
    } catch (error) {
      stopScaleSound(true, error.message === "unsupported" ? "scaleUnsupported" : "scaleBlocked");
      setScaleStatus(state.scaleStatus, true);
    }
  }

  function setScaleShowGap(checked) {
    if (state.scaleGapPlaying && !checked) stopScaleSound(true, "scaleReady");
    state.scaleShowGap = Boolean(checked);
    renderScaleControls();
    if (state.mode === "tuning" && state.tuningKind === "scales") drawScalePlots();
  }

  function setScaleBase(input) {
    const value = Number(input);
    if (!Number.isFinite(value) || value < scaleModel.MIN_BASE_HZ || value > scaleModel.MAX_BASE_HZ) {
      setScaleStatus("scaleInvalid", true);
      renderScaleControls();
      return;
    }
    if (state.scaleBase === value) return;
    stopScaleSound();
    state.scaleBase = value;
    setScaleStatus("scaleReady");
    renderScaleControls();
    drawPlots();
  }

  function selectScalePreset(id) {
    const preset = scaleModel.PRESETS.find(item => item.id === id);
    if (!preset) return;
    stopScaleSound();
    state.scaleDown = preset.down;
    state.scaleUp = preset.up;
    if (state.scaleTonicK < -preset.down || state.scaleTonicK > preset.up) state.scaleTonicK = 0;
    setScaleStatus("scaleReady");
    renderScaleControls();
    drawPlots();
  }

  function changeScaleBoundary(direction, delta) {
    const field = direction === "down" ? "scaleDown" : "scaleUp";
    const next = state[field] + delta;
    if (!Number.isInteger(next) || next < 0 || next > 11 ||
        next + (direction === "down" ? state.scaleUp : state.scaleDown) + 1 > scaleModel.MAX_NOTES) return;
    stopScaleSound();
    state[field] = next;
    if (state.scaleTonicK < -state.scaleDown || state.scaleTonicK > state.scaleUp) state.scaleTonicK = 0;
    setScaleStatus("scaleReady");
    renderScaleControls();
    drawPlots();
  }

  function selectScaleTonic(index) {
    const note = scaleAnalysis().notes[index];
    if (!note || note.k === state.scaleTonicK) return;
    stopScaleSound();
    state.scaleTonicK = note.k;
    setScaleStatus("scaleReady");
    renderScaleControls();
    drawPlots();
  }

  function resetScale() {
    stopScaleSound();
    state.scaleDown = 0;
    state.scaleUp = 4;
    state.scaleTonicK = 0;
    state.scaleBase = 220;
    state.scaleVolume = 38;
    state.scaleMode = "melody";
    state.scaleShowGap = false;
    setScaleStatus("scaleReady");
    renderScaleControls();
    drawPlots();
  }

  function limit5Notes() {
    return state.limit5Coords.length ? limit5Model.selected(state.limit5Coords, state.limit5Base) : [];
  }

  function limit5Name(note) {
    return tempModel.NOTE_NAMES[note.tetStep];
  }

  function limit5Pair() {
    return state.limit5Coords.length < 2 ? null :
      limit5Model.closePairs(state.limit5Coords, state.limit5Base)[0] || null;
  }

  function limit5FocusNote() { return limit5Model.point(...state.limit5Focus, state.limit5Base); }

  function renderLimit5Now() {
    const label = $("limit5Now");
    const active = limit5Active;
    if (state.limit5Playing && active === "all") label.textContent = text("limit5NowChord");
    else if (state.limit5Playing && active) {
      label.textContent = intervalPhrase("limit5NowPlaying", {
        ratio: active.numerator + "/" + active.denominator, hz: hzText(active.hz)
      });
    } else label.textContent = text("limit5NowIdle");
    label.classList.toggle("active", state.limit5Playing && Boolean(active));
  }

  function renderLimit5Controls() {
    const notes = limit5Notes();
    const countText = notes.length + " " + text("scaleNotesUnit");
    $("limit5Count").textContent = countText;
    $("limit5LatticeBadge").textContent = countText;
    $("limit5OctaveBadge").textContent = notes.map(limit5Name).join(" · ") || "—";
    $("limit5BaseSlider").value = String(state.limit5Base);
    $("limit5BaseInput").value = String(state.limit5Base);
    $("limit5BaseInput").setAttribute("aria-valuetext", hzText(state.limit5Base));
    $("limit5BaseValue").textContent = hzText(state.limit5Base);
    $("limit5Volume").value = String(state.limit5Volume);
    $("limit5VolumeValue").textContent = state.limit5Volume + "%";
    $("limit5TetGuides").checked = state.limit5TetGuides;
    $("limit5PresetSelect").value = state.limit5Preset || "custom";
    $("limit5JustHint").hidden = state.limit5Preset !== "just12";
    document.querySelectorAll("[data-limit5-play]").forEach(button => {
      const playing = (state.limit5Playing || state.limit5Starting) && button.dataset.limit5Play === state.limit5Mode;
      button.classList.toggle("playing", playing);
      button.setAttribute("aria-pressed", String(playing));
      button.textContent = (playing ? "■ " : "▶ ") + text(button.dataset.limit5Play === "melody" ? "limit5Melody" : "limit5Chord");
    });
    $("limit5ShowRoutes").checked = state.limit5ShowRoutes;
    const focus = limit5FocusNote();
    const shift = limit5Model.octaveShift(focus.m, focus.n);
    $("limit5PointInfo").textContent = intervalPhrase("limit5PointFact", {
      name: limit5Name(focus), ratio: focus.numerator + "/" + focus.denominator,
      cents: focus.cents.toFixed(1), hz: hzText(focus.hz), m: focus.m, n: focus.n,
      fold: shift > 0 ? "×" + 2 ** shift : shift < 0 ? "÷" + 2 ** -shift : "×1"
    });
    const gap = limit5Pair();
    $("limit5CommaRuler").hidden = !gap;
    const fraction = note => note.numerator + "/" + note.denominator;
    if (gap) {
      $("limit5CommaFact").textContent = intervalPhrase("limit5PairFact", {
        name: limit5Name(gap.low), just: fraction(gap.low), pyth: fraction(gap.high), cents: gap.cents.toFixed(2)
      });
      $("limit5BeatFact").textContent = intervalPhrase("limit5BeatFact", {
        low: frequencyText(gap.low.hz), high: frequencyText(gap.high.hz), beats: gap.beatHz.toFixed(2)
      });
      $("limit5RulerJust").textContent = fraction(gap.low);
      $("limit5RulerPyth").textContent = fraction(gap.high);
      $("limit5RulerValue").textContent = intervalPhrase("limit5RulerValue", {
        ratio: gap.numerator + ":" + gap.denominator, cents: gap.cents.toFixed(2)
      });
    }
    renderLimit5Now();
  }

  function stopLimit5Tracking() {
    if (limit5Frame !== null) window.cancelAnimationFrame(limit5Frame);
    limit5Frame = null;
    limit5Active = null;
    renderLimit5Now();
    if (state.mode === "tuning" && state.tuningKind === "limit5") drawLimit5Plots();
  }

  function followLimit5Playback() {
    limit5Frame = null;
    const voice = limit5Audio.currentVoice;
    if (!state.limit5Playing || !voice || state.mode !== "tuning" || state.tuningKind !== "limit5") return;
    const elapsed = Math.max(0, audio.context.currentTime - voice.startedAt);
    const next = voice.mode === "chord" ? "all" :
      elapsed % limit5Model.STEP_SECONDS < limit5Model.NOTE_SECONDS ?
        voice.notes[Math.floor(elapsed / limit5Model.STEP_SECONDS)] || null : null;
    if (next !== limit5Active) {
      limit5Active = next;
      renderLimit5Now();
      drawLimit5Plots();
    }
    const duration = voice.mode === "chord" ? limit5Model.CHORD_SECONDS : voice.notes.length * limit5Model.STEP_SECONDS;
    if (elapsed < duration) limit5Frame = window.requestAnimationFrame(followLimit5Playback);
  }

  function stopLimit5Sound(immediate = false, message = "limit5Stopped") {
    limit5PlaybackRequest++;
    limit5Audio.stop(immediate);
    state.limit5Playing = false;
    state.limit5Starting = false;
    stopLimit5Tracking();
    setLimit5Status(message);
    renderLimit5Controls();
  }

  async function toggleLimit5Sound(mode) {
    if (state.mode !== "tuning" || state.tuningKind !== "limit5") return;
    if ((state.limit5Playing || state.limit5Starting) && state.limit5Mode === mode) {
      stopLimit5Sound(); return;
    }
    if (!state.limit5Coords.length) { setLimit5Status("limit5NoNotes", true); return; }
    limit5Audio.stop(true);
    if (limit5Frame !== null) window.cancelAnimationFrame(limit5Frame);
    limit5Frame = null;
    limit5Active = null;
    const request = ++limit5PlaybackRequest;
    state.limit5Playing = false;
    state.limit5Starting = true;
    state.limit5Mode = mode;
    setLimit5Status("limit5Starting");
    renderLimit5Controls();
    try {
      // Two near-return pitches must share an octave for audible beating.
      const notes = mode === "chord" && !(state.limit5Coords.length === 2 && limit5Pair()) ?
        limit5Model.chordVoicing(state.limit5Coords, state.limit5Base) : limit5Notes();
      const started = await limit5Audio.start(notes, mode);
      if (request !== limit5PlaybackRequest) return;
      state.limit5Starting = false;
      if (started) {
        state.limit5Playing = true;
        setLimit5Status("limit5Playing");
        renderLimit5Controls();
        followLimit5Playback();
      } else { setLimit5Status("limit5Ready"); renderLimit5Controls(); }
    } catch (_) { stopLimit5Sound(true, "limit5Blocked"); setLimit5Status("limit5Blocked", true); }
  }

  function selectLimit5Preset(preset) {
    if (!limit5Model.PRESETS[preset]) return;
    stopLimit5Sound();
    state.limit5Coords = limit5Model.PRESETS[preset].map(pair => [...pair]);
    state.limit5Preset = preset;
    // Matching the A4 = 440 Hz convention in the temperaments panel means
    // C4 = 440 / (5/3) = 264 Hz for this particular C-centred just scale.
    if (preset === "just12" && Math.abs(state.limit5Base - 261.63) < .005) state.limit5Base = 264;
    state.limit5ShowRoutes = Boolean(limit5Model.closePairs(state.limit5Coords, state.limit5Base).length);
    state.limit5Focus = [...state.limit5Coords[0]];
    state.limit5Cursor = [...state.limit5Focus];
    setLimit5Status("limit5Ready");
    renderLimit5Controls();
    drawPlots();
  }

  function toggleLimit5Point(m, n) {
    if (!limit5Model.within(m, n)) return;
    const index = state.limit5Coords.findIndex(pair => pair[0] === m && pair[1] === n);
    if (index < 0 && state.limit5Coords.length >= 12) { setLimit5Status("limit5Limit", true); return; }
    stopLimit5Sound();
    if (index >= 0) state.limit5Coords.splice(index, 1);
    else state.limit5Coords.push([m, n]);
    state.limit5Focus = [m, n];
    state.limit5Preset = null;
    setLimit5Status("limit5Ready");
    renderLimit5Controls();
    drawPlots();
  }

  function setLimit5Base(input) {
    const value = Number(input);
    if (!Number.isFinite(value) || value < 110 || value > 330) {
      setLimit5Status("limit5Invalid", true); renderLimit5Controls(); return;
    }
    if (value === state.limit5Base) return;
    stopLimit5Sound();
    state.limit5Base = value;
    renderLimit5Controls();
    drawPlots();
  }

  function resetLimit5() {
    stopLimit5Sound();
    state.limit5Coords = limit5Model.PRESETS.major.map(pair => [...pair]);
    state.limit5Preset = "major";
    state.limit5Mode = "melody";
    state.limit5Base = 261.63;
    state.limit5Volume = 38;
    state.limit5TetGuides = false;
    state.limit5ShowRoutes = false;
    state.limit5Starting = false;
    state.limit5Cursor = [0, 0];
    state.limit5Focus = [0, 0];
    setLimit5Status("limit5Ready");
    renderLimit5Controls();
    drawPlots();
  }

  const tempCents = value => (value >= 0 ? "+" : "") + value.toFixed(2);

  function tempChord() {
    return tempModel.chord(state.tempSystem, state.tempKey, state.tempQuality, 440, state.tempNarrow);
  }

  function tempFifths() {
    return tempModel.fifths(state.tempSystem, state.tempNarrow);
  }

  function tempPlayback(mode = state.tempMode) {
    if (state.tempTask === "wolf") {
      const ordinary = mode === "melody";
      const isJust = state.tempSystem === "just";
      const lowPc = ordinary ? 0 : isJust ? 2 : 8, highPc = ordinary ? 7 : isJust ? 9 : 3;
      const low = { name: tempModel.NOTE_NAMES[lowPc] + "4",
        hz: tempModel.frequency(state.tempSystem, lowPc, 4, 440, state.tempNarrow) };
      const upperOctave = ordinary || isJust ? 4 : 5;
      const high = { name: tempModel.NOTE_NAMES[highPc] + upperOctave,
        hz: tempModel.frequency(state.tempSystem, highPc, upperOctave, 440, state.tempNarrow) };
      return { notes: [low, high], mode: "chord", interval: "fifth" };
    }
    const chord = tempChord();
    if (state.tempTask === "third") {
      const lower = chord.notes[0];
      const higher = mode === "chord" ? { ...chord.notes[1],
        hz: lower.hz * (state.tempQuality === "major" ? 5 / 4 : 6 / 5) } : chord.notes[1];
      return { notes: [lower, higher], mode: "chord", interval: state.tempQuality };
    }
    return { notes: chord.notes, mode, interval: state.tempQuality };
  }

  function tempListenKey(mode) {
    return state.tempTask === "wolf" ? mode === "melody" ? "tempRegularPlay" :
      state.tempSystem === "just" ? "tempJustImperfectPlay" :
      tempFifths().some(edge => edge.wolf) ? "tempWolfPlay" : "tempClosingPlay" :
      state.tempTask === "third" ? mode === "melody" ? "tempTunedPlay" : "tempPurePlay" :
        mode === "melody" ? "tempMelody" : "tempChord";
  }

  function renderTempControls() {
    const chord = tempChord();
    const fifths = tempFifths();
    const task = state.tempTask;
    const isJust = state.tempSystem === "just";
    const hasWolf = fifths.some(edge => edge.wolf);
    $("tempTaskSelect").value = task;
    $("tempTaskHint").textContent = text(isJust && task === "wolf" ? "tempTaskHintJustFifth" :
      isJust && task === "build" ? "tempTaskHintJustBuild" :
      task === "wolf" && !hasWolf ? "tempTaskHintWolfFree" :
      { build: "tempTaskHintBuild", wolf: "tempTaskHintWolf",
      third: "tempTaskHintThird", chord: "tempTaskHintChord" }[task]);
    $("tempSystemSelect").value = state.tempSystem;
    $("tempJustGuide").hidden = !isJust;
    $("tempJustRatioGrid").setAttribute("aria-label", text("tempJustRatioAria"));
    $("tempJustRatioGrid").innerHTML = isJust ? tempModel.JUST12_RATIOS.map(([numerator, denominator], pc) =>
      '<span' + (chord.notes.some(note => note.pc === pc) ? ' class="active"' : '') +
      '><strong>' + tempModel.NOTE_NAMES[pc] + '</strong> ' + numerator + ':' + denominator + '</span>').join("") : "";
    $("tempLatticeHint").textContent = text(isJust ? "tempJustLatticeHint" : "tempLatticeHint");
    $("tempLatticeFoot").textContent = text(isJust ? "tempJustLatticeFoot" : "tempLatticeFoot");
    $("tempLatticeScale").textContent = text(isJust ? "tempJustLatticeScale" : "tempLatticeScale");
    $("tempTunedLegend").textContent = text(isJust ? "tempJustTunedLegend" : "tempTunedLegend");
    $("tempWolfLegend").textContent = text(isJust ? "tempJustWide" : "tempWolfLegend");
    $("tempCircleHint").textContent = text(isJust ? "tempJustCircleHint" : "tempCircleHint");
    $("tempLatticeCanvas").setAttribute("aria-label", text(isJust ? "tempJustLatticeAria" : "tempLatticeAria"));
    $("tempFifthsCanvas").setAttribute("aria-label", text(isJust ? "tempJustFifthsAria" : "tempFifthsAria"));
    $("tempAdjustGroup").hidden = state.tempSystem !== "adjustable";
    $("tempChordFields").hidden = task === "wolf";
    $("tempChordPanel").hidden = task === "wolf";
    $("tempNarrowSlider").value = String(state.tempNarrow);
    $("tempNarrowValue").textContent = state.tempNarrow.toFixed(2) + " ¢";
    const measured = tempModel.fifths("adjustable", state.tempNarrow);
    $("tempAdjustFact").textContent = intervalPhrase("tempAdjustFact", {
      regular: measured[0].cents.toFixed(2), wolf: measured[tempModel.WOLF_EDGE].cents.toFixed(2),
      third: (4 * measured[0].cents - 2400).toFixed(2)
    });
    const presets = { pythagorean: 0, equal: tempModel.EQUAL_NARROWING,
      "no-wolf": tempModel.WOLF_FREE_NARROWING, meantone: tempModel.MEANTONE_NARROWING };
    document.querySelectorAll("[data-temp-narrow-preset]").forEach(button => {
      button.classList.toggle("selected", Math.abs(state.tempNarrow - presets[button.dataset.tempNarrowPreset]) < .015);
    });
    $("tempKeySelect").value = String(state.tempKey);
    $("tempQualitySelect").value = state.tempQuality;
    $("tempListenFact").textContent = text(isJust && task === "wolf" ? "tempListenJustFifth" :
      isJust && task === "build" ? "tempListenJustBuild" :
      task === "wolf" && !hasWolf ? "tempListenWolfFree" :
      task === "third" && state.tempQuality === "minor" ? "tempListenThirdMinor" :
      { build: "tempListenBuild", wolf: "tempListenWolf",
        third: "tempListenThird", chord: "tempListenChord" }[task]);
    $("tempVolume").value = String(state.tempVolume);
    $("tempVolumeValue").textContent = state.tempVolume + "%";
    $("tempCircleBadge").textContent = task === "wolf" ? (isJust ? "C–G / D–A" : "G♯–E♭") :
      tempModel.NOTE_NAMES[state.tempKey] + " " + text(state.tempQuality === "major" ? "tempMajor" : "tempMinor");
    $("tempChordBadge").textContent = chord.notes.map(note => note.name).join(" · ");
    $("tempLatticeBadge").textContent = task === "wolf" ? (isJust ? "C–G · D–A" : "C–G · G♯–E♭") :
      chord.notes.map(note => note.name.replace(/[45]$/, "")).join(" · ");
    $("tempLatticeFact").textContent = task === "wolf" ? text(isJust ? "tempJustLatticeFifths" :
      hasWolf ? "tempLatticeWolf" : "tempLatticeWolfFree") : intervalPhrase(isJust ? "tempJustChordFact" : "tempLatticeFact", {
      quality: text(state.tempQuality === "major" ? "tempMajor" : "tempMinor"),
      third: chord.thirdCents.toFixed(2), thirdError: tempCents(chord.thirdCents -
        (state.tempQuality === "major" ? tempModel.PURE_MAJOR_THIRD : tempModel.PURE_MINOR_THIRD)),
      fifth: chord.fifthCents.toFixed(2), fifthError: tempCents(chord.fifthCents - tempModel.FIFTH_CENTS)
    });
    // The fourth fifth and the pure 5:4 point are different *constructions*
    // of E. Meantone identifies their frequencies; the Pythagorean shadow
    // still occupies its own, distant exact-lattice coordinate.
    const constructedThird = tempModel.chord(state.tempSystem, 0, "major", 440,
      state.tempNarrow).thirdCents;
    const thirdGap = constructedThird - tempModel.PURE_MAJOR_THIRD;
    $("tempLatticeConstructionFact").textContent = intervalPhrase(isJust ? "tempJustConstruction" : "tempLatticeConstruction", {
      actual: constructedThird.toFixed(2),
      error: tempCents(Math.abs(thirdGap) < .01 ? 0 : thirdGap),
      outcome: text(Math.abs(thirdGap) < .01 ?
        isJust ? "tempJustConstructionExact" : "tempLatticeConstructionExact" : "tempLatticeConstructionOther")
    });
    const pair = tempPlayback();
    const gap = tempModel.partialGap(pair.notes[0].hz, pair.notes[1].hz, pair.interval);
    $("tempPartialBadge").textContent = gap.lowerHarmonic + "f ≈ " + gap.upperHarmonic + "f";
    $("tempBeatFact").textContent = intervalPhrase("tempBeatFact", {
      lower: pair.notes[0].name, upper: pair.notes[1].name, a: gap.lowerHarmonic,
      b: gap.upperHarmonic, beat: gap.beatHz.toFixed(2)
    });
    $("tempPartialHint").textContent = text(pair.interval === "minor" ? "tempPartialHintMinor" : "tempPartialHint");
    $("tempCommaBadge").textContent = intervalPhrase("tempCommaBadge", { cents: tempModel.PYTHAGOREAN_COMMA.toFixed(2) });
    for (let i = 0; i < 3; i++) {
      const note = chord.notes[i];
      $("tempNoteName" + i).textContent = note.name;
      $("tempNoteHz" + i).textContent = hzText(note.hz);
      $("tempNoteDev" + i).textContent = tempCents(note.deviation) + " " + (state.language === "mn" ? "цент" : "cents");
    }
    $("tempChordFact").textContent = intervalPhrase("tempChordFact", {
      third: chord.thirdCents.toFixed(2), fifth: chord.fifthCents.toFixed(2),
      expected: state.tempQuality === "major" ? 400 : 300
    });
    const wolf = fifths.find(fifth => fifth.wolf);
    $("tempWolfFact").textContent = isJust ? text("tempJustFifthsFact") : wolf ? intervalPhrase("tempWolfFact", {
      from: wolf.from, to: wolf.to, cents: wolf.cents.toFixed(2), deviation: tempCents(wolf.deviation)
    }) : intervalPhrase("tempNoWolfFact", { narrow: fifths.filter(fifth => fifth.deviation < -0.01).length });
    $("tempFifthsBody").innerHTML = fifths.map(fifth =>
      '<tr' + (fifth.wolf ? ' class="wolf-row"' : '') + '><td>' + fifth.from + '–' + fifth.to +
      '</td><td>' + fifth.cents.toFixed(2) + '</td><td>' + tempCents(fifth.deviation) + '</td></tr>').join("");
    document.querySelectorAll("[data-temp-play]").forEach(button => {
      const active = (state.tempPlaying || state.tempStarting) && state.tempMode === button.dataset.tempPlay;
      button.classList.toggle("playing", active);
      button.setAttribute("aria-pressed", String(active));
      button.textContent = (active ? "■ " : "▶ ") + text(tempListenKey(button.dataset.tempPlay));
    });
  }

  function stopTempSound(immediate = false, message = "tempStopped") {
    tempPlaybackRequest++;
    tempAudio.stop(immediate);
    state.tempPlaying = false;
    state.tempStarting = false;
    setTempStatus(message);
    renderTempControls();
  }

  async function toggleTempSound(mode) {
    if (!["melody", "chord"].includes(mode) || state.mode !== "tuning" || state.tuningKind !== "temperaments") return;
    if ((state.tempPlaying || state.tempStarting) && state.tempMode === mode) {
      stopTempSound(); return;
    }
    const request = ++tempPlaybackRequest;
    tempAudio.stop(true);
    state.tempPlaying = false;
    state.tempStarting = true;
    state.tempMode = mode;
    setTempStatus("tempStarting");
    renderTempControls();
    drawPlots();
    try {
      const playback = tempPlayback(mode);
      const started = await tempAudio.start(playback.notes, playback.mode);
      if (request !== tempPlaybackRequest) return;
      state.tempStarting = false;
      state.tempPlaying = Boolean(started);
      setTempStatus(started ? "tempPlaying" : "tempReady");
      renderTempControls();
    } catch (_) {
      if (request !== tempPlaybackRequest) return;
      stopTempSound(true, "tempBlocked");
      setTempStatus("tempBlocked", true);
    }
  }

  function selectTempSystem(system) {
    if (!tempModel.SELECTABLE_SYSTEMS.includes(system) || system === state.tempSystem) return;
    stopTempSound();
    state.tempSystem = system;
    if (system === "just" && state.tempTask === "build") state.tempTask = "chord";
    setTempStatus("tempReady");
    renderTempControls();
    drawPlots();
  }

  function selectTempTask(task) {
    if (!["build", "wolf", "third", "chord"].includes(task) || task === state.tempTask) return;
    stopTempSound();
    state.tempTask = task;
    state.tempMode = "melody";
    setTempStatus("tempReady");
    renderTempControls();
    drawPlots();
  }

  function setTempNarrow(value) {
    const narrowing = Number(value);
    if (!Number.isFinite(narrowing) || narrowing < 0 || narrowing > 6) return;
    if (state.tempSystem === "adjustable" && Math.abs(state.tempNarrow - narrowing) < .0001) return;
    stopTempSound();
    state.tempSystem = "adjustable";
    state.tempNarrow = narrowing;
    setTempStatus("tempReady");
    renderTempControls();
    drawPlots();
  }

  function selectTempNarrowPreset(preset) {
    const choices = { pythagorean: 0, equal: tempModel.EQUAL_NARROWING,
      "no-wolf": tempModel.WOLF_FREE_NARROWING, meantone: tempModel.MEANTONE_NARROWING };
    if (Object.hasOwn(choices, preset)) setTempNarrow(choices[preset]);
  }

  function selectTempKey(pc) {
    if (!Number.isInteger(pc) || pc < 0 || pc > 11 || pc === state.tempKey) return;
    stopTempSound();
    state.tempKey = pc;
    setTempStatus("tempReady");
    renderTempControls();
    drawPlots();
  }

  function selectTempQuality(quality) {
    if (!["major", "minor"].includes(quality) || quality === state.tempQuality) return;
    stopTempSound();
    state.tempQuality = quality;
    setTempStatus("tempReady");
    renderTempControls();
    drawPlots();
  }

  function resetTemp() {
    stopTempSound();
    state.tempSystem = "adjustable";
    state.tempTask = "build";
    state.tempNarrow = tempModel.MEANTONE_NARROWING;
    state.tempKey = 0;
    state.tempQuality = "major";
    state.tempMode = "melody";
    state.tempVolume = 38;
    setTempStatus("tempReady");
    renderTempControls();
    drawPlots();
  }

  function mixRecipe() {
    return { baseHz: state.mixBase, gapHz: state.mixGap };
  }

  function mixBeatsText() {
    return frequencyText(state.mixGap) + " " + text("mixBeatUnit");
  }

  function renderMixView() {
    const span = state.mixWindowSpan, start = state.mixWindowStart;
    $("mixZoomValue").textContent = mixTimeLabel(span, span);
    $("mixZoomOut").disabled = span >= MIX_MAX_VIEW_SECONDS - 1e-9;
    $("mixZoomIn").disabled = span <= MIX_MIN_VIEW_SECONDS + 1e-9;
    $("mixViewLeft").disabled = start <= 1e-9;
    $("mixViewRight").disabled = start + span >= MIX_MAX_VIEW_SECONDS - 1e-9;
  }

  function renderMixControls() {
    $("mixBaseSlider").value = String(state.mixBase);
    $("mixBaseInput").value = String(state.mixBase);
    $("mixBaseInput").setAttribute("aria-valuetext", hzText(state.mixBase));
    $("mixBaseValue").textContent = hzText(state.mixBase);
    $("mixGapSlider").value = String(state.mixGap);
    $("mixGapValue").textContent = hzText(state.mixGap);
    const [first, second] = beatsModel.frequencies(mixRecipe());
    $("mixPairValue").textContent = frequencyText(first) + " + " + hzText(second);
    $("mixBeatValue").textContent = mixBeatsText();
    $("mixWaveBadge").textContent = mixBeatsText();
    $("mixSpectrumBadge").textContent = frequencyText(first) + " + " + hzText(second);
    $("mixSpectrumFoot").textContent = text(state.mixGap === 0 ? "mixSpectrumZeroFoot" : "mixSpectrumFoot");
    $("mixVolume").value = String(state.mixVolume);
    $("mixVolumeValue").textContent = state.mixVolume + "%";
    $("mixButton").classList.toggle("playing", state.mixPlaying);
    $("mixButton").setAttribute("aria-pressed", String(state.mixPlaying));
    $("mixPlayIcon").textContent = state.mixPlaying ? "■" : "▶";
    $("mixPlayLabel").textContent = text(state.mixPlaying ? "mixStop" : "mixPlay");
    $("mixPlayCaption").textContent = text(state.mixPlaying ? "stopCaption" : "playCaption");
    document.querySelectorAll("[data-mix-gap]").forEach(button => {
      const selected = Number(button.dataset.mixGap) === state.mixGap;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    renderMixView();
  }

  function stopMixSound(immediate = false, message = "mixStopped") {
    mixAudio.stop(immediate);
    state.mixPlaying = false;
    setMixStatus(message);
    renderMixControls();
  }

  async function toggleMixSound() {
    if (state.mixPlaying) { stopMixSound(); return; }
    if (state.mode !== "mix") return;
    setMixStatus("mixStarting");
    try {
      if (await mixAudio.start()) {
        state.mixPlaying = true;
        setMixStatus("mixPlaying");
        renderMixControls();
      }
    } catch (error) {
      stopMixSound(true, error.message === "unsupported" ? "mixUnsupported" : "mixBlocked");
      setMixStatus(state.mixStatus, true);
    }
  }

  function setMixBase(input) {
    const value = Number(input);
    if (!Number.isFinite(value) || value < beatsModel.MIN_BASE_HZ || value > beatsModel.MAX_BASE_HZ) {
      setMixStatus("mixInvalid", true);
      renderMixControls();
      return;
    }
    state.mixBase = value;
    if (state.mixError) setMixStatus(state.mixPlaying ? "mixPlaying" : "mixReady");
    mixAudio.update();
    renderMixControls();
    if (state.mode === "mix") drawMixPlots();
  }

  function setMixGap(input) {
    const value = Number(input);
    if (!Number.isFinite(value)) return;
    const previousGap = state.mixGap;
    state.mixGap = Math.min(beatsModel.MAX_GAP_HZ, Math.max(beatsModel.MIN_GAP_HZ, value));
    if (state.mixPlaying && previousGap !== 0 && state.mixGap === 0) mixAudio.resyncAtZeroGap();
    else mixAudio.update();
    renderMixControls();
    if (state.mode === "mix") drawMixPlots();
  }

  function zoomMix(direction) {
    const span = state.mixWindowSpan;
    const next = direction > 0 ? Math.max(MIX_MIN_VIEW_SECONDS, span / MIX_ZOOM_FACTOR) :
      Math.min(MIX_MAX_VIEW_SECONDS, span * MIX_ZOOM_FACTOR);
    if (next === span) return;
    state.mixWindowSpan = next;
    // Preserve the left-hand time coordinate so successive zooms reveal the
    // same oscillations rather than unexpectedly jumping to a different phase.
    state.mixWindowStart = Math.min(state.mixWindowStart, MIX_MAX_VIEW_SECONDS - next);
    renderMixView();
    if (state.mode === "mix") drawMixWave();
  }

  function panMixWindow(direction) {
    const span = state.mixWindowSpan;
    state.mixWindowStart = Math.max(0, Math.min(MIX_MAX_VIEW_SECONDS - span,
      state.mixWindowStart + direction * span / 2));
    renderMixView();
    if (state.mode === "mix") drawMixWave();
  }

  function resetMix() {
    stopMixSound();
    state.mixBase = 440;
    state.mixGap = 4;
    state.mixVolume = 40;
    state.mixWindowStart = 0;
    state.mixWindowSpan = 1;
    setMixStatus("mixReady");
    renderMixControls();
    if (state.mode === "mix") drawMixPlots();
  }

  function sirenRecipe() {
    return { pattern: state.sirenPattern, lowHz: state.sirenLow,
      highHz: state.sirenHigh, rate: state.sirenRate };
  }

  function stopMotionFrame() {
    if (motionFrame !== null) window.cancelAnimationFrame(motionFrame);
    motionFrame = null;
  }

  function stopMotionSound(immediate = false, message = "motionStopped") {
    motionStartGeneration++;
    motionStarting = false;
    motionAudio.stop(immediate);
    stopMotionFrame();
    motionPointerId = null;
    state.motionPlaying = false;
    setMotionStatus(message);
    renderMotionControls();
    if (state.mode === "motion") drawMotionPlots();
  }

  function renderMotionControls() {
    const isTheremin = state.motionKind === "theremin";
    const sirenActive = !isTheremin && (state.motionPlaying || motionStarting);
    $("thereminControls").hidden = !isTheremin;
    $("sirenControls").hidden = isTheremin;
    $("motionDescription").textContent = text("motionDesc")[state.motionKind];
    const sirenHintKeys = {
      "two-tone": "motionPitchSiren", "sine-sweep": "motionPitchSirenSine",
      "pitch-sweep": "motionPitchSirenPitch"
    };
    $("motionPitchSubtitle").textContent = text(isTheremin ? "motionPitchTheremin" :
      sirenHintKeys[state.sirenPattern]);
    $("motionChallengeText").textContent = text("motionChallenge")[state.motionKind];
    document.querySelectorAll("[data-motion]").forEach(button => {
      const active = button.dataset.motion === state.motionKind;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll("[data-theremin-timbre]").forEach(button => {
      const active = button.dataset.thereminTimbre === state.motionTimbre;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    $("thereminTimbreHint").textContent = text("timbreNotes")[state.motionTimbre];
    $("thereminVowelGroup").hidden = !isTheremin || state.motionTimbre !== "voice";
    $("thereminOvertoneGroup").hidden = !isTheremin || state.motionTimbre !== "overtones";
    document.querySelectorAll("[data-theremin-vowel]").forEach(button => {
      const active = button.dataset.thereminVowel === state.motionVowel;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    $("thereminHarmonic").value = String(state.motionHarmonic);
    $("thereminHarmonicValue").textContent = state.motionHarmonic + "f₀ = " +
      hzText(state.motionHarmonic * state.motionHz);
    document.querySelectorAll("[data-siren-pattern]").forEach(button => {
      const active = button.dataset.sirenPattern === state.sirenPattern;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    $("thereminCursor").style.left = (state.motionX * 100).toFixed(2) + "%";
    $("thereminCursor").style.top = (state.motionY * 100).toFixed(2) + "%";
    $("thereminPad").setAttribute("aria-pressed", String(isTheremin && state.motionPlaying));
    $("motionCurrentHz").textContent = hzText(state.motionHz);
    $("motionCurrentLevel").textContent = Math.round(state.motionLevel * 100) + "%";
    $("sirenLow").value = String(state.sirenLow);
    $("sirenHigh").value = String(state.sirenHigh);
    $("sirenRate").value = String(state.sirenRate);
    $("sirenVolume").value = String(state.sirenVolume);
    $("sirenLowValue").textContent = hzText(state.sirenLow);
    $("sirenHighValue").textContent = hzText(state.sirenHigh);
    $("sirenRateValue").textContent = frequencyText(state.sirenRate) + " " + text("sirenRateUnit");
    $("sirenVolumeValue").textContent = state.sirenVolume + "%";
    $("sirenButton").classList.toggle("playing", sirenActive);
    $("sirenButton").setAttribute("aria-pressed", String(sirenActive));
    $("sirenPlayIcon").textContent = sirenActive ? "■" : "▶";
    $("sirenPlayLabel").textContent = text(sirenActive ? "sirenStop" : "sirenPlay");
  }

  function setMotionKind(kind) {
    if (!motionModel || !["theremin", "siren"].includes(kind) || kind === state.motionKind) return;
    stopMotionSound();
    state.motionKind = kind;
    state.motionHistory = [];
    state.motionElapsed = 0;
    state.motionHz = kind === "theremin" ? motionModel.padHz(state.motionX) :
      motionModel.sirenHzAt(0, sirenRecipe());
    state.motionLevel = kind === "theremin" ? motionModel.padLevel(state.motionY) : state.sirenVolume / 100;
    setMotionStatus("motionReady");
    renderMotionControls();
    drawPlots();
  }

  function setMotionTimbre(timbre) {
    if (!motionModel.TIMBRES.includes(timbre) || timbre === state.motionTimbre) return;
    state.motionTimbre = timbre;
    if (state.motionPlaying && state.motionKind === "theremin") {
      // Crossfade one oscillator into the new harmonic color at the same pitch.
      motionAudio.start().catch(() => stopMotionSound(true, "motionBlocked"));
    }
    renderMotionControls();
    if (state.mode === "motion") drawMotionPlots();
  }

  function setMotionVowel(vowel) {
    if (!motionModel.VOWELS.includes(vowel) || vowel === state.motionVowel) return;
    state.motionVowel = vowel;
    if (state.motionPlaying && state.motionKind === "theremin" && state.motionTimbre === "voice") {
      // Change the vocal-tract filter smoothly without restarting the note.
      motionAudio.update();
    }
    renderMotionControls();
    if (state.mode === "motion") drawMotionPlots();
  }

  function setMotionHarmonic(harmonic) {
    if (!Number.isInteger(harmonic) || harmonic < motionModel.MIN_OVERTONE ||
        harmonic > motionModel.MAX_OVERTONE || harmonic === state.motionHarmonic) return;
    state.motionHarmonic = harmonic;
    if (state.motionPlaying && state.motionKind === "theremin" && state.motionTimbre === "overtones") {
      // Move the focused formant to another existing harmonic, not a new voice.
      motionAudio.update();
    }
    renderMotionControls();
    if (state.mode === "motion") drawMotionPlots();
  }

  function setPadPosition(x, y) {
    state.motionX = model.clamp(x, 0, 1);
    state.motionY = model.clamp(y, 0, 1);
    state.motionHz = motionModel.padHz(state.motionX);
    state.motionLevel = motionModel.padLevel(state.motionY);
    if (state.motionPlaying) motionAudio.update();
    renderMotionControls();
    if (state.mode === "motion") drawMotionPlots();
  }

  function readPadPointer(event) {
    const rect = $("thereminPad").getBoundingClientRect();
    setPadPosition((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  }

  function updateSiren() {
    state.motionLevel = state.sirenVolume / 100;
    state.motionHz = motionModel.sirenHzAt(state.motionElapsed, sirenRecipe());
    if (state.motionPlaying) motionAudio.update();
    renderMotionControls();
    if (state.mode === "motion") drawMotionPlots();
  }

  async function startMotionSound() {
    if (state.motionPlaying || motionStarting || state.mode !== "motion") return;
    const ticket = ++motionStartGeneration;
    motionStarting = true;
    setMotionStatus("motionStarting");
    renderMotionControls();
    try {
      const info = await motionAudio.start();
      if (ticket !== motionStartGeneration) return;
      motionStarting = false;
      if (!info) {
        setMotionStatus("motionReady");
        renderMotionControls();
        return;
      }
      motionStartedAt = info.startedAt;
      motionLastDraw = -1;
      state.motionElapsed = 0;
      state.motionHistory = [];
      state.motionPlaying = true;
      setMotionStatus(state.motionKind === "theremin" ? "motionPlayingTheremin" : "motionPlayingSiren");
      renderMotionControls();
      drawMotionPlots();
      const advance = () => {
        if (ticket !== motionStartGeneration || !state.motionPlaying || state.mode !== "motion") return;
        const elapsed = Math.max(0, info.context.currentTime - motionStartedAt);
        state.motionElapsed = elapsed;
        if (state.motionKind === "siren") {
          state.motionHz = motionModel.sirenHzAt(elapsed, sirenRecipe());
          state.motionLevel = state.sirenVolume / 100;
        } else {
          state.motionHistory.push({ time: elapsed, hz: state.motionHz });
          while (state.motionHistory.length > 1 && state.motionHistory[1].time < elapsed - 4) {
            state.motionHistory.shift();
          }
        }
        motionAudio.update();
        if (elapsed - motionLastDraw >= 0.035) {
          renderMotionControls();
          drawMotionPlots();
          motionLastDraw = elapsed;
        }
        motionFrame = window.requestAnimationFrame(advance);
      };
      motionFrame = window.requestAnimationFrame(advance);
    } catch (error) {
      if (ticket !== motionStartGeneration) return;
      stopMotionSound(true, error.message === "unsupported" ? "motionUnsupported" : "motionBlocked");
      $("motionStatus").classList.toggle("error", true);
      state.motionError = true;
    }
  }

  function resetMotion() {
    stopMotionSound();
    state.motionKind = "theremin";
    state.motionTimbre = "pure";
    state.motionVowel = "a";
    state.motionHarmonic = 6;
    state.motionX = motionModel.padFraction(440);
    state.motionY = 0.5;
    state.motionHz = 440;
    state.motionLevel = 0.5;
    state.motionElapsed = 0;
    state.motionHistory = [];
    state.sirenPattern = "two-tone";
    state.sirenLow = 440;
    state.sirenHigh = 880;
    state.sirenRate = 0.8;
    state.sirenVolume = 40;
    setMotionStatus("motionReady");
    renderMotionControls();
    drawPlots();
  }

  function renderMode() {
    const isPure = state.mode === "pure";
    const isWaves = isPure && state.pureKind === "waves";
    const isCompose = state.mode === "compose";
    const isAnalysis = state.mode === "analysis";
    const isStrike = state.mode === "strike";
    const isSustain = state.mode === "sustain";
    const isMotion = state.mode === "motion";
    const isMix = state.mode === "mix";
    const isTuning = state.mode === "tuning";
    const isBeats = isMix && state.mixKind === "beats";
    const isHarmonics = isPure && state.pureKind === "harmonics";
    const isIntervals = isTuning && state.tuningKind === "intervals";
    const isEar = isTuning && state.tuningKind === "ear";
    const isScales = isTuning && state.tuningKind === "scales";
    const isLimit5 = isTuning && state.tuningKind === "limit5";
    const isTemp = isTuning && state.tuningKind === "temperaments";
    const isNoise = isMix && state.mixKind === "noise";
    $("pureWorkspace").hidden = !isWaves;
    $("pureChallenge").hidden = !isWaves;
    $("pureExplanation").hidden = !isWaves;
    $("projectToolbar").hidden = !isCompose;
    if (analysis) analysis.setActive(isAnalysis);
    if (microphone) microphone.setActive(isAnalysis);
    if (compare) compare.setActive(isAnalysis && analysisScreen === "compare");
    updateAnalysisScreens();
    $("composeWorkspace").hidden = !isCompose || state.composeSubtab !== "solo";
    $("composeEnsembleWorkspace").hidden = !isCompose || state.composeSubtab !== "ensemble";
    document.querySelectorAll("[data-compose-subtab]").forEach(button => {
      const selected = state.composeSubtab === button.dataset.composeSubtab;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $("strikeWorkspace").hidden = !isStrike;
    $("strikeChallenge").hidden = !isStrike;
    $("strikeExplanation").hidden = !isStrike;
    $("sustainWorkspace").hidden = !isSustain;
    $("sustainChallenge").hidden = !isSustain;
    $("sustainExplanation").hidden = !isSustain;
    $("motionWorkspace").hidden = !isMotion;
    $("motionChallenge").hidden = !isMotion;
    $("motionExplanation").hidden = !isMotion;
    $("mixWorkspace").hidden = !isBeats;
    $("mixChallenge").hidden = !isBeats;
    $("mixExplanation").hidden = !isBeats;
    $("harmonicWorkspace").hidden = !isHarmonics;
    $("harmonicChallenge").hidden = !isHarmonics;
    $("harmonicExplanation").hidden = !isHarmonics;
    $("intervalWorkspace").hidden = !isIntervals;
    $("intervalChallenge").hidden = !isIntervals;
    $("intervalExplanation").hidden = !isIntervals;
    $("earWorkspace").hidden = !isEar;
    $("earChallenge").hidden = !isEar;
    $("earExplanation").hidden = !isEar;
    $("scaleWorkspace").hidden = !isScales;
    $("scaleChallenge").hidden = !isScales;
    $("scaleExplanation").hidden = !isScales;
    $("limit5Workspace").hidden = !isLimit5;
    $("limit5Challenge").hidden = !isLimit5;
    $("limit5Explanation").hidden = !isLimit5;
    $("temperamentWorkspace").hidden = !isTemp;
    $("tempChallenge").hidden = !isTemp;
    $("tempExplanation").hidden = !isTemp;
    $("noiseWorkspace").hidden = !isNoise;
    $("noiseChallenge").hidden = !isNoise;
    $("noiseExplanation").hidden = !isNoise;
    document.querySelectorAll("[data-pure-kind]").forEach(button => {
      const selected = button.dataset.pureKind === state.pureKind;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-mix-kind]").forEach(button => {
      const selected = button.dataset.mixKind === state.mixKind;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-tuning-kind]").forEach(button => {
      const selected = button.dataset.tuningKind === state.tuningKind;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    for (const [id, mode] of [["modePure", "pure"], ["modeMotion", "motion"], ["modeSustain", "sustain"],
      ["modeStrike", "strike"], ["modeMix", "mix"], ["modeTuning", "tuning"], ["modeCompose", "compose"],
      ["modeAnalysis", "analysis"]]) {
      const selected = state.mode === mode;
      $(id).classList.toggle("active", selected);
      $(id).setAttribute("aria-pressed", String(selected));
    }
  }

  function renderTexts() {
    if (compose) compose.renderLanguage(state.language);
    if (ensemble) ensemble.renderLanguage(state.language);
    if (projectFiles) projectFiles.renderLanguage(state.language);
    if (wavExport) wavExport.renderLanguage(state.language);
    if (analysis) analysis.renderLanguage(state.language);
    if (compare) compare.renderLanguage(state.language);
    if (microphone) microphone.renderLanguage(state.language);
    updateAnalysisScreens();
    document.documentElement.lang = state.language;
    document.querySelectorAll("[data-i18n]").forEach(element => {
      const key = element.getAttribute("data-i18n");
      if (typeof text(key) === "string") element.textContent = text(key);
    });
    document.querySelectorAll("[data-unit-hz]").forEach(element => {
      element.textContent = element.dataset.unitHz + " " + text("unitHz");
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(element => {
      element.setAttribute("aria-label", text(element.getAttribute("data-i18n-aria")));
    });
    $("langEn").classList.toggle("active", state.language === "en");
    $("langMn").classList.toggle("active", state.language === "mn");
    $("langEn").setAttribute("aria-pressed", String(state.language === "en"));
    $("langMn").setAttribute("aria-pressed", String(state.language === "mn"));
    $("soundDescription").textContent = text("desc")[state.waveform];
    $("harmonicInsight").textContent = text("insight")[state.waveform];
    $("challengeText").textContent = text("challenge")[state.waveform];
    $("waveCanvas").setAttribute("aria-label", text("waveAria"));
    $("spectrumCanvas").setAttribute("aria-label", text("spectrumAria"));
    $("frequencySlider").setAttribute("aria-label", text("sliderAria"));
    $("frequencyInput").setAttribute("aria-label", text("frequencyAria"));
    $("waveChoices").setAttribute("aria-label", text("waveGroupAria"));
    $("modeSwitch").setAttribute("aria-label", text("modeSwitchAria"));
    $("strikeChoices").setAttribute("aria-label", text("strikeGroupAria"));
    $("strikeFrequencySlider").setAttribute("aria-label", text("strikePitchSliderAria"));
    $("strikeFrequencyInput").setAttribute("aria-label", text("strikePitchInputAria"));
    $("strikeWaveCanvas").setAttribute("aria-label", text("strikeWaveAria"));
    $("strikeSpectrumCanvas").setAttribute("aria-label", text("strikeSpectrumAria"));
    $("strikeTimeSlider").setAttribute("aria-label", text("strikeTimeAria"));
    $("strikeViewPreset").setAttribute("aria-label", text("strikeViewPresetLabel"));
    $("strikePlotTools").setAttribute("aria-label", text("strikePlotToolsAria"));
    $("strikeDrumSizes").setAttribute("aria-label", text("strikeDrumSize"));
    $("strikeSpectrumChoices").setAttribute("aria-label", text("strikeSpectrumModesAria"));
    $("sustainChoices").setAttribute("aria-label", text("sustainGroupAria"));
    $("sustainPlayModes").setAttribute("aria-label", text("sustainGestureAria"));
    $("sustainFrequencySlider").setAttribute("aria-label", text("sustainPitchSliderAria"));
    $("sustainFrequencyInput").setAttribute("aria-label", text("sustainPitchInputAria"));
    $("sustainEnvelopeCanvas").setAttribute("aria-label", text("sustainEnvelopeAria"));
    $("sustainWaveCanvas").setAttribute("aria-label", text("sustainWaveAria"));
    $("sustainSpectrumCanvas").setAttribute("aria-label", text("sustainSpectrumAria"));
    $("motionChoices").setAttribute("aria-label", text("motionGroupAria"));
    $("thereminTimbres").setAttribute("aria-label", text("thereminTimbresAria"));
    $("thereminVowels").setAttribute("aria-label", text("thereminVowelsAria"));
    $("sirenPatterns").setAttribute("aria-label", text("sirenPatternAria"));
    $("thereminPad").setAttribute("aria-label", text("padAria"));
    $("motionPitchCanvas").setAttribute("aria-label", text("motionPitchAria"));
    $("motionWaveCanvas").setAttribute("aria-label", text("motionWaveAria"));
    $("motionSpectrumCanvas").setAttribute("aria-label", text("motionComponentAria"));
    $("mixWaveCanvas").setAttribute("aria-label", text("mixWaveAria"));
    $("mixSpectrumCanvas").setAttribute("aria-label", text("mixSpectrumAria"));
    $("mixBaseSlider").setAttribute("aria-label", text("mixBaseSliderAria"));
    $("mixBaseInput").setAttribute("aria-label", text("mixBaseInputAria"));
    $("mixGapSlider").setAttribute("aria-label", text("mixGapSliderAria"));
    $("mixGapPresets").setAttribute("aria-label", text("mixGapPresetsAria"));
    $("mixPlotTools").setAttribute("aria-label", text("mixPlotToolsAria"));
    for (const [id, key] of [["mixZoomOut", "mixZoomOutAria"], ["mixZoomIn", "mixZoomInAria"]]) {
      $(id).setAttribute("aria-label", text(key));
      $(id).setAttribute("title", text(key));
    }
    $("mixZoomValue").setAttribute("aria-label", text("mixZoomValueAria"));
    $("mixViewLeft").setAttribute("aria-label", text("mixLeftAria"));
    $("mixViewRight").setAttribute("aria-label", text("mixRightAria"));
    $("intervalRatioSelect").setAttribute("aria-label", text("intervalPresetsAria"));
    $("intervalPlayModes").setAttribute("aria-label", text("earCompareAria"));
    $("intervalTunings").setAttribute("aria-label", text("intervalTuningAria"));
    $("intervalColors").setAttribute("aria-label", text("intervalColorAria"));
    $("intervalBaseSlider").setAttribute("aria-label", text("intervalBaseSliderAria"));
    $("intervalBaseInput").setAttribute("aria-label", text("intervalBaseInputAria"));
    $("intervalWaveCanvas").setAttribute("aria-label", text("intervalWaveAria"));
    $("intervalSpectrumCanvas").setAttribute("aria-label", text("intervalSpectrumAria"));
    $("earAdjust").setAttribute("aria-label", text("earAdjustAria"));
    $("earHarmonicsCanvas").setAttribute("aria-label", text("earHarmonicsAria"));
    $("earOctaveCanvas").setAttribute("aria-label", text("earOctaveAria"));
    $("earTaskSelect").setAttribute("aria-label", text("earTasksAria"));
    $("earSounds").setAttribute("aria-label", text("earSoundAria"));
    $("earPlayModes").setAttribute("aria-label", text("earCompareAria"));
    $("earHelpModes").setAttribute("aria-label", text("earHelpAria"));
    $("scalePresetSelect").setAttribute("aria-label", text("scalePresetsAria"));
    $("scalePlayModes").setAttribute("aria-label", text("scalePlaybackAria"));
    $("scaleTonicChoices").setAttribute("aria-label", text("scaleTonicAria"));
    $("scaleBaseSlider").setAttribute("aria-label", text("scaleBaseSliderAria"));
    $("scaleBaseInput").setAttribute("aria-label", text("scaleBaseInputAria"));
    $("scaleSpiralCanvas").setAttribute("aria-label", text("scaleSpiralAria"));
    $("scaleFourierCanvas").setAttribute("aria-label", text("scaleFourierAria"));
    $("scaleGapCanvas").setAttribute("aria-label", text("scaleGapCanvasAria"));
    $("limit5PresetSelect").setAttribute("aria-label", text("limit5PresetsAria"));
    $("limit5PlaybackModes").setAttribute("aria-label", text("limit5PlaybackAria"));
    $("limit5LatticeCanvas").setAttribute("aria-label", text("limit5LatticeAria"));
    $("limit5OctaveCanvas").setAttribute("aria-label", text("limit5OctaveAria"));
    $("limit5FourierCanvas").setAttribute("aria-label", text("limit5FourierAria"));
    $("tempTaskSelect").setAttribute("aria-label", text("tempTaskTitle"));
    $("tempSystemSelect").setAttribute("aria-label", text("tempSystemTitle"));
    $("tempNarrowSlider").setAttribute("aria-label", text("tempNarrowTitle"));
    $("tempLatticeCanvas").setAttribute("aria-label", text("tempLatticeAria"));
    $("tempPartialCanvas").setAttribute("aria-label", text("tempPartialAria"));
    $("tempKeySelect").setAttribute("aria-label", text("tempKeyTitle"));
    $("tempQualitySelect").setAttribute("aria-label", text("tempQualityTitle"));
    $("tempPlayModes").setAttribute("aria-label", text("tempPlaybackAria"));
    $("tempCircleCanvas").setAttribute("aria-label", text("tempCircleAria"));
    $("tempFifthsCanvas").setAttribute("aria-label", text("tempFifthsAria"));
    $("harmonicPresets").setAttribute("aria-label", text("harmonicPresetsAria"));
    $("harmonicSliders").setAttribute("aria-label", text("harmonicSlidersAria"));
    $("harmonicWaveCanvas").setAttribute("aria-label", text("harmonicWaveAria"));
    $("harmonicSpectrumCanvas").setAttribute("aria-label", text("harmonicSpectrumAria"));
    $("noiseChoices").setAttribute("aria-label", text("noiseChoicesAria"));
    $("noiseWaveCanvas").setAttribute("aria-label", text("noiseWaveAria"));
    $("noiseSpectrumCanvas").setAttribute("aria-label", text("noiseSpectrumAria"));
    document.querySelector(".note-presets").setAttribute("aria-label", text("presetsAria"));
    document.querySelector(".lang-group").setAttribute("aria-label", text("langGroupAria"));
    setStatus(state.status, state.error);
    setStrikeStatus(state.strikeStatus, state.strikeError);
    setSustainStatus(state.sustainStatus, state.sustainError);
    setMotionStatus(state.motionStatus, state.motionError);
    setMixStatus(state.mixStatus, state.mixError);
    setIntervalStatus(state.intervalStatus, state.intervalError);
    setEarStatus(state.earStatus, state.earError);
    setScaleStatus(state.scaleStatus, state.scaleError);
    setLimit5Status(state.limit5Status, state.limit5Error);
    setTempStatus(state.tempStatus, state.tempError);
    setHarmonicStatus(state.harmonicStatus, state.harmonicError);
    setNoiseStatus(state.noiseStatus, state.noiseError);
    renderMode();
    renderStrikeControls();
    renderSustainControls();
    renderMotionControls();
    renderMixControls();
    renderIntervalControls();
    renderEarControls();
    renderScaleControls();
    renderLimit5Controls();
    renderTempControls();
    renderHarmonicControls();
    renderNoiseControls();
    renderStrikeTime();
    renderRecordControls();
  }

  function renderControls() {
    $("frequencySlider").value = String(Math.round(model.frequencyToSlider(state.frequency)));
    $("frequencyInput").value = String(Number(state.frequency.toFixed(6)));
    $("frequencyInput").setAttribute("aria-valuetext", String(Number(state.frequency.toFixed(6))) + " " + text("unitHz"));
    const note = model.nearestNote(state.frequency);
    const differenceCents = 1200 * Math.log2(state.frequency / note.frequency);
    const approx = !state.snap && Math.abs(differenceCents) >= 0.5 ? "≈ " : "";
    $("noteLabel").textContent = approx + note.english + " · " + note.mongolian;
    $("noteLabel").title = "12-TET: " + hzText(note.frequency);
    $("snapCheck").checked = state.snap;
    $("volumeSlider").value = String(state.volume);
    $("volumeReadout").textContent = state.volume + "%";
    $("fixedTimeCheck").checked = state.fixedTime;
    $("sliderHelp").textContent = state.frequency < model.SLIDER_MIN_HZ || state.frequency > model.SLIDER_MAX_HZ ?
      text("sliderOutside") : text("sliderHint");
    document.querySelectorAll("[data-wave]").forEach(button => {
      const active = button.dataset.wave === state.waveform;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    $("playButton").classList.toggle("playing", state.playing);
    $("playButton").setAttribute("aria-pressed", String(state.playing));
    $("playIcon").textContent = state.playing ? "■" : "▶";
    $("playLabel").textContent = state.playing ? text("stopTone") : text("play");
    $("playCaption").textContent = state.playing ? text("stopCaption") : text("playCaption");
  }

  function renderStrikeControls() {
    const maxPitch = strikeMaxPitch();
    const minPitch = strikeMinPitch();
    $("strikeFrequencySlider").value = String(Math.round(1000 * Math.log(state.strikePitch / minPitch) / Math.log(maxPitch / minPitch)));
    $("strikeFrequencyInput").value = String(Number(state.strikePitch.toFixed(2)));
    $("strikeFrequencyInput").min = String(minPitch);
    $("strikeFrequencyInput").max = String(maxPitch);
    $("strikePitchMin").textContent = hzText(minPitch);
    $("strikePitchMax").textContent = hzText(maxPitch);
    const note = model.nearestNote(state.strikePitch);
    const differenceCents = 1200 * Math.log2(state.strikePitch / note.frequency);
    const approx = !state.strikeSnap && Math.abs(differenceCents) >= 0.5 ? "≈ " : "";
    $("strikeNote").textContent = approx + note.english + " · " + note.mongolian;
    $("strikeSnap").checked = state.strikeSnap;
    $("strikePitchGroup").hidden = state.strikeKind === "kick" ||
      (state.strikeKind === "pluck" && state.strikeGuitarPlay === "strum");
    $("strikeGuitarPlayModes").hidden = state.strikeKind !== "pluck";
    $("strikePianoTypeGroup").hidden = state.strikeKind !== "piano";
    $("strikePianoType").value = state.strikePianoVoice;
    $("strikePianoPlayModes").hidden = !isPianoStrike();
    $("strikeMandolinPlayModes").hidden = !isMandolinStrike();
    $("strikePianoHint").hidden = state.strikeKind !== "piano";
    $("strikePianoHint").textContent = text({ acoustic: "strikePianoTouchHint", electric: "strikePianoElectricHint",
      chimes: "strikePitchedChimesHint", marimba: "strikeMarimbaHint", xylophone: "strikeXylophoneHint",
      mandolin: "strikeMandolinHint", harp: "strikeHarpHint" }[state.strikePianoVoice]);
    $("strikeButton").hidden = (state.strikeKind === "kick" && state.strikeDrumView === "kit") ||
      state.strikeKind !== "kick" && (state.strikeKind !== "piano" || isPianoStrike() || isMandolinStrike());
    $("strikeChordGroup").hidden = state.strikeKind !== "pluck";
    $("strikeGuitarPattern").value = state.strikeGuitarPattern;
    $("strikePluckPositionGroup").hidden = state.strikeKind !== "pluck";
    $("strikePluckPosition").value = String(Math.round(100 * state.strikePluckPosition));
    $("strikePluckPositionValue").textContent = Math.round(100 * state.strikePluckPosition) + "%";
    $("strikeDrumSizeGroup").hidden = state.strikeKind !== "kick";
    $("strikeDrumKitGroup").hidden = state.strikeDrumView !== "kit";
    $("strikeDrumModelsGroup").hidden = state.strikeDrumView !== "models";
    document.querySelectorAll("[data-strike-drum-view]").forEach(button => {
      const selected = button.dataset.strikeDrumView === state.strikeDrumView;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.textContent = text(selected && button.dataset.strikeDrumView === "kit" ?
        "strikeDrumKit" : button.dataset.strikeDrumView === "kit" ? "strikeDrumKit" : "strikeDrumModels");
    });
    document.querySelectorAll("[data-strike-kit-drum]").forEach(button => {
      const selected = button.dataset.strikeKitDrum === state.strikeDrumKit;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.textContent = text({ kick: "strikeKitKick", snare: "strikeKitSnare", rimshot: "strikeKitRimshot",
        floorTom: "strikeKitFloorTom", midTom: "strikeKitMidTom", highTom: "strikeKitHighTom",
        hat: "strikeKitHat", halfHat: "strikeKitHalfHat", openHat: "strikeKitOpenHat", ride: "strikeKitRide",
        crash: "strikeKitCrash", woodblock: "strikeKitWoodblock" }[button.dataset.strikeKitDrum]);
    });
    $("strikeHatPedal").value = String(state.strikeHatPedal);
    $("strikeHatPedalValue").textContent = state.strikeHatPedal + "%";
    $("strikeDrumVoice").value = state.strikeDrumVoice;
    $("strikeDrumTensionGroup").hidden = !["membrane", "snare"].includes(state.strikeDrumVoice);
    $("strikeDrumTension").value = String(Math.round(state.strikeDrumTension * 100));
    $("strikeDrumTensionValue").textContent = Math.round(state.strikeDrumTension * 100) + "%";
    const drumHz = transientModel.drumReferenceHz(state.strikeDrumSize,
      state.strikeDrumTension, state.strikeDrumVoice);
    $("strikeDrumFrequencies").textContent = drumHz === null ?
      text("strikeNoSinglePitch") : hzText(Math.round(drumHz));
    $("strikeDrumHint").textContent = text({ membrane: "strikeDrumHint",
      snare: "strikeSnareHint", cymbal: "strikeCymbalHint",
      steelpan: "strikePanHint", chimes: "strikeChimesHint",
      woodblock: "strikeWoodHint" }[state.strikeDrumVoice]);
    $("strikeStrength").value = String(state.strikeStrength);
    $("strikeStrengthValue").textContent = state.strikeStrength + "%";
    $("strikeDecay").value = String(state.strikeDecay);
    $("strikeDecayValue").textContent = secondsText(state.strikeDecay);
    const pitchedDescription = { electric: "strikeDescElectric", chimes: "strikeDescChimes",
      marimba: "strikeDescMarimba", xylophone: "strikeDescXylophone", mandolin: "strikeDescMandolin",
      harp: "strikeDescHarp" }[state.strikePianoVoice];
    $("strikeDescription").textContent = state.strikeKind === "piano" && pitchedDescription ?
      text(pitchedDescription) : text("strikeDesc")[state.strikeKind];
    $("strikeButtonLabel").textContent = text(state.strikeKind === "piano" &&
      state.strikePianoVoice === "harp" ? "strikePluckButton" : "strikeKickButton");
    const strikePlayLabels = { single: "strikePluckButton", strum: "strikeStrumButton",
      press: "strikePianoButton", tap: "strikePianoTapButton",
      pick: "strikeMandolinPick", tremolo: "strikeMandolinTremolo" };
    document.querySelectorAll("[data-strike-play]").forEach(button => {
      button.textContent = "▶ " + text(strikePlayLabels[button.dataset.strikePlay]);
    });
    document.querySelectorAll("[data-guitar-chord]").forEach(button => {
      const selected = button.dataset.guitarChord === state.strikeChord;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-strike]").forEach(button => {
      const selected = button.dataset.strike === state.strikeKind;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-drum-size]").forEach(button => {
      const selected = button.dataset.drumSize === state.strikeDrumSize;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      const index = ["large", "medium", "small"].indexOf(button.dataset.drumSize);
      const keys = { membrane: ["strikeLarge", "strikeMedium", "strikeSmall"],
        snare: ["strikeSnareLow", "strikeSnareMid", "strikeSnareHigh"],
        cymbal: ["strikeCymbalCrash", "strikeCymbalRide", "strikeCymbalHat"],
        steelpan: ["strikePanC", "strikePanE", "strikePanG"],
        chimes: ["strikeChimeC", "strikeChimeE", "strikeChimeG"],
        woodblock: ["strikeWoodLow", "strikeWoodMid", "strikeWoodHigh"] };
      button.textContent = text(keys[state.strikeDrumVoice][index]);
    });
  }

  function renderSustainControls() {
    const family = heldFamily(state.sustainKind);
    const instrumentSelect = $("sustainInstrument");
    if (instrumentSelect.dataset.family !== family || instrumentSelect.dataset.language !== state.language) {
      const kinds = { air: ["flute", "clarinet"], bow: ["violin", "morin"],
        organ: ["organ-stopped", "organ-principal"], reed: ["accordion", "bayan"] }[family];
      const names = { flute: "sustainFlute", clarinet: "sustainClarinet",
        violin: "sustainViolin", morin: "sustainMorin",
        "organ-stopped": "sustainOrganStopped", "organ-principal": "sustainOrganPrincipal",
        accordion: "sustainAccordion", bayan: "sustainBayan" };
      instrumentSelect.replaceChildren(...kinds.map(kind => {
        const option = document.createElement("option");
        option.value = kind;
        option.textContent = text(names[kind]);
        return option;
      }));
      instrumentSelect.dataset.family = family;
      instrumentSelect.dataset.language = state.language;
    }
    instrumentSelect.value = state.sustainKind;
    const [minHz, maxHz] = heldModelFor(state.sustainKind).rangeFor(state.sustainKind);
    $("sustainFrequencyInput").min = String(minHz);
    $("sustainFrequencyInput").max = String(maxHz);
    $("sustainMinHz").textContent = hzText(minHz);
    $("sustainMaxHz").textContent = hzText(maxHz);
    $("sustainFrequencySlider").value = String(Math.round(heldModelFor(state.sustainKind).hzToSlider(state.sustainPitch, state.sustainKind)));
    $("sustainFrequencyInput").value = String(Number(state.sustainPitch.toFixed(2)));
    const note = model.nearestNote(state.sustainPitch);
    const cents = 1200 * Math.log2(state.sustainPitch / note.frequency);
    $("sustainNote").textContent = (!state.sustainSnap && Math.abs(cents) >= .5 ? "≈ " : "") +
      note.english + " · " + note.mongolian;
    $("sustainSnap").checked = state.sustainSnap;
    $("sustainDescription").textContent = text("sustainDesc")[state.sustainKind];
    $("sustainBreathGroup").hidden = family === "bow";
    $("sustainBowGroup").hidden = family !== "bow";
    $("sustainBreathLabel").textContent = text(family === "organ" ? "sustainOrganPressure" :
      family === "reed" ? "sustainReedPressure" : "sustainBreath");
    $("sustainBreathHint").textContent = text(family === "organ" ? "sustainOrganPressureHint" :
      family === "reed" ? "sustainReedPressureHint" :
        state.sustainKind === "clarinet" ? "sustainClarinetBreathHint" : "sustainBreathHint");
    $("sustainBreath").value = String(state.sustainBreath);
    $("sustainBreathValue").textContent = state.sustainBreath + "%";
    $("sustainBowPressure").value = String(state.sustainBowPressure);
    $("sustainBowValue").textContent = state.sustainBowPressure + "%";
    $("sustainDetailHint").textContent = text(i3HeldModel.KINDS.includes(state.sustainKind) ? "sustainI3DetailHint" : state.sustainKind === "flute" ?
      "sustainFluteDetailHint" : state.sustainKind === "clarinet" ?
        "sustainClarinetDetailHint" : "sustainDetailHint");
    $("sustainChallengeText").textContent = text(family === "organ" ? "sustainOrganChallenge" : family === "reed" ? "sustainReedChallenge" : state.sustainKind === "flute" ?
      "sustainChallenge" : state.sustainKind === "clarinet" ?
        "sustainClarinetChallenge" : "sustainBowChallenge");
    $("sustainAttack").value = String(state.sustainAttack);
    $("sustainAttackValue").textContent = secondsFixedText(state.sustainAttack);
    $("sustainRelease").value = String(state.sustainRelease);
    $("sustainReleaseValue").textContent = secondsFixedText(state.sustainRelease);
    $("sustainVolume").value = String(state.sustainVolume);
    $("sustainVolumeValue").textContent = state.sustainVolume + "%";
    $("sustainEnvelopeBadge").textContent = secondsFixedText(state.sustainAttack) + " / " +
      secondsFixedText(state.sustainRelease);
    $("sustainDetailBadge").textContent = hzText(state.sustainPitch);
    document.querySelectorAll("[data-sustain-family]").forEach(button => {
      const selected = button.dataset.sustainFamily === family;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    for (const [id, gesture, label] of [["sustainHoldButton", "hold", "sustainHold"],
      ["sustainToggleButton", "toggle", "sustainToggle"]]) {
      const button = $(id);
      const active = state.sustainPlaying && state.sustainGesture === gesture;
      button.classList.toggle("playing", active);
      button.setAttribute("aria-pressed", String(active));
      button.textContent = (active ? "■ " : "▶ ") + text(label);
    }
  }

  function stopSustainSound(immediate = false, status = "sustainStopped") {
    sustainAudio.stop(immediate);
    sustainPointerId = null;
    sustainKeyboardHeld = false;
    state.sustainPlaying = false;
    setSustainStatus(status);
    renderSustainControls();
  }

  function releaseSustainSound() {
    sustainAudio.release();
    state.sustainPlaying = false;
    setSustainStatus("sustainReleased");
    renderSustainControls();
  }

  async function startSustainSound() {
    if (state.mode !== "sustain" || state.sustainPlaying) return;
    setSustainStatus("sustainStarting");
    try {
      const info = await sustainAudio.start();
      if (!info) return;
      state.sustainPlaying = true;
      setSustainStatus(state.sustainGesture === "hold" ? "sustainPlayingHold" : "sustainPlayingToggle");
      renderSustainControls();
    } catch (error) {
      stopSustainSound(true, error.message === "unsupported" ? "sustainUnsupported" : "sustainBlocked");
      setSustainStatus(error.message === "unsupported" ? "sustainUnsupported" : "sustainBlocked", true);
    }
  }

  function selectSustainKind(kind) {
    if (![...sustainModel.KINDS, ...i3HeldModel.KINDS].includes(kind) || state.sustainKind === kind) return;
    stopSustainSound();
    state.sustainKind = kind;
    state[{ air: "sustainAirKind", bow: "sustainBowKind", organ: "sustainOrganKind",
      reed: "sustainReedKind" }[heldFamily(kind)]] = kind;
    const [minHz, maxHz] = heldModelFor(kind).rangeFor(kind);
    state.sustainPitch = Math.min(maxHz, Math.max(minHz, state.sustainPitch));
    state.sustainAttack = heldModelFor(kind).defaults(kind).attack;
    state.sustainRelease = heldModelFor(kind).defaults(kind).release;
    setSustainStatus("sustainReady");
    renderSustainControls();
    drawPlots();
  }

  function setSustainPitch(value) {
    const hz = Number(value);
    const [minHz, maxHz] = heldModelFor(state.sustainKind).rangeFor(state.sustainKind);
    if (!Number.isFinite(hz) || hz < minHz || hz > maxHz) {
      setSustainStatus("sustainInvalid", true);
      renderSustainControls();
      return;
    }
    state.sustainPitch = state.sustainSnap ?
      Math.max(minHz, Math.min(maxHz, model.snapFrequency(hz))) : hz;
    sustainAudio.update();
    if (state.sustainStatus === "sustainInvalid") setSustainStatus("sustainReady");
    renderSustainControls();
    drawPlots();
  }

  function resetSustain() {
    stopSustainSound();
    state.sustainKind = "flute";
    state.sustainAirKind = "flute";
    state.sustainBowKind = "violin";
    state.sustainOrganKind = "organ-stopped";
    state.sustainReedKind = "accordion";
    state.sustainGesture = "hold";
    state.sustainPitch = 440;
    state.sustainSnap = false;
    state.sustainBreath = sustainModel.DEFAULT_BREATH;
    state.sustainBowPressure = sustainModel.DEFAULT_BOW_PRESSURE;
    state.sustainAttack = sustainModel.defaults("flute").attack;
    state.sustainRelease = sustainModel.defaults("flute").release;
    state.sustainVolume = 40;
    setSustainStatus("sustainReady");
    renderSustainControls();
    drawPlots();
  }

  function setFrequency(input) {
    const value = Number(input);
    if (!Number.isFinite(value) || value < model.INPUT_MIN_HZ || value > model.INPUT_MAX_HZ) {
      setStatus("invalid", true);
      renderControls();
      return;
    }
    state.frequency = state.snap ? model.snapFrequency(value) : value;
    audio.changeFrequency();
    if (state.status === "invalid") setStatus(state.playing ? "playing" : "ready");
    renderControls();
    drawPlots();
  }

  function stopSound(immediate = false, message = "stopped") {
    audio.stop(immediate);
    state.playing = false;
    setStatus(message);
    renderControls();
  }

  function stopAllAudio(immediate = false, message = "stopped") {
    if (microphone) microphone.stop();
    if (analysis) analysis.stop();
    if (compare) compare.stop();
    if (compose && compose.hasSession()) compose.stop();
    if (ensemble && ensemble.hasSession()) ensemble.stop();
    strikeTicket++;
    transientAudio.stop(immediate);
    stopStrikeFollow();
    renderStrikeControls();
    stopSustainSound(immediate, message === "hidden" ? "sustainHidden" : "sustainStopped");
    stopMotionSound(immediate, message === "hidden" ? "motionHidden" : "motionStopped");
    stopMixSound(immediate, message === "hidden" ? "mixHidden" : "mixStopped");
    stopIntervalSound(immediate, message === "hidden" ? "intervalHidden" : "intervalStopped");
    stopEarSound(immediate, message === "hidden" ? "earHidden" : "earStopped");
    stopScaleSound(immediate, message === "hidden" ? "scaleHidden" : "scaleStopped");
    stopLimit5Sound(immediate, message === "hidden" ? "limit5Hidden" : "limit5Stopped");
    stopTempSound(immediate, message === "hidden" ? "tempHidden" : "tempStopped");
    stopHarmonicSound(immediate);
    stopNoiseSound(immediate);
    stopSound(immediate, message);
    setStrikeStatus(message === "hidden" ? "strikeHidden" : "strikeStopped");
    // The microphone controller owns its standalone screen; reassert the
    // three-way Analysis view after its Stop/render side effect.
    updateAnalysisScreens();
  }

  async function toggleSound() {
    if (state.mode !== "pure" || state.pureKind !== "waves") return;
    if (state.playing) {
      stopSound();
      return;
    }
    setStatus("starting");
    const generation = audio.generation + 1;
    try {
      if (await audio.start()) {
        state.playing = true;
        setStatus("playing");
        renderControls();
      }
    } catch (error) {
      if (generation !== audio.generation || state.mode !== "pure" || state.pureKind !== "waves") return;
      audio.stop(true);
      state.playing = false;
      setStatus(error.message === "unsupported" ? "unsupported" : "blocked", true);
      renderControls();
    }
  }

  function selectWaveform(waveform) {
    if (!model.WAVEFORMS.includes(waveform) || waveform === state.waveform) return;
    state.waveform = waveform;
    audio.changeWaveform();
    renderTexts();
    renderControls();
    drawPlots();
  }

  function selectMode(mode) {
    if (mode === state.mode || !["pure", "strike", "sustain", "motion", "mix", "tuning", "compose", "analysis"].includes(mode)) return;
    stopAllAudio(false);
    state.mode = mode;
    if (mode === "pure") {
      if (state.pureKind === "harmonics") setHarmonicStatus("harmonicReady");
      else setStatus("ready");
    }
    if (mode === "sustain") setSustainStatus("sustainReady");
    if (mode === "motion") setMotionStatus("motionReady");
    if (mode === "mix") {
      if (state.mixKind === "noise") setNoiseStatus("noiseReady");
      else setMixStatus("mixReady");
    }
    if (mode === "tuning") {
      if (state.tuningKind === "intervals") setIntervalStatus("intervalReady");
      else if (state.tuningKind === "ear") setEarStatus("earReady");
      else if (state.tuningKind === "scales") setScaleStatus("scaleReady");
      else if (state.tuningKind === "limit5") setLimit5Status("limit5Ready");
      else setTempStatus("tempReady");
    }
    renderTexts();
    drawPlots();
  }

  function selectComposeSubtab(subtab, focusPicker = false) {
    if (!["solo", "ensemble"].includes(subtab) || subtab === state.composeSubtab) return;
    stopAllAudio();
    state.composeSubtab = subtab;
    if (projectFiles) projectFiles.modeChanged();
    renderMode();
    // The active card owns its picker. Keep keyboard focus in the newly visible
    // card instead of leaving it on a button in the now-hidden workspace.
    if (focusPicker) {
      const button = Array.from(document.querySelectorAll("[data-compose-subtab]")).find(choice =>
        choice.dataset.composeOwner === subtab && choice.dataset.composeSubtab === subtab);
      if (button) button.focus({ preventScroll: true });
    }
  }

  function selectPureKind(kind) {
    if (state.mode !== "pure" || !["waves", "harmonics"].includes(kind) || kind === state.pureKind) return;
    stopAllAudio();
    state.pureKind = kind;
    if (kind === "waves") setStatus("ready");
    else setHarmonicStatus("harmonicReady");
    renderTexts();
    drawPlots();
  }

  function selectMixKind(kind) {
    if (!["beats", "noise"].includes(kind) || kind === state.mixKind) return;
    stopAllAudio();
    state.mixKind = kind;
    if (kind === "beats") setMixStatus("mixReady");
    if (kind === "noise") setNoiseStatus("noiseReady");
    renderTexts();
    drawPlots();
  }

  function selectTuningKind(kind) {
    if (!["intervals", "ear", "scales", "limit5", "temperaments"].includes(kind) || kind === state.tuningKind) return;
    stopAllAudio();
    state.tuningKind = kind;
    if (kind === "intervals") setIntervalStatus("intervalReady");
    else if (kind === "ear") setEarStatus("earReady");
    else if (kind === "scales") setScaleStatus("scaleReady");
    else if (kind === "limit5") setLimit5Status("limit5Ready");
    else setTempStatus("tempReady");
    renderTexts();
    drawPlots();
  }

  function selectStrikeKind(kind) {
    if (!["pluck", "kick", "piano"].includes(kind) || kind === state.strikeKind) return;
    stopStrikeForEdit();
    if (state.strikeKind !== "kick") state.strikePitchByVoice[strikePitchKey()] = state.strikePitch;
    state.strikeStrengthByKind[state.strikeKind] = state.strikeStrength;
    state.strikeKind = kind;
    if (kind !== "kick") restoreStrikePitch();
    state.strikeStrength = state.strikeStrengthByKind[kind];
    state.strikeDecay = kind === "pluck" ? 0.65 : kind === "piano" ? pitchedStrikeDecay() :
      state.strikeDrumView === "kit" ? activeStrikeDrumRecipe().decay :
      { membrane: .3, snare: .33, cymbal: .55, steelpan: .8, chimes: .7,
        woodblock: .24 }[state.strikeDrumVoice];
    state.strikeCursor = 0;
    state.strikeViewStart = 0;
    state.strikeViewSpan = 3;
    state.strikeSpectrumView = "local";
    setStrikeStatus("strikeReady");
    renderStrikeControls();
    drawPlots();
  }

  function setStrikePitch(value) {
    const hz = Number(value);
    if (!Number.isFinite(hz) || hz < strikeMinPitch() || hz > strikeMaxPitch()) {
      setStrikeStatus("strikeInvalid", true);
      renderStrikeControls();
      return;
    }
    stopStrikeForEdit();
    state.strikePitch = state.strikeSnap ?
      Math.max(strikeMinPitch(), Math.min(strikeMaxPitch(), model.snapFrequency(hz))) : hz;
    state.strikePitchByVoice[strikePitchKey()] = state.strikePitch;
    if (state.strikeStatus === "strikeInvalid") setStrikeStatus("strikeReady");
    renderStrikeControls();
    drawPlots();
  }

  async function triggerStrike(mode = "kick", modelChanged = false) {
    if (state.mode !== "strike") return;
    const isGuitar = state.strikeKind === "pluck";
    const isPiano = isPianoStrike();
    const isMandolin = isMandolinStrike();
    if (isGuitar && !["single", "strum"].includes(mode) ||
        isPiano && !["press", "tap"].includes(mode) ||
        isMandolin && !["pick", "tremolo"].includes(mode) ||
        !isGuitar && !isPiano && !isMandolin && mode !== "kick") return;
    if (isGuitar) {
      modelChanged ||= state.strikeGuitarPlay !== mode;
      state.strikeGuitarPlay = mode;
    } else if (isPiano) {
      modelChanged ||= state.strikePianoTouch !== mode;
      state.strikePianoTouch = mode;
    } else if (isMandolin) {
      modelChanged ||= state.strikeMandolinStyle !== mode;
      state.strikeMandolinStyle = mode;
    }
    // Capture the recipe before awaiting AudioContext startup. Two rapid taps
    // with different pads must not both adopt the newest selected recipe.
    const recipe = strikeRecipe();
    const strength = state.strikeStrength;
    const ticket = ++strikeTicket;
    setStrikeStatus("strikeStarting");
    renderStrikeControls();
    if (modelChanged) {
      overallSpectrumCache = null;
      drawPlots();
    }
    try {
      const info = await transientAudio.trigger(recipe, strength);
      if (info && ticket === strikeTicket) {
        setStrikeStatus("strikeDone");
        startStrikeFollow(info);
      }
    } catch (error) {
      if (ticket !== strikeTicket) return;
      strikeTicket++;
      transientAudio.stop(true);
      stopStrikeFollow();
      setStrikeStatus(error.message === "unsupported" ? "strikeUnsupported" : "strikeBlocked", true);
    }
  }

  function resetStrike() {
    stopStrikeForEdit();
    state.strikeKind = "pluck";
    state.strikePitch = 220;
    state.strikeSnap = false;
    state.strikeDrumSize = "medium";
    state.strikeDrumVoice = "membrane";
    state.strikeDrumView = "kit";
    state.strikeDrumKit = "kick";
    state.strikeHatPedal = 100;
    state.strikeDrumTension = 1;
    state.strikeGuitarPlay = "single";
    state.strikeChord = "em";
    state.strikeGuitarPattern = "down";
    state.strikePluckPosition = .22;
    state.strikePianoVoice = "acoustic";
    state.strikePitchByVoice = { pluck: 220, acoustic: 220, electric: 220, chimes: 659.255114,
      marimba: 220, xylophone: 523.251131, mandolin: 440 };
    state.strikePianoTouch = "press";
    state.strikeMandolinStyle = "pick";
    state.strikeStrength = 55;
    state.strikeStrengthByKind = { pluck: 55, kick: 78, piano: 55 };
    state.strikeDecay = 0.65;
    state.strikeCursor = 0;
    state.strikeViewStart = 0;
    state.strikeViewSpan = 3;
    state.strikeSpectrumView = "local";
    setStrikeStatus("strikeReady");
    renderStrikeControls();
    drawPlots();
  }

  function setLanguage(language) {
    state.language = language;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", language);
    window.history.replaceState(null, "", url);
    renderTexts();
    renderControls();
    drawPlots();
  }

  function reset() {
    stopSound();
    state.waveform = "sine";
    state.frequency = 440;
    state.volume = 40;
    state.snap = false;
    state.fixedTime = true;
    $("settings").open = false;
    renderTexts();
    renderControls();
    drawPlots();
  }

  function plotContext(canvas) {
    const width = Math.max(220, Math.round(canvas.getBoundingClientRect().width));
    const height = Math.max(120, Math.round(canvas.getBoundingClientRect().height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelsWide = Math.round(width * dpr), pixelsHigh = Math.round(height * dpr);
    // Assigning canvas dimensions reallocates its backing store and may
    // trigger a ResizeObserver; don't do it on every slider input frame.
    if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
    if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fbfdff";
    ctx.fillRect(0, 0, width, height);
    return { ctx: ctx, width: width, height: height };
  }

  function drawFrame(ctx, width, height, left, right, top, bottom) {
    const spanX = right - left, spanY = bottom - top;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e8eff7";
    for (let j = 0; j <= 4; j++) {
      const y = top + spanY * j / 4;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const x = left + spanX * i / 4;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    ctx.strokeStyle = "#a9bdd3";
    ctx.beginPath();
    ctx.moveTo(left, (top + bottom) / 2);
    ctx.lineTo(right, (top + bottom) / 2);
    ctx.stroke();
    ctx.fillStyle = "#788da2";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
  }

  function drawWave() {
    const data = plotContext($("waveCanvas"));
    const ctx = data.ctx, width = data.width, height = data.height;
    const left = 34, right = width - 15, top = 26, bottom = height - 30;
    drawFrame(ctx, width, height, left, right, top, bottom);
    const duration = state.fixedTime ? 0.020 : 4 / state.frequency;
    const periodMs = 1000 / state.frequency;
    $("periodBadge").textContent = "T = " + millisecondsText(periodMs);
    $("windowLabel").textContent = "0–" + millisecondsText(duration * 1000) + " · " +
      frequencyText(duration * state.frequency) + " " + text("cyclesUnit");
    $("waveSubtitle").textContent = text(state.fixedTime ? "waveSubtitle" : "waveSubtitleZoom");
    $("fundamentalBadge").textContent = "f₀ = " + hzText(state.frequency);
    ctx.fillStyle = "#7489a1";
    ctx.textAlign = "left";
    ctx.fillText(text("amplitude"), 9, 13);
    const middle = (top + bottom) / 2, amplitude = (bottom - top) * 0.46 * Math.sqrt(state.volume / 100);
    ctx.strokeStyle = "#367bd1";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    // Avoid undersampling dense high-frequency traces on a fixed time axis.
    const points = Math.max(480, Math.round((right - left) * 1.5),
      Math.ceil(duration * state.frequency * 12));
    for (let i = 0; i <= points; i++) {
      const fraction = i / points;
      const phase = fraction * duration * state.frequency;
      const y = middle - amplitude * model.sampleWave(state.waveform, phase);
      const x = left + (right - left) * fraction;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#788da2";
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const x = left + (right - left) * i / 4;
      ctx.fillText(millisecondsText(duration * 250 * i), x, height - 12);
    }
  }

  function drawSpectrum() {
    const data = plotContext($("spectrumCanvas"));
    const ctx = data.ctx, width = data.width, height = data.height;
    const left = 36, right = width - 12, top = 14, bottom = height - 32;
    const spanX = right - left, spanY = bottom - top;
    ctx.strokeStyle = "#e8eff7";
    ctx.lineWidth = 1;
    for (let level = 0; level <= 4; level++) {
      const y = top + spanY * level / 4;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#8297aa";
    ctx.fillText("1", left - 8, top + 4);
    ctx.fillText("0", left - 8, bottom + 3);
    const count = 12, slot = spanX / count;
    for (let n = 1; n <= count; n++) {
      const strength = model.harmonicMagnitude(state.waveform, n);
      if (strength <= 0) continue;
      const barWidth = Math.max(6, Math.min(28, slot * 0.48));
      const barHeight = strength * (spanY - 4);
      ctx.fillStyle = n === 1 ? "#4383d0" : "#27a59f";
      ctx.fillRect(left + (n - .5) * slot - barWidth / 2, bottom - barHeight, barWidth, barHeight);
    }
    ctx.fillStyle = "#758aa0";
    ctx.textAlign = "center";
    for (const n of [1, 4, 8, 12]) {
      const x = left + (n - .5) * slot;
      const hz = n * state.frequency;
      const label = hz < 1000 ? hzText(Math.round(hz)) : kHzText(hz, true);
      ctx.fillText(label, x, height - 13);
    }
  }

  function drawStrikeWave() {
    const { ctx, width, height } = plotContext($("strikeWaveCanvas"));
    const left = 44, right = width - 15, top = 26, bottom = height - 30;
    const span = state.strikeViewSpan, start = state.strikeViewStart;
    const plotWidth = right - left, middle = (top + bottom) / 2;
    const amplitude = (bottom - top) * 0.45 * Math.sqrt(state.strikeStrength / 100);
    drawFrame(ctx, width, height, left, right, top, bottom);
    $("strikeDurationBadge").textContent = "τ = " + secondsText(state.strikeDecay);
    $("strikeWindowLabel").textContent = strikeTimeText(start) + " – " + strikeTimeText(start + span);
    $("strikeViewPreset").value = [3, 1, 0.2, 0.02].some(value => Math.abs(span - value) < 1e-7) ? String(span) : "custom";
    $("strikeViewZoomIn").disabled = span <= 0.0101;
    $("strikeViewZoomOut").disabled = span >= 2.999;
    $("strikeViewLeft").disabled = start <= 0.000001;
    $("strikeViewRight").disabled = start + span >= 2.999999;

    // The shaded Fourier window is fixed at 128 ms, independently of waveform zoom.
    const windowHalf = spectrumModel.WINDOW_SECONDS / 2;
    const from = Math.max(start, state.strikeCursor - windowHalf);
    const to = Math.min(start + span, state.strikeCursor + windowHalf);
    if (to > from) {
      ctx.fillStyle = "rgba(59, 129, 206, .09)";
      ctx.fillRect(left + (from - start) / span * plotWidth, top,
        (to - from) / span * plotWidth, bottom - top);
    }

    const recipe = strikeRecipe();
    const sampleAt = time => transientModel.plottedSampleAt(recipe.kind,
      time, recipe.pitchHz, recipe.decaySec, recipe.kickSize, recipe.options);
    ctx.strokeStyle = "#1a9b91";
    ctx.lineJoin = "round";
    if (span <= 0.12) {
      // At fine scales, every oscillation is drawn directly, with oversampling.
      const topFrequency = strikeSpectrumMaxHz();
      const points = Math.min(16000, Math.max(700, Math.round(plotWidth * 2),
        Math.ceil(span * topFrequency * 10)));
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const fraction = i / points;
        const x = left + fraction * plotWidth;
        const y = middle - amplitude * sampleAt(start + fraction * span);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      // Vertical min/max traces preserve oscillation envelopes at coarse scale.
      // Sparse point-to-point sampling would falsely show slow aliasing here.
      ctx.lineWidth = 1.45;
      const columns = Math.max(1, Math.floor(plotWidth));
      for (let i = 0; i < columns; i++) {
        let min = 1, max = -1;
        for (let j = 0; j <= 16; j++) {
          const sample = sampleAt(start + span * (i + j / 16) / columns);
          min = Math.min(min, sample);
          max = Math.max(max, sample);
        }
        const x = left + i;
        ctx.beginPath();
        ctx.moveTo(x, middle - amplitude * min);
        ctx.lineTo(x, middle - amplitude * max);
        ctx.stroke();
      }
    }
    if (state.strikeCursor >= start && state.strikeCursor <= start + span) {
      const x = left + (state.strikeCursor - start) / span * plotWidth;
      ctx.strokeStyle = "#d18c35";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    ctx.fillStyle = "#7489a1";
    ctx.textAlign = "left";
    ctx.fillText(text("amplitude"), 9, 13);
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const x = left + plotWidth * i / 4;
      ctx.fillText(strikeTimeText(start + span * i / 4), x, height - 12);
    }
  }

  function drawStrikeSpectrum() {
    const { ctx, width, height } = plotContext($("strikeSpectrumCanvas"));
    const left = 44, right = width - 16, top = 16, bottom = height - 30;
    const w = right - left, h = bottom - top;
    let spectrum;
    if (state.strikeSpectrumView === "overall") {
      if (!overallSpectrumCache) overallSpectrumCache = spectrumModel.spectrumOverall(transientModel, strikeRecipe());
      spectrum = overallSpectrumCache;
    } else spectrum = spectrumModel.spectrumAt(transientModel, strikeRecipe(), state.strikeCursor);
    renderStrikeTime();
    document.querySelectorAll("[data-spectrum-view]").forEach(button => {
      const selected = state.strikeSpectrumView === button.dataset.spectrumView;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const maxHz = strikeSpectrumMaxHz();
    ctx.strokeStyle = "#e8eff7";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = top + i * h / 4;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      const x = left + i * w / 4;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    }
    const gain = state.strikeStrength / 100;
    ctx.strokeStyle = "#2d88c8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const count = Math.min(spectrum.magnitudes.length - 1, Math.floor(maxHz / spectrum.binHz));
    for (let i = 0; i <= count; i++) {
      const frequency = i * spectrum.binHz;
      // Fixed decibel scale: a fading note must not be normalized back to full height.
      const magnitude = spectrum.magnitudes[i] * gain;
      const decibels = 20 * Math.log10(Math.max(1e-6, magnitude) / 0.5);
      const level = Math.max(0, Math.min(1, (decibels + 60) / 60));
      const x = left + frequency / maxHz * w, y = bottom - level * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#7489a1";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("0 dB", left - 5, top + 3);
    ctx.fillText("−60", left - 5, bottom);
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const hz = maxHz * i / 4;
      ctx.fillText(hz >= 1000 ? kHzText(hz) : hzText(Math.round(hz)),
        left + i * w / 4, height - 12);
    }
  }

  function drawSustainEnvelope() {
    const { ctx, width, height } = plotContext($("sustainEnvelopeCanvas"));
    const left = 42, right = width - 16, top = 21, bottom = height - 31;
    const w = right - left, h = bottom - top;
    const span = sustainModel.EXAMPLE_HOLD + sustainModel.MAX_RELEASE + .2;
    const xAt = time => left + (time / span) * w;
    const yAt = level => bottom - level * h * .91;
    drawFrame(ctx, width, height, left, right, top, bottom);
    const count = 360;
    ctx.fillStyle = "rgba(40, 150, 154, .12)";
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    for (let i = 0; i <= count; i++) {
      const time = span * i / count;
      ctx.lineTo(xAt(time), yAt(sustainModel.envelopeAt(time,
        state.sustainAttack, state.sustainRelease)));
    }
    ctx.lineTo(right, bottom);
    ctx.fill();
    ctx.strokeStyle = "#218f9b";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
      const time = span * i / count;
      if (!i) ctx.moveTo(left, yAt(0));
      else ctx.lineTo(xAt(time), yAt(sustainModel.envelopeAt(time,
        state.sustainAttack, state.sustainRelease)));
    }
    ctx.stroke();
    const releaseX = xAt(sustainModel.EXAMPLE_HOLD);
    ctx.strokeStyle = "#d58a3b";
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(releaseX, top); ctx.lineTo(releaseX, bottom); ctx.stroke();
    ctx.fillStyle = "#7489a1";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("1", left - 6, yAt(1));
    ctx.fillText("0", left - 6, bottom);
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const seconds = span * i / 4;
      ctx.fillText(secondsText(seconds), xAt(seconds), height - 12);
    }
  }

  function drawSustainWave() {
    const { ctx, width, height } = plotContext($("sustainWaveCanvas"));
    const left = 38, right = width - 13, top = 24, bottom = height - 28;
    const middle = (top + bottom) / 2, amp = (bottom - top) * .43;
    const w = right - left, span = .02;
    drawFrame(ctx, width, height, left, right, top, bottom);
    const count = Math.max(700, Math.ceil(state.sustainPitch * 8 * span * 10));
    const flute = state.sustainKind === "flute", clarinet = state.sustainKind === "clarinet";
    const i3 = i3HeldModel.KINDS.includes(state.sustainKind);
    const components = i3 ? i3HeldModel.partials(state.sustainKind, state.sustainBreath, state.sustainPitch) :
      flute ? sustainModel.fluteComponents(state.sustainBreath, state.sustainPitch) :
      clarinet ? sustainModel.clarinetComponents(state.sustainBreath, state.sustainPitch) :
        sustainModel.bowedComponents(state.sustainKind, state.sustainBowPressure, state.sustainPitch);
    ctx.strokeStyle = "#367bd1";
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
      const t = span * i / count;
      const phase = 2 * Math.PI * state.sustainPitch * t;
      const value = i3 ? components.reduce((value, strength, index) =>
        value + strength * Math.sin((index + 1) * phase), 0) :
        flute ? sustainModel.fluteWaveFromComponents(phase, components) :
        clarinet ? sustainModel.clarinetWaveFromComponents(phase, components) :
          sustainModel.bowedWaveFromComponents(phase, components);
      if (!i) ctx.moveTo(left, middle - value * amp);
      else ctx.lineTo(left + w * i / count, middle - value * amp);
    }
    ctx.stroke();
    ctx.fillStyle = "#7489a1";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("0", left, height - 10);
    ctx.fillText(millisecondsText(20), right, height - 10);
  }

  function drawSustainSpectrum() {
    const { ctx, width, height } = plotContext($("sustainSpectrumCanvas"));
    const left = 36, right = width - 14, top = 21, bottom = height - 29;
    const strength = heldFamily(state.sustainKind) === "bow" ? state.sustainBowPressure : state.sustainBreath;
    const partials = heldModelFor(state.sustainKind).partials(state.sustainKind, strength, state.sustainPitch);
    const w = right - left, h = bottom - top, slot = w / partials.length;
    drawFrame(ctx, width, height, left, right, top, bottom);
    partials.forEach((strength, i) => {
      const size = Math.min(19, slot * .55);
      ctx.fillStyle = i === 0 ? "#367bd1" : "#159c91";
      ctx.fillRect(left + (i + .5) * slot - size / 2, bottom - strength * h * .91,
        size, strength * h * .91);
    });
    ctx.fillStyle = "#7489a1";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("1", left - 5, top + 2);
    ctx.textAlign = "center";
    const labels = partials.length <= 8 ?
      (w < 315 ? [0, 2, 4, 7] : [0, 1, 2, 3, 4, 5, 6, 7]) :
      partials.length <= 12 ?
        (w < 315 ? [0, 2, 5, 8, 11] : [0, 1, 3, 5, 7, 9, 11]) :
        (w < 315 ? [0, 5, 11, 17, 23] : [0, 3, 7, 11, 15, 19, 23]);
    for (const i of labels) ctx.fillText(i === 0 ? "f" : (i + 1) + "f",
      left + (i + .5) * slot, height - 10);
  }

  function drawSustainPlots() {
    drawSustainEnvelope();
    drawSustainWave();
    drawSustainSpectrum();
  }

  function drawMotionPitch() {
    const { ctx, width, height } = plotContext($("motionPitchCanvas"));
    const left = 47, right = width - 16, top = 19, bottom = height - 30;
    const w = right - left, h = bottom - top;
    const viewStart = Math.max(0, state.motionElapsed - 4);
    const yAt = hz => bottom - Math.log(hz / motionModel.MIN_HZ) /
      Math.log(motionModel.MAX_HZ / motionModel.MIN_HZ) * h;
    ctx.strokeStyle = "#e8eff7";
    ctx.lineWidth = 1;
    for (const hz of [120, 240, 480, 960, 1600]) {
      const y = yAt(hz);
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.fillStyle = "#7489a1";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(String(hz), left - 6, y + 3);
    }
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const x = left + w * i / 4;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      ctx.fillText(secondsText(viewStart + i), x, height - 12);
    }
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = state.motionKind === "siren" ? "#7861bb" : "#168f9b";
    ctx.beginPath();
    // Both modes show the most recent four seconds after playback passes 4 s.
    // A siren's audio phase must not appear to reset when its plot reaches the edge.
    if (state.motionKind === "siren") {
      const recipe = sirenRecipe();
      for (let i = 0; i <= 400; i++) {
        const t = i / 100;
        const x = left + t / 4 * w, y = yAt(motionModel.sirenHzAt(viewStart + t, recipe));
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (state.motionHistory.length) {
      let started = false;
      for (const point of state.motionHistory) {
        const x = left + (point.time - viewStart) / 4 * w;
        if (x < left || x > right) continue;
        if (!started) { ctx.moveTo(x, yAt(point.hz)); started = true; }
        else ctx.lineTo(x, yAt(point.hz));
      }
      if (started) ctx.stroke();
    }
    const x = left + Math.min(4, state.motionElapsed - viewStart) / 4 * w;
    if (state.motionPlaying || state.motionKind === "theremin") {
      ctx.fillStyle = "#df8738";
      ctx.beginPath();
      ctx.arc(x, yAt(state.motionHz), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    $("motionPitchBadge").textContent = hzText(state.motionHz);
    $("motionDetailBadge").textContent = hzText(state.motionHz);
  }

  function drawMotionWave() {
    const { ctx, width, height } = plotContext($("motionWaveCanvas"));
    const left = 27, right = width - 12, top = 19, bottom = height - 27;
    drawFrame(ctx, width, height, left, right, top, bottom);
    const middle = (top + bottom) / 2;
    const amplitude = (bottom - top) * 0.46 * state.motionLevel;
    ctx.strokeStyle = "#367bd1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const timbre = state.motionKind === "theremin" ? state.motionTimbre : "pure";
    const sampleRate = motionAudio.contextOwner.context?.sampleRate || motionModel.PLOT_SAMPLE_RATE;
    const spectrum = motionModel.timbreSpectrum(timbre, state.motionHz,
      state.motionVowel, state.motionHarmonic, sampleRate);
    for (let i = 0; i <= 350; i++) {
      const fraction = i / 350;
      const x = left + fraction * (right - left);
      const phase = 2 * Math.PI * state.motionHz * fraction * 0.02;
      const y = middle - amplitude * motionModel.timbreWaveAt(phase, timbre, spectrum);
      if (!i) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#7489a1";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("0", left, height - 9);
    ctx.textAlign = "right";
    ctx.fillText(millisecondsText(20), right, height - 9);
  }

  function drawMotionComponent() {
    const { ctx, width, height } = plotContext($("motionSpectrumCanvas"));
    const left = 20, right = width - 15, top = 24, bottom = height - 32;
    const timbre = state.motionKind === "theremin" ? state.motionTimbre : "pure";
    const sampleRate = motionAudio.contextOwner.context?.sampleRate || motionModel.PLOT_SAMPLE_RATE;
    const partials = motionModel.timbreComponents(timbre, state.motionHz,
      state.motionVowel, state.motionHarmonic, sampleRate).slice(0, 16);
    const peak = Math.max(1e-9, ...partials.map(c => c.magnitude));
    ctx.strokeStyle = "#e8eff7";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = left + (right - left) * i / 4;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    }
    ctx.strokeStyle = "#a9bdd3";
    ctx.beginPath(); ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();
    for (let i = 0; i < partials.length; i++) {
      const x = left + (right - left) * (i + 1) / (partials.length + 1);
      if (partials[i].magnitude > 0) {
        const focused = timbre === "overtones" && i + 1 === state.motionHarmonic;
        ctx.strokeStyle = focused ? "#e18c30" : i === 0 ? "#278bb8" : "#16998f";
        ctx.lineWidth = Math.min(9, (right - left) / (partials.length * 2.4));
        ctx.beginPath(); ctx.moveTo(x, bottom);
        ctx.lineTo(x, bottom - (bottom - top) * partials[i].magnitude / peak * state.motionLevel);
        ctx.stroke();
      }
      ctx.fillStyle = "#7489a1";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      if (i === 0 || i === 1 || (i + 1) % 4 === 0 ||
          (timbre === "overtones" && i + 1 === state.motionHarmonic)) {
        ctx.fillText(i === 0 ? "f₀" : (i + 1) + "f₀", x, height - 11);
      }
    }
    ctx.fillStyle = "#7489a1";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(hzText(state.motionHz) + " – " + hzText(partials.length * state.motionHz), left, 13);
  }

  function drawMotionPlots() {
    drawMotionPitch();
    drawMotionWave();
    drawMotionComponent();
  }

  function mixTimeLabel(seconds, span) {
    return span < 1 ? millisecondsText(seconds * 1000) : secondsText(seconds);
  }

  function drawMixWave() {
    const { ctx, width, height } = plotContext($("mixWaveCanvas"));
    const left = 43, right = width - 16, top = 24, bottom = height - 32;
    const start = state.mixWindowStart, span = state.mixWindowSpan;
    const w = right - left, middle = (top + bottom) / 2;
    const amplitude = (bottom - top) * 0.46;
    const recipe = mixRecipe();
    drawFrame(ctx, width, height, left, right, top, bottom);

    // On a long time scale we show the exact envelope rather than undersampling
    // hundreds of cycles into a misleading low-frequency waveform.
    const count = Math.max(500, Math.floor(w * 1.5));
    ctx.fillStyle = "rgba(47, 125, 203, .12)";
    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
      const fraction = i / count;
      const envelope = beatsModel.envelopeAt(start + span * fraction, recipe);
      const x = left + w * fraction;
      const y = middle - amplitude * envelope;
      if (!i) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = count; i >= 0; i--) {
      const fraction = i / count;
      const envelope = beatsModel.envelopeAt(start + span * fraction, recipe);
      ctx.lineTo(left + w * fraction, middle + amplitude * envelope);
    }
    ctx.fill();
    ctx.strokeStyle = "#28918e";
    ctx.lineWidth = 1.5;
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= count; i++) {
        const fraction = i / count;
        const envelope = beatsModel.envelopeAt(start + span * fraction, recipe);
        const x = left + w * fraction;
        const y = middle + sign * amplitude * envelope;
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const showOscillations = (state.mixBase + state.mixGap) * span <= Math.max(5, w / 20);
    if (showOscillations) {
      // Render a true sum only when the display can resolve individual cycles.
      const countWave = Math.max(1400, Math.ceil((state.mixBase + state.mixGap) * span * 24));
      ctx.beginPath();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#367bd1";
      for (let i = 0; i <= countWave; i++) {
        const fraction = i / countWave;
        const y = middle - amplitude * beatsModel.sampleAt(start + span * fraction, recipe);
        if (!i) ctx.moveTo(left, y);
        else ctx.lineTo(left + w * fraction, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#7489a1";
    ctx.textAlign = "left";
    ctx.fillText(text("amplitude"), 10, 13);
    ctx.textAlign = "center";
    const ticks = w < 320 ? 2 : 4;
    for (let i = 0; i <= ticks; i++) {
      ctx.fillText(mixTimeLabel(start + span * i / ticks, span), left + w * i / ticks, height - 12);
    }
    $("mixWindowLabel").textContent = mixTimeLabel(start, span) + " – " +
      mixTimeLabel(start + span, span) + " · " + mixBeatsText();
    $("mixWaveHint").textContent = text(showOscillations ? "mixWaveHintFine" : "mixWaveHint");
    renderMixView();
  }

  function drawMixSpectrum() {
    const { ctx, width, height } = plotContext($("mixSpectrumCanvas"));
    const left = 44, right = width - 16, top = 20, bottom = height - 33;
    const w = right - left, h = bottom - top;
    const lines = beatsModel.spectrumLines(mixRecipe());
    // Magnify the narrow interval: a 4 Hz separation must be distinguishable.
    const margin = Math.max(2, state.mixGap * 1.5);
    const lower = state.mixBase - margin;
    const upper = state.mixBase + state.mixGap + margin;
    drawFrame(ctx, width, height, left, right, top, bottom);
    const xFor = hz => left + (hz - lower) / (upper - lower) * w;
    lines.forEach((line, index) => {
      const x = xFor(line.hz);
      const peak = bottom - line.amplitude * h * (lines.length === 1 ? 0.95 : 1.8);
      ctx.strokeStyle = index === 0 ? "#347cc9" : "#159c91";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, bottom);
      ctx.lineTo(x, peak);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(x, peak, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#788da2";
    ctx.textAlign = "center";
    for (const i of (w < 290 ? [0, 4] : [0, 2, 4])) {
      const hz = lower + (upper - lower) * i / 4;
      ctx.fillText(hzText(Math.round(hz)), left + w * i / 4, height - 12);
    }
  }

  function drawMixPlots() {
    drawMixWave();
    drawMixSpectrum();
  }

  function drawIntervalWave() {
    const { ctx, width, height } = plotContext($("intervalWaveCanvas"));
    const left = 61, right = width - 15, top = 25, bottom = height - 32;
    const w = right - left, h = bottom - top;
    const data = intervalAnalysis(), duration = data.referencePeriod;
    drawFrame(ctx, width, height, left, right, top, bottom);
    const rows = [
      { label: "f₁", color: "#347cc9" },
      { label: "f₂", color: "#e09145" },
      { label: "f₁+f₂", color: "#19877d" }
    ];
    const count = Math.max(900, Math.ceil(data.highHz * intervalModel.PARTIAL_COUNT * duration * 14));
    const partials = intervalModel.partialAmplitudes(state.intervalColor);
    const samples = [new Float64Array(count + 1), new Float64Array(count + 1)];
    for (let i = 0; i <= count; i++) {
      const t = duration * i / count;
      for (let n = 0; n < partials.length; n++) {
        if (!partials[n]) continue;
        samples[0][i] += partials[n] * Math.sin(2 * Math.PI * (n + 1) * data.baseHz * t);
        samples[1][i] += partials[n] * Math.sin(2 * Math.PI * (n + 1) * data.highHz * t);
      }
    }
    rows.forEach(({ label, color }, row) => {
      const center = top + h * (row + 0.5) / 3;
      const amplitude = h / 3 * 0.36;
      ctx.strokeStyle = "#e2eaf1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, center);
      ctx.lineTo(right, center);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, 7, center);
      ctx.strokeStyle = color;
      ctx.lineWidth = row === 2 ? 2.5 : 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i <= count; i++) {
        const fraction = i / count;
        const low = samples[0][i], high = samples[1][i];
        const sample = row === 0 ? low : row === 1 ? high : (low + high) / 2;
        const x = left + w * fraction, y = center - amplitude * sample;
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    ctx.fillStyle = "#7489a1";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    const ticks = width < 340 ? 2 : 4;
    for (let i = 0; i <= ticks; i++) {
      ctx.fillText(millisecondsText(duration * 1000 * i / ticks),
        left + w * i / ticks, height - 11);
    }
    $("intervalWaveFoot").textContent = data.exactOverlap ?
      intervalPhrase("intervalWaveFootJust", { low: data.lowerCycles, high: data.upperCycles }) :
      text("intervalWaveFootEqual");
  }

  function drawIntervalSpectrum() {
    const { ctx, width, height } = plotContext($("intervalSpectrumCanvas"));
    const left = 59, right = width - 14, top = 22, bottom = height - 32;
    const w = right - left, h = bottom - top;
    const data = intervalAnalysis();
    $("intervalSpectrumHint").textContent = text(state.intervalColor === "pure" ?
      "intervalSpectrumHintPure" : "intervalSpectrumHint");
    const maxHz = intervalModel.PARTIAL_COUNT * data.highHz * 1.06;
    drawFrame(ctx, width, height, left, right, top, bottom);
    const xFor = hz => left + hz / maxHz * w;
    const rows = [
      { label: "f₁", hz: data.baseHz, index: data.p, color: "#347cc9", y: top + h * 0.44 },
      { label: "f₂", hz: data.highHz, index: data.q, color: "#e09145", y: top + h * 0.89 }
    ];
    rows.forEach(row => {
      ctx.fillStyle = row.color;
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(row.label, 8, row.y - 11);
      ctx.strokeStyle = "#c7d5e3";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, row.y);
      ctx.lineTo(right, row.y);
      ctx.stroke();
      const lines = intervalModel.spectrum(row.hz, state.intervalColor);
      for (const line of lines) {
        const x = xFor(line.hz);
        const length = h * 0.33 * line.strength;
        ctx.strokeStyle = row.color;
        ctx.lineWidth = line.harmonic === row.index ? 4 : 2.3;
        ctx.beginPath();
        ctx.moveTo(x, row.y);
        ctx.lineTo(x, row.y - length);
        ctx.stroke();
        if (line.harmonic === row.index) {
          ctx.strokeStyle = "#147d72";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(x, row.y - length, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    });
    ctx.fillStyle = "#788da2";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    const ticks = width < 350 ? 2 : 4;
    for (let i = 0; i <= ticks; i++) {
      ctx.fillText(hzText(maxHz * i / ticks), left + w * i / ticks, height - 11);
    }
    $("intervalSpectrumFoot").textContent = state.intervalColor === "pure" &&
      (data.p !== 1 || data.q !== 1) ? text("intervalSpectrumPure") :
      data.exactOverlap ? intervalPhrase("intervalSpectrumJust", {
        p: data.p, q: data.q, low: frequencyText(data.baseHz), high: frequencyText(data.highHz)
      }) : intervalPhrase("intervalSpectrumEqual", {
        p: data.p, q: data.q, low: frequencyText(data.baseHz), high: frequencyText(data.highHz),
        delta: hzText(data.discrepancyHz)
      });
  }

  function drawIntervalPlots() {
    drawIntervalWave();
    drawIntervalSpectrum();
  }

  function drawEarHarmonics() {
    const { ctx, width, height } = plotContext($("earHarmonicsCanvas"));
    const data = earStep();
    const left = 47, right = width - 24, top = 37, bottom = height - 43;
    const span = right - left, recipe = earModel.partials(state.earSound);
    const upper = Math.max(data.referenceHz, data.tunedHz) * recipe[recipe.length - 1].multiplier * 1.08;
    const rows = [
      { hz: data.referenceHz, name: "f₁", color: "#337ec5", y: top + 72 },
      { hz: data.tunedHz, name: "f₂", color: "#d58b36", y: top + 152 }
    ];
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#8299ad";
    for (let tick = 0; tick <= 4; tick++) {
      const x = left + span * tick / 4;
      ctx.strokeStyle = "#e0eaf3"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillText(frequencyText(upper * tick / 4), x, bottom + 22);
    }
    if (state.earHelp === "blind") {
      ctx.fillStyle = "#5d7892";
      ctx.fillText(text("earHarmonicsHiddenFoot"), width / 2, height / 2);
    }
    for (const row of rows) {
      ctx.strokeStyle = "#a9c1d8";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, row.y); ctx.lineTo(right, row.y); ctx.stroke();
      ctx.textAlign = "left";
      ctx.fillStyle = row.color; ctx.fillText(row.name, 8, row.y + 5);
      if (state.earHelp === "blind") continue;
      for (const part of recipe) {
        const x = left + span * part.multiplier * row.hz / upper;
        if (x > right || x < left) continue;
        ctx.strokeStyle = row.color;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, row.y); ctx.lineTo(x, row.y - (9 + part.amplitude * 48)); ctx.stroke();
      }
    }
    $("earHarmonicsFoot").textContent = text(state.earHelp === "guided" ? "earHarmonicsFoot" : "earHarmonicsHiddenFoot");
  }

  function drawEarOctave() {
    if ($("earOctavePanel").hidden) return;
    const { ctx, width, height } = plotContext($("earOctaveCanvas"));
    const data = earStep();
    const left = 53, right = width - 45, y = height / 2 + 18;
    const span = right - left;
    const xFor = hz => left + span * (1 + Math.log2(hz / earModel.START_HZ)) / 2;
    const xSafe = hz => Math.max(left + 6, Math.min(right - 6, xFor(hz)));
    ctx.fillStyle = "#e8f6f1";
    ctx.fillRect(left + span / 2, y - 82, span / 2, 112);
    ctx.strokeStyle = "#a7c0d8"; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center";
    for (let cents = -1200; cents <= 1200; cents += 200) {
      const x = left + span * (cents + 1200) / 2400;
      ctx.strokeStyle = cents === 0 ? "#95cabe" : "#d4e2ee";
      ctx.lineWidth = cents === 0 ? 1.8 : 1;
      ctx.beginPath(); ctx.moveTo(x, y - 78); ctx.lineTo(x, y + 18); ctx.stroke();
    }
    for (const [ratio, label] of [[.5, earName("C", "3")], [1, earName("C", "4")], [2, earName("C", "5")]]) {
      ctx.fillStyle = "#64829c"; ctx.fillText(label, xSafe(earModel.START_HZ * ratio), y + 41);
    }
    const referenceX = xFor(earModel.START_HZ);
    ctx.fillStyle = "#3d84c8";
    ctx.beginPath(); ctx.arc(referenceX, y, 8, 0, Math.PI * 2); ctx.fill();
    if (state.earChecked) {
      const tunedX = xSafe(data.tunedHz);
      const foldedX = xSafe(data.foldedHz);
      if (data.shifts) {
        ctx.strokeStyle = "#c28d3b"; ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(tunedX, y - 21); ctx.lineTo(tunedX, y - 61);
        ctx.lineTo(foldedX, y - 61); ctx.lineTo(foldedX, y - 21); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#bd7f2b";
        ctx.fillText(data.shifts > 0 ? "×2" : "÷2", (tunedX + foldedX) / 2, y - 68);
        ctx.fillStyle = "#218c79";
        ctx.beginPath(); ctx.arc(foldedX, y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(earName(data.note, data.octave + data.shifts), foldedX, y - 15);
      }
      ctx.fillStyle = "#d08a35";
      ctx.beginPath(); ctx.arc(tunedX, y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(earName(data.note, data.octave), tunedX, y + 63);
    }
    $("earOctaveBadge").textContent = earName("C", "4") + " → " +
      (state.earChecked ? earName(data.note, data.octave) : "?");
    $("earOctaveFoot").textContent = text(!state.earChecked ? "earOctaveFoot" :
      data.shifts ? "earOctaveFoldFoot" : "earNoFold");
  }

  function drawEarPlots() { drawEarHarmonics(); drawEarOctave(); }

  function drawScaleSpiral() {
    const scale = scaleAnalysis();
    const gap = state.scaleShowGap ? scaleModel.returnGap(scale) : null;
    const { ctx, width, height } = plotContext($("scaleSpiralCanvas"));
    const centerX = width / 2, centerY = height / 2;
    const octaveStep = Math.log2(3 / 2);
    const firstOctave = -scale.down * octaveStep;
    const lastOctave = scale.up * octaveStep;
    const radialMin = gap ? Math.min(firstOctave, gap.ghostK * octaveStep) : firstOctave;
    const radialMax = gap ? Math.max(lastOctave, gap.ghostK * octaveStep) : lastOctave;
    const radialSpan = radialMax - radialMin;
    const inner = 25, outer = Math.max(62, Math.min(width, height) / 2 - 43);
    const radiusAt = octave => radialSpan > 0 ?
      inner + (octave - radialMin) / radialSpan * (outer - inner) : (inner + outer) / 2;
    const positionAt = octave => {
      const angle = -Math.PI / 2 + 2 * Math.PI * octave;
      const radius = radiusAt(octave);
      return { x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle), angle };
    };

    // Each full turn is exactly one octave, but a fifth advances only 210.59°.
    ctx.strokeStyle = "#e5edf5";
    ctx.lineWidth = 1;
    for (let octave = Math.ceil(radialMin); octave <= Math.floor(radialMax); octave++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radiusAt(octave), 0, 2 * Math.PI);
      ctx.stroke();
    }
    // Rays represent the octave-reduced angle: different fifth-chain steps
    // are encountered in pitch order by sweeping clockwise around the center.
    for (const note of scale.chain) {
      const angle = positionAt(note.k * octaveStep).angle;
      const tonic = note.k === scale.tonicK;
      const active = scaleActive && scaleActive.k === note.k;
      ctx.strokeStyle = active ? "#e8a23b" : tonic ? "#a0d9cc" : "#d7e2ec";
      ctx.lineWidth = active ? 2.7 : tonic ? 1.5 : .85;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + (outer + 7) * Math.cos(angle),
        centerY + (outer + 7) * Math.sin(angle));
      ctx.stroke();
    }
    ctx.strokeStyle = "#4b8bd0";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    // Draw the solid spiral only through actual notes; the extra fifth is
    // deliberately shown as a separate dashed continuation when enabled.
    const chainSpan = lastOctave - firstOctave;
    const samples = Math.max(40, Math.ceil(chainSpan * 125));
    for (let i = 0; i <= samples; i++) {
      const octave = firstOctave + chainSpan * i / samples;
      const point = positionAt(octave);
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    if (gap) {
      // The extra point is NOT part of the playable scale. For the all-down
      // preset it continues toward k=-5, never introduces a positive fifth.
      const from = (gap.direction > 0 ? lastOctave : firstOctave);
      const to = gap.ghostK * octaveStep;
      ctx.strokeStyle = "#d2933a";
      ctx.lineWidth = 2.3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) {
        const p = positionAt(from + (to - from) * i / 28);
        if (!i) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const ghost = positionAt(to);
      ctx.strokeStyle = "#be7d24";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, 7.5, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillStyle = "#a56b24";
      ctx.textAlign = "center";
      const ghostLabel = (gap.ghostK > 0 ? "+" : "") + gap.ghostK + " ?";
      ctx.fillText(ghostLabel, ghost.x + 17 * Math.cos(ghost.angle),
        ghost.y + 17 * Math.sin(ghost.angle));

      // Project the start and ghost onto ONE octave ring. Their small angular
      // separation is the gap, irrespective of how many spiral turns intervene.
      const startAngle = positionAt(gap.startK * octaveStep).angle;
      const deltaAngle = gap.angleDegrees * Math.PI / 180;
      const ring = outer + 13;
      ctx.strokeStyle = "#d2933a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, ring, startAngle,
        startAngle + deltaAngle, deltaAngle < 0);
      ctx.stroke();
      for (const [angle, fill] of [[startAngle, "#149588"],
        [startAngle + deltaAngle, "#d2933a"]]) {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(centerX + ring * Math.cos(angle), centerY + ring * Math.sin(angle),
          4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const compact = Math.min(width, height) < 300 || scale.count >= 9;
    for (const note of scale.chain) {
      const point = positionAt(note.k * octaveStep);
      const active = scaleActive && scaleActive.k === note.k;
      const tonic = note.k === scale.tonicK;
      const color = tonic ? "#139786" : note.k === 0 ? "#df9b43" : "#2e7ec5";
      if (active) {
        ctx.strokeStyle = "#ecae35";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 13, 0, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, active ? 8 : tonic ? 7.5 : 6, 0, 2 * Math.PI);
      ctx.fill();
      const labelDistance = compact ? 15 : 18;
      const lx = point.x + labelDistance * Math.cos(point.angle);
      const ly = point.y + labelDistance * Math.sin(point.angle);
      const number = (note.k > 0 ? "+" : "") + note.k;
      ctx.fillStyle = tonic ? "#148575" : "#3e6080";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(number, lx, ly - (compact ? 0 : 6));
      if (!compact) {
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText(note.numerator + "/" + note.denominator, lx, ly + 8);
      }
    }
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#7890a7";
    ctx.fillText("×2", centerX, centerY);
  }

  function drawScaleFourier() {
    const scale = scaleAnalysis();
    const canvas = $("scaleFourierCanvas");
    canvas.style.height = Math.max(260, 78 + scale.count * 34) + "px";
    const { ctx, width, height } = plotContext(canvas);
    const left = width < 470 ? 60 : 86, right = width - 18;
    const top = 27, bottom = height - 37;
    // Frame all original fundamentals and only their nearest two partials;
    // later harmonics are intentionally allowed to extend beyond the canvas.
    const minLog = -.55, maxLog = (scale.count - 1) * Math.log2(3 / 2) + 1.65;
    const xAt = frequency => left + (Math.log2(frequency) - minLog) /
      (maxLog - minLog) * (right - left);
    const yAt = index => bottom - (scale.count > 1 ? index / (scale.count - 1) : .5) * (bottom - top);
    // The lower chain endpoint is the logarithmic frequency reference (f₀).
    // One highlighted octave is anchored to the chosen tonic, so the sounding
    // melody moves left to right within this window (then back).
    const windowStart = Math.pow(3 / 2, scale.tonicK + scale.down);
    const windowLeft = xAt(windowStart), windowRight = xAt(2 * windowStart);
    ctx.fillStyle = "#eaf7f0";
    ctx.fillRect(windowLeft, top - 12, windowRight - windowLeft, bottom - top + 21);
    ctx.strokeStyle = "#8bc8aa";
    ctx.lineWidth = 1.2;
    for (const edge of [windowLeft, windowRight]) {
      ctx.beginPath();
      ctx.moveTo(edge, top - 12);
      ctx.lineTo(edge, bottom + 9);
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#3f917b";
    ctx.fillText(text("scaleWindowLabel"), (windowLeft + windowRight) / 2, 10);
    const every = Math.max(1, Math.ceil((maxLog - minLog) / (width < 470 ? 4 : 7)));
    for (let power = 0; power <= Math.floor(maxLog); power += every) {
      const x = xAt(2 ** power);
      ctx.strokeStyle = "#e7edf4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, top - 12);
      ctx.lineTo(x, bottom + 7);
      ctx.stroke();
      ctx.fillStyle = "#6e849c";
      ctx.fillText(power === 0 ? "f₀" : "2^" + power + " f₀", x, height - 17);
    }

    // The third partial of each lower row equals the second partial above it.
    for (let i = 0; i < scale.count - 1; i++) {
      const fundamental = Math.pow(3 / 2, i);
      const sharedX = xAt(3 * fundamental);
      ctx.strokeStyle = "#88c4b7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sharedX, yAt(i));
      ctx.lineTo(sharedX, yAt(i + 1));
      ctx.stroke();
    }
    for (const [index, note] of scale.chain.entries()) {
      const fundamental = Math.pow(3 / 2, index);
      const y = yAt(index);
      const isTonic = note.k === scale.tonicK;
      const isActive = scaleActive && scaleActive.k === note.k;
      const color = isTonic ? "#149588" : note.k === 0 ? "#dc963f" : "#3381c7";
      ctx.strokeStyle = "#d4e0ec";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillStyle = isTonic ? "#148575" : "#456983";
      ctx.textAlign = "right";
      ctx.fillText((note.k > 0 ? "+" : "") + note.k, left - 10, y - (scale.count <= 7 ? 7 : 0));
      if (scale.count <= 7) {
        ctx.font = "9px system-ui, sans-serif";
        ctx.fillText(note.numerator + "/" + note.denominator, left - 10, y + 8);
      }
      // Pale octave copies are playable transpositions of this fundamental,
      // but are not simultaneous extra components in its spectrum.
      for (let copy = 1; copy <= Math.ceil(Math.log2(fundamental)) + 1; copy++) {
        const ghost = fundamental / 2 ** copy;
        if (Math.log2(ghost) < minLog) continue;
        ctx.fillStyle = "#b9c3cd";
        ctx.beginPath();
        ctx.arc(xAt(ghost), y, 3.2, 0, 2 * Math.PI);
        ctx.fill();
      }
      // Physical harmonics (and the actual fundamental) lie to the right.
      for (let harmonic = 1; harmonic <= 8; harmonic++) {
        const x = xAt(fundamental * harmonic);
        if (x > right + 8) break;
        const size = harmonic === 1 ? 6.5 : 4.2 - harmonic * .17;
        if (harmonic === 1) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          ctx.fillStyle = harmonic <= 3 ? "#3497b5" : "#82b7cf";
          ctx.beginPath();
          ctx.moveTo(x, y - size);
          ctx.lineTo(x + size, y);
          ctx.lineTo(x, y + size);
          ctx.lineTo(x - size, y);
          ctx.lineTo(x, y - size);
          ctx.fill();
        }
      }
      const folded = windowStart * scale.ordered.find(item => item.k === note.k).relativeRatio;
      const foldedX = xAt(folded);
      const isUnshifted = Math.abs(folded - fundamental) < fundamental * 1e-9;
      // Every row contributes exactly one pitch to the chosen octave,
      // whether its marker is the original fundamental or a gray octave copy.
      if (!isUnshifted) {
        ctx.fillStyle = "#a7b4c2";
        ctx.beginPath();
        ctx.arc(foldedX, y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.strokeStyle = isTonic ? "#148575" : "#729f96";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(foldedX, y, 7.3, 0, 2 * Math.PI);
      ctx.stroke();
      // The top tonic is represented by its octave-up copy at the right edge.
      if (isTonic) {
        ctx.fillStyle = "#a7b4c2";
        ctx.beginPath();
        ctx.arc(windowRight, y, 4.2, 0, 2 * Math.PI);
        ctx.fill();
      }
      // Only the sounding pitch marker inside the selected octave glows.
      // The original fundamental and the entire row never change color.
      if (isActive) {
        const activeX = scaleActive.octaveUp ? windowRight : foldedX;
        ctx.fillStyle = "#e3a33b";
        ctx.beginPath();
        ctx.arc(activeX, y, 6.7, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#bd7917";
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(activeX, y, 11.5, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  }

  function drawScaleGap() {
    if (!state.scaleShowGap) return;
    const gap = scaleModel.returnGap(scaleAnalysis());
    const { ctx, width, height } = plotContext($("scaleGapCanvas"));
    const left = width < 470 ? 28 : 52, right = width - 24;
    const paddingCents = Math.max(15, Math.abs(gap.signedCents) * .19);
    const min = Math.min(0, gap.signedCents) - paddingCents;
    const max = Math.max(0, gap.signedCents) + paddingCents;
    const xAt = cents => left + (cents - min) / (max - min) * (right - left);
    const center = Math.round(height * .49);
    ctx.strokeStyle = "#ccdce9";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, center);
    ctx.lineTo(right, center);
    ctx.stroke();
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#627d96";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const cents = min + (max - min) * i / 4;
      const x = xAt(cents);
      ctx.strokeStyle = "#e1eaf2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, center - 16);
      ctx.lineTo(x, center + 17);
      ctx.stroke();
      ctx.fillText((cents < 0 ? "−" : "+") + Math.abs(cents).toFixed(0), x, height - 8);
    }
    ctx.strokeStyle = "#d29238";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(xAt(0), center);
    ctx.lineTo(xAt(gap.signedCents), center);
    ctx.stroke();
    for (const [cents, fill, label, labelY] of [
      [0, "#159586", text("scaleGapFrom"), center - 29],
      [gap.signedCents, "#d2933a", text("scaleGapGhost"), center + 31]
    ]) {
      const x = xAt(cents);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, center, 6.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(label, x, labelY);
    }
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#627d96";
    ctx.fillText(text("scaleGapUnit"), right, height - 8);
  }

  function drawScalePlots() {
    drawScaleSpiral();
    drawScaleFourier();
    drawScaleGap();
  }

  function limit5GridPoint(m, n, width, height) {
    return { x: width * (.335 + .115 * (m + .5 * n)), y: height * (.55 - .17 * n) };
  }

  function drawLimit5Lattice() {
    const { ctx, width, height } = plotContext($("limit5LatticeCanvas"));
    const lattice = limit5Model.lattice(state.limit5Base);
    const chosen = new Set(state.limit5Coords.map(([m, n]) => limit5Model.key(m, n)));
    const xy = note => limit5GridPoint(note.m, note.n, width, height);
    const line = (a, b, color, thickness = 1.2, dash = []) => {
      const p = xy(a), q = xy(b);
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    // A horizontal band is one power of 5/4; the 3/2 chain runs along it.
    for (let n = limit5Model.MIN_N; n <= limit5Model.MAX_N; n++) {
      const y = xy({ m: 0, n }).y;
      ctx.fillStyle = n === 0 ? "#f0f5fb" : n === 1 ? "#edf8f4" : n === 2 ? "#f5f1fa" : "#fafafa";
      ctx.fillRect(8, y - height * .077, width - 16, height * .154);
      ctx.fillStyle = "#7891a5";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("n=" + n, 14, y - height * .052);
    }
    // Oblique/triangular Tonnetz: each edge is a pure fifth, major third or minor third.
    for (const note of lattice) {
      for (const [dm, dn] of [[1, 0], [0, 1], [-1, 1]]) {
        if (limit5Model.within(note.m + dm, note.n + dn)) {
          line(note, { m: note.m + dm, n: note.n + dn }, "#d9e6f1", .9);
        }
      }
    }
    if (state.limit5TetGuides) {
      // (+4,-1) changes the 12-TET semitone index by +24, hence the same pitch class.
      for (const note of lattice) {
        if (limit5Model.within(note.m + 4, note.n - 1)) {
          line(note, { m: note.m + 4, n: note.n - 1 }, "#a0a9ba", 1.5, [4, 6]);
        }
      }
    }
    const gap = limit5Pair();
    if (gap && state.limit5ShowRoutes) {
      // Any near-return selected by the learner, not only pre-chosen E and D.
      const pathTo = note => {
        const path = [{ m: 0, n: 0 }];
        let m = 0, n = 0;
        while (m !== note.m) { m += Math.sign(note.m - m); path.push({ m, n }); }
        while (n !== note.n) { n += Math.sign(note.n - n); path.push({ m, n }); }
        return path;
      };
      for (const [note, color] of [[gap.low, "#128f81"], [gap.high, "#d58b28"]]) {
        const path = pathTo(note);
        for (let i = 1; i < path.length; i++) line(path[i - 1], path[i], color, 3.3);
      }
      line(gap.low, gap.high, "#e7a343", 1.7, [5, 4]);
    }
    for (const note of lattice) {
      const { x, y } = xy(note);
      const selected = chosen.has(note.key);
      const active = selected && state.limit5Playing && (limit5Active === "all" ||
        (limit5Active && limit5Active.key === note.key));
      const endpoint = gap && (note.key === gap.low.key || note.key === gap.high.key);
      const focused = note.m === state.limit5Focus[0] && note.n === state.limit5Focus[1];
      if (active) {
        ctx.beginPath();
        ctx.fillStyle = "#ffe0a1";
        ctx.arc(x, y, 13, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, selected || focused ? 6.3 : 4.7, 0, 2 * Math.PI);
      ctx.fillStyle = active ? "#e89b27" : selected ?
        note.key === "0,0" ? "#159a88" : "#347ec6" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = endpoint && state.limit5ShowRoutes ? "#d68c27" : selected ? "#347ec6" : "#a8bfd3";
      ctx.lineWidth = focused ? 2.4 : 1.3;
      ctx.stroke();
      if (selected) {
        ctx.textAlign = "center";
        ctx.fillStyle = active ? "#9f6310" : "#355a80";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillText(limit5Name(note), x, y - 15);
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText(note.numerator + "/" + note.denominator, x, y + 20);
      }
      if (focused) {
        ctx.strokeStyle = "#149587";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 11.5, 0, 2 * Math.PI); ctx.stroke();
      }
      if (state.limit5GridFocused && note.m === state.limit5Cursor[0] && note.n === state.limit5Cursor[1]) {
        ctx.strokeStyle = "#273d58";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(x, y, 14, 0, 2 * Math.PI); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#648099";
    ctx.textAlign = "left";
    ctx.fillText("→  3:2", 15, height - 24);
    ctx.fillText("↗  5:4", 15, height - 8);
    ctx.textAlign = "right";
    if (gap) ctx.fillText(gap.numerator + ":" + gap.denominator + " · " + gap.cents.toFixed(2) + "¢", width - 16, height - 13);
  }

  function drawLimit5Octave() {
    const { ctx, width, height } = plotContext($("limit5OctaveCanvas"));
    const notes = limit5Notes();
    const gap = limit5Pair();
    const left = 38, right = width - 24, span = right - left;
    const xAt = cents => left + Math.max(0, Math.min(1200, cents)) * span / 1200;
    const trackY = height * .76;
    ctx.textAlign = "center";
    for (let i = 0; i <= 12; i++) {
      const x = xAt(i * 100);
      ctx.beginPath();
      ctx.strokeStyle = "#e2eaf2";
      ctx.lineWidth = 1;
      ctx.moveTo(x, 16);
      ctx.lineTo(x, height - 18);
      ctx.stroke();
      if (i % (width < 440 ? 3 : 2) === 0) {
        ctx.fillStyle = "#7891a9";
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText(i * 100 + "¢", x, height - 4);
      }
    }
    ctx.strokeStyle = "#97b6d1";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(left, trackY); ctx.lineTo(right, trackY); ctx.stroke();
    for (const note of notes) {
      const x = xAt(note.cents);
      const separated = gap && note.key === gap.high.key;
      const y = separated ? trackY - 32 : trackY;
      const active = state.limit5Playing && (limit5Active === "all" ||
        (limit5Active && limit5Active.key === note.key));
      if (separated) {
        ctx.strokeStyle = "#d1aa69";
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x, trackY); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (active) {
        ctx.beginPath(); ctx.fillStyle = "#ffe0a1"; ctx.arc(x, y, 12, 0, 2 * Math.PI); ctx.fill();
      }
      ctx.fillStyle = active ? "#e3952f" : note.key === "0,0" ? "#159a88" : "#347ec6";
      ctx.beginPath(); ctx.arc(x, y, 6.5, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = "#355c83";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillText(limit5Name(note), x, y - 17);
    }
    // Nothing is marked as a comma until the selection itself contains a pair.
    if (gap) {
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#9c6a2b";
      ctx.textAlign = "center";
      ctx.fillText(gap.numerator + ":" + gap.denominator + " · " + gap.cents.toFixed(2) + "¢",
        (xAt(gap.low.cents) + xAt(gap.high.cents)) / 2, 23);
    }
  }

  function drawLimit5Fourier() {
    const notes = limit5Notes();
    const canvas = $("limit5FourierCanvas");
    const desiredHeight = Math.max(270, 110 + notes.length * 43) + "px";
    if (canvas.style.height !== desiredHeight) canvas.style.height = desiredHeight;
    const { ctx, width, height } = plotContext(canvas);
    const left = width < 470 ? 67 : 86, right = width - 16;
    const minLog = -.28, maxLog = 3.35;
    const xAt = ratio => left + (Math.log2(ratio) - minLog) / (maxLog - minLog) * (right - left);
    const top = 53, bottom = height - 38;
    const yAt = index => notes.length < 2 ? (top + bottom) / 2 :
      top + index * (bottom - top) / (notes.length - 1);
    const focus = limit5FocusNote();
    const selectedFocus = notes.find(note => note.key === focus.key);
    const matches = [];

    ctx.fillStyle = "#e9f7ef";
    ctx.fillRect(xAt(1), top - 22, xAt(2) - xAt(1), bottom - top + 44);
    for (const ratio of [1, 2, 4, 8]) {
      const x = xAt(ratio);
      ctx.strokeStyle = ratio === 1 || ratio === 2 ? "#99cab4" : "#e0e8f2";
      ctx.lineWidth = ratio <= 2 ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(x, top - 22); ctx.lineTo(x, bottom + 22); ctx.stroke();
      ctx.fillStyle = "#667f9b";
      ctx.textAlign = "center";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(ratio === 1 ? "f₀" : ratio + "f₀", x, height - 10);
    }
    ctx.fillStyle = "#318a70";
    ctx.textAlign = "center";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(text("scaleWindowLabel"), (xAt(1) + xAt(2)) / 2, 18);

    // Only links incident to the inspected lattice point are drawn, keeping
    // seven- and twelve-note presets readable. They connect exact shared
    // physical partials of *octave-folded* sounding fundamentals.
    if (selectedFocus) for (const note of notes) {
      if (note.key === focus.key) continue;
      const dm = note.m - focus.m, dn = note.n - focus.n;
      let kind = "", color = "";
      if (Math.abs(dm) === 1 && dn === 0) { kind = "3:2"; color = "#397bc5"; }
      else if (dm === 0 && Math.abs(dn) === 1) { kind = "5:4"; color = "#119b86"; }
      else if (Math.abs(dm) === 1 && Math.abs(dn) === 1 && dm * dn < 0) {
        kind = "6:5"; color = "#8c78b6";
      } else continue;
      const match = limit5Model.harmonicMatch(focus, note);
      if (!match || xAt(match.ratio) > right) continue;
      const x = xAt(match.ratio), y1 = yAt(notes.indexOf(selectedFocus)), y2 = yAt(notes.indexOf(note));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, (y1 + y2) / 2, 3.6, 0, 2 * Math.PI); ctx.fill();
      matches.push({ note, match, kind });
    }

    for (const [index, note] of notes.entries()) {
      const y = yAt(index);
      const active = state.limit5Playing && (limit5Active === "all" ||
        (limit5Active && limit5Active.key === note.key));
      const inspected = note.key === focus.key;
      ctx.strokeStyle = inspected ? "#8fc7bb" : "#d9e4ef";
      ctx.lineWidth = inspected ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillStyle = inspected ? "#117f74" : "#456987";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(limit5Name(note), left - 9, y - 9);
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText(note.numerator + "/" + note.denominator, left - 9, y + 4);
      const shift = limit5Model.octaveShift(note.m, note.n);
      if (shift) {
        ctx.fillStyle = "#899bac";
        ctx.fillText(shift > 0 ? "×" + 2 ** shift : "÷" + 2 ** -shift, left - 9, y + 16);
      }
      for (let h = 2; h <= 8; h++) {
        const x = xAt(note.ratio * h);
        if (x > right + 5) break;
        ctx.fillStyle = h <= 5 ? "#8cafd1" : "#b7c8d8";
        const size = h <= 4 ? 4 : 3;
        ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.lineTo(x, y - size); ctx.fill();
      }
      const raw = limit5Model.FIFTH ** note.m * limit5Model.THIRD ** note.n;
      if (shift && raw >= 2 ** minLog && raw <= 2 ** maxLog) {
        // A hollow gray marker denotes the unfurled route's original pitch,
        // even if it happens to coincide with a harmonic of the folded note.
        ctx.strokeStyle = "#a8b4c3";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(xAt(raw), y, 8, 0, 2 * Math.PI); ctx.stroke();
      }
      const x = xAt(note.ratio);
      if (active) {
        ctx.fillStyle = "#ffdf9b";
        ctx.beginPath(); ctx.arc(x, y, 13, 0, 2 * Math.PI); ctx.fill();
      }
      ctx.fillStyle = active ? "#dd9734" : note.key === "0,0" ? "#159889" : "#317ec5";
      ctx.beginPath(); ctx.arc(x, y, active ? 7.3 : 6, 0, 2 * Math.PI); ctx.fill();
      if (inspected) {
        ctx.strokeStyle = "#159889";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 11, 0, 2 * Math.PI); ctx.stroke();
      }
    }
    $("limit5FourierFact").textContent = matches.length ? matches.map(({ note, match, kind }) =>
      match.i + " × " + focus.numerator + "/" + focus.denominator + " = " +
      match.j + " × " + note.numerator + "/" + note.denominator + " (" + kind + ")").join("  ·  ") :
      text("limit5NoMatches");
  }

  function drawLimit5Plots() {
    drawLimit5Lattice();
    drawLimit5Octave();
    drawLimit5Fourier();
  }

  function drawHarmonicWave() {
    const { ctx, width, height } = plotContext($("harmonicWaveCanvas"));
    const left = 43, right = width - 16, top = 26, bottom = height - 32;
    const w = right - left, middle = (top + bottom) / 2, span = 0.02;
    const amplitude = (bottom - top) * 0.45;
    drawFrame(ctx, width, height, left, right, top, bottom);
    const normalizer = harmonicModel.peak(state.harmonicPartials);
    const count = Math.max(900, Math.round(w * 2), Math.ceil(state.harmonicBase * 8 * span * 12));
    ctx.strokeStyle = "#367bd1";
    ctx.lineWidth = 2.1;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
      const fraction = i / count;
      const y = middle - amplitude * harmonicModel.sampleAt(span * fraction,
        state.harmonicBase, state.harmonicPartials, normalizer);
      if (!i) ctx.moveTo(left, y);
      else ctx.lineTo(left + w * fraction, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#7489a1";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(text("amplitude"), 8, 14);
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      ctx.fillText(millisecondsText(5 * i), left + w * i / 4, height - 12);
    }
    $("harmonicWaveFoot").textContent = "0–" + millisecondsText(20);
  }

  function drawHarmonicSpectrum() {
    const { ctx, width, height } = plotContext($("harmonicSpectrumCanvas"));
    const left = 44, right = width - 16, top = 18, bottom = height - 33;
    const w = right - left, h = bottom - top, slot = w / harmonicModel.COUNT;
    drawFrame(ctx, width, height, left, right, top, bottom);
    const lines = harmonicModel.spectralLines(state.harmonicBase, state.harmonicPartials);
    for (let i = 0; i < lines.length; i++) {
      const x = left + (i + 0.5) * slot;
      const barHeight = lines[i].strength * h * 0.94;
      ctx.fillStyle = i === 0 ? "#347cc9" : "#159c91";
      ctx.fillRect(x - Math.min(28, slot * 0.55) / 2, bottom - barHeight,
        Math.min(28, slot * 0.55), barHeight);
    }
    ctx.fillStyle = "#7489a1";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("1", left - 5, top + 4);
    ctx.fillText("0", left - 5, bottom + 2);
    ctx.textAlign = "center";
    const labels = w < 350 ? [0, 3, 7] : [0, 1, 3, 5, 7];
    for (const index of labels) {
      const hz = lines[index].hz;
      ctx.fillText(hz >= 1000 ? kHzText(hz, true) : hzText(hz),
        left + (index + 0.5) * slot, height - 12);
    }
  }

  function drawHarmonicPlots() {
    drawHarmonicWave();
    drawHarmonicSpectrum();
  }

  function drawNoiseWave() {
    const { ctx, width, height } = plotContext($("noiseWaveCanvas"));
    const left = 43, right = width - 16, top = 26, bottom = height - 32;
    const w = right - left, middle = (top + bottom) / 2;
    drawFrame(ctx, width, height, left, right, top, bottom);
    const sampleRate = 32000;
    const samples = noiseModel.makeSamples(state.noiseColor, sampleRate, .2);
    // A two-pole approximation for a stable, illustrative filtered waveform.
    // Playback itself uses Web Audio's proper second-order biquad filter.
    const retention = Math.exp(-2 * Math.PI * state.noiseCutoff / sampleRate);
    const filtered = new Float32Array(samples.length);
    let first = 0, second = 0;
    for (let i = 0; i < samples.length; i++) {
      first = retention * first + (1 - retention) * samples[i];
      second = retention * second + (1 - retention) * first;
      filtered[i] = second;
    }
    const startSample = Math.round(.08 * sampleRate);
    const durationSamples = Math.round(.04 * sampleRate);
    ctx.strokeStyle = "#367bd1";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= durationSamples; i++) {
      const x = left + w * i / durationSamples;
      const y = middle - filtered[startSample + i] * (bottom - top) * .47;
      if (!i) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#7489a1";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(text("amplitude"), 8, 14);
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      ctx.fillText(millisecondsText(10 * i), left + w * i / 4, height - 12);
    }
    $("noiseWaveFoot").textContent = "0–" + millisecondsText(40);
  }

  function drawNoiseSpectrum() {
    const { ctx, width, height } = plotContext($("noiseSpectrumCanvas"));
    const left = 51, right = width - 18, top = 20, bottom = height - 33;
    const w = right - left, h = bottom - top;
    const minHz = 40, maxHz = 12000, logSpan = Math.log(maxHz / minHz);
    drawFrame(ctx, width, height, left, right, top, bottom);
    const xFor = hz => left + Math.log(hz / minHz) / logSpan * w;
    const yFor = magnitude => {
      // Reference white noise at 500 Hz = 0 dB, not per-curve normalized.
      const decibels = 20 * Math.log10(Math.max(1e-5, magnitude));
      return bottom - Math.max(0, Math.min(1, (decibels + 60) / 80)) * h;
    };
    ctx.strokeStyle = "#218f9b";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 450; i++) {
      const hz = minHz * Math.exp(logSpan * i / 450);
      const mag = noiseModel.expectedMagnitude(state.noiseColor, hz, state.noiseCutoff);
      const x = xFor(hz), y = yFor(mag);
      if (!i) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#7489a1";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    for (const db of [-60, -40, -20, 0, 20]) {
      ctx.fillText(db + " dB", left - 6, bottom - (db + 60) / 80 * h + 3);
    }
    ctx.textAlign = "center";
    const ticks = w < 340 ? [50, 500, 5000] : [50, 200, 1000, 4000, 12000];
    for (const hz of ticks) {
      ctx.fillText(hz >= 1000 ? kHzText(hz) : hzText(hz), xFor(hz), height - 12);
    }
  }

  function drawNoisePlots() {
    drawNoiseWave();
    drawNoiseSpectrum();
  }

  function tempCirclePositions(width, height) {
    const cx = width / 2, cy = height / 2;
    const radius = Math.max(42, Math.min(width * .4, height * .4));
    return tempModel.CIRCLE.map((name, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 6;
      return { name, pc: tempModel.PITCH_CLASSES[index], x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle) };
    });
  }

  // This is a *diagrammatic* embedding. A real tempered frequency has no
  // unique coordinates in the exact 3:2–5:4 lattice: we draw displacements
  // from a specified exact reference, magnified by eight for legibility.
  function tempLatticeGeometry(width, height) {
    const notes = tempModel.latticeNotes(state.tempSystem, state.tempNarrow);
    const rootM = notes.find(note => note.pc === state.tempKey).m;
    const compact = width < 580;
    if (state.tempSystem === "just") {
      // All twelve selected pitches lie at n = -1, 0, 1. Use literal
      // lattice coordinates instead of projecting from Pythagorean shadows.
      const unit = Math.min((width - 85) / 5, (height - 112) / 2.15);
      const position = (m, n) => ({
        x: width * .50 + (m - .5 + n / 2) * unit,
        y: height * .47 - n * Math.sqrt(3) / 2 * unit
      });
      return { notes, rootM, compact, minM: -2, maxM: 3, unit, position };
    }
    const minM = compact ? Math.max(-4, Math.min(rootM - 2, 5)) : -4;
    const maxM = compact ? minM + 7 : 10;
    const unit = Math.min((width - 72) / (maxM - minM + 1), height / 4.6);
    const position = (m, n) => ({
      x: 40 + (m - minM + n / 2) * unit,
      y: height * .48 - n * Math.sqrt(3) / 2 * unit
    });
    return { notes, rootM, compact, minM, maxM, unit, position };
  }

  function drawTempLattice() {
    const { ctx, width, height } = plotContext($("tempLatticeCanvas"));
    const layout = tempLatticeGeometry(width, height);
    const { notes, compact, minM, maxM, position } = layout;
    const isJust = state.tempSystem === "just";
    const chord = tempModel.latticeChord(state.tempSystem, state.tempKey,
      state.tempQuality, state.tempNarrow);
    const selected = new Set(state.tempTask === "wolf" ? (isJust ? [0, 7, 2, 9] : [0, 7, 8, 3]) :
      chord.vertices.map(vertex => vertex.pc));
    const shift = deviation => deviation * 8 / tempModel.PURE_MAJOR_THIRD;
    const inView = point => point.x >= 16 && point.x <= width - 12 &&
      point.y >= 34 && point.y <= height - 62;
    ctx.lineCap = "round";

    // Equilateral triangular grid: one horizontal step is an exact 3:2
    // fifth; the 60-degree step represents an exact 5:4 major third.
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e1edf2";
    for (let n = -1; n <= 1; n++) for (let m = minM - 2; m <= maxM + 2; m++) {
      const p = position(m, n);
      if (!inView(p)) continue;
      for (const [dm, dn] of [[1, 0], [0, 1], [-1, 1]]) {
        if (n + dn > 1) continue;
        const q = position(m + dm, n + dn);
        if (!inView(q)) continue;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.9, 0, Math.PI * 2);
      ctx.fillStyle = "#fbfdff"; ctx.fill();
      ctx.strokeStyle = "#b1cbd4"; ctx.stroke(); ctx.strokeStyle = "#e1edf2";
    }

    ctx.fillStyle = "#68859a";
    ctx.font = (compact ? "10" : "12") + "px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("n = 1  ·  5:4", 12, Math.max(48, position(minM, 1).y - 8));
    ctx.fillText("n = 0  ·  3:2", 12, position(minM, 0).y - 8);
    ctx.fillText("n = −1", 12, position(minM, -1).y - 8);

    // An unobtrusive route through the twelve named pitches, in chromatic
    // order. It is only a visual guide, not an additional tuning rule.
    const candidates = notes.map(note => ({ ...note, point: position(note.m,
      isJust ? note.n : shift(note.deviation)) }))
      .filter(note => inView(note.point));
    const chromatic = [...candidates].sort((a, b) => a.pc - b.pc);
    ctx.save();
    ctx.strokeStyle = "rgba(91, 115, 151, .20)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 6]);
    if (chromatic.length > 1) {
      ctx.beginPath();
      chromatic.forEach((note, index) => index ? ctx.lineTo(note.point.x, note.point.y) :
        ctx.moveTo(note.point.x, note.point.y));
      ctx.stroke();
    }
    ctx.restore();

    // One pure-fifth point per named note is a *reference choice*, not an
    // assertion that the actual tempered note lies on that point.
    for (const note of candidates) {
      const anchor = position(note.m, isJust ? note.n : 0), dot = note.point;
      ctx.strokeStyle = "#9aaeb8"; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 5.3, 0, Math.PI * 2); ctx.stroke();
      if (!isJust && Math.abs(note.deviation) > .02) {
        ctx.strokeStyle = "#5e9caf"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(dot.x, dot.y); ctx.stroke();
      }
      const active = note.pc === state.tempKey;
      const inChord = selected.has(note.pc);
      ctx.beginPath(); ctx.arc(dot.x, dot.y, active ? 7.8 : inChord ? 6.4 : 4.6, 0, 2 * Math.PI);
      ctx.fillStyle = active ? "#2475b7" : inChord ? "#20a18f" : "#59aaba";
      ctx.fill();
      if (active) { ctx.strokeStyle = "#154a83"; ctx.lineWidth = 1.8; ctx.stroke(); }
      ctx.fillStyle = active ? "#145680" : inChord ? "#146e61" : "#466b80";
      ctx.font = "bold " + (compact ? 10 : 12) + "px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(note.name, dot.x, dot.y + (isJust && note.n < 0 || note.deviation < -5 ? 20 : -12));
    }

    // The theoretical just-intonation chord is an equilateral triangle;
    // the actual tuning changes the two independent interval lengths.
    const ideal = chord.vertices.map(vertex => position(vertex.m, vertex.n));
    const rootNote = notes.find(note => note.pc === state.tempKey);
    const rootShift = shift(rootNote.deviation);
    const tuned = isJust ? chord.actualVertices.map(vertex => position(vertex.m, vertex.n)) :
      chord.vertices.map(vertex => position(vertex.m, vertex.n + rootShift + shift(vertex.deviation)));
    const trace = vertices => {
      ctx.beginPath(); ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
      ctx.closePath();
    };
    if (state.tempTask !== "wolf") {
      ctx.fillStyle = "rgba(229, 158, 64, .12)";
      ctx.strokeStyle = "#db963d"; ctx.lineWidth = 3;
      trace(ideal); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#117e85"; ctx.lineWidth = 2.8;
      trace(tuned); ctx.stroke();
      tuned.forEach((p, i) => {
        ctx.fillStyle = "#128b8c";
        ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = "#1b6370";
        ctx.font = "bold " + (compact ? 10 : 12) + "px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(chord.vertices[i].name, p.x, p.y - 13);
      });
    }

    const pythThirdM = chord.rootM + (state.tempQuality === "major" ? 4 : -3);
    const pythThird = position(pythThirdM, 0);
    if (!isJust && state.tempTask !== "wolf" && inView(pythThird) && inView(ideal[1])) {
      ctx.save();
      ctx.strokeStyle = "#b98a52"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(ideal[1].x, ideal[1].y);
      ctx.lineTo(pythThird.x, pythThird.y); ctx.stroke(); ctx.restore();
      ctx.fillStyle = "#9f744b"; ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("81:80", (ideal[1].x + pythThird.x) / 2,
        (ideal[1].y + pythThird.y) / 2 - 7);
    }

    const extra = position(9, 0);
    if (!isJust && inView(extra)) {
      ctx.strokeStyle = "#cc7751"; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(extra.x, extra.y, 7, 0, 2 * Math.PI); ctx.stroke();
      ctx.setLineDash([]); ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.fillStyle = "#a75c36";
      ctx.fillText("D♯ (+23.46¢)", extra.x, extra.y - 16);
    }

    // The marked 5:4 target is not the (4,0) Pythagorean shadow of E.
    // Under quarter-comma meantone, the C→E route of four *tempered*
    // fifths agrees with this exact 5:4 target, despite the shadow's
    // distant position on the lattice. This is a relative-pitch comparison.
    const c = position(0, 0), target = position(0, 1);
    if (inView(c) && inView(target)) {
      const third = tempModel.chord(state.tempSystem, 0, "major", 440,
        state.tempNarrow).thirdCents;
      const exact = Math.abs(third - tempModel.PURE_MAJOR_THIRD) < .01;
      ctx.save();
      ctx.strokeStyle = exact ? "#188c78" : "#bd8640";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(target.x, target.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(target.x, target.y, 6.5, 0, 2 * Math.PI);
      ctx.fillStyle = exact ? "#23a18b" : "#fff"; ctx.fill(); ctx.stroke();
      ctx.fillStyle = exact ? "#137865" : "#8d622f";
      ctx.font = "bold " + (compact ? 10 : 12) + "px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("E · 5:4" + (exact ? " ✓" : ""), target.x + 9, target.y - 9);
      ctx.restore();
    }

    // A small separate keyboard-order strip keeps nominally equal-pitch
    // classes legible even when their fifth-chain representatives are far away.
    const stripY = height - 34;
    const left = 22, step = (width - 44) / 11;
    ctx.beginPath(); ctx.moveTo(left, stripY);
    ctx.lineTo(width - 22, stripY); ctx.strokeStyle = "#cedde9"; ctx.lineWidth = 1.4; ctx.stroke();
    for (let pc = 0; pc < 12; pc++) {
      const x = left + pc * step;
      ctx.beginPath(); ctx.arc(x, stripY, selected.has(pc) ? 4 : 3, 0, 2 * Math.PI);
      ctx.fillStyle = selected.has(pc) ? "#148c7c" : "#9eb2c3"; ctx.fill();
      ctx.font = (selected.has(pc) ? "bold " : "") + (compact ? 9 : 11) + "px system-ui, sans-serif";
      ctx.fillStyle = selected.has(pc) ? "#116f64" : "#5c748a";
      ctx.textAlign = "center"; ctx.fillText(tempModel.NOTE_NAMES[pc], x, stripY + 17);
    }
  }

  function drawTempPartials() {
    const { ctx, width, height } = plotContext($("tempPartialCanvas"));
    const pair = tempPlayback();
    const { notes, interval } = pair;
    const gap = tempModel.partialGap(notes[0].hz, notes[1].hz, interval);
    const minHz = Math.min(notes[0].hz, notes[1].hz) * .9;
    const maxHz = Math.max(notes[0].hz, notes[1].hz) * 6.4;
    const left = 32, right = width - 24;
    const yLow = height * .32, yHigh = height * .72;
    const xFor = frequency => left + Math.log2(frequency / minHz) /
      Math.log2(maxHz / minHz) * (right - left);
    ctx.strokeStyle = "#dbe8ef"; ctx.lineWidth = 1.3;
    for (const y of [yLow, yHigh]) {
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    }
    notes.slice(0, 2).forEach((note, index) => {
      const y = index ? yHigh : yLow;
      const color = index ? "#d28e46" : "#277bb6";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillStyle = color; ctx.textAlign = "left";
      ctx.fillText(note.name, left, y - 22);
      for (let h = 1; h <= 6; h++) {
        const x = xFor(h * note.hz);
        const match = h === (index ? gap.upperHarmonic : gap.lowerHarmonic);
        ctx.strokeStyle = match ? color : index ? "#deb887" : "#8ebcdc";
        ctx.lineWidth = match ? 4.6 : 1.7;
        ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x, y - (match ? 32 : 19)); ctx.stroke();
        ctx.fillStyle = match ? color : "#74899b";
        ctx.font = (match ? "bold 11" : "10") + "px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(h + "f", x, y + 19);
      }
    });
    const match1 = xFor(gap.lowerPartial), match2 = xFor(gap.upperPartial);
    ctx.save(); ctx.strokeStyle = "#168b7c"; ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(match1, yLow - 35); ctx.lineTo(match2, yHigh - 35); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#16766c"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Δ = " + gap.beatHz.toFixed(2) + " Hz", Math.max(75, Math.min(width - 75,
      (match1 + match2) / 2)), height - 13);
  }

  function drawTempCircle() {
    const { ctx, width, height } = plotContext($("tempCircleCanvas"));
    const points = tempCirclePositions(width, height);
    const edges = tempFifths();
    const chord = tempChord();
    const isJust = state.tempSystem === "just";
    const selectedNotes = state.tempTask === "wolf" ? (isJust ? [0, 7, 2, 9] : [0, 7, 8, 3]) : chord.notes.map(note => note.pc);
    const compact = width < 400;
    const nodeRadius = compact ? 13 : 16;
    ctx.lineCap = "round";
    for (const edge of edges) {
      const start = points[edge.index], end = points[(edge.index + 1) % 12];
      ctx.lineWidth = edge.wolf ? 5 : 3;
      ctx.strokeStyle = edge.wolf || edge.deviation > .01 ? "#db9238" : edge.deviation < -.01 ? "#378acc" : "#6c9c83";
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const point of points) {
      const selected = state.tempTask === "wolf" ? (isJust ? point.pc === 2 || point.pc === 9 : point.pc === 8 || point.pc === 3) : point.pc === state.tempKey;
      const chordIndex = selectedNotes.indexOf(point.pc);
      ctx.fillStyle = selected ? "#1c69ac" : chordIndex >= 0 ? "#def4ee" : "#fff";
      ctx.strokeStyle = selected ? "#1c69ac" : chordIndex >= 0 ? "#199484" : "#94acc5";
      ctx.lineWidth = selected ? 3 : 1.8;
      ctx.beginPath(); ctx.arc(point.x, point.y, nodeRadius, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.fillStyle = selected ? "#fff" : chordIndex >= 0 ? "#126b60" : "#345b7a";
      ctx.font = (compact ? "bold 10px " : "bold 12px ") + "system-ui, sans-serif";
      ctx.fillText(point.name, point.x, point.y);
    }
    ctx.fillStyle = "#325d7b";
    ctx.font = "bold " + (compact ? 11 : 15) + "px system-ui, sans-serif";
    ctx.fillText(state.tempTask === "wolf" ? (isJust ? "C–G / D–A" : "C–G / G♯–E♭") :
      tempModel.NOTE_NAMES[state.tempKey] + " " + text(state.tempQuality === "major" ? "tempMajor" : "tempMinor"), width / 2, height / 2 - 8);
    ctx.font = (compact ? "10" : "12") + "px system-ui, sans-serif";
    ctx.fillText(isJust ? text("tempJustCircleFoot") : "(3/2)¹² ≠ 2⁷", width / 2, height / 2 + 14);
  }

  function drawTempFifths() {
    const { ctx, width, height } = plotContext($("tempFifthsCanvas"));
    const edges = tempFifths();
    const largest = Math.max(10, ...edges.map(edge => Math.abs(edge.deviation)));
    const magnitude = Math.ceil(largest / 5) * 5;
    const left = 38, right = width - 8, top = 18, bottom = height - 34;
    const mid = (top + bottom) / 2;
    const barHeight = (bottom - top) / 2;
    ctx.strokeStyle = "#d9e7f1";
    ctx.lineWidth = 1;
    for (const fraction of [-1, -.5, .5, 1]) {
      const y = mid - fraction * barHeight;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.fillStyle = "#6f869b";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText((fraction * magnitude).toFixed(0), left - 5, y + 3);
    }
    ctx.strokeStyle = "#819bb4";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(left, mid); ctx.lineTo(right, mid); ctx.stroke();
    ctx.fillStyle = "#6f869b"; ctx.textAlign = "right"; ctx.fillText("0", left - 5, mid + 3);
    const column = (right - left) / 12;
    edges.forEach((edge, i) => {
      const x = left + column * (i + .5);
      const y = mid - edge.deviation / magnitude * barHeight;
      ctx.fillStyle = edge.wolf || edge.deviation > .01 ? "#db9238" : edge.deviation < -.01 ? "#378acc" : "#6c9c83";
      const absHeight = Math.max(1.7, Math.abs(mid - y));
      ctx.fillRect(x - column * .32, Math.min(y, mid) - (edge.deviation === 0 ? 1 : 0), column * .64, absHeight);
      ctx.fillStyle = edge.wolf || edge.deviation > .01 ? "#a16523" : "#516d84";
      ctx.font = (width < 450 ? "9px " : "11px ") + "system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(edge.from, x, bottom + 16);
    });
  }

  function drawTempPlots() { drawTempLattice(); drawTempCircle(); drawTempFifths(); drawTempPartials(); }

  function drawPlots() {
    if (state.mode === "analysis") {
      if (analysisScreen === "compare") compare?.draw();
      else analysis?.draw();
    } else if (state.mode === "strike") {
      renderStrikeTime();
      drawStrikeWave();
      drawStrikeSpectrum();
    } else if (state.mode === "sustain") {
      drawSustainPlots();
    } else if (state.mode === "motion") {
      drawMotionPlots();
    } else if (state.mode === "mix") {
      if (state.mixKind === "noise") drawNoisePlots();
      else drawMixPlots();
    } else if (state.mode === "tuning") {
      if (state.tuningKind === "intervals") drawIntervalPlots();
      else if (state.tuningKind === "ear") drawEarPlots();
      else if (state.tuningKind === "scales") drawScalePlots();
      else if (state.tuningKind === "limit5") drawLimit5Plots();
      else drawTempPlots();
    } else if (state.mode === "pure" && state.pureKind === "harmonics") {
      drawHarmonicPlots();
    } else if (state.mode === "pure") {
      drawWave();
      drawSpectrum();
    }
  }

  document.querySelectorAll("[data-wave]").forEach(button => {
    button.addEventListener("click", () => selectWaveform(button.dataset.wave));
  });
  document.querySelectorAll("[data-strike]").forEach(button => {
    button.addEventListener("click", () => selectStrikeKind(button.dataset.strike));
  });
  document.querySelectorAll("[data-strike-play]").forEach(button => {
    button.addEventListener("click", () => triggerStrike(button.dataset.strikePlay));
  });
  document.querySelectorAll("[data-guitar-chord]").forEach(button => {
    button.addEventListener("click", () => {
      const changed = state.strikeChord !== button.dataset.guitarChord;
      state.strikeChord = button.dataset.guitarChord;
      return triggerStrike("strum", changed);
    });
  });
  document.querySelectorAll("[data-sustain-family]").forEach(button => {
    button.addEventListener("click", () => selectSustainKind(state[{
      air: "sustainAirKind", bow: "sustainBowKind", organ: "sustainOrganKind",
      reed: "sustainReedKind" }[button.dataset.sustainFamily]]));
  });
  $("sustainInstrument").addEventListener("change", event => {
    const kind = event.target.value;
    const family = { air: ["flute", "clarinet"], bow: ["violin", "morin"],
      organ: ["organ-stopped", "organ-principal"], reed: ["accordion", "bayan"] }[heldFamily(state.sustainKind)];
    if (family.includes(kind)) selectSustainKind(kind);
  });
  document.querySelectorAll("[data-drum-size]").forEach(button => {
    button.addEventListener("click", () => {
      const changed = state.strikeDrumSize !== button.dataset.drumSize;
      state.strikeDrumSize = button.dataset.drumSize;
      return triggerStrike("kick", changed);
    });
  });
  document.querySelectorAll("[data-strike-drum-view]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.strikeDrumView === state.strikeDrumView) return;
      stopStrikeForEdit();
      state.strikeDrumView = button.dataset.strikeDrumView;
      state.strikeDecay = state.strikeDrumView === "kit" ? activeStrikeDrumRecipe().decay :
        { membrane: .3, snare: .33, cymbal: .55, steelpan: .8, woodblock: .24 }[state.strikeDrumVoice];
      renderStrikeControls();
      drawPlots();
    });
  });
  document.querySelectorAll("[data-strike-kit-drum]").forEach(button => {
    button.addEventListener("click", () => {
      if (state.strikeKind !== "kick" || state.strikeDrumView !== "kit") return;
      const changed = state.strikeDrumKit !== button.dataset.strikeKitDrum;
      state.strikeDrumKit = button.dataset.strikeKitDrum;
      if (Object.hasOwn(drumModel.HAT_PEDAL_POSITIONS, state.strikeDrumKit)) {
        state.strikeHatPedal = 100 * drumModel.HAT_PEDAL_POSITIONS[state.strikeDrumKit];
        transientAudio.setHatPedal(state.strikeHatPedal / 100);
      }
      if (changed) state.strikeDecay = activeStrikeDrumRecipe().decay;
      return triggerStrike("kick", changed);
    });
  });
  $("strikeHatPedal").addEventListener("input", event => {
    const openness = Number(event.target.value);
    if (!Number.isFinite(openness) || openness < 0 || openness > 100) return;
    state.strikeHatPedal = openness;
    transientAudio.setHatPedal(openness / 100);
    $("strikeHatPedalValue").textContent = openness + "%";
  });
  document.querySelectorAll("[data-spectrum-view]").forEach(button => {
    button.addEventListener("click", () => {
      state.strikeSpectrumView = button.dataset.spectrumView;
      drawStrikeSpectrum();
    });
  });
  document.querySelectorAll("[data-motion]").forEach(button => {
    button.addEventListener("click", () => setMotionKind(button.dataset.motion));
  });
  document.querySelectorAll("[data-siren-pattern]").forEach(button => {
    button.addEventListener("click", () => {
      if (state.sirenPattern === button.dataset.sirenPattern) return;
      state.sirenPattern = button.dataset.sirenPattern;
      updateSiren();
    });
  });
  document.querySelectorAll("[data-mix-gap]").forEach(button => {
    button.addEventListener("click", () => setMixGap(button.dataset.mixGap));
  });
  document.querySelectorAll("[data-pure-kind]").forEach(button => {
    button.addEventListener("click", () => selectPureKind(button.dataset.pureKind));
  });
  document.querySelectorAll("[data-mix-kind]").forEach(button => {
    button.addEventListener("click", () => selectMixKind(button.dataset.mixKind));
  });
  document.querySelectorAll("[data-tuning-kind]").forEach(button => {
    button.addEventListener("click", () => selectTuningKind(button.dataset.tuningKind));
  });
  $("earTaskSelect").addEventListener("change", event => selectEarTask(event.target.value));
  document.querySelectorAll("[data-ear-sound]").forEach(button => {
    button.addEventListener("click", () => selectEarSound(button.dataset.earSound));
  });
  document.querySelectorAll("[data-ear-play]").forEach(button => {
    button.addEventListener("click", () => toggleEarPlayback(button.dataset.earPlay));
  });
  document.querySelectorAll("[data-ear-help]").forEach(button => {
    button.addEventListener("click", () => {
      state.earHelp = button.dataset.earHelp;
      renderEarControls();
      drawPlots();
    });
  });
  $("earAdjust").addEventListener("input", event => setEarAdjustment(event.target.value));
  $("earVolume").addEventListener("input", event => {
    state.earVolume = Math.max(0, Math.min(100, Number(event.target.value)));
    earAudio.update();
    renderEarControls();
  });
  $("earCheck").addEventListener("click", checkEar);
  $("earReset").addEventListener("click", resetEar);
  $("scalePresetSelect").addEventListener("change", event => selectScalePreset(event.target.value));
  document.querySelectorAll("[data-scale-tonic]").forEach(button => {
    button.addEventListener("click", () => selectScaleTonic(Number(button.dataset.scaleTonic)));
  });
  $("limit5PresetSelect").addEventListener("change", event => {
    if (event.target.value === "custom") return;
    selectLimit5Preset(event.target.value);
  });
  document.querySelectorAll("[data-limit5-play]").forEach(button => {
    button.addEventListener("click", () => toggleLimit5Sound(button.dataset.limit5Play));
  });
  $("intervalRatioSelect").addEventListener("change", event => selectIntervalRatio(event.target.value));
  document.querySelectorAll("[data-interval-play]").forEach(button => {
    button.addEventListener("click", () => toggleIntervalSound(button.dataset.intervalPlay));
  });
  document.querySelectorAll("[data-scale-play]").forEach(button => {
    button.addEventListener("click", () => toggleScaleSound(button.dataset.scalePlay));
  });
  document.querySelectorAll("[data-interval-tuning]").forEach(button => {
    button.addEventListener("click", () => selectIntervalTuning(button.dataset.intervalTuning));
  });
  document.querySelectorAll("[data-interval-color]").forEach(button => {
    button.addEventListener("click", () => selectIntervalColor(button.dataset.intervalColor));
  });
  $("scaleGapButton").addEventListener("click", toggleScaleGapSound);
  $("scaleGapToggle").addEventListener("change", event => setScaleShowGap(event.target.checked));
  $("scaleBaseSlider").addEventListener("input", event => setScaleBase(event.target.value));
  $("scaleBaseInput").addEventListener("change", event => setScaleBase(event.target.value));
  $("scaleVolume").addEventListener("input", event => {
    state.scaleVolume = Math.min(100, Math.max(0, Number(event.target.value)));
    scaleAudio.updateVolume();
    renderScaleControls();
  });
  $("scaleAddDown").addEventListener("click", () => changeScaleBoundary("down", 1));
  $("scaleAddUp").addEventListener("click", () => changeScaleBoundary("up", 1));
  $("scaleRemoveDown").addEventListener("click", () => changeScaleBoundary("down", -1));
  $("scaleRemoveUp").addEventListener("click", () => changeScaleBoundary("up", -1));
  $("scaleReset").addEventListener("click", resetScale);
  $("limit5ShowRoutes").addEventListener("change", event => {
    state.limit5ShowRoutes = event.target.checked;
    drawPlots();
  });
  $("limit5TetGuides").addEventListener("change", event => {
    state.limit5TetGuides = event.target.checked;
    drawPlots();
  });
  $("limit5BaseSlider").addEventListener("input", event => setLimit5Base(event.target.value));
  $("limit5BaseInput").addEventListener("change", event => setLimit5Base(event.target.value));
  $("limit5Volume").addEventListener("input", event => {
    state.limit5Volume = Math.min(100, Math.max(0, Number(event.target.value)));
    limit5Audio.updateVolume();
    renderLimit5Controls();
  });
  $("limit5Reset").addEventListener("click", resetLimit5);
  $("tempTaskSelect").addEventListener("change", event => selectTempTask(event.target.value));
  $("tempSystemSelect").addEventListener("change", event => selectTempSystem(event.target.value));
  $("tempOpenJustLattice").addEventListener("click", () => {
    selectLimit5Preset("just12");
    selectTuningKind("limit5");
  });
  $("tempNarrowSlider").addEventListener("input", event => setTempNarrow(event.target.value));
  document.querySelectorAll("[data-temp-narrow-preset]").forEach(button => {
    button.addEventListener("click", () => selectTempNarrowPreset(button.dataset.tempNarrowPreset));
  });
  $("tempKeySelect").addEventListener("change", event => selectTempKey(Number(event.target.value)));
  $("tempQualitySelect").addEventListener("change", event => selectTempQuality(event.target.value));
  document.querySelectorAll("[data-temp-play]").forEach(button => {
    button.addEventListener("click", () => toggleTempSound(button.dataset.tempPlay));
  });
  $("tempVolume").addEventListener("input", event => {
    state.tempVolume = Math.min(100, Math.max(0, Number(event.target.value)));
    tempAudio.updateVolume();
    renderTempControls();
  });
  $("tempReset").addEventListener("click", resetTemp);
  $("tempLatticeCanvas").addEventListener("click", event => {
    const rect = $("tempLatticeCanvas").getBoundingClientRect();
    const { notes, position } = tempLatticeGeometry(rect.width, rect.height);
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const closest = notes.map(note => ({ pc: note.pc,
      point: position(note.m, state.tempSystem === "just" ? note.n :
        note.deviation * 8 / tempModel.PURE_MAJOR_THIRD) }))
      .map(note => ({ ...note, distance: Math.hypot(note.point.x - x, note.point.y - y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (closest && closest.distance <= 24) selectTempKey(closest.pc);
  });
  $("tempLatticeCanvas").addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      selectTempKey((state.tempKey + (event.key === "ArrowRight" ? 1 : 11)) % 12);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); toggleTempSound("chord");
    }
  });
  $("tempCircleCanvas").addEventListener("click", event => {
    const rect = $("tempCircleCanvas").getBoundingClientRect();
    const points = tempCirclePositions(rect.width, rect.height);
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const closest = points.map(point => ({ ...point, distance: Math.hypot(point.x - x, point.y - y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (closest && closest.distance <= 28) selectTempKey(closest.pc);
  });
  $("tempCircleCanvas").addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const index = tempModel.PITCH_CLASSES.indexOf(state.tempKey);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      selectTempKey(tempModel.PITCH_CLASSES[(index + direction + 12) % 12]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleTempSound("chord");
    }
  });
  $("limit5LatticeCanvas").addEventListener("click", event => {
    const canvas = $("limit5LatticeCanvas");
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    let closest = null;
    let distance = Infinity;
    for (const point of limit5Model.lattice(state.limit5Base)) {
      const position = limit5GridPoint(point.m, point.n, 1, 1);
      const d = Math.hypot((x - position.x) * rect.width, (y - position.y) * rect.height);
      if (d < distance) { distance = d; closest = point; }
    }
    if (closest && distance <= Math.max(17, Math.min(rect.width, rect.height) * .06)) {
      state.limit5Cursor = [closest.m, closest.n];
      toggleLimit5Point(closest.m, closest.n);
    }
  });
  $("limit5LatticeCanvas").addEventListener("focus", () => {
    state.limit5GridFocused = true;
    if (state.mode === "tuning" && state.tuningKind === "limit5") drawLimit5Lattice();
  });
  $("limit5LatticeCanvas").addEventListener("blur", () => {
    state.limit5GridFocused = false;
    if (state.mode === "tuning" && state.tuningKind === "limit5") drawLimit5Lattice();
  });
  $("limit5LatticeCanvas").addEventListener("keydown", event => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
    if (delta) {
      event.preventDefault();
      const m = state.limit5Cursor[0] + delta[0], n = state.limit5Cursor[1] + delta[1];
      if (limit5Model.within(m, n)) {
        state.limit5Cursor = [m, n];
        state.limit5Focus = [m, n];
        renderLimit5Controls();
      }
      drawLimit5Plots();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleLimit5Point(...state.limit5Cursor);
    }
  });
  document.querySelectorAll("[data-theremin-timbre]").forEach(button => {
    button.addEventListener("click", () => setMotionTimbre(button.dataset.thereminTimbre));
  });
  document.querySelectorAll("[data-theremin-vowel]").forEach(button => {
    button.addEventListener("click", () => setMotionVowel(button.dataset.thereminVowel));
  });
  $("thereminHarmonic").addEventListener("input", event => {
    setMotionHarmonic(Number(event.target.value));
  });
  document.querySelectorAll("[data-harmonic-preset]").forEach(button => {
    button.addEventListener("click", () => setHarmonicPreset(button.dataset.harmonicPreset));
  });
  document.querySelectorAll("[data-harmonic-level]").forEach(input => {
    input.addEventListener("input", event => setHarmonicLevel(input.dataset.harmonicLevel, event.target.value));
  });
  document.querySelectorAll("[data-noise-color]").forEach(button => {
    button.addEventListener("click", () => {
      if (state.noiseColor === button.dataset.noiseColor) return;
      state.noiseColor = button.dataset.noiseColor;
      noiseAudio.changeColor();
      renderNoiseControls();
      if (state.mode === "mix" && state.mixKind === "noise") drawNoisePlots();
    });
  });
  $("harmonicButton").addEventListener("click", toggleHarmonicSound);
  $("harmonicBaseSlider").addEventListener("input", event => setHarmonicBase(event.target.value));
  $("harmonicBaseInput").addEventListener("change", event => setHarmonicBase(event.target.value));
  $("harmonicVolume").addEventListener("input", event => {
    state.harmonicVolume = Math.max(0, Math.min(100, Number(event.target.value)));
    harmonicAudio.update();
    renderHarmonicControls();
  });
  $("harmonicReset").addEventListener("click", resetHarmonics);
  $("noiseButton").addEventListener("click", toggleNoiseSound);
  $("noiseCutoff").addEventListener("input", event => {
    state.noiseCutoff = Math.max(noiseModel.MIN_CUTOFF, Math.min(noiseModel.MAX_CUTOFF, Number(event.target.value)));
    noiseAudio.update();
    renderNoiseControls();
    if (state.mode === "mix" && state.mixKind === "noise") drawNoisePlots();
  });
  $("noiseVolume").addEventListener("input", event => {
    state.noiseVolume = Math.max(0, Math.min(100, Number(event.target.value)));
    noiseAudio.update();
    renderNoiseControls();
  });
  $("noiseReset").addEventListener("click", resetNoise);
  $("intervalBaseSlider").addEventListener("input", event => setIntervalBase(event.target.value));
  $("intervalBaseInput").addEventListener("change", event => setIntervalBase(event.target.value));
  $("intervalVolume").addEventListener("input", event => {
    state.intervalVolume = Math.max(0, Math.min(100, Number(event.target.value)));
    intervalAudio.update();
    renderIntervalControls();
  });
  $("intervalReset").addEventListener("click", resetInterval);
  $("mixZoomOut").addEventListener("click", () => zoomMix(-1));
  $("mixZoomIn").addEventListener("click", () => zoomMix(1));
  $("mixButton").addEventListener("click", toggleMixSound);
  $("mixBaseSlider").addEventListener("input", event => setMixBase(event.target.value));
  $("mixBaseInput").addEventListener("change", event => setMixBase(event.target.value));
  $("mixGapSlider").addEventListener("input", event => setMixGap(event.target.value));
  $("mixVolume").addEventListener("input", event => {
    state.mixVolume = Math.max(0, Math.min(100, Number(event.target.value)));
    mixAudio.update();
    renderMixControls();
  });
  $("mixViewLeft").addEventListener("click", () => panMixWindow(-1));
  $("mixViewRight").addEventListener("click", () => panMixWindow(1));
  $("mixReset").addEventListener("click", resetMix);
  const pad = $("thereminPad");
  pad.addEventListener("pointerdown", event => {
    if (state.mode !== "motion" || state.motionKind !== "theremin" || event.button > 0) return;
    event.preventDefault();
    motionPointerId = event.pointerId;
    if (pad.setPointerCapture) pad.setPointerCapture(event.pointerId);
    readPadPointer(event);
    return startMotionSound();
  });
  pad.addEventListener("pointermove", event => {
    if (motionPointerId !== event.pointerId || state.motionKind !== "theremin") return;
    event.preventDefault();
    readPadPointer(event);
  });
  const endPadTouch = event => {
    if (motionPointerId !== event.pointerId) return;
    if (pad.releasePointerCapture) {
      try { pad.releasePointerCapture(event.pointerId); }
      catch (_) { /* Capture may already have been released by the browser. */ }
    }
    stopMotionSound();
  };
  pad.addEventListener("pointerup", endPadTouch);
  pad.addEventListener("pointercancel", endPadTouch);
  pad.addEventListener("lostpointercapture", endPadTouch);
  pad.addEventListener("keydown", event => {
    const increments = {
      ArrowLeft: [-0.035, 0], ArrowRight: [0.035, 0],
      ArrowUp: [0, -0.05], ArrowDown: [0, 0.05]
    };
    if (event.key in increments) {
      event.preventDefault();
      const [dx, dy] = increments[event.key];
      setPadPosition(state.motionX + dx, state.motionY + dy);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (state.motionPlaying || motionStarting) stopMotionSound(true);
      else return startMotionSound();
    } else if (event.key === "Escape") {
      event.preventDefault();
      stopMotionSound();
    }
  });
  $("sirenButton").addEventListener("click", () => {
    if (state.motionPlaying || motionStarting) stopMotionSound(true);
    else return startMotionSound();
  });
  $("sirenLow").addEventListener("input", event => {
    state.sirenLow = Math.min(state.sirenHigh - 20, Math.max(motionModel.MIN_HZ, Number(event.target.value)));
    updateSiren();
  });
  $("sirenHigh").addEventListener("input", event => {
    state.sirenHigh = Math.max(state.sirenLow + 20, Math.min(motionModel.MAX_HZ, Number(event.target.value)));
    updateSiren();
  });
  $("sirenRate").addEventListener("input", event => {
    state.sirenRate = Math.min(motionModel.MAX_RATE, Math.max(motionModel.MIN_RATE, Number(event.target.value)));
    updateSiren();
  });
  $("sirenVolume").addEventListener("input", event => {
    state.sirenVolume = Math.min(100, Math.max(0, Number(event.target.value)));
    updateSiren();
  });
  $("motionReset").addEventListener("click", resetMotion);
  $("modePure").addEventListener("click", () => selectMode("pure"));
  $("modeStrike").addEventListener("click", () => selectMode("strike"));
  $("modeSustain").addEventListener("click", () => selectMode("sustain"));
  $("modeMotion").addEventListener("click", () => selectMode("motion"));
  $("modeMix").addEventListener("click", () => selectMode("mix"));
  $("modeTuning").addEventListener("click", () => selectMode("tuning"));
  $("modeCompose").addEventListener("click", () => selectMode("compose"));
  $("modeAnalysis").addEventListener("click", () => selectMode("analysis"));
  $("analysisKindSingle").addEventListener("click", () => switchAnalysisScreen("single"));
  $("analysisKindCompare").addEventListener("click", () => switchAnalysisScreen("compare"));
  $("compareKindSingle").addEventListener("click", () => switchAnalysisScreen("single"));
  $("compareKindCompare").addEventListener("click", () => switchAnalysisScreen("compare"));
  document.querySelectorAll("[data-compose-subtab]").forEach(button =>
    button.addEventListener("click", () => selectComposeSubtab(button.dataset.composeSubtab, true)));
  const sustainPad = $("sustainHoldButton");
  sustainPad.addEventListener("pointerdown", event => {
    if (state.mode !== "sustain" || event.button > 0 || sustainPointerId !== null) return;
    event.preventDefault();
    if (state.sustainGesture !== "hold" || state.sustainPlaying) stopSustainSound(true, "sustainReady");
    state.sustainGesture = "hold";
    sustainPointerId = event.pointerId;
    if (sustainPad.setPointerCapture) sustainPad.setPointerCapture(event.pointerId);
    return startSustainSound();
  });
  const endSustainPointer = event => {
    if (sustainPointerId !== event.pointerId) return;
    sustainPointerId = null;
    if (sustainPad.releasePointerCapture) {
      try { sustainPad.releasePointerCapture(event.pointerId); }
      catch (_) { /* Already released on some touch browsers. */ }
    }
    releaseSustainSound();
  };
  sustainPad.addEventListener("pointerup", endSustainPointer);
  sustainPad.addEventListener("pointercancel", endSustainPointer);
  sustainPad.addEventListener("lostpointercapture", endSustainPointer);
  sustainPad.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      stopSustainSound();
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      sustainIgnoreHoldClick = true;
      if (!sustainKeyboardHeld) {
        if (state.sustainGesture !== "hold" || state.sustainPlaying) stopSustainSound(true, "sustainReady");
        state.sustainGesture = "hold";
        sustainKeyboardHeld = true;
        return startSustainSound();
      }
    }
  });
  sustainPad.addEventListener("keyup", event => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (sustainKeyboardHeld) { sustainKeyboardHeld = false; releaseSustainSound(); }
    sustainIgnoreHoldClick = true;
    window.setTimeout(() => { sustainIgnoreHoldClick = false; }, 0);
  });
  sustainPad.addEventListener("blur", () => {
    if (sustainKeyboardHeld) { sustainKeyboardHeld = false; releaseSustainSound(); }
  });
  sustainPad.addEventListener("click", event => {
    if (state.mode !== "sustain") return;
    // Pointer actions are handled by pointerdown/up in hold mode. A click from
    // assistive technology (detail = 0) can still toggle an accessible note.
    if (event.detail !== 0) return;
    if (sustainIgnoreHoldClick) { sustainIgnoreHoldClick = false; return; }
    if (state.sustainGesture === "hold" && state.sustainPlaying) releaseSustainSound();
    else {
      stopSustainSound(true, "sustainReady");
      state.sustainGesture = "hold";
      return startSustainSound();
    }
  });
  $("sustainToggleButton").addEventListener("click", () => {
    if (state.mode !== "sustain") return;
    if (state.sustainGesture === "toggle" && state.sustainPlaying) {
      releaseSustainSound();
    } else {
      stopSustainSound(true, "sustainReady");
      state.sustainGesture = "toggle";
      return startSustainSound();
    }
  });
  $("sustainFrequencySlider").addEventListener("input", event =>
    setSustainPitch(heldModelFor(state.sustainKind).sliderToHz(Number(event.target.value), state.sustainKind)));
  $("sustainFrequencyInput").addEventListener("change", event => setSustainPitch(event.target.value));
  $("sustainSnap").addEventListener("change", event => {
    state.sustainSnap = event.target.checked;
    if (state.sustainSnap) setSustainPitch(state.sustainPitch);
    else renderSustainControls();
  });
  $("sustainBreath").addEventListener("input", event => {
    state.sustainBreath = Math.max(0, Math.min(100, Number(event.target.value)));
    sustainAudio.update();
    renderSustainControls();
    if (state.mode === "sustain") drawSustainPlots();
  });
  $("sustainBowPressure").addEventListener("input", event => {
    state.sustainBowPressure = Math.max(0, Math.min(100, Number(event.target.value)));
    sustainAudio.update();
    renderSustainControls();
    if (state.mode === "sustain") drawSustainPlots();
  });
  $("sustainAttack").addEventListener("input", event => {
    state.sustainAttack = Math.max(sustainModel.MIN_ATTACK,
      Math.min(sustainModel.MAX_ATTACK, Number(event.target.value)));
    renderSustainControls();
    drawPlots();
  });
  $("sustainRelease").addEventListener("input", event => {
    state.sustainRelease = Math.max(sustainModel.MIN_RELEASE,
      Math.min(sustainModel.MAX_RELEASE, Number(event.target.value)));
    renderSustainControls();
    drawPlots();
  });
  $("sustainVolume").addEventListener("input", event => {
    state.sustainVolume = Math.max(0, Math.min(100, Number(event.target.value)));
    sustainAudio.update();
    renderSustainControls();
  });
  $("sustainReset").addEventListener("click", resetSustain);
  $("strikeButton").addEventListener("click", () => triggerStrike("kick"));
  $("strikeFrequencySlider").addEventListener("input", event => {
    setStrikePitch(strikeMinPitch() * Math.pow(strikeMaxPitch() / strikeMinPitch(),
      Number(event.target.value) / 1000));
  });
  $("strikeFrequencyInput").addEventListener("change", event => setStrikePitch(event.target.value));
  $("strikeSnap").addEventListener("change", event => {
    state.strikeSnap = event.target.checked;
    if (state.strikeSnap) setStrikePitch(state.strikePitch);
    else renderStrikeControls();
  });
  $("strikePluckPosition").addEventListener("input", event => {
    stopStrikeForEdit();
    state.strikePluckPosition = Number(event.target.value) / 100;
    renderStrikeControls();
    drawPlots();
  });
  $("strikeGuitarPattern").addEventListener("change", event => {
    if (!transientModel.STRUM_PATTERNS.includes(event.target.value)) return;
    stopStrikeForEdit();
    state.strikeGuitarPattern = event.target.value;
    renderStrikeControls();
    drawPlots();
  });
  $("strikePianoType").addEventListener("change", event => {
    const voice = event.target.value;
    if (!["acoustic", "electric", "chimes", "marimba", "xylophone", "mandolin", "harp"].includes(voice) ||
        voice === state.strikePianoVoice) return;
    stopStrikeForEdit();
    state.strikePitchByVoice[strikePitchKey()] = state.strikePitch;
    state.strikePianoVoice = voice;
    restoreStrikePitch();
    state.strikeDecay = pitchedStrikeDecay();
    state.strikeStrength = voice === "marimba" ? 62 : voice === "xylophone" ? 66 :
      voice === "mandolin" ? 64 : voice === "harp" ? 62 : 55;
    state.strikeStrengthByKind.piano = state.strikeStrength;
    setStrikeStatus("strikeReady");
    renderStrikeControls();
    drawPlots();
  });
  $("strikeDrumVoice").addEventListener("change", event => {
    const voice = event.target.value;
    if (!transientModel.DRUM_VOICES.includes(voice) || voice === "chimes" || voice === state.strikeDrumVoice) return;
    stopStrikeForEdit();
    state.strikeDrumVoice = voice;
    state.strikeDrumSize = "medium";
    state.strikeDecay = { membrane: .3, snare: .33, cymbal: .55, steelpan: .8,
      chimes: .7, woodblock: .24 }[voice];
    renderStrikeControls();
    drawPlots();
  });
  $("strikeDrumTension").addEventListener("input", event => {
    stopStrikeForEdit();
    state.strikeDrumTension = Number(event.target.value) / 100;
    renderStrikeControls();
    drawPlots();
  });
  $("strikeStrength").addEventListener("input", event => {
    stopStrikeForEdit();
    state.strikeStrength = Number(event.target.value);
    state.strikeStrengthByKind[state.strikeKind] = state.strikeStrength;
    renderStrikeControls();
    drawPlots();
  });
  $("strikeDecay").addEventListener("input", event => {
    stopStrikeForEdit();
    state.strikeDecay = Number(event.target.value);
    renderStrikeControls();
    drawPlots();
  });
  $("strikeViewZoomIn").addEventListener("click", () => setStrikeView(state.strikeViewSpan / 2));
  $("strikeViewZoomOut").addEventListener("click", () => setStrikeView(state.strikeViewSpan * 2));
  $("strikeViewLeft").addEventListener("click", () => panStrikeView(-1));
  $("strikeViewRight").addEventListener("click", () => panStrikeView(1));
  $("strikeViewFit").addEventListener("click", () => setStrikeView(3, 1.5));
  $("strikeViewPreset").addEventListener("change", event => {
    const selected = Number(event.target.value);
    if (selected > 0) setStrikeView(selected, selected === 3 ? 1.5 : state.strikeCursor);
  });
  $("strikeTimeSlider").addEventListener("input", event => {
    stopStrikeFollow(); // Direct inspection takes precedence over automatic playback following.
    state.strikeCursor = Math.max(0, Math.min(3, Number(event.target.value) / 1000));
    keepStrikeCursorVisible();
    drawPlots();
  });
  $("strikeWaveCanvas").addEventListener("click", event => {
    const width = $("strikeWaveCanvas").getBoundingClientRect().width;
    const fraction = Math.max(0, Math.min(1, (event.offsetX - 44) / Math.max(1, width - 59)));
    stopStrikeFollow();
    state.strikeCursor = state.strikeViewStart + fraction * state.strikeViewSpan;
    drawPlots();
  });
  $("strikeReset").addEventListener("click", resetStrike);
  document.querySelectorAll("[data-note]").forEach(button => {
    button.addEventListener("click", () => setFrequency(model.hzFromMidi(Number(button.dataset.note))));
  });
  $("playButton").addEventListener("click", toggleSound);
  $("recordButton").addEventListener("click", toggleRecording);
  $("recordAnalyze").addEventListener("click", () => {
    if (!recordPreparedBlob || !analysis) return;
    $("recordPreview").pause();
    selectMode("analysis");
    switchAnalysisScreen("spectrum");
    analysis.openPrepared(recordPreparedBlob, $("recordDownload").download);
    showRecordResult = false;
    renderRecordControls();
  });
  $("recordDismiss").addEventListener("click", () => {
    showRecordResult = false;
    renderRecordControls();
  });
  $("stopAll").addEventListener("click", () => { stopRecording(true); stopAllAudio(); });
  $("frequencySlider").addEventListener("input", event => setFrequency(model.sliderToFrequency(Number(event.target.value))));
  $("frequencyInput").addEventListener("change", event => setFrequency(event.target.value));
  $("snapCheck").addEventListener("change", event => {
    state.snap = event.target.checked;
    if (state.snap) setFrequency(state.frequency);
    else renderControls();
  });
  $("volumeSlider").addEventListener("input", event => {
    state.volume = Number(event.target.value);
    audio.changeVolume();
    renderControls();
    drawPlots();
  });
  $("fixedTimeCheck").addEventListener("change", event => {
    state.fixedTime = event.target.checked;
    drawPlots();
  });
  $("resetButton").addEventListener("click", reset);
  $("langEn").addEventListener("click", () => setLanguage("en"));
  $("langMn").addEventListener("click", () => setLanguage("mn"));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stopRecording(); stopAllAudio(true, "hidden"); }
  });
  window.addEventListener("pagehide", () => {
    if (wavExport) wavExport.invalidate();
    stopRecording(); stopAllAudio(true, "hidden");
  });
  window.addEventListener("blur", () => {
    if (recorder.state === "recording") stopRecording();
    if (state.sustainPlaying || sustainPointerId !== null || sustainKeyboardHeld ||
        state.motionPlaying || motionStarting || state.mixPlaying || state.intervalPlaying || state.earPlaying || state.scalePlaying || state.limit5Playing || state.limit5Starting || state.tempPlaying || state.tempStarting ||
        state.harmonicPlaying || state.noisePlaying || (compose && compose.isPlaying()) ||
        (ensemble && ensemble.isPlaying()) || (analysis && analysis.isPlaying())) {
      stopAllAudio(true, "hidden");
    }
  });
  if (typeof ResizeObserver !== "undefined") {
    let resizeFrame = null;
    const observer = new ResizeObserver(() => {
      if (resizeFrame !== null) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        drawPlots();
      });
    });
    observer.observe($("waveCanvas"));
    observer.observe($("spectrumCanvas"));
    observer.observe($("strikeWaveCanvas"));
    observer.observe($("strikeSpectrumCanvas"));
    observer.observe($("sustainEnvelopeCanvas"));
    observer.observe($("sustainWaveCanvas"));
    observer.observe($("sustainSpectrumCanvas"));
    observer.observe($("motionPitchCanvas"));
    observer.observe($("motionWaveCanvas"));
    observer.observe($("motionSpectrumCanvas"));
    observer.observe($("mixWaveCanvas"));
    observer.observe($("mixSpectrumCanvas"));
    observer.observe($("intervalWaveCanvas"));
    observer.observe($("intervalSpectrumCanvas"));
    observer.observe($("earHarmonicsCanvas"));
    observer.observe($("earOctaveCanvas"));
    observer.observe($("scaleSpiralCanvas"));
    observer.observe($("scaleFourierCanvas"));
    observer.observe($("limit5LatticeCanvas"));
    observer.observe($("limit5OctaveCanvas"));
    observer.observe($("limit5FourierCanvas"));
    observer.observe($("tempLatticeCanvas"));
    observer.observe($("tempCircleCanvas"));
    observer.observe($("tempFifthsCanvas"));
    observer.observe($("tempPartialCanvas"));
    observer.observe($("harmonicWaveCanvas"));
    observer.observe($("harmonicSpectrumCanvas"));
    observer.observe($("noiseWaveCanvas"));
    observer.observe($("noiseSpectrumCanvas"));
    observer.observe($("analysisWaveCanvas"));
    observer.observe($("analysisSpectrumCanvas"));
    observer.observe($("analysisSpectroCanvas"));
    observer.observe($("compareAWave"));
    observer.observe($("compareASpectrum"));
    observer.observe($("compareBWave"));
    observer.observe($("compareBSpectrum"));
  } else window.addEventListener("resize", drawPlots);

  renderTexts();
  renderControls();
  drawPlots();
})();
