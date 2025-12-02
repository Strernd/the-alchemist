import {
  HerbId,
  PlayerDayHistory,
  PlayerInventory,
  POTION_NAMES,
  POTION_TIER_LOOKUP,
  PotionId,
  PotionMarketData,
  RECIPES,
} from "@/lib/types";

const BASE_SYSTEM_PROMPT = `You are an AI playing "The Alchemist", a potion trading game. Goal: end with the most gold.

## GAME FLOW (each day)
1. BUY HERBS - spend gold on herbs at today's prices
2. CRAFT POTIONS - combine 2 herbs into 1 potion (consumes herbs)
3. SELL POTIONS - list potions at your price

Buy, craft and sell happen on the same day in that order.

Market: All player offers are sorted by price (lowest first). Demand buys from cheapest offers until demand is exhausted. Unsold potions return to your inventory.

## PRICE CAP
The maximum price buyers will pay is 5x the BASE herb cost (not today's fluctuating price).
If you list a potion higher than this cap, it will automatically be sold at the capped price.
Example: If herbs cost 10g base each, max potion price = (10+10) × 5 = 100g

## RECIPES (Potion = Herb1 + Herb2)
${Object.entries(RECIPES)
  .map(([potionId, herbs]) => {
    const tier = POTION_TIER_LOOKUP[potionId as PotionId];
    return `${potionId} (T${tier.charAt(1)}): ${herbs[0]} + ${herbs[1]}`;
  })
  .join("\n")}

## RULES
1. Cannot spend more gold than you have
2. Cannot craft without BOTH herbs in inventory
3. Cannot sell potions you don't have
4. Actions execute in order: buy → craft → sell
5. Prices above 5x base herb cost are capped (you still sell, but at capped price)

## OUTPUT FORMAT
Return JSON with three arrays. ONLY include items you actually want - omit items with qty 0:
- buyHerbs: [{herbId: "H01", qty: 5}] - only herbs you're buying
- makePotions: [{potionId: "P01", qty: 2}] - only potions you're crafting
- potionOffers: [{potionId: "P01", price: 50, qty: 2}] - only potions you're selling

Use EMPTY ARRAYS [] if you have nothing for that action.
`;

const MAX_STRATEGY_LENGTH = 2500;

// Build system prompt with optional strategy
export function buildSystemPrompt(strategyPrompt?: string): string {
  if (!strategyPrompt) {
    return BASE_SYSTEM_PROMPT;
  }
  // Enforce max length as safety measure
  const truncatedStrategy = strategyPrompt.slice(0, MAX_STRATEGY_LENGTH);
  return `${BASE_SYSTEM_PROMPT}
## YOUR STRATEGY
Follow this trading strategy:
${truncatedStrategy}
`;
}

// Default export for backwards compatibility
export const PLAYER_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;

export function formatInventory(inventory: PlayerInventory): string {
  const herbs = Object.entries(inventory.herbs)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${id}:${qty}`)
    .join(", ");

  const potions = Object.entries(inventory.potions)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${id}:${qty}`)
    .join(", ");

  return `Gold: ${inventory.gold}g | Herbs: ${herbs || "none"} | Potions: ${
    potions || "none"
  }`;
}

// Format herb prices as a simple list
export function formatHerbPrices(prices: Record<HerbId, number>): string {
  return Object.entries(prices)
    .map(([herbId, price]) => `${herbId}: ${price}g`)
    .join(", ");
}

// Format a single day's actions for history
function formatDayActions(day: PlayerDayHistory): string {
  const lines: string[] = [];

  // Header with gold change
  const goldChange = day.goldEnd - day.goldStart;
  const changeStr = goldChange >= 0 ? `+${goldChange}` : `${goldChange}`;
  lines.push(
    `Day ${day.day}: ${day.goldStart}g → ${day.goldEnd}g (${changeStr}g)`
  );

  // Herbs bought
  if (day.herbsBought.length > 0) {
    const totalCost = day.herbsBought.reduce((s, h) => s + h.cost, 0);
    const herbsStr = day.herbsBought
      .map((h) => `${h.herbId}:${h.qty}`)
      .join(", ");
    lines.push(`  BOUGHT: ${herbsStr} (spent ${totalCost}g)`);
  }

  // Potions crafted
  if (day.potionsMade.length > 0) {
    const potionsStr = day.potionsMade
      .map((p) => `${p.potionId}:${p.qty}`)
      .join(", ");
    lines.push(`  CRAFTED: ${potionsStr}`);
  }

  // Sales with clear offered/sold format
  if (day.sales.length > 0) {
    const salesStr = day.sales
      .map(
        (s) =>
          `${s.potionId} offered:${s.offered} sold:${s.sold} @${s.price}g (earned ${s.revenue}g)`
      )
      .join("; ");
    lines.push(`  SOLD: ${salesStr}`);
  }

  // Errors
  if (day.errors.length > 0) {
    lines.push(`  ERRORS: ${day.errors.join("; ")}`);
  }

  return lines.join("\n");
}

// Format action history - your past decisions and their outcomes
export function formatActionHistory(
  history: PlayerDayHistory[],
  detailDays: number = 3
): string {
  if (history.length === 0) return "";

  const parts: string[] = [];

  // Split into old and recent
  const recentStart = Math.max(0, history.length - detailDays);
  const oldDays = history.slice(0, recentStart);
  const recentDays = history.slice(recentStart);

  // Summarize older days if any
  if (oldDays.length > 0) {
    const totalBought = oldDays.reduce(
      (s, d) => s + d.herbsBought.reduce((s2, h) => s2 + h.cost, 0),
      0
    );
    const totalRevenue = oldDays.reduce(
      (s, d) => s + d.sales.reduce((s2, sr) => s2 + sr.revenue, 0),
      0
    );
    const totalErrors = oldDays.reduce((s, d) => s + d.errors.length, 0);
    const netProfit = totalRevenue - totalBought;
    parts.push(
      `[Days 1-${
        oldDays.length
      } summary] Spent: ${totalBought}g | Revenue: ${totalRevenue}g | Net: ${
        netProfit >= 0 ? "+" : ""
      }${netProfit}g${totalErrors > 0 ? ` | ${totalErrors} errors` : ""}`
    );
  }

  // Detail recent days
  for (const day of recentDays) {
    parts.push(formatDayActions(day));
  }

  return parts.join("\n");
}

// Format yesterday's market - shows ALL potions with trading activity
export function formatYesterdayMarket(
  historicMarkets: Record<PotionId, PotionMarketData>[]
): string {
  if (historicMarkets.length === 0) return "No market data yet (Day 1)";

  const lastDay = historicMarkets[historicMarkets.length - 1];
  if (!lastDay) return "No market data";

  // Show ALL potions, sorted by ID
  const potionIds = Object.keys(POTION_NAMES).sort() as PotionId[];

  const lines = potionIds.map((potionId) => {
    const data = lastDay[potionId];
    if (!data || (data.totalOffered === 0 && data.totalSold === 0)) {
      return `${potionId}: no activity`;
    }

    let line = `${potionId}: offered:${data.totalOffered} sold:${data.totalSold}`;

    if (data.lowestPrice > 0 || data.highestPrice > 0) {
      if (data.lowestPrice === data.highestPrice) {
        line += ` @${data.lowestPrice}g`;
      } else {
        line += ` @${data.lowestPrice}-${data.highestPrice}g`;
      }
    }

    return line;
  });

  return lines.join("\n");
}

// Format historical herb prices from action history
export function formatHistoricalHerbPrices(
  actionHistory: PlayerDayHistory[],
  currentPrices: Record<HerbId, number>
): string {
  if (actionHistory.length === 0) {
    // Just show today's prices
    return Object.entries(currentPrices)
      .map(([herbId, price]) => `${herbId}: ${price}g`)
      .join(", ");
  }

  // Get all herb IDs
  const herbIds = Object.keys(currentPrices).sort() as HerbId[];

  // Build a table showing prices across days
  const lines: string[] = [];

  for (const herbId of herbIds) {
    const pastPrices = actionHistory.map((day) => day.herbPrices[herbId] || 0);
    const currentPrice = currentPrices[herbId];

    // Format: H01: 12g, 14g, 11g → 13g (today)
    const priceHistory = pastPrices.map((p) => `${p}g`).join(", ");
    lines.push(`${herbId}: ${priceHistory} → ${currentPrice}g (today)`);
  }

  return lines.join("\n");
}
