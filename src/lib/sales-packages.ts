import type OpenAI from "openai";
import type { PackageId } from "./lead-state.js";
import { explicitPackageIdInText } from "./package-selection.js";

export const PACKAGES = {
  basico: { label: "Pacote Basico", price: 9.9, minimum: 5, desc: "50 fotos e videos" },
  chamada: { label: "Chamada Video", price: 15, minimum: 10, desc: "5 min no zap" },
  completo: { label: "Pacote Completo", price: 20, minimum: 15, desc: "chamada + pack" }
} as const;

/** Só retorna pacote se mencionado explicitamente — sem default. */
export function detectPackageFromHistory(
  history: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): PackageId | undefined {
  const userText = history
    .filter((m) => m.role === "user" && typeof m.content === "string")
    .map((m) => m.content as string)
    .slice(-8)
    .join(" ");

  return explicitPackageIdInText(userText) ?? undefined;
}

export function parseOfferReais(text: string): number | null {
  const m = text.match(/r?\$?\s*(\d{1,3})(?:[,.](\d{2}))?/i);
  if (!m) return null;
  const whole = Number(m[1]);
  const cents = m[2] ? Number(m[2]) : 0;
  if (Number.isNaN(whole)) return null;
  return whole + cents / 100;
}

export function inferPackageFromOffer(amount: number): PackageId {
  if (amount >= 16) return "completo";
  if (amount >= 10) return "chamada";
  return "basico";
}

export function negotiationReply(input: {
  text: string;
  selected?: PackageId;
  requirePackage?: boolean;
}): string | null {
  const amount = parseOfferReais(input.text);
  if (amount === null) return null;
  if (!/(r\$|\d+[,.]?\d*|reais|tenho|consigo|pago|ofereço|ofereco)/i.test(input.text)) {
    return null;
  }

  if (input.requirePackage && !input.selected) return null;

  const pkg = input.selected ?? inferPackageFromOffer(amount);
  const p = PACKAGES[pkg];

  if (amount >= p.minimum) {
    const formatted = amount.toFixed(2).replace(".", ",");
    return `dessa vez consigo fazer por R$ ${formatted} sim, manda o pix 😘`;
  }
  const min = p.minimum.toFixed(2).replace(".", ",");
  return `por esse valor nao da nao amor, o minimo que consigo fazer e R$ ${min}`;
}

export function lowOfferBasicoHint(amount: number) {
  if (amount >= 5 && amount < 9.9) {
    return "por R$5 consigo te mandar o pacote basico (50 fotos e videos), pode ser?";
  }
  return null;
}

export function minimumForPackage(pkg: PackageId) {
  return PACKAGES[pkg].minimum;
}
