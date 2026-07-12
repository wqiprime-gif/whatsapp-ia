import type { Product } from "../db/events.js";
import { parseOfferReais } from "./sales-packages.js";
import { askWhichPackageMessage, pickProductExplicit } from "./package-selection.js";
import { formatPriceBrl } from "./product-catalog.js";

const CANT_PAY =
  /nao consigo|n[aã]o consigo|nao tenho|n[aã]o tenho|sem dinheiro|t[aá] caro|muito caro|caro demais|nao da|n[aã]o d[aá]|imposs[ií]vel|nao posso|n[aã]o posso|so tenho|s[oó] tenho|nao pago|n[aã]o pago/i;

const DISCOUNT_INTENT =
  /desconto|metade|mais barato|baratinh|diminuir|reduzir|promo[cç][aã]o|abaixar|menor pre[cç]o|faz\s+por|faz\s+menos|tem como.*desconto|nao tem como.*desconto|n[aã]o tem como.*desconto|consegue.*desconto|da\s+um\s+desconto|com metade|pela metade|50\s*%|cinquenta por cento/i;

export function cantPayIntent(text: string) {
  return CANT_PAY.test(text) || DISCOUNT_INTENT.test(text);
}

export type HalfPriceOfferResult =
  | { type: "offer"; message: string }
  | { type: "ask_package"; message: string }
  | null;

export function halfPriceOfferReply(input: {
  text: string;
  products: Product[];
  alreadyOffered: boolean;
  hasSentInformacoes: boolean;
  /** Pacote que o lead já escolheu (nunca inventar outro). */
  selectedProduct?: Product | null;
  /** Mensagens recentes do lead, da mais nova à mais antiga. */
  recentUserMessages?: string[];
}): HalfPriceOfferResult {
  if (input.alreadyOffered) return null;
  if (!cantPayIntent(input.text)) return null;
  if (!input.hasSentInformacoes) return null;

  const eligible = input.products.filter((p) => p.active !== false && p.allowHalfPrice);
  if (eligible.length === 0) return null;

  const fromText = pickProductExplicit(input.text, eligible);
  const fromSelected =
    input.selectedProduct && eligible.some((p) => p.name === input.selectedProduct!.name)
      ? input.selectedProduct
      : null;
  let fromHistory: Product | null = null;
  if (!fromText && !fromSelected && input.recentUserMessages?.length) {
    for (const msg of input.recentUserMessages) {
      fromHistory = pickProductExplicit(msg, eligible);
      if (fromHistory) break;
    }
  }
  const product = fromText || fromSelected || fromHistory;
  if (!product) {
    return { type: "ask_package", message: askWhichPackageMessage(eligible) };
  }

  const pct = product.halfPricePercent ?? 50;
  const halfCents = Math.round(product.priceCents * (pct / 100));
  const half = formatPriceBrl(halfCents);
  const full = formatPriceBrl(product.priceCents);

  return {
    type: "offer",
    message: `entendo amor 💕 o ${product.name} ta R$ ${full}, mas dessa vez consigo fazer por metade — R$ ${half}. e so pra voce, manda o pix? 😘`
  };
}

/** @deprecated use halfPriceOfferReply with gate */
export function pickProduct(text: string, products: Product[]) {
  return pickProductExplicit(text, products);
}

export function parseOfferAmount(text: string) {
  return parseOfferReais(text);
}
