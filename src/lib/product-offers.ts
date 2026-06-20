import type { Product } from "../db/events.js";
import { parseOfferReais } from "./sales-packages.js";

const CANT_PAY =
  /nao consigo|n[aã]o consigo|nao tenho|n[aã]o tenho|sem dinheiro|t[aá] caro|muito caro|caro demais|nao da|n[aã]o d[aá]|imposs[ií]vel|nao posso|n[aã]o posso|so tenho|s[oó] tenho|nao pago|n[aã]o pago/i;

const DISCOUNT_INTENT =
  /desconto|metade|mais barato|baratinh|diminuir|reduzir|promo[cç][aã]o|abaixar|menor pre[cç]o|faz\s+por|faz\s+menos|tem como.*desconto|nao tem como.*desconto|n[aã]o tem como.*desconto|consegue.*desconto|da\s+um\s+desconto|com metade|pela metade|50\s*%|cinquenta por cento/i;

export function cantPayIntent(text: string) {
  return CANT_PAY.test(text) || DISCOUNT_INTENT.test(text);
}

function pickProduct(text: string, products: Product[]) {
  const t = text.toLowerCase();
  const pkgNum = t.match(/pacote\s*#?\s*(\d+)/i);
  if (pkgNum) {
    const idx = Number(pkgNum[1]) - 1;
    const sorted = [...products].sort((a, b) => a.priceCents - b.priceCents);
    if (sorted[idx]) return sorted[idx];
  }
  if (/complet/i.test(t)) {
    const m = products.find((p) => /complet/i.test(p.name));
    if (m) return m;
  }
  if (/b[aá]sico|basico/i.test(t)) {
    const m = products.find((p) => /b[aá]sico|basico/i.test(p.name));
    if (m) return m;
  }
  if (/chamada|v[ií]deo|video/i.test(t)) {
    const m = products.find((p) => /chamada|v[ií]deo|video/i.test(p.name));
    if (m) return m;
  }
  const offer = parseOfferReais(text);
  if (offer !== null) {
    const match = products.find((p) => Math.abs(p.priceCents / 100 - offer) < 2);
    if (match) return match;
  }
  return products[0];
}

export function halfPriceOfferReply(
  text: string,
  products: Product[],
  alreadyOffered: boolean
): string | null {
  if (alreadyOffered) return null;
  if (!cantPayIntent(text)) return null;
  const eligible = products.filter((p) => p.active && p.allowHalfPrice);
  if (eligible.length === 0) return null;

  const product = pickProduct(text, eligible);
  const pct = product.halfPricePercent ?? 50;
  const halfCents = Math.round(product.priceCents * (pct / 100));
  const half = (halfCents / 100).toFixed(2).replace(".", ",");
  const full = (product.priceCents / 100).toFixed(2).replace(".", ",");

  return `entendo amor 💕 o ${product.name} ta R$ ${full}, mas dessa vez consigo fazer por metade — R$ ${half}. e so pra voce, manda o pix? 😘`;
}
