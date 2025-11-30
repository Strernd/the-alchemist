import { getWithDefaultConfig } from "@/lib/defaults";
import { Player } from "@/lib/types";
import { gameWorkflow } from "@/workflows/game-workflow";
import { start } from "workflow/api";

function generateSeed(): string {
  return Math.random().toString(36).substring(2, 12);
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

  // Clamp days between 1 and 20
  const gameDays = Math.min(20, Math.max(1, days || 5));
  const gameSeed = seed || generateSeed();
  const config = getWithDefaultConfig(gameSeed, players, gameDays);

  const run = await start(gameWorkflow, [config]);

  return Response.json({ runId: run.runId, seed: gameSeed });
}
