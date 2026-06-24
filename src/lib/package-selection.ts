import type { Product } from "../db/events.js";
import type { PackageId } from "./lead-state.js";
import { parseOfferReais } from "./sales-packages.js";

/** Detecta pacote só se o lead mencionou explicitamente — sem fallback. */
export function explicitPackageIdInText(text: string): PackageId | null {
  const t = text.toLowerCase();
  if (/pacote\s*#?\s*3|complet|combo|tudo|os.?dois|\b20\b|vinte/i.test(t)) return "completo";
  if (/pacote\s*#?\s*2|chamada|videochamada|liga|\b15\b|quinze/i.test(t)) return "chamada";
  if (/pacote\s*#?\s*1|b[aá]sico|basico|\b9[,.]90|\b9\b|nove/i.test(t)) return "basico";
  return null;
}

export function pickProductExplicit(text: string, products: Product[]): Product | null {
  if (products.length === 0) return null;
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
