import { z } from "zod";

export type GenerationConfig = {
  seed: string;
  days: number;
  herbTierBasePrices: Record<Tier, number>;
  herbTierBasePriceSpread: Record<Tier, number>;
  herbDailyPriceSpread: number;
  potionTierBaseDemands: Record<Tier, number>;
  potionTierBaseDemandSpread: Record<Tier, number>;
  potionDailyDemandSpread: number;
};

export type RuntimeConfig = {
  players: Player[];
  startingSilver: number;
};

export type GameConfig = {
  generation: GenerationConfig;
  runtime: RuntimeConfig;
};

export type PlayerInventory = {
  herbs: Record<HerbId, number>;
  potions: Record<PotionId, number>;
  silver: number;
};

export type Player = {
  name: string;
  model: string;
};

export type Game = {
  herbDailyPrices: Record<HerbId, number>[];
  potionDailyDemands: Record<PotionId, number>[];
};

// Detailed record of what happened in a day for each player
export type PlayerDayActions = {
  // Inventory at start of day (before any actions)
  startInventory: PlayerInventory;
  // What the AI requested
  requestedBuyHerbs: { herbId: HerbId; qty: number }[];
  requestedMakePotions: { potionId: PotionId; qty: number }[];
  requestedOffers: PotionOffer[];
  // What actually happened (after validation)
  actualBuyHerbs: { herbId: HerbId; qty: number; cost: number }[];
  actualMakePotions: { potionId: PotionId; qty: number }[];
  actualOffers: PotionOffer[];
  // Errors during validation
  errors: string[];
  // Inventory at end of day (after market)
  endInventory: PlayerInventory;
  // Market results for this player
  salesResults: {
    potionId: PotionId;
    offered: number;
    sold: number;
    price: number;
    revenue: number;
  }[];
};

export type DayRecord = {
  day: number;
  herbPrices: Record<HerbId, number>;
  potionDemands: Record<PotionId, number>;
  playerActions: PlayerDayActions[];
  marketSummary: ProcessedMarket;
};

// Token usage and cost tracking per player
export type PlayerUsageStats = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  totalTimeMs: number;
  callCount: number;
};

export type GameState = {
  currentDay: number;
  playerInventories: PlayerInventory[];
  historicDemands: Record<PotionId, number>[];
  lastDayErrorsByPlayer: string[][];
  unprocessedOffersByDay: PotionOffer[][];
  processedMarketByDay: ProcessedMarket[];
  // Detailed day-by-day records
  dayRecords: DayRecord[];
  // AI-chosen player names (set at game start)
  playerNames?: string[];
  // Players that have been disqualified due to errors (by index)
  disqualifiedPlayers?: { playerIdx: number; reason: string }[];
  // Token usage and cost tracking per player (by index)
  playerUsageStats?: PlayerUsageStats[];
};

export type ProcessedMarket = {
  processedOffers: PotionOffer[];
  potionInformation: Record<
    PotionId,
    {
      fulfilled: number;
      remaining: number;
      highestPrice: number;
      lowestPrice: number;
    }
  >;
};

export type PotionOffer = {
  potionId: PotionId;
  price: number;
  qty: number;
  actuallySold?: number;
  playerIdx?: number;
};

export type PlayerOutputs = {
  buyHerbs: { herbId: HerbId; qty: number }[];
  makePotions: { potionId: PotionId; qty: number }[];
  potionOffers: PotionOffer[];
};

export const playerOutputsSchema = z.object({
  buyHerbs: z.array(
    z.object({
      herbId: z.string().regex(/^H(0[1-9]|1[0-2])$/),
      qty: z.number().int().nonnegative(),
    })
  ),
  makePotions: z.array(
    z.object({
      potionId: z.string().regex(/^P(0[1-9]|1[0-8])$/),
      qty: z.number().int().nonnegative(),
    })
  ),
  potionOffers: z.array(
    z.object({
      potionId: z.string().regex(/^P(0[1-9]|1[0-8])$/),
      price: z.number().int().positive(),
      qty: z.number().int().nonnegative(),
    })
  ),
});

export type PlayerOutputsSchema = z.infer<typeof playerOutputsSchema>;

export type PlayerInputs = {
  inventory: PlayerInventory;
  dailyPrices: Record<HerbId, number>;
  historicDemands: Record<
    PotionId,
    {
      fulfilled: number;
      remaining: number;
      highestPrice: number;
      lowestPrice: number;
    }
  >[];
  yesterdaysErrors: string[];
  yesterdaysExecutedOffers: PotionOffer[];
  meta: {
    playCount: number;
    totalDays: number;
    currentDay: number;
  };
};

export type Tier = "T1" | "T2" | "T3";

export type HerbId =
  | "H01"
  | "H02"
  | "H03"
  | "H04"
  | "H05"
  | "H06"
  | "H07"
  | "H08"
  | "H09"
  | "H10"
  | "H11"
  | "H12";

export type PotionId =
  | "P01"
  | "P02"
  | "P03"
  | "P04"
  | "P05"
  | "P06"
  | "P07"
  | "P08"
  | "P09"
  | "P10"
  | "P11"
  | "P12"
  | "P13"
  | "P14"
  | "P15"
  | "P16"
  | "P17"
  | "P18";

export const HERB_NAMES: Record<HerbId, string> = {
  H01: "Dreamleaf",
  H02: "Stormvine",
  H03: "Ashen Thistle",
  H04: "Moonpetal",

  H05: "Ironbark Needles",
  H06: "Starbloom",
  H07: "Embermoss",
  H08: "Marrowmint",

  H09: "Whispering Tansy",
  H10: "Frostcap Fern",
  H11: "Silverdew Grass",
  H12: "Crystalline Sage",
};

export const HERB_TIERS: Record<Tier, HerbId[]> = {
  T1: ["H01", "H02", "H03", "H04"],
  T2: ["H05", "H06", "H07", "H08"],
  T3: ["H09", "H10", "H11", "H12"],
} as const;

export const POTION_NAMES: Record<PotionId, string> = {
  P01: "Minor Potion of Healing",
  P02: "Potion of Healing",
  P03: "Greater Potion of Healing",

  P04: "Minor Potion of Strength",
  P05: "Potion of Strength",
  P06: "Greater Potion of Strength",

  P07: "Minor Potion of Agility",
  P08: "Potion of Agility",
  P09: "Greater Potion of Agility",

  P10: "Minor Potion of Intelligence",
  P11: "Potion of Intelligence",
  P12: "Greater Potion of Intelligence",

  P13: "Minor Potion of Endurance",
  P14: "Potion of Endurance",
  P15: "Greater Potion of Endurance",

  P16: "Minor Potion of Willpower",
  P17: "Potion of Willpower",
  P18: "Greater Potion of Willpower",
};

export const POTION_TIERS: Record<Tier, PotionId[]> = {
  T1: ["P01", "P04", "P07", "P10", "P13", "P16"],
  T2: ["P02", "P05", "P08", "P11", "P14", "P17"],
  T3: ["P03", "P06", "P09", "P12", "P15", "P18"],
} as const;

export const POTION_TIER_LOOKUP: Record<PotionId, Tier> = {
  P01: "T1",
  P02: "T2",
  P03: "T3",
  P04: "T1",
  P05: "T2",
  P06: "T3",
  P07: "T1",
  P08: "T2",
  P09: "T3",
  P10: "T1",
  P11: "T2",
  P12: "T3",
  P13: "T1",
  P14: "T2",
  P15: "T3",
  P16: "T1",
  P17: "T2",
  P18: "T3",
} as const;

// === Recipes: each potion uses exactly two herbs of same tier ===

export const RECIPES: Record<PotionId, HerbId[]> = {
  // Healing
  P01: ["H01", "H02"], // T1: Dreamleaf + Stormvine
  P02: ["H05", "H06"], // T2: Ironbark + Starbloom
  P03: ["H09", "H10"], // T3: Tansy + Frostcap

  // Strength
  P04: ["H02", "H03"], // T1
  P05: ["H06", "H07"], // T2
  P06: ["H10", "H11"], // T3

  // Agility
  P07: ["H03", "H04"], // T1
  P08: ["H07", "H08"], // T2
  P09: ["H11", "H12"], // T3

  // Intelligence
  P10: ["H04", "H01"], // T1
  P11: ["H08", "H05"], // T2
  P12: ["H12", "H09"], // T3

  // Endurance
  P13: ["H01", "H03"], // T1
  P14: ["H05", "H07"], // T2
  P15: ["H09", "H11"], // T3

  // Willpower
  P16: ["H02", "H04"], // T1
  P17: ["H06", "H08"], // T2
  P18: ["H10", "H12"], // T3
} as const;
