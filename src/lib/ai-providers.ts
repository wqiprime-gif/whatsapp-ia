export type AIProviderId = "openai" | "openrouter" | "deepseek" | "gemini" | "anthropic";

export const AI_PROVIDERS: Record<
  AIProviderId,
  { label: string; baseURL?: string; defaultModel: string; keyHint: string; docsUrl?: string }
> = {
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    keyHint: "sk-proj-..."
  },
  openrouter: {
    label: "OpenRouter (modelos grátis)",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/free",
    keyHint: "sk-or-v1-...",
    docsUrl: "https://openrouter.ai/docs/guides/overview/models"
  },
  deepseek: {
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    keyHint: "sk-..."
  },
  gemini: {
    label: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.0-flash",
    keyHint: "AIza..."
  },
  anthropic: {
    label: "Anthropic Claude",
    defaultModel: "claude-3-5-haiku-latest",
    keyHint: "sk-ant-..."
  }
};

/** Modelos gratuitos populares no OpenRouter — https://openrouter.ai/models */
export const OPENROUTER_FREE_MODELS = [
  { id: "openrouter/free", label: "OpenRouter Free (roteador automático)" },
  { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash (grátis)" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (grátis)" },
  { id: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen 2.5 72B (grátis)" },
  { id: "microsoft/phi-3-mini-128k-instruct:free", label: "Phi-3 Mini (grátis)" },
  { id: "mistralai/mistral-7b-instruct:free", label: "Mistral 7B (grátis)" }
] as const;

export function normalizeAIProvider(value?: string | null): AIProviderId {
  if (value && value in AI_PROVIDERS) return value as AIProviderId;
  return "openai";
}

export function openRouterDefaultHeaders(siteUrl?: string) {
  return {
    "HTTP-Referer": siteUrl || "https://zapmanager.app",
    "X-Title": "ZapManager"
  };
}
