import {
  getPlayerInputs,
  initializeGameState,
  processGameDay,
  setupGame,
} from "@/lib/game-engine";
import { GameConfig, GameState, PlayerOutputs } from "@/lib/types";
import { getWritable } from "workflow";
import { aiPlayerStep } from "./ai-player-step";

export async function gameWorkflow(config: GameConfig) {
  "use workflow";
  const writable = getWritable();
  const game = setupGame(config.generation);
  let gameState = initializeGameState(config.runtime);
  await streamContentToClient(writable, gameState);

  for (let day = 1; day <= config.generation.days; day++) {
    console.log(`Starting day ${day} of ${config.generation.days}`);
    const promises = config.runtime.players.map(async (player, idx) => {
      const playerInput = getPlayerInputs(game, config, day, gameState, idx);
      return aiPlayerStep(playerInput, player.model);
    });
    const playerOutputs = await Promise.all(promises);
    gameState = processGameDay(
      playerOutputs as PlayerOutputs[],
      gameState,
      game
    );
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
