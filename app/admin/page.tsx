"use client";

import { useState, useEffect, useCallback } from "react";
import { AccessCode, AccessCodeCreateInput } from "@/lib/access-control";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Code management state
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [codeError, setCodeError] = useState("");

  // New code form
  const [newCode, setNewCode] = useState<AccessCodeCreateInput>({
    maxGames: 5,
    maxModelTier: 3,
    maxDays: 10,
    maxPlayers: 6,
    note: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/admin/login");
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
    } catch {
      setIsAuthenticated(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setIsAuthenticated(true);
        setPassword("");
      } else {
        setLoginError("Invalid password");
      }
    } catch {
      setLoginError("Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/login", { method: "DELETE" });
      setIsAuthenticated(false);
      setCodes([]);
    } catch {
      console.error("Logout failed");
    }
  };

  const handleResetSession = async () => {
    try {
      await fetch("/api/admin/login", { method: "DELETE" });
      setIsAuthenticated(false);
      setLoginError("");
      setPassword("");
    } catch {
      console.error("Reset session failed");
    }
  };

  const loadCodes = useCallback(async () => {
    setIsLoadingCodes(true);
    setCodeError("");

    try {
      const res = await fetch("/api/admin/codes");
      if (!res.ok) throw new Error("Failed to load codes");
      const data = await res.json();
      setCodes(data.codes || []);
    } catch (err) {
      setCodeError("Failed to load codes");
      console.error(err);
    } finally {
      setIsLoadingCodes(false);
    }
  }, []);

  // Load codes when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadCodes();
    }
  }, [isAuthenticated, loadCodes]);

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCodeError("");

    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCode),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create code");
      }

      // Reset form and reload codes
      setNewCode({ maxGames: 5, maxModelTier: 3, maxDays: 10, maxPlayers: 6, note: "" });
      await loadCodes();
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : "Failed to create code");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCode = async (code: string) => {
    if (!confirm(`Delete code ${code}?`)) return;

    try {
      const res = await fetch(`/api/admin/codes/${encodeURIComponent(code)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete code");
      await loadCodes();
    } catch (err) {
      setCodeError("Failed to delete code");
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center pixel-grid">
        <div className="pixel-frame-gold p-8 text-center">
          <div className="text-4xl mb-4 pixel-pulse">⚗️</div>
          <p className="pixel-text">Loading...</p>
        </div>
      </div>
    );
  }

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center pixel-grid p-4">
        <div className="pixel-frame-gold p-8 max-w-md w-full">
          <h1 className="pixel-title text-2xl text-center mb-6">🔐 ADMIN LOGIN</h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="pixel-text-sm block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pixel-input w-full"
                placeholder="Enter admin password"
                autoFocus
              />
            </div>

            {loginError && (
              <p className="pixel-text-sm text-[var(--pixel-red)] text-center">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || !password}
              className="pixel-btn pixel-btn-primary w-full py-3"
            >
              {isLoggingIn ? "Logging in..." : "LOGIN"}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <a href="/" className="pixel-text-sm text-[var(--pixel-text-dim)] hover:text-[var(--pixel-gold)] block">
              ← Back to Game
            </a>
            <button
              onClick={handleResetSession}
              className="pixel-text-sm text-[var(--pixel-text-dim)] hover:text-[var(--pixel-red)] underline"
            >
              🔄 Reset Session (if password changed)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen pixel-grid p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="pixel-title text-2xl">⚗️ ADMIN DASHBOARD</h1>
          <div className="flex gap-3">
            <a href="/" className="pixel-btn">
              🎮 GAME
            </a>
            <button onClick={handleResetSession} className="pixel-btn" title="Clear session and re-login (use if password changed)">
              🔄 RESET
            </button>
            <button onClick={handleLogout} className="pixel-btn">
              🚪 LOGOUT
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Code Form */}
          <div className="pixel-frame-gold p-6">
            <h2 className="pixel-heading text-center mb-4">➕ CREATE CODE</h2>

            <form onSubmit={handleCreateCode} className="space-y-4">
              <div>
                <label className="pixel-text-sm block mb-2">Max Games</label>
                <input
                  type="number"
                  value={newCode.maxGames}
                  onChange={(e) => setNewCode({ ...newCode, maxGames: parseInt(e.target.value) || 1 })}
                  className="pixel-input w-full"
                  min={1}
                  max={100}
                />
              </div>

              <div>
                <label className="pixel-text-sm block mb-2">Max Model Tier</label>
                <select
                  value={newCode.maxModelTier}
                  onChange={(e) => setNewCode({ ...newCode, maxModelTier: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5 })}
                  className="pixel-input w-full"
                >
                  <option value={1}>Tier 1 💰 (Cheapest)</option>
                  <option value={2}>Tier 2 💰💰</option>
                  <option value={3}>Tier 3 💰💰💰</option>
                  <option value={4}>Tier 4 💰💰💰💰</option>
                  <option value={5}>Tier 5 💰💰💰💰💰 (All)</option>
                </select>
              </div>

              <div>
                <label className="pixel-text-sm block mb-2">Max Days</label>
                <input
                  type="number"
                  value={newCode.maxDays}
                  onChange={(e) => setNewCode({ ...newCode, maxDays: parseInt(e.target.value) || 1 })}
                  className="pixel-input w-full"
                  min={1}
                  max={30}
                />
              </div>

              <div>
                <label className="pixel-text-sm block mb-2">Max Players</label>
                <input
                  type="number"
                  value={newCode.maxPlayers}
                  onChange={(e) => setNewCode({ ...newCode, maxPlayers: parseInt(e.target.value) || 2 })}
                  className="pixel-input w-full"
                  min={2}
                  max={6}
                />
              </div>

              <div>
                <label className="pixel-text-sm block mb-2">Note (optional)</label>
                <input
                  type="text"
                  value={newCode.note || ""}
                  onChange={(e) => setNewCode({ ...newCode, note: e.target.value })}
                  className="pixel-input w-full"
                  placeholder="e.g., For demo purposes"
                  maxLength={100}
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="pixel-btn pixel-btn-primary w-full py-3"
              >
                {isCreating ? "Creating..." : "🎫 GENERATE CODE"}
              </button>
            </form>
          </div>

          {/* Codes List */}
          <div className="lg:col-span-2 pixel-frame p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="pixel-heading">🎫 ACCESS CODES</h2>
              <button onClick={loadCodes} disabled={isLoadingCodes} className="pixel-btn text-xs">
                {isLoadingCodes ? "..." : "🔄 REFRESH"}
              </button>
            </div>

            {codeError && (
              <p className="pixel-text-sm text-[var(--pixel-red)] mb-4">{codeError}</p>
            )}

            {isLoadingCodes ? (
              <p className="pixel-text text-center py-8">Loading codes...</p>
            ) : codes.length === 0 ? (
              <p className="pixel-text text-center py-8 text-[var(--pixel-text-dim)]">
                No access codes yet. Create one above!
              </p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {codes.map((code) => {
                  const remaining = code.maxGames - code.usedGames;
                  const isExhausted = remaining <= 0;

                  return (
                    <div
                      key={code.code}
                      className={`pixel-frame p-4 ${isExhausted ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <code
                              className="pixel-title text-lg text-[var(--pixel-gold)] cursor-pointer hover:text-[var(--pixel-green-bright)]"
                              onClick={() => copyToClipboard(code.code)}
                              title="Click to copy"
                            >
                              {code.code}
                            </code>
                            <button
                              onClick={() => copyToClipboard(code.code)}
                              className="pixel-btn text-xs px-2 py-1"
                              title="Copy code"
                            >
                              📋
                            </button>
                          </div>

                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="pixel-text-sm">
                              <span className="text-[var(--pixel-text-dim)]">Games:</span>{" "}
                              <span className={isExhausted ? "text-[var(--pixel-red)]" : "text-[var(--pixel-green-bright)]"}>
                                {remaining}/{code.maxGames}
                              </span>
                            </div>
                            <div className="pixel-text-sm">
                              <span className="text-[var(--pixel-text-dim)]">Tier:</span>{" "}
                              <span className="text-[var(--pixel-gold)]">≤{code.maxModelTier}</span>
                            </div>
                            <div className="pixel-text-sm">
                              <span className="text-[var(--pixel-text-dim)]">Days:</span>{" "}
                              <span className="text-[var(--pixel-purple)]">≤{code.maxDays}</span>
                            </div>
                            <div className="pixel-text-sm">
                              <span className="text-[var(--pixel-text-dim)]">Players:</span>{" "}
                              <span className="text-[var(--pixel-blue)]">≤{code.maxPlayers ?? 6}</span>
                            </div>
                          </div>

                          {code.note && (
                            <p className="pixel-text-sm text-[var(--pixel-text-dim)] mt-2 italic">
                              {code.note}
                            </p>
                          )}

                          <p className="pixel-text-sm text-[var(--pixel-text-dim)] mt-1 text-xs">
                            Created: {new Date(code.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <button
                          onClick={() => handleDeleteCode(code.code)}
                          className="pixel-btn text-xs px-2 py-1 text-[var(--pixel-red)]"
                          title="Delete code"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

