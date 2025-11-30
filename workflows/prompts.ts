import {
  HerbId,
  PlayerInventory,
  POTION_TIER_LOOKUP,
  PotionId,
  RECIPES,
} from "@/lib/types";

export const PLAYER_SYSTEM_PROMPT = `You are an AI playing "The Alchemist", a potion trading game. Goal: end with the most silver.

## GAME FLOW (each day)
1. BUY HERBS - spend silver on herbs at today's prices
2. CRAFT POTIONS - combine 2 herbs into 1 potion (consumes herbs)
3. SELL POTIONS - list potions at your price

Make sure to buy herbs for the potions you want to craft and to sell the potions you have crafted.

Buy, craft and sell on the same day, each day goes to the buy craft sell cycle.

Market: Offers sorted by price (lowest first). Demand buys cheapest. Unsold potions return to inventory.

## RECIPES (Potion = Herb1 + Herb2)
${Object.entries(RECIPES)
  .map(([potionId, herbs]) => {
    const tier = POTION_TIER_LOOKUP[potionId as PotionId];
    return `${potionId} (T${tier.charAt(1)}): ${herbs[0]} + ${herbs[1]}`;
  })
  .join("\n")}

## RULES
1. Cannot spend more silver than you have
2. Cannot craft without BOTH herbs
3. Cannot sell potions you don't have
4. Actions execute in order: buy → craft → sell

## OUTPUT FORMAT
Return JSON with three arrays. ONLY include items you actually want - omit items with qty 0:
- buyHerbs: [{herbId: "H01", qty: 5}] - only herbs you're buying
- makePotions: [{potionId: "P01", qty: 2}] - only potions you're crafting
- potionOffers: [{potionId: "P01", price: 50, qty: 2}] - only potions you're selling

Use EMPTY ARRAYS [] if you have nothing for that action. Do NOT list all herbs/potions with qty:0.
`;

export function formatInventory(inventory: PlayerInventory): string {
  const herbs = Object.entries(inventory.herbs)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${id}:${qty}`)
    .join(", ");

  const potions = Object.entries(inventory.potions)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${id}:${qty}`)
    .join(", ");

  return `Silver: ${inventory.silver}g | Herbs: ${herbs || "none"} | Potions: ${
    potions || "none"
  }`;
}

export function getCraftableWithCurrentHerbs(
  herbs: Record<HerbId, number>
): string {
  const craftable: string[] = [];

  for (const [potionId, [h1, h2]] of Object.entries(RECIPES)) {
    const qty1 = herbs[h1 as HerbId] || 0;
    const qty2 = herbs[h2 as HerbId] || 0;
    const max = Math.min(qty1, qty2);

    if (max > 0) {
      craftable.push(`${potionId}: ${max}x`);
    }
  }

  return craftable.length > 0 ? craftable.join(", ") : "None";
}

export function getCraftingOpportunities(
  silver: number,
  prices: Record<HerbId, number>,
  currentHerbs: Record<HerbId, number>
): string {
  const opps: {
    potionId: string;
    cost: number;
    h1: string;
    h2: string;
    canMakeNow: number;
    canMakeIfBuy: number;
  }[] = [];

  for (const [potionId, [h1, h2]] of Object.entries(RECIPES)) {
    const p1 = prices[h1 as HerbId];
    const p2 = prices[h2 as HerbId];
    const cost = p1 + p2;

    const canMakeNow = Math.min(
      currentHerbs[h1 as HerbId] || 0,
      currentHerbs[h2 as HerbId] || 0
    );
    const canMakeIfBuy = Math.floor(silver / cost);

    opps.push({ potionId, cost, h1, h2, canMakeNow, canMakeIfBuy });
  }

  opps.sort((a, b) => a.cost - b.cost);

  return opps
    .slice(0, 8)
    .map((o) => {
      let s = `${o.potionId}: ${o.h1}+${o.h2}=${o.cost}g`;
      if (o.canMakeNow > 0) s += ` | now:${o.canMakeNow}`;
      if (o.canMakeIfBuy > 0) s += ` | buy:${o.canMakeIfBuy}`;
      return s;
    })
    .join("\n");
}

export function summarizeDemand(
  historicDemands: Record<
    PotionId,
    {
      fulfilled: number;
      remaining: number;
      highestPrice: number;
      lowestPrice: number;
    }
  >[]
): string {
  if (historicDemands.length === 0) return "Day 1 - no history";

  const lastDay = historicDemands[historicDemands.length - 1];
  if (!lastDay) return "No data";

  const summary = Object.entries(lastDay)
    .filter(([, d]) => d.fulfilled > 0 || d.remaining > 0)
    .map(([id, d]) => {
      const total = d.fulfilled + d.remaining;
      const fill = total > 0 ? Math.round((d.fulfilled / total) * 100) : 0;
      return `${id}: ${total} demand, ${fill}% filled, ${d.lowestPrice}-${d.highestPrice}g`;
    })
    .slice(0, 10);

  return summary.length > 0 ? summary.join("\n") : "No activity";
}
