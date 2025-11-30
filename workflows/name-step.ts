import { generateObject } from "ai";
import { z } from "zod";

const nameSchema = z.object({
  alchemistName: z
    .string()
    .describe(
      "A short, creative name for your alchemist character (1-3 words max)"
    ),
});

export type NameResult = {
  name: string;
  success: boolean;
  error?: string;
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

  try {
    const { object } = await generateObject({
      model: modelId,
      schema: nameSchema,
      prompt,
      maxOutputTokens: 50,
    });

    // Sanitize: trim, limit to 20 chars, remove special chars
    let name = object.alchemistName?.trim() || "";
    name = name.replace(/[^\w\s'-]/g, "").trim();
    name = name.slice(0, 20);

    if (!name || name.length < 2) {
      name = "Unnamed";
    }

    console.log(`[Name] ${modelId} → "${name}"`);
    return { name, success: true };
  } catch (error: unknown) {
    // Extract useful info from AI_NoObjectGeneratedError
    const err = error as {
      name?: string;
      message?: string;
      text?: string;
      finishReason?: string;
      cause?: Error;
    };

    console.error(`[Name] ✗ ${modelId} FAILED`);
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
    };
  }
}
