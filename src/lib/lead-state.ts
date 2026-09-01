import type OpenAI from "openai";

export type PackageId = "basico" | "chamada" | "completo";

export type FunnelStage =
  | "new"
  | "curious"
  | "negotiating"
  | "paying"
  | "paid"
  | "upsell"
  | "post_sale";

export type LeadObjection =
  | "caro"
  | "sem_dinheiro"
  | "fake"
  | "indeciso"
  | "desconfiado"
  | null;

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
  /** Estágio do funil para a IA */
  funnelStage?: FunnelStage;
  /** Última objeção detectada na conversa */
  lastObjection?: LeadObjection;
  upsellOffered?: boolean;
  purchasedProductName?: string;
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
  const stageLabels: Record<FunnelStage, string> = {
    new: "Lead novo — apresente com leveza.",
    curious: "Lead curioso — mostre valor e pacotes.",
    negotiating: "Lead negociando — trate objecao com empatia.",
    paying: "Lead pagando — aguarde comprovante.",
    paid: "Lead ja pagou — nao responda.",
    upsell: "Modo upsell — ofereceu upgrade, pode negociar o pacote maior.",
    post_sale: "Pos-venda — conversa leve, presente ou upsell se configurado."
  };
  const objectionHints: Record<string, string> = {
    caro: "Objecao: achou caro — reforce valor, nao pressione.",
    sem_dinheiro: "Objecao: sem dinheiro — meia entrada ou pacote menor.",
    fake: "Objecao: desconfia — use [[naosou_fake]] se ainda nao enviou.",
    indeciso: "Objecao: indeciso — pergunte o que falta pra fechar.",
    desconfiado: "Objecao: desconfiado — seja transparente."
  };
  const stage = state.funnelStage || (state.paid ? "paid" : "new");
  const parts = [
    `Estagio do funil: ${stage}. ${stageLabels[stage] || ""}`,
    state.lastObjection ? objectionHints[state.lastObjection] || "" : "",
    `Mensagens do lead nesta conversa: ${state.userMessageCount}.`,
    state.hasSentInformacoes ? "Tabela de precos JA enviada — nao use [[send_informacoes]] de novo." : "Tabela ainda NAO enviada.",
    state.hasSentAmostra ? "Previa gratis JA enviada — nao use [[send_amostra_gratis]]." : "Previa ainda nao enviada.",
    state.selectedPackage
      ? `Pacote escolhido pelo lead: ${state.selectedPackage}. Pode negociar desconto neste pacote.`
      : "Lead ainda NAO escolheu pacote — se pedir desconto, pergunte qual pacote quer ANTES de oferecer valor.",
    state.paid && !state.postSaleActive && stage !== "upsell"
      ? "Lead ja pagou — nao responda."
      : "",
    state.upsellOffered ? "Upsell de pacote JA oferecido nesta compra." : "",
    state.postSaleActive ? "Modo pos-venda ativo — pode conversar com carinho e pedir presente quando fizer sentido." : ""
  ];
  return parts.filter(Boolean).join(" ");
}
