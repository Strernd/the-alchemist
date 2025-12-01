import { NextRequest, NextResponse } from "next/server";
import {
  generateStrategyFromGame,
  StrategyGenerationInput,
} from "@/workflows/generate-strategy-step";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const input: StrategyGenerationInput = {
      modelId: body.modelId,
      playerName: body.playerName,
      finalGold: body.finalGold,
      startingGold: body.startingGold,
      finalRank: body.finalRank,
      totalPlayers: body.totalPlayers,
      actionHistory: body.actionHistory,
      marketHistory: body.marketHistory,
      previousStrategy: body.previousStrategy,
      totalDays: body.totalDays,
    };

    const result = await generateStrategyFromGame(input);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to generate strategy" },
        { status: 500 }
      );
    }

    return NextResponse.json({ strategy: result.strategy });
  } catch (error) {
    console.error("[API] Strategy generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

