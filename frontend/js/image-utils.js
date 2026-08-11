async function convertItemImage(file) {
  if (!file?.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem válido.');
  if (file.size > 12 * 1024 * 1024) throw new Error('A imagem original deve ter no máximo 12 MB.');
  const bitmap = 'createImageBitmap' in window ? await createImageBitmap(file) : await loadImageElement(file);
  const sourceWidth = bitmap.width || bitmap.naturalWidth;
  const sourceHeight = bitmap.height || bitmap.naturalHeight;
  const scale = Math.min(1, 1200 / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
  let quality = .82; let blob;
  do { blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality)); quality -= .1; }
  while (blob && blob.size > 1400 * 1024 && quality >= .42);
  if (!blob || blob.size > 1536 * 1024) throw new Error('Não foi possível reduzir a imagem para menos de 1,5 MB.');
  const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
  return { dataUrl, preview: URL.createObjectURL(blob), size: blob.size, width: canvas.width, height: canvas.height };
}
window.convertItemImage = convertItemImage;

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir esta imagem.')); };
    image.src = url;
  });
}
