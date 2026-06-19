/** Helpers para links wa.me e distribuição de tráfego entre instâncias. */

export function normalizeWaPhone(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const digits = s.replace(/@.*$/, "").replace(/\D/g, "");
  return digits;
}

export function formatWaPhoneDisplay(phone: string): string {
  const d = normalizeWaPhone(phone);
  if (!d) return "—";
  if (d.length >= 12 && d.startsWith("55")) {
    const local = d.slice(2);
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);
    if (rest.length >= 9) {
      return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    return `+55 ${ddd} ${rest}`;
  }
  return `+${d}`;
}

export function buildWaMeUrl(phone: string, message = ""): string {
  const digits = normalizeWaPhone(phone);
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  const msg = message.trim();
  if (!msg) return base;
  return `${base}?text=${encodeURIComponent(msg)}`;
}
