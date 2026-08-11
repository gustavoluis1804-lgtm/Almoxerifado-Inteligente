let familias = [];
let tipos = [];
let showInactiveFamilies = false;
let showInactiveTypes = false;

function setupInactiveButtons() {
  const familySubmit = familiaForm.querySelector('button[type="submit"]');
  const typeSubmit = tipoForm.querySelector('button[type="submit"]');
  familySubmit.insertAdjacentHTML('afterend', '<button class="btn btn-inactive-toggle" id="toggleInactiveFamilies" type="button"><i data-lucide="archive"></i><span>Inativos</span></button>');
  typeSubmit.insertAdjacentHTML('afterend', '<button class="btn btn-inactive-toggle" id="toggleInactiveTypes" type="button"><i data-lucide="archive"></i><span>Inativos</span></button>');
  toggleInactiveFamilies.addEventListener('click', () => { showInactiveFamilies = !showInactiveFamilies; renderLists(); });
  toggleInactiveTypes.addEventListener('click', () => { showInactiveTypes = !showInactiveTypes; renderLists(); });
}

function renderLists() {
  const inactiveFamilies = familias.filter(item => !item.ativo).length;
  const inactiveTypes = tipos.filter(item => !item.ativo).length;
  toggleInactiveFamilies.querySelector('span').textContent = `Inativos (${inactiveFamilies})`;
  toggleInactiveTypes.querySelector('span').textContent = `Inativos (${inactiveTypes})`;
  toggleInactiveFamilies.classList.toggle('active', showInactiveFamilies);
  toggleInactiveTypes.classList.toggle('active', showInactiveTypes);
  familiasList.innerHTML = familias.filter(family => family.ativo || showInactiveFamilies).map(family => `<div class="low-item"><div><strong>${esc(family.codigo)} — ${esc(family.nome)}</strong><small>${esc(family.descricao || 'Sem descrição')}</small></div><span class="badge ${family.ativo ? 'badge-success' : 'badge-neutral'}">${family.ativo ? 'Ativa' : 'Inativa'}</span>${family.ativo ? `<button class="btn-icon-danger" type="button" data-delete-family="${family.id}" aria-label="Excluir família ${esc(family.nome)}" title="Excluir família"><i data-lucide="trash-2"></i></button>` : `<button class="btn-icon-restore" type="button" data-restore-family="${family.id}" aria-label="Reativar família ${esc(family.nome)}" title="Reativar família"><i data-lucide="rotate-ccw"></i></button>`}</div>`).join('') || '<div class="empty-state compact-empty">Nenhuma família nesta lista.</div>';
  tiposList.innerHTML = tipos.filter(type => type.ativo || showInactiveTypes).map(type => `<div class="low-item"><div><strong>${esc(type.familias?.codigo)}.${esc(type.codigo)} — ${esc(type.nome)}</strong><small>${esc(type.familias?.nome || '')}</small></div><span class="badge ${type.ativo ? 'badge-success' : 'badge-neutral'}">${type.ativo ? 'Ativo' : 'Inativo'}</span>${type.ativo ? `<button class="btn-icon-danger" type="button" data-delete-type="${type.id}" aria-label="Excluir tipo ${esc(type.nome)}" title="Excluir tipo"><i data-lucide="trash-2"></i></button>` : `<button class="btn-icon-restore" type="button" data-restore-type="${type.id}" aria-label="Reativar tipo ${esc(type.nome)}" title="Reativar tipo"><i data-lucide="rotate-ccw"></i></button>`}</div>`).join('') || '<div class="empty-state compact-empty">Nenhum tipo nesta lista.</div>';
  lucide.createIcons();
}

async function load() {
  try {
    [familias, tipos] = await Promise.all([API.get('/familias'), API.get('/tipos')]);
    tipoFamilia.innerHTML = '<option value="">Selecione...</option>' + familias.filter(f => f.ativo).map(f => `<option value="${f.id}">${esc(f.codigo)} — ${esc(f.nome)}</option>`).join('');
    renderLists();
  } catch (error) { toast(error.message, 'error'); }
}

function openDeleteDialog(kind, record) {
  const isFamily = kind === 'family';
  const familyCode = isFamily ? record.codigo : record.familias?.codigo;
  const expected = isFamily ? record.codigo : `${familyCode}.${record.codigo}`;
  const label = isFamily ? 'família' : 'tipo';
  document.getElementById('classificationDeleteDialog')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<dialog class="delete-dialog" id="classificationDeleteDialog"><form id="classificationDeleteForm"><span class="eyebrow">Ação de segurança</span><h2>Excluir ${label}?</h2><p>${isFamily ? 'Os tipos desta família também serão desativados.' : 'O tipo não aparecerá em novos cadastros.'} Itens e históricos existentes serão preservados.</p><div class="delete-warning">Para confirmar, digite <strong>${esc(expected)}</strong></div><div class="field"><label for="classificationConfirmation">Confirmação</label><input class="input" id="classificationConfirmation" autocomplete="off" placeholder="${esc(expected)}" required></div><p class="login-error" id="classificationDeleteError"></p><div class="dialog-actions"><button class="btn btn-secondary" id="cancelClassificationDelete" type="button">Cancelar</button><button class="btn btn-danger" id="confirmClassificationDelete" type="submit" disabled>Excluir ${label}</button></div></form></dialog>`);
  const dialog = classificationDeleteDialog;
  classificationConfirmation.addEventListener('input', () => { confirmClassificationDelete.disabled = classificationConfirmation.value.trim() !== expected; });
  cancelClassificationDelete.addEventListener('click', () => dialog.close());
  classificationDeleteForm.addEventListener('submit', async (event) => {
    event.preventDefault(); confirmClassificationDelete.disabled = true; confirmClassificationDelete.textContent = 'Excluindo...'; classificationDeleteError.textContent = '';
    try { await API.delete(isFamily ? `/familias/${record.id}` : `/tipos/${record.id}`, { confirmacao: classificationConfirmation.value.trim() }); dialog.close(); toast(`${isFamily ? 'Família' : 'Tipo'} excluído com segurança.`); await load(); }
    catch (error) { classificationDeleteError.textContent = error.message; confirmClassificationDelete.textContent = `Excluir ${label}`; confirmClassificationDelete.disabled = classificationConfirmation.value.trim() !== expected; }
  });
  dialog.addEventListener('close', () => dialog.remove()); dialog.showModal(); classificationConfirmation.focus();
}

familiasList.addEventListener('click', event => { const button = event.target.closest('[data-delete-family]'); if (!button) return; const record = familias.find(f => f.id === button.dataset.deleteFamily); if (record) openDeleteDialog('family', record); });
tiposList.addEventListener('click', event => { const button = event.target.closest('[data-delete-type]'); if (!button) return; const record = tipos.find(t => t.id === button.dataset.deleteType); if (record) openDeleteDialog('type', record); });
familiasList.addEventListener('click', async event => { const button = event.target.closest('[data-restore-family]'); if (!button) return; button.disabled = true; try { await API.put(`/familias/${button.dataset.restoreFamily}`, { ativo: true }); toast('Família reativada!'); await load(); } catch (error) { button.disabled = false; toast(error.message, 'error'); } });
tiposList.addEventListener('click', async event => { const button = event.target.closest('[data-restore-type]'); if (!button) return; const record = tipos.find(t => t.id === button.dataset.restoreType); const parent = familias.find(f => f.id === record?.familia_id); if (parent && !parent.ativo) { toast('Reative primeiro a família deste tipo.', 'error'); return; } button.disabled = true; try { await API.put(`/tipos/${button.dataset.restoreType}`, { ativo: true }); toast('Tipo reativado!'); await load(); } catch (error) { button.disabled = false; toast(error.message, 'error'); } });

familiaForm.addEventListener('submit', async event => { event.preventDefault(); try { await API.post('/familias', { codigo: famCodigo.value, nome: famNome.value, descricao: famDescricao.value }); event.target.reset(); toast('Família cadastrada!'); load(); } catch (error) { toast(error.message, 'error'); } });
tipoForm.addEventListener('submit', async event => { event.preventDefault(); try { await API.post('/tipos', { familia_id: tipoFamilia.value, codigo: tipoCodigo.value, nome: tipoNome.value, descricao: tipoDescricao.value }); event.target.reset(); toast('Tipo cadastrado!'); load(); } catch (error) { toast(error.message, 'error'); } });
document.addEventListener('DOMContentLoaded', () => { setupInactiveButtons(); load(); });
