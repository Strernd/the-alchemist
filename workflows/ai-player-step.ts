import {
  HerbId,
  PlayerInputs,
  PlayerOutputs,
  playerOutputsSchema,
  PotionId,
} from "@/lib/types";
import { generateObject } from "ai";
import {
  formatInventory,
  getCraftableWithCurrentHerbs,
  getCraftingOpportunities,
  PLAYER_SYSTEM_PROMPT,
  summarizeDemand,
} from "./prompts";

export type PlayerStepResult = {
  outputs: PlayerOutputs;
  success: boolean;
  error?: string;
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

  // Skip disqualified players - return empty outputs
  if (isDisqualified) {
    return { outputs: EMPTY_OUTPUTS, success: true };
  }

  const craftableNow = getCraftableWithCurrentHerbs(inputs.inventory.herbs);
  const craftingOpps = getCraftingOpportunities(
    inputs.inventory.silver,
    inputs.dailyPrices,
    inputs.inventory.herbs
  );

  const existingPotions = Object.entries(inputs.inventory.potions)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${id}:${qty}`)
    .join(", ");

  const userPrompt = `Day ${inputs.meta.currentDay}/${
    inputs.meta.totalDays
  } | ${inputs.meta.playCount} players | ${inputs.inventory.silver}g

INVENTORY: ${formatInventory(inputs.inventory)}

CRAFTING (cost sorted):
${craftingOpps}

POTIONS TO SELL: ${existingPotions || "None"}
CRAFTABLE NOW: ${craftableNow}

MARKET: ${summarizeDemand(inputs.historicDemands)}
${
  inputs.yesterdaysErrors.length > 0
    ? `ERRORS: ${inputs.yesterdaysErrors.join("; ")}`
    : ""
}
${
  inputs.yesterdaysExecutedOffers.length > 0
    ? `SALES: ${inputs.yesterdaysExecutedOffers
        .map((o) => `${o.potionId}:${o.actuallySold}/${o.qty}@${o.price}g`)
        .join(", ")}`
    : ""
}
${
  inputs.meta.currentDay === inputs.meta.totalDays
    ? "FINAL DAY - sell everything!"
    : ""
}
`;

  console.log("Prompting model:", modelId);

  try {
    const { object } = await generateObject({
      model: modelId,
      schema: playerOutputsSchema,
      system: PLAYER_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 1500,
    });

    const sanitized = sanitizeAIResponse(object);
    console.log("Model response sanitized:", sanitized);

    return { outputs: sanitized, success: true };
  } catch (error: unknown) {
    // Extract useful info from AI_NoObjectGeneratedError
    const err = error as {
      name?: string;
      message?: string;
      text?: string;
      finishReason?: string;
      cause?: Error;
    };

    console.error(`[Step] ✗ ${modelId} FAILED`);
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
