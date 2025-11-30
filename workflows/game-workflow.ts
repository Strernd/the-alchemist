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
import { aiPlayerStep } from "./ai-player-step";
import { chooseAlchemistName, UsageData } from "./name-step";

// Calculate cost in USD from usage data and model pricing
function calculateCost(modelId: string, usage: UsageData | undefined): number {
  if (!usage) return 0;
  const model = AI_MODELS.find((m) => m.id === modelId);
  if (!model) {
    console.warn(`[Cost] Model not found: ${modelId}`);
    return 0;
  }

  // Prices are per 1M tokens
  const inputCost = (usage.inputTokens / 1_000_000) * model.input;
  const outputCost = (usage.outputTokens / 1_000_000) * model.output;
  const total = inputCost + outputCost;

  console.log(
    `[Cost] ${modelId.split("/").pop()}: ${usage.inputTokens}in*$${
      model.input
    } + ${usage.outputTokens}out*$${model.output} = $${total.toFixed(6)}`
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
            totalTokens: 0,
            durationMs: 0,
          },
        };
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

      if (!result.success && result.error) {
        disqualified.push({ playerIdx: idx, reason: result.error });
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

    // Collect all player outputs for this day
    const playerOutputs: PlayerOutputs[] = [];

    for (let idx = 0; idx < updatedConfig.runtime.players.length; idx++) {
      const player = updatedConfig.runtime.players[idx];
      const isDisqualified = disqualifiedIdxs.has(idx);
      const playerInput = getPlayerInputs(
        game,
        updatedConfig,
        day,
        gameState,
        idx
      );

      let outputs: PlayerOutputs;

      if (player.isHuman && !isDisqualified) {
        // Human player: use a hook to wait for input
        const hookToken = `${hookPrefix}:day${day}:player${idx}`;
        console.log(`[Game] Creating hook for human player ${idx}`);
        console.log(`[Game] Hook token: ${hookToken}`);

        // Track start time for human player
        const startTime = await getTimestamp();

        // Create hook FIRST before streaming (so it exists when client tries to resume)
        const hook = createHook<PlayerOutputs>({ token: hookToken });

        // Stream state with waiting info so UI can show input form
        const waitingState: GameState = {
          ...gameState,
          currentDay: day,
          disqualifiedPlayers: disqualified,
          playerUsageStats: [...playerUsageStats],
          waitingForHuman: {
            playerIdx: idx,
            hookToken,
            playerInputs: playerInput,
            herbPrices: game.herbDailyPrices[day - 1],
          },
        };
        console.log(`[Game] Streaming waiting state to client...`);
        await streamContentToClient(writable, waitingState);

        console.log(`[Game] Waiting for human player ${idx} input...`);
        outputs = await hook;

        // Track end time and calculate duration
        const endTime = await getTimestamp();
        const durationMs = endTime - startTime;
        console.log(
          `[Game] Human player ${idx} took ${(durationMs / 1000).toFixed(1)}s`
        );

        // Add usage stats for human player (no tokens, just time)
        playerUsageStats[idx] = addUsage(
          playerUsageStats[idx],
          { inputTokens: 0, outputTokens: 0, totalTokens: 0, durationMs },
          0 // No cost for human
        );

        console.log(`[Game] Received human player ${idx} input`);
      } else if (isDisqualified) {
        // Disqualified player: empty outputs
        outputs = { buyHerbs: [], makePotions: [], potionOffers: [] };
      } else {
        // AI player: use aiPlayerStep
        const result = await aiPlayerStep(playerInput, player.model, false);

        // Accumulate usage (even for failed calls)
        if (result.usage) {
          const cost = calculateCost(player.model, result.usage);
          playerUsageStats[idx] = addUsage(
            playerUsageStats[idx],
            result.usage,
            cost
          );
        }

        // Log result status
        console.log(
          `[Game] Player ${idx} (${player.model.split("/").pop()}): success=${
            result.success
          }, error="${result.error || "none"}", ${
            result.usage?.durationMs || 0
          }ms`
        );

        // If this step failed, disqualify the player for future rounds
        if (!result.success) {
          if (result.error) {
            console.log(
              `[Game] ⚠ DISQUALIFYING player ${idx}: ${result.error}`
            );
            disqualified.push({ playerIdx: idx, reason: result.error });
          } else {
            console.log(`[Game] ⚠ Player ${idx} failed but no error message!`);
          }
        }

        outputs = result.outputs;
      }

      playerOutputs.push(outputs);
    }

    gameState = processGameDay(playerOutputs, gameState, game);

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
