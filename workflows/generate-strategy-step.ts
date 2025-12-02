import { PlayerDayHistory, PotionId, PotionMarketData } from "@/lib/types";
import { generateText } from "ai";
import { formatActionHistory } from "./prompts";

export type StrategyGenerationInput = {
  modelId: string;
  playerName: string;
  finalGold: number;
  startingGold: number;
  finalRank: number;
  totalPlayers: number;
  actionHistory: PlayerDayHistory[];
  marketHistory: Record<PotionId, PotionMarketData>[];
  previousStrategy?: string;
  totalDays: number;
};

export type StrategyGenerationResult = {
  strategy: string;
  success: boolean;
  error?: string;
};

const STRATEGY_SYSTEM_PROMPT = `You are an AI that just finished playing "The Alchemist", a competitive potion trading game.

Your goal was to end with the most gold by buying herbs, crafting potions, and selling them at market.

Game mechanics:
- Each day: BUY herbs → CRAFT potions → SELL potions at the market
- Market sorts all player offers by price (lowest first), demand buys cheapest first
- Unsold potions return to inventory
- Price cap: Maximum price is 5x the BASE herb cost. Offers above this are sold at the capped price.

Now analyze your performance and create a strategy for next time.`;

function formatGameSummary(input: StrategyGenerationInput): string {
  const profitLoss = input.finalGold - input.startingGold;
  const profitPercent = ((profitLoss / input.startingGold) * 100).toFixed(1);

  // Calculate aggregate stats from history
  let totalHerbCost = 0;
  let totalRevenue = 0;
  let totalSold = 0;
  let totalOffered = 0;
  let totalErrors = 0;
  let totalPotionsCrafted = 0;

  for (const day of input.actionHistory) {
    totalHerbCost += day.herbsBought.reduce((s, h) => s + h.cost, 0);
    totalRevenue += day.sales.reduce((s, sr) => s + sr.revenue, 0);
    totalSold += day.sales.reduce((s, sr) => s + sr.sold, 0);
    totalOffered += day.sales.reduce((s, sr) => s + sr.offered, 0);
    totalErrors += day.errors.length;
    totalPotionsCrafted += day.potionsMade.reduce((s, p) => s + p.qty, 0);
  }

  const sellRate =
    totalOffered > 0 ? ((totalSold / totalOffered) * 100).toFixed(0) : "0";

  return `## YOUR GAME RESULTS
- Final Position: #${input.finalRank} of ${input.totalPlayers} players
- Starting Gold: ${input.startingGold}g
- Final Gold: ${input.finalGold}g
- Profit/Loss: ${profitLoss >= 0 ? "+" : ""}${profitLoss}g (${profitPercent}%)
- Game Length: ${input.totalDays} days

## YOUR AGGREGATE STATS
- Total spent on herbs: ${totalHerbCost}g
- Total revenue from sales: ${totalRevenue}g
- Potions crafted: ${totalPotionsCrafted}
- Sales success rate: ${totalSold}/${totalOffered} (${sellRate}%)
- Total errors: ${totalErrors}

## YOUR DAY-BY-DAY DECISIONS
${formatActionHistory(input.actionHistory, input.actionHistory.length)}

${
  input.previousStrategy
    ? `## STRATEGY YOU WERE FOLLOWING
${input.previousStrategy}
`
    : ""
}`;
}

export async function generateStrategyFromGame(
  input: StrategyGenerationInput
): Promise<StrategyGenerationResult> {
  const userPrompt = `${formatGameSummary(input)}

Based on your performance, create a concise strategy (max 2500 characters) for playing better (or as well) next time.

Consider:
1. What worked well? What should you keep doing? Make sure to mention what you did that worked.
2. What didn't work? What mistakes did you make?
3. How could you improve your pricing strategy?
4. How could you better predict demand and manage inventory?
5. Any specific tactics for early/mid/late game?

Write a clear, actionable strategy (2-4 paragraphs) that you would follow in the next game.
Focus on specific, concrete actions rather than vague principles.`;

  try {
    const { text } = await generateText({
      model: input.modelId,
      system: STRATEGY_SYSTEM_PROMPT,
      prompt: userPrompt,
    });

    return {
      strategy: text.trim(),
      success: true,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(`[Strategy] Failed to generate strategy:`, err.message);
    return {
      strategy: "",
      success: false,
      error: err.message || "Failed to generate strategy",
    };
  }
}
