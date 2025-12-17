"use client";

import { GameState, Player, PlayerOutputs } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export type GamePhase = "setup" | "running" | "completed" | "error";

export interface GameStreamState {
  phase: GamePhase;
  runId: string | null;
  seed: string | null;
  gameStates: GameState[];
  players: Player[];
  error: string | null;
  totalDaysConfig: number;
  connectionLost: boolean;
  reconnectAttempts: number;
  isReconnecting: boolean;
}

export type StoredPlayer = {
  name: string;
  model: string;
  isHuman?: boolean;
  strategyPrompt?: string;
};

export type StoredRun = {
  runId: string;
  seed: string;
  // New format: full player info
  players?: StoredPlayer[];
  // Legacy format: just names (for backward compatibility)
  playerNames?: string[];
  createdAt: string;
};

export type RunInfo = StoredRun & {
  status: string;
  completedAt: string | null;
};

const STORAGE_KEY = "alchemist-runs";

function getStoredRuns(): StoredRun[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRun(run: StoredRun) {
  if (typeof window === "undefined") return;
  try {
    const runs = getStoredRuns();
    // Add to beginning, limit to 20 runs
    const updated = [run, ...runs.filter((r) => r.runId !== run.runId)].slice(
      0,
      20
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save run:", e);
  }
}

function removeStoredRun(runId: string) {
  if (typeof window === "undefined") return;
  try {
    const runs = getStoredRuns();
    const updated = runs.filter((r) => r.runId !== runId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to remove run:", e);
  }
}

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

export function useGameStream() {
  const [state, setState] = useState<GameStreamState>({
    phase: "setup",
    runId: null,
    seed: null,
    gameStates: [],
    players: [],
    error: null,
    totalDaysConfig: 5,
    connectionLost: false,
    reconnectAttempts: 0,
    isReconnecting: false,
  });

  const [pastRuns, setPastRuns] = useState<RunInfo[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);

  // Fetch past runs on mount
  useEffect(() => {
    async function fetchRuns() {
      setLoadingRuns(true);
      try {
        const storedRuns = getStoredRuns();
        if (storedRuns.length === 0) {
          setPastRuns([]);
          setLoadingRuns(false);
          return;
        }

        const response = await fetch("/api/game/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runIds: storedRuns }),
        });

        if (response.ok) {
          const { runs } = await response.json();
          setPastRuns(runs);

          // Clean up runs that no longer exist
          const validRunIds = new Set(runs.map((r: RunInfo) => r.runId));
          const invalidRuns = storedRuns.filter(
            (r) => !validRunIds.has(r.runId)
          );
          invalidRuns.forEach((r) => removeStoredRun(r.runId));
        }
      } catch (e) {
        console.error("Failed to fetch runs:", e);
      }
      setLoadingRuns(false);
    }
    fetchRuns();
  }, [state.phase]); // Refetch when phase changes (e.g., after completing a game)

  const startGame = useCallback(
    async (players: Player[], options?: { seed?: string; days?: number }) => {
      const days = options?.days || 5;
      setState((prev) => ({
        ...prev,
        phase: "running",
        players,
        gameStates: [],
        error: null,
        totalDaysConfig: days,
      }));

      try {
        // Start the game workflow
        const response = await fetch("/api/game/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ players, seed: options?.seed, days }),
        });

        if (!response.ok) {
          throw new Error("Failed to start game");
        }

        const { runId, seed: gameSeed } = await response.json();
        setState((prev) => ({ ...prev, runId, seed: gameSeed }));

        // Save placeholder run - names will be updated when AI chooses them
        saveRun({
          runId,
          seed: gameSeed,
          players: players.map((p, i) => ({
            name: `Alchemist ${i + 1}`,
            model: p.model,
            isHuman: p.isHuman,
            strategyPrompt: p.strategyPrompt,
          })),
          createdAt: new Date().toISOString(),
        });

        // Connect to the stream (will update names when first state arrives)
        await streamGameData(runId, players);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          phase: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      }
    },
    []
  );

  const loadExistingRun = useCallback(async (runInfo: RunInfo) => {
    // Create Player objects from run info
    // First try runInfo.players (curated games pass this directly)
    // Then fall back to localStorage (user's own runs)
    let players: Player[];

    if (runInfo.players && runInfo.players.length > 0) {
      // Player data provided directly (e.g., from curated games)
      players = runInfo.players.map((p) => ({
        name: p.name,
        model: p.model,
        isHuman: p.isHuman,
        strategyPrompt: p.strategyPrompt,
      }));
    } else {
      // Fall back to localStorage for user's own runs
      const storedRuns = getStoredRuns();
      const storedRun = storedRuns.find((r) => r.runId === runInfo.runId);

      if (!storedRun) {
        setState((prev) => ({
          ...prev,
          phase: "error",
          error: "Run not found in storage",
        }));
        return;
      }

      if (storedRun.players) {
        // New format with full player info
        players = storedRun.players.map((p) => ({
          name: p.name,
          model: p.model,
          isHuman: p.isHuman,
          strategyPrompt: p.strategyPrompt,
        }));
      } else if (storedRun.playerNames) {
        // Legacy format: just names
        players = storedRun.playerNames.map((name) => ({
          name,
          model: "unknown",
        }));
      } else {
        players = [];
      }
    }

    const isAlreadyCompleted = runInfo.status === "completed";

    setState((prev) => ({
      ...prev,
      phase: isAlreadyCompleted ? "completed" : "running",
      runId: runInfo.runId,
      seed: runInfo.seed,
      players,
      gameStates: [],
      error: null,
    }));

    try {
      // Connect to the stream to get data
      // Pass isAlreadyCompleted to skip reconnection logic for completed games
      await streamGameData(runInfo.runId, players, 0, isAlreadyCompleted);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: error instanceof Error ? error.message : "Failed to load run",
      }));
    }
  }, []);

  const streamGameData = async (
    runId: string,
    initialPlayers: Player[],
    attemptNumber: number = 0,
    isAlreadyCompleted: boolean = false
  ): Promise<boolean> => {
    console.log(
      "[Game] Connecting to stream for run:",
      runId,
      "attempt:",
      attemptNumber
    );

    // On reconnect, clear existing states since the stream will send everything from the beginning
    setState((prev) => ({
      ...prev,
      isReconnecting: attemptNumber > 0,
      connectionLost: false,
      // Clear gameStates on reconnect to avoid duplicates (stream sends all states from start)
      gameStates: attemptNumber > 0 ? [] : prev.gameStates,
    }));

    const streamResponse = await fetch(`/api/game/stream/${runId}`);
    if (!streamResponse.ok || !streamResponse.body) {
      console.error("[Game] Stream connection failed:", streamResponse.status);
      throw new Error("Failed to connect to game stream");
    }

    console.log("[Game] Stream connected, reading data...");
    setState((prev) => ({
      ...prev,
      isReconnecting: false,
      reconnectAttempts: attemptNumber,
    }));

    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let statesReceived = 0;
    let namesUpdated = attemptNumber > 0; // Skip name update on reconnects
    let gameCompleted = false;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log(
            "[Game] Stream ended. Total states received:",
            statesReceived
          );
          // Check if game actually completed all days before marking as completed
          setState((prev) => {
            const completedDays = prev.gameStates
              .slice(1)
              .filter((gs) => !gs.waitingForHuman).length;
            const totalDays = prev.totalDaysConfig;

            if (completedDays >= totalDays) {
              console.log(
                "[Game] Game completed successfully:",
                completedDays,
                "/",
                totalDays,
                "days"
              );
              gameCompleted = true;
              return { ...prev, phase: "completed", connectionLost: false };
            } else {
              console.warn(
                "[Game] Stream ended early:",
                completedDays,
                "/",
                totalDays,
                "days completed"
              );
              // Don't update state here - we'll handle reconnection logic below
              return prev;
            }
          });
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const gameState = JSON.parse(trimmed) as GameState;
            statesReceived++;
            console.log(
              "[Game] Received state #",
              statesReceived,
              "currentDay:",
              gameState.currentDay
            );

            // Update player names from AI-chosen names (first state only)
            if (
              !namesUpdated &&
              gameState.playerNames &&
              gameState.playerNames.length > 0
            ) {
              const updatedPlayers = initialPlayers.map((p, idx) => ({
                ...p,
                name: gameState.playerNames?.[idx] || p.name,
              }));
              namesUpdated = true;

              // Update localStorage with AI-chosen names
              setState((prev) => {
                if (prev.runId && prev.seed) {
                  saveRun({
                    runId: prev.runId,
                    seed: prev.seed,
                    players: updatedPlayers.map((p) => ({
                      name: p.name,
                      model: p.model,
                      isHuman: p.isHuman,
                      strategyPrompt: p.strategyPrompt,
                    })),
                    createdAt: new Date().toISOString(),
                  });
                }
                return {
                  ...prev,
                  players: updatedPlayers,
                  gameStates: [...prev.gameStates, gameState],
                };
              });
              continue;
            }

            setState((prev) => ({
              ...prev,
              gameStates: [...prev.gameStates, gameState],
            }));
          } catch (e) {
            console.log(
              "[Game] Skipping non-JSON line:",
              trimmed.substring(0, 100)
            );
          }
        }
      }
    } catch (error) {
      console.error("[Game] Stream read error:", error);
      throw error;
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      try {
        const gameState = JSON.parse(buffer.trim()) as GameState;
        statesReceived++;
        console.log("[Game] Received final state #", statesReceived);
        setState((prev) => ({
          ...prev,
          gameStates: [...prev.gameStates, gameState],
        }));
      } catch {
        // Skip
      }
    }

    // If game completed, we're done
    if (gameCompleted) {
      return true;
    }

    // For already completed games (viewing old games), don't try to reconnect
    // The stream just sends historical data and closes - that's expected
    if (isAlreadyCompleted) {
      console.log(
        "[Game] Stream ended for already-completed game - no reconnection needed"
      );
      setState((prev) => ({
        ...prev,
        phase: "completed",
      }));
      return true;
    }

    // Stream ended unexpectedly - try to reconnect
    const nextAttempt = attemptNumber + 1;
    if (nextAttempt < MAX_RECONNECT_ATTEMPTS) {
      console.log(
        `[Game] Attempting reconnect (${nextAttempt}/${MAX_RECONNECT_ATTEMPTS}) in ${RECONNECT_DELAY_MS}ms...`
      );
      setState((prev) => ({
        ...prev,
        isReconnecting: true,
        reconnectAttempts: nextAttempt,
      }));

      // Wait before reconnecting
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));

      // Attempt reconnection
      try {
        return await streamGameData(runId, initialPlayers, nextAttempt, false);
      } catch (reconnectError) {
        console.error("[Game] Reconnect attempt failed:", reconnectError);
        // Fall through to connection lost state
      }
    }

    // Max reconnection attempts reached - show connection lost state
    console.log(
      "[Game] Max reconnection attempts reached, showing connection lost"
    );
    setState((prev) => ({
      ...prev,
      connectionLost: true,
      isReconnecting: false,
    }));
    return false;
  };

  const deleteRun = useCallback((runId: string) => {
    removeStoredRun(runId);
    setPastRuns((prev) => prev.filter((r) => r.runId !== runId));
  }, []);

  const reset = useCallback(() => {
    setState({
      phase: "setup",
      runId: null,
      seed: null,
      gameStates: [],
      players: [],
      error: null,
      totalDaysConfig: 5,
      connectionLost: false,
      reconnectAttempts: 0,
      isReconnecting: false,
    });
  }, []);

  // Manual reconnection function
  const reconnect = useCallback(async () => {
    if (!state.runId || !state.connectionLost) return;

    setState((prev) => ({
      ...prev,
      connectionLost: false,
      reconnectAttempts: 0,
      isReconnecting: true,
    }));

    try {
      await streamGameData(state.runId, state.players, 0);
    } catch (error) {
      console.error("[Game] Manual reconnect failed:", error);
      setState((prev) => ({
        ...prev,
        connectionLost: true,
        isReconnecting: false,
      }));
    }
  }, [state.runId, state.connectionLost, state.players]);

  // Submit human player turn via the hook API
  const submitHumanTurn = useCallback(
    async (hookToken: string, outputs: PlayerOutputs) => {
      console.log("[Game] Submitting human turn for token:", hookToken);
      try {
        const response = await fetch("/api/game/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hookToken, outputs }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("[Game] Human turn submission failed:", error);
          throw new Error(error.error || "Failed to submit turn");
        }

        console.log("[Game] Human turn submitted successfully");
        return true;
      } catch (error) {
        console.error("[Game] Error submitting human turn:", error);
        throw error;
      }
    },
    []
  );

  // Game states: [initial, (waiting1?), afterDay1, (waiting2?), afterDay2, ...]
  // We want to show completed days only - filter out initial state and waiting states
  const processedDays = state.gameStates
    .slice(1) // Skip initial state
    .filter((gs) => !gs.waitingForHuman); // Skip "waiting for human" states

  // Get waiting for human state from the latest game state
  const latestState = state.gameStates[state.gameStates.length - 1];
  const waitingForHuman = latestState?.waitingForHuman;

  return {
    ...state,
    startGame,
    loadExistingRun,
    deleteRun,
    reset,
    reconnect,
    submitHumanTurn,
    pastRuns,
    loadingRuns,
    dayStates: processedDays,
    currentDayState: processedDays[processedDays.length - 1] ?? null,
    daysCompleted: processedDays.length,
    totalDays: state.totalDaysConfig,
    waitingForHuman,
  };
}
