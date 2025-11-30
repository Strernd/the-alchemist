"use client";

import { useGameStream } from "@/lib/hooks/use-game-stream";
import PlayerSetup from "./components/PlayerSetup";
import GameView from "./components/GameView";
import { Player } from "@/lib/types";

export default function Home() {
  const {
    phase,
    dayStates,
    players,
    seed,
    error,
    daysCompleted,
    totalDays,
    pastRuns,
    loadingRuns,
    startGame,
    loadExistingRun,
    deleteRun,
    reset,
  } = useGameStream();

  const handleStartGame = (selectedPlayers: Player[], customSeed?: string) => {
    startGame(selectedPlayers, customSeed);
  };

  if (phase === "setup") {
    return (
      <PlayerSetup
        onStartGame={handleStartGame}
        onLoadRun={loadExistingRun}
        onDeleteRun={deleteRun}
        pastRuns={pastRuns}
        loadingRuns={loadingRuns}
      />
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 pixel-grid">
        <div className="pixel-frame-gold p-8 text-center max-w-md">
          <div className="text-6xl mb-4">💀</div>
          <h2 className="pixel-title text-lg text-[var(--pixel-red)] mb-4">
            A DARK FORCE INTERVENES
          </h2>
          <p className="pixel-text text-[var(--pixel-text-dim)] mb-6">{error}</p>
          <button onClick={reset} className="pixel-btn pixel-btn-primary">
            TRY AGAIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <GameView
      dayStates={dayStates}
      players={players}
      phase={phase}
      seed={seed}
      daysCompleted={daysCompleted}
      totalDays={totalDays}
      onReset={reset}
    />
  );
}
