export type BotLocale = "pt-BR" | "en-US";

const PT = {
  pixNotConfigured: "\n\n[PIX NÃO CONFIGURADO — configure a chave Pix no painel da instância.]",
  priceTableTitle: "💎 *MEUS PACOTES* 💎",
  priceTableAsk: "Qual pacote te interessa, amor? 💕",
  videoCallTitle: "📹 *CHAMADA DE VÍDEO* 📹",
  currencySymbol: "R$",
  whisperLang: "pt" as const
};

const EN = {
  pixNotConfigured: "\n\n[PIX NOT CONFIGURED — set your Pix key in the instance panel.]",
  priceTableTitle: "💎 *MY PACKS* 💎",
  priceTableAsk: "Which pack do you want, babe? 💕",
  videoCallTitle: "📹 *VIDEO CALL* 📹",
  currencySymbol: "$",
  whisperLang: "en" as const
};

export function getBotMessages(locale?: string) {
  return locale === "en-US" ? EN : PT;
}

export function formatMoney(cents: number, locale?: string) {
  const m = getBotMessages(locale);
  const value = (cents / 100).toFixed(2);
  if (locale === "en-US") return `${m.currencySymbol}${value}`;
  return `${m.currencySymbol} ${value.replace(".", ",")}`;
}
