import type { Product } from "../db/events.js";
import type { PackageId } from "./lead-state.js";
import { parseOfferReais } from "./sales-packages.js";

/** Detecta pacote só se o lead mencionou explicitamente — sem fallback. */
export function explicitPackageIdInText(text: string): PackageId | null {
  const t = text.toLowerCase();
  // Ordem por especificidade: nome do pacote > número > preço exato (não usar \b20\b solto).
  if (/pacote\s*#?\s*1\b|b[aá]sico|basico/i.test(t)) return "basico";
  if (/pacote\s*#?\s*2\b|chamada|videochamada|liga[cç][aã]o/i.test(t)) return "chamada";
  if (/pacote\s*#?\s*3\b|complet|combo|os.?dois/i.test(t)) return "completo";
  if (/r\$\s*9[,.]90|\b9[,.]90\b/.test(t)) return "basico";
  if (/r\$\s*15[,.]00|\b15[,.]00\b/.test(t)) return "chamada";
  if (/r\$\s*20[,.]00|\b20[,.]00\b/.test(t)) return "completo";
  return null;
}

/**
 * Escolhe produto pelo texto. Preferência: pacote N → nome (básico antes de completo)
 * → preço próximo. Sem fallback para o mais caro.
 */
export function pickProductExplicit(text: string, products: Product[]): Product | null {
  if (products.length === 0) return null;
  const t = text.toLowerCase();
  const pkgNum = t.match(/pacote\s*#?\s*(\d+)/i);
  if (pkgNum) {
    const idx = Number(pkgNum[1]) - 1;
    const sorted = [...products].sort((a, b) => a.priceCents - b.priceCents);
    if (sorted[idx]) return sorted[idx];
  }
  // Básico ANTES de completo — evita "quero o básico" perder pro histórico com "completo/20".
  if (/b[aá]sico|basico/i.test(t)) {
    const m = products.find((p) => /b[aá]sico|basico/i.test(p.name));
    if (m) return m;
  }
  if (/chamada|v[ií]deo|video/i.test(t)) {
    const m = products.find((p) => /chamada|v[ií]deo|video/i.test(p.name));
    if (m) return m;
  }
  if (/complet|combo/i.test(t)) {
    const m = products.find((p) => /complet|combo/i.test(p.name));
    if (m) return m;
  }
  const offer = parseOfferReais(text);
  if (offer !== null) {
    let best: Product | null = null;
    let bestDiff = Infinity;
    for (const p of products) {
      const diff = Math.abs(p.priceCents / 100 - offer);
      if (diff < 2 && diff < bestDiff) {
        best = p;
        bestDiff = diff;
      }
    }
    if (best) return best;
  }
  return null;
}

/** Percorre mensagens do mais recente ao mais antigo e devolve o 1º pacote explícito. */
export function pickProductFromRecentMessages(
  messages: string[],
  products: Product[]
): Product | null {
  for (const msg of messages) {
    const hit = pickProductExplicit(msg, products);
    if (hit) return hit;
  }
  return null;
}

export function askWhichPackageMessage(products: Product[]): string {
  const sorted = [...products].sort((a, b) => a.priceCents - b.priceCents);
  if (sorted.length === 0) {
    return "qual pacote vc quer amor? me fala que eu te ajudo 😊";
  }
  const list = sorted.map((p, i) => `${i + 1}) ${p.name}`).join(", ");
  return `qual pacote vc quer amor? ${list} 😊`;
}

export function productToPackageId(product: Product): PackageId {
  const n = product.name.toLowerCase();
  if (/complet|combo|tudo/i.test(n)) return "completo";
  if (/chamada|v[ií]deo|video/i.test(n)) return "chamada";
  return "basico";
}
