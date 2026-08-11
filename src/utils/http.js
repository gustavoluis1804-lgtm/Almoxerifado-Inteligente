export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function normalizeText(value = '') {
  return String(value).trim();
}

export function positiveInt(value, fieldName = 'quantidade') {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    const error = new Error(`${fieldName} deve ser um número inteiro maior que zero.`);
    error.status = 400;
    throw error;
  }
  return number;
}
