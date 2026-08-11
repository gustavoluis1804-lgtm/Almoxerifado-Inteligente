let modo = new URLSearchParams(location.search).get('modo') === 'saida' ? 'saida' : 'entrada';
let currentItem = null;
let qrScanner = null;
let cameraRunning = false;
let availableCameras = [];
let currentCameraIndex = 0;
let torchEnabled = false;
let scanLocked = false;

const startCameraBtn = document.getElementById('startCameraBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const torchBtn = document.getElementById('torchBtn');
const cameraStatus = document.getElementById('cameraStatus');
const scannerStage = document.getElementById('scannerStage');
const qrImageInput = document.getElementById('qrImageInput');

function updateMode() {
  entradaBtn.classList.toggle('active', modo === 'entrada');
  saidaBtn.classList.toggle('active', modo === 'saida');
  document.body.dataset.page = modo;
  document.querySelectorAll('.nav-list a').forEach((link) => link.classList.remove('active'));
  document.querySelector(`[data-nav="${modo}"]`)?.classList.add('active');
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
    return 'A câmera foi bloqueada. Permita a câmera nas configurações do navegador e tente novamente.';
  }
  if (name === 'NotFoundError' || message.includes('not found') || message.includes('no camera')) {
    return 'Nenhuma câmera foi encontrada neste aparelho.';
  }
  if (name === 'NotReadableError' || message.includes('could not start') || message.includes('notreadable')) {
    return 'A câmera está sendo usada por outro aplicativo. Feche outros apps e tente novamente.';
  }
  if (name === 'OverconstrainedError') return 'A câmera traseira não está disponível. Tentando outra câmera pode resolver.';
  if (name === 'SecurityError' || !window.isSecureContext) return 'A câmera exige uma conexão segura HTTPS.';
  return 'Não foi possível iniciar a câmera. Confira a permissão e tente novamente.';
}

function scannerConfig() {
  return {
    fps: 15,
    qrbox(viewWidth, viewHeight) {
      const minEdge = Math.min(viewWidth, viewHeight);
      const size = Math.max(160, Math.min(Math.floor(minEdge * 0.82), minEdge - 16));
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
  if (!silent) setCameraStatus('Câmera pausada. Toque em Abrir câmera para continuar.');
}

async function startCamera(cameraOverride = null) {
  if (cameraRunning) return;
  if (!window.isSecureContext) {
    setCameraStatus('A câmera só funciona em conexão segura HTTPS.', 'error');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.Html5Qrcode) {
    setCameraStatus('Este navegador não oferece suporte à leitura pela câmera. Use Chrome ou Safari atualizado.', 'error');
    return;
  }

  startCameraBtn.disabled = true;
  setCameraStatus('Solicitando acesso à câmera...');
  try {
    if (!qrScanner) qrScanner = createScanner();
    let cameraConfig = cameraOverride;
    if (!cameraConfig) {
      cameraConfig = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 },
      };
    }

    try {
      await qrScanner.start(cameraConfig, scannerConfig(), onScanSuccess, () => {});
    } catch (firstError) {
      const denied = firstError?.name === 'NotAllowedError'
        || /permission|denied/i.test(String(firstError?.message || firstError));
      if (cameraOverride || denied) throw firstError;
      await loadCameras();
      if (!availableCameras.length) throw firstError;
      await qrScanner.start(availableCameras[currentCameraIndex].id, scannerConfig(), onScanSuccess, () => {});
    }
    cameraRunning = true;
    scannerStage.classList.add('active');
    startCameraBtn.hidden = true;
    stopCameraBtn.hidden = false;
    setCameraStatus('Câmera ativa. Centralize o QR Code e mantenha o celular firme.');
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
    toast('A lanterna não é compatível com esta câmera.', 'error');
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
    await stopCamera({ silent: true });
    if (!qrScanner) qrScanner = createScanner();
    setCameraStatus('Lendo o QR Code da imagem...');
    const decoded = await qrScanner.scanFile(file, true);
    await onScanSuccess(decoded);
  } catch (_) {
    setCameraStatus('Não foi possível encontrar um QR Code nessa imagem.', 'error');
  } finally {
    qrImageInput.value = '';
  }
}

entradaBtn.onclick = () => { modo = 'entrada'; updateMode(); renderItem(); };
saidaBtn.onclick = () => { modo = 'saida'; updateMode(); renderItem(); };

async function findSku(value) {
  const sku = normalizeSku(value);
  if (!/^\d{3}\.\d{3}\.\d{4}$/.test(sku)) {
    toast('QR Code/SKU fora do padrão FFF.TTT.PPPP.', 'error');
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
  scanResult.innerHTML = `<section class="panel scan-item-result">${itemThumb(currentItem.imagem_url,currentItem.nome,'scanner-item-photo')}<span class="eyebrow">${modo === 'entrada' ? 'Registrar entrada' : 'Registrar saída'}</span><h2>${esc(currentItem.nome)}</h2><p class="muted">${esc(currentItem.sku)} · ${esc(currentItem.localizacao)}</p><div class="cards-4 scan-stock-cards"><div class="stat-card"><div class="label">Saldo atual</div><div class="value">${currentItem.quantidade}</div></div><div class="stat-card"><div class="label">Estoque mínimo</div><div class="value">${currentItem.estoque_minimo}</div></div></div><form id="moveForm" class="form-grid"><div class="field"><label>Quantidade ${modo === 'entrada' ? 'adicionada' : 'retirada'} *</label><input class="input" id="moveQtd" type="number" inputmode="numeric" min="1" value="1" required></div><div class="field"><label>Responsável *</label><input class="input" id="moveResp" required autocomplete="name" placeholder="Nome do responsável"></div><div class="field full"><label>${modo === 'entrada' ? 'Observação' : 'Motivo da retirada'} ${modo === 'saida' ? '*' : ''}</label><textarea class="textarea" id="moveMotivo" ${modo === 'saida' ? 'required' : ''}></textarea></div><div class="field full scan-form-actions"><button class="btn btn-primary" type="submit">Confirmar ${modo === 'entrada' ? 'Entrada' : 'Retirada'}</button><button class="btn btn-secondary" id="scanAnotherBtn" type="button"><i data-lucide="scan-line"></i>Escanear outro</button></div></form></section>`;
  moveForm.onsubmit = submitMove;
  scanAnotherBtn.onclick = () => { currentItem = null; scanResult.innerHTML = ''; startCamera(); };
  window.lucide?.createIcons();
}

async function submitMove(event) {
  event.preventDefault();
  const submitButton = event.submitter;
  if (submitButton) submitButton.disabled = true;
  try {
    await API.post(`/movimentacoes/${modo}`, {
      item_id: currentItem.id,
      quantidade: Number(moveQtd.value),
      responsavel: moveResp.value,
      motivo: moveMotivo.value,
    });
    toast(`${modo === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!`);
    currentItem = await API.get(`/itens/sku/${encodeURIComponent(currentItem.sku)}`);
    renderItem();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

startCameraBtn.onclick = () => startCamera();
stopCameraBtn.onclick = () => stopCamera();
switchCameraBtn.onclick = switchCamera;
torchBtn.onclick = toggleTorch;
qrImageInput.onchange = () => scanImage(qrImageInput.files?.[0]);
manualBtn.onclick = () => findSku(manualSku.value);
manualSku.onkeydown = (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    findSku(manualSku.value);
  }
};

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
