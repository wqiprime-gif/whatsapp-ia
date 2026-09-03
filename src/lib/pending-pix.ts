export type PendingPixCharge = {
  botId: string;
  chatId: number;
  jid: string;
  platform: "whatsapp" | "telegram";
  gateway: string;
  chargeId: string;
  externalId: string;
  amountCents: number;
  productName: string;
  createdAt: number;
};

const pendingByCharge = new Map<string, PendingPixCharge>();
const pendingByExternal = new Map<string, PendingPixCharge>();

export function rememberPendingPix(charge: PendingPixCharge) {
  pendingByCharge.set(charge.chargeId, charge);
  if (charge.externalId) pendingByExternal.set(charge.externalId, charge);
}

export function takePendingPix(input: { chargeId?: string; externalId?: string }) {
  const byId = input.chargeId ? pendingByCharge.get(input.chargeId) : undefined;
  const byExt = input.externalId ? pendingByExternal.get(input.externalId) : undefined;
  const hit = byId || byExt;
  if (!hit) return null;
  pendingByCharge.delete(hit.chargeId);
  if (hit.externalId) pendingByExternal.delete(hit.externalId);
  return hit;
}

export function getPendingPix(input: { chargeId?: string; externalId?: string }) {
  if (input.chargeId && pendingByCharge.has(input.chargeId)) return pendingByCharge.get(input.chargeId)!;
  if (input.externalId && pendingByExternal.has(input.externalId)) return pendingByExternal.get(input.externalId)!;
  return null;
}
