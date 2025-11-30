"use client";

import { useState, useMemo, useEffect } from "react";
import {
  GameState,
  Player,
  HERB_NAMES,
  POTION_NAMES,
  HerbId,
  PotionId,
  HERB_TIERS,
  POTION_TIERS,
  DayRecord,
  PlayerDayActions,
  RECIPES,
} from "@/lib/types";
import { GamePhase } from "@/lib/hooks/use-game-stream";

interface GameViewProps {
  dayStates: GameState[];
  players: Player[];
  phase: GamePhase;
  seed: string | null;
  daysCompleted: number;
  totalDays: number;
  onReset: () => void;
}

type ViewMode = "overview" | "details";

function getTierForHerb(herbId: HerbId): "T1" | "T2" | "T3" {
  if (HERB_TIERS.T1.includes(herbId)) return "T1";
  if (HERB_TIERS.T2.includes(herbId)) return "T2";
  return "T3";
}

function getTierForPotion(potionId: PotionId): "T1" | "T2" | "T3" {
  if (POTION_TIERS.T1.includes(potionId)) return "T1";
  if (POTION_TIERS.T2.includes(potionId)) return "T2";
  return "T3";
}

export default function GameView({
  dayStates,
  players,
  phase,
  seed,
  daysCompleted,
  totalDays,
  onReset,
}: GameViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Auto-advance to latest day
  useEffect(() => {
    if (autoAdvance && daysCompleted > 0) {
      setSelectedDay(daysCompleted);
    }
  }, [daysCompleted, autoAdvance]);

  const currentState = dayStates[selectedDay - 1];
  const dayRecord = currentState?.dayRecords?.[selectedDay - 1];
  const latestState = dayStates[dayStates.length - 1];

  // Calculate aggregate stats per player across all completed days
  const playerStats = useMemo(() => {
    if (!latestState) return [];

    return players.map((player, idx) => {
      let totalHerbsBought = 0;
      let totalHerbCost = 0;
      let totalPotionsMade = 0;
      let totalOffered = 0;
      let totalSold = 0;
      let totalRevenue = 0;
      let totalErrors = 0;

      // Sum across all day records
      for (const state of dayStates) {
        if (!state.dayRecords) continue;
        for (const dr of state.dayRecords) {
          const actions = dr.playerActions?.[idx];
          if (!actions) continue;

          totalHerbsBought += actions.actualBuyHerbs.reduce((s, h) => s + h.qty, 0);
          totalHerbCost += actions.actualBuyHerbs.reduce((s, h) => s + h.cost, 0);
          totalPotionsMade += actions.actualMakePotions.reduce((s, p) => s + p.qty, 0);
          totalOffered += actions.salesResults.reduce((s, r) => s + r.offered, 0);
          totalSold += actions.salesResults.reduce((s, r) => s + r.sold, 0);
          totalRevenue += actions.salesResults.reduce((s, r) => s + r.revenue, 0);
          totalErrors += actions.errors.length;
        }
      }

      const currentSilver = latestState.playerInventories[idx]?.silver || 0;
      const startingSilver = dayStates[0]?.playerInventories[idx]?.silver || 1000;
      const profitLoss = currentSilver - startingSilver;

      return {
        player,
        playerIdx: idx,
        silver: currentSilver,
        profitLoss,
        herbsBought: totalHerbsBought,
        herbCost: totalHerbCost,
        potionsMade: totalPotionsMade,
        offered: totalOffered,
        sold: totalSold,
        revenue: totalRevenue,
        errors: totalErrors,
        successRate: totalOffered > 0 ? Math.round((totalSold / totalOffered) * 100) : 0,
      };
    }).sort((a, b) => b.silver - a.silver);
  }, [dayStates, latestState, players]);

  // Calculate final rankings for current day view
  const rankings = useMemo(() => {
    if (!currentState) return [];
    return currentState.playerInventories
      .map((inv, idx) => ({
        playerIdx: idx,
        silver: inv.silver,
        player: players[idx],
      }))
      .sort((a, b) => b.silver - a.silver);
  }, [currentState, players]);

  // Winner is from the FINAL state, not the currently viewed day
  // Must be before early return to follow Rules of Hooks
  const isCompleted = phase === "completed";
  const finalWinner = useMemo(() => {
    if (!isCompleted || !latestState) return null;
    const finalRankings = latestState.playerInventories
      .map((inv, idx) => ({ playerIdx: idx, silver: inv.silver, player: players[idx] }))
      .sort((a, b) => b.silver - a.silver);
    return finalRankings[0];
  }, [isCompleted, latestState, players]);

  // Loading state
  if (!currentState) {
    const progressPercent = Math.min(90, (daysCompleted / totalDays) * 100 + 10);
    // Check if names have been chosen yet (not just "Alchemist N")
    const namesChosen = players.some(p => p.name && !p.name.startsWith("Alchemist "));
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 pixel-grid">
        <div className="pixel-frame-gold text-center max-w-lg p-8">
          <div className="text-6xl mb-6 pixel-pulse">⚗️</div>
          <h2 className="pixel-title text-xl mb-4">
            {!namesChosen 
              ? "CHOOSING NAMES" 
              : daysCompleted === 0 
                ? "DAY 1 BREWING" 
                : `DAY ${daysCompleted + 1} BREWING`}
          </h2>
          <p className="pixel-text text-[var(--pixel-text-dim)] mb-2">
            {!namesChosen 
              ? "Each alchemist is choosing their name"
              : `${players.length} alchemists are making decisions`}
            <span className="loading-dots"></span>
          </p>
          <p className="pixel-text-sm text-[var(--pixel-gold)] mb-4">SEED: {seed}</p>
          <div className="pixel-progress mb-4">
            <div
              className="pixel-progress-bar"
              style={{ width: `${progressPercent}%`, transition: "width 0.5s" }}
            />
          </div>
          <div className="space-y-2 mt-6">
            {players.map((player, idx) => (
              <div
                key={idx}
                className={`pixel-text-sm player-color-${idx} flex items-center justify-center gap-2`}
              >
                <span className="blink">▶</span>
                <span>{namesChosen && player.name ? player.name : "..."}</span>
                <span className="text-[var(--pixel-text-dim)]">({player.model?.split("/").pop() || "loading"})</span>
              </div>
            ))}
          </div>
          <button onClick={onReset} className="pixel-btn mt-6">
            ✗ CANCEL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pixel-grid relative">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="pixel-title text-xl lg:text-2xl">The Alchemist</h1>
          <p className="pixel-text-sm text-[var(--pixel-text-dim)] mt-1">
            SEED: <span className="text-[var(--pixel-gold)]">{seed}</span>
            <span className="ml-4">DAY {daysCompleted}/{totalDays}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Toggle */}
          <div className="flex">
            <button
              onClick={() => setViewMode("overview")}
              className={`pixel-btn text-xs rounded-r-none ${viewMode === "overview" ? "pixel-btn-primary" : ""}`}
            >
              📊 OVERVIEW
            </button>
            <button
              onClick={() => setViewMode("details")}
              className={`pixel-btn text-xs rounded-l-none ${viewMode === "details" ? "pixel-btn-primary" : ""}`}
            >
              📋 DETAILS
            </button>
          </div>

          <button onClick={onReset} className="pixel-btn text-xs">
            ↺ NEW
          </button>
        </div>
      </div>

      {/* Winner Banner - only shows when game is completed */}
      {isCompleted && finalWinner && (
        <div className="pixel-frame-gold p-4 mb-4 text-center">
          <span className="text-2xl mr-2">🏆</span>
          <span className="pixel-title">{finalWinner.player.name} WINS!</span>
          <span className="text-2xl ml-2">🏆</span>
          <p className="pixel-text-sm text-[var(--pixel-text-dim)] mt-1">
            Final: <span className="gold-display">{finalWinner.silver}</span> silver
          </p>
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === "overview" ? (
        <OverviewView
          playerStats={playerStats}
          daysCompleted={daysCompleted}
          totalDays={totalDays}
          phase={phase}
          onViewDetails={(playerIdx) => {
            setSelectedPlayerIdx(playerIdx);
            setViewMode("details");
          }}
        />
      ) : (
        <DetailsView
          dayStates={dayStates}
          players={players}
          rankings={rankings}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          selectedPlayerIdx={selectedPlayerIdx}
          setSelectedPlayerIdx={setSelectedPlayerIdx}
          autoAdvance={autoAdvance}
          setAutoAdvance={setAutoAdvance}
          daysCompleted={daysCompleted}
          totalDays={totalDays}
          phase={phase}
          dayRecord={dayRecord}
        />
      )}

      {/* Status Bar */}
      {phase === "running" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pixel-frame-gold px-6 py-3 flex items-center gap-3">
          <div className="status-dot status-active" />
          <span className="pixel-text-sm">
            DAY {daysCompleted} OF {totalDays} COMPLETE
            <span className="loading-dots"></span>
          </span>
        </div>
      )}
    </div>
  );
}

// Overview View - High level stats for all players
function OverviewView({
  playerStats,
  daysCompleted,
  totalDays,
  phase,
  onViewDetails,
}: {
  playerStats: {
    player: Player;
    playerIdx: number;
    silver: number;
    profitLoss: number;
    herbsBought: number;
    herbCost: number;
    potionsMade: number;
    offered: number;
    sold: number;
    revenue: number;
    errors: number;
    successRate: number;
  }[];
  daysCompleted: number;
  totalDays: number;
  phase: GamePhase;
  onViewDetails: (playerIdx: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="pixel-frame p-4 text-center">
          <div className="pixel-text-sm text-[var(--pixel-text-dim)]">PROGRESS</div>
          <div className="pixel-title text-2xl">{daysCompleted}/{totalDays}</div>
          <div className="pixel-text-sm text-[var(--pixel-text-dim)]">days</div>
        </div>
        <div className="pixel-frame p-4 text-center">
          <div className="pixel-text-sm text-[var(--pixel-text-dim)]">PLAYERS</div>
          <div className="pixel-title text-2xl">{playerStats.length}</div>
          <div className="pixel-text-sm text-[var(--pixel-text-dim)]">competing</div>
        </div>
        <div className="pixel-frame p-4 text-center">
          <div className="pixel-text-sm text-[var(--pixel-text-dim)]">TOTAL SALES</div>
          <div className="pixel-title text-2xl">{playerStats.reduce((s, p) => s + p.sold, 0)}</div>
          <div className="pixel-text-sm text-[var(--pixel-text-dim)]">potions</div>
        </div>
        <div className="pixel-frame p-4 text-center">
          <div className="pixel-text-sm text-[var(--pixel-text-dim)]">STATUS</div>
          <div className={`pixel-title text-lg ${phase === "completed" ? "text-[var(--pixel-green-bright)]" : "text-[var(--pixel-orange)]"}`}>
            {phase === "completed" ? "FINISHED" : "RUNNING"}
          </div>
        </div>
      </div>

      {/* Player Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playerStats.map((stats, pos) => (
          <div
            key={stats.playerIdx}
            className={`pixel-frame p-4 cursor-pointer hover:border-[var(--pixel-gold)] transition-colors player-bg-${stats.playerIdx}`}
            onClick={() => onViewDetails(stats.playerIdx)}
          >
            {/* Header with rank and name */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`w-8 h-8 flex items-center justify-center pixel-text font-bold ${
                  pos === 0
                    ? "bg-[var(--pixel-gold)] text-black"
                    : pos === 1
                      ? "bg-gray-400 text-black"
                      : pos === 2
                        ? "bg-amber-700 text-white"
                        : "bg-[var(--pixel-dark)] text-[var(--pixel-text-dim)]"
                }`}
              >
                {pos + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`pixel-text player-color-${stats.playerIdx}`}>{stats.player.name}</div>
                <div className="pixel-text-sm text-[var(--pixel-text-dim)] truncate">{stats.player.model.split("/").pop()}</div>
              </div>
              <div className="text-right">
                <div className="gold-display text-lg">{stats.silver}g</div>
                <div className={`pixel-text-sm ${stats.profitLoss >= 0 ? "text-[var(--pixel-green-bright)]" : "text-[var(--pixel-red)]"}`}>
                  {stats.profitLoss >= 0 ? "+" : ""}{stats.profitLoss}
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="pixel-frame p-2">
                <div className="pixel-text-sm text-[var(--pixel-green-bright)]">🌿 HERBS</div>
                <div className="pixel-text">{stats.herbsBought}</div>
                <div className="pixel-text-sm text-[var(--pixel-text-dim)]">-{stats.herbCost}g</div>
              </div>
              <div className="pixel-frame p-2">
                <div className="pixel-text-sm text-[var(--pixel-purple-bright)]">⚗️ POTIONS</div>
                <div className="pixel-text">{stats.potionsMade}</div>
                <div className="pixel-text-sm text-[var(--pixel-text-dim)]">crafted</div>
              </div>
              <div className="pixel-frame p-2">
                <div className="pixel-text-sm text-[var(--pixel-blue-bright)]">🏪 SALES</div>
                <div className="pixel-text">{stats.sold}/{stats.offered}</div>
                <div className="pixel-text-sm text-[var(--pixel-text-dim)]">{stats.successRate}% rate</div>
              </div>
              <div className="pixel-frame p-2">
                <div className="pixel-text-sm text-[var(--pixel-gold)]">💰 REVENUE</div>
                <div className="pixel-text">+{stats.revenue}g</div>
                <div className="pixel-text-sm text-[var(--pixel-text-dim)]">earned</div>
              </div>
            </div>

            {/* Errors indicator */}
            {stats.errors > 0 && (
              <div className="mt-2 text-center">
                <span className="pixel-text-sm text-[var(--pixel-red)]">⚠ {stats.errors} errors</span>
              </div>
            )}

            {/* Click hint */}
            <div className="mt-3 text-center">
              <span className="pixel-text-sm text-[var(--pixel-text-dim)]">Click for details →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Details View - Day-by-day breakdown
function DetailsView({
  dayStates,
  players,
  rankings,
  selectedDay,
  setSelectedDay,
  selectedPlayerIdx,
  setSelectedPlayerIdx,
  autoAdvance,
  setAutoAdvance,
  daysCompleted,
  totalDays,
  phase,
  dayRecord,
}: {
  dayStates: GameState[];
  players: Player[];
  rankings: { playerIdx: number; silver: number; player: Player }[];
  selectedDay: number;
  setSelectedDay: (d: number | ((d: number) => number)) => void;
  selectedPlayerIdx: number;
  setSelectedPlayerIdx: (idx: number) => void;
  autoAdvance: boolean;
  setAutoAdvance: (v: boolean) => void;
  daysCompleted: number;
  totalDays: number;
  phase: GamePhase;
  dayRecord?: DayRecord;
}) {
  const playerActions = dayRecord?.playerActions?.[selectedPlayerIdx];

  return (
    <>
      {/* Day Navigation */}
      <div className="flex items-center justify-center gap-4 mb-4">
        {phase === "running" && (
          <button
            onClick={() => setAutoAdvance(!autoAdvance)}
            className={`pixel-btn text-xs ${autoAdvance ? "pixel-btn-primary" : ""}`}
          >
            {autoAdvance ? "▶ AUTO" : "⏸ MANUAL"}
          </button>
        )}

        <button
          onClick={() => {
            setAutoAdvance(false);
            setSelectedDay((d) => Math.max(1, d - 1));
          }}
          disabled={selectedDay <= 1}
          className="pixel-arrow"
        >
          ◀
        </button>
        <div className="day-indicator">
          <span className="pixel-heading">DAY</span>
          <span className="gold-display text-xl">{selectedDay}</span>
          <span className="pixel-text-sm text-[var(--pixel-text-dim)]">/{totalDays}</span>
        </div>
        <button
          onClick={() => {
            setAutoAdvance(false);
            setSelectedDay((d) => Math.min(daysCompleted, d + 1));
          }}
          disabled={selectedDay >= daysCompleted}
          className="pixel-arrow"
        >
          ▶
        </button>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: Rankings + Herb Prices */}
        <div className="lg:col-span-1 space-y-4">
          {/* Rankings */}
          <div className="pixel-frame p-3">
            <h2 className="pixel-heading text-center mb-3">🏆 STANDINGS</h2>
            <div className="space-y-2">
              {rankings.map((rank, pos) => (
                <div
                  key={rank.playerIdx}
                  onClick={() => setSelectedPlayerIdx(rank.playerIdx)}
                  className={`p-2 cursor-pointer border-2 transition-all ${
                    selectedPlayerIdx === rank.playerIdx
                      ? `player-color-${rank.playerIdx} player-bg-${rank.playerIdx}`
                      : "border-transparent hover:border-[var(--pixel-border)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 flex items-center justify-center pixel-text-sm ${
                        pos === 0
                          ? "bg-[var(--pixel-gold)] text-black"
                          : pos === 1
                            ? "bg-gray-400 text-black"
                            : pos === 2
                              ? "bg-amber-700 text-white"
                              : "bg-[var(--pixel-dark)] text-[var(--pixel-text-dim)]"
                      }`}
                    >
                      {pos + 1}
                    </span>
                    <span className={`pixel-text-sm flex-1 truncate player-color-${rank.playerIdx}`}>
                      {rank.player.name}
                    </span>
                    <span className="gold-display text-sm">{rank.silver}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Herb Prices */}
          {dayRecord && (
            <div className="pixel-frame p-3">
              <h2 className="pixel-heading text-center mb-3">🌿 HERB PRICES</h2>
              <div className="space-y-1">
                {Object.entries(dayRecord.herbPrices).map(([herbId, price]) => (
                  <div key={herbId} className="flex justify-between pixel-text-sm">
                    <span className={`tier-${getTierForHerb(herbId as HerbId).charAt(1)}`}>
                      {HERB_NAMES[herbId as HerbId]}
                    </span>
                    <span className="gold-display">{price}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Day Details */}
        <div className="lg:col-span-3 space-y-4">
          {/* Player Tabs */}
          <div className="flex gap-1 flex-wrap">
            {players.map((player, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedPlayerIdx(idx)}
                title={player.model}
                className={`pixel-btn text-xs ${
                  selectedPlayerIdx === idx ? "pixel-btn-primary" : ""
                }`}
              >
                {player.name}
                <span className="text-[var(--pixel-text-dim)] ml-1">({player.model.split("/").pop()?.slice(0, 8)})</span>
              </button>
            ))}
          </div>

          {playerActions ? (
            <PlayerDayView
              player={players[selectedPlayerIdx]}
              playerIdx={selectedPlayerIdx}
              actions={playerActions}
            />
          ) : (
            <div className="pixel-frame p-6 text-center">
              <p className="pixel-text text-[var(--pixel-text-dim)]">
                No detailed data available for this day
              </p>
            </div>
          )}

          {/* Market Summary */}
          {dayRecord && (
            <MarketSummary
              marketSummary={dayRecord.marketSummary}
              potionDemands={dayRecord.potionDemands}
              players={players}
            />
          )}
        </div>
      </div>
    </>
  );
}

// Player Day View Component
function PlayerDayView({
  player,
  playerIdx,
  actions,
}: {
  player: Player;
  playerIdx: number;
  actions: PlayerDayActions;
}) {
  const profitLoss = actions.endInventory.silver - actions.startInventory.silver;

  return (
    <div className={`pixel-frame p-4 player-bg-${playerIdx}`} style={{ borderColor: `var(--player-${playerIdx + 1})` }}>
      <h2 className={`pixel-heading player-color-${playerIdx} mb-4`}>
        📋 {player.name}&apos;s DAY
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Start Inventory */}
        <InventoryPanel
          title="📦 START OF DAY"
          inventory={actions.startInventory}
        />

        {/* End Inventory */}
        <InventoryPanel
          title="📦 END OF DAY"
          inventory={actions.endInventory}
          profitLoss={profitLoss}
        />
      </div>

      {/* Actions Timeline */}
      <div className="mt-4 space-y-3">
        {/* Herbs Bought */}
        <div className="pixel-frame p-3">
          <h3 className="pixel-text-sm text-[var(--pixel-green-bright)] mb-2">🌿 HERBS BOUGHT</h3>
          {actions.actualBuyHerbs.length > 0 ? (
            <div className="space-y-1">
              {actions.actualBuyHerbs.map((buy, idx) => (
                <div key={idx} className="flex justify-between pixel-text-sm">
                  <span>
                    {buy.qty}x {HERB_NAMES[buy.herbId]}
                  </span>
                  <span className="text-[var(--pixel-red)]">-{buy.cost}g</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="pixel-text-sm text-[var(--pixel-text-dim)]">No herbs purchased</p>
          )}
          {actions.errors.filter(e => e.includes("silver") || e.includes("buy")).length > 0 && (
            <div className="mt-2 text-[var(--pixel-red)] pixel-text-sm">
              {actions.errors.filter(e => e.includes("silver") || e.includes("buy")).map((e, i) => (
                <p key={i}>⚠ {e}</p>
              ))}
            </div>
          )}
        </div>

        {/* Potions Crafted */}
        <div className="pixel-frame p-3">
          <h3 className="pixel-text-sm text-[var(--pixel-purple-bright)] mb-2">⚗️ POTIONS CRAFTED</h3>
          {actions.actualMakePotions.length > 0 ? (
            <div className="space-y-1">
              {actions.actualMakePotions.map((make, idx) => (
                <div key={idx} className="flex justify-between pixel-text-sm">
                  <span>
                    {make.qty}x {POTION_NAMES[make.potionId]}
                  </span>
                  <span className="text-[var(--pixel-text-dim)]">
                    ({RECIPES[make.potionId].map(h => HERB_NAMES[h].split(" ")[0]).join(" + ")})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="pixel-text-sm text-[var(--pixel-text-dim)]">No potions crafted</p>
          )}
          {actions.errors.filter(e => e.includes("herbs to make")).length > 0 && (
            <div className="mt-2 text-[var(--pixel-red)] pixel-text-sm">
              {actions.errors.filter(e => e.includes("herbs to make")).map((e, i) => (
                <p key={i}>⚠ {e}</p>
              ))}
            </div>
          )}
        </div>

        {/* Offers & Sales */}
        <div className="pixel-frame p-3">
          <h3 className="pixel-text-sm text-[var(--pixel-blue-bright)] mb-2">🏪 MARKET OFFERS & SALES</h3>
          {actions.salesResults.length > 0 ? (
            <div className="space-y-1">
              {actions.salesResults.map((sale, idx) => (
                <div key={idx} className="flex justify-between pixel-text-sm items-center">
                  <span>
                    {POTION_NAMES[sale.potionId]}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={sale.sold === sale.offered ? "text-[var(--pixel-green-bright)]" : sale.sold > 0 ? "text-[var(--pixel-orange)]" : "text-[var(--pixel-red)]"}>
                      {sale.sold}/{sale.offered} sold
                    </span>
                    <span className="text-[var(--pixel-text-dim)]">@{sale.price}</span>
                    {sale.revenue > 0 && (
                      <span className="text-[var(--pixel-green-bright)]">+{sale.revenue}g</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="pixel-text-sm text-[var(--pixel-text-dim)]">No market offers</p>
          )}
          {actions.errors.filter(e => e.includes("potions to sell")).length > 0 && (
            <div className="mt-2 text-[var(--pixel-red)] pixel-text-sm">
              {actions.errors.filter(e => e.includes("potions to sell")).map((e, i) => (
                <p key={i}>⚠ {e}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Market Summary Component
function MarketSummary({
  marketSummary,
  potionDemands,
  players,
}: {
  marketSummary: {
    processedOffers: { playerIdx?: number; potionId: PotionId; actuallySold?: number; price: number; qty: number }[];
    potionInformation: Record<PotionId, { fulfilled: number; remaining: number; highestPrice: number; lowestPrice: number }>;
  };
  potionDemands: Record<PotionId, number>;
  players: Player[];
}) {
  // Filter to potions that had demand
  const activePotions = Object.entries(marketSummary.potionInformation).filter(
    ([, info]) => info.fulfilled > 0 || info.remaining > 0 || potionDemands[info as unknown as PotionId] > 0
  );

  return (
    <div className="pixel-frame p-4">
      <h2 className="pixel-heading text-center mb-4">🏪 MARKET RESULTS</h2>
      
      <div className="overflow-x-auto">
        <table className="pixel-table w-full">
          <thead>
            <tr>
              <th>Potion</th>
              <th>Demand</th>
              <th>Sold</th>
              <th>Unfilled</th>
              <th>Price Range</th>
            </tr>
          </thead>
          <tbody>
            {activePotions.slice(0, 10).map(([potionId, info]) => {
              const demand = potionDemands[potionId as PotionId] || 0;
              return (
                <tr key={potionId}>
                  <td className="pixel-text-sm">{POTION_NAMES[potionId as PotionId]}</td>
                  <td>{demand}</td>
                  <td className="text-[var(--pixel-green-bright)]">{info.fulfilled}</td>
                  <td className={info.remaining > 0 ? "text-[var(--pixel-red)]" : "text-[var(--pixel-text-dim)]"}>
                    {info.remaining}
                  </td>
                  <td>
                    {info.lowestPrice > 0 ? (
                      <span className="gold-display">
                        {info.lowestPrice === info.highestPrice ? info.lowestPrice : `${info.lowestPrice}-${info.highestPrice}`}
                      </span>
                    ) : (
                      <span className="text-[var(--pixel-text-dim)]">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sales by player */}
      <div className="mt-4">
        <h3 className="pixel-text-sm text-[var(--pixel-gold)] mb-2">SALES BY PLAYER</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {players.map((player, idx) => {
            const playerSales = marketSummary.processedOffers.filter(o => o.playerIdx === idx);
            const totalRevenue = playerSales.reduce((sum, o) => sum + (o.actuallySold || 0) * o.price, 0);
            const totalSold = playerSales.reduce((sum, o) => sum + (o.actuallySold || 0), 0);
            
            return (
              <div key={idx} className={`p-2 player-bg-${idx} border-2 player-color-${idx}`}>
                <p className={`pixel-text-sm player-color-${idx}`}>{player.name}</p>
                <p className="pixel-text-sm text-[var(--pixel-text-dim)]">
                  {totalSold} sold → <span className="gold-display">{totalRevenue}g</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Inventory Panel Component - Shows detailed herbs and potions
function InventoryPanel({
  title,
  inventory,
  profitLoss,
}: {
  title: string;
  inventory: { silver: number; herbs: Record<HerbId, number>; potions: Record<PotionId, number> };
  profitLoss?: number;
}) {
  const herbsWithQty = Object.entries(inventory.herbs).filter(([, qty]) => qty > 0);
  const potionsWithQty = Object.entries(inventory.potions).filter(([, qty]) => qty > 0);
  const totalHerbs = herbsWithQty.reduce((sum, [, qty]) => sum + qty, 0);
  const totalPotions = potionsWithQty.reduce((sum, [, qty]) => sum + qty, 0);

  return (
    <div className="pixel-frame p-3">
      <h3 className="pixel-text-sm text-[var(--pixel-gold)] mb-2">{title}</h3>
      
      {/* Silver */}
      <div className="flex justify-between pixel-text-sm mb-2">
        <span>💰 Silver</span>
        <span className="gold-display">{inventory.silver}</span>
      </div>
      
      {/* Profit/Loss if provided */}
      {profitLoss !== undefined && (
        <div className="flex justify-between pixel-text-sm mb-2">
          <span>📊 Day P/L</span>
          <span className={profitLoss >= 0 ? "text-[var(--pixel-green-bright)]" : "text-[var(--pixel-red)]"}>
            {profitLoss >= 0 ? "+" : ""}{profitLoss}
          </span>
        </div>
      )}

      {/* Herbs */}
      <div className="mt-2 border-t border-[var(--pixel-border)] pt-2">
        <div className="flex justify-between pixel-text-sm text-[var(--pixel-green-bright)] mb-1">
          <span>🌿 Herbs</span>
          <span>({totalHerbs})</span>
        </div>
        {herbsWithQty.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {herbsWithQty.map(([herbId, qty]) => (
              <div key={herbId} className="flex justify-between pixel-text-sm text-[var(--pixel-text-dim)]">
                <span className={`tier-${getTierForHerb(herbId as HerbId).charAt(1)} truncate`}>
                  {HERB_NAMES[herbId as HerbId].split(" ")[0]}
                </span>
                <span>×{qty}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="pixel-text-sm text-[var(--pixel-text-dim)] italic">None</p>
        )}
      </div>

      {/* Potions */}
      <div className="mt-2 border-t border-[var(--pixel-border)] pt-2">
        <div className="flex justify-between pixel-text-sm text-[var(--pixel-purple-bright)] mb-1">
          <span>🧪 Potions</span>
          <span>({totalPotions})</span>
        </div>
        {potionsWithQty.length > 0 ? (
          <div className="space-y-0.5">
            {potionsWithQty.map(([potionId, qty]) => (
              <div key={potionId} className="flex justify-between pixel-text-sm text-[var(--pixel-text-dim)]">
                <span className={`tier-${getTierForPotion(potionId as PotionId).charAt(1)} truncate`}>
                  {POTION_NAMES[potionId as PotionId].replace("Potion of ", "").replace("Minor ", "Min ").replace("Greater ", "Grt ")}
                </span>
                <span>×{qty}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="pixel-text-sm text-[var(--pixel-text-dim)] italic">None</p>
        )}
      </div>
    </div>
  );
}
