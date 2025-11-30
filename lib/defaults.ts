import { GameConfig, Player } from "./types";

export function getWithDefaultConfig(
  seed: string,
  players: Player[],
  days: number = 5
): GameConfig {
  const playerCount = players.length;
  return {
    generation: {
      seed,
      days,
      playerCount,
      herbTierBasePrices: { T1: 10, T2: 50, T3: 150 },
      herbTierBasePriceSpread: { T1: 0.5, T2: 0.5, T3: 0.5 },
      herbDailyPriceSpread: 0.15,
      // Base demands are scaled by 0.5 * playerCount in game-engine
      // These values give T1:25, T2:20, T3:15 demand for 2 players
      potionTierBaseDemands: { T1: 25, T2: 20, T3: 15 },
      potionTierBaseDemandSpread: { T1: 0.3, T2: 0.3, T3: 0.3 },
      potionDailyDemandSpread: 0.25,
    },
    runtime: {
      players,
      startingSilver: 1000,
    },
  };
}
