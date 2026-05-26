const displayPanel = document.getElementById('displayPanel');
const keypad = document.getElementById('keypad');
const menuBtn = document.getElementById('menuBtn');
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
const closeDrawer = document.getElementById('closeDrawer');
const secretInput = document.getElementById('secretInput');
const infoText = document.getElementById('infoText');
const searchBtn = document.getElementById('searchBtn');
const callBtn = document.getElementById('callBtn');

const STORAGE_KEY = 'force-number-secret';
const MAX_SECRET_LENGTH = 24;
const FACE_DOWN_Z = -6.5;
const FACE_DOWN_BETA = 140;

let secretNumber = '';
let secretDigits = [];
let secretIndex = 0;
let waitingForFlip = false;
let secretModeEnabled = false;
let outputValue = '';
let motionReady = false;

function cleanDigits(value) {
  return value.replace(/\D/g, '').slice(0, MAX_SECRET_LENGTH);
}

function saveSecretNumber(value) {
  secretNumber = cleanDigits(value);
  secretDigits = secretNumber.split('');
  secretIndex = 0;
  localStorage.setItem(STORAGE_KEY, secretNumber);
  secretInput.value = secretNumber;
  updateEditorStatus();
}

function loadSecretNumber() {
  saveSecretNumber(localStorage.getItem(STORAGE_KEY) || '');
}

function updateDisplay(value) {
  outputValue = value;
  displayPanel.textContent = value;
}

function appendDigit(value) {
  updateDisplay((outputValue + value).slice(0, 32));
}

function nextSecretDigit() {
  const digit = secretDigits[secretIndex];
  secretIndex = (secretIndex + 1) % secretDigits.length;
  return digit;
}

function handleKeyPress(value) {
  if (secretModeEnabled && secretDigits.length > 0) {
    appendDigit(nextSecretDigit());
    return;
  }

  appendDigit(value);
}

function openEditor(open) {
  drawer.classList.toggle('active', open);
  overlay.classList.toggle('active', open);
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true');

  if (open) {
    secretInput.focus({ preventScroll: true });
    secretInput.select();
  }
}

function updateEditorStatus(message) {
  if (message) {
    infoText.textContent = message;
    return;
  }

  if (!secretNumber) {
    infoText.textContent = 'Введите число. Оно сохранится и будет доступно без интернета.';
  } else if (secretModeEnabled) {
    infoText.textContent = 'Секретный режим активен. Любая клавиша вводит сохранённое число по цифрам.';
  } else if (waitingForFlip) {
    infoText.textContent = 'Теперь переверните телефон экраном вниз.';
  } else {
    infoText.textContent = 'Нажмите поиск, затем переверните телефон экраном вниз.';
  }
}

async function requestMotionAccess() {
  const Orientation = window.DeviceOrientationEvent;
  const Motion = window.DeviceMotionEvent;
  const orientationPermission = Orientation && typeof Orientation.requestPermission === 'function';
  const motionPermission = Motion && typeof Motion.requestPermission === 'function';

  try {
    if (orientationPermission) {
      const result = await Orientation.requestPermission();
      if (result !== 'granted') return false;
    }

    if (motionPermission) {
      const result = await Motion.requestPermission();
      if (result !== 'granted') return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function startSecretActivation() {
  if (!secretNumber) {
    openEditor(true);
    updateEditorStatus('Сначала введите секретное число.');
    return;
  }

  const allowed = await requestMotionAccess();
  if (!allowed && needsExplicitMotionPermission()) {
    updateEditorStatus('Браузер не дал доступ к датчику положения.');
    openEditor(true);
    return;
  }

  waitingForFlip = true;
  secretModeEnabled = false;
  secretIndex = 0;
  motionReady = false;
  searchBtn.classList.add('armed');
  updateEditorStatus('Ожидание: переверните телефон экраном вниз.');
}

function needsExplicitMotionPermission() {
  return (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') ||
    (window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission === 'function');
}

function activateSecretMode() {
  if (!waitingForFlip || !secretDigits.length) return;

  waitingForFlip = false;
  secretModeEnabled = true;
  secretIndex = 0;
  searchBtn.classList.remove('armed');
  updateEditorStatus('Секретный режим активен.');

  if (navigator.vibrate) {
    navigator.vibrate(45);
  }
}

function isFaceDownByMotion(event) {
  const z = event.accelerationIncludingGravity && event.accelerationIncludingGravity.z;
  return typeof z === 'number' && z < FACE_DOWN_Z;
}

function isFaceDownByOrientation(event) {
  return typeof event.beta === 'number' && Math.abs(event.beta) > FACE_DOWN_BETA;
}

function resetSecretMode() {
  waitingForFlip = false;
  secretModeEnabled = false;
  secretIndex = 0;
  searchBtn.classList.remove('armed');
  updateEditorStatus();
}

keypad.addEventListener('click', (event) => {
  const button = event.target.closest('.key');
  if (!button) return;
  handleKeyPress(button.dataset.value);
});

menuBtn.addEventListener('click', () => openEditor(true));
closeDrawer.addEventListener('click', () => openEditor(false));
overlay.addEventListener('click', () => openEditor(false));

secretInput.addEventListener('input', (event) => {
  saveSecretNumber(event.target.value);
});

searchBtn.addEventListener('click', startSecretActivation);

callBtn.addEventListener('click', () => {
  if (outputValue) updateDisplay('');
  resetSecretMode();
});

window.addEventListener('devicemotion', (event) => {
  motionReady = true;
  if (waitingForFlip && isFaceDownByMotion(event)) {
    activateSecretMode();
  }
});

window.addEventListener('deviceorientation', (event) => {
  if (waitingForFlip && !motionReady && isFaceDownByOrientation(event)) {
    activateSecretMode();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && drawer.classList.contains('active')) {
    openEditor(false);
    return;
  }

  if (/^[0-9*#]$/.test(event.key)) {
    handleKeyPress(event.key);
  }

  if (event.key === 'Backspace') {
    updateDisplay(outputValue.slice(0, -1));
  }
});

window.addEventListener('load', () => {
  loadSecretNumber();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

window.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resetSecretMode();
  }
});
