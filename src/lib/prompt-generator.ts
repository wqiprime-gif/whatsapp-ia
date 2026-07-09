import { createChatCompletion } from "./ai-chat.js";
import { PROMPT_ACTION_TAGS } from "./prompt-tags.js";

export type PromptGeneratorInput = {
  personaName: string;
  tone: string;
  niche: string;
  packages: string;
  extraRules?: string;
};

const TAG_LIST = PROMPT_ACTION_TAGS.map((t) => `${t.tag} — ${t.label}: ${t.when}`).join("\n");

export async function generateBotPrompt(userId: string, input: PromptGeneratorInput): Promise<string> {
  const completion = await createChatCompletion(userId, {
    temperature: 0.65,
    max_tokens: 2200,
    messages: [
      {
        role: "system",
        content: `Você cria prompts para bots de vendas no WhatsApp (conteúdo adulto/sensual permitido).
O prompt deve ser em português BR, direto, pronto para colar no painel OnlyChat.
Inclua OBRIGATORIAMENTE as tags de ação quando fizer sentido:
${TAG_LIST}

Regras do prompt gerado:
- Máx 2 frases por mensagem do bot
- Tom humano, nunca robótico
- Nunca dizer que é IA
- Engajar antes de mandar preços
- Prévia só uma vez com [[send_amostra_gratis]]
- Pix com [[send_chave_pix]] nunca escrever chave manual
- Chamada de vídeo: use [[send_chamada_video]] quando perguntarem; após pagamento o sistema avisa que o link sai em 10 min (não na hora)
- Comprovante: não dizer "recebi seu comprovante"
- Follow-up se lead sumir
- Sem menção a áudio ou [[audio:...]]`
      },
      {
        role: "user",
        content: `Crie um prompt completo para esta persona:

Nome/persona: ${input.personaName}
Tom: ${input.tone}
Nicho: ${input.niche}
Pacotes e preços:
${input.packages}
${input.extraRules ? `Regras extras:\n${input.extraRules}` : ""}

Retorne SOMENTE o texto do prompt, sem markdown, sem aspas, sem explicação.`
      }
    ]
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("A IA não retornou um prompt. Verifique a API Key em Configurações.");
  return text;
}
