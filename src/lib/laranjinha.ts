import { env } from "../config.js";

export type PixCharge = {
  id: string;
  brCode: string;
  qrCodeBase64?: string;
  status: string;
};

/**
 * Cliente Laranjinha — base configurável (docs: https://laranjinha.digital/docs/api)
 * Tenta endpoints comuns da API PIX.
 */
export async function createLaranjinhaCharge(input: {
  apiKey: string;
  amountCents: number;
  description: string;
}): Promise<PixCharge> {
  const base = env.LARANJINHA_API_BASE.replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": input.apiKey,
    Authorization: `Bearer ${input.apiKey}`
  };

  const bodies = [
  { value: input.amountCents, description: input.description },
  { amount: input.amountCents, description: input.description },
  { amount_cents: input.amountCents, description: input.description }
  ];

  const paths = ["/pix/create", "/api/pix/create", "/v1/pix/charge", "/charges/pix"];

  let lastError = "Nenhum endpoint respondeu.";

  for (const path of paths) {
    for (const body of bodies) {
      try {
        const response = await fetch(`${base}${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        const data = (await response.json()) as Record<string, unknown>;
        if (!response.ok) {
          lastError = String(data.message || data.error || response.statusText);
          continue;
        }
        const id = String(data.id || data.charge_id || data.chargeId || "");
        const brCode = String(data.brCode || data.br_code || data.pix_copy_paste || data.copyPaste || "");
        if (!id && !brCode) {
          lastError = "Resposta sem ID ou codigo Pix.";
          continue;
        }
        return {
          id: id || `charge-${Date.now()}`,
          brCode,
          qrCodeBase64: String(data.qrCodeBase64 || data.qr_code_base64 || ""),
          status: String(data.status || "pending")
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Erro de rede.";
      }
    }
  }

  throw new Error(`Laranjinha: ${lastError} Configure LARANJINHA_API_BASE se a URL da API for diferente.`);
}
