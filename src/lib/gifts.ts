export type GiftItem = {
  /** Nome do presente (ex: Pix de R$ 10) */
  name: string;
  /** ID no prompt: [[pedir_presente:pix_10]] */
  slug?: string;
  /** Mensagem que o bot envia pedindo esse presente */
  askMessage: string;
};

export function parseGiftItems(value: unknown): GiftItem[] {
  if (!value) return [];
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const name = String(item?.name ?? "").trim();
      const slugRaw = String(item?.slug ?? "").trim();
      const askMessage = String(item?.askMessage ?? item?.message ?? "").trim();
      return {
        name,
        slug: slugRaw || undefined,
        askMessage: askMessage || name
      };
    })
    .filter((item) => item.name);
}

export function giftSlugFromName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

export function giftsPromptHint(items: GiftItem[], customPrompt = "") {
  const lines = items.map((g) => {
    const slug = g.slug || giftSlugFromName(g.name);
    return `- ${g.name} → [[pedir_presente:${slug}]]`;
  });
  const base = [
    "PEDIR PRESENTES (quando lead demonstrar carinho, pedir mimo ou após venda):",
    customPrompt.trim() || "Use com naturalidade, sem parecer cobrança agressiva.",
    lines.length ? "Presentes cadastrados:\n" + lines.join("\n") : "Nenhum presente cadastrado no painel.",
    "Tag: [[pedir_presente]] = sorteia um presente | [[pedir_presente:slug]] = presente específico."
  ];
  return base.join("\n");
}

export function pickGiftMessage(items: GiftItem[], slug?: string) {
  if (!items.length) return null;
  if (slug) {
    const found = items.find((g) => (g.slug || giftSlugFromName(g.name)) === slug);
    return found?.askMessage ?? null;
  }
  const pick = items[Math.floor(Math.random() * items.length)];
  return pick?.askMessage ?? null;
}
