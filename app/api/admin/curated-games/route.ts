import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { requireAdmin } from '@/lib/admin-auth';
import { CuratedGame, CuratedGameInput, getCuratedGamesKey } from '@/lib/access-control';
import { revalidatePath } from 'next/cache';

// GET - List all curated games (admin view)
export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const games = await kv.get<CuratedGame[]>(getCuratedGamesKey()) || [];
    return NextResponse.json({ games });
  } catch (error) {
    console.error('Error listing curated games:', error);
    return NextResponse.json({ error: 'Failed to list curated games' }, { status: 500 });
  }
}

// POST - Add a game to curated list
export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const input: CuratedGameInput = await request.json();

    // Validate input
    if (!input.runId || !input.seed || !input.title || !input.players?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get existing games
    const games = await kv.get<CuratedGame[]>(getCuratedGamesKey()) || [];

    // Check if already exists
    if (games.some(g => g.runId === input.runId)) {
      return NextResponse.json({ error: 'Game already in curated list' }, { status: 400 });
    }

    // Add new game
    const curatedGame: CuratedGame = {
      ...input,
      addedAt: Date.now(),
    };

    games.unshift(curatedGame); // Add to front of list
    await kv.set(getCuratedGamesKey(), games);

    // Revalidate the home page to pick up new curated games
    revalidatePath('/');

    return NextResponse.json({ game: curatedGame });
  } catch (error) {
    console.error('Error adding curated game:', error);
    return NextResponse.json({ error: 'Failed to add curated game' }, { status: 500 });
  }
}

