const displayPanel = document.getElementById('displayPanel');
const keypad = document.getElementById('keypad');
const menuBtn = document.getElementById('menuBtn');
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
const closeDrawer = document.getElementById('closeDrawer');
const secretInput = document.getElementById('secretInput');
const secretStatus = document.getElementById('secretStatus');
const infoText = document.getElementById('infoText');
const searchBtn = document.getElementById('searchBtn');

const STORAGE_KEY = 'force-number-secret';
const SECRET_ACTIVE_CLASS = 'active';

let secretNumber = '';
let secretDigits = [];
let secretIndex = 0;
let secretModeWaiting = false;
let secretModeEnabled = false;
let secretModeReady = false;
let outputValue = '0';
let orientationSupported = false;
let currentFaceDown = false;

function saveSecretNumber(value) {
  secretNumber = value.replace(/[^0-9]/g, '').slice(0, 10);
  localStorage.setItem(STORAGE_KEY, secretNumber);
  secretDigits = secretNumber.split('');
  secretIndex = 0;
  updateStatus();
}

function loadSecretNumber() {
  const stored = localStorage.getItem(STORAGE_KEY) || '';
  secretNumber = stored.replace(/[^0-9]/g, '');
  secretDigits = secretNumber.split('');
  secretIndex = 0;
  secretInput.value = secretNumber;
  updateStatus();
}

function updateDisplay(value) {
  outputValue = value === '' ? '0' : value;
  displayPanel.textContent = outputValue;
}

function updateStatus() {
  if (secretModeReady) {
    secretStatus.textContent = 'Секретный режим готов';
    infoText.textContent = secretNumber ? `Секрет: ${secretNumber}` : 'Введите секретное число.';
  } else {
    secretStatus.textContent = 'Обычный ввод';
    infoText.textContent = secretNumber ? 'Нажмите поиск и переверните телефон вниз.' : 'Нажмите ⋮, чтобы задать число.';
  }
}

function handleKeyPress(value) {
  if (secretModeEnabled && secretDigits.length > 0) {
    const digit = secretDigits[secretIndex];
    secretIndex = (secretIndex + 1) % secretDigits.length;
    appendDigit(digit);
    return;
  }
  appendDigit(value);
}

function appendDigit(value) {
  if (outputValue === '0') {
    updateDisplay(value);
  } else {
    updateDisplay(outputValue + value);
  }
}

function toggleDrawer(open) {
  const active = open ? 'active' : '';
  drawer.classList.toggle('active', open);
  overlay.classList.toggle('active', open);
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function startSecretActivation() {
  secretModeWaiting = true;
  secretModeEnabled = false;
  secretModeReady = false;
  updateStatus();
  infoText.textContent = secretNumber ? 'Переверните экраном вниз для входа в секретный режим.' : 'Сначала задайте число.';
}

function resetSecretMode() {
  secretModeEnabled = false;
  secretModeWaiting = false;
  secretModeReady = false;
  updateStatus();
}

function checkFaceDown(beta) {
  // beta near 180 or -180 means phone screen downwards
  return Math.abs(beta) > 140;
}

function setupOrientationListener() {
  if (!('DeviceOrientationEvent' in window)) {
    infoText.textContent += ' Датчик ориентации не поддерживается.';
    return;
  }

  orientationSupported = true;
  window.addEventListener('deviceorientation', (event) => {
    if (event.beta === null) return;
    currentFaceDown = checkFaceDown(event.beta);
    if (secretModeWaiting && currentFaceDown && secretDigits.length > 0) {
      secretModeEnabled = true;
      secretModeWaiting = false;
      secretModeReady = true;
      updateStatus();
      infoText.textContent = 'Секретный режим активен. Нажимайте любую клавишу.';
    }
  });
}

keypad.addEventListener('click', (event) => {
  const button = event.target.closest('button.key');
  if (!button) return;
  const value = button.dataset.value;
  handleKeyPress(value);
});

menuBtn.addEventListener('click', () => {
  toggleDrawer(true);
});

closeDrawer.addEventListener('click', () => {
  toggleDrawer(false);
});

overlay.addEventListener('click', () => {
  toggleDrawer(false);
});

secretInput.addEventListener('input', (event) => {
  saveSecretNumber(event.target.value);
});

searchBtn.addEventListener('click', () => {
  if (!secretNumber) {
    infoText.textContent = 'Введите секретное число в меню сначала.';
    return;
  }
  startSecretActivation();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && drawer.classList.contains('active')) {
    toggleDrawer(false);
  }
});

window.addEventListener('load', () => {
  loadSecretNumber();
  updateDisplay('0');
  setupOrientationListener();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      console.warn('Service worker registration failed.');
    });
  }
});

window.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resetSecretMode();
  }
});
