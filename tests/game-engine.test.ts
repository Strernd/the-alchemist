import {
  buildMarket,
  getPlayerInputs,
  initializeGameState,
  processGameDay,
  sanitizePlayerOutputs,
  setupGame,
} from "@/lib/game-engine";
import {
  Game,
  GameConfig,
  PlayerOutputs,
  POTION_NAMES,
  PotionId,
} from "@/lib/types";
import { beforeEach, describe, expect, it } from "vitest";

const baseConfig: GameConfig = {
  generation: {
    seed: "test-seed",
    days: 3,
    playerCount: 2, // Scales demand (0.5 * playerCount = 1.0 for 2 players)
    herbTierBasePrices: { T1: 10, T2: 20, T3: 30 },
    herbTierBasePriceSpread: { T1: 0.1, T2: 0.1, T3: 0.1 },
    herbDailyPriceSpread: 0.05,
    potionTierBaseDemands: { T1: 10, T2: 8, T3: 6 },
    potionTierBaseDemandSpread: { T1: 0.1, T2: 0.1, T3: 0.1 },
    potionDailyDemandSpread: 0.05,
  },
  runtime: {
    players: [{ name: "p1", model: "model-1" }],
    startingGold: 100,
  },
};

const mockGame: Game = {
  herbDailyPrices: [
    {
      H01: 5,
      H02: 5,
      H03: 5,
      H04: 5,
      H05: 5,
      H06: 5,
      H07: 5,
      H08: 5,
      H09: 5,
      H10: 5,
      H11: 5,
      H12: 5,
    },
    {
      H01: 7,
      H02: 7,
      H03: 7,
      H04: 7,
      H05: 7,
      H06: 7,
      H07: 7,
      H08: 7,
      H09: 7,
      H10: 7,
      H11: 7,
      H12: 7,
    },
  ],
  potionDailyDemands: [
    {
      P01: 1,
      P02: 1,
      P03: 1,
      P04: 1,
      P05: 1,
      P06: 1,
      P07: 1,
      P08: 1,
      P09: 1,
      P10: 1,
      P11: 1,
      P12: 1,
      P13: 1,
      P14: 1,
      P15: 1,
      P16: 1,
      P17: 1,
      P18: 1,
    },
    {
      P01: 2,
      P02: 2,
      P03: 2,
      P04: 2,
      P05: 2,
      P06: 2,
      P07: 2,
      P08: 2,
      P09: 2,
      P10: 2,
      P11: 2,
      P12: 2,
      P13: 2,
      P14: 2,
      P15: 2,
      P16: 2,
      P17: 2,
      P18: 2,
    },
  ],
  herbTierBasePrices: { T1: 10, T2: 20, T3: 30 },
};

describe("game engine", () => {
  let config: GameConfig;

  beforeEach(() => {
    config = structuredClone(baseConfig);
  });

  it("setupGame builds daily schedules deterministically from seed", () => {
    const gameA = setupGame(config.generation);
    const gameB = setupGame(config.generation);
    expect(gameA).toEqual(gameB);

    const gameC = setupGame({ ...config.generation, seed: "different-seed" });
    expect(gameC.herbDailyPrices).not.toEqual(gameA.herbDailyPrices);
    expect(gameC.potionDailyDemands).not.toEqual(gameA.potionDailyDemands);
  });

  it("initializeGameState seeds inventories and metadata", () => {
    const state = initializeGameState(config.runtime);
    expect(state.currentDay).toBe(1);
    expect(state.playerInventories).toHaveLength(config.runtime.players.length);
    state.playerInventories.forEach((inv) => {
      expect(inv.gold).toBe(config.runtime.startingGold);
      expect(Object.values(inv.herbs).every((qty) => qty === 0)).toBe(true);
      expect(Object.values(inv.potions).every((qty) => qty === 0)).toBe(true);
    });
    expect(state.processedMarketByDay).toHaveLength(0);
  });

  it("getPlayerInputs returns current day prices and empty history on day 1", () => {
    const game = setupGame(config.generation);
    const state = initializeGameState(config.runtime);
    const inputs = getPlayerInputs(game, config, 1, state, 0);

    expect(inputs.dailyPrices).toEqual(game.herbDailyPrices[0]);
    expect(inputs.historicDemands).toEqual([]);
    expect(inputs.yesterdaysExecutedOffers).toEqual([]);
    expect(inputs.meta.currentDay).toBe(1);
  });

  it("getPlayerInputs returns previous day data on later days", () => {
    const state = initializeGameState(config.runtime);
    const basePotionInfo = Object.keys(POTION_NAMES).reduce((acc, potionId) => {
      acc[potionId as PotionId] = {
        fulfilled: 0,
        remaining: 0,
        highestPrice: 0,
        lowestPrice: 0,
      };
      return acc;
    }, {} as Record<PotionId, { fulfilled: number; remaining: number; highestPrice: number; lowestPrice: number }>);
    basePotionInfo.P01 = {
      fulfilled: 2,
      remaining: 1,
      highestPrice: 10,
      lowestPrice: 10,
    };
    state.processedMarketByDay.push({
      processedOffers: [
        { potionId: "P01", price: 10, qty: 3, actuallySold: 2, playerIdx: 0 },
      ],
      potionInformation: basePotionInfo,
    });
    state.lastDayErrorsByPlayer = [["oops"]];

    const inputs = getPlayerInputs(mockGame, config, 2, state, 0);

    expect(inputs.dailyPrices).toEqual(mockGame.herbDailyPrices[1]);
    expect(inputs.historicDemands).toHaveLength(1);
    expect(inputs.yesterdaysExecutedOffers).toEqual(
      state.processedMarketByDay[0].processedOffers
    );
    expect(inputs.yesterdaysErrors).toEqual(["oops"]);
  });

  it("sanitizePlayerOutputs enforces costs and inventory limits", () => {
    const inventory = initializeGameState(config.runtime).playerInventories[0];
    const dailyPrices = {
      H01: 10,
      H02: 10,
      H03: 10,
      H04: 10,
      H05: 10,
      H06: 10,
      H07: 10,
      H08: 10,
      H09: 10,
      H10: 10,
      H11: 10,
      H12: 10,
    } as const;

    const outputs: PlayerOutputs = {
      buyHerbs: [{ herbId: "H01", qty: 15 }],
      makePotions: [{ potionId: "P01", qty: 5 }],
      potionOffers: [{ potionId: "P01", price: 3, qty: 5 }],
    };

    const priceH01 = dailyPrices.H01;
    const expectedBought = Math.min(
      outputs.buyHerbs[0].qty,
      Math.floor(config.runtime.startingGold / priceH01)
    );

    const result = sanitizePlayerOutputs(inventory, outputs, dailyPrices);

    expect(result.inventory.herbs.H01).toBe(expectedBought);
    expect(result.inventory.gold).toBe(
      config.runtime.startingGold - expectedBought * priceH01
    );
    expect(result.inventory.potions.P01).toBe(0);
    expect(result.errors.some((err) => err.includes("Not enough herbs"))).toBe(
      true
    );
    expect(
      result.errors.some((err) => err.includes("Not enough potions"))
    ).toBe(true);
  });

  it("buildMarket sorts offers by price and tags player index", () => {
    const offers: PlayerOutputs[] = [
      {
        buyHerbs: [],
        makePotions: [],
        potionOffers: [{ potionId: "P01", price: 4, qty: 1 }],
      },
      {
        buyHerbs: [],
        makePotions: [],
        potionOffers: [{ potionId: "P01", price: 2, qty: 1 }],
      },
    ];
    const market = buildMarket(offers.map((o) => o.potionOffers));

    expect(market.P01.map((o) => o.price)).toEqual([2, 4]);
    expect(market.P01.map((o) => o.playerIdx)).toEqual([1, 0]);
  });

  it("processGameDay advances the day and records market results", () => {
    const game = setupGame(config.generation);
    let state = initializeGameState(config.runtime);
    const outputs: PlayerOutputs[] = [
      { buyHerbs: [], makePotions: [], potionOffers: [] },
    ];

    state = processGameDay(outputs, state, game);

    expect(state.currentDay).toBe(2);
    expect(state.processedMarketByDay).toHaveLength(1);
    expect(state.lastDayErrorsByPlayer).toHaveLength(
      config.runtime.players.length
    );
  });

  it("plays a two-day deterministic game loop end-to-end", () => {
    const deterministicConfig: GameConfig = {
      generation: {
        ...config.generation,
        days: mockGame.herbDailyPrices.length,
      },
      runtime: structuredClone(config.runtime),
    };
    let state = initializeGameState(deterministicConfig.runtime);
    const outputsByDay: PlayerOutputs[][] = [
      [
        {
          buyHerbs: [
            { herbId: "H01", qty: 4 },
            { herbId: "H02", qty: 4 },
          ],
          makePotions: [{ potionId: "P01", qty: 3 }],
          potionOffers: [{ potionId: "P01", price: 10, qty: 3 }],
        },
      ],
      [{ buyHerbs: [], makePotions: [], potionOffers: [] }],
    ];

    outputsByDay.forEach((dayOutputs) => {
      state = processGameDay(dayOutputs, state, mockGame);
    });

    expect(state.currentDay).toBe(deterministicConfig.generation.days + 1);
    expect(state.processedMarketByDay).toHaveLength(
      deterministicConfig.generation.days
    );
    expect(state.playerInventories[0].gold).toBe(70); // 100 - 40 herbs + 10 gold from selling 1 potion (demand=1)
    expect(state.lastDayErrorsByPlayer[0]).toBeDefined();
  });

  it("returns unsold potions to inventory after market processing", () => {
    // Setup: player offers 3 potions but demand is only 1
    let state = initializeGameState(config.runtime);
    // Manually give player some potions
    state.playerInventories[0].potions.P01 = 5;

    const outputs: PlayerOutputs[] = [
      {
        buyHerbs: [],
        makePotions: [],
        potionOffers: [{ potionId: "P01", price: 10, qty: 3 }], // Offer 3
      },
    ];

    state = processGameDay(outputs, state, mockGame); // Demand for P01 is 1

    // Should have: 5 - 3 offered + 2 unsold returned = 4 potions
    // Gold: 100 + 10 (1 sold @ 10) = 110
    expect(state.playerInventories[0].potions.P01).toBe(4);
    expect(state.playerInventories[0].gold).toBe(110);
  });

  it("never allows potion inventory to go negative", () => {
    let state = initializeGameState(config.runtime);
    state.playerInventories[0].potions.P01 = 3;

    const outputs: PlayerOutputs[] = [
      {
        buyHerbs: [],
        makePotions: [],
        potionOffers: [{ potionId: "P01", price: 10, qty: 3 }],
      },
    ];

    state = processGameDay(outputs, state, mockGame);

    // Verify inventory never goes negative
    Object.values(state.playerInventories[0].potions).forEach((qty) => {
      expect(qty).toBeGreaterThanOrEqual(0);
    });
    Object.values(state.playerInventories[0].herbs).forEach((qty) => {
      expect(qty).toBeGreaterThanOrEqual(0);
    });
  });
});
