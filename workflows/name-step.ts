import { generateObject } from "ai";
import { z } from "zod";

const nameSchema = z.object({
  alchemistName: z
    .string()
    .describe(
      "A short, creative name for your alchemist character (1-3 words max)"
    ),
});

export type UsageData = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  durationMs: number;
};

export type NameResult = {
  name: string;
  success: boolean;
  error?: string;
  usage?: UsageData;
};

export async function chooseAlchemistName(
  modelId: string
): Promise<NameResult> {
  "use step";

  const prompt = `You are about to play "The Alchemist", a competitive potion trading game.

Choose a memorable name for your alchemist character. Be creative! Examples: "Zephyr", "Old Magnus", "Lady Nightshade", "The Toad"

Keep it short (1-3 words). No full sentences. 

Respond ONLY with a json object containing the alchemistName. Example: {"alchemistName": "Zephyr"}
`;

  const startTime = Date.now();

  try {
    const { object, usage } = await generateObject({
      model: modelId,
      schema: nameSchema,
      prompt,
      mode: "json",
    });

    const durationMs = Date.now() - startTime;

    // Sanitize: trim, remove special chars, crop to reasonable length for UI
    let name = object.alchemistName?.trim() || "";
    name = name.replace(/[^\w\s'-]/g, "").trim();
    // Take first 25 chars to keep UI clean
    name = name.slice(0, 25);

    if (!name || name.length < 2) {
      name = "Unnamed";
    }

    // AI SDK LanguageModelV2Usage has inputTokens/outputTokens
    const inputTokens = usage?.inputTokens || 0;
    const outputTokens = usage?.outputTokens || 0;
    const totalTokens = usage?.totalTokens || inputTokens + outputTokens;

    console.log(
      `[Name] ${modelId} → "${name}" (${durationMs}ms, ${inputTokens}in/${outputTokens}out tokens)`
    );

    return {
      name,
      success: true,
      usage: {
        inputTokens,
        outputTokens,
        reasoningTokens: 0,
        totalTokens,
        durationMs,
      },
    };
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;

    // Extract useful info from AI_NoObjectGeneratedError
    const err = error as {
      name?: string;
      message?: string;
      text?: string;
      finishReason?: string;
      cause?: Error;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
    };

    console.error(`[Name] ✗ ${modelId} FAILED (${durationMs}ms)`);
    console.error(`[Name]   reason: ${err.finishReason || "unknown"}`);
    console.error(`[Name]   raw text: ${err.text || "none"}`);
    if (err.cause) {
      console.error(`[Name]   cause: ${err.cause.message || err.cause}`);
    }

    const errorMsg = err.message || "Unknown error";
    return {
      name: "[DISQUALIFIED]",
      success: false,
      error: `${err.finishReason || "error"}: ${errorMsg.slice(0, 100)}`,
      usage: {
        inputTokens: err.usage?.inputTokens || 0,
        outputTokens: err.usage?.outputTokens || 0,
        reasoningTokens: 0,
        totalTokens: err.usage?.totalTokens || 0,
        durationMs,
      },
    };
  }
}
