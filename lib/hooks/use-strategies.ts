"use client";

import { useState, useEffect, useCallback } from "react";

export type Strategy = {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
};

const STORAGE_KEY = "alchemist-strategies";

export function useStrategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load strategies from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setStrategies(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load strategies:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save strategies to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(strategies));
      } catch (error) {
        console.error("Failed to save strategies:", error);
      }
    }
  }, [strategies, isLoaded]);

  const addStrategy = useCallback((name: string, prompt: string) => {
    const newStrategy: Strategy = {
      id: `strategy-${Date.now()}`,
      name: name.trim(),
      prompt: prompt.trim(),
      createdAt: new Date().toISOString(),
    };
    setStrategies((prev) => [...prev, newStrategy]);
    return newStrategy.id;
  }, []);

  const updateStrategy = useCallback((id: string, updates: Partial<Pick<Strategy, "name" | "prompt">>) => {
    setStrategies((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, ...updates }
          : s
      )
    );
  }, []);

  const deleteStrategy = useCallback((id: string) => {
    setStrategies((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const getStrategy = useCallback((id: string) => {
    return strategies.find((s) => s.id === id);
  }, [strategies]);

  return {
    strategies,
    isLoaded,
    addStrategy,
    updateStrategy,
    deleteStrategy,
    getStrategy,
  };
}

