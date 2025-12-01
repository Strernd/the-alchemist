import {
  getPlayerInputs,
  initializeGameState,
  processGameDay,
  setupGame,
} from "@/lib/game-engine";
import { AI_MODELS } from "@/lib/models";
import {
  GameConfig,
  GameState,
  Player,
  PlayerOutputs,
  PlayerUsageStats,
} from "@/lib/types";
import { createHook, getWritable } from "workflow";
import { aiPlayerStep, PlayerStepResult } from "./ai-player-step";
import { chooseAlchemistName, NameResult, UsageData } from "./name-step";

// Calculate cost in USD from usage data and model pricing
function calculateCost(modelId: string, usage: UsageData | undefined): number {
  if (!usage) return 0;
  const model = AI_MODELS.find((m) => m.id === modelId);
  if (!model) {
    console.warn(`[Cost] Model not found: ${modelId}`);
    return 0;
  }

  // Prices are per 1M tokens
  // Reasoning/thinking tokens are priced at output rate
  const inputCost = (usage.inputTokens / 1_000_000) * model.input;
  const outputCost = (usage.outputTokens / 1_000_000) * model.output;
  const reasoningCost =
    ((usage.reasoningTokens || 0) / 1_000_000) * model.output;
  const total = inputCost + outputCost + reasoningCost;

  const reasoningStr = usage.reasoningTokens
    ? ` + ${usage.reasoningTokens}reasoning*$${model.output}`
    : "";
  console.log(
    `[Cost] ${modelId.split("/").pop()}: ${usage.inputTokens}in*$${
      model.input
    } + ${usage.outputTokens}out*$${
      model.output
    }${reasoningStr} = $${total.toFixed(6)}`
  );

  return total;
}

// Add usage to player stats
function addUsage(
  stats: PlayerUsageStats,
  usage: UsageData | undefined,
  costUsd: number
): PlayerUsageStats {
  if (!usage) return stats;
  return {
    inputTokens: stats.inputTokens + usage.inputTokens,
    outputTokens: stats.outputTokens + usage.outputTokens,
    reasoningTokens: stats.reasoningTokens + (usage.reasoningTokens || 0),
    totalTokens: stats.totalTokens + usage.totalTokens,
    costUsd: stats.costUsd + costUsd,
    totalTimeMs: stats.totalTimeMs + usage.durationMs,
    callCount: stats.callCount + 1,
  };
}

export async function gameWorkflow(config: GameConfig) {
  "use workflow";
  const writable = getWritable();

  // Initialize usage stats for each player
  const playerUsageStats: PlayerUsageStats[] = config.runtime.players.map(
    () => ({
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      totalTimeMs: 0,
      callCount: 0,
    })
  );

  // Step 1: Each AI chooses their alchemist name (human players keep their name)
  console.log(
    `[Game] Choosing names for ${config.runtime.players.length} players...`
  );

  // Track disqualified players
  const disqualified: { playerIdx: number; reason: string }[] = [];

  // Only request names from AI players
  const nameResults = await Promise.all(
    config.runtime.players.map(async (player) => {
      if (player.isHuman) {
        // Human player keeps their configured name (or default)
        return {
          name: player.name || "You",
          success: true,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            reasoningTokens: 0,
            totalTokens: 0,
            durationMs: 0,
          },
        } as NameResult;
      }
      return chooseAlchemistName(player.model);
    })
  );

  const namedPlayers: Player[] = config.runtime.players.map((player, idx) => {
    const result = nameResults[idx];

    // Only accumulate usage for AI players
    if (!player.isHuman) {
      const cost = calculateCost(player.model, result.usage);
      playerUsageStats[idx] = addUsage(
        playerUsageStats[idx],
        result.usage,
        cost
      );

      if (!result.success) {
        disqualified.push({
          playerIdx: idx,
          reason: result.error || "Name generation failed",
        });
      }
    }
    return { ...player, name: result.name };
  });

  if (disqualified.length > 0) {
    console.log(`[Game] ⚠ ${disqualified.length} disqualified in name phase`);
  }

  // Update config with chosen names
  const updatedConfig: GameConfig = {
    ...config,
    runtime: { ...config.runtime, players: namedPlayers },
  };

  const game = setupGame(updatedConfig.generation);
  let gameState = initializeGameState(updatedConfig.runtime);

  // Include player names, disqualification status, and usage stats in initial state
  gameState = {
    ...gameState,
    playerNames: namedPlayers.map((p) => p.name),
    disqualifiedPlayers: disqualified,
    playerUsageStats: [...playerUsageStats],
  };
  await streamContentToClient(writable, gameState);

  // Use seed for hook tokens (must be deterministic for workflow replay)
  const hookPrefix = `alchemist_${config.generation.seed}`;

  for (let day = 1; day <= updatedConfig.generation.days; day++) {
    console.log(`Starting day ${day} of ${updatedConfig.generation.days}`);
    const disqualifiedIdxs = new Set(disqualified.map((d) => d.playerIdx));

    // Prepare inputs for all players
    const playerInputs = updatedConfig.runtime.players.map((_, idx) =>
      getPlayerInputs(game, updatedConfig, day, gameState, idx)
    );

    // Check if there's a human player that needs input
    const humanPlayerIdx = updatedConfig.runtime.players.findIndex(
      (p, idx) => p.isHuman && !disqualifiedIdxs.has(idx)
    );

    // Start AI players IMMEDIATELY (in parallel with human input)
    console.log(`[Game] Starting AI players in parallel...`);
    const aiStartTime = Date.now();

    // Create promises for all AI players right away
    const aiPromises: Promise<{
      idx: number;
      outputs: PlayerOutputs;
      result: PlayerStepResult | null;
    }>[] = updatedConfig.runtime.players.map(async (player, idx) => {
      const isDisqualified = disqualifiedIdxs.has(idx);

      // Human player - will be handled separately
      if (player.isHuman) {
        // Return placeholder - will be replaced with actual human output
        return { idx, outputs: null as unknown as PlayerOutputs, result: null };
      }

      // Disqualified player - empty outputs
      if (isDisqualified) {
        return {
          idx,
          outputs: {
            buyHerbs: [],
            makePotions: [],
            potionOffers: [],
          } as PlayerOutputs,
          result: null,
        };
      }

      // AI player - run in parallel with others AND with human input
      const result = await aiPlayerStep(
        playerInputs[idx],
        player.model,
        false,
        player.strategyPrompt
      );
      return { idx, outputs: result.outputs, result };
    });

    // If there's a human player, wait for their input
    let humanOutputs: PlayerOutputs | null = null;
    let humanStartTime = 0;
    if (humanPlayerIdx >= 0) {
      const playerInput = playerInputs[humanPlayerIdx];
      const hookToken = `${hookPrefix}:day${day}:player${humanPlayerIdx}`;

      console.log(`[Game] Creating hook for human player ${humanPlayerIdx}`);
      console.log(`[Game] Hook token: ${hookToken}`);

      // Track start time for human player
      humanStartTime = await getTimestamp();

      // Create hook FIRST before streaming (so it exists when client tries to resume)
      const hook = createHook<PlayerOutputs>({ token: hookToken });

      // Stream state with waiting info so UI can show input form
      const waitingState: GameState = {
        ...gameState,
        currentDay: day,
        disqualifiedPlayers: disqualified,
        playerUsageStats: [...playerUsageStats],
        waitingForHuman: {
          playerIdx: humanPlayerIdx,
          hookToken,
          playerInputs: playerInput,
          herbPrices: game.herbDailyPrices[day - 1],
        },
      };
      console.log(`[Game] Streaming waiting state to client...`);
      await streamContentToClient(writable, waitingState);

      console.log(
        `[Game] Waiting for human player ${humanPlayerIdx} input (AIs running in background)...`
      );
      humanOutputs = await hook;
      console.log(`[Game] Received human player ${humanPlayerIdx} input`);

      // Stream "waiting for AIs" state so user knows we're processing
      const waitingForAIsState: GameState = {
        ...gameState,
        currentDay: day,
        disqualifiedPlayers: disqualified,
        playerUsageStats: [...playerUsageStats],
        waitingForHuman: {
          ...waitingState.waitingForHuman!,
          waitingForAIs: true, // Signal that human is done, waiting for AIs
        },
      };
      await streamContentToClient(writable, waitingForAIsState);
    }

    // Now wait for all AI players to complete
    const results = await Promise.all(aiPromises);
    console.log(
      `[Game] All AI players completed in ${Date.now() - aiStartTime}ms`
    );

    // Track human player timing after AIs complete (to capture full wait time)
    if (humanPlayerIdx >= 0 && humanOutputs) {
      const endTime = await getTimestamp();
      const durationMs = endTime - humanStartTime;
      console.log(
        `[Game] Human player ${humanPlayerIdx} took ${(
          durationMs / 1000
        ).toFixed(1)}s`
      );

      // Add usage stats for human player (no tokens, just time)
      playerUsageStats[humanPlayerIdx] = addUsage(
        playerUsageStats[humanPlayerIdx],
        {
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          totalTokens: 0,
          durationMs,
        },
        0 // No cost for human
      );

      // Update human player result with actual outputs
      const humanResult = results.find((r) => r.idx === humanPlayerIdx);
      if (humanResult) {
        humanResult.outputs = humanOutputs;
      }
    }

    // Process results and collect outputs in order
    const playerOutputs: PlayerOutputs[] = [];
    const playerReasonings: (string | undefined)[] = [];
    for (const { idx, outputs, result } of results.sort(
      (a, b) => a.idx - b.idx
    )) {
      const player = updatedConfig.runtime.players[idx];

      // Handle AI result (usage tracking, disqualification)
      if (result) {
        if (result.usage) {
          const cost = calculateCost(player.model, result.usage);
          playerUsageStats[idx] = addUsage(
            playerUsageStats[idx],
            result.usage,
            cost
          );
        }

        console.log(
          `[Game] Player ${idx} (${player.model.split("/").pop()}): success=${
            result.success
          }, error="${result.error || "none"}", ${
            result.usage?.durationMs || 0
          }ms`
        );

        if (!result.success) {
          const reason = result.error || "Unknown error";
          console.log(`[Game] ⚠ Disqualifying player ${idx}: ${reason}`);
          disqualified.push({ playerIdx: idx, reason });
        }

        playerReasonings.push(result.reasoning);
      } else {
        playerReasonings.push(undefined);
      }

      playerOutputs.push(outputs);
    }

    gameState = processGameDay(
      playerOutputs,
      gameState,
      game,
      playerReasonings
    );

    // Update game state with latest disqualification and usage stats (clear waiting state)
    gameState = {
      ...gameState,
      disqualifiedPlayers: disqualified,
      playerUsageStats: [...playerUsageStats],
      waitingForHuman: undefined,
    };
    await streamContentToClient(writable, gameState);
  }

  // Log final usage summary
  console.log("[Game] === USAGE SUMMARY ===");
  namedPlayers.forEach((player, idx) => {
    const stats = playerUsageStats[idx];
    console.log(`[Game] ${player.name} (${player.model}):`);
    console.log(
      `[Game]   Tokens: ${stats.inputTokens} in / ${stats.outputTokens} out = ${stats.totalTokens} total`
    );
    console.log(`[Game]   Cost: $${stats.costUsd.toFixed(6)}`);
    console.log(
      `[Game]   Time: ${stats.totalTimeMs}ms (${
        stats.callCount
      } calls, avg ${Math.round(stats.totalTimeMs / stats.callCount)}ms)`
    );
  });

  // Close the stream to signal completion to clients
  await closeStream(writable);

  return gameState;
}

async function closeStream(writable: WritableStream) {
  "use step";
  const writer = writable.getWriter();
  await writer.close();
}

async function streamContentToClient(
  writable: WritableStream,
  gameState: GameState
) {
  "use step";
  const writer = writable.getWriter();
  await writer.write(JSON.stringify(gameState) + "\n");
  writer.releaseLock();
}

// Get current timestamp (must be in a step for determinism in workflows)
async function getTimestamp(): Promise<number> {
  "use step";
  return Date.now();
}
