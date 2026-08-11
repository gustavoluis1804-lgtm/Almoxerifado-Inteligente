async function load() {
  const sku = new URLSearchParams(location.search).get('sku');
  if (!sku) { itemDetail.innerHTML = '<div class="empty-state">SKU não informado.</div>'; return; }
  try {
    const item = await API.get(`/itens/sku/${encodeURIComponent(sku)}`);
    const low = Number(item.quantidade) <= Number(item.estoque_minimo);
    const photo = item.imagem_url ? `<img class="item-photo" src="${esc(item.imagem_url)}" alt="Foto de ${esc(item.nome)}">` : '';
    itemDetail.innerHTML = `<div class="panel-head"><div><span class="eyebrow">Detalhes do item</span><h1 class="page-title">${esc(item.sku)}</h1><p class="page-subtitle">${esc(item.nome)}</p></div><span class="badge ${low ? 'badge-danger' : 'badge-success'}">${low ? 'Estoque baixo' : 'Estoque normal'}</span></div><div class="grid-2"><section class="panel">${photo}<h2>${esc(item.nome)}</h2><div class="low-list" style="margin-top:18px"><div class="low-item"><strong>Família / Tipo</strong><span>${esc(item.familias?.nome)} / ${esc(item.tipos?.nome)}</span></div><div class="low-item"><strong>Localização</strong><span>${esc(item.localizacao)}</span></div><div class="low-item"><strong>Estoque atual</strong><span class="${low ? 'danger-text' : ''}">${item.quantidade} un.</span></div><div class="low-item"><strong>Estoque mínimo</strong><span>${item.estoque_minimo} un.</span></div><div class="low-item"><strong>Descrição</strong><span>${esc(item.descricao || '—')}</span></div></div><div class="hero-actions"><a class="btn btn-primary" href="/pages/scanner.html?modo=entrada&sku=${encodeURIComponent(item.sku)}">Registrar entrada</a><a class="btn btn-secondary" href="/pages/scanner.html?modo=saida&sku=${encodeURIComponent(item.sku)}">Registrar saída</a><button class="btn btn-danger" id="deleteItemBtn" type="button">Excluir item</button></div></section><section class="panel qr-card"><img src="${item.qr_code || ''}" alt="QR Code"><div><span class="eyebrow">QR Code do item</span><h2>${esc(item.sku)}</h2><p class="muted">Use este código para localizar o item rapidamente no celular.</p><button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i>Imprimir etiqueta</button></div></section></div><dialog class="delete-dialog" id="deleteDialog"><form id="deleteForm"><span class="eyebrow">Ação de segurança</span><h2>Excluir este item?</h2><p>O item será removido das listagens, mas seu histórico será preservado.</p><div class="delete-warning">Para confirmar, digite o SKU <strong>${esc(item.sku)}</strong></div><div class="field"><label for="deleteConfirmation">Confirmação</label><input class="input" id="deleteConfirmation" autocomplete="off" placeholder="${esc(item.sku)}" required></div><p class="login-error" id="deleteError"></p><div class="dialog-actions"><button class="btn btn-secondary" id="cancelDelete" type="button">Cancelar</button><button class="btn btn-danger" id="confirmDelete" type="submit" disabled>Excluir definitivamente</button></div></form></dialog>`;
    setupEdit(item);
    setupDelete(item);
    const printQrButton = itemDetail.querySelector('.qr-card button');
    printQrButton.onclick = null;
    printQrButton.innerHTML = '<i data-lucide="printer"></i>Imprimir só o QR Code';
    printQrButton.addEventListener('click', () => location.href = `/pages/etiqueta.html?sku=${encodeURIComponent(item.sku)}`);
    lucide.createIcons();
  } catch (error) { itemDetail.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; }
}

function setupEdit(item) {
  const actions = itemDetail.querySelector('.hero-actions');
  const editButton = document.createElement('button');
  editButton.className = 'btn btn-secondary'; editButton.type = 'button'; editButton.innerHTML = '<i data-lucide="pencil"></i>Editar item';
  actions.insertBefore(editButton, deleteItemBtn);
  itemDetail.insertAdjacentHTML('beforeend', `<dialog class="delete-dialog edit-dialog" id="editDialog"><form id="editForm"><span class="eyebrow">Editar cadastro</span><h2>${esc(item.sku)}</h2><p>Família, tipo, SKU e saldo são protegidos para preservar o histórico.</p><div class="form-grid"><div class="field full"><label for="editName">Nome *</label><input class="input" id="editName" required maxlength="160" value="${esc(item.nome)}"></div><div class="field"><label for="editLocation">Localização *</label><input class="input" id="editLocation" required maxlength="180" value="${esc(item.localizacao)}"></div><div class="field"><label for="editMinimum">Estoque mínimo</label><input class="input" id="editMinimum" type="number" min="0" step="1" required value="${Number(item.estoque_minimo)}"></div><div class="field full"><label for="editDescription">Descrição</label><textarea class="textarea" id="editDescription">${esc(item.descricao || '')}</textarea></div><div class="field full"><label>Substituir foto</label><label class="image-picker compact" for="editImage"><input id="editImage" type="file" accept="image/jpeg,image/png,image/webp" hidden><span id="editImageText">Selecionar nova foto</span><small>Opcional · conversão automática para WebP</small><img id="editImagePreview" alt="Prévia" hidden></label></div></div><p class="login-error" id="editError"></p><div class="dialog-actions"><button class="btn btn-secondary" id="cancelEdit" type="button">Cancelar</button><button class="btn btn-primary" id="saveEdit" type="submit">Salvar alterações</button></div></form></dialog>`);
  let editedImage = null;
  editButton.addEventListener('click', () => { editError.textContent = ''; editDialog.showModal(); });
  cancelEdit.addEventListener('click', () => editDialog.close());
  editImage.addEventListener('change', async () => {
    if (!editImage.files[0]) return; editImageText.textContent = 'Convertendo...';
    try { if (!window.convertItemImage) await loadImageConverter(); editedImage = await convertItemImage(editImage.files[0]); editImagePreview.src = editedImage.preview; editImagePreview.hidden = false; editImageText.textContent = `${editedImage.width} × ${editedImage.height} · ${(editedImage.size / 1024).toFixed(0)} KB`; }
    catch (error) { editedImage = null; editImage.value = ''; editImageText.textContent = 'Selecionar nova foto'; editError.textContent = error.message; }
  });
  editForm.addEventListener('submit', async (event) => {
    event.preventDefault(); saveEdit.disabled = true; saveEdit.textContent = 'Salvando...'; editError.textContent = '';
    try { await API.put(`/itens/${item.id}`, { nome: editName.value, localizacao: editLocation.value, estoque_minimo: Number(editMinimum.value), descricao: editDescription.value }); if (editedImage) { saveEdit.textContent = 'Enviando foto...'; await API.post(`/itens/${item.id}/imagem`, { imagem: editedImage.dataUrl }); } editDialog.close(); toast('Item atualizado com sucesso!'); setTimeout(() => location.reload(), 500); }
    catch (error) { editError.textContent = error.message; saveEdit.disabled = false; saveEdit.textContent = 'Salvar alterações'; }
  });
}

function loadImageConverter() {
  return new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = '/js/image-utils.js'; script.onload = resolve; script.onerror = () => reject(new Error('Não foi possível carregar o conversor de imagem.')); document.head.appendChild(script); });
}

function setupDelete(item) {
  confirmDelete.textContent = 'Excluir item';
  deleteItemBtn.addEventListener('click', () => { deleteConfirmation.value = ''; confirmDelete.disabled = true; deleteError.textContent = ''; deleteDialog.showModal(); deleteConfirmation.focus(); });
  cancelDelete.addEventListener('click', () => deleteDialog.close());
  deleteConfirmation.addEventListener('input', () => { confirmDelete.disabled = deleteConfirmation.value.trim() !== item.sku; });
  deleteForm.addEventListener('submit', async (event) => {
    event.preventDefault(); confirmDelete.disabled = true; confirmDelete.textContent = 'Excluindo...'; deleteError.textContent = '';
    try { await API.delete(`/itens/${item.id}`, { confirmacao: deleteConfirmation.value.trim() }); deleteDialog.close(); toast('Item excluído. O histórico foi preservado.'); setTimeout(() => location.replace('/pages/itens.html'), 700); }
    catch (error) { deleteError.textContent = error.message; confirmDelete.textContent = 'Excluir definitivamente'; confirmDelete.disabled = deleteConfirmation.value.trim() !== item.sku; }
  });
}
document.addEventListener('DOMContentLoaded', load);
