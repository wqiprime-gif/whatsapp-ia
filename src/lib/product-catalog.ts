import type { Product } from "../db/events.js";
import type { PackageId } from "./lead-state.js";
import { parseOfferReais } from "./sales-packages.js";
import { pickProductExplicit, productToPackageId } from "./package-selection.js";

export function formatPriceBrl(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function minimumCentsForProduct(product: Product): number {
  const n = product.name.toLowerCase();
  if (/b[aá]sico|basico/i.test(n)) return 500;
  if (/chamada|v[ií]deo|video/i.test(n)) return 1000;
  if (/complet|combo/i.test(n)) return 1500;
  return Math.max(500, Math.round(product.priceCents * 0.5));
}

export function priceTableFromProducts(products: Product[], platform: "whatsapp" | "telegram" = "whatsapp") {
  const sorted = [...products].filter((p) => p.active !== false).sort((a, b) => a.priceCents - b.priceCents);
  if (sorted.length === 0) {
    return priceTableFallback(platform);
  }

  const callHint =
    platform === "telegram"
      ? "5 min no Telegram"
      : "5 min no zap";

  const lines = sorted.map((p, i) => {
    const emoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"][i] ?? "•";
    const price = formatPriceBrl(p.priceCents);
    let extra = "";
    if (/chamada|v[ií]deo/i.test(p.name)) extra = ` (${callHint})`;
    return `${emoji} *${p.name.toUpperCase()}* - R$ ${price}${extra}`;
  });

  return ["💎 *MEUS PACOTES* 💎", ...lines, "", "Qual pacote te interessa, amor? 💕"].join("\n");
}

function priceTableFallback(platform: "whatsapp" | "telegram") {
  const callHint = platform === "telegram" ? "5 min no Telegram" : "5 min no zap";
  return [
    "💎 *MEUS PACOTES* 💎",
    "",
    "1️⃣ *PACOTE BÁSICO* - R$ 9,90",
    "   📦 50 fotos e vídeos exclusivos",
    "",
    `2️⃣ *CHAMADA VÍDEO* - R$ 15,00`,
    `   📹 ${callHint}`,
    "",
    "3️⃣ *PACOTE COMPLETO* - R$ 20,00",
    "   🎁 chamada + pack",
    "",
    "Qual pacote te interessa, amor? 💕"
  ].join("\n");
}

export function negotiationFromProducts(input: {
  text: string;
  products: Product[];
  selected?: PackageId;
  selectedProduct?: Product | null;
}): string | null {
  const amount = parseOfferReais(input.text);
  if (amount === null) return null;
  if (!/(r\$|\d+[,.]?\d*|reais|tenho|consigo|pago|ofereço|ofereco|desconto)/i.test(input.text)) {
    return null;
  }

  const product =
    input.selectedProduct ??
    (input.selected
      ? input.products.find((p) => productToPackageId(p) === input.selected) ?? null
      : pickProductExplicit(input.text, input.products));

  if (!product) return null;

  const min = minimumCentsForProduct(product) / 100;
  if (amount >= min) {
    const formatted = amount.toFixed(2).replace(".", ",");
    return `dessa vez consigo fazer por R$ ${formatted} sim, manda o pix 😘`;
  }
  const minStr = min.toFixed(2).replace(".", ",");
  return `por esse valor nao da nao amor, o minimo que consigo fazer no ${product.name} e R$ ${minStr}`;
}

export function chamadaVideoMessageForPlatform(platform: "whatsapp" | "telegram") {
  if (platform === "telegram") {
    return "e aqui no telegram mesmo amor 😘 depois que voce comprar eu te chamo aqui, sao 5 min";
  }
  return "e aqui no whatsapp mesmo amor 😘 depois que voce comprar eu te ligo, sao 5 min";
}
