import {
  getPlayerInputs,
  initializeGameState,
  processGameDay,
  setupGame,
} from "@/lib/game-engine";
import { GameConfig, GameState, Player, PlayerOutputs } from "@/lib/types";
import { getWritable } from "workflow";
import { aiPlayerStep } from "./ai-player-step";
import { chooseAlchemistName } from "./name-step";

export async function gameWorkflow(config: GameConfig) {
  "use workflow";
  const writable = getWritable();

  // Step 1: Each AI chooses their alchemist name
  console.log(
    `[Game] Choosing names for ${config.runtime.players.length} players...`
  );

  const nameResults = await Promise.all(
    config.runtime.players.map((player) => chooseAlchemistName(player.model))
  );

  // Track disqualified players from name generation
  const disqualified: { playerIdx: number; reason: string }[] = [];
  const namedPlayers: Player[] = config.runtime.players.map((player, idx) => {
    const result = nameResults[idx];
    if (!result.success && result.error) {
      disqualified.push({ playerIdx: idx, reason: result.error });
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

  // Include player names and disqualification status in initial state for UI
  gameState = {
    ...gameState,
    playerNames: namedPlayers.map((p) => p.name),
    disqualifiedPlayers: disqualified,
  };
  await streamContentToClient(writable, gameState);

  for (let day = 1; day <= updatedConfig.generation.days; day++) {
    console.log(`Starting day ${day} of ${updatedConfig.generation.days}`);
    const disqualifiedIdxs = new Set(disqualified.map((d) => d.playerIdx));

    const promises = updatedConfig.runtime.players.map(async (player, idx) => {
      const isDisqualified = disqualifiedIdxs.has(idx);
      const playerInput = getPlayerInputs(
        game,
        updatedConfig,
        day,
        gameState,
        idx
      );
      const result = await aiPlayerStep(
        playerInput,
        player.model,
        isDisqualified
      );

      // Log result status for debugging
      console.log(
        `[Game] Player ${idx} result: success=${result.success}, error=${
          result.error || "none"
        }`
      );

      // If this step failed, disqualify the player for future rounds
      if (!result.success && result.error && !isDisqualified) {
        console.log(
          `[Game] ⚠ Disqualifying player ${idx} (${player.model}): ${result.error}`
        );
        disqualified.push({ playerIdx: idx, reason: result.error });
      }

      return result.outputs;
    });
    const playerOutputs = await Promise.all(promises);
    gameState = processGameDay(
      playerOutputs as PlayerOutputs[],
      gameState,
      game
    );
    // Update disqualification status in game state
    gameState = { ...gameState, disqualifiedPlayers: disqualified };
    await streamContentToClient(writable, gameState);
  }

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
  // Add newline delimiter so client can parse separate JSON objects
  await writer.write(JSON.stringify(gameState) + "\n");
  writer.releaseLock();
}
