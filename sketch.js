// noprotect
/*
===========================================================
TOGETHER — ELEMENTAL AUDIO-VISUAL EXPERIENCE
===========================================================

CUSTOM EXPERIENCE
-----------------
Host chooses the participant threshold (2 → 8), then:

  Step 1  Threshold
  Step 2  Audio  (upload a loop per layer, or leave empty for synth)
  Step 3  Visuals
            • Add my own visuals, per layer:
                – upload an image / video (fills the screen)
                – any layer left empty gets generated visuals
            • I don't have visuals
                – "Yes, generate from audio"  (audio-reactive rings)
                – "No, audio only"

Custom mode does NOT trigger Fire / Water / Air / Earth / Aether / Zodiac.

PRESET EXPERIENCE
-----------------
Always fixed to 5 participants:
  1 FIRE · 2 WATER · 3 AIR · 4 EARTH · 5 AETHER
When all 5 are present the Zodiac sequence starts.

Every setup step has a ← Back button.
During a live experience, "End Experience" returns to Step 1.
===========================================================
*/


// =========================================================
// CANVAS + STATE
// =========================================================

let canvas;

const State = {
  threshold: 4,
  participants: 0,
  mode: "custom",            // "custom" | "preset"
  presetThreshold: 5,
  isComplete: false,
  layers: [],
  audioContext: null,
  masterGain: null,
  isPlaying: false,
  zodiacActive: false,
  presetComplete: false,
  visualMode: "none"         // custom only: "upload" | "generate" | "none"
};


// =========================================================
// UI VARIABLES
// =========================================================

let thresholdSlider, thresholdDisplay;
let step1, step2, step3;
let audioInputsContainer, visualInputsContainer;
let visChoiceView, visUploadView, visNoGenView;
let liveDashboard;
let currentCountEl, targetCountEl;
let progressBar, experienceMessage, statusBadge, loadingText;
let endButton;

let audioBuiltFor = 0;     // threshold the audio inputs were built for
let visualBuiltFor = 0;    // threshold the visual inputs were built for


// =========================================================
// RFID SERIAL CONNECTION
// Reads the Arduino output "TOTAL COUNT: n" (cumulative).
// Every new card read adds one participant.
// =========================================================

let rfidPort = null;
let rfidReader = null;
let rfidConnectButton;
let rfidStatusText;

let lastArduinoTotal = 0;
let rfidReadLoopActive = false;

// Scan direction. The Arduino only reports "a card was read", so the host
// chooses whether the next scans count IN or OUT.
let scanMode = 'in';          // 'in' | 'out'
let scanModeButton;


// =========================================================
// ELEMENT SYSTEMS / COLORS / PARTICLES
// =========================================================

let fireSystem, waterSystem, airSystem, earthSystem, aetherSystem;

const elementNames = ["fire", "water", "air", "earth", "aether"];

const elementColors = {
  fire:   [255, 95, 25],
  water:  [45, 150, 255],
  air:    [185, 225, 255],
  earth:  [145, 125, 70],
  aether: [180, 120, 255]
};

// colors for generated (custom-mode) visuals, one per layer
const layerColors = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#0ea5e9', '#6366f1'
];

let particles = [];


// =========================================================
// ZODIAC
// =========================================================

let zodiacParticleGroups = [];
let zodiacStarted = false;
let zodiacStartTime = 0;
const ZODIAC_DURATION = 7000;

const zodiacSigns = [
  { name: "Aries",       element: "fire",  color: [255, 95, 25] },
  { name: "Taurus",      element: "earth", color: [145, 125, 70] },
  { name: "Gemini",      element: "air",   color: [185, 225, 255] },
  { name: "Cancer",      element: "water", color: [45, 150, 255] },
  { name: "Leo",         element: "fire",  color: [255, 95, 25] },
  { name: "Virgo",       element: "earth", color: [145, 125, 70] },
  { name: "Libra",       element: "air",   color: [185, 225, 255] },
  { name: "Scorpio",     element: "water", color: [45, 150, 255] },
  { name: "Sagittarius", element: "fire",  color: [255, 95, 25] },
  { name: "Capricorn",   element: "earth", color: [145, 125, 70] },
  { name: "Aquarius",    element: "air",   color: [185, 225, 255] },
  { name: "Pisces",      element: "water", color: [45, 150, 255] }
];

// Symbol geometry as drawing ops:
//  ['L', x1,y1, x2,y2]                 line
//  ['C', x1,y1, x2,y2, x3,y3, x4,y4]   bezier curve
//  ['O', cx,cy, radius]                circle
//  ['W', startX,startY, width,height]  wave
const zodiacShapes = [
  // Aries
  [['L', -55, 35, -35, -20], ['C', -35, -20, -30, -65, -5, -65, 0, -20],
   ['C', 0, -20, 5, -65, 30, -65, 35, -20], ['L', 35, -20, 55, 35],
   ['C', -35, -20, -20, -5, -12, 15, -5, 35], ['C', 35, -20, 20, -5, 12, 15, 5, 35]],
  // Taurus
  [['O', 0, 15, 28], ['C', -28, 0, -45, -15, -45, -35, -25, -48],
   ['C', 28, 0, 45, -15, 45, -35, 25, -48], ['L', -25, -48, -12, -32], ['L', 25, -48, 12, -32]],
  // Gemini
  [['L', -38, -45, 38, -45], ['L', -38, 45, 38, 45], ['L', -22, -45, -22, 45], ['L', 22, -45, 22, 45]],
  // Cancer
  [['C', -5, -35, -40, -55, -55, -15, -25, 0], ['C', 5, 35, 40, 55, 55, 15, 25, 0],
   ['O', -30, -20, 10], ['O', 30, 20, 10]],
  // Leo
  [['C', -30, -20, -5, -50, 30, -45, 25, -15], ['C', 25, -15, 20, 15, -15, 35, -30, 10],
   ['O', 20, 25, 15], ['C', -30, 10, -40, 25, -25, 45, -5, 35]],
  // Virgo
  [['L', -40, -45, -40, 40], ['L', -15, -45, -15, 40], ['L', 10, -45, 10, 40],
   ['C', -40, -45, -25, -60, -5, -55, -15, -25], ['C', -15, -25, 0, -55, 25, -50, 25, -15],
   ['C', 25, -15, 30, 10, 10, 35, -5, 40], ['L', -5, 40, 35, 40]],
  // Libra
  [['L', -42, -25, 42, -25], ['L', -42, 25, 42, 25], ['C', -42, 25, -20, 55, 20, 55, 42, 25]],
  // Scorpio
  [['L', -45, -45, -45, 35], ['L', -20, -45, -20, 35], ['L', 5, -45, 5, 35],
   ['C', -45, -45, -30, -60, -10, -55, -20, -25], ['C', -20, -25, -5, -55, 20, -50, 5, -15],
   ['C', 5, 35, 25, 55, 45, 35, 35, 10], ['L', 35, 10, 50, 25], ['L', 50, 25, 45, 5]],
  // Sagittarius
  [['L', -45, 45, 40, -40], ['L', 15, -40, 40, -40], ['L', 40, -40, 40, -15],
   ['L', -5, 5, 25, 35], ['L', 25, 35, 5, 25]],
  // Capricorn
  [['C', -40, -25, -25, -55, 10, -50, 5, -20], ['C', 5, -20, 0, 10, -20, 20, -35, 5],
   ['C', -35, 5, -20, 40, 20, 50, 40, 20], ['C', 40, 20, 55, 5, 45, -10, 25, -5]],
  // Aquarius
  [['W', -45, -20, 90, 20], ['W', -45, 20, 90, 20]],
  // Pisces
  [['C', -20, -45, -50, -20, -50, 20, -20, 45], ['C', 20, -45, 50, -20, 50, 20, 20, 45],
   ['L', -38, 0, 38, 0]]
];


// =========================================================
// P5 SETUP / DRAW / RESIZE
// =========================================================

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  canvas.elt.style.position = 'fixed';
  canvas.elt.style.top = '0';
  canvas.elt.style.left = '0';
  canvas.elt.style.zIndex = '1';
  canvas.elt.style.display = 'block';

  background(5);

  fireSystem   = new ElementSystem("fire", 1800);
  waterSystem  = new ElementSystem("water", 1700);
  airSystem    = new ElementSystem("air", 1600);
  earthSystem  = new ElementSystem("earth", 1800);
  aetherSystem = new ElementSystem("aether", 1500);

  createInterface();
  createAmbientParticles();
}

function draw() {
  drawVisuals();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}


// =========================================================
// STYLE HELPERS
// =========================================================

function S(el, styles) {
  for (const k in styles) el.style(k, styles[k]);
  return el;
}

function styleGlass(el) {
  S(el, {
    'background': 'rgba(20,20,30,0.65)',
    'backdrop-filter': 'blur(16px)',
    '-webkit-backdrop-filter': 'blur(16px)',
    'border': '1px solid rgba(255,255,255,0.1)',
    'border-radius': '16px'
  });
}

function styleGlassButton(el) {
  styleGlass(el);
  S(el, {
    'padding': '8px 16px',
    'border-radius': '999px',
    'font-size': '14px',
    'font-weight': '600',
    'letter-spacing': '0.04em',
    'color': '#ffffff',
    'cursor': 'pointer',
    'pointer-events': 'auto'
  });
}

function styleActionButton(el, backgroundColor, textColor) {
  S(el, {
    'background': backgroundColor,
    'color': textColor,
    'font-weight': '700',
    'padding': '14px',
    'border': 'none',
    'border-radius': '8px',
    'cursor': 'pointer'
  });
}

// Outlined "← Back" button
function makeBackButton(parent, onClick) {
  const btn = createButton('← Back');
  btn.parent(parent);
  styleActionButton(btn, 'transparent', '#d1d5db');
  S(btn, {
    'border': '1px solid #4b5563',
    'padding': '14px 20px',
    'flex': '0 0 auto'
  });
  btn.mousePressed(onClick);
  return btn;
}

// Row of buttons separated from content by a thin line
function makeButtonRow(parent) {
  const row = createDiv();
  row.parent(parent);
  S(row, {
    'display': 'flex',
    'gap': '12px',
    'border-top': '1px solid #374151',
    'padding-top': '16px'
  });
  return row;
}

// Card with a label + file input (used for audio and visual layers)
function makeFileCard(parent, labelText, infoText, inputId, accept, onFile) {
  const card = createDiv();
  card.parent(parent);
  S(card, {
    'background': 'rgba(31,41,55,0.5)',
    'padding': '16px',
    'border-radius': '8px',
    'border': '1px solid #374151',
    'margin-bottom': '16px'
  });

  const hdr = createDiv();
  hdr.parent(card);
  S(hdr, { 'display': 'flex', 'justify-content': 'space-between', 'margin-bottom': '8px' });

  const label = createSpan(labelText);
  label.parent(hdr);
  S(label, { 'color': '#93c5fd', 'font-weight': '500', 'font-size': '14px' });

  const info = createSpan(infoText);
  info.parent(hdr);
  S(info, { 'color': '#6b7280', 'font-size': '12px' });

  const input = createFileInput(onFile);
  input.parent(card);
  input.attribute('accept', accept);
  input.id(inputId);
  S(input, { 'color': '#d1d5db', 'width': '100%' });
}


// =========================================================
// CREATE INTERFACE
// =========================================================

function createInterface() {
  S(select('body'), {
    'margin': '0',
    'padding': '0',
    'width': '100%',
    'height': '100%',
    'overflow': 'hidden',
    'background': '#050505',
    'color': 'white',
    'font-family': "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  });

  const uiLayer = createDiv();
  uiLayer.id('ui-layer');
  uiLayer.position(0, 0);
  S(uiLayer, {
    'width': '100vw',
    'height': '100vh',
    'z-index': '10',
    'position': 'fixed',
    'pointer-events': 'none',
    'box-sizing': 'border-box',
    'padding': '32px',
    'display': 'flex',
    'flex-direction': 'column'
  });

  // ---------------------------------------------------------
  // HEADER
  // ---------------------------------------------------------

  const header = createDiv();
  header.parent(uiLayer);
  S(header, {
    'display': 'flex',
    'justify-content': 'space-between',
    'align-items': 'center',
    'width': '100%',
    'margin-bottom': '24px',
    'flex-shrink': '0'
  });

  const title = createDiv('Together');
  title.parent(header);
  S(title, {
    'font-size': '30px',
    'font-weight': '700',
    'letter-spacing': '0.15em',
    'text-transform': 'uppercase',
    'text-shadow': '0 2px 10px rgba(255,255,255,0.2)'
  });

  const headerRight = createDiv();
  headerRight.parent(header);
  S(headerRight, { 'display': 'flex', 'align-items': 'center', 'gap': '10px' });

  endButton = createButton('End Experience');
  endButton.parent(headerRight);
  endButton.hide();
  endButton.mousePressed(endExperience);
  styleGlassButton(endButton);
  endButton.style('color', '#f87171');

  statusBadge = createDiv('SYSTEM IDLE');
  statusBadge.parent(headerRight);
  styleGlass(statusBadge);
  S(statusBadge, {
    'padding': '6px 16px',
    'font-size': '14px',
    'font-weight': '600',
    'letter-spacing': '0.05em'
  });

  // ---------------------------------------------------------
  // MAIN
  // ---------------------------------------------------------

  const main = createDiv();
  main.parent(uiLayer);
  S(main, { 'flex': '1', 'display': 'flex', 'align-items': 'center', 'justify-content': 'center' });

  // ---------------------------------------------------------
  // STEP 1 — THRESHOLD
  // ---------------------------------------------------------

  step1 = createDiv();
  step1.parent(main);
  styleGlass(step1);
  S(step1, {
    'padding': '32px',
    'width': '100%',
    'max-width': '448px',
    'box-sizing': 'border-box',
    'pointer-events': 'auto'
  });

  const step1Title = createElement('h2', 'Host Configuration');
  step1Title.parent(step1);
  S(step1Title, { 'margin': '0 0 8px 0', 'font-size': '24px' });

  const step1Text = createP('Define the participation threshold. How many people are needed to complete the custom experience?');
  step1Text.parent(step1);
  S(step1Text, { 'color': '#9ca3af', 'font-size': '14px', 'margin-bottom': '24px' });

  const thresholdLabel = createDiv('Custom Participant Threshold');
  thresholdLabel.parent(step1);
  S(thresholdLabel, { 'font-size': '14px', 'font-weight': '500', 'margin-bottom': '8px' });

  const sliderRow = createDiv();
  sliderRow.parent(step1);
  S(sliderRow, { 'display': 'flex', 'align-items': 'center', 'gap': '16px', 'margin-bottom': '24px' });

  thresholdSlider = createSlider(2, 8, 4, 1);
  thresholdSlider.parent(sliderRow);
  thresholdSlider.style('width', '100%');

  thresholdDisplay = createDiv('4');
  thresholdDisplay.parent(sliderRow);
  S(thresholdDisplay, { 'font-size': '24px', 'font-weight': '700', 'width': '32px', 'text-align': 'center' });

  thresholdSlider.input(() => {
    State.threshold = parseInt(thresholdSlider.value());
    thresholdDisplay.html(State.threshold);
  });

  const nextButton = createButton('Next: Configure Audio Mapping');
  nextButton.parent(step1);
  styleActionButton(nextButton, '#ffffff', '#000000');
  nextButton.style('width', '100%');
  nextButton.mousePressed(goToStep2);

  // ---------------------------------------------------------
  // STEP 2 — AUDIO
  // ---------------------------------------------------------

  step2 = createDiv();
  step2.parent(main);
  styleGlass(step2);
  S(step2, {
    'padding': '32px',
    'width': '100%',
    'max-width': '576px',
    'box-sizing': 'border-box',
    'max-height': '70vh',
    'display': 'none',
    'flex-direction': 'column',
    'pointer-events': 'auto'
  });

  const step2Title = createElement('h2', 'Audio Mapping');
  step2Title.parent(step2);
  S(step2Title, { 'margin': '0 0 8px 0', 'font-size': '24px' });

  const step2Text = createP('Upload an audio loop for each layer (empty layers use a synth tone), or use the 5-participant elemental preset.');
  step2Text.parent(step2);
  S(step2Text, { 'color': '#9ca3af', 'font-size': '14px' });

  audioInputsContainer = createDiv();
  audioInputsContainer.parent(step2);
  S(audioInputsContainer, { 'overflow-y': 'auto', 'margin-bottom': '24px', 'min-height': '200px', 'flex': '1' });

  const audioRow = makeButtonRow(step2);

  makeBackButton(audioRow, goToStep1);

  const presetButton = createButton('Use Synth Presets — 5 Participants');
  presetButton.parent(audioRow);
  styleActionButton(presetButton, '#374151', '#ffffff');
  presetButton.style('flex', '1');
  presetButton.mousePressed(usePresetsAndStart);

  const toVisualsButton = createButton('Next: Visuals →');
  toVisualsButton.parent(audioRow);
  styleActionButton(toVisualsButton, '#ffffff', '#000000');
  toVisualsButton.style('flex', '1');
  toVisualsButton.mousePressed(goToStep3);

  // ---------------------------------------------------------
  // STEP 3 — VISUALS (custom experience only)
  // ---------------------------------------------------------

  step3 = createDiv();
  step3.parent(main);
  styleGlass(step3);
  S(step3, {
    'padding': '32px',
    'width': '100%',
    'max-width': '576px',
    'box-sizing': 'border-box',
    'max-height': '70vh',
    'display': 'none',
    'flex-direction': 'column',
    'pointer-events': 'auto'
  });

  const step3Title = createElement('h2', 'Visual Mapping');
  step3Title.parent(step3);
  S(step3Title, { 'margin': '0 0 8px 0', 'font-size': '24px' });

  // ----- view A: choice -----

  visChoiceView = createDiv();
  visChoiceView.parent(step3);

  const choiceText = createP('Do you want to add your own visuals for this experience?');
  choiceText.parent(visChoiceView);
  S(choiceText, { 'color': '#9ca3af', 'font-size': '14px', 'margin-bottom': '24px' });

  const addVisualsButton = createButton('Add my own visuals');
  addVisualsButton.parent(visChoiceView);
  styleActionButton(addVisualsButton, '#ffffff', '#000000');
  S(addVisualsButton, { 'width': '100%', 'margin-bottom': '12px' });
  addVisualsButton.mousePressed(() => showVisualView('upload'));

  const noVisualsButton = createButton("I don't have visuals");
  noVisualsButton.parent(visChoiceView);
  styleActionButton(noVisualsButton, '#374151', '#ffffff');
  S(noVisualsButton, { 'width': '100%', 'margin-bottom': '24px' });
  noVisualsButton.mousePressed(() => showVisualView('nogen'));

  const choiceRow = makeButtonRow(visChoiceView);
  makeBackButton(choiceRow, goToStep2);

  // ----- view B: upload visuals -----

  visUploadView = createDiv();
  visUploadView.parent(step3);
  S(visUploadView, { 'display': 'none', 'flex-direction': 'column', 'flex': '1', 'min-height': '0' });

  const uploadText = createP('Upload an image or video for each layer. Uploaded visuals fill the screen, and empty layers get generated visuals. Everything appears when that participant joins.');
  uploadText.parent(visUploadView);
  S(uploadText, { 'color': '#9ca3af', 'font-size': '14px' });

  visualInputsContainer = createDiv();
  visualInputsContainer.parent(visUploadView);
  S(visualInputsContainer, { 'overflow-y': 'auto', 'margin-bottom': '24px', 'min-height': '200px', 'flex': '1' });

  const uploadRow = makeButtonRow(visUploadView);
  makeBackButton(uploadRow, () => showVisualView('choice'));

  const startUploadButton = createButton('Start Custom Experience');
  startUploadButton.parent(uploadRow);
  styleActionButton(startUploadButton, '#ffffff', '#000000');
  startUploadButton.style('flex', '1');
  startUploadButton.mousePressed(() => startCustomExperience('upload'));

  // ----- view C: generate from audio? -----

  visNoGenView = createDiv();
  visNoGenView.parent(step3);
  S(visNoGenView, { 'display': 'none' });

  const noGenText = createP('No problem. Would you like to generate visuals from your audio? They react live to the loudness and tone of each layer.');
  noGenText.parent(visNoGenView);
  S(noGenText, { 'color': '#9ca3af', 'font-size': '14px', 'margin-bottom': '24px' });

  const generateButton = createButton('Yes, generate from audio');
  generateButton.parent(visNoGenView);
  styleActionButton(generateButton, '#ffffff', '#000000');
  S(generateButton, { 'width': '100%', 'margin-bottom': '12px' });
  generateButton.mousePressed(() => startCustomExperience('generate'));

  const audioOnlyButton = createButton('No, audio only');
  audioOnlyButton.parent(visNoGenView);
  styleActionButton(audioOnlyButton, '#374151', '#ffffff');
  S(audioOnlyButton, { 'width': '100%', 'margin-bottom': '24px' });
  audioOnlyButton.mousePressed(() => startCustomExperience('none'));

  const noGenRow = makeButtonRow(visNoGenView);
  makeBackButton(noGenRow, () => showVisualView('choice'));

  // ----- shared loading text -----

  loadingText = createDiv('Processing files...');
  loadingText.parent(step3);
  S(loadingText, {
    'display': 'none',
    'text-align': 'center',
    'font-size': '14px',
    'margin-top': '16px',
    'color': '#93c5fd'
  });

  // ---------------------------------------------------------
  // LIVE DASHBOARD
  // ---------------------------------------------------------

  liveDashboard = createDiv();
  liveDashboard.parent(uiLayer);
  S(liveDashboard, {
    'display': 'none',
    'width': '100%',
    'justify-content': 'space-between',
    'align-items': 'flex-end',
    'gap': '16px',
    'pointer-events': 'none'
  });

  // ----- state panel -----

  const statePanel = createDiv();
  statePanel.parent(liveDashboard);
  styleGlass(statePanel);
  S(statePanel, { 'padding': '24px', 'width': '33%', 'box-sizing': 'border-box' });

  const stateTitle = createDiv('SYSTEM STATE');
  stateTitle.parent(statePanel);
  S(stateTitle, { 'color': '#9ca3af', 'font-size': '12px', 'letter-spacing': '0.1em', 'margin-bottom': '4px' });

  const countContainer = createDiv();
  countContainer.parent(statePanel);

  currentCountEl = createSpan('0');
  currentCountEl.parent(countContainer);
  S(currentCountEl, { 'font-size': '40px', 'font-weight': '700' });

  const slash = createSpan(' / ');
  slash.parent(countContainer);
  S(slash, { 'color': '#6b7280', 'font-size': '24px' });

  targetCountEl = createSpan('4');
  targetCountEl.parent(countContainer);
  S(targetCountEl, { 'color': '#6b7280', 'font-size': '24px' });

  const progressOuter = createDiv();
  progressOuter.parent(statePanel);
  S(progressOuter, {
    'height': '8px',
    'background': '#1f2937',
    'border-radius': '999px',
    'overflow': 'hidden',
    'margin': '8px 0 16px 0'
  });

  progressBar = createDiv();
  progressBar.parent(progressOuter);
  S(progressBar, {
    'height': '100%',
    'width': '0%',
    'background': '#ffffff',
    'border-radius': '999px',
    'transition': 'width 0.5s'
  });

  experienceMessage = createP('Ambient mode. Waiting for participants.');
  experienceMessage.parent(statePanel);
  S(experienceMessage, { 'color': '#d1d5db', 'font-size': '14px' });

  // ----- RFID scanner panel -----

  const scanner = createDiv();
  scanner.parent(liveDashboard);
  styleGlass(scanner);
  S(scanner, {
    'padding': '24px',
    'width': '33%',
    'box-sizing': 'border-box',
    'border-top': '4px solid #3b82f6',
    'pointer-events': 'auto'
  });

  const scannerTitle = createDiv('▦ RFID PARTICIPANT COUNT');
  scannerTitle.parent(scanner);
  S(scannerTitle, { 'font-weight': '600', 'margin-bottom': '16px' });

  rfidConnectButton = createButton('Connect RFID Reader');
  rfidConnectButton.parent(scanner);
  styleActionButton(rfidConnectButton, '#374151', '#ffffff');
  S(rfidConnectButton, { 'width': '100%', 'margin-bottom': '12px' });
  rfidConnectButton.mousePressed(connectRFIDReader);

  scanModeButton = createButton('');
  scanModeButton.parent(scanner);
  styleActionButton(scanModeButton, '#10b981', '#ffffff');
  S(scanModeButton, { 'width': '100%', 'margin-bottom': '12px' });
  scanModeButton.mousePressed(toggleScanMode);
  updateScanModeButton();

  rfidStatusText = createP('RFID reader not connected');
  rfidStatusText.parent(scanner);
  S(rfidStatusText, { 'color': '#d1d5db', 'font-size': '13px' });

}


// =========================================================
// NAVIGATION
// =========================================================

// n: 1 | 2 | 3 shows that setup step, 0 hides all (live mode)
function showStep(n) {
  step1.style('display', n === 1 ? 'block' : 'none');
  step2.style('display', n === 2 ? 'flex' : 'none');
  step3.style('display', n === 3 ? 'flex' : 'none');
}

// view: 'choice' | 'upload' | 'nogen'
function showVisualView(view) {
  visChoiceView.style('display', view === 'choice' ? 'block' : 'none');
  visUploadView.style('display', view === 'upload' ? 'flex' : 'none');
  visNoGenView.style('display', view === 'nogen' ? 'block' : 'none');

  if (view === 'upload' && visualBuiltFor !== State.threshold) {
    generateVisualInputs();
    visualBuiltFor = State.threshold;
  }
}

function goToStep1() {
  State.mode = "custom";
  showStep(1);
}

function goToStep2() {
  State.mode = "custom";

  // a preset run sets threshold to 5, so re-sync with the slider
  State.threshold = parseInt(thresholdSlider.value());
  State.presetComplete = false;
  State.zodiacActive = false;
  State.isComplete = false;
  State.participants = 0;

  // Only rebuild inputs when the threshold changed,
  // so files chosen earlier survive Back / Next.
  if (audioBuiltFor !== State.threshold) {
    generateAudioInputs();
    audioBuiltFor = State.threshold;
  }

  showStep(2);
}

function goToStep3() {
  State.mode = "custom";
  showVisualView('choice');
  showStep(3);
}

// Disable / enable every button inside step 3 while files are processed
function setStartBusy(busy) {
  if (!step3) return;

  step3.elt.querySelectorAll('button').forEach(b => {
    b.disabled = busy;
    b.style.opacity = busy ? '0.5' : '1';
  });
}


// =========================================================
// AUDIO / VISUAL FILE INPUTS
// =========================================================

function generateAudioInputs() {
  audioInputsContainer.html('');

  const numberOfLayers = State.mode === "preset" ? 5 : State.threshold;

  for (let i = 1; i <= numberOfLayers; i++) {
    const labelText = State.mode === "preset"
      ? `Layer ${i} — ${elementNames[i - 1].toUpperCase()}`
      : `Layer ${i} Audio`;

    makeFileCard(
      audioInputsContainer,
      labelText,
      `Activates on participant ${i}`,
      `audio-file-${i}`,
      'audio/*',
      handleAudioFile
    );
  }
}

function generateVisualInputs() {
  visualInputsContainer.html('');

  for (let i = 1; i <= State.threshold; i++) {
    makeVisualCard(visualInputsContainer, i);
  }
}

// Files are read when the experience starts.
function handleAudioFile(file) {}
function handleVisualFile(file) {}


// =========================================================
// AUDIO ENGINE
// =========================================================

async function initAudioContext() {
  if (!State.audioContext) {
    State.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    State.masterGain = State.audioContext.createGain();
    State.masterGain.connect(State.audioContext.destination);
    State.masterGain.gain.value = 1;
  }

  if (State.audioContext.state === 'suspended') {
    await State.audioContext.resume();
  }
}

// Soft, warm pad. Every layer is a note from the same D major
// pentatonic scale, so any combination of layers sounds consonant.
// All frequencies are snapped to whole cycles per loop, so the loop
// is seamless: no clicks, no fade-in/out gap, just a slow swell.
function createSynthBuffer(layerIndex) {
  const sampleRate = State.audioContext.sampleRate;
  const loopSeconds = 8;
  const length = Math.floor(sampleRate * loopSeconds);
  const buffer = State.audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // D3, A3, D4, F#4, A4, B4, D5, E5
  const notes = [146.83, 220.00, 293.66, 369.99, 440.00, 493.88, 587.33, 659.25];
  const noteIndex = Math.max(0, layerIndex - 1) % notes.length;

  // snap a frequency to a whole number of cycles per loop
  const snap = (f) => Math.max(1, Math.round(f * loopSeconds)) / loopSeconds;

  const f0 = snap(notes[noteIndex]);

  // gently detuned copies of the note give a slow, warm "chorus" shimmer
  const voices = [
    { f: f0,                    a: 1.00 },
    { f: snap(f0 + 0.30),       a: 0.55 },
    { f: snap(f0 - 0.30),       a: 0.55 },
    { f: snap(f0 * 2),          a: 0.18 },   // soft octave
    { f: snap(f0 * 3),          a: 0.05 }    // faint upper warmth
  ];

  // slow "breathing", a different speed per layer (whole cycles per loop)
  const breathCycles = 1 + (noteIndex % 3);

  const twoPi = 2 * Math.PI;
  let peak = 0;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    let sample = 0;
    for (const v of voices) {
      sample += Math.sin(twoPi * v.f * t) * v.a;
    }

    const breath = 0.78 + 0.22 * Math.sin(twoPi * breathCycles * t / loopSeconds);

    sample *= breath;
    data[i] = sample;

    if (Math.abs(sample) > peak) peak = Math.abs(sample);
  }

  // normalise to a quiet, comfortable level so stacked layers never get harsh
  const targetPeak = 0.13;
  const gain = peak > 0 ? targetPeak / peak : 1;

  for (let i = 0; i < length; i++) {
    data[i] *= gain;
  }

  return buffer;
}

function setupLayerAudio(buffer, layerIndex) {
  const source = State.audioContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const gainNode = State.audioContext.createGain();
  gainNode.gain.value = 0;

  const analyser = State.audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;

  source.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(State.masterGain);
  source.start(0);

  State.layers.push({
    index: layerIndex,
    source: source,
    gainNode: gainNode,
    analyser: analyser,
    dataArray: new Uint8Array(analyser.frequencyBinCount),

    // custom-mode visuals
    media: null,            // { type, el, url, ready }
    useGenerated: false,    // true → draw generated audio-reactive visual
    vis: 0                  // 0..1 fade
  });
}

// Stops all layer audio and frees uploaded media
function teardownLayers() {
  State.layers.forEach(layer => {
    try { layer.source.stop(); } catch (e) {}
    try { layer.source.disconnect(); } catch (e) {}
    disposeLayerMedia(layer);
  });

  State.layers = [];
}


// =========================================================
// START EXPERIENCES
// =========================================================

// visualMode: 'upload' | 'generate' | 'none'
async function startCustomExperience(visualMode) {
  State.mode = "custom";
  State.presetComplete = false;
  State.zodiacActive = false;
  State.isComplete = false;
  State.participants = 0;
  State.visualMode = visualMode;

  setStartBusy(true);
  loadingText.show();

  try {
    await initAudioContext();

    State.layers = [];

    for (let i = 1; i <= State.threshold; i++) {
      const fileInput = document.getElementById(`audio-file-${i}`);
      let buffer;

      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const arrayBuffer = await fileInput.files[0].arrayBuffer();
        buffer = await State.audioContext.decodeAudioData(arrayBuffer);
      } else {
        buffer = createSynthBuffer(i);
      }

      setupLayerAudio(buffer, i);
    }

    attachVisualsToLayers(visualMode);

    transitionToLive();

  } catch (error) {
    console.error("Audio Processing Error:", error);
    alert("Error processing audio. Please ensure files are valid audio formats.");

    teardownLayers();
    setStartBusy(false);
    loadingText.hide();
  }
}

async function usePresetsAndStart() {
  State.mode = "preset";
  State.threshold = State.presetThreshold;
  State.participants = 0;
  State.isComplete = false;
  State.presetComplete = false;
  State.zodiacActive = false;
  State.visualMode = "none";

  zodiacStarted = false;
  zodiacParticleGroups = [];

  await initAudioContext();

  State.layers = [];

  for (let i = 1; i <= 5; i++) {
    setupLayerAudio(createSynthBuffer(i), i);
  }

  transitionToLive();
}


// =========================================================
// CUSTOM VISUALS: UPLOADED MEDIA
// =========================================================

function attachVisualsToLayers(visualMode) {
  State.layers.forEach(layer => {
    layer.vis = 0;
    layer.media = null;
    layer.useGenerated = false;

    if (visualMode === 'generate') {
      layer.useGenerated = true;
    }

    else if (visualMode === 'upload') {
      const input = document.getElementById(`visual-file-${layer.index}`);
      const file = input && input.files && input.files[0];

      if (file) {
        layer.media = createLayerMedia(file, layer);
      } else {
        // no file for this layer → fall back to generated visuals
        layer.useGenerated = true;
      }
    }
  });
}

function createLayerMedia(file, layer) {
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/');

  const media = {
    type: isVideo ? 'video' : 'image',
    url: url,
    el: null,
    ready: false
  };

  const onReady = () => { media.ready = true; };

  const onFail = () => {
    console.warn(`Layer ${layer.index}: could not load visual, using generated visuals instead.`);
    layer.media = null;
    layer.useGenerated = true;
  };

  if (isVideo) {
    const video = document.createElement('video');

    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('error', onFail);

    video.src = url;

    const playPromise = video.play();
    if (playPromise && playPromise.catch) playPromise.catch(() => {});

    media.el = video;
  }

  else {
    const img = new Image();

    img.onload = onReady;
    img.onerror = onFail;
    img.src = url;

    media.el = img;
  }

  return media;
}

function disposeLayerMedia(layer) {
  const media = layer.media;

  if (!media) return;

  if (media.type === 'video') {
    try { media.el.pause(); } catch (e) {}
    try { media.el.removeAttribute('src'); media.el.load(); } catch (e) {}
  }

  try { URL.revokeObjectURL(media.url); } catch (e) {}

  layer.media = null;
}

// Cover-fit the media over the canvas, screen-blended,
// pulsing gently with the layer's audio.
function drawLayerMedia(layer, intensity) {
  const media = layer.media;

  if (!media || !media.ready) return;

  const iw = media.type === 'video' ? media.el.videoWidth : media.el.naturalWidth;
  const ih = media.type === 'video' ? media.el.videoHeight : media.el.naturalHeight;

  if (!iw || !ih) return;

  const scaleToCover = Math.max(width / iw, height / ih) * (1 + intensity * 0.06);
  const w = iw * scaleToCover;
  const h = ih * scaleToCover;

  const alpha = (layer.mvis || 0) * constrain(0.25 + intensity * 0.9, 0, 0.7);

  const ctx = drawingContext;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha;
  ctx.drawImage(media.el, width / 2 - w / 2, height / 2 - h / 2, w, h);
  ctx.restore();
}


// =========================================================
// CUSTOM VISUALS: GENERATED FROM AUDIO
// =========================================================

function drawGeneratedLayer(i, intensity, vis) {
  const hex = layerColors[i % layerColors.length];
  const c = color(hex);
  c.setAlpha(255 * vis);

  const sc = constrain(min(width, height) / 800, 0.7, 1.6);
  const baseRadius = (50 + i * 40) * sc;
  const radius = baseRadius + intensity * 100 * sc;

  push();
  translate(width / 2, height / 2);

  if (State.isComplete) {
    rotate(millis() * 0.001 * (i + 1) * 0.2);

    stroke(c);
    strokeWeight(2 + intensity * 5);
    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = hex;
    noFill();

    const sides = 3 + i;

    beginShape();
    for (let j = 0; j <= sides; j++) {
      const angle = (j * TWO_PI) / sides;
      vertex(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    endShape();

    drawingContext.shadowBlur = 0;
  }

  else {
    stroke(c);
    strokeWeight(1 + intensity * 3);
    noFill();

    beginShape();
    for (let angle = 0; angle < TWO_PI; angle += 0.1) {
      const wobble = Math.sin(angle * 5 + millis() * 0.002) * (10 * intensity * (i + 1));
      const r = radius + wobble;
      vertex(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    endShape(CLOSE);

    const numParticles = Math.floor(intensity * 20);

    noStroke();
    fill(c);

    for (let p = 0; p < numParticles; p++) {
      const pa = random(TWO_PI);
      const pr = radius + random(-20, 20);
      circle(Math.cos(pa) * pr, Math.sin(pa) * pr, random(0, 3) * 2);
    }
  }

  pop();
}

// ---------------------------------------------------------
// UPLOADED IMAGES / VIDEOS: ONLY THE LATEST PARTICIPANT'S
// The newest participant's media is shown on its own. When it
// changes (someone joins or leaves) the images cross-fade.
// ---------------------------------------------------------
let mediaCurrent = -1;          // layer index currently shown

function updateMediaSlideshow() {
  let latest = -1;

  for (let i = 0; i < State.layers.length; i++) {
    if (i < State.participants && State.layers[i].media) latest = i;
  }

  mediaCurrent = latest;
}

function drawCustomVisuals() {
  if (State.visualMode === 'none' || State.layers.length === 0) return;

  updateMediaSlideshow();

  const generatedIntensities = [];
  let generatedVis = 0;

  for (let i = 0; i < State.layers.length; i++) {
    const layer = State.layers[i];

    // fade in when the participant joins, out when they leave
    const target = i < State.participants ? 1 : 0;
    layer.vis += (target - layer.vis) * 0.04;

    const intensity = getAudioData(layer);

    // uploaded media: only the current one is faded in, the rest fade out
    if (layer.media) {
      const mTarget = (i === mediaCurrent) ? 1 : 0;
      layer.mvis = (layer.mvis || 0) + (mTarget - (layer.mvis || 0)) * 0.05;

      if (layer.mvis > 0.01) drawLayerMedia(layer, intensity);
      continue;
    }

    if (layer.vis < 0.01) continue;

    if (layer.useGenerated) {
      drawGeneratedLayer(i, intensity, layer.vis);
      generatedIntensities.push(intensity);
      generatedVis = Math.max(generatedVis, layer.vis);
    }
  }

  // glowing core for generated visuals
  if (generatedIntensities.length > 0) {
    const combined =
      generatedIntensities.reduce((a, b) => a + b, 0) / generatedIntensities.length;

    const centerColor = State.isComplete ? '#ffffff' : layerColors[0];
    const cc = color(centerColor);
    cc.setAlpha(255 * generatedVis);

    drawingContext.shadowBlur = 50 * combined;
    drawingContext.shadowColor = centerColor;
    noStroke();
    fill(cc);
    circle(width / 2, height / 2, 40 + combined * 60);
    drawingContext.shadowBlur = 0;
  }
}


// =========================================================
// CUSTOM VISUALS: UPLOADED FILE INPUTS
// =========================================================

function makeVisualCard(parent, i) {
  const card = createDiv();
  card.parent(parent);
  S(card, {
    'background': 'rgba(31,41,55,0.5)',
    'padding': '16px',
    'border-radius': '8px',
    'border': '1px solid #374151',
    'margin-bottom': '16px'
  });

  const hdr = createDiv();
  hdr.parent(card);
  S(hdr, { 'display': 'flex', 'justify-content': 'space-between', 'margin-bottom': '10px' });

  const label = createSpan(`Layer ${i} Visual`);
  label.parent(hdr);
  S(label, { 'color': '#93c5fd', 'font-weight': '500', 'font-size': '14px' });

  const info = createSpan(`Shows on participant ${i}`);
  info.parent(hdr);
  S(info, { 'color': '#6b7280', 'font-size': '12px' });

  const uploadText = createDiv('Upload an image or video');
  uploadText.parent(card);
  S(uploadText, { 'color': '#6b7280', 'font-size': '12px', 'margin-bottom': '6px' });

  const input = createFileInput(handleVisualFile);
  input.parent(card);
  input.attribute('accept', 'image/*,video/*');
  input.id(`visual-file-${i}`);
  S(input, { 'color': '#d1d5db', 'width': '100%' });
}


// =========================================================
// LIVE / END
// =========================================================

function transitionToLive() {
  State.isPlaying = true;

  showStep(0);

  liveDashboard.show();
  liveDashboard.style('display', 'flex');

  endButton.show();

  updateLiveDashboard();
  createAmbientParticles();
}

function endExperience() {
  State.isPlaying = false;
  State.participants = 0;
  State.isComplete = false;
  State.presetComplete = false;
  State.zodiacActive = false;
  State.mode = "custom";
  State.visualMode = "none";

  zodiacStarted = false;
  zodiacParticleGroups = [];

  teardownLayers();

  liveDashboard.hide();
  endButton.hide();

  setStartBusy(false);
  loadingText.hide();
  showVisualView('choice');
  showStep(1);

  statusBadge.html('SYSTEM IDLE');
  statusBadge.style('color', '#d1d5db');

  createAmbientParticles();
}


// =========================================================
// PARTICIPANT SCAN
// =========================================================

function processScan(isEntry) {
  if (!State.isPlaying) return;

  // ENTRY
  if (isEntry) {
    const limit = State.mode === "preset" ? 5 : State.threshold;

    if (State.participants < limit) {
      State.participants++;
    }
  }

  // EXIT
  else {
    if (State.participants > 0) {
      State.participants--;
    }

    if (State.mode === "preset" && State.participants < 5) {
      State.zodiacActive = false;
      State.presetComplete = false;
      zodiacStarted = false;
      zodiacParticleGroups = [];
    }
  }

  // COMPLETION
  const activeThreshold = State.mode === "preset" ? 5 : State.threshold;

  State.isComplete = (State.participants >= activeThreshold);

  // PRESET COMPLETION → ZODIAC
  if (State.mode === "preset" && State.participants === 5) {
    State.presetComplete = true;
    State.zodiacActive = true;
    startZodiacSequence();
  }

  updateLiveDashboard();
  updateAudioLayers();
}


// =========================================================
// LIVE DASHBOARD
// =========================================================

function updateLiveDashboard() {
  currentCountEl.html(State.participants);

  const displayThreshold = State.mode === "preset" ? 5 : State.threshold;

  targetCountEl.html(displayThreshold);

  const percentage = Math.min((State.participants / displayThreshold) * 100, 100);

  progressBar.style('width', `${percentage}%`);

  if (State.participants === 0) {
    experienceMessage.html(
      State.mode === "preset"
        ? 'Preset ready. Waiting for participant 1 of 5.'
        : 'Ambient mode. Waiting for participants.'
    );

    statusBadge.html(State.mode === "preset" ? 'PRESET' : 'AMBIENT');
    statusBadge.style('color', '#9ca3af');
  }

  else if (State.mode === "preset" && State.participants < 5) {
    const currentElement = getElementForParticipant(State.participants);

    experienceMessage.html(
      `Building preset... ${currentElement.toUpperCase()} layer active.`
    );

    statusBadge.html('PRESET BUILDING');
    statusBadge.style('color', '#60a5fa');
  }

  else if (State.mode === "custom" && State.participants < State.threshold) {
    experienceMessage.html(
      `Building custom experience... ${State.participants} participant${State.participants === 1 ? '' : 's'} active.`
    );

    statusBadge.html('BUILDING');
    statusBadge.style('color', '#60a5fa');
  }

  else if (State.mode === "preset" && State.participants === 5) {
    experienceMessage.html(
      'All 5 participants present. Five elemental layers complete — Zodiac sequence active.'
    );

    statusBadge.html('PRESET COMPLETE');
    statusBadge.style('color', '#4ade80');
  }

  else {
    experienceMessage.html('Custom participation threshold reached.');

    statusBadge.html('COMPLETE');
    statusBadge.style('color', '#4ade80');
  }
}

function getElementForParticipant(participantNumber) {
  if (State.mode !== "preset") return null;
  if (participantNumber <= 0) return null;
  if (participantNumber > 5) return null;

  return elementNames[participantNumber - 1];
}


// =========================================================
// UPDATE AUDIO LAYERS
// =========================================================

function updateAudioLayers() {
  if (!State.audioContext) return;

  const now = State.audioContext.currentTime;
  const fadeTime = 2.0;

  State.layers.forEach((layer, index) => {
    const targetVolume = index < State.participants ? 1.0 : 0.0;

    layer.gainNode.gain.cancelScheduledValues(now);
    layer.gainNode.gain.setValueAtTime(layer.gainNode.gain.value, now);
    layer.gainNode.gain.linearRampToValueAtTime(targetVolume, now + fadeTime);
  });

  const targetMaster = State.isComplete ? 1.2 : 1.0;

  State.masterGain.gain.cancelScheduledValues(now);
  State.masterGain.gain.setValueAtTime(State.masterGain.gain.value, now);
  State.masterGain.gain.linearRampToValueAtTime(targetMaster, now + fadeTime);
}

function getAudioData(layer) {
  if (!layer || !layer.analyser) return 0;

  layer.analyser.getByteFrequencyData(layer.dataArray);

  const dataLength = Math.floor(layer.dataArray.length / 2);

  if (dataLength === 0) return 0;

  let sum = 0;

  for (let i = 0; i < dataLength; i++) {
    sum += layer.dataArray[i];
  }

  return (sum / dataLength) / 255;
}


// =========================================================
// AMBIENT PARTICLES
// =========================================================

function createAmbientParticles() {
  particles = [];

  for (let i = 0; i < 50; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      size: random(1, 3),
      speedX: random(-0.25, 0.25),
      speedY: random(-0.25, 0.25),
      baseAlpha: random(0.1, 0.6)
    });
  }
}


// =========================================================
// MAIN VISUAL SYSTEM
// =========================================================

function drawVisuals() {
  noStroke();
  fill(2, 3, 7, 51);
  rect(0, 0, width, height);

  drawAtmosphere();
  drawAmbientParticles();

  // preset: five elements
  if (State.isPlaying && State.mode === "preset" && State.participants > 0) {
    drawActiveElementVisuals();
  }

  // custom: uploaded media and/or generated audio-reactive visuals
  if (State.isPlaying && State.mode === "custom") {
    drawCustomVisuals();
  }

  // preset: zodiac
  if (State.isPlaying && State.mode === "preset" && State.zodiacActive) {
    drawZodiacSequence();
  }

  drawVignette();
}

function drawAtmosphere() {
  noStroke();

  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxRadius = max(width, height) * 0.75;

  for (let radius = maxRadius; radius > 50; radius -= 35) {
    const alpha = map(radius, maxRadius, 50, 0, 3);

    fill(40, 35, 70, alpha);
    circle(cx, cy, radius);
  }
}

function drawAmbientParticles() {
  particles.forEach(p => {
    p.x += p.speedX;
    p.y += p.speedY;

    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;

    noStroke();
    fill(255, p.baseAlpha * 255);
    circle(p.x, p.y, p.size * 2);
  });
}

function drawVignette() {
  drawingContext.save();

  const gradient = drawingContext.createRadialGradient(
    width * 0.5,
    height * 0.5,
    min(width, height) * 0.15,
    width * 0.5,
    height * 0.5,
    max(width, height) * 0.75
  );

  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.65)");

  drawingContext.fillStyle = gradient;
  drawingContext.fillRect(0, 0, width, height);

  drawingContext.restore();
}


// =========================================================
// PRESET: ACTIVE ELEMENT VISUALS
// =========================================================

// Per-layer multiplier on the audio level that drives the preset visuals
// (FIRE, WATER, AIR, EARTH, AETHER). Raise a value to make that element
// move faster and brighter, lower it to slow it down.
const PRESET_VISUAL_BOOST = [10, 7, 8, 5, 7];

function drawActiveElementVisuals() {
  if (State.mode !== "preset") return;

  const activeLayers = Math.min(State.participants, 5, State.layers.length);

  for (let i = 0; i < activeLayers; i++) {
    const layer = State.layers[i];
    // The soft pad has far less spectral energy than the old harsh synth,
    // so its raw level is scaled up to drive the visuals at the original speed.
    const audioIntensity = Math.min(1, getAudioData(layer) * PRESET_VISUAL_BOOST[i]);
    const elementName = getElementForParticipant(i + 1);

    if (!elementName) continue;

    const visualAmount = constrain(0.18 + audioIntensity * 1.35, 0.18, 1.5);
    const system = getElementSystem(elementName);

    if (!system) continue;

    system.update(visualAmount);
    system.render(visualAmount);
  }
}

function getElementSystem(elementName) {
  if (State.mode !== "preset") return null;

  if (elementName === "fire") return fireSystem;
  if (elementName === "water") return waterSystem;
  if (elementName === "air") return airSystem;
  if (elementName === "earth") return earthSystem;
  if (elementName === "aether") return aetherSystem;

  return null;
}


// =========================================================
// ZODIAC
// =========================================================

// Starts immediately when participant 5 enters.
function startZodiacSequence() {
  if (State.mode !== "preset") return;
  if (State.participants !== 5) return;
  if (zodiacStarted) return;

  zodiacStarted = true;
  zodiacStartTime = millis();

  createZodiacParticles();
}

function createZodiacParticles() {
  zodiacParticleGroups = [];

  for (let i = 0; i < zodiacSigns.length; i++) {
    const geometry = createSymbolGeometry(i);
    const particlesForSign = [];

    for (let j = 0; j < geometry.length; j++) {
      const point = geometry[j];

      particlesForSign.push({
        x: point.x,
        y: point.y,
        jitter: random(0.3, 2.0),
        size: random(1, 2.8),
        phase: random(TWO_PI),
        offset: random(10000)
      });
    }

    zodiacParticleGroups.push(particlesForSign);
  }
}

function createSymbolGeometry(index) {
  const points = [];
  const ops = zodiacShapes[index] || [];

  for (const op of ops) {
    const kind = op[0];

    if (kind === 'L') addLine(points, op[1], op[2], op[3], op[4]);
    else if (kind === 'C') addCurve(points, op[1], op[2], op[3], op[4], op[5], op[6], op[7], op[8]);
    else if (kind === 'O') addCircle(points, op[1], op[2], op[3]);
    else if (kind === 'W') addWave(points, op[1], op[2], op[3], op[4]);
  }

  return points;
}

function addLine(array, x1, y1, x2, y2) {
  const distance = dist(x1, y1, x2, y2);
  const steps = Math.max(2, Math.floor(distance / 2));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    array.push({
      x: lerp(x1, x2, t),
      y: lerp(y1, y2, t)
    });
  }
}

function addCurve(array, x1, y1, x2, y2, x3, y3, x4, y4) {
  const steps = 35;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    array.push({
      x: bezierPoint(x1, x2, x3, x4, t),
      y: bezierPoint(y1, y2, y3, y4, t)
    });
  }
}

function addCircle(array, cx, cy, radius) {
  const steps = 45;

  for (let i = 0; i <= steps; i++) {
    const angle = map(i, 0, steps, 0, TWO_PI);

    array.push({
      x: cx + cos(angle) * radius,
      y: cy + sin(angle) * radius
    });
  }
}

function addWave(array, startX, startY, waveWidth, waveHeight) {
  const steps = 60;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    array.push({
      x: startX + t * waveWidth,
      y: startY + sin(t * TWO_PI * 1.5) * waveHeight
    });
  }
}

function organicEase(t) {
  t = constrain(t, 0, 1);
  return t * t * (3 - 2 * t);
}

function drawZodiacSequence() {
  if (State.mode !== "preset") return;
  if (State.participants !== 5) return;
  if (!zodiacStarted) return;

  const elapsed = millis() - zodiacStartTime;
  const progress = constrain(elapsed / ZODIAC_DURATION, 0, 1);
  const reveal = organicEase(progress);

  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const zodiacRadius = min(width, height) * 0.34;

  drawZodiacCore(centerX, centerY, reveal);

  for (let i = 0; i < zodiacSigns.length; i++) {
    const angle = -HALF_PI + i * TWO_PI / zodiacSigns.length;

    const signX = centerX + cos(angle) * zodiacRadius;
    const signY = centerY + sin(angle) * zodiacRadius * 0.72;

    const localProgress = constrain((progress - i * 0.035) / 0.65, 0, 1);
    const symbolReveal = organicEase(localProgress);

    drawZodiacSymbol(i, signX, signY, symbolReveal);
  }

  drawZodiacOrbit(centerX, centerY, zodiacRadius, reveal);
}

function drawZodiacCore(centerX, centerY, reveal) {
  if (reveal <= 0) return;

  const pulse = 1 + sin(millis() * 0.003) * 0.10;

  // soft concentric rings
  noFill();

  for (let i = 0; i < 4; i++) {
    stroke(180, 120, 255, 18 * reveal * (1 - i * 0.15));
    strokeWeight(1);
    circle(centerX, centerY, (40 + i * 25) * pulse);
  }

  // central elemental particles
  noStroke();

  for (let i = 0; i < 180; i++) {
    const angle = i * 0.37 + millis() * 0.00015;
    const radius = random(8, 45) * reveal;
    const c = getElementColor(i % 5);

    const x = centerX + cos(angle) * radius;
    const y = centerY + sin(angle) * radius * 0.72;

    fill(c[0], c[1], c[2], random(30, 120) * reveal);
    circle(x, y, random(1, 3));
  }

  // small central light
  fill(220, 185, 255, 210 * reveal);
  circle(centerX, centerY, 7 * pulse);
}

function drawZodiacSymbol(index, centerX, centerY, reveal) {
  if (reveal <= 0) return;

  const sign = zodiacSigns[index];
  const symbolParticles = zodiacParticleGroups[index];

  if (!symbolParticles) return;

  const scaleFactor = min(width, height) / 700;
  const c = sign.color;

  // glow field
  noFill();

  for (let r = 65; r > 10; r -= 10) {
    stroke(c[0], c[1], c[2], 4 * reveal);
    strokeWeight(1);
    circle(centerX, centerY, r * scaleFactor);
  }

  // symbol particles
  for (let i = 0; i < symbolParticles.length; i++) {
    const particle = symbolParticles[i];

    const targetX = centerX + particle.x * scaleFactor;
    const targetY = centerY + particle.y * scaleFactor;

    // spawn away from final location
    const particleAngle = atan2(particle.y, particle.x);
    const spawnRadius = 25 + 40 * (1 - reveal);

    const spawnX = centerX + cos(particleAngle) * spawnRadius * scaleFactor;
    const spawnY = centerY + sin(particleAngle) * spawnRadius * scaleFactor;

    const x = lerp(spawnX, targetX, reveal);
    const y = lerp(spawnY, targetY, reveal);

    // organic drift
    const drift = sin(millis() * 0.0015 + particle.phase) * particle.jitter;

    const finalX = x + cos(particle.phase) * drift;
    const finalY = y + sin(particle.phase) * drift;

    const alpha = 230 * reveal;

    // trail
    stroke(c[0], c[1], c[2], alpha * 0.35);
    strokeWeight(max(0.5, particle.size * 0.45));

    line(
      finalX - cos(particle.phase) * 5,
      finalY - sin(particle.phase) * 5,
      finalX,
      finalY
    );

    // glow
    noStroke();
    fill(c[0], c[1], c[2], alpha * 0.12);
    circle(finalX, finalY, particle.size * 5);

    // core
    fill(c[0], c[1], c[2], alpha);
    circle(finalX, finalY, particle.size);
  }

  // orbital particles around each symbol
  noStroke();

  for (let i = 0; i < 35; i++) {
    const orbitalAngle = millis() * 0.0003 + i * TWO_PI / 35;

    const orbitalRadius =
      (45 + sin(i * 1.7 + millis() * 0.0005) * 10) * scaleFactor;

    const orbitalX = centerX + cos(orbitalAngle) * orbitalRadius;
    const orbitalY = centerY + sin(orbitalAngle) * orbitalRadius * 0.72;

    fill(c[0], c[1], c[2], 70 * reveal);
    circle(orbitalX, orbitalY, random(1, 2.5));
  }
}

function drawZodiacOrbit(centerX, centerY, radius, reveal) {
  if (reveal <= 0) return;

  // main orbit
  noFill();
  stroke(170, 120, 255, 24 * reveal);
  strokeWeight(1);
  ellipse(centerX, centerY, radius * 2, radius * 1.44);

  // orbit particles
  noStroke();

  for (let i = 0; i < 240; i++) {
    const angle = millis() * 0.0003 + i * TWO_PI / 240;
    const orbitRadius = radius * (0.94 + sin(i * 0.7) * 0.035);

    const x = centerX + cos(angle) * orbitRadius;
    const y = centerY + sin(angle) * orbitRadius * 0.72;

    fill(170, 120, 255, 50 * reveal);
    circle(x, y, random(0.8, 2.0));
  }
}

function getElementColor(index) {
  return elementColors[elementNames[index]] || elementColors.aether;
}


// =========================================================
// ELEMENT SYSTEM
// =========================================================

class ElementSystem {

  constructor(type, count) {
    this.type = type;
    this.count = count;
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push(new ElementParticle(this));
    }
  }

  update(amount) {
    if (amount <= 0) return;

    for (const particle of this.particles) {
      particle.update(amount);
    }
  }

  render(amount) {
    if (amount <= 0) return;

    for (const particle of this.particles) {
      particle.render(amount);
    }
  }
}


// =========================================================
// ELEMENT PARTICLE
// =========================================================

class ElementParticle {

  constructor(system) {
    this.system = system;

    this.x = random(width);
    this.y = random(height);

    this.vx = 0;
    this.vy = 0;

    this.size = random(0.8, 2.8);
    this.depth = random(0.25, 1);
    this.seed = random(10000);
    this.branch = random(-1, 1);
    this.angle = random(TWO_PI);
    this.radius = random(100, min(width, height) * 0.60);

    this.resetPosition();
  }

  resetPosition() {
    const type = this.system.type;

    if (type === "fire") {
      this.x = width * 0.5 + randomGaussian() * width * 0.25;
      this.y = height * 0.88 + random(height * 0.12);
    }

    else if (type === "water") {
      this.x = random(-width * 0.2, width * 1.2);
      this.y = height * 0.5 + randomGaussian() * height * 0.32;
    }

    else if (type === "air") {
      this.x = random(-width * 0.15, width * 1.15);
      this.y = random(-height * 0.15, height * 1.15);
    }

    else if (type === "earth") {
      this.x = width * 0.5 + randomGaussian() * width * 0.25;
      this.y = height * 0.92 + random(height * 0.10);
    }

    else if (type === "aether") {
      const angle = random(TWO_PI);
      const radius = random(80, min(width, height) * 0.60);

      this.x = width * 0.5 + cos(angle) * radius;
      this.y = height * 0.5 + sin(angle) * radius * 0.72;

      this.angle = angle;
      this.radius = radius;
    }

    this.vx = 0;
    this.vy = 0;
  }

  update(amount) {
    const type = this.system.type;
    const time = millis() * 0.001;

    // ---------------- FIRE ----------------
    if (type === "fire") {
      const flameWidth = map(this.y, height * 0.90, height * 0.05, 1, 0.20);

      this.vy -= 0.070 * amount * (0.7 + this.depth);

      const wave = sin(this.y * 0.018 + time * 3.5 + this.seed);

      this.vx += wave * 0.090 * amount * flameWidth * this.depth;

      this.vx += map(noise(this.seed, this.y * 0.006, time * 0.7), 0, 1, -0.035, 0.035) * amount;
      this.vy += map(noise(this.seed + 500, this.x * 0.006, time * 0.8), 0, 1, -0.018, 0.018) * amount;

      this.vx += (width * 0.5 - this.x) * 0.00045 * amount;

      if (this.y < -30) {
        this.x = width * 0.5 + randomGaussian() * width * 0.25;
        this.y = height * 0.80 + random(height * 0.15);
        this.vx *= 0.3;
        this.vy *= 0.3;
      }
    }

    // ---------------- WATER ----------------
    else if (type === "water") {
      this.vx += 0.085 * amount * (0.5 + this.depth);

      const wave = sin(this.x * 0.012 + time * 2.8 + this.seed);
      this.vy += wave * 0.075 * amount;

      const wave2 = sin(this.x * 0.005 - time * 1.8 + this.seed * 0.4);
      this.vy += wave2 * 0.030 * amount;

      this.vy += map(noise(this.seed, this.x * 0.008, time * 0.6), 0, 1, -0.030, 0.030) * amount;

      const targetY = height * 0.5 + sin(this.x * 0.009 + time * 1.8) * height * 0.22;
      this.vy += (targetY - this.y) * 0.00055 * amount;

      this.vx += sin(this.y * 0.025 + time * 2) * 0.025 * amount;

      if (this.x > width + 60) {
        this.x = -60;
        this.y = height * 0.5 + randomGaussian() * height * 0.32;
        this.vx = 0;
      }
    }

    // ---------------- AIR ----------------
    else if (type === "air") {
      const noiseValue = noise(this.x * 0.0025, this.y * 0.0025, time * 0.45);
      const windAngle = noiseValue * TWO_PI * 2.5;

      this.vx += cos(windAngle) * 0.095 * amount;
      this.vy += sin(windAngle) * 0.095 * amount;

      const sweep = sin(this.y * 0.006 - time * 2.5 + this.seed);

      this.vx += (0.085 + sweep * 0.055) * amount;
      this.vy += cos(this.x * 0.008 + time * 2) * 0.045 * amount;
      this.vx += sin(this.y * 0.015 + time * 3) * 0.025 * amount;

      if (this.x > width + 60) this.x = -60;
      if (this.x < -60) this.x = width + 60;
      if (this.y > height + 60) this.y = -60;
      if (this.y < -60) this.y = height + 60;
    }

    // ---------------- EARTH ----------------
    else if (type === "earth") {
      this.vy -= 0.045 * amount * (0.5 + this.depth);

      const branchWave = sin(this.y * 0.012 + time * 1.5 + this.seed);

      this.vx += branchWave * 0.065 * this.branch * amount * 1.4;

      this.vx += map(noise(this.seed, this.y * 0.01, time * 0.5), 0, 1, -0.025, 0.025) * amount;
      this.vx += sin(this.y * 0.009 + this.seed * 2) * 0.025 * amount;

      this.vy += sin(this.x * 0.018 + time) * 0.020 * amount;

      this.vx += (width * 0.5 - this.x) * 0.00012 * amount;

      if (this.y < -30) {
        this.x = width * 0.5 + randomGaussian() * width * 0.25;
        this.y = height * 0.86 + random(height * 0.10);
        this.vx *= 0.2;
        this.vy *= 0.2;
      }
    }

    // ---------------- AETHER ----------------
    else if (type === "aether") {
      const centerX = width * 0.5;
      const centerY = height * 0.5;

      this.angle += 0.055 * amount * (0.4 + this.depth);

      const desiredX = centerX + cos(this.angle) * this.radius;
      const desiredY = centerY + sin(this.angle) * this.radius * 0.72;

      this.vx += (desiredX - this.x) * 0.0015;
      this.vy += (desiredY - this.y) * 0.0015;

      this.vx += (centerX - this.x) * 0.000006 * amount;
      this.vy += (centerY - this.y) * 0.000006 * amount;

      const breathe = sin(time + this.seed);

      this.vx += breathe * 0.005 * amount;
      this.vy += breathe * 0.005 * amount;
    }

    // damping
    this.vx *= 0.975;
    this.vy *= 0.975;

    // max speed
    let maxSpeed = 3.2;

    if (type === "water") maxSpeed = 3.0;
    if (type === "air") maxSpeed = 3.4;
    if (type === "earth") maxSpeed = 2.2;
    if (type === "aether") maxSpeed = 2.6;

    const velocity = sqrt(this.vx * this.vx + this.vy * this.vy);

    if (velocity > maxSpeed) {
      this.vx = (this.vx / velocity) * maxSpeed;
      this.vy = (this.vy / velocity) * maxSpeed;
    }

    this.x += this.vx * amount;
    this.y += this.vy * amount;
  }

  render(amount) {
    const c = elementColors[this.system.type] || [255, 255, 255];

    const particleAlpha = 165 * amount * (0.4 + this.depth * 0.6);

    // trail
    stroke(c[0], c[1], c[2], particleAlpha * 0.38);
    strokeWeight(this.size * 0.75);

    line(
      this.x - this.vx * 5,
      this.y - this.vy * 5,
      this.x,
      this.y
    );

    // glow
    noStroke();
    fill(c[0], c[1], c[2], particleAlpha * 0.10);
    circle(this.x, this.y, this.size * 8);

    // core
    fill(c[0], c[1], c[2], particleAlpha);
    circle(this.x, this.y, this.size);
  }
}


// =========================================================
// RFID SERIAL CONNECTION
// Reads the existing Arduino output:
//   TOTAL COUNT: 1
//   TOTAL COUNT: 2
// =========================================================

async function connectRFIDReader() {
  if (!('serial' in navigator)) {
    rfidStatusText.html('Web Serial is unavailable. Use Chrome or Edge.');
    return;
  }

  try {
    rfidPort = await navigator.serial.requestPort();

    await rfidPort.open({ baudRate: 9600 });

    lastArduinoTotal = 0;

    rfidStatusText.html('Reader connected. Tap your card.');
    rfidConnectButton.html('RFID Reader Connected');

    if (!rfidReadLoopActive) {
      readRFIDSerial();
    }

  } catch (error) {
    console.error('RFID connection error:', error);

    rfidStatusText.html(
      'Connection failed. Close Arduino Serial Monitor and try again.'
    );
  }
}

async function readRFIDSerial() {
  if (!rfidPort || !rfidPort.readable) return;

  rfidReadLoopActive = true;

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    rfidReader = rfidPort.readable.getReader();

    while (true) {
      const result = await rfidReader.read();

      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const match = line.match(/^\s*TOTAL\s+COUNT\s*:\s*(\d+)\s*$/i);

        if (match) {
          handleArduinoTotalCount(Number(match[1]));
        }
      }
    }

  } catch (error) {
    console.error('RFID serial reading error:', error);
    rfidStatusText.html('Reader disconnected. Reconnect to continue.');

  } finally {
    if (rfidReader) {
      try { rfidReader.releaseLock(); } catch (error) {}
    }

    rfidReader = null;
    rfidReadLoopActive = false;
  }
}

function toggleScanMode() {
  scanMode = (scanMode === 'in') ? 'out' : 'in';
  updateScanModeButton();
}

function updateScanModeButton() {
  if (!scanModeButton) return;
  if (scanMode === 'in') {
    scanModeButton.html('MODE: ENTRY  (next scans add a visitor)');
    scanModeButton.style('background', '#10b981');
  } else {
    scanModeButton.html('MODE: EXIT  (next scans remove a visitor)');
    scanModeButton.style('background', '#ef4444');
  }
}

// Keyboard shortcut: press E to flip between ENTRY and EXIT
function keyPressed() {
  const tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (key === 'e' || key === 'E') toggleScanMode();
}

function handleArduinoTotalCount(newTotal) {
  if (!Number.isFinite(newTotal) || newTotal < 0) return;

  // The Arduino sends a cumulative total.
  // Apply only the difference from the last reported total.
  const scansToApply = newTotal >= lastArduinoTotal
    ? newTotal - lastArduinoTotal
    : newTotal;

  lastArduinoTotal = newTotal;

  if (scansToApply === 0) return;

  if (!State.isPlaying) {
    rfidStatusText.html('Reader connected. Start the experience before scanning.');
    return;
  }

  const limit = State.mode === 'preset' ? 5 : State.threshold;
  const isEntry = (scanMode === 'in');

  for (let i = 0; i < scansToApply; i++) {
    if (isEntry && State.participants >= limit) break;
    if (!isEntry && State.participants <= 0) break;
    processScan(isEntry);
  }

  const label = isEntry ? 'Entry' : 'Exit';
  if (isEntry && State.participants >= limit) {
    rfidStatusText.html('Participant limit reached: ' + State.participants + ' / ' + limit);
  } else {
    rfidStatusText.html(
      label + ' scan. Participants: ' + State.participants + ' / ' + limit
    );
  }
}
