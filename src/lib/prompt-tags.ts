/** Tags que o motor WhatsApp interpreta — guia para clientes montarem o prompt. */
export type PromptTagDoc = {
  tag: string;
  label: string;
  when: string;
  example?: string;
};

export const PROMPT_ACTION_TAGS: PromptTagDoc[] = [
  {
    tag: "[[send_informacoes]]",
    label: "Tabela de pacotes",
    when: "Depois que o lead confirmar que quer ver preços. Nunca na primeira mensagem.",
    example: 'Lead: "quero ver" → você: "peraí amor 😘" + tag'
  },
  {
    tag: "[[send_amostra_gratis]]",
    label: "Prévia gratuita",
    when: "Uma vez por lead. Envia as mídias cadastradas em Prévia gratuita no painel.",
    example: "Lead pede amostra → tag + \"Gostou amor? 😘\""
  },
  {
    tag: "[[send_chave_pix]]",
    label: "Chave Pix",
    when: "Quando o lead quiser comprar. A chave vem do campo Chave Pix — nunca escreva manualmente.",
    example: "Lead escolhe pacote → tag + peça o comprovante"
  },
  {
    tag: "[[naosou_fake]]",
    label: "Prova que é real",
    when: "Lead desconfia de golpe ou fake. Responda com naturalidade no seu tom."
  },
  {
    tag: "[[ignorar_lead]]",
    label: "Parar de responder",
    when: "Lead enrola 6+ mensagens sem comprar, muda de assunto ou é abusivo. Não use se ainda negocia preço."
  },
  {
    tag: "[[pedir_presente]]",
    label: "Pedir presente / mimo",
    when: "Lead demonstra carinho. Configure presentes em Pedir presentes no menu."
  }
];

/** Tags de áudio padrão (seed) — aparecem mesmo antes de cadastrar os próprios. */
export const DEFAULT_AUDIO_TAGS: PromptTagDoc[] = [
  {
    tag: "[[audio:saudacao]]",
    label: "Áudio de saudação",
    when: "No primeiro \"oi\" a saudação já sai em áudio sozinha. Use a tag para repetir em outro momento."
  },
  {
    tag: "[[audio:informacoes]]",
    label: "Áudio dos pacotes",
    when: "Explica os pacotes em voz. Mande junto com [[send_informacoes]]."
  },
  {
    tag: "[[audio:qual_pack]]",
    label: "Áudio: qual pacote?",
    when: "Pergunta em voz qual pacote o lead quer."
  },
  {
    tag: "[[audio:chave_pix]]",
    label: "Áudio do Pix",
    when: "Na hora de passar o pagamento. Mande junto com [[send_chave_pix]]."
  },
  {
    tag: "[[audio:nao_sou_fake]]",
    label: "Áudio: não sou fake",
    when: "Quando o lead desconfiar de golpe/fake."
  }
];

/** Monta as tags de áudio a partir da biblioteca cadastrada na instância. */
export function audioTagsFromLibrary(
  library: { label: string; slug?: string }[] = []
): PromptTagDoc[] {
  const docs = library
    .map((a) => {
      const slug = (a.slug || a.label || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      if (!slug) return null;
      return {
        tag: `[[audio:${slug}]]`,
        label: a.label || slug,
        when: "Envia este áudio como nota de voz."
      } as PromptTagDoc;
    })
    .filter((d): d is PromptTagDoc => Boolean(d));
  return docs.length ? docs : DEFAULT_AUDIO_TAGS;
}

export const PROMPT_TAGS_HINT =
  "Monte seu prompt com texto livre e cole as tags onde a IA deve disparar uma ação automática.";

export const PROMPT_EFFECTIVE_HINT =
  "O sistema adiciona automaticamente: chave Pix real, regras de negociacao (so apos escolher pacote), presentes cadastrados e estado da conversa.";
