let timer;
async function loadFamilies() {
  try { const data = await API.get('/familias'); familiaFiltro.innerHTML = '<option value="">Todas</option>' + data.filter(x => x.ativo).map(f => `<option value="${f.id}">${esc(f.codigo)} — ${esc(f.nome)}</option>`).join(''); } catch (_) { /* exibido na busca */ }
}
async function loadItems() {
  try {
    const params = new URLSearchParams(); if (q.value.trim()) params.set('q', q.value.trim()); if (familiaFiltro.value) params.set('familia_id', familiaFiltro.value);
    const data = await API.get(`/itens?${params}`);
    itemsBody.innerHTML = data.map(item => {
      const low = Number(item.quantidade) <= Number(item.estoque_minimo);
      const photo = itemThumb(item.imagem_url, item.nome);
      return `<tr onclick="location.href='/pages/item.html?sku=${encodeURIComponent(item.sku)}'" style="cursor:pointer"><td><strong>${esc(item.sku)}</strong></td><td>${photo}${esc(item.nome)}</td><td>${esc(item.familias?.nome || '')} / ${esc(item.tipos?.nome || '')}</td><td>${esc(item.localizacao)}</td><td class="${low ? 'danger-text' : ''}">${item.quantidade}</td><td>${item.estoque_minimo}</td><td><span class="badge ${low ? 'badge-danger' : 'badge-success'}">${low ? 'Baixo' : 'Normal'}</span></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="empty-state">Nenhum item encontrado.</td></tr>';
  } catch (error) { itemsBody.innerHTML = `<tr><td colspan="7" class="empty-state">${esc(error.message)}</td></tr>`; toast(error.message, 'error'); }
}
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search); q.value = params.get('q') || ''; loadFamilies().then(loadItems);
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadItems, 300); }); familiaFiltro.addEventListener('change', loadItems);
});
