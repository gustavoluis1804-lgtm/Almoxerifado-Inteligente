async function loadDashboard() {
  try {
    const [summary, low] = await Promise.all([API.get('/dashboard/resumo'), API.get('/dashboard/estoque-baixo')]);
    totalItens.textContent = summary.totalItens.toLocaleString('pt-BR'); emEstoque.textContent = summary.emEstoque.toLocaleString('pt-BR'); estoqueBaixo.textContent = summary.estoqueBaixo.toLocaleString('pt-BR'); movMes.textContent = summary.movimentacoesMes.toLocaleString('pt-BR'); donutTotal.textContent = summary.emEstoque.toLocaleString('pt-BR');
    const categories = Object.entries(summary.categorias || {}).sort((a, b) => b[1] - a[1]);
    categoryLegend.innerHTML = categories.slice(0, 5).map(([name, quantity]) => `<div class="low-item"><div><strong>${esc(name)}</strong></div><span class="muted">${quantity.toLocaleString('pt-BR')}</span></div>`).join('') || '<div class="empty-state">Sem dados.</div>';
    lowStockList.innerHTML = low.map(item => `<a class="low-item stock-photo-row" href="/pages/item.html?sku=${encodeURIComponent(item.sku)}">${itemThumb(item.imagem_url,item.nome)}<div><strong>${esc(item.nome)}</strong><small>${esc(item.sku)} · ${esc(item.localizacao)}</small></div><strong class="danger-text">${item.quantidade} un.</strong><span class="badge badge-danger">Mín. ${item.estoque_minimo}</span></a>`).join('') || '<div class="empty-state">Nenhum item em estoque baixo 🎉</div>';
  } catch (error) { document.querySelectorAll('.value').forEach(element => { element.textContent = '0'; }); lowStockList.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; toast(error.message, 'error'); }
}
document.addEventListener('DOMContentLoaded', loadDashboard);
