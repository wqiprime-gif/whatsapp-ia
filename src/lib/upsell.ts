export type UpsellRule = {
  /** Pacote que o lead comprou (vazio = qualquer). Ex: "Básico" */
  fromProduct: string;
  /** Pacote oferecido no upgrade. Ex: "Completo" */
  toProduct: string;
  /** Mensagem — use {from}, {to}, {price}, {diff} */
  message: string;
};

export type ProductLike = { name: string; priceCents: number };

export function parseUpsellRules(value: unknown): UpsellRule[] {
  if (!value) return [];
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      fromProduct: String(item?.fromProduct ?? item?.from ?? "").trim(),
      toProduct: String(item?.toProduct ?? item?.to ?? "").trim(),
      message: String(item?.message ?? "").trim()
    }))
    .filter((r) => r.toProduct);
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function productMatches(name: string, pattern: string) {
  const p = norm(pattern);
  if (!p) return true;
  const n = norm(name);
  return n.includes(p) || p.includes(n);
}

export function pickUpsellOffer(
  purchasedName: string,
  products: ProductLike[],
  rules: UpsellRule[]
): { from: ProductLike; to: ProductLike; message: string } | null {
  if (products.length < 2) return null;
  const sorted = [...products].sort((a, b) => (a.priceCents || 0) - (b.priceCents || 0));
  let from =
    sorted.find((p) => productMatches(p.name, purchasedName)) ||
    sorted.find((p) => norm(purchasedName).includes(norm(p.name))) ||
    null;

  for (const rule of rules) {
    if (!productMatches(purchasedName, rule.fromProduct)) continue;
    const to = sorted.find((p) => productMatches(p.name, rule.toProduct));
    if (!to) continue;
    if (from && (to.priceCents || 0) <= (from.priceCents || 0)) continue;
    return {
      from: from || sorted[0]!,
      to,
      message: rule.message
    };
  }

  if (!from) from = sorted[0]!;
  const idx = sorted.findIndex((p) => p.name === from!.name);
  if (idx < 0 || idx >= sorted.length - 1) return null;
  const to = sorted[idx + 1]!;
  if ((to.priceCents || 0) <= (from.priceCents || 0)) return null;
  return {
    from,
    to,
    message:
      "amor, gostou? se fechar o {to} por so R${diff} a mais eu libero agora 😈"
  };
}

export function formatUpsellMessage(
  template: string,
  from: ProductLike,
  to: ProductLike
): string {
  const diff = Math.max(0, ((to.priceCents || 0) - (from.priceCents || 0)) / 100);
  const price = (to.priceCents || 0) / 100;
  const fmt = (n: number) => n.toFixed(2).replace(".", ",");
  return String(template || "")
    .replace(/\{diff\}/g, fmt(diff))
    .replace(/\{price\}/g, fmt(price))
    .replace(/\{from\}/g, from.name)
    .replace(/\{to\}/g, to.name);
}

export function upsellPromptHint(customPrompt = "", rules: UpsellRule[] = []) {
  const lines = rules.map(
    (r) =>
      `- Comprou "${r.fromProduct || "qualquer"}" → oferecer "${r.toProduct}": ${r.message.slice(0, 80)}`
  );
  return [
    "UPSELL DE PACOTE (upgrade após compra):",
    customPrompt.trim() ||
      "Ofereça o pacote maior com naturalidade. Se o lead aceitar, envie Pix do upgrade.",
    lines.length ? "Regras cadastradas:\n" + lines.join("\n") : "Sem regras — usa o próximo pacote mais caro automaticamente."
  ].join("\n");
}
