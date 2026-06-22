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

export function wantsInterestIntent(text: string) {
  if (wantsPreviewIntent(text)) return false;
  return /quero|sim|pode|manda|tem|interesse|o que voc|oque voc|pack|conte[uú]do|ver|mostra|quanto|pre[cç]o|valor|tabela|o que (vc|ce) tem|me fala|me conta|gostei|curti|top|legal/i.test(
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

/** Lead confirmou oferta recente (ex: "quero sim" depois de "quer ver?"). */
export function confirmsPreviewInterest(text: string) {
  return /^(sim|s|quero|quero sim|pode|manda|manda ai|manda aí|bora|ok|show|quero ver|manda pra mim|pode mandar)$/i.test(
    text.trim()
  );
}

export function conversationOfferedPreview(
  history: { role: string; content?: unknown }[]
) {
  const assistants = history
    .filter((m) => m.role === "assistant")
    .slice(-4)
    .map((m) => String(m.content || ""))
    .join(" ");
  return /pr[eé]via|amostra|quer ver|posso te enviar|mando uma|foto gr[aá]tis|teste gr[aá]tis/i.test(assistants);
}

export function conversationOfferedPresentation(
  history: { role: string; content?: unknown }[]
) {
  const assistants = history
    .filter((m) => m.role === "assistant")
    .slice(-4)
    .map((m) => String(m.content || ""))
    .join(" ");
  return /recebe|apresenta|pack|conte[uú]do|o que (voce|vc) (ganha|recebe)|mostrar o que/i.test(assistants);
}

export function textPromisesPresentation(text: string) {
  return /é isso que (voce|vc) recebe|olha o que (voce|vc) (recebe|ganha)|isso que (voce|vc) recebe/i.test(text);
}

export function limitSentences(text: string, max = 2) {
  const trimmed = text.replace(/\[\[[\w_]+\]\]/gi, "").trim();
  if (!trimmed) return "";
  const parts = trimmed.match(/[^.!?…\n]+[.!?…]?|[^.!?…\n]+/g)?.map((s) => s.trim()).filter(Boolean) ?? [
    trimmed
  ];
  return parts.slice(0, max).join(" ").trim();
}
