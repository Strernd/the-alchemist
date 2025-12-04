"use client";

import { CuratedGame, DefaultStrategy } from "@/lib/access-control";
import { useAccess } from "@/lib/contexts/access-context";
import { useGameStream } from "@/lib/hooks/use-game-stream";
import { Player } from "@/lib/types";
import GameView from "./GameView";
import PlayerSetup from "./PlayerSetup";

interface GameContentProps {
  initialCuratedGames: CuratedGame[];
  initialDefaultStrategies: DefaultStrategy[];
}

export default function GameContent({
  initialCuratedGames,
  initialDefaultStrategies,
}: GameContentProps) {
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
    waitingForHuman,
    connectionLost,
    isReconnecting,
    startGame,
    loadExistingRun,
    deleteRun,
    reset,
    reconnect,
    submitHumanTurn,
  } = useGameStream();

  const {
    accessCode,
    remainingGames,
    consumeGame,
    clearCode,
    validateCode,
    isValidating,
    hasAccess,
  } = useAccess();

  const handleStartGame = async (
    selectedPlayers: Player[],
    options?: { seed?: string; days?: number }
  ) => {
    if (!hasAccess) {
      console.error("No valid access code");
      return;
    }
    // Consume a game from the access code
    const consumed = await consumeGame();
    if (!consumed) {
      console.error("Failed to consume game from access code");
      return;
    }
    startGame(selectedPlayers, options);
  };

  if (phase === "setup") {
    return (
      <PlayerSetup
        onStartGame={handleStartGame}
        onLoadRun={loadExistingRun}
        onDeleteRun={deleteRun}
        pastRuns={pastRuns}
        loadingRuns={loadingRuns}
        accessCode={accessCode}
        remainingGames={remainingGames}
        hasAccess={hasAccess}
        isValidating={isValidating}
        onClearCode={clearCode}
        onValidateCode={validateCode}
        initialCuratedGames={initialCuratedGames}
        initialDefaultStrategies={initialDefaultStrategies}
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
          <p className="pixel-text text-[var(--pixel-text-dim)] mb-6">
            {error}
          </p>
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
      waitingForHuman={waitingForHuman}
      connectionLost={connectionLost}
      isReconnecting={isReconnecting}
      onReset={reset}
      onReconnect={reconnect}
      onSubmitHumanTurn={submitHumanTurn}
    />
  );
}
