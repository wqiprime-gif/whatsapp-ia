import { parseAudioTags } from "./named-audio.js";

import type { Product } from "../db/events.js";
import { priceTableFromProducts, videoCallPriceTableFromProducts } from "./product-catalog.js";

export type PromptAction =
  | "send_informacoes"
  | "send_chamada_video"
  | "send_amostra_gratis"
  | "send_chave_pix"
  | "naosou_fake"
  | "ignorar_lead"
  | "pedir_presente";

const ACTION_RE =
  /\[\[(send_informacoes|send_chamada_video|send_amostra_gratis|send_chave_pix|naosou_fake|ignorar_lead|pedir_presente)\]\]/gi;

const GIFT_TAG_RE = /\[\[pedir_presente(?::([a-z0-9_]+))?\]\]/gi;

export function parsePromptActions(text: string) {
  const actions: PromptAction[] = [];
  let giftSlug: string | undefined;
  const audioSlugs = parseAudioTags(text);
  let clean = text.replace(GIFT_TAG_RE, (_, slug) => {
    actions.push("pedir_presente");
    if (slug) giftSlug = slug.toLowerCase();
    return "";
  });
  clean = clean
    .replace(ACTION_RE, (_, tag) => {
      actions.push(tag.toLowerCase() as PromptAction);
      return "";
    })
    .replace(/\[\[audio:([a-z0-9_]+)\]\]|\[\[audio_([a-z0-9_]+)\]\]/gi, "")
    .trim();
  return { clean, actions: [...new Set(actions)], audioSlugs, giftSlug };
}

export function priceTableMessage(products: Product[] = []) {
  return priceTableFromProducts(products);
}

export function videoCallPriceTableMessage(products: Product[] = []) {
  return videoCallPriceTableFromProducts(products);
}

export function naosouFakeMessage() {
  return "relaxa amor, sou real sim 😘 mando tudo certinho depois do pix, sem golpe";
}

export const PROMPT_ACTION_HINT = `
ACOES (tag na ultima linha quando precisar):
[[send_informacoes]] = tabela de precos (lead confirmou que quer ver)
[[send_chamada_video]] = audio da chamada + tabela so de videochamada (quando perguntar se faz chamada)
[[send_amostra_gratis]] = previa gratis (UMA vez por lead)
[[naosou_fake]] = mesmo que [[audio:nao_sou_fake]] se existir no cadastro
[[ignorar_lead]] = parar de responder lead enrolado
[[pedir_presente]] = pedir um presente/mimo ao lead (use quando fizer sentido no fluxo)
[[pedir_presente:slug]] = pedir presente especifico cadastrado no painel

INPUTS DE AUDIO (como Pix — use SOMENTE no momento certo, nao toda hora):
- No seu prompt: "se lead desconfiar use [[audio:nao_sou_fake]]"
- Quando fizer sentido, coloque a tag [[audio:slug]] na resposta (pode ser so a tag).
- NUNCA audio em "oi amor", tabela, preco, flerte.
- Maximo 2 frases se for texto. Nunca diga que e IA/bot.
`.trim();
