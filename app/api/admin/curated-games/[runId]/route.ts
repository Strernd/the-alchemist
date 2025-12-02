import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { requireAdmin } from '@/lib/admin-auth';
import { CuratedGame, getCuratedGamesKey } from '@/lib/access-control';
import { revalidatePath } from 'next/cache';

// DELETE - Remove a game from curated list
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { runId } = await params;

    // Get existing games
    const games = await kv.get<CuratedGame[]>(getCuratedGamesKey()) || [];

    // Filter out the game to remove
    const filteredGames = games.filter(g => g.runId !== runId);

    if (filteredGames.length === games.length) {
      return NextResponse.json({ error: 'Game not found in curated list' }, { status: 404 });
    }

    await kv.set(getCuratedGamesKey(), filteredGames);

    // Revalidate the home page to update curated games
    revalidatePath('/');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing curated game:', error);
    return NextResponse.json({ error: 'Failed to remove curated game' }, { status: 500 });
  }
}

