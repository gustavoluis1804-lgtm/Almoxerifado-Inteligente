let modo = new URLSearchParams(location.search).get('modo') === 'saida' ? 'saida' : 'entrada';
let currentItem = null;
let qrScanner = null;
let cameraRunning = false;
let availableCameras = [];
let currentCameraIndex = 0;
let torchEnabled = false;
let scanLocked = false;
let scannerLibraryPromise = null;

const entradaBtn = document.getElementById('entradaBtn');
const saidaBtn = document.getElementById('saidaBtn');
const startCameraBtn = document.getElementById('startCameraBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const torchBtn = document.getElementById('torchBtn');
const cameraStatus = document.getElementById('cameraStatus');
const scannerStage = document.getElementById('scannerStage');
const qrImageInput = document.getElementById('qrImageInput');
const manualSku = document.getElementById('manualSku');
const manualBtn = document.getElementById('manualBtn');
const scanResult = document.getElementById('scanResult');

function loadScannerLibrary() {
  if (window.Html5Qrcode && window.Html5QrcodeSupportedFormats) return Promise.resolve();
  if (scannerLibraryPromise) return scannerLibraryPromise;
  scannerLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('N\u00e3o foi poss\u00edvel carregar o leitor de QR Code. Confira a conex\u00e3o e tente novamente.'));
    document.head.appendChild(script);
  });
  return scannerLibraryPromise;
}

function updateMode() {
  entradaBtn.classList.toggle('active', modo === 'entrada');
  saidaBtn.classList.toggle('active', modo === 'saida');
  document.body.dataset.page = modo;
  document.querySelectorAll('.nav-list a').forEach((link) => link.classList.remove('active'));
  document.querySelector(`[data-nav="${modo}"]`)?.classList.add('active');
}

function setMode(nextMode) {
  modo = nextMode;
  const params = new URLSearchParams(location.search);
  params.set('modo', modo);
  history.replaceState(null, '', `?${params.toString()}`);
  updateMode();
  renderItem();
}

function setCameraStatus(message, type = 'idle') {
  cameraStatus.className = `camera-status ${type}`;
  cameraStatus.innerHTML = `<i data-lucide="${type === 'error' ? 'triangle-alert' : type === 'success' ? 'circle-check' : cameraRunning ? 'scan-line' : 'camera'}"></i><span>${message}</span>`;
  window.lucide?.createIcons();
}

function normalizeSku(value) {
  const raw = String(value || '').trim();
  try {
    const url = new URL(raw);
    const fromQuery = url.searchParams.get('sku');
    if (fromQuery) return normalizeSku(fromQuery);
  } catch (_) {}
  const match = raw.match(/(?:^|\D)(\d{3}\.\d{3}\.\d{4})(?:\D|$)/);
  return match ? match[1] : raw;
}

function cameraErrorMessage(error) {
  const name = error?.name || '';
  const message = String(error?.message || error || '').toLowerCase();
  if (name === 'NotAllowedError' || message.includes('permission') || message.includes('denied')) {
    return 'A c\u00e2mera foi bloqueada. Permita a c\u00e2mera no navegador e tente novamente.';
  }
  if (name === 'NotFoundError' || message.includes('not found') || message.includes('no camera')) {
    return 'Nenhuma c\u00e2mera foi encontrada neste aparelho.';
  }
  if (name === 'NotReadableError' || message.includes('could not start') || message.includes('notreadable')) {
    return 'A c\u00e2mera est\u00e1 sendo usada por outro aplicativo. Feche outros apps e tente novamente.';
  }
  if (name === 'OverconstrainedError') return 'A c\u00e2mera traseira n\u00e3o est\u00e1 dispon\u00edvel. Use o bot\u00e3o Trocar c\u00e2mera.';
  if (name === 'SecurityError' || !window.isSecureContext) return 'A c\u00e2mera exige HTTPS ou localhost.';
  return 'N\u00e3o foi poss\u00edvel iniciar a c\u00e2mera. Confira a permiss\u00e3o e tente novamente.';
}

function scannerConfig() {
  return {
    fps: 10,
    qrbox(viewWidth, viewHeight) {
      const minEdge = Math.min(viewWidth, viewHeight);
      const size = Math.max(170, Math.min(Math.floor(minEdge * 0.78), minEdge - 20));
      return { width: size, height: size };
    },
    disableFlip: false,
  };
}

function createScanner() {
  return new Html5Qrcode('reader', {
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    verbose: false,
  });
}

async function loadCameras() {
  try {
    await loadScannerLibrary();
    availableCameras = await Html5Qrcode.getCameras();
  } catch (_) {
    availableCameras = [];
  }
  switchCameraBtn.hidden = availableCameras.length < 2;
  if (availableCameras.length > 1) {
    const rearIndex = availableCameras.findIndex((camera) => /back|rear|environment|traseira/i.test(camera.label));
    if (rearIndex >= 0) currentCameraIndex = rearIndex;
  }
}

async function refreshTorchSupport() {
  torchBtn.hidden = true;
  torchEnabled = false;
  const video = document.querySelector('#reader video');
  const track = video?.srcObject?.getVideoTracks?.()[0];
  const capabilities = track?.getCapabilities?.();
  if (capabilities?.torch) torchBtn.hidden = false;

  const advanced = [];
  if (capabilities?.focusMode?.includes?.('continuous')) advanced.push({ focusMode: 'continuous' });
  if (capabilities?.exposureMode?.includes?.('continuous')) advanced.push({ exposureMode: 'continuous' });
  if (capabilities?.whiteBalanceMode?.includes?.('continuous')) advanced.push({ whiteBalanceMode: 'continuous' });
  if (advanced.length) {
    try { await track.applyConstraints({ advanced }); } catch (_) {}
  }
  if (video) {
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.muted = true;
  }
}

async function stopCamera({ silent = false } = {}) {
  if (!qrScanner || !cameraRunning) return;
  try {
    await qrScanner.stop();
  } catch (_) {}
  cameraRunning = false;
  scannerStage.classList.remove('active');
  startCameraBtn.hidden = false;
  stopCameraBtn.hidden = true;
  switchCameraBtn.hidden = true;
  torchBtn.hidden = true;
  torchEnabled = false;
  if (!silent) setCameraStatus('C\u00e2mera pausada. Toque em Abrir c\u00e2mera para continuar.');
}

async function startCamera(cameraOverride = null) {
  if (cameraRunning) return;
  if (!window.isSecureContext) {
    setCameraStatus('A c\u00e2mera s\u00f3 funciona em HTTPS ou localhost.', 'error');
    return;
  }

  try {
    await loadScannerLibrary();
  } catch (error) {
    setCameraStatus(error.message, 'error');
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.Html5Qrcode) {
    setCameraStatus('Este navegador n\u00e3o oferece suporte \u00e0 leitura pela c\u00e2mera. Use Chrome, Edge, Safari ou Firefox atualizado.', 'error');
    return;
  }

  startCameraBtn.disabled = true;
  setCameraStatus('Solicitando acesso \u00e0 c\u00e2mera...');
  try {
    if (!qrScanner) qrScanner = createScanner();
    let cameraConfig = cameraOverride || { facingMode: { ideal: 'environment' } };

    try {
      await qrScanner.start(cameraConfig, scannerConfig(), onScanSuccess, () => {});
    } catch (firstError) {
      const denied = firstError?.name === 'NotAllowedError'
        || /permission|denied/i.test(String(firstError?.message || firstError));
      if (cameraOverride || denied) throw firstError;
      await loadCameras();
      if (!availableCameras.length) throw firstError;
      cameraConfig = availableCameras[currentCameraIndex].id;
      await qrScanner.start(cameraConfig, scannerConfig(), onScanSuccess, () => {});
    }

    cameraRunning = true;
    scannerStage.classList.add('active');
    startCameraBtn.hidden = true;
    stopCameraBtn.hidden = false;
    setCameraStatus('C\u00e2mera ativa. Centralize o QR Code dentro do quadro.');
    await loadCameras();
    await refreshTorchSupport();
  } catch (error) {
    cameraRunning = false;
    scannerStage.classList.remove('active');
    setCameraStatus(cameraErrorMessage(error), 'error');
  } finally {
    startCameraBtn.disabled = false;
  }
}

async function switchCamera() {
  if (availableCameras.length < 2) return;
  switchCameraBtn.disabled = true;
  await stopCamera({ silent: true });
  currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
  await startCamera(availableCameras[currentCameraIndex].id);
  switchCameraBtn.disabled = false;
}

async function toggleTorch() {
  const video = document.querySelector('#reader video');
  const track = video?.srcObject?.getVideoTracks?.()[0];
  if (!track) return;
  try {
    torchEnabled = !torchEnabled;
    await track.applyConstraints({ advanced: [{ torch: torchEnabled }] });
    torchBtn.classList.toggle('active', torchEnabled);
    torchBtn.innerHTML = `<i data-lucide="flashlight"></i>${torchEnabled ? 'Desligar luz' : 'Lanterna'}`;
    window.lucide?.createIcons();
  } catch (_) {
    torchBtn.hidden = true;
    toast('A lanterna n\u00e3o \u00e9 compat\u00edvel com esta c\u00e2mera.', 'error');
  }
}

async function signalSuccessfulScan() {
  if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.04;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.09);
  } catch (_) {}
}

async function onScanSuccess(decodedText) {
  if (scanLocked) return;
  scanLocked = true;
  const sku = normalizeSku(decodedText);
  manualSku.value = sku;
  await signalSuccessfulScan();
  await stopCamera({ silent: true });
  setCameraStatus(`QR Code lido: <strong>${esc(sku)}</strong>`, 'success');
  await findSku(sku);
  setTimeout(() => { scanLocked = false; }, 1200);
}

async function scanImage(file) {
  if (!file) return;
  try {
    await loadScannerLibrary();
    await stopCamera({ silent: true });
    if (!qrScanner) qrScanner = createScanner();
    setCameraStatus('Lendo o QR Code da imagem...');
    const decoded = await qrScanner.scanFile(file, true);
    await onScanSuccess(decoded);
  } catch (_) {
    setCameraStatus('N\u00e3o foi poss\u00edvel encontrar um QR Code nessa imagem.', 'error');
  } finally {
    qrImageInput.value = '';
  }
}

async function findSku(value) {
  const sku = normalizeSku(value);
  if (!/^\d{3}\.\d{3}\.\d{4}$/.test(sku)) {
    toast('QR Code/SKU fora do padr\u00e3o FFF.TTT.PPPP.', 'error');
    return;
  }
  manualSku.value = sku;
  try {
    currentItem = await API.get(`/itens/sku/${encodeURIComponent(sku)}`);
    renderItem();
    scanResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    currentItem = null;
    scanResult.innerHTML = '';
    toast(error.message, 'error');
  }
}

function renderItem() {
  if (!currentItem) return;
  scanResult.innerHTML = `<section class="panel scan-item-result">${itemThumb(currentItem.imagem_url, currentItem.nome, 'scanner-item-photo')}<span class="eyebrow">${modo === 'entrada' ? 'Registrar entrada' : 'Registrar sa\u00edda'}</span><h2>${esc(currentItem.nome)}</h2><p class="muted">${esc(currentItem.sku)} - ${esc(currentItem.localizacao)}</p><div class="cards-4 scan-stock-cards"><div class="stat-card"><div class="label">Saldo atual</div><div class="value">${currentItem.quantidade}</div></div><div class="stat-card"><div class="label">Estoque m\u00ednimo</div><div class="value">${currentItem.estoque_minimo}</div></div></div><form id="moveForm" class="form-grid"><div class="field"><label>Quantidade ${modo === 'entrada' ? 'adicionada' : 'retirada'} *</label><input class="input" id="moveQtd" type="number" inputmode="numeric" min="1" value="1" required></div><div class="field"><label>Respons\u00e1vel *</label><input class="input" id="moveResp" required autocomplete="name" placeholder="Nome do respons\u00e1vel"></div><div class="field full"><label>${modo === 'entrada' ? 'Observa\u00e7\u00e3o' : 'Motivo da retirada'} ${modo === 'saida' ? '*' : ''}</label><textarea class="textarea" id="moveMotivo" ${modo === 'saida' ? 'required' : ''}></textarea></div><div class="field full scan-form-actions"><button class="btn btn-primary" type="submit">Confirmar ${modo === 'entrada' ? 'Entrada' : 'Retirada'}</button><button class="btn btn-secondary" id="scanAnotherBtn" type="button"><i data-lucide="scan-line"></i>Escanear outro</button></div></form></section>`;
  document.getElementById('moveForm').addEventListener('submit', submitMove);
  document.getElementById('scanAnotherBtn').addEventListener('click', () => {
    currentItem = null;
    scanResult.innerHTML = '';
    startCamera();
  });
  window.lucide?.createIcons();
}

async function submitMove(event) {
  event.preventDefault();
  const submitButton = event.submitter;
  if (submitButton) submitButton.disabled = true;
  try {
    await API.post(`/movimentacoes/${modo}`, {
      item_id: currentItem.id,
      quantidade: Number(document.getElementById('moveQtd').value),
      responsavel: document.getElementById('moveResp').value,
      motivo: document.getElementById('moveMotivo').value,
    });
    toast(`${modo === 'entrada' ? 'Entrada' : 'Sa\u00edda'} registrada com sucesso!`);
    currentItem = await API.get(`/itens/sku/${encodeURIComponent(currentItem.sku)}`, { cache: false });
    renderItem();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

entradaBtn.addEventListener('click', () => setMode('entrada'));
saidaBtn.addEventListener('click', () => setMode('saida'));
startCameraBtn.addEventListener('click', () => startCamera());
stopCameraBtn.addEventListener('click', () => stopCamera());
switchCameraBtn.addEventListener('click', switchCamera);
torchBtn.addEventListener('click', toggleTorch);
qrImageInput.addEventListener('change', () => scanImage(qrImageInput.files?.[0]));
manualBtn.addEventListener('click', () => findSku(manualSku.value));
manualSku.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    findSku(manualSku.value);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCamera({ silent: true });
});
window.addEventListener('pagehide', () => stopCamera({ silent: true }));

document.addEventListener('DOMContentLoaded', () => {
  updateMode();
  const preset = new URLSearchParams(location.search).get('sku');
  if (preset) {
    manualSku.value = preset;
    findSku(preset);
  }
});
