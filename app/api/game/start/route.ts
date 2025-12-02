import { getWithDefaultConfig } from "@/lib/defaults";
import { Player } from "@/lib/types";
import { gameWorkflow } from "@/workflows/game-workflow";
import { start } from "workflow/api";

const MAX_STRATEGY_LENGTH = 2500;

function generateSeed(): string {
  return Math.random().toString(36).substring(2, 12);
}

// Truncate strategy prompt to prevent token abuse
function sanitizeStrategyPrompt(prompt?: string): string | undefined {
  if (!prompt) return undefined;
  return prompt.slice(0, MAX_STRATEGY_LENGTH);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { players, seed, days } = body as {
    players: Player[];
    seed?: string;
    days?: number;
  };

  if (!players || players.length < 1 || players.length > 6) {
    return Response.json(
      { error: "Must have between 1 and 6 players" },
      { status: 400 }
    );
  }

  // Sanitize player strategy prompts (max 1000 chars)
  const sanitizedPlayers: Player[] = players.map((p) => ({
    ...p,
    strategyPrompt: sanitizeStrategyPrompt(p.strategyPrompt),
  }));

  // Clamp days between 1 and 20
  const gameDays = Math.min(20, Math.max(1, days || 5));
  const gameSeed = seed || generateSeed();
  const config = getWithDefaultConfig(gameSeed, sanitizedPlayers, gameDays);

  const run = await start(gameWorkflow, [config]);

  return Response.json({ runId: run.runId, seed: gameSeed });
}
