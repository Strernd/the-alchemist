import { CuratedGame, getCuratedGamesKey } from "@/lib/access-control";
import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

// GET - Public endpoint to list curated games (cached via Cache-Control headers)
export async function GET() {
  try {
    const games = (await kv.get<CuratedGame[]>(getCuratedGamesKey())) || [];

    return NextResponse.json(
      { games },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=21600, stale-while-revalidate=21600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching curated games:", error);
    return NextResponse.json({ games: [] });
  }
}
