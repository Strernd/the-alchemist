import {
  HerbId,
  PlayerInputs,
  PlayerOutputs,
  playerOutputsSchema,
  PotionId,
} from "@/lib/types";
import { generateObject } from "ai";
import { UsageData } from "./name-step";
import {
  formatActionHistory,
  formatHistoricalHerbPrices,
  formatInventory,
  formatYesterdayMarket,
  PLAYER_SYSTEM_PROMPT,
} from "./prompts";

export type PlayerStepResult = {
  outputs: PlayerOutputs;
  success: boolean;
  error?: string;
  usage?: UsageData;
  reasoning?: string; // AI's reasoning/thinking process if available
};

const EMPTY_OUTPUTS: PlayerOutputs = {
  buyHerbs: [],
  makePotions: [],
  potionOffers: [],
};

export async function aiPlayerStep(
  inputs: PlayerInputs,
  modelId: string,
  isDisqualified: boolean
): Promise<PlayerStepResult> {
  "use step";

  // Skip disqualified players - return empty outputs with no usage
  if (isDisqualified) {
    return { outputs: EMPTY_OUTPUTS, success: true };
  }

  // Build action history section
  const historySection = formatActionHistory(inputs.actionHistory, 3);

  const userPrompt = `Day ${inputs.meta.currentDay}/${
    inputs.meta.totalDays
  } | ${inputs.meta.playCount} players competing
${
  inputs.meta.currentDay === inputs.meta.totalDays
    ? "\n⚠ FINAL DAY - sell everything! Unsold inventory has no value after the game ends.\n"
    : ""
}
=== YOUR INVENTORY ===
What you currently own. Use this to decide what to buy, craft, and sell.
${formatInventory(inputs.inventory)}

=== HERB PRICES ===
Price history for each herb. Format: past prices → today's price. Use this to spot good deals.
${formatHistoricalHerbPrices(inputs.actionHistory, inputs.dailyPrices)}

=== YOUR PAST DECISIONS ===
Your actions from previous days and their results. Learn from what worked and what didn't.
${historySection || "Day 1 - no history yet"}

=== YESTERDAY'S MARKET ===
Trading activity for ALL potions yesterday. Shows total offered by all players, how many sold, and price range of sales.
${formatYesterdayMarket(inputs.historicMarkets)}
`;

  const startTime = Date.now();
  console.log(userPrompt);

  try {
    const { object, usage, reasoning } = await generateObject({
      model: modelId,
      schema: playerOutputsSchema,
      system: PLAYER_SYSTEM_PROMPT,
      prompt: userPrompt,
      mode: "json",
    });

    const durationMs = Date.now() - startTime;
    const sanitized = sanitizeAIResponse(object);

    // AI SDK LanguageModelV2Usage has inputTokens/outputTokens
    const inputTokens = usage?.inputTokens || 0;
    const outputTokens = usage?.outputTokens || 0;
    // Reasoning tokens are included in some models (like o1, Claude thinking)
    const reasoningTokens =
      (usage as { reasoningTokens?: number })?.reasoningTokens || 0;
    const totalTokens = usage?.totalTokens || inputTokens + outputTokens;

    console.log(
      `[Step] ${modelId} day ${
        inputs.meta.currentDay
      }: ${durationMs}ms, ${inputTokens}in/${outputTokens}out${
        reasoningTokens ? `/${reasoningTokens}reasoning` : ""
      } tokens`
    );
    if (reasoning) {
      console.log(
        `[Step] Reasoning (${reasoning.length} chars): ${reasoning.slice(
          0,
          200
        )}...`
      );
    }

    return {
      outputs: sanitized,
      success: true,
      reasoning: reasoning || undefined,
      usage: {
        inputTokens,
        outputTokens,
        reasoningTokens,
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

    console.error(`[Step] ✗ ${modelId} FAILED (${durationMs}ms)`);
    console.error(`[Step]   reason: ${err.finishReason || "unknown"}`);
    console.error(`[Step]   raw text: ${err.text?.slice(0, 200) || "none"}`);
    if (err.cause) {
      console.error(`[Step]   cause: ${err.cause.message || err.cause}`);
    }

    const errorMsg = err.message || "Unknown error";
    const errorResult = `${err.finishReason || "error"}: ${errorMsg.slice(
      0,
      100
    )}`;
    console.log(`[Step] Returning failure result with error: ${errorResult}`);

    return {
      outputs: EMPTY_OUTPUTS,
      success: false,
      error: errorResult,
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

// Pre-validate AI response to catch obvious mistakes
function sanitizeAIResponse(response: {
  buyHerbs: { herbId: string; qty: number }[];
  makePotions: { potionId: string; qty: number }[];
  potionOffers: { potionId: string; price: number; qty: number }[];
}): PlayerOutputs {
  const validHerbIds = new Set([
    "H01",
    "H02",
    "H03",
    "H04",
    "H05",
    "H06",
    "H07",
    "H08",
    "H09",
    "H10",
    "H11",
    "H12",
  ]);
  const validPotionIds = new Set([
    "P01",
    "P02",
    "P03",
    "P04",
    "P05",
    "P06",
    "P07",
    "P08",
    "P09",
    "P10",
    "P11",
    "P12",
    "P13",
    "P14",
    "P15",
    "P16",
    "P17",
    "P18",
  ]);

  const buyHerbs = (response.buyHerbs || [])
    .filter((h) => validHerbIds.has(h.herbId) && h.qty > 0)
    .map((h) => ({
      herbId: h.herbId as HerbId,
      qty: Math.max(0, Math.floor(h.qty)),
    }));

  const makePotions = (response.makePotions || [])
    .filter((p) => validPotionIds.has(p.potionId) && p.qty > 0)
    .map((p) => ({
      potionId: p.potionId as PotionId,
      qty: Math.max(0, Math.floor(p.qty)),
    }));

  const potionOffers = (response.potionOffers || [])
    .filter((p) => validPotionIds.has(p.potionId) && p.qty > 0 && p.price > 0)
    .map((p) => ({
      potionId: p.potionId as PotionId,
      price: Math.max(1, Math.floor(p.price)),
      qty: Math.max(0, Math.floor(p.qty)),
    }));

  return { buyHerbs, makePotions, potionOffers };
}
