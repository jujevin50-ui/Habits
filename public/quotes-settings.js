export const DEFAULT_QUOTE_TIMES = Object.freeze(['08:00','13:00','21:00']);
export function validQuoteSettings(value) {
  return !!value && typeof value.enabled === 'boolean' && Array.isArray(value.times) && value.times.length === 3 && new Set(value.times).size === 3 && value.times.every(t=>typeof t==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t));
}
export function quoteSettings(value) {
  return validQuoteSettings(value) ? {enabled:value.enabled,times:[...value.times]} : {enabled:false,times:[...DEFAULT_QUOTE_TIMES]};
}
