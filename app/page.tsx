import { getCuratedGames, getDefaultStrategies } from "@/lib/access-control";
import { AccessProvider } from "@/lib/contexts/access-context";
import GameContent from "./components/GameContent";

// Revalidate every 6 hours (ISR)
export const revalidate = 21600;

export default async function Home() {
  // Fetch data on the server
  const [curatedGames, defaultStrategies] = await Promise.all([
    getCuratedGames(),
    getDefaultStrategies(),
  ]);

  return (
    <AccessProvider>
      <GameContent
        initialCuratedGames={curatedGames}
        initialDefaultStrategies={defaultStrategies}
      />
    </AccessProvider>
  );
}
