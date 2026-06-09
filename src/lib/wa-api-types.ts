export type WaApiProvider = "whatsapp_web" | "meta_cloud";

export const WA_API_OPTIONS: { id: WaApiProvider; label: string; hint: string }[] = [
  {
    id: "whatsapp_web",
    label: "WhatsApp Web (whatsapp-web.js)",
    hint: "QR Code no celular · Puppeteer · ideal para testes e VPS com disco"
  },
  {
    id: "meta_cloud",
    label: "API oficial Meta (Cloud API)",
    hint: "Token permanente · webhook · recomendado para produção e Railway"
  }
];

export function waApiLabel(provider: WaApiProvider | undefined) {
  return WA_API_OPTIONS.find((o) => o.id === provider)?.label ?? "WhatsApp Web";
}

export function parseWaApiProvider(value: unknown): WaApiProvider {
  return value === "meta_cloud" ? "meta_cloud" : "whatsapp_web";
}
