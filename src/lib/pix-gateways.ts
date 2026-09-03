/**
 * Gateways PIX com código copia e cola (NexusPag, WiinPay, Laranjinha).
 */

export type PixGatewayId = "pix" | "laranjinha" | "nexuspag" | "wiinpay";

export type PixCharge = {
  id: string;
  externalId: string;
  brCode: string;
  qrCodeBase64?: string;
  status: string;
  gateway: Exclude<PixGatewayId, "pix">;
  raw?: unknown;
};

export function isGatewayPayment(method: string | undefined): method is Exclude<PixGatewayId, "pix"> {
  return method === "laranjinha" || method === "nexuspag" || method === "wiinpay";
}

export function parsePaymentMethod(value: unknown): PixGatewayId {
  const v = String(value || "").toLowerCase().trim();
  if (v === "laranjinha" || v === "nexuspag" || v === "wiinpay") return v;
  return "pix";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickString(...values: unknown[]) {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

export function extractPixCode(data: unknown): string {
  const root = asRecord(data);
  const t = asRecord(root.transaction || asRecord(root.data).transaction || root.data || root.payment || root);
  return pickString(
    t.pix_copia_cola,
    root.pix_copia_cola,
    t.copy_paste,
    t.pix_copy_paste,
    t.emv,
    t.brcode,
    t.brCode,
    t.br_code,
    t.payload,
    t.qr_code,
    t.qrCode,
    root.qr_code,
    root.brCode,
    root.copyPaste
  );
}

export function extractPixId(data: unknown): string {
  const root = asRecord(data);
  const t = asRecord(root.transaction || asRecord(root.data).transaction || root.data || root.payment || root);
  return pickString(t.id, t.transaction_id, t.payment_id, root.transaction_id, root.payment_id, root.id);
}

export function extractExternalId(data: unknown): string {
  const root = asRecord(data);
  const t = asRecord(root.transaction || asRecord(root.data).transaction || root.data || root.payment || root);
  return pickString(t.external_id, root.external_id, t.metadata && asRecord(t.metadata).external_id);
}

export function paidFromPayload(payload: unknown): boolean {
  const root = asRecord(payload);
  const t = asRecord(root.transaction || asRecord(root.data).transaction || root.data || root.payment || root);
  const raw = pickString(t.status, root.status, asRecord(root.data).status).toLowerCase();
  if (["paid", "approved", "completed", "confirmed", "pago", "aprovado"].includes(raw)) return true;
  if (t.paid === true || root.paid === true) return true;
  return Boolean(t.paid_at || root.paid_at || t.approved_at || root.approved_at || t.paidAt || root.paidAt);
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as unknown) : {};
  } catch {
    return { raw: text };
  }
}

export async function createNexusPagCharge(input: {
  apiKey: string;
  amountReais: number;
  description: string;
  externalId: string;
  webhookUrl?: string;
  baseUrl?: string;
}): Promise<PixCharge> {
  const base = (input.baseUrl || "https://nexuspag.com").replace(/\/$/, "");
  const body: Record<string, unknown> = {
    amount: Number(input.amountReais.toFixed(2)),
    description: input.description,
    external_id: input.externalId
  };
  if (input.webhookUrl) body.webhook_url = input.webhookUrl;

  const response = await fetch(`${base}/api/pix/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": input.apiKey
    },
    body: JSON.stringify(body)
  });
  const data = await readJson(response);
  if (!response.ok) {
    const err = asRecord(data);
    throw new Error(String(err.message || err.error || `NexusPag HTTP ${response.status}`));
  }

  const brCode = extractPixCode(data);
  const id = extractPixId(data) || input.externalId;
  if (!brCode) throw new Error("NexusPag: resposta sem PIX copia e cola.");

  return {
    id,
    externalId: extractExternalId(data) || input.externalId,
    brCode,
    qrCodeBase64: pickString(asRecord(data).qr_code_base64, asRecord(asRecord(data).transaction).qr_code_base64),
    status: pickString(asRecord(data).status, "pending") || "pending",
    gateway: "nexuspag",
    raw: data
  };
}

export async function checkNexusPagStatus(input: {
  apiKey: string;
  chargeId?: string;
  externalId?: string;
  baseUrl?: string;
}): Promise<{ paid: boolean; status: string; raw: unknown }> {
  const base = (input.baseUrl || "https://nexuspag.com").replace(/\/$/, "");
  const headers = {
    Accept: "application/json",
    "x-api-key": input.apiKey
  };
  const id = String(input.chargeId || "").trim();
  const externalId = String(input.externalId || "").trim();
  const urls = [
    id ? `${base}/api/pix/status/${encodeURIComponent(id)}` : "",
    id ? `${base}/api/pix/${encodeURIComponent(id)}` : "",
    id ? `${base}/api/pix/consult/${encodeURIComponent(id)}` : "",
    id ? `${base}/api/pix/status?id=${encodeURIComponent(id)}` : "",
    id ? `${base}/api/pix/status?transaction_id=${encodeURIComponent(id)}` : "",
    externalId ? `${base}/api/pix/status?external_id=${encodeURIComponent(externalId)}` : "",
    externalId ? `${base}/api/pix/consult?external_id=${encodeURIComponent(externalId)}` : ""
  ].filter(Boolean);

  let lastRaw: unknown = {};
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: "GET", headers });
      const data = await readJson(response);
      lastRaw = data;
      if (!response.ok) continue;
      const paid = paidFromPayload(data);
      const status = pickString(asRecord(data).status, asRecord(asRecord(data).transaction).status, paid ? "paid" : "pending");
      return { paid, status, raw: data };
    } catch {
      // tenta próxima rota
    }
  }
  return { paid: false, status: "unknown", raw: lastRaw };
}

export async function createWiinPayCharge(input: {
  apiKey: string;
  amountReais: number;
  description: string;
  name: string;
  email: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
  baseUrl?: string;
}): Promise<PixCharge> {
  if (input.amountReais < 3) {
    throw new Error("WiinPay: valor mínimo é R$ 3,00.");
  }
  const base = (input.baseUrl || "https://api-v2.wiinpay.com.br").replace(/\/$/, "");
  const body: Record<string, unknown> = {
    api_key: input.apiKey,
    value: Number(input.amountReais.toFixed(2)),
    name: input.name || "Cliente",
    email: input.email || "cliente@email.com",
    description: input.description,
    webhook_url: input.webhookUrl || "https://example.com/webhook",
    metadata: input.metadata || {}
  };

  const response = await fetch(`${base}/payment/create`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await readJson(response);
  if (!response.ok && response.status !== 201) {
    const err = asRecord(data);
    throw new Error(String(err.message || err.error || `WiinPay HTTP ${response.status}`));
  }

  const brCode = extractPixCode(data);
  const id = extractPixId(data);
  if (!brCode) throw new Error("WiinPay: resposta sem PIX copia e cola.");
  if (!id) throw new Error("WiinPay: resposta sem paymentId.");

  return {
    id,
    externalId: extractExternalId(data) || String(asRecord(input.metadata).external_id || id),
    brCode,
    qrCodeBase64: pickString(asRecord(data).qr_code_base64),
    status: pickString(asRecord(data).status, "pending") || "pending",
    gateway: "wiinpay",
    raw: data
  };
}

export async function checkWiinPayStatus(input: {
  apiKey: string;
  chargeId: string;
  baseUrl?: string;
}): Promise<{ paid: boolean; status: string; raw: unknown }> {
  const base = (input.baseUrl || "https://api-v2.wiinpay.com.br").replace(/\/$/, "");
  const response = await fetch(`${base}/payment/list/${encodeURIComponent(input.chargeId)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.apiKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) {
    const err = asRecord(data);
    throw new Error(String(err.message || err.error || `WiinPay status HTTP ${response.status}`));
  }
  const paid = paidFromPayload(data);
  const status = pickString(asRecord(data).status, asRecord(asRecord(data).payment).status, paid ? "paid" : "pending");
  return { paid, status, raw: data };
}

export async function createLaranjinhaCharge(input: {
  apiKey: string;
  amountCents: number;
  description: string;
  baseUrl?: string;
}): Promise<PixCharge> {
  const { createLaranjinhaCharge: legacy } = await import("./laranjinha.js");
  const charge = await legacy({
    apiKey: input.apiKey,
    amountCents: input.amountCents,
    description: input.description
  });
  return {
    id: charge.id,
    externalId: charge.id,
    brCode: charge.brCode,
    qrCodeBase64: charge.qrCodeBase64,
    status: charge.status,
    gateway: "laranjinha",
    raw: charge
  };
}

export async function createGatewayPixCharge(input: {
  gateway: Exclude<PixGatewayId, "pix">;
  apiKey: string;
  amountCents: number;
  description: string;
  externalId: string;
  payerName?: string;
  payerEmail?: string;
  webhookUrl?: string;
}): Promise<PixCharge> {
  const amountReais = input.amountCents / 100;
  if (input.gateway === "nexuspag") {
    return createNexusPagCharge({
      apiKey: input.apiKey,
      amountReais,
      description: input.description,
      externalId: input.externalId,
      webhookUrl: input.webhookUrl
    });
  }
  if (input.gateway === "wiinpay") {
    return createWiinPayCharge({
      apiKey: input.apiKey,
      amountReais,
      description: input.description,
      name: input.payerName || "Cliente WhatsApp",
      email: input.payerEmail || "cliente@zapmanager.app",
      webhookUrl: input.webhookUrl,
      metadata: { external_id: input.externalId }
    });
  }
  return createLaranjinhaCharge({
    apiKey: input.apiKey,
    amountCents: input.amountCents,
    description: input.description
  });
}

export async function checkGatewayPixStatus(input: {
  gateway: Exclude<PixGatewayId, "pix">;
  apiKey: string;
  chargeId: string;
  externalId?: string;
}): Promise<{ paid: boolean; status: string; raw: unknown }> {
  if (input.gateway === "nexuspag") {
    return checkNexusPagStatus({
      apiKey: input.apiKey,
      chargeId: input.chargeId,
      externalId: input.externalId
    });
  }
  if (input.gateway === "wiinpay") {
    return checkWiinPayStatus({ apiKey: input.apiKey, chargeId: input.chargeId });
  }
  // Laranjinha: sem status unificado — webhook/comprovante
  return { paid: false, status: "unsupported", raw: {} };
}
