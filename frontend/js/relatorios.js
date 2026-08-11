async function load() {
  try {
    const [summary, moves] = await Promise.all([API.get('/dashboard/resumo'), API.get('/movimentacoes?limit=100')]);
    entradas.textContent = moves.filter(x => x.tipo === 'ENTRADA').length; saidas.textContent = moves.filter(x => x.tipo === 'SAIDA').length; alertas.textContent = summary.estoqueBaixo; unidades.textContent = summary.emEstoque.toLocaleString('pt-BR');
    const byDay = {}; const rank = {};
    moves.forEach(move => { const day = new Date(move.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); byDay[day] = (byDay[day] || 0) + 1; const key = move.itens?.sku || '—'; rank[key] ||= { nome: move.itens?.nome || 'Item', imagem_url: move.itens?.imagem_url, q: 0 }; rank[key].q += move.quantidade; });
    const days = Object.entries(byDay).slice(0, 14).reverse(); const max = Math.max(1, ...days.map(x => x[1]));
    bars.innerHTML = days.map(([day, value]) => `<div class="bar" data-value="${day}: ${value}" style="height:${Math.max(8, value / max * 100)}%"></div>`).join('') || '<div class="empty-state">Sem dados</div>';
    ranking.innerHTML = Object.values(rank).sort((a, b) => b.q - a.q).slice(0, 8).map((item, index) => `<div class="low-item stock-photo-row">${itemThumb(item.imagem_url,item.nome)}<div><strong>${index + 1}. ${esc(item.nome)}</strong></div><span>${item.q} un.</span></div>`).join('') || '<div class="empty-state">Sem movimentações</div>';
  } catch (error) { toast(error.message, 'error'); }
}
document.addEventListener('DOMContentLoaded', load);
