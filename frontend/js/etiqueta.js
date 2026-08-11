let currentItem;
document.body.dataset.theme = localStorage.getItem('almox_theme') || 'dark';

async function loadLabel() {
  const sku = new URLSearchParams(location.search).get('sku');
  if (!sku) { labelMessage.textContent = 'SKU não informado.'; return; }
  try {
    currentItem = await API.get(`/itens/sku/${encodeURIComponent(sku)}`);
    backToItem.href = `/pages/item.html?sku=${encodeURIComponent(currentItem.sku)}`;
    labelMessage.hidden = true;
    renderLabels();
  } catch (error) { labelMessage.textContent = error.message; }
}

function renderLabels() {
  if (!currentItem) return;
  const size = Math.max(40, Math.min(100, Number(labelSize.value)));
  const quantity = Math.max(1, Math.min(50, Number(labelQuantity.value) || 1));
  labelQuantity.value = quantity;
  labelsPreview.style.setProperty('--label-size', `${size}mm`);
  labelsPreview.dataset.size = String(size);
  labelsPreview.innerHTML = Array.from({ length: quantity }, () => `<article class="qr-label"><header><span class="label-brand">SENAI<em>SP</em></span><small>ALMOXARIFADO</small></header><div class="qr-frame"><img src="${currentItem.qr_code}" alt="QR Code ${currentItem.sku}"></div><footer><strong>${currentItem.sku}</strong><small>Escaneie para consultar</small></footer></article>`).join('');
}

labelSize.addEventListener('change', renderLabels);
labelQuantity.addEventListener('input', renderLabels);
printLabels.addEventListener('click', () => { renderLabels(); window.print(); });
document.addEventListener('DOMContentLoaded', loadLabel);
