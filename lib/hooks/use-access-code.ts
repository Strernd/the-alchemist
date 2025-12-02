"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AccessCode } from "@/lib/access-control";

const STORAGE_KEY = "alchemist_access_code";

export type AccessState = {
  code: string | null;
  accessCode: AccessCode | null;
  remainingGames: number;
  isValidating: boolean;
  error: string | null;
};

async function fetchValidateCode(code: string): Promise<{ valid: boolean; code?: AccessCode; remainingGames?: number; error?: string }> {
  const res = await fetch("/api/access/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return res.json();
}

export function useAccessCode() {
  const [state, setState] = useState<AccessState>({
    code: null,
    accessCode: null,
    remainingGames: 0,
    isValidating: true,
    error: null,
  });

  const hasInitialized = useRef(false);

  // Load and validate stored code on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const storedCode = localStorage.getItem(STORAGE_KEY);
    if (storedCode) {
      fetchValidateCode(storedCode).then((data) => {
        if (data.valid && data.code) {
          setState({
            code: storedCode,
            accessCode: data.code,
            remainingGames: data.remainingGames || 0,
            isValidating: false,
            error: null,
          });
        } else {
          localStorage.removeItem(STORAGE_KEY);
          setState({
            code: null,
            accessCode: null,
            remainingGames: 0,
            isValidating: false,
            error: null,
          });
        }
      }).catch(() => {
        setState((prev) => ({ ...prev, isValidating: false }));
      });
    } else {
      setState((prev) => ({ ...prev, isValidating: false }));
    }
  }, []);

  const validateCode = useCallback(async (code: string) => {
    setState((prev) => ({ ...prev, isValidating: true, error: null }));

    try {
      const data = await fetchValidateCode(code);

      if (data.valid && data.code) {
        localStorage.setItem(STORAGE_KEY, code);
        setState({
          code,
          accessCode: data.code,
          remainingGames: data.remainingGames || 0,
          isValidating: false,
          error: null,
        });
        return true;
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setState({
          code: null,
          accessCode: null,
          remainingGames: 0,
          isValidating: false,
          error: data.error || "Invalid code",
        });
        return false;
      }
    } catch {
      setState((prev) => ({
        ...prev,
        isValidating: false,
        error: "Failed to validate code",
      }));
      return false;
    }
  }, []);

  const consumeGame = useCallback(async (): Promise<boolean> => {
    if (!state.code) return false;

    try {
      const res = await fetch("/api/access/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: state.code }),
      });

      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          remainingGames: data.remainingGames,
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [state.code]);

  const clearCode = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      code: null,
      accessCode: null,
      remainingGames: 0,
      isValidating: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    validateCode,
    consumeGame,
    clearCode,
    hasAccess: !!state.accessCode && state.remainingGames > 0,
  };
}

