export function isGreeting(text: string) {
  const t = text.trim().toLowerCase();
  return /^(oi+|oii+|oie+|ola|eae|hey|bom dia|boa tarde|boa noite|e ai|eai)[\s!.,?]*$/i.test(t) ||
    /^(oi+|oii+)[\s,]*(amor|bb|bebe|gata|linda|gostosa|safada)/i.test(t);
}

export function wantsPriceTable(text: string) {
  return /tabela|precos|preços|valores|pacotes?|o que (voce|vc) tem|oq (voce|vc) tem|quanto custa|quanto (é|e)|pack|conteudo|conteúdo/i.test(
    text
  );
}

export function wantsPreviewIntent(text: string) {
  return /previa|prévia|amostra|foto grátis|foto gratis|manda foto|manda uma foto|tem foto|ver antes|mostra/i.test(
    text
  );
}

export function wantsPixIntent(text: string) {
  return /pix|pagar|pagamento|comprovante|vou comprar|quero comprar|manda (o )?pix/i.test(text);
}

export function confirmsPriceInterest(text: string) {
  return /^(sim|s|pode|manda|quero|bora|manda ai|manda aí|show|ok|quero ver|quero sim)/i.test(text.trim()) ||
    /(quero ver|manda a tabela|mostra|pode mandar).*(tabela|precos|preços|pacotes)/i.test(text);
}

export function limitSentences(text: string, max = 2) {
  const trimmed = text.replace(/\[\[[\w_]+\]\]/gi, "").trim();
  if (!trimmed) return "";
  const parts = trimmed.match(/[^.!?…\n]+[.!?…]?|[^.!?…\n]+/g)?.map((s) => s.trim()).filter(Boolean) ?? [
    trimmed
  ];
  return parts.slice(0, max).join(" ").trim();
}
