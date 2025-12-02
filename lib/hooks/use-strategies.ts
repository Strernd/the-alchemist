"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DefaultStrategy } from "@/lib/access-control";

export type Strategy = {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  isDefault?: boolean; // True for admin-created default strategies
};

const STORAGE_KEY = "alchemist-strategies";

export function useStrategies(initialDefaultStrategies: DefaultStrategy[] = []) {
  const [userStrategies, setUserStrategies] = useState<Strategy[]>([]);
  const [defaultStrategies, setDefaultStrategies] = useState<Strategy[]>(() =>
    initialDefaultStrategies.map((s) => ({
      id: s.id,
      name: s.name,
      prompt: s.prompt,
      createdAt: new Date(s.createdAt).toISOString(),
      isDefault: true,
    }))
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Load user strategies from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUserStrategies(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load strategies:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save user strategies to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userStrategies));
      } catch (error) {
        console.error("Failed to save strategies:", error);
      }
    }
  }, [userStrategies, isLoaded]);

  // Combined strategies: default strategies first, then user strategies
  const strategies = useMemo(() => {
    return [...defaultStrategies, ...userStrategies];
  }, [defaultStrategies, userStrategies]);

  const addStrategy = useCallback((name: string, prompt: string) => {
    const newStrategy: Strategy = {
      id: `strategy-${Date.now()}`,
      name: name.trim(),
      prompt: prompt.trim(),
      createdAt: new Date().toISOString(),
      isDefault: false,
    };
    setUserStrategies((prev) => [...prev, newStrategy]);
    return newStrategy.id;
  }, []);

  const updateStrategy = useCallback(
    (id: string, updates: Partial<Pick<Strategy, "name" | "prompt">>) => {
      // Can only update user strategies, not default ones
      setUserStrategies((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    },
    []
  );

  const deleteStrategy = useCallback((id: string) => {
    // Can only delete user strategies, not default ones
    setUserStrategies((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const getStrategy = useCallback(
    (id: string) => {
      return strategies.find((s) => s.id === id);
    },
    [strategies]
  );

  // Refresh default strategies (for admin use after mutations)
  const refreshDefaultStrategies = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/strategies");
      if (res.ok) {
        const data = await res.json();
        setDefaultStrategies(
          (data.strategies || []).map((s: DefaultStrategy) => ({
            id: s.id,
            name: s.name,
            prompt: s.prompt,
            createdAt: new Date(s.createdAt).toISOString(),
            isDefault: true,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to refresh default strategies:", error);
    }
  }, []);

  return {
    strategies,
    userStrategies,
    defaultStrategies,
    isLoaded,
    addStrategy,
    updateStrategy,
    deleteStrategy,
    getStrategy,
    refreshDefaultStrategies,
  };
}
