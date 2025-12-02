import { AccessProvider } from "@/lib/contexts/access-context";
import { getCuratedGames } from "@/lib/access-control";
import GameContent from "./components/GameContent";

// Revalidate curated games every 6 hours (ISR)
export const revalidate = 60 * 60 * 6;

export default async function Home() {
  // Fetch curated games on the server
  const curatedGames = await getCuratedGames();

  return (
    <AccessProvider>
      <GameContent initialCuratedGames={curatedGames} />
    </AccessProvider>
  );
}
