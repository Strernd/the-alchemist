"use client";

import { createContext, useContext, ReactNode } from "react";
import { useAccessCode, AccessState } from "@/lib/hooks/use-access-code";
import { AccessCode } from "@/lib/access-control";

type AccessContextType = AccessState & {
  validateCode: (code: string) => Promise<boolean>;
  consumeGame: () => Promise<boolean>;
  clearCode: () => void;
  hasAccess: boolean;
};

const AccessContext = createContext<AccessContextType | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const accessState = useAccessCode();

  return (
    <AccessContext.Provider value={accessState}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess(): AccessContextType {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error("useAccess must be used within an AccessProvider");
  }
  return context;
}

// Helper to get restrictions from access code
export function getRestrictions(accessCode: AccessCode | null) {
  if (!accessCode) {
    return {
      maxModelTier: 5 as const,
      maxDays: 30,
      remainingGames: 0,
    };
  }

  return {
    maxModelTier: accessCode.maxModelTier,
    maxDays: accessCode.maxDays,
    remainingGames: accessCode.maxGames - accessCode.usedGames,
  };
}

