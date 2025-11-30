"use client";

import {
  HerbId,
  HERB_NAMES,
  PlayerInputs,
  PlayerOutputs,
  PotionId,
  POTION_NAMES,
  POTION_TIER_LOOKUP,
  RECIPES,
  Tier,
} from "@/lib/types";
import { useState, useMemo } from "react";
import GameRulesModal from "./GameRulesModal";

interface HumanPlayerUIProps {
  playerInputs: PlayerInputs;
  herbPrices: Record<HerbId, number>;
  hookToken: string;
  onSubmit: (outputs: PlayerOutputs) => void;
  isSubmitting: boolean;
}

type HerbBuy = { herbId: HerbId; qty: number };
type PotionCraft = { potionId: PotionId; qty: number };
type OfferEntry = { id: string; potionId: PotionId; qty: number; price: number };

// CSS to hide number input spinners
const inputStyle = `
  .no-spinner::-webkit-outer-spin-button,
  .no-spinner::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .no-spinner {
    -moz-appearance: textfield;
    appearance: textfield;
  }
`;

type RightPanelTab = "offers" | "history" | "inventory";

export default function HumanPlayerUI({
  playerInputs,
  herbPrices,
  onSubmit,
  isSubmitting,
}: HumanPlayerUIProps) {
  // State for player actions
  const [herbBuys, setHerbBuys] = useState<Record<HerbId, number>>({} as Record<HerbId, number>);
  const [potionCrafts, setPotionCrafts] = useState<Record<PotionId, number>>({} as Record<PotionId, number>);
  // Multiple offers support - list of offers with unique IDs
  const [offers, setOffers] = useState<OfferEntry[]>([]);
  // Pixel-style potion picker
  const [showPotionPicker, setShowPotionPicker] = useState(false);
  // Tab for right panel
  const [rightTab, setRightTab] = useState<RightPanelTab>("offers");
  // Rules modal
  const [showRules, setShowRules] = useState(false);

  const { inventory, meta } = playerInputs;

  // Calculate projected inventory after buys and crafts
  const projectedInventory = useMemo(() => {
    const herbs = { ...inventory.herbs };
    const potions = { ...inventory.potions };
    let silver = inventory.silver;

    // Apply herb buys
    Object.entries(herbBuys).forEach(([herbId, qty]) => {
      if (qty > 0) {
        const cost = herbPrices[herbId as HerbId] * qty;
        herbs[herbId as HerbId] = (herbs[herbId as HerbId] || 0) + qty;
        silver -= cost;
      }
    });

    // Apply potion crafts (consume herbs, create potions)
    Object.entries(potionCrafts).forEach(([potionId, qty]) => {
      if (qty > 0) {
        const recipe = RECIPES[potionId as PotionId];
        recipe.forEach((herbId) => {
          herbs[herbId] = (herbs[herbId] || 0) - qty;
        });
        potions[potionId as PotionId] = (potions[potionId as PotionId] || 0) + qty;
      }
    });

    return { herbs, potions, silver };
  }, [inventory, herbBuys, potionCrafts, herbPrices]);

  // Calculate total cost of herb buys
  const totalHerbCost = useMemo(() => {
    return Object.entries(herbBuys).reduce((sum, [herbId, qty]) => {
      return sum + herbPrices[herbId as HerbId] * qty;
    }, 0);
  }, [herbBuys, herbPrices]);

  // Check if a potion can be crafted with projected herbs
  const canCraft = (potionId: PotionId): boolean => {
    const recipe = RECIPES[potionId];
    const currentCraftQty = potionCrafts[potionId] || 0;

    return recipe.every((herbId) => {
      const availableAfterCurrent = (inventory.herbs[herbId] || 0) + (herbBuys[herbId] || 0) - currentCraftQty;
      return availableAfterCurrent >= 1;
    });
  };

  // Check max craftable for a potion
  const maxCraftable = (potionId: PotionId): number => {
    const recipe = RECIPES[potionId];
    const herbsAfterBuys: Record<HerbId, number> = { ...inventory.herbs };
    Object.entries(herbBuys).forEach(([herbId, qty]) => {
      herbsAfterBuys[herbId as HerbId] = (herbsAfterBuys[herbId as HerbId] || 0) + qty;
    });

    // Subtract herbs used by other crafts
    Object.entries(potionCrafts).forEach(([pid, qty]) => {
      if (pid !== potionId && qty > 0) {
        RECIPES[pid as PotionId].forEach((herbId) => {
          herbsAfterBuys[herbId] = (herbsAfterBuys[herbId] || 0) - qty;
        });
      }
    });

    return Math.min(...recipe.map((herbId) => Math.max(0, herbsAfterBuys[herbId] || 0)));
  };

  // Handle herb buy change
  const setHerbBuy = (herbId: HerbId, qty: number) => {
    setHerbBuys((prev) => ({ ...prev, [herbId]: Math.max(0, qty) }));
  };

  // Handle potion craft change
  const setPotionCraft = (potionId: PotionId, qty: number) => {
    const max = maxCraftable(potionId);
    setPotionCrafts((prev) => ({ ...prev, [potionId]: Math.max(0, Math.min(qty, max + (prev[potionId] || 0))) }));
  };

  // Get available potions for offers (current inventory + crafted - already offered)
  const getAvailableForOffer = (potionId: PotionId): number => {
    const total = (inventory.potions[potionId] || 0) + (potionCrafts[potionId] || 0);
    const alreadyOffered = offers
      .filter((o) => o.potionId === potionId)
      .reduce((sum, o) => sum + o.qty, 0);
    return total - alreadyOffered;
  };

  // Add a new offer
  const addOffer = (potionId: PotionId) => {
    const available = getAvailableForOffer(potionId);
    if (available <= 0) return;
    setOffers((prev) => [
      ...prev,
      { id: `${potionId}-${Date.now()}`, potionId, qty: 1, price: 50 },
    ]);
    setShowPotionPicker(false);
  };

  // Update an existing offer
  const updateOffer = (id: string, updates: { qty?: number; price?: number }) => {
    setOffers((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const available = getAvailableForOffer(o.potionId) + o.qty; // Add back current qty
        return {
          ...o,
          qty: updates.qty !== undefined ? Math.min(Math.max(0, updates.qty), available) : o.qty,
          price: updates.price !== undefined ? Math.max(1, updates.price) : o.price,
        };
      })
    );
  };

  // Duplicate an offer (for offering at different prices)
  const duplicateOffer = (id: string) => {
    const original = offers.find((o) => o.id === id);
    if (!original) return;
    const available = getAvailableForOffer(original.potionId);
    if (available <= 0) return;
    setOffers((prev) => [
      ...prev,
      { id: `${original.potionId}-${Date.now()}`, potionId: original.potionId, qty: 1, price: original.price },
    ]);
  };

  // Remove an offer
  const removeOffer = (id: string) => {
    setOffers((prev) => prev.filter((o) => o.id !== id));
  };

  // Submit the turn
  const handleSubmit = () => {
    const buyHerbs: HerbBuy[] = Object.entries(herbBuys)
      .filter(([, qty]) => qty > 0)
      .map(([herbId, qty]) => ({ herbId: herbId as HerbId, qty }));

    const makePotions: PotionCraft[] = Object.entries(potionCrafts)
      .filter(([, qty]) => qty > 0)
      .map(([potionId, qty]) => ({ potionId: potionId as PotionId, qty }));

    const potionOffers = offers
      .filter((o) => o.qty > 0)
      .map(({ potionId, qty, price }) => ({ potionId, qty, price }));

    onSubmit({
      buyHerbs,
      makePotions,
      potionOffers,
    });
  };

  // Group herbs and potions by tier
  const herbsByTier: Record<Tier, HerbId[]> = {
    T1: ["H01", "H02", "H03", "H04"],
    T2: ["H05", "H06", "H07", "H08"],
    T3: ["H09", "H10", "H11", "H12"],
  };

  const potionsByTier: Record<Tier, PotionId[]> = {
    T1: ["P01", "P04", "P07", "P10", "P13", "P16"],
    T2: ["P02", "P05", "P08", "P11", "P14", "P17"],
    T3: ["P03", "P06", "P09", "P12", "P15", "P18"],
  };

  const getTierColor = (tier: Tier) => {
    switch (tier) {
      case "T1": return "text-[var(--pixel-green-bright)]";
      case "T2": return "text-[var(--pixel-gold)]";
      case "T3": return "text-[var(--pixel-purple)]";
    }
  };

  // Get potions that can be offered
  const availablePotionsForNewOffer = (Object.keys(RECIPES) as PotionId[]).filter(
    (potionId) => getAvailableForOffer(potionId) > 0
  );

  return (
    <div className="min-h-screen p-4">
      <style>{inputStyle}</style>
      
      {/* Header */}
      <div className="pixel-frame-gold p-4 mb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowRules(true)}
            className="pixel-btn text-xs"
          >
            📜 RULES
          </button>
          <div className="text-center flex-1">
            <h1 className="pixel-title text-xl">
              🎮 YOUR TURN - DAY {meta.currentDay} OF {meta.totalDays}
            </h1>
            <p className="pixel-text-sm text-[var(--pixel-text-dim)] mt-1">
              Buy herbs, craft potions, and set your market offers
            </p>
          </div>
          <div className="w-16" /> {/* Spacer for balance */}
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT COLUMN: Inventory & Herb Shop */}
        <div className="space-y-4">
          {/* Current Silver */}
          <div className="pixel-frame p-4">
            <h2 className="pixel-heading text-center mb-3">💰 SILVER</h2>
            <div className="text-center">
              <span className="pixel-title text-2xl gold-display">{inventory.silver}</span>
              {totalHerbCost > 0 && (
                <span className="pixel-text text-[var(--pixel-red)] ml-2">
                  (-{totalHerbCost})
                </span>
              )}
            </div>
            {projectedInventory.silver < 0 && (
              <p className="pixel-text-sm text-[var(--pixel-red)] text-center mt-2">
                ⚠ Not enough silver!
              </p>
            )}
          </div>

          {/* Herb Shop */}
          <div className="pixel-frame p-4">
            <h2 className="pixel-heading text-center mb-3">🌿 HERB SHOP</h2>
            <p className="pixel-text-sm text-[var(--pixel-text-dim)] text-center mb-3">
              Today&apos;s prices
            </p>

            {(["T1", "T2", "T3"] as Tier[]).map((tier) => (
              <div key={tier} className="mb-4">
                <h3 className={`pixel-text-sm ${getTierColor(tier)} mb-2`}>
                  ═══ TIER {tier.slice(1)} ═══
                </h3>
                <div className="space-y-3">
                  {herbsByTier[tier].map((herbId) => {
                    const price = herbPrices[herbId];
                    const owned = inventory.herbs[herbId] || 0;
                    const buying = herbBuys[herbId] || 0;

                    return (
                      <div key={herbId} className="pixel-frame p-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="pixel-text-sm font-bold" title={herbId}>
                            {HERB_NAMES[herbId]}
                          </span>
                          <span className="pixel-text-sm text-[var(--pixel-text-dim)]">
                            owned: {owned}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="gold-display text-lg">{price}💰</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setHerbBuy(herbId, buying - 1)}
                              disabled={buying <= 0}
                              className="pixel-btn px-3 py-2"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              value={buying}
                              onChange={(e) => setHerbBuy(herbId, parseInt(e.target.value) || 0)}
                              className="pixel-input w-16 h-10 text-center text-lg no-spinner"
                              min={0}
                            />
                            <button
                              onClick={() => setHerbBuy(herbId, buying + 1)}
                              disabled={projectedInventory.silver - price < 0}
                              className="pixel-btn px-3 py-2"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE COLUMN: Recipes & Crafting */}
        <div className="space-y-4">
          <div className="pixel-frame p-4">
            <h2 className="pixel-heading text-center mb-3">📜 RECIPES & CRAFTING</h2>
            <p className="pixel-text-sm text-[var(--pixel-text-dim)] text-center mb-3">
              Each potion requires 1 of each listed herb
            </p>

            {(["T1", "T2", "T3"] as Tier[]).map((tier) => (
              <div key={tier} className="mb-4">
                <h3 className={`pixel-text-sm ${getTierColor(tier)} mb-2`}>
                  ═══ TIER {tier.slice(1)} ═══
                </h3>
                <div className="space-y-2">
                  {potionsByTier[tier].map((potionId) => {
                    const recipe = RECIPES[potionId];
                    const crafting = potionCrafts[potionId] || 0;
                    const max = maxCraftable(potionId);
                    const canMake = canCraft(potionId);

                    return (
                      <div
                        key={potionId}
                        className={`pixel-frame p-3 ${!canMake && crafting === 0 ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="pixel-text-sm font-bold" title={potionId}>
                            {POTION_NAMES[potionId]}
                          </span>
                          <span className="pixel-text-sm text-[var(--pixel-text-dim)]">
                            max: {max + crafting}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="pixel-text-sm text-[var(--pixel-gold)]">
                            {recipe.map((h) => HERB_NAMES[h].split(" ")[0]).join(" + ")}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPotionCraft(potionId, crafting - 1)}
                              disabled={crafting <= 0}
                              className="pixel-btn px-3 py-2"
                            >
                              −
                            </button>
                            <span className="pixel-text w-10 text-center text-lg">{crafting}</span>
                            <button
                              onClick={() => setPotionCraft(potionId, crafting + 1)}
                              disabled={!canMake}
                              className="pixel-btn px-3 py-2"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Tabs for Offers / History / Inventory */}
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-1">
            <button
              onClick={() => setRightTab("offers")}
              className={`pixel-btn flex-1 text-xs ${rightTab === "offers" ? "pixel-btn-primary" : ""}`}
            >
              🏪 OFFERS
            </button>
            <button
              onClick={() => setRightTab("history")}
              className={`pixel-btn flex-1 text-xs ${rightTab === "history" ? "pixel-btn-primary" : ""}`}
            >
              📊 HISTORY
            </button>
            <button
              onClick={() => setRightTab("inventory")}
              className={`pixel-btn flex-1 text-xs ${rightTab === "inventory" ? "pixel-btn-primary" : ""}`}
            >
              📦 ITEMS
            </button>
          </div>

          {/* OFFERS TAB */}
          {rightTab === "offers" && (
            <div className="pixel-frame p-4">
              <h2 className="pixel-heading text-center mb-3">🏪 YOUR OFFERS</h2>
              
              {/* Pixel-style Add Offer Button */}
              {availablePotionsForNewOffer.length > 0 && (
                <div className="mb-4 relative">
                  <button
                    onClick={() => setShowPotionPicker(!showPotionPicker)}
                    className="pixel-btn pixel-btn-primary w-full py-3"
                  >
                    + ADD NEW OFFER
                  </button>
                  
                  {/* Potion Picker Dropdown */}
                  {showPotionPicker && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 pixel-frame bg-[var(--pixel-dark)] max-h-64 overflow-y-auto">
                      {(["T1", "T2", "T3"] as Tier[]).map((tier) => {
                        const potionsInTier = potionsByTier[tier].filter(
                          (p) => getAvailableForOffer(p) > 0
                        );
                        if (potionsInTier.length === 0) return null;
                        return (
                          <div key={tier}>
                            <div className={`px-3 py-2 ${getTierColor(tier)} pixel-text-sm border-b border-[var(--pixel-border)]`}>
                              TIER {tier.slice(1)}
                            </div>
                            {potionsInTier.map((potionId) => (
                              <button
                                key={potionId}
                                onClick={() => addOffer(potionId)}
                                className="w-full px-3 py-2 text-left pixel-text-sm hover:bg-[var(--pixel-border)] flex justify-between"
                              >
                                <span>{POTION_NAMES[potionId]}</span>
                                <span className="text-[var(--pixel-text-dim)]">
                                  ({getAvailableForOffer(potionId)})
                                </span>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                      <button
                        onClick={() => setShowPotionPicker(false)}
                        className="w-full px-3 py-2 text-center pixel-text-sm text-[var(--pixel-red)] border-t border-[var(--pixel-border)]"
                      >
                        CANCEL
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* List of offers - much taller now */}
              <div className="space-y-3">
                {offers.map((offer) => {
                  const tier = POTION_TIER_LOOKUP[offer.potionId];
                  const maxQty = getAvailableForOffer(offer.potionId) + offer.qty;

                  return (
                    <div key={offer.id} className="pixel-frame p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`pixel-text-sm font-bold ${getTierColor(tier)}`}>
                          {POTION_NAMES[offer.potionId]}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => duplicateOffer(offer.id)}
                            className="pixel-btn text-xs px-2 py-1"
                            title="Duplicate (for different price)"
                            disabled={getAvailableForOffer(offer.potionId) <= 0}
                          >
                            📋
                          </button>
                          <button
                            onClick={() => removeOffer(offer.id)}
                            className="pixel-btn text-xs px-2 py-1 hover:border-[var(--pixel-red)]"
                            title="Remove"
                          >
                            ✗
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="pixel-text-sm">Qty:</span>
                          <input
                            type="number"
                            value={offer.qty}
                            onChange={(e) => updateOffer(offer.id, { qty: parseInt(e.target.value) || 0 })}
                            className="pixel-input w-16 h-10 text-center text-lg no-spinner"
                            min={0}
                            max={maxQty}
                          />
                          <span className="pixel-text-sm text-[var(--pixel-text-dim)]">/{maxQty}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="pixel-text-sm">💰</span>
                          <input
                            type="number"
                            value={offer.price}
                            onChange={(e) => updateOffer(offer.id, { price: parseInt(e.target.value) || 1 })}
                            className="pixel-input w-20 h-10 text-center text-lg no-spinner"
                            min={1}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {offers.length === 0 && (
                  <p className="pixel-text-sm text-[var(--pixel-text-dim)] text-center py-8">
                    {availablePotionsForNewOffer.length > 0
                      ? "Click \"+ ADD NEW OFFER\" to sell your potions!"
                      : "Craft potions to sell them!"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {rightTab === "history" && (
            <div className="pixel-frame p-4">
              <h2 className="pixel-heading text-center mb-3">📊 MARKET HISTORY</h2>
              {playerInputs.historicDemands.length > 0 ? (
                <div className="space-y-3">
                  <p className="pixel-text-sm text-[var(--pixel-text-dim)] text-center mb-2">
                    Yesterday&apos;s market results
                  </p>
                  {Object.entries(playerInputs.historicDemands[playerInputs.historicDemands.length - 1] || {})
                    .filter(([, info]) => (info as { fulfilled: number }).fulfilled > 0 || (info as { remaining: number }).remaining > 0)
                    .map(([potionId, info]) => {
                      const { fulfilled, remaining, lowestPrice, highestPrice } = info as {
                        fulfilled: number;
                        remaining: number;
                        lowestPrice: number;
                        highestPrice: number;
                      };
                      const tier = POTION_TIER_LOOKUP[potionId as PotionId];
                      return (
                        <div key={potionId} className="pixel-frame p-3">
                          <div className={`pixel-text-sm font-bold ${getTierColor(tier)} mb-2`}>
                            {POTION_NAMES[potionId as PotionId]}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <div className="pixel-text-sm text-[var(--pixel-text-dim)]">Sold</div>
                              <div className="pixel-text text-[var(--pixel-green-bright)]">{fulfilled}</div>
                            </div>
                            <div>
                              <div className="pixel-text-sm text-[var(--pixel-text-dim)]">Unfilled</div>
                              <div className={`pixel-text ${remaining > 0 ? "text-[var(--pixel-red)]" : "text-[var(--pixel-text-dim)]"}`}>
                                {remaining}
                              </div>
                            </div>
                            <div>
                              <div className="pixel-text-sm text-[var(--pixel-text-dim)]">Price</div>
                              <div className="pixel-text gold-display">
                                {lowestPrice === highestPrice ? lowestPrice : `${lowestPrice}-${highestPrice}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="pixel-text-sm text-[var(--pixel-text-dim)] text-center py-8">
                  No history yet (Day 1)
                </p>
              )}

              {/* Yesterday's Errors */}
              {playerInputs.yesterdaysErrors.length > 0 && (
                <div className="mt-4 pixel-frame p-3 border-[var(--pixel-red)]">
                  <h3 className="pixel-text-sm text-[var(--pixel-red)] mb-2">⚠ YESTERDAY&apos;S ISSUES</h3>
                  <ul className="space-y-1">
                    {playerInputs.yesterdaysErrors.map((error, i) => (
                      <li key={i} className="pixel-text-sm text-[var(--pixel-red)]">
                        • {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* INVENTORY TAB */}
          {rightTab === "inventory" && (
            <div className="pixel-frame p-4">
              <h2 className="pixel-heading text-center mb-3">📦 YOUR INVENTORY</h2>
              
              {/* Herbs */}
              <div className="mb-4">
                <h3 className="pixel-text-sm text-[var(--pixel-gold)] mb-2">🌿 HERBS</h3>
                <div className="space-y-2">
                  {Object.entries(projectedInventory.herbs)
                    .filter(([, qty]) => qty > 0)
                    .map(([herbId, qty]) => (
                      <div key={herbId} className="pixel-frame p-2 flex justify-between items-center">
                        <span className="pixel-text-sm">{HERB_NAMES[herbId as HerbId]}</span>
                        <span className={`pixel-text text-lg ${qty < 0 ? "text-[var(--pixel-red)]" : ""}`}>
                          {qty}
                        </span>
                      </div>
                    ))}
                  {Object.values(projectedInventory.herbs).every((qty) => qty <= 0) && (
                    <p className="pixel-text-sm text-[var(--pixel-text-dim)] text-center py-2">
                      No herbs
                    </p>
                  )}
                </div>
              </div>

              {/* Potions */}
              <div>
                <h3 className="pixel-text-sm text-[var(--pixel-gold)] mb-2">🧪 POTIONS</h3>
                <div className="space-y-2">
                  {Object.entries(projectedInventory.potions)
                    .filter(([, qty]) => qty > 0)
                    .map(([potionId, qty]) => {
                      const tier = POTION_TIER_LOOKUP[potionId as PotionId];
                      return (
                        <div key={potionId} className="pixel-frame p-2 flex justify-between items-center">
                          <span className={`pixel-text-sm ${getTierColor(tier)}`}>
                            {POTION_NAMES[potionId as PotionId]}
                          </span>
                          <span className="pixel-text text-lg">{qty}</span>
                        </div>
                      );
                    })}
                  {Object.values(projectedInventory.potions).every((qty) => qty <= 0) && (
                    <p className="pixel-text-sm text-[var(--pixel-text-dim)] text-center py-2">
                      No potions
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--pixel-dark)] border-t-4 border-[var(--pixel-border)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="pixel-text-sm text-[var(--pixel-text-dim)]">
            <span>Buying: {Object.values(herbBuys).reduce((s, q) => s + q, 0)} herbs</span>
            <span className="mx-2">•</span>
            <span>Crafting: {Object.values(potionCrafts).reduce((s, q) => s + q, 0)} potions</span>
            <span className="mx-2">•</span>
            <span>Selling: {offers.reduce((s, o) => s + o.qty, 0)} potions</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || projectedInventory.silver < 0}
            className="pixel-btn pixel-btn-primary px-8 py-3"
          >
            {isSubmitting ? "SUBMITTING..." : "✓ END TURN"}
          </button>
        </div>
      </div>

      {/* Spacer for fixed bottom bar */}
      <div className="h-20" />

      {/* Rules Modal */}
      <GameRulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
    </div>
  );
}
