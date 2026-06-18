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
    tag: "[[chamada_video]]",
    label: "Chamada de vídeo",
    when: "Lead pergunta como funciona a chamada. Explica que é aqui no WhatsApp, 5 min, após pagamento."
  },
  {
    tag: "[[naosou_fake]]",
    label: "Prova que é real",
    when: "Lead desconfia de golpe ou fake. Pode usar áudio [[audio:nao_sou_fake]] se cadastrado."
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
  },
  {
    tag: "[[audio:slug]]",
    label: "Áudio nomeado",
    when: "Substitua slug pelo nome do áudio na biblioteca. Ex: [[audio:nao_sou_fake]]"
  }
];

export const PROMPT_TAGS_HINT =
  "Monte seu prompt com texto livre e cole as tags onde a IA deve disparar uma ação automática.";
