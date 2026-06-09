import { createChatCompletion } from "./ai-chat.js";
import { getOpenAIModel } from "./settings.js";

export type ReceiptVerdict = {
  paid: boolean;
  confidence: number;
  reason: string;
  userMessage?: string;
  transcript?: string;
};

function parseJsonObject(content: string) {
  try {
    return JSON.parse(content || "{}") as Record<string, unknown>;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

const OCR_PROMPT = `Atue como OCR de alta precisao. Transcreva literalmente o texto visivel da imagem de comprovante Pix.
Nao corrija nomes, nao interprete. Se ilegivel escreva "Nao visivel".
Responda apenas JSON: {"transcript": "texto completo aqui"}`;

export async function ocrReceiptImage(imageUrl: string, userId: string) {
  const model = await getOpenAIModel(userId);
  const completion = await createChatCompletion(userId, {
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: OCR_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcreva este comprovante:" },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      }
    ]
  });
  const parsed = parseJsonObject(completion.choices[0]?.message.content || "{}");
  return String(parsed.transcript || "").trim();
}

export async function validateReceiptTranscript(input: {
  transcript: string;
  pixKey: string;
  recipientName: string;
  expectedAmountCents?: number;
  userId: string;
}): Promise<ReceiptVerdict> {
  const text = input.transcript.trim();
  if (!text || text.length < 20) {
    return { paid: false, confidence: 0, reason: "Nao foi possivel ler o comprovante.", transcript: text };
  }

  const model = await getOpenAIModel(input.userId);
  const amountHint = input.expectedAmountCents
    ? `Valor esperado aproximado: R$ ${(input.expectedAmountCents / 100).toFixed(2)}.`
    : "";

  const completion = await createChatCompletion(input.userId, {
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Voce valida comprovantes Pix. Responda JSON:
{"verdict":"validado"|"nao_validado","confidence":0-1,"reason":"motivo tecnico curto","user_message":"mensagem curta e humana em portugues para o cliente no Telegram, tom simpatico, sem jargao de sistema, sem palavras Motivo/Revisao manual/nao validado"}.

Aprove (validado) somente se:
1) Parecer comprovante Pix/transferencia real com valor pago;
2) Nome do recebedor bater com "${input.recipientName}" ou variacao proxima (acentos, ordem, abreviacoes);
3) Chave Pix "${input.pixKey}" aparecer OU o contexto indicar pagamento concluido para esse recebedor.
${amountHint}
Rejeite mensagens genericas sem comprovante. Em rejeicao, user_message deve pedir gentilmente novo comprovante.`
      },
      {
        role: "user",
        content: `Texto do comprovante:\n\n${text.slice(0, 12000)}`
      }
    ]
  });

  const parsed = parseJsonObject(completion.choices[0]?.message.content || "{}");
  const verdict = String(parsed.verdict || parsed.status || "").toLowerCase();
  const confidence = Number(parsed.confidence ?? 0);
  const paid = verdict === "validado" && confidence >= 0.7;

  return {
    paid,
    confidence: paid ? confidence : Math.min(confidence, 0.5),
    reason: String(parsed.reason || (paid ? "Comprovante validado." : "Comprovante nao validado.")),
    userMessage: String(parsed.user_message || parsed.userMessage || "").trim() || undefined,
    transcript: text
  };
}

export async function validateReceiptFromImage(input: {
  imageUrl: string;
  pixKey: string;
  recipientName: string;
  expectedAmountCents?: number;
  userId: string;
}) {
  const transcript = await ocrReceiptImage(input.imageUrl, input.userId);
  return validateReceiptTranscript({
    transcript,
    pixKey: input.pixKey,
    recipientName: input.recipientName,
    expectedAmountCents: input.expectedAmountCents,
    userId: input.userId
  });
}

export async function validateReceiptFromText(input: {
  text: string;
  pixKey: string;
  recipientName: string;
  expectedAmountCents?: number;
  userId: string;
}) {
  return validateReceiptTranscript({
    transcript: input.text,
    pixKey: input.pixKey,
    recipientName: input.recipientName,
    expectedAmountCents: input.expectedAmountCents,
    userId: input.userId
  });
}
