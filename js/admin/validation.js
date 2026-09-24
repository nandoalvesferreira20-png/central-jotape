export class ValidationError extends Error {
  constructor(message) { super(message); this.name = 'ValidationError'; }
}
export function required(value, label, max = 240) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new ValidationError(label + ': preencha entre 1 e ' + max + ' caracteres.');
  return text;
}
export function optional(value, max = 2000) {
  const text = String(value ?? '').trim();
  if (text.length > max) throw new ValidationError('Um dos textos excede o limite de ' + max + ' caracteres.');
  return text || null;
}
export function httpsUrl(value) {
  if (!String(value ?? '').trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Validar abaixo. */ }
  throw new ValidationError('Informe uma URL HTTPS válida.');
}
export function enumValue(value, allowed) {
  if (!allowed.includes(value)) throw new ValidationError('Selecione uma opção válida.');
  return value;
}
export function uuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')) {
    throw new ValidationError('Identificador de registro inválido.');
  }
  return value;
}
export function integer(value, label, min = 0, max = 9999, nullable = false) {
  if (nullable && (value === '' || value == null)) return null;
  if (String(value).trim() === '' || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new ValidationError(label + ': informe um número inteiro entre ' + min + ' e ' + max + '.');
  }
  return Number(value);
}
export function dateOnly(value, nullable = false) {
  if (!value && nullable) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value) throw new ValidationError('Informe uma data válida.');
  return value;
}
export function slug(value) {
  const text = required(value, 'Slug', 160);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)) throw new ValidationError('Slug: use letras minúsculas, números e hífens.');
  return text;
}

