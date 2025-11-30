"use client";

import { useCallback, useEffect, useState } from "react";
import { GameState, Player } from "@/lib/types";

export type GamePhase = "setup" | "running" | "completed" | "error";

export interface GameStreamState {
  phase: GamePhase;
  runId: string | null;
  seed: string | null;
  gameStates: GameState[];
  players: Player[];
  error: string | null;
  totalDaysConfig: number;
}

export type StoredRun = {
  runId: string;
  seed: string;
  playerNames: string[];
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
    const updated = [run, ...runs.filter((r) => r.runId !== run.runId)].slice(0, 20);
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

export function useGameStream() {
  const [state, setState] = useState<GameStreamState>({
    phase: "setup",
    runId: null,
    seed: null,
    gameStates: [],
    players: [],
    error: null,
    totalDaysConfig: 5,
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
          const invalidRuns = storedRuns.filter((r) => !validRunIds.has(r.runId));
          invalidRuns.forEach((r) => removeStoredRun(r.runId));
        }
      } catch (e) {
        console.error("Failed to fetch runs:", e);
      }
      setLoadingRuns(false);
    }
    fetchRuns();
  }, [state.phase]); // Refetch when phase changes (e.g., after completing a game)

  const startGame = useCallback(async (players: Player[], seed?: string) => {
    setState((prev) => ({
      ...prev,
      phase: "running",
      players,
      gameStates: [],
      error: null,
    }));

    try {
      // Start the game workflow
      const response = await fetch("/api/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players, seed }),
      });

      if (!response.ok) {
        throw new Error("Failed to start game");
      }

      const { runId, seed: gameSeed } = await response.json();
      setState((prev) => ({ ...prev, runId, seed: gameSeed }));

      // Save the run to localStorage
      saveRun({
        runId,
        seed: gameSeed,
        playerNames: players.map((p) => p.name),
        createdAt: new Date().toISOString(),
      });

      // Connect to the stream
      await streamGameData(runId, players);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }, []);

  const loadExistingRun = useCallback(async (runInfo: RunInfo) => {
    // Find the stored run to get player info
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

    // Create Player objects from stored names
    const players: Player[] = storedRun.playerNames.map((name) => ({
      name,
      model: "unknown", // Model info not stored, but not needed for viewing
    }));

    setState((prev) => ({
      ...prev,
      phase: runInfo.status === "completed" ? "completed" : "running",
      runId: runInfo.runId,
      seed: runInfo.seed,
      players,
      gameStates: [],
      error: null,
    }));

    try {
      // Connect to the stream to get data
      await streamGameData(runInfo.runId, players);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: error instanceof Error ? error.message : "Failed to load run",
      }));
    }
  }, []);

  const streamGameData = async (runId: string, _players: Player[]) => {
    console.log("[Game] Connecting to stream for run:", runId);
    
    const streamResponse = await fetch(`/api/game/stream/${runId}`);
    if (!streamResponse.ok || !streamResponse.body) {
      console.error("[Game] Stream connection failed:", streamResponse.status);
      throw new Error("Failed to connect to game stream");
    }

    console.log("[Game] Stream connected, reading data...");
    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let statesReceived = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("[Game] Stream ended. Total states received:", statesReceived);
          setState((prev) => ({ ...prev, phase: "completed" }));
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
            console.log("[Game] Received state #", statesReceived, "currentDay:", gameState.currentDay);
            setState((prev) => ({
              ...prev,
              gameStates: [...prev.gameStates, gameState],
            }));
          } catch (e) {
            console.log("[Game] Skipping non-JSON line:", trimmed.substring(0, 100));
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
    });
  }, []);

  // Game states: [initial, afterDay1, afterDay2, afterDay3, afterDay4, afterDay5]
  // We want to show days 1-5, so we skip the initial state
  const processedDays = state.gameStates.slice(1);

  return {
    ...state,
    startGame,
    loadExistingRun,
    deleteRun,
    reset,
    pastRuns,
    loadingRuns,
    dayStates: processedDays,
    currentDayState: processedDays[processedDays.length - 1] ?? null,
    daysCompleted: processedDays.length,
    totalDays: state.totalDaysConfig,
  };
}
