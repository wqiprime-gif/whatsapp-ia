import OpenAI from "openai";
import { AI_PROVIDERS, normalizeAIProvider, type AIProviderId } from "./ai-providers.js";
import { getAIProvider, getOpenAIApiKey, getOpenAIModel } from "./settings.js";

type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

async function anthropicCompletion(apiKey: string, params: ChatParams) {
  const system = params.messages.find((m) => m.role === "system");
  const messages = params.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
    }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.max_tokens ?? 1024,
      temperature: params.temperature,
      system: typeof system?.content === "string" ? system.content : undefined,
      messages
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";

  return {
    choices: [{ message: { role: "assistant" as const, content: text, refusal: null }, finish_reason: "stop" as const }],
    model: params.model,
    object: "chat.completion" as const,
    created: Math.floor(Date.now() / 1000),
    id: "anthropic-" + Date.now(),
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  } as OpenAI.Chat.Completions.ChatCompletion;
}

export async function createChatCompletion(userId: string, params: Omit<ChatParams, "model"> & { model?: string }) {
  const provider = normalizeAIProvider(await getAIProvider(userId));
  const model = params.model || (await getOpenAIModel(userId)) || AI_PROVIDERS[provider].defaultModel;
  const apiKey = await getOpenAIApiKey(userId);
  const fullParams = { ...params, model } as ChatParams;

  if (provider === "anthropic") {
    return anthropicCompletion(apiKey, fullParams);
  }

  const cfg = AI_PROVIDERS[provider];
  const client = new OpenAI({
    apiKey,
    baseURL: cfg.baseURL
  });
  return client.chat.completions.create(fullParams);
}

export async function getOpenAIClient(userId: string, provider?: AIProviderId) {
  const p = provider ?? normalizeAIProvider(await getAIProvider(userId));
  const apiKey = await getOpenAIApiKey(userId);

  if (p === "anthropic") {
    return {
      chat: {
        completions: {
          create: (params: ChatParams) => anthropicCompletion(apiKey, params)
        }
      }
    } as unknown as OpenAI;
  }

  const cfg = AI_PROVIDERS[p];
  return new OpenAI({ apiKey, baseURL: cfg.baseURL });
}
