import { cloneDeep, mapValues } from "lodash";
import { Random } from "random";
import {
  DayRecord,
  Game,
  GameConfig,
  GameState,
  GenerationConfig,
  HERB_NAMES,
  HERB_TIERS,
  HerbId,
  PlayerDayActions,
  PlayerInputs,
  PlayerInventory,
  PlayerOutputs,
  POTION_NAMES,
  POTION_TIERS,
  PotionId,
  PotionOffer,
  RECIPES,
  RuntimeConfig,
  Tier,
} from "./types";
export function setupGame(config: GenerationConfig): Game {
  const rng = new Random(config.seed);
  const herbDailyPrices = createHerbDailyPrices(config, rng);
  const potionDailyDemands = createPotionDailyDemands(config, rng);

  return { herbDailyPrices, potionDailyDemands };
}

export function initializeGameState(config: RuntimeConfig): GameState {
  return {
    currentDay: 1,
    playerInventories: config.players.map(() => ({
      ...initializePlayerInventory(config),
    })),
    historicDemands: [],
    lastDayErrorsByPlayer: [],
    processedMarketByDay: [],
    unprocessedOffersByDay: [],
    dayRecords: [],
  };
}

export function getPlayerInputs(
  game: Game,
  config: GameConfig,
  day: number,
  gameState: GameState,
  playerIdx: number
): PlayerInputs {
  // TODO: get market data
  const dayIndex = day - 1;
  const previousMarket =
    dayIndex > 0 ? gameState.processedMarketByDay[dayIndex - 1] : undefined;
  return {
    inventory: gameState.playerInventories[playerIdx],
    dailyPrices: game.herbDailyPrices[dayIndex],
    historicDemands: gameState.processedMarketByDay.map(
      (processedMarket) => processedMarket.potionInformation
    ),
    yesterdaysErrors: gameState.lastDayErrorsByPlayer[playerIdx] || [],
    yesterdaysExecutedOffers:
      previousMarket?.processedOffers.filter(
        (offer) => offer.playerIdx === playerIdx
      ) || [],
    meta: {
      playCount: config.runtime.players.length,
      totalDays: config.generation.days,
      currentDay: day,
    },
  };
}

export function processGameDay(
  playerOutputs: PlayerOutputs[],
  gameState: GameState,
  game: Game
): GameState {
  const dayIndex = gameState.currentDay - 1;
  const herbPrices = game.herbDailyPrices[dayIndex];
  const potionDemands = game.potionDailyDemands[dayIndex];

  const newGameState = {
    ...gameState,
    playerInventories: [] as PlayerInventory[],
    lastDayErrorsByPlayer: [] as string[][],
    dayRecords: [...gameState.dayRecords],
  };

  const offers = [] as PotionOffer[][];
  const playerInventoriesBeforeMarketProcessing = [] as PlayerInventory[];
  const playerDayActions: PlayerDayActions[] = [];

  // Player Output phase
  playerOutputs.forEach((playerOutput, idx) => {
    // Store start inventory (deep clone)
    const startInventory = cloneDeep(gameState.playerInventories[idx]);

    const {
      inventory,
      errors,
      executableOffers,
      actualBuyHerbs,
      actualMakePotions,
    } = sanitizePlayerOutputsDetailed(
      cloneDeep(gameState.playerInventories[idx]),
      playerOutput,
      herbPrices
    );

    newGameState.lastDayErrorsByPlayer.push(errors);
    newGameState.unprocessedOffersByDay.push(executableOffers);
    playerInventoriesBeforeMarketProcessing.push(inventory);
    offers.push(executableOffers);

    // Start building player day actions (will complete after market)
    playerDayActions.push({
      startInventory,
      requestedBuyHerbs: playerOutput.buyHerbs,
      requestedMakePotions: playerOutput.makePotions,
      requestedOffers: playerOutput.potionOffers,
      actualBuyHerbs,
      actualMakePotions,
      actualOffers: executableOffers,
      errors,
      endInventory: inventory, // Will be updated after market
      salesResults: [], // Will be populated after market
    });
  });

  // Market phase
  const market = buildMarket(offers);
  const processedMarket = processMarket(market, potionDemands);
  newGameState.processedMarketByDay.push(processedMarket);

  // Player Inventory phase - update end inventories and sales results
  const newPlayerInventories = playerInventoriesBeforeMarketProcessing.map(
    (inventory, idx) => {
      const playerSales: PlayerDayActions["salesResults"] = [];

      processedMarket.processedOffers
        .filter((offer) => offer.playerIdx === idx)
        .forEach((offer) => {
          // Add back unsold potions (potions were already removed when creating offers)
          inventory.potions[offer.potionId] += offer.qty - offer.actuallySold!;
          const revenue = offer.price * offer.actuallySold!;
          inventory.silver += revenue;

          playerSales.push({
            potionId: offer.potionId,
            offered: offer.qty,
            sold: offer.actuallySold!,
            price: offer.price,
            revenue,
          });
        });

      // Update player day actions with final data
      playerDayActions[idx].endInventory = cloneDeep(inventory);
      playerDayActions[idx].salesResults = playerSales;

      return inventory;
    }
  );

  // Create day record
  const dayRecord: DayRecord = {
    day: gameState.currentDay,
    herbPrices,
    potionDemands,
    playerActions: playerDayActions,
    marketSummary: processedMarket,
  };

  newGameState.dayRecords.push(dayRecord);
  newGameState.playerInventories = newPlayerInventories;
  newGameState.currentDay = gameState.currentDay + 1;
  return newGameState;
}

export function sanitizePlayerOutputs(
  playerInventory: PlayerInventory,
  outputs: PlayerOutputs,
  dailyPrices: Record<HerbId, number>
): {
  inventory: PlayerInventory;
  errors: string[];
  executableOffers: PotionOffer[];
} {
  const result = sanitizePlayerOutputsDetailed(
    playerInventory,
    outputs,
    dailyPrices
  );
  return {
    inventory: result.inventory,
    errors: result.errors,
    executableOffers: result.executableOffers,
  };
}

export function sanitizePlayerOutputsDetailed(
  playerInventory: PlayerInventory,
  outputs: PlayerOutputs,
  dailyPrices: Record<HerbId, number>
): {
  inventory: PlayerInventory;
  errors: string[];
  executableOffers: PotionOffer[];
  actualBuyHerbs: { herbId: HerbId; qty: number; cost: number }[];
  actualMakePotions: { potionId: PotionId; qty: number }[];
} {
  const errors: string[] = [];
  const actualBuyHerbs: { herbId: HerbId; qty: number; cost: number }[] = [];
  const actualMakePotions: { potionId: PotionId; qty: number }[] = [];

  let silver = playerInventory.silver;

  // Buy herbs
  for (const herbOrder of outputs.buyHerbs) {
    const herbPrice = dailyPrices[herbOrder.herbId];
    const boughtHerbs = Math.min(herbOrder.qty, Math.floor(silver / herbPrice));
    const cost = boughtHerbs * herbPrice;
    silver -= cost;
    playerInventory.herbs[herbOrder.herbId] += boughtHerbs;

    if (boughtHerbs > 0) {
      actualBuyHerbs.push({
        herbId: herbOrder.herbId,
        qty: boughtHerbs,
        cost,
      });
    }

    if (boughtHerbs !== herbOrder.qty) {
      errors.push(
        `Not enough silver to buy ${herbOrder.qty} ${herbOrder.herbId}. Bought ${boughtHerbs} herbs.`
      );
    }
  }
  playerInventory.silver = silver;

  // Make potions
  for (const potionOrder of outputs.makePotions) {
    const [herb1, herb2] = RECIPES[potionOrder.potionId];
    const makeQty = Math.min(
      potionOrder.qty,
      playerInventory.herbs[herb1],
      playerInventory.herbs[herb2]
    );
    playerInventory.herbs[herb1] -= makeQty;
    playerInventory.herbs[herb2] -= makeQty;
    playerInventory.potions[potionOrder.potionId] += makeQty;

    if (makeQty > 0) {
      actualMakePotions.push({
        potionId: potionOrder.potionId,
        qty: makeQty,
      });
    }

    if (makeQty !== potionOrder.qty) {
      errors.push(
        `Not enough herbs to make ${potionOrder.qty} ${potionOrder.potionId}. Made ${makeQty} potions.`
      );
    }
  }

  // Create offers
  const executableOffers: PotionOffer[] = [];
  for (const potionOffer of outputs.potionOffers) {
    const offeredPotions = Math.min(
      potionOffer.qty,
      playerInventory.potions[potionOffer.potionId]
    );
    playerInventory.potions[potionOffer.potionId] -= offeredPotions;
    executableOffers.push({
      potionId: potionOffer.potionId,
      price: potionOffer.price,
      qty: offeredPotions,
    });
    if (offeredPotions !== potionOffer.qty) {
      errors.push(
        `Not enough potions to sell ${potionOffer.qty} ${potionOffer.potionId}. Sold ${offeredPotions} potions.`
      );
    }
  }

  return {
    inventory: playerInventory,
    errors,
    executableOffers,
    actualBuyHerbs,
    actualMakePotions,
  };
}

function processMarket(
  market: Record<PotionId, PotionOffer[]>,
  demands: Record<PotionId, number>
) {
  const potionInformation = {} as Record<
    PotionId,
    {
      fulfilled: number;
      remaining: number;
      highestPrice: number;
      lowestPrice: number;
    }
  >;
  const processedOffers = [] as PotionOffer[];
  Object.entries(demands).forEach(([potionId, demand]) => {
    const offers = market[potionId as PotionId] || [];
    const processedOffersForPotion = [] as PotionOffer[];
    let fulfilled = 0;
    let remaining = demand;
    let highestPrice = 0;
    const lowestPrice = offers.length > 0 ? offers[0].price : 0;
    for (const offer of offers) {
      const actualSold = Math.min(remaining, offer.qty);
      fulfilled += actualSold;
      remaining -= actualSold;
      processedOffersForPotion.push({ ...offer, actuallySold: actualSold });
      if (actualSold > 0) {
        highestPrice = offer.price;
      }
    }
    processedOffers.push(...processedOffersForPotion);
    potionInformation[potionId as PotionId] = {
      fulfilled,
      remaining,
      highestPrice,
      lowestPrice,
    };
  });
  return { processedOffers, potionInformation };
}

export function buildMarket(executedOffers: PotionOffer[][]) {
  const market = Object.keys(POTION_NAMES).reduce((acc, potionId) => {
    acc[potionId as PotionId] = [];
    return acc;
  }, {} as Record<PotionId, PotionOffer[]>);
  executedOffers.forEach((playerOffers, idx) => {
    playerOffers.forEach((offer) => {
      market[offer.potionId].push({ ...offer, playerIdx: idx });
    });
  });
  // prices ascending
  const sortedMarket = mapValues(market, (offers) =>
    offers.sort((a, b) => a.price - b.price)
  );
  return sortedMarket;
}

function initializePlayerInventory(config: RuntimeConfig): PlayerInventory {
  return {
    herbs: Object.keys(HERB_NAMES).reduce((acc, herb) => {
      acc[herb as HerbId] = 0;
      return acc;
    }, {} as Record<HerbId, number>),
    potions: Object.keys(POTION_NAMES).reduce((acc, potion) => {
      acc[potion as PotionId] = 0;
      return acc;
    }, {} as Record<PotionId, number>),
    silver: config.startingSilver,
  };
}

function createHerbBasePrices(config: GenerationConfig, rng: Random) {
  const prices = {} as Record<HerbId, number>;
  for (const [tier, herbs] of Object.entries(HERB_TIERS)) {
    const tierBasePrice = config.herbTierBasePrices[tier as Tier];
    const tierBasePriceSpread = config.herbTierBasePriceSpread[tier as Tier];
    for (const herb of herbs) {
      const herbPrice =
        tierBasePrice *
        (1 + rng.float(-tierBasePriceSpread, tierBasePriceSpread));
      prices[herb] = herbPrice;
    }
  }
  return prices;
}

function createHerbDailyPrices(config: GenerationConfig, rng: Random) {
  const basePrices = createHerbBasePrices(config, rng);
  const dayPrices = [] as Array<Record<HerbId, number>>;
  for (let day = 0; day < config.days; day++) {
    const dailyPrices = {} as Record<HerbId, number>;
    for (const [herb, basePrice] of Object.entries(basePrices)) {
      const dailyPrice =
        basePrice *
        (1 +
          rng.float(-config.herbDailyPriceSpread, config.herbDailyPriceSpread));
      dailyPrices[herb as HerbId] = Math.round(dailyPrice);
    }
    dayPrices.push(dailyPrices);
  }
  return dayPrices;
}

function createPotionBaseDemands(config: GenerationConfig, rng: Random) {
  const demands = {} as Record<PotionId, number>;
  for (const [tier, potions] of Object.entries(POTION_TIERS)) {
    const tierBaseDemand = config.potionTierBaseDemands[tier as Tier];
    const tierBaseDemandSpread =
      config.potionTierBaseDemandSpread[tier as Tier];
    for (const potion of potions) {
      const potionDemand =
        tierBaseDemand *
        (1 + rng.float(-tierBaseDemandSpread, tierBaseDemandSpread));
      demands[potion as PotionId] = potionDemand;
    }
  }
  return demands;
}

function createPotionDailyDemands(config: GenerationConfig, rng: Random) {
  const baseDemands = createPotionBaseDemands(config, rng);
  const dayDemands = [] as Array<Record<PotionId, number>>;
  for (let day = 0; day < config.days; day++) {
    const dailyDemands = {} as Record<PotionId, number>;
    for (const [potion, baseDemand] of Object.entries(baseDemands)) {
      const dailyDemand =
        baseDemand *
        (1 +
          rng.float(
            -config.potionDailyDemandSpread,
            config.potionDailyDemandSpread
          ));
      dailyDemands[potion as PotionId] = Math.round(dailyDemand);
    }
    dayDemands.push(dailyDemands);
  }
  return dayDemands;
}
