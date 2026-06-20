/** ID estável para leads no painel — telefone @c.us ou hash para @lid. */
function waChatId(jid) {
  const raw = String(jid || '');
  const bare = raw.split('@')[0] || '';
  const digits = bare.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 15) {
    const n = Number(digits);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const id = h >>> 0;
  return id > 0 ? id : 1;
}

module.exports = { waChatId };
