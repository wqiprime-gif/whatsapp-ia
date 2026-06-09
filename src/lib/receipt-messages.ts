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
    return "Olhei aqui e o nome no comprovante não bate com o que eu preciso. Confere se mandou pro destinatário certo e manda de novo, tá?";
  }
  if (/valor.*(acima|abaixo|diferente|errado|não bate|nao bate)/i.test(r)) {
    return "O valor desse comprovante não tá batendo com o combinado. Dá uma olhada e me manda outro print, por favor.";
  }
  if (/chave|pix.*(nao|não)/i.test(r)) {
    return "Não consegui ver a chave Pix certinha nesse comprovante. Manda de novo mostrando a transferência completa?";
  }
  if (/ler|ilegivel|ilegível|extrair|vazio/i.test(r)) {
    return "A imagem ficou meio difícil de ler. Tenta mandar de novo com print mais nítido, sem cortar nada.";
  }
  if (/generico|genérico|sem comprovante/i.test(r)) {
    return "Isso não parece um comprovante de Pix. Manda o print da transferência feita, tá bem?";
  }

  return "Não consegui confirmar esse pagamento automaticamente. Me manda outro comprovante ou chama aqui que eu te ajudo.";
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
