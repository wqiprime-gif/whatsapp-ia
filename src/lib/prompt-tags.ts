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
    tag: "[[send_apresentacao_produto]]",
    label: "Apresentação do produto",
    when: "Uma vez por lead, cedo no funil — quando demonstrar interesse, ANTES da prévia. Mostra o que recebe após comprar.",
    example: "Lead pergunta o que vem no pack → tag + \"É isso que você recebe amor 😘\""
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
    when: "Lead pergunta como funciona a chamada. Explica que é chamada privada no celular após pagamento."
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

export const PROMPT_TAGS_HINT =
  "Monte seu prompt com texto livre e cole as tags onde a IA deve disparar uma ação automática.";
