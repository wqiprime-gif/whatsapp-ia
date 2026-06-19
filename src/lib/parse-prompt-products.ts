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

function parseProductLine(trimmed: string): ParsedPromptProduct | null {
  if (!trimmed || !/R\$\s*\d/i.test(trimmed)) return null;
  if (/m[ií]nimo|negoci|exemplo:/i.test(trimmed)) return null;

  const colonPrice = trimmed.match(
    /^(?:[-•*]\s*)?([^:\n]+?)\s*:[^R$\n]*R\$\s*(\d{1,4})(?:[,.](\d{2}))?/i
  );
  if (colonPrice) {
    const name = cleanName(colonPrice[1]);
    const priceCents = parsePriceCents(colonPrice[2], colonPrice[3]);
    if (name.length >= 2 && priceCents >= 100) return { name, priceCents };
  }

  const dashPrice = trimmed.match(
    /^(?:[-•*]\s*)?(.+?)\s+[-–—]\s*R\$\s*(\d{1,4})(?:[,.](\d{2}))?/i
  );
  if (dashPrice) {
    const name = cleanName(dashPrice[1]);
    const priceCents = parsePriceCents(dashPrice[2], dashPrice[3]);
    if (name.length >= 2 && priceCents >= 100) return { name, priceCents };
  }

  const inlinePrice = trimmed.match(/^(?:[-•*]\s*)?(.+?)\s+R\$\s*(\d{1,4})(?:[,.](\d{2}))?/i);
  if (inlinePrice) {
    const name = cleanName(inlinePrice[1]);
    const priceCents = parsePriceCents(inlinePrice[2], inlinePrice[3]);
    if (name.length >= 2 && priceCents >= 100) return { name, priceCents };
  }

  return null;
}

/** Lê linhas com bullet abaixo de "Pacotes:" até próxima seção. */
function parsePacotesBullets(text: string): ParsedPromptProduct[] {
  const lines = text.split(/\r?\n/);
  let inPacotes = false;
  const results: ParsedPromptProduct[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^pacotes?\s*:?\s*$/i.test(trimmed)) {
      inPacotes = true;
      continue;
    }
    if (!inPacotes) continue;
    if (!trimmed) continue;

    if (/^[-•*]\s/.test(trimmed)) {
      const item = parseProductLine(trimmed);
      if (item) {
        const key = item.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          results.push(item);
        }
      }
      continue;
    }

    if (/^(?:CHAMADA|M[IÍ]NIMOS|USE |\[\[|FLUXO|PR[EÉ]VIAS|COMPROVANTE|SE O LEAD)/i.test(trimmed)) {
      break;
    }
    if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{2,}:?\s*$/.test(trimmed) && !/R\$/i.test(trimmed)) {
      break;
    }
    if (results.length > 0) break;
  }

  return results;
}

function parseAllBulletPrices(text: string): ParsedPromptProduct[] {
  const results: ParsedPromptProduct[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!/^[-•*]\s/.test(trimmed)) continue;
    const item = parseProductLine(trimmed);
    if (!item) continue;
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(item);
  }
  return results;
}

export function parseProductsFromPrompt(prompt: string): ParsedPromptProduct[] {
  const text = String(prompt || "");
  let results = parsePacotesBullets(text);
  if (results.length === 0) results = parseAllBulletPrices(text);

  if (results.length > 0) {
    const byName = new Map<string, ParsedPromptProduct>();
    for (const item of results) {
      const key = item.name.toLowerCase();
      if (!byName.has(key)) byName.set(key, item);
    }
    return [...byName.values()];
  }

  const section = text.match(/pacotes?[\s\S]{0,1500}/i)?.[0] ?? text;
  const priceRe = /R\$\s*(\d{1,4})[,.](\d{2})/gi;
  const fallbackNames = ["Pacote Básico", "Chamada Vídeo", "Pacote Completo", "VIP"];
  const seen = new Set<string>();
  let i = 0;
  let pm: RegExpExecArray | null;
  const fallback: ParsedPromptProduct[] = [];
  while ((pm = priceRe.exec(section)) !== null && i < 8) {
    const priceCents = parsePriceCents(pm[1], pm[2]);
    const name = fallbackNames[i] ?? `Pacote ${i + 1}`;
    const key = `${name}:${priceCents}`;
    if (!seen.has(key) && priceCents >= 100) {
      seen.add(key);
      fallback.push({ name, priceCents });
      i++;
    }
  }

  return fallback;
}
