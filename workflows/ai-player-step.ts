import { PlayerInputs, playerOutputsSchema } from "@/lib/types";
import { generateObject } from "ai";
import { PLAYER_SYSTEM_PROMPT } from "./prompts";

export async function aiPlayerStep(inputs: PlayerInputs, modelId: string) {
  "use step";

  const userPrompt = `
There are total ${inputs.meta.playCount} players in the game. Today is day ${
    inputs.meta.currentDay
  } of ${inputs.meta.totalDays}.

Your inventory:
Silver: ${inputs.inventory.silver}
Herbs: ${Object.entries(inputs.inventory.herbs)
    .map(([herbId, qty]) => `${herbId}: ${qty}`)
    .join(", ")}
Potions: ${Object.entries(inputs.inventory.potions)
    .map(([potionId, qty]) => `${potionId}: ${qty}`)
    .join(", ")}

Daily herb prices:
${Object.entries(inputs.dailyPrices)
  .map(([herbId, price]) => `${herbId}: ${price}`)
  .join(", ")}

Historic demands:
${inputs.historicDemands
  .map(
    (demands, idx) =>
      `Day ${idx + 1}: ${Object.entries(demands)
        .map(
          ([herbId, demand]) =>
            `${herbId}: ${demand.fulfilled} fulfilled / ${demand.remaining} remaining (highest price: ${demand.highestPrice}, lowest price: ${demand.lowestPrice})`
        )
        .join("\n")}`
  )
  .join("\n")}

Yesterday's errors:
${inputs.yesterdaysErrors.join("\n")}

Yesterday's executed offers:
${inputs.yesterdaysExecutedOffers
  .map(
    (offer) =>
      `${offer.potionId}: ${offer.actuallySold}/${offer.qty} sold at ${offer.price}`
  )
  .join("\n")}

Select your actions for today.
    `;
  console.log("Prompting model: ", modelId);
  console.log(userPrompt);

  try {
    const { object } = await generateObject({
      model: modelId,
      schema: playerOutputsSchema,
      system: PLAYER_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 1000,
    });

    console.log("Model response: ", object);
    return object;
  } catch (error) {
    console.error("Error prompting model: ", error);
    return {
      buyHerbs: [],
      makePotions: [],
      potionOffers: [],
    };
  }
}
