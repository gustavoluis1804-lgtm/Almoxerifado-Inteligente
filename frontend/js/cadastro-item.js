let familias = [];
let convertedImage = null;

async function init() {
  const script = document.createElement('script'); script.src = '/js/image-utils.js'; document.head.appendChild(script);
  await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
  descricao.closest('.field').insertAdjacentHTML('afterend', `<div class="field full"><label>Foto do item</label><label class="image-picker" for="itemImage"><input id="itemImage" type="file" accept="image/jpeg,image/png,image/webp" hidden><span id="imagePickerText">Clique para selecionar uma imagem</span><small>Conversão automática para WebP, até 1200 × 1200.</small><img id="imagePreview" alt="Prévia da imagem" hidden></label></div>`);
  itemImage.addEventListener('change', prepareImage);
  try { familias = await API.get('/familias'); familia.innerHTML = '<option value="">Selecione...</option>' + familias.filter(x => x.ativo).map(f => `<option value="${f.id}">${esc(f.codigo)} — ${esc(f.nome)}</option>`).join(''); }
  catch (error) { toast(error.message, 'error'); }
}

async function prepareImage() {
  if (!itemImage.files[0]) return;
  imagePickerText.textContent = 'Convertendo imagem...';
  try {
    if (convertedImage?.preview) URL.revokeObjectURL(convertedImage.preview);
    convertedImage = await convertItemImage(itemImage.files[0]);
    imagePreview.src = convertedImage.preview; imagePreview.hidden = false;
    imagePickerText.textContent = `${convertedImage.width} × ${convertedImage.height} · ${(convertedImage.size / 1024).toFixed(0)} KB`;
  } catch (error) { convertedImage = null; itemImage.value = ''; imagePreview.hidden = true; imagePickerText.textContent = 'Clique para selecionar uma imagem'; toast(error.message, 'error'); }
}

familia.addEventListener('change', async () => {
  if (!familia.value) { tipo.innerHTML = '<option value="">Selecione a família primeiro</option>'; return; }
  try { const data = await API.get(`/tipos?familia_id=${familia.value}`); tipo.innerHTML = '<option value="">Selecione...</option>' + data.filter(x => x.ativo).map(t => `<option value="${t.id}">${esc(t.codigo)} — ${esc(t.nome)}</option>`).join(''); }
  catch (error) { toast(error.message, 'error'); }
});

itemForm.addEventListener('submit', async (event) => {
  event.preventDefault(); const button = event.submitter; button.classList.add('loading'); button.disabled = true;
  let createdItem = null;
  try {
    let item = await API.post('/itens', { familia_id: familia.value, tipo_id: tipo.value, nome: nome.value, localizacao: localizacao.value, quantidade_inicial: Number(quantidade.value), estoque_minimo: Number(minimo.value), descricao: descricao.value });
    createdItem = item;
    const qrCode = item.qr_code;
    if (convertedImage) { button.textContent = 'Enviando imagem...'; item = await API.post(`/itens/${item.id}/imagem`, { imagem: convertedImage.dataUrl }); }
    createdResult.style.display = 'grid';
    createdResult.innerHTML = `<img src="${qrCode}" alt="QR Code"><div><span class="eyebrow">Item criado</span><h2 style="font-size:26px;margin:7px 0">${esc(item.sku)}</h2><h3>${esc(item.nome)}</h3><p class="muted">${esc(item.localizacao)}</p><div class="hero-actions"><a class="btn btn-primary" href="/pages/item.html?sku=${encodeURIComponent(item.sku)}">Ver item</a><button class="btn btn-secondary" onclick="window.print()">Imprimir etiqueta</button></div></div>`;
    itemForm.reset(); imagePreview.hidden = true; imagePickerText.textContent = 'Clique para selecionar uma imagem'; convertedImage = null; toast('Item e QR Code salvos com sucesso!');
    setTimeout(() => location.replace(`/pages/item.html?sku=${encodeURIComponent(item.sku)}`), 700);
  } catch (error) {
    if (createdItem) {
      toast(`O item ${createdItem.sku} foi criado, mas a foto falhou: ${error.message}`, 'error');
      setTimeout(() => location.replace(`/pages/item.html?sku=${encodeURIComponent(createdItem.sku)}`), 2200);
    } else toast(error.message, 'error');
  }
  finally { button.classList.remove('loading'); button.disabled = false; button.innerHTML = '<i data-lucide="qr-code"></i>Salvar e gerar QR Code'; lucide.createIcons(); }
});

document.addEventListener('DOMContentLoaded', init);
