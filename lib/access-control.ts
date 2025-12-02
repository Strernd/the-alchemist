// Access control types and utilities

// Prefix for all KV keys to namespace our data
export const KV_PREFIX = 'thealchemist:';

export type ModelTier = 1 | 2 | 3 | 4 | 5;

export type AccessCode = {
  code: string;
  maxGames: number;
  maxModelTier: ModelTier;
  maxDays: number;
  usedGames: number;
  createdAt: number;
  note?: string;
};

export type AccessCodeCreateInput = {
  maxGames: number;
  maxModelTier: ModelTier;
  maxDays: number;
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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Format as XXXX-XXXX for readability
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// Get KV key for an access code
export function getCodeKey(code: string): string {
  return `${KV_PREFIX}access_code:${code.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
}

// Get the pattern for listing all access codes
export function getCodePattern(): string {
  return `${KV_PREFIX}access_code:*`;
}

// Normalize code input (uppercase, remove non-alphanumeric except dash)
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9-]/g, '');
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

