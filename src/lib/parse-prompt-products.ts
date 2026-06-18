/** Extrai pacotes/preços do texto do prompt para sincronizar com Produtos. */
export type ParsedPromptProduct = {
  name: string;
  priceCents: number;
};

function parsePriceCents(whole: string, cents?: string) {
  const w = parseInt(whole, 10);
  const c = cents ? parseInt(cents, 10) : 0;
  if (Number.isNaN(w)) return 0;
  return w * 100 + (Number.isNaN(c) ? 0 : c);
}

function cleanName(raw: string) {
  return raw
    .replace(/^[-•*]\s*/, "")
    .replace(/\s*[-–—:]\s*$/, "")
    .trim()
    .slice(0, 80);
}

export function parseProductsFromPrompt(prompt: string): ParsedPromptProduct[] {
  const results: ParsedPromptProduct[] = [];
  const seen = new Set<string>();
  const text = String(prompt || "");

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("USE ") || /\[\[/.test(trimmed)) continue;
    if (/m[ií]nimo|negoci/i.test(trimmed)) continue;

    const colonPrice = trimmed.match(
      /^(?:[-•*]\s*)?([^:\n]+?)\s*:[^R$\n]*R\$\s*(\d{1,4})(?:[,.](\d{2}))?/i
    );
    if (colonPrice) {
      const name = cleanName(colonPrice[1]);
      const priceCents = parsePriceCents(colonPrice[2], colonPrice[3]);
      if (name.length >= 2 && priceCents >= 100) {
        const key = `${name.toLowerCase()}:${priceCents}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ name, priceCents });
        }
      }
      continue;
    }

    const dashPrice = trimmed.match(
      /^(?:[-•*]\s*)?(.+?)\s+[-–—]\s*R\$\s*(\d{1,4})(?:[,.](\d{2}))?/i
    );
    if (dashPrice) {
      const name = cleanName(dashPrice[1]);
      const priceCents = parsePriceCents(dashPrice[2], dashPrice[3]);
      if (name.length >= 2 && priceCents >= 100) {
        const key = `${name.toLowerCase()}:${priceCents}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ name, priceCents });
        }
      }
      continue;
    }

    const inlinePrice = trimmed.match(/^(?:[-•*]\s*)?(.+?)\s+R\$\s*(\d{1,4})(?:[,.](\d{2}))?/i);
    if (inlinePrice) {
      const name = cleanName(inlinePrice[1]);
      const priceCents = parsePriceCents(inlinePrice[2], inlinePrice[3]);
      if (name.length >= 2 && priceCents >= 100) {
        const key = `${name.toLowerCase()}:${priceCents}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ name, priceCents });
        }
      }
    }
  }

  if (results.length > 0) return results;

  const section = text.match(/pacotes?[\s\S]{0,1200}/i)?.[0] ?? text;
  const priceRe = /R\$\s*(\d{1,4})[,.](\d{2})/gi;
  const fallbackNames = ["Pacote Básico", "Chamada Vídeo", "Pacote Completo", "VIP"];
  let i = 0;
  let pm: RegExpExecArray | null;
  while ((pm = priceRe.exec(section)) !== null && i < 8) {
    const priceCents = parsePriceCents(pm[1], pm[2]);
    const name = fallbackNames[i] ?? `Pacote ${i + 1}`;
    const key = `${name}:${priceCents}`;
    if (!seen.has(key) && priceCents >= 100) {
      seen.add(key);
      results.push({ name, priceCents });
      i++;
    }
  }

  return results;
}
