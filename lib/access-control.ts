// Access control types and utilities

// Prefix for all KV keys to namespace our data
export const KV_PREFIX = "thealchemist:";

export type ModelTier = 1 | 2 | 3 | 4 | 5;

export type AccessCode = {
  code: string;
  maxGames: number;
  maxModelTier: ModelTier;
  maxDays: number;
  maxPlayers: number;
  usedGames: number;
  createdAt: number;
  note?: string;
};

export type AccessCodeCreateInput = {
  maxGames: number;
  maxModelTier: ModelTier;
  maxDays: number;
  maxPlayers: number;
  note?: string;
};

export type AccessValidation = {
  valid: boolean;
  code?: AccessCode;
  error?: string;
  remainingGames?: number;
};

// Generate a random access code
export function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 to avoid confusion
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Format as XXXX-XXXX for readability
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// Get KV key for an access code
export function getCodeKey(code: string): string {
  return `${KV_PREFIX}access_code:${code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")}`;
}

// Get the pattern for listing all access codes
export function getCodePattern(): string {
  return `${KV_PREFIX}access_code:*`;
}

// Normalize code input (uppercase, remove non-alphanumeric except dash)
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

// Curated games types and helpers
export type CuratedGamePlayer = {
  name: string;
  model: string;
  isHuman?: boolean;
  strategyPrompt?: string;
};

export type CuratedGame = {
  runId: string;
  seed: string;
  title: string;
  description?: string;
  players: CuratedGamePlayer[];
  totalDays: number;
  winner?: string;
  addedAt: number;
};

export type CuratedGameInput = {
  runId: string;
  seed: string;
  title: string;
  description?: string;
  players: CuratedGamePlayer[];
  totalDays: number;
  winner?: string;
};

// KV key for the curated games list
export function getCuratedGamesKey(): string {
  return `${KV_PREFIX}curated_games`;
}

// Default strategies types and helpers
export type DefaultStrategy = {
  id: string;
  name: string;
  prompt: string;
  createdAt: number;
};

export type DefaultStrategyInput = {
  name: string;
  prompt: string;
};

// KV key for default strategies
export function getDefaultStrategiesKey(): string {
  return `${KV_PREFIX}default_strategies`;
}

// Server-side functions (for use in RSC)
import { kv } from "@vercel/kv";

export async function getCuratedGames(): Promise<CuratedGame[]> {
  try {
    const games = await kv.get<CuratedGame[]>(getCuratedGamesKey());
    return games || [];
  } catch (error) {
    console.error("Error fetching curated games:", error);
    return [];
  }
}

export async function getDefaultStrategies(): Promise<DefaultStrategy[]> {
  try {
    const strategies = await kv.get<DefaultStrategy[]>(
      getDefaultStrategiesKey()
    );
    return strategies || [];
  } catch (error) {
    console.error("Error fetching default strategies:", error);
    return [];
  }
}
