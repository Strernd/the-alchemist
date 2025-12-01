"use client";

import { RunInfo } from "@/lib/hooks/use-game-stream";
import { useStrategies, Strategy } from "@/lib/hooks/use-strategies";
import { AI_MODELS, AIModel } from "@/lib/models";
import { Player } from "@/lib/types";
import { useState } from "react";
import GameRulesModal from "./GameRulesModal";

interface PlayerSetupProps {
  onStartGame: (
    players: Player[],
    options?: { seed?: string; days?: number }
  ) => void;
  onLoadRun: (run: RunInfo) => void;
  onDeleteRun: (runId: string) => void;
  pastRuns: RunInfo[];
  loadingRuns: boolean;
}

type PlayerSlot = {
  enabled: boolean;
  modelId: string;
  isHuman: boolean;
  humanName: string;
  strategyId: string; // ID of assigned strategy, empty for none
};

const PLAYER_SPRITES = ["⚗️", "🧪", "🔮", "⚡", "🌿", "💎"];

export default function PlayerSetup({
  onStartGame,
  onLoadRun,
  onDeleteRun,
  pastRuns,
  loadingRuns,
}: PlayerSetupProps) {
  const [playerSlots, setPlayerSlots] = useState<PlayerSlot[]>([
    { enabled: true, modelId: "human", isHuman: true, humanName: "", strategyId: "" },
    { enabled: true, modelId: AI_MODELS[0].id, isHuman: false, humanName: "", strategyId: "" },
    { enabled: false, modelId: AI_MODELS[3].id, isHuman: false, humanName: "", strategyId: "" },
    { enabled: false, modelId: AI_MODELS[5].id, isHuman: false, humanName: "", strategyId: "" },
    { enabled: false, modelId: AI_MODELS[1].id, isHuman: false, humanName: "", strategyId: "" },
    { enabled: false, modelId: AI_MODELS[2].id, isHuman: false, humanName: "", strategyId: "" },
  ]);
  const [seed, setSeed] = useState("");
  const [days, setDays] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "history" | "strategies">("new");
  const [showRules, setShowRules] = useState(false);

  // Strategy management
  const { strategies, addStrategy, updateStrategy, deleteStrategy, getStrategy } = useStrategies();
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [newStrategyName, setNewStrategyName] = useState("");
  const [newStrategyPrompt, setNewStrategyPrompt] = useState("");

  const enabledCount = playerSlots.filter((p) => p.enabled).length;

  const togglePlayer = (index: number) => {
    const newSlots = [...playerSlots];
    if (newSlots[index].enabled && enabledCount <= 1) return;
    newSlots[index].enabled = !newSlots[index].enabled;
    setPlayerSlots(newSlots);
  };

  const setPlayerModel = (index: number, modelId: string) => {
    const newSlots = [...playerSlots];
    newSlots[index].modelId = modelId;
    newSlots[index].isHuman = modelId === "human";
    setPlayerSlots(newSlots);
  };

  const handleStart = () => {
    const players: Player[] = playerSlots
      .filter((slot) => slot.enabled)
      .map((slot) => {
        if (slot.isHuman) {
          return {
            name: slot.humanName.trim() || "You",
            model: "human",
            isHuman: true,
          };
        }
        const model = AI_MODELS.find((m) => m.id === slot.modelId)!;
        const strategy = slot.strategyId ? getStrategy(slot.strategyId) : undefined;
        return {
          name: model.name,
          model: slot.modelId,
          isHuman: false,
          strategyPrompt: strategy?.prompt,
        };
      });
    onStartGame(players, { seed: seed || undefined, days });
  };

  const setPlayerStrategy = (index: number, strategyId: string) => {
    const newSlots = [...playerSlots];
    newSlots[index].strategyId = strategyId;
    setPlayerSlots(newSlots);
  };

  const handleAddStrategy = () => {
    if (newStrategyName.trim() && newStrategyPrompt.trim()) {
      addStrategy(newStrategyName, newStrategyPrompt);
      setNewStrategyName("");
      setNewStrategyPrompt("");
    }
  };

  const handleUpdateStrategy = () => {
    if (editingStrategy && newStrategyName.trim() && newStrategyPrompt.trim()) {
      updateStrategy(editingStrategy.id, { name: newStrategyName, prompt: newStrategyPrompt });
      setEditingStrategy(null);
      setNewStrategyName("");
      setNewStrategyPrompt("");
    }
  };

  const startEditStrategy = (strategy: Strategy) => {
    setEditingStrategy(strategy);
    setNewStrategyName(strategy.name);
    setNewStrategyPrompt(strategy.prompt);
  };

  const cancelEditStrategy = () => {
    setEditingStrategy(null);
    setNewStrategyName("");
    setNewStrategyPrompt("");
  };

  const setHumanName = (index: number, name: string) => {
    const newSlots = [...playerSlots];
    newSlots[index].humanName = name;
    setPlayerSlots(newSlots);
  };

  // Count human players
  const humanCount = playerSlots.filter((p) => p.enabled && p.isHuman).length;

  const getModelsByProvider = () => {
    const providers: Record<string, AIModel[]> = {};
    AI_MODELS.forEach((model) => {
      if (!providers[model.provider]) {
        providers[model.provider] = [];
      }
      providers[model.provider].push(model);
    });
    return providers;
  };

  const modelsByProvider = getModelsByProvider();

  const getPricingDisplay = (tier: number) => {
    return "💰".repeat(tier);
  };

  const getPricingStyle = (tier: number) => {
    if (tier <= 2) return "text-[var(--pixel-green-bright)]";
    if (tier <= 3) return "text-[var(--pixel-gold)]";
    return "text-[var(--pixel-red)]";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-[var(--pixel-green-bright)]";
      case "running":
        return "text-[var(--pixel-gold)]";
      case "failed":
        return "text-[var(--pixel-red)]";
      default:
        return "text-[var(--pixel-text-dim)]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return "✓";
      case "running":
        return "▶";
      case "failed":
        return "✗";
      case "pending":
        return "◌";
      default:
        return "?";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 lg:p-8 pixel-grid relative">
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-[var(--pixel-gold)] opacity-20" />
      <div className="absolute top-8 left-0 right-0 h-4 bg-[var(--pixel-gold-dark)] opacity-20" />

      {/* Title */}
      <div className="text-center mb-6 lg:mb-8 mt-8">
        <div className="text-6xl mb-4">⚗️</div>
        <h1 className="pixel-title text-2xl lg:text-4xl mb-4">THE ALCHEMIST</h1>
        <p className="pixel-text text-[var(--pixel-text-dim)] max-w-md mx-auto">
          AI Potion Trading Tournament
        </p>
        <button onClick={() => setShowRules(true)} className="pixel-btn mt-4">
          📜 HOW TO PLAY
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("new")}
          className={`pixel-btn ${
            activeTab === "new" ? "pixel-btn-primary" : ""
          }`}
        >
          ⚔ NEW GAME
        </button>
        <button
          onClick={() => setActiveTab("strategies")}
          className={`pixel-btn ${
            activeTab === "strategies" ? "pixel-btn-primary" : ""
          }`}
        >
          🧠 STRATEGIES {strategies.length > 0 && `(${strategies.length})`}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pixel-btn ${
            activeTab === "history" ? "pixel-btn-primary" : ""
          }`}
        >
          📜 HISTORY {pastRuns.length > 0 && `(${pastRuns.length})`}
        </button>
      </div>

      {activeTab === "new" ? (
        <>
          {/* Player Counter */}
          <div className="pixel-frame-gold px-8 py-4 mb-6 flex items-center gap-4">
            <span className="pixel-heading">PLAYERS:</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <div
                  key={num}
                  className={`w-8 h-8 flex items-center justify-center border-4 pixel-heading
                    ${
                      num <= enabledCount
                        ? "bg-[var(--pixel-gold)] border-[var(--pixel-gold-bright)] text-[var(--pixel-black)]"
                        : "bg-[var(--pixel-dark)] border-[var(--pixel-border)] text-[var(--pixel-text-dim)]"
                    }`}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>

          {/* Player Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 max-w-5xl w-full mb-6">
            {playerSlots.map((slot, index) => (
              <div
                key={index}
                onClick={() => !slot.enabled && togglePlayer(index)}
                className={`
                  pixel-frame p-4 lg:p-6 transition-opacity cursor-pointer
                  ${
                    slot.enabled ? "opacity-100" : "opacity-40 hover:opacity-60"
                  }
                  ${slot.enabled ? `player-bg-${index}` : ""}
                `}
                style={{
                  borderColor: slot.enabled
                    ? `var(--player-${index + 1})`
                    : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{PLAYER_SPRITES[index]}</span>
                    <div>
                      <span
                        className={`pixel-heading ${
                          slot.enabled ? `player-color-${index}` : ""
                        }`}
                      >
                        ALCHEMIST {index + 1}
                      </span>
                      <p className="pixel-text-sm text-[var(--pixel-text-dim)]">
                        SLOT {index + 1}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayer(index);
                    }}
                    className={`
                      w-10 h-10 flex items-center justify-center border-4 pixel-heading text-lg
                      transition-colors
                      ${
                        slot.enabled
                          ? "bg-[var(--pixel-red)] border-[var(--pixel-red-dark)] hover:bg-[var(--pixel-red-dark)]"
                          : "bg-[var(--pixel-green)] border-[var(--pixel-green-bright)] hover:bg-[var(--pixel-green-bright)]"
                      }
                    `}
                    disabled={slot.enabled && enabledCount <= 1}
                  >
                    {slot.enabled ? "−" : "+"}
                  </button>
                </div>

                {slot.enabled && (
                  <>
                    <select
                      value={slot.modelId}
                      onChange={(e) => setPlayerModel(index, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="pixel-select w-full mb-3"
                    >
                      <optgroup label="═══ YOU ═══">
                        <option value="human">🎮 HUMAN PLAYER</option>
                      </optgroup>
                      {Object.entries(modelsByProvider).map(
                        ([provider, models]) => (
                          <optgroup
                            key={provider}
                            label={`═══ ${provider} ═══`}
                          >
                            {models.map((model) => (
                              <option key={model.id} value={model.id}>
                                {"💰".repeat(model.tier).padEnd(10, " ")}{" "}
                                {model.name}
                              </option>
                            ))}
                          </optgroup>
                        )
                      )}
                    </select>

                    {slot.isHuman ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={slot.humanName}
                          onChange={(e) => setHumanName(index, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Enter your name..."
                          className="pixel-input w-full"
                          maxLength={25}
                        />
                        <div className="flex items-center justify-between">
                          <span className="pixel-text-sm text-[var(--pixel-green-bright)]">
                            🎮 Human Player
                          </span>
                          <span className="pixel-text-sm text-[var(--pixel-gold)]">
                            FREE
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="pixel-text-sm text-[var(--pixel-text-dim)]">
                            {
                              AI_MODELS.find((m) => m.id === slot.modelId)
                                ?.provider
                            }
                          </span>
                          <span
                            className={`pixel-text-sm ${getPricingStyle(
                              AI_MODELS.find((m) => m.id === slot.modelId)
                                ?.tier || 1
                            )}`}
                            title={`Tier ${
                              AI_MODELS.find((m) => m.id === slot.modelId)
                                ?.tier || 1
                            }/5`}
                          >
                            {getPricingDisplay(
                              AI_MODELS.find((m) => m.id === slot.modelId)
                                ?.tier || 1
                            )}
                          </span>
                        </div>
                        {/* Strategy Selector */}
                        <select
                          value={slot.strategyId}
                          onChange={(e) => setPlayerStrategy(index, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="pixel-select w-full text-xs"
                        >
                          <option value="">🧠 No Strategy</option>
                          {strategies.map((s) => (
                            <option key={s.id} value={s.id}>
                              🧠 {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {!slot.enabled && (
                  <div className="text-center py-4">
                    <p className="pixel-text-sm text-[var(--pixel-text-dim)]">
                      CLICK TO JOIN
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Advanced Options */}
          <div className="max-w-md w-full mb-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="pixel-text-sm text-[var(--pixel-text-dim)] hover:text-[var(--pixel-gold)] 
                transition-colors flex items-center gap-2 mx-auto"
            >
              {showAdvanced ? "▼" : "▶"} ADVANCED OPTIONS
            </button>

            {showAdvanced && (
              <div className="mt-4 pixel-frame p-4 space-y-4">
                {/* Days */}
                <div>
                  <label className="block pixel-text-sm text-[var(--pixel-gold)] mb-2">
                    GAME DAYS
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={days}
                      onChange={(e) => setDays(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="pixel-text w-8 text-center">{days}</span>
                  </div>
                  <p className="pixel-text-sm text-[var(--pixel-text-dim)] mt-1">
                    1-20 days of trading
                  </p>
                </div>

                {/* Seed */}
                <div>
                  <label className="block pixel-text-sm text-[var(--pixel-gold)] mb-2">
                    GAME SEED
                  </label>
                  <input
                    type="text"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="Leave empty for random..."
                    className="pixel-input w-full"
                  />
                  <p className="pixel-text-sm text-[var(--pixel-text-dim)] mt-1">
                    Same seed = same market conditions
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={enabledCount < 1}
            className="pixel-btn pixel-btn-primary text-sm lg:text-base px-8 lg:px-12 py-4 lg:py-6 pixel-pulse"
          >
            ⚔ BEGIN TOURNAMENT ⚔
          </button>

          <p className="pixel-text-sm text-[var(--pixel-text-dim)] mt-4 text-center">
            {humanCount > 0 ? (
              <>
                <span className="text-[var(--pixel-green-bright)]">YOU</span>
                {enabledCount > 1 && (
                  <>
                    {" + "}
                    {enabledCount - humanCount} AI
                    {enabledCount - humanCount !== 1 ? "s" : ""}
                  </>
                )}
              </>
            ) : (
              <>
                {enabledCount} AI{enabledCount !== 1 ? "s" : ""}
              </>
            )}{" "}
            WILL COMPETE
            <br />
            OVER {days} DAY{days !== 1 ? "S" : ""} OF TRADING
          </p>
        </>
      ) : activeTab === "strategies" ? (
        /* Strategies Tab */
        <div className="w-full max-w-3xl">
          <div className="pixel-frame p-4">
            <h2 className="pixel-heading text-center mb-4">
              🧠 STRATEGY PROMPTS
            </h2>
            <p className="pixel-text-sm text-[var(--pixel-text-dim)] text-center mb-4">
              Create custom strategies to guide AI decision-making
            </p>

            {/* Add/Edit Strategy Form */}
            <div className="pixel-frame p-4 mb-4">
              <h3 className="pixel-text-sm text-[var(--pixel-gold)] mb-3">
                {editingStrategy ? "✏️ EDIT STRATEGY" : "➕ NEW STRATEGY"}
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newStrategyName}
                  onChange={(e) => setNewStrategyName(e.target.value)}
                  placeholder="Strategy name (e.g., Aggressive Pricing)"
                  className="pixel-input w-full"
                  maxLength={50}
                />
                <textarea
                  value={newStrategyPrompt}
                  onChange={(e) => setNewStrategyPrompt(e.target.value)}
                  placeholder="Strategy instructions (e.g., Focus on T3 potions. Undercut competitors by 10%. Never hold inventory overnight...)"
                  className="pixel-input w-full h-32 resize-none"
                  maxLength={1000}
                />
                <div className="flex gap-2">
                  {editingStrategy ? (
                    <>
                      <button
                        onClick={handleUpdateStrategy}
                        disabled={!newStrategyName.trim() || !newStrategyPrompt.trim()}
                        className="pixel-btn pixel-btn-primary flex-1"
                      >
                        ✓ SAVE CHANGES
                      </button>
                      <button
                        onClick={cancelEditStrategy}
                        className="pixel-btn"
                      >
                        ✗ CANCEL
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleAddStrategy}
                      disabled={!newStrategyName.trim() || !newStrategyPrompt.trim()}
                      className="pixel-btn pixel-btn-primary w-full"
                    >
                      + ADD STRATEGY
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Strategy List */}
            {strategies.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📝</div>
                <p className="pixel-text text-[var(--pixel-text-dim)]">
                  No strategies yet
                </p>
                <p className="pixel-text-sm text-[var(--pixel-text-dim)] mt-2">
                  Create a strategy above to customize AI behavior
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {strategies.map((strategy) => (
                  <div
                    key={strategy.id}
                    className="pixel-frame p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="pixel-text font-bold truncate">
                          🧠 {strategy.name}
                        </h4>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditStrategy(strategy)}
                          className="pixel-btn text-xs px-2 py-1"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteStrategy(strategy.id)}
                          className="pixel-btn text-xs px-2 py-1 hover:border-[var(--pixel-red)] hover:text-[var(--pixel-red)]"
                          title="Delete"
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                    <p className="pixel-text-sm text-[var(--pixel-text-dim)] whitespace-pre-wrap line-clamp-3">
                      {strategy.prompt}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={() => setActiveTab("new")}
              className="pixel-btn pixel-btn-primary"
            >
              ⚔ BACK TO GAME SETUP
            </button>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="w-full max-w-3xl">
          <div className="pixel-frame p-4">
            <h2 className="pixel-heading text-center mb-4">
              📜 PAST TOURNAMENTS
            </h2>

            {loadingRuns ? (
              <div className="text-center py-8">
                <p className="pixel-text text-[var(--pixel-text-dim)]">
                  Loading<span className="loading-dots"></span>
                </p>
              </div>
            ) : pastRuns.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📭</div>
                <p className="pixel-text text-[var(--pixel-text-dim)]">
                  No past games found
                </p>
                <p className="pixel-text-sm text-[var(--pixel-text-dim)] mt-2">
                  Start a new tournament to see it here!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pastRuns.map((run) => (
                  <div
                    key={run.runId}
                    className="pixel-frame p-4 hover:border-[var(--pixel-gold)] transition-colors cursor-pointer"
                    onClick={() => onLoadRun(run)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`pixel-text-sm ${getStatusColor(
                              run.status
                            )}`}
                          >
                            {getStatusIcon(run.status)}
                          </span>
                          <span className="pixel-heading truncate">
                            {(() => {
                              const names = run.players?.map(p => p.name) || run.playerNames || [];
                              return (
                                <>
                                  {names.slice(0, 3).join(" vs ")}
                                  {names.length > 3 && ` +${names.length - 3}`}
                                </>
                              );
                            })()}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span className="pixel-text-sm text-[var(--pixel-text-dim)]">
                            SEED:{" "}
                            <span className="text-[var(--pixel-gold)]">
                              {run.seed}
                            </span>
                          </span>
                          <span className="pixel-text-sm text-[var(--pixel-text-dim)]">
                            {formatDate(run.createdAt)}
                          </span>
                          <span
                            className={`pixel-text-sm uppercase ${getStatusColor(
                              run.status
                            )}`}
                          >
                            {run.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadRun(run);
                          }}
                          className="pixel-btn text-xs"
                        >
                          {run.status === "running" ? "▶ VIEW" : "👁 REPLAY"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRun(run.runId);
                          }}
                          className="pixel-btn text-xs hover:border-[var(--pixel-red)] hover:text-[var(--pixel-red)]"
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={() => setActiveTab("new")}
              className="pixel-btn pixel-btn-primary"
            >
              ⚔ START NEW GAME
            </button>
          </div>
        </div>
      )}

      {/* Decorative bottom border */}
      <div className="absolute bottom-8 left-0 right-0 h-4 bg-[var(--pixel-gold-dark)] opacity-20" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-[var(--pixel-gold)] opacity-20" />

      {/* Rules Modal */}
      <GameRulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
    </div>
  );
}
