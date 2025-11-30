"use client";

import { RECIPES, POTION_NAMES, HERB_NAMES, PotionId, HerbId, POTION_TIER_LOOKUP, Tier } from "@/lib/types";

interface GameRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GameRulesModal({ isOpen, onClose }: GameRulesModalProps) {
  if (!isOpen) return null;

  const getTierColor = (tier: Tier) => {
    switch (tier) {
      case "T1": return "text-[var(--pixel-green-bright)]";
      case "T2": return "text-[var(--pixel-gold)]";
      case "T3": return "text-[var(--pixel-purple)]";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative pixel-frame-gold bg-[var(--pixel-dark)] max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-[var(--pixel-dark)] border-b-4 border-[var(--pixel-border)] p-4 flex items-center justify-between">
          <h2 className="pixel-title text-xl">📜 GAME RULES</h2>
          <button
            onClick={onClose}
            className="pixel-btn px-3 py-2"
          >
            ✗ CLOSE
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview */}
          <section>
            <h3 className="pixel-heading text-[var(--pixel-gold)] mb-3">⚗️ OVERVIEW</h3>
            <div className="pixel-frame p-4 space-y-2">
              <p className="pixel-text-sm">
                Welcome to <span className="text-[var(--pixel-gold)]">The Alchemist</span>, a competitive potion trading game!
              </p>
              <p className="pixel-text-sm">
                You are an alchemist competing against others (AI or human) over several days. 
                Your goal is to <span className="text-[var(--pixel-green-bright)]">end with the most gold</span> by buying herbs, 
                crafting potions, and selling them on the market.
              </p>
            </div>
          </section>

          {/* Game Flow */}
          <section>
            <h3 className="pixel-heading text-[var(--pixel-gold)] mb-3">📅 DAILY GAME FLOW</h3>
            <div className="space-y-3">
              <div className="pixel-frame p-3">
                <div className="flex items-center gap-3">
                  <span className="pixel-title text-lg text-[var(--pixel-green-bright)]">1</span>
                  <div>
                    <p className="pixel-text-sm font-bold">BUY HERBS</p>
                    <p className="pixel-text-sm text-[var(--pixel-text-dim)]">
                      Purchase herbs from the shop at today&apos;s prices. Prices vary daily!
                    </p>
                  </div>
                </div>
              </div>
              <div className="pixel-frame p-3">
                <div className="flex items-center gap-3">
                  <span className="pixel-title text-lg text-[var(--pixel-gold)]">2</span>
                  <div>
                    <p className="pixel-text-sm font-bold">CRAFT POTIONS</p>
                    <p className="pixel-text-sm text-[var(--pixel-text-dim)]">
                      Combine herbs according to recipes to create potions.
                    </p>
                  </div>
                </div>
              </div>
              <div className="pixel-frame p-3">
                <div className="flex items-center gap-3">
                  <span className="pixel-title text-lg text-[var(--pixel-purple)]">3</span>
                  <div>
                    <p className="pixel-text-sm font-bold">SET OFFERS</p>
                    <p className="pixel-text-sm text-[var(--pixel-text-dim)]">
                      List your potions for sale at prices you choose. You can split quantities at different prices!
                    </p>
                  </div>
                </div>
              </div>
              <div className="pixel-frame p-3">
                <div className="flex items-center gap-3">
                  <span className="pixel-title text-lg text-[var(--pixel-red)]">4</span>
                  <div>
                    <p className="pixel-text-sm font-bold">MARKET PHASE</p>
                    <p className="pixel-text-sm text-[var(--pixel-text-dim)]">
                      The market has daily demand for each potion. Lowest prices sell first!
                      Unsold potions return to your inventory.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Market Rules */}
          <section>
            <h3 className="pixel-heading text-[var(--pixel-gold)] mb-3">🏪 MARKET RULES</h3>
            <div className="pixel-frame p-4 space-y-2">
              <p className="pixel-text-sm">
                • Each day, the market has <span className="text-[var(--pixel-gold)]">random demand</span> for each potion type
              </p>
              <p className="pixel-text-sm">
                • Offers are filled from <span className="text-[var(--pixel-green-bright)]">lowest to highest price</span>
              </p>
              <p className="pixel-text-sm">
                • If demand runs out, higher-priced offers <span className="text-[var(--pixel-red)]">don&apos;t sell</span>
              </p>
              <p className="pixel-text-sm">
                • If multiple players offer at the same price, sales are <span className="text-[var(--pixel-gold)]">split evenly</span>
              </p>
              <p className="pixel-text-sm">
                • Higher tier potions typically have <span className="text-[var(--pixel-purple)]">higher demand</span> and fetch better prices
              </p>
            </div>
          </section>

          {/* Tiers */}
          <section>
            <h3 className="pixel-heading text-[var(--pixel-gold)] mb-3">⭐ ITEM TIERS</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="pixel-frame p-3">
                <h4 className={`pixel-text-sm font-bold ${getTierColor("T1")} mb-2`}>TIER 1 - COMMON</h4>
                <p className="pixel-text-sm text-[var(--pixel-text-dim)]">
                  Cheapest herbs, easiest to craft. Lower profit margins but consistent demand.
                </p>
              </div>
              <div className="pixel-frame p-3">
                <h4 className={`pixel-text-sm font-bold ${getTierColor("T2")} mb-2`}>TIER 2 - UNCOMMON</h4>
                <p className="pixel-text-sm text-[var(--pixel-text-dim)]">
                  Mid-range investment. Better profits with moderate risk.
                </p>
              </div>
              <div className="pixel-frame p-3">
                <h4 className={`pixel-text-sm font-bold ${getTierColor("T3")} mb-2`}>TIER 3 - RARE</h4>
                <p className="pixel-text-sm text-[var(--pixel-text-dim)]">
                  Expensive herbs, highest profits. High risk if demand is low!
                </p>
              </div>
            </div>
          </section>

          {/* Recipes */}
          <section>
            <h3 className="pixel-heading text-[var(--pixel-gold)] mb-3">📜 RECIPES</h3>
            <p className="pixel-text-sm text-[var(--pixel-text-dim)] mb-3">
              Each potion requires <span className="text-[var(--pixel-gold)]">1 of each listed herb</span> to craft.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {(Object.keys(RECIPES) as PotionId[]).map((potionId) => {
                const recipe = RECIPES[potionId];
                const tier = POTION_TIER_LOOKUP[potionId];
                return (
                  <div key={potionId} className="pixel-frame p-2">
                    <div className={`pixel-text-sm font-bold ${getTierColor(tier)}`}>
                      {POTION_NAMES[potionId]}
                    </div>
                    <div className="pixel-text-sm text-[var(--pixel-text-dim)]">
                      = {recipe.map((h: HerbId) => HERB_NAMES[h].split(" ")[0]).join(" + ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="pixel-heading text-[var(--pixel-gold)] mb-3">💡 STRATEGY TIPS</h3>
            <div className="pixel-frame p-4 space-y-2">
              <p className="pixel-text-sm">
                • <span className="text-[var(--pixel-green-bright)]">Watch herb prices</span> - buy low, sell high!
              </p>
              <p className="pixel-text-sm">
                • <span className="text-[var(--pixel-gold)]">Check market history</span> - see what sold yesterday and at what prices
              </p>
              <p className="pixel-text-sm">
                • <span className="text-[var(--pixel-purple)]">Undercut competition</span> - slightly lower prices can capture more sales
              </p>
              <p className="pixel-text-sm">
                • <span className="text-[var(--pixel-gold)]">Diversify</span> - don&apos;t put all your gold into one potion type
              </p>
              <p className="pixel-text-sm">
                • <span className="text-[var(--pixel-red)]">On the last day</span> - sell everything! Inventory has no value after the game ends
              </p>
            </div>
          </section>
        </div>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 bg-[var(--pixel-dark)] border-t-4 border-[var(--pixel-border)] p-4 text-center">
          <button
            onClick={onClose}
            className="pixel-btn pixel-btn-primary px-8 py-3"
          >
            ✓ GOT IT!
          </button>
        </div>
      </div>
    </div>
  );
}
