import type { ReceiptVerdict } from "./receipt-validator.js";

const ACK_MESSAGES = [
  "Recebi! Deixa eu conferir aqui rapidinho...",
  "Chegou sim, amor. Vou olhar o comprovante agora.",
  "Perfeito, já tô verificando pra você.",
  "Obrigada por mandar! Só um instante que eu confiro."
];

const APPROVED_MESSAGES = [
  "Tudo certinho! Já liberei seu acesso pra você.",
  "Pagamento confirmado! Pode entrar que já tá liberado.",
  "Deu certo, amor! Segue seu acesso."
];

export function randomReceiptAck() {
  return ACK_MESSAGES[Math.floor(Math.random() * ACK_MESSAGES.length)];
}

export function randomReceiptApproved() {
  return APPROVED_MESSAGES[Math.floor(Math.random() * APPROVED_MESSAGES.length)];
}

/** Converte motivo técnico da IA em fala natural para o lead. */
export function humanizeReceiptRejection(reason: string, userMessage?: string): string {
  const custom = userMessage?.trim();
  if (custom && custom.length > 12 && !looksRobotic(custom)) {
    return custom;
  }

  const r = reason.toLowerCase();

  if (/nome.*(nao|não).*(bate|corresponde|confere)|recebedor/i.test(r)) {
    return "amor, o nome no comprovante nao bate… manda de novo pro destinatario certo? 😘";
  }
  if (/valor.*(acima|abaixo|diferente|errado|não bate|nao bate)/i.test(r)) {
    return "esse valor nao ta batendo bb… confere e manda outro print?";
  }
  if (/chave|pix.*(nao|não)/i.test(r)) {
    return "nao vi a chave pix certinha nesse print… manda a transferencia completa?";
  }
  if (/ler|ilegivel|ilegível|extrair|vazio|pdf/i.test(r)) {
    return "ficou dificil de ler amor… manda de novo mais nitido?";
  }
  if (/generico|genérico|sem comprovante/i.test(r)) {
    return "isso nao parece comprovante de pix bb… manda o print da transferencia?";
  }

  return "nao deu certo esse comprovante amor… manda outro? 😘";
}

function looksRobotic(text: string) {
  return /motivo:|revisao manual|revisão manual|nao consegui aprovar automaticamente|confidence|validado/i.test(
    text
  );
}

export function formatReceiptOutcome(result: ReceiptVerdict, userMessage?: string) {
  if (result.paid) return randomReceiptApproved();
  return humanizeReceiptRejection(result.reason, userMessage);
}
