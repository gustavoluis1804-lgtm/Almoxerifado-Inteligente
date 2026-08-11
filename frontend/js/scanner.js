let modo = new URLSearchParams(location.search).get('modo') === 'saida' ? 'saida' : 'entrada';
let currentItem = null;
function updateMode() {
  entradaBtn.classList.toggle('active', modo === 'entrada'); saidaBtn.classList.toggle('active', modo === 'saida'); document.body.dataset.page = modo;
  document.querySelectorAll('.nav-list a').forEach(a => a.classList.remove('active')); document.querySelector(`[data-nav="${modo}"]`)?.classList.add('active');
}
entradaBtn.onclick = () => { modo = 'entrada'; updateMode(); renderItem(); };
saidaBtn.onclick = () => { modo = 'saida'; updateMode(); renderItem(); };
async function findSku(value) {
  const sku = value.trim();
  if (!/^\d{3}\.\d{3}\.\d{4}$/.test(sku)) { toast('QR Code/SKU fora do padrão FFF.TTT.PPPP.', 'error'); return; }
  try { currentItem = await API.get(`/itens/sku/${encodeURIComponent(sku)}`); renderItem(); } catch (error) { toast(error.message, 'error'); }
}
function renderItem() {
  if (!currentItem) return;
  scanResult.innerHTML = `<section class="panel">${itemThumb(currentItem.imagem_url,currentItem.nome,'scanner-item-photo')}<span class="eyebrow">${modo === 'entrada' ? 'Registrar entrada' : 'Registrar saída'}</span><h2 style="font-size:22px;margin:7px 0">${esc(currentItem.nome)}</h2><p class="muted">${esc(currentItem.sku)} · ${esc(currentItem.localizacao)}</p><div class="cards-4" style="grid-template-columns:1fr 1fr;margin:14px 0;clear:both"><div class="stat-card" style="min-height:auto"><div class="label">Saldo atual</div><div class="value">${currentItem.quantidade}</div></div><div class="stat-card" style="min-height:auto"><div class="label">Estoque mínimo</div><div class="value">${currentItem.estoque_minimo}</div></div></div><form id="moveForm" class="form-grid"><div class="field"><label>Quantidade ${modo === 'entrada' ? 'adicionada' : 'retirada'} *</label><input class="input" id="moveQtd" type="number" min="1" value="1" required></div><div class="field"><label>Responsável *</label><input class="input" id="moveResp" required placeholder="Nome do responsável"></div><div class="field full"><label>${modo === 'entrada' ? 'Observação' : 'Motivo da retirada'} ${modo === 'saida' ? '*' : ''}</label><textarea class="textarea" id="moveMotivo" ${modo === 'saida' ? 'required' : ''}></textarea></div><div class="field full"><button class="btn btn-primary" type="submit">Confirmar ${modo === 'entrada' ? 'Entrada' : 'Retirada'}</button></div></form></section>`;
  moveForm.onsubmit = submitMove;
}
async function submitMove(event) {
  event.preventDefault();
  try { await API.post(`/movimentacoes/${modo}`, { item_id: currentItem.id, quantidade: Number(moveQtd.value), responsavel: moveResp.value, motivo: moveMotivo.value }); toast(`${modo === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!`); currentItem = await API.get(`/itens/sku/${encodeURIComponent(currentItem.sku)}`); renderItem(); }
  catch (error) { toast(error.message, 'error'); }
}
manualBtn.onclick = () => findSku(manualSku.value);
manualSku.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); findSku(manualSku.value); } };
document.addEventListener('DOMContentLoaded', () => {
  updateMode(); const preset = new URLSearchParams(location.search).get('sku'); if (preset) { manualSku.value = preset; findSku(preset); }
  if (window.Html5QrcodeScanner) { const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 240, height: 240 } }, false); scanner.render(decoded => { manualSku.value = decoded; findSku(decoded); scanner.clear().catch(() => {}); }, () => {}); }
});
