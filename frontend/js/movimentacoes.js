async function load() {
  try {
    const params = tipoFiltro.value ? `?tipo=${tipoFiltro.value}` : '';
    const data = await API.get(`/movimentacoes${params}`);
    movBody.innerHTML = data.map(move => `<tr><td>${formatDate(move.created_at)}</td><td><span class="badge ${move.tipo === 'ENTRADA' ? 'badge-success' : 'badge-danger'}">${move.tipo}</span></td><td>${esc(move.itens?.sku || '')}</td><td><div class="movement-item">${itemThumb(move.itens?.imagem_url,move.itens?.nome)}<span>${esc(move.itens?.nome || '')}</span></div></td><td>${move.tipo === 'ENTRADA' ? '+' : '-'}${move.quantidade}</td><td>${move.saldo_anterior} → ${move.saldo_posterior}</td><td>${esc(move.responsavel)}</td><td>${esc(move.motivo || '—')}</td></tr>`).join('') || '<tr><td colspan="8" class="empty-state">Nenhuma movimentação.</td></tr>';
  } catch (error) { toast(error.message, 'error'); }
}
tipoFiltro.addEventListener('change', load);
document.addEventListener('DOMContentLoaded', load);
