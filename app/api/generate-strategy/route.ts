import { NextRequest, NextResponse } from "next/server";
import {
  generateStrategyFromGame,
  StrategyGenerationInput,
} from "@/workflows/generate-strategy-step";

const MAX_STRATEGY_LENGTH = 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Truncate previousStrategy input to prevent token abuse
    const previousStrategy = body.previousStrategy
      ? String(body.previousStrategy).slice(0, MAX_STRATEGY_LENGTH)
      : undefined;

    const input: StrategyGenerationInput = {
      modelId: body.modelId,
      playerName: body.playerName,
      finalGold: body.finalGold,
      startingGold: body.startingGold,
      finalRank: body.finalRank,
      totalPlayers: body.totalPlayers,
      actionHistory: body.actionHistory,
      marketHistory: body.marketHistory,
      previousStrategy,
      totalDays: body.totalDays,
    };

    const result = await generateStrategyFromGame(input);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to generate strategy" },
        { status: 500 }
      );
    }

    // Truncate generated strategy to max length
    const strategy = result.strategy.slice(0, MAX_STRATEGY_LENGTH);

    return NextResponse.json({ strategy });
  } catch (error) {
    console.error("[API] Strategy generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

