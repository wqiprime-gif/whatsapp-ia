import type { Product } from "../db/events.js";
import { parseOfferReais } from "./sales-packages.js";

const CANT_PAY =
  /nao consigo|n[aã]o consigo|nao tenho|n[aã]o tenho|sem dinheiro|t[aá] caro|muito caro|caro demais|nao da|n[aã]o d[aá]|imposs[ií]vel|nao posso|n[aã]o posso|so tenho|s[oó] tenho|nao pago|n[aã]o pago/i;

export function cantPayIntent(text: string) {
  return CANT_PAY.test(text);
}

export function halfPriceOfferReply(
  text: string,
  products: Product[],
  alreadyOffered: boolean
): string | null {
  if (alreadyOffered) return null;
  const eligible = products.filter((p) => p.active && p.allowHalfPrice);
  if (eligible.length === 0) return null;

  const offer = parseOfferReais(text);
  let product = eligible[0];
  if (offer !== null) {
    const match = eligible.find((p) => Math.abs(p.priceCents / 100 - offer) < 2);
    if (match) product = match;
  }

  const pct = product.halfPricePercent ?? 50;
  const halfCents = Math.round(product.priceCents * (pct / 100));
  const half = (halfCents / 100).toFixed(2).replace(".", ",");
  const full = (product.priceCents / 100).toFixed(2).replace(".", ",");

  return `entendo amor 💕 o ${product.name} ta R$ ${full}, mas dessa vez consigo fazer por metade — R$ ${half}. e so pra voce, manda o pix? 😘`;
}
