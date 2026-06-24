import type OpenAI from "openai";

export type PackageId = "basico" | "chamada" | "completo";

export type LeadState = {
  userMessageCount: number;
  hasSentInformacoes: boolean;
  hasSentAmostra: boolean;
  hasSentNaoSouFake: boolean;
  coldStrike: number;
  paid: boolean;
  selectedPackage?: PackageId;
  selectedProductName?: string;
  offeredHalfPrice?: boolean;
  postSaleActive?: boolean;
  postSaleStage?: "scheduled" | "reopened" | "warmed" | "gift_asked" | "done";
  postSaleUserReplies?: number;
};

export function createLeadState(): LeadState {
  return {
    userMessageCount: 0,
    hasSentInformacoes: false,
    hasSentAmostra: false,
    hasSentNaoSouFake: false,
    coldStrike: 0,
    paid: false
  };
}

const BUY_INTENT =
  /pix|pagar|comprar|comprovante|pacote|b[aá]sico|chamada|completo|combo|9[,.]90|15[,.]00|20[,.]00|quanto (tenho|vc)|valor|pre[cç]o|tabela|previa|prévia|amostra|foto|fake|golpe/i;

const STALL =
  /^(kk+|haha|rs+|ta|t[aá]|blz|beleza|ok|okay|sei|nada|n sei|nem sei)$/i;

export function leadShowsBuyIntent(text: string) {
  return BUY_INTENT.test(text);
}

export function looksLikeStalling(text: string, history: OpenAI.Chat.Completions.ChatCompletionMessageParam[]) {
  if (leadShowsBuyIntent(text)) return false;
  const t = text.trim();
  if (/^(oi+|oii+|oie+|ol[aá]|bom dia|boa tarde|boa noite|e ai|eai|hey|hi)[\s!.?😊🙂❤️]*$/i.test(t)) {
    return false;
  }
  const userMsgs = history.filter((m) => m.role === "user").length;
  if (userMsgs < 3) return false;
  if (STALL.test(t)) return true;
  if (t.length <= 3 && !/\?/.test(t)) return true;
  if (userMsgs >= 4 && !leadShowsBuyIntent(text)) {
    return !/(quero|manda|pode|sim|bora|vou|tem|quanto|oi|oii)/i.test(text);
  }
  return false;
}

const COLD_MESSAGES = [
  "to aqui pra vender amor, se quer comprar me fala",
  "nao tenho tempo pra perder bb, vai comprar ou nao?",
  "se nao vai comprar tudo bem, mas para de enrolar"
] as const;

export function nextColdMessage(state: LeadState): string | null {
  if (state.coldStrike >= COLD_MESSAGES.length) return null;
  return COLD_MESSAGES[state.coldStrike] ?? null;
}

export function leadStateContext(state: LeadState) {
  const parts = [
    `Mensagens do lead nesta conversa: ${state.userMessageCount}.`,
    state.hasSentInformacoes ? "Tabela de precos JA enviada — nao use [[send_informacoes]] de novo." : "Tabela ainda NAO enviada.",
    state.hasSentAmostra ? "Previa gratis JA enviada — nao use [[send_amostra_gratis]]." : "Previa ainda nao enviada.",
    state.selectedPackage
      ? `Pacote escolhido pelo lead: ${state.selectedPackage}. Pode negociar desconto neste pacote.`
      : "Lead ainda NAO escolheu pacote — se pedir desconto, pergunte qual pacote quer ANTES de oferecer valor.",
    state.paid && !state.postSaleActive ? "Lead ja pagou — nao responda." : "",
    state.postSaleActive ? "Modo pos-venda ativo — pode conversar com carinho e pedir presente quando fizer sentido." : ""
  ];
  return parts.filter(Boolean).join(" ");
}
