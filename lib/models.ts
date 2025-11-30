// Available AI models for player selection
export const AI_MODELS = [
  // OpenAI - Leading & Fast
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "OpenAI",
    tier: "leading",
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "OpenAI",
    tier: "fast",
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "OpenAI",
    tier: "cheap",
  },

  // Anthropic - Leading & Fast
  {
    id: "anthropic/claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    tier: "leading",
  },
  {
    id: "anthropic/claude-haiku-4",
    name: "Claude Haiku 4",
    provider: "Anthropic",
    tier: "fast",
  },

  // xAI - Leading & Fast
  { id: "xai/grok-3", name: "Grok 3", provider: "xAI", tier: "leading" },
  { id: "xai/grok-3-fast", name: "Grok 3 Fast", provider: "xAI", tier: "fast" },

  // DeepSeek - Cheap/Fast
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek Chat",
    provider: "DeepSeek",
    tier: "cheap",
  },
  {
    id: "deepseek/deepseek-reasoner",
    name: "DeepSeek Reasoner",
    provider: "DeepSeek",
    tier: "leading",
  },

  // Google Gemini - Leading & Fast
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    tier: "leading",
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    tier: "fast",
  },
] as const;

export type AIModel = (typeof AI_MODELS)[number];
