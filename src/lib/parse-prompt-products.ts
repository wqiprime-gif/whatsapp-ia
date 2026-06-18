/** Extrai pacotes/preços do texto do prompt para sincronizar com Produtos. */
export type ParsedPromptProduct = {
  name: string;
  priceCents: number;
};

export function parseProductsFromPrompt(prompt: string): ParsedPromptProduct[] {
  const results: ParsedPromptProduct[] = [];
  const seen = new Set<string>();
  const text = String(prompt || "");

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("USE ") || /\[\[/.test(trimmed)) continue;

    const m =
      trimmed.match(
        /^(?:[-•*]\s*)?(.+?)\s*(?:[-–—:]\s*[^R$]{0,40})?R\$\s*(\d{1,4})(?:[,.](\d{2}))?/i
      ) || trimmed.match(/^(?:[-•*]\s*)?(.+?)\s+R\$\s*(\d{1,4})(?:[,.](\d{2}))?/i);

    if (!m) continue;

    let name = m[1]
      .replace(/^pacote\s+/i, "")
      .replace(/\s*[-–—:]\s*$/, "")
      .trim();
    if (name.length < 2 || /m[ií]nimo|negoci/i.test(name)) continue;

    const priceCents = parseInt(m[2], 10) * 100 + (m[3] ? parseInt(m[3], 10) : 0);
    if (priceCents < 100) continue;

    const key = `${name.toLowerCase()}:${priceCents}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ name: name.slice(0, 80), priceCents });
  }

  if (results.length > 0) return results;

  const section = text.match(/pacotes?[\s\S]{0,900}/i)?.[0] ?? text;
  const priceRe = /R\$\s*(\d{1,4})[,.](\d{2})/gi;
  const fallbackNames = ["Básico", "Chamada", "Completo", "VIP"];
  let i = 0;
  let pm: RegExpExecArray | null;
  while ((pm = priceRe.exec(section)) !== null && i < 8) {
    const priceCents = parseInt(pm[1], 10) * 100 + parseInt(pm[2], 10);
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
