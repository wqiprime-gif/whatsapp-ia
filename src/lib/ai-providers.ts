export type AIProviderId = "openai" | "deepseek" | "gemini" | "anthropic";

export const AI_PROVIDERS: Record<
  AIProviderId,
  { label: string; baseURL?: string; defaultModel: string; keyHint: string }
> = {
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    keyHint: "sk-proj-..."
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

export function normalizeAIProvider(value?: string | null): AIProviderId {
  if (value && value in AI_PROVIDERS) return value as AIProviderId;
  return "openai";
}
