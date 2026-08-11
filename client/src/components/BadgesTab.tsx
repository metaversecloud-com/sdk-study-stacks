import { useContext } from "react";

import { GlobalStateContext } from "@/context/GlobalContext";

export const BadgesTab = () => {
  const { badges, visitorInventory } = useContext(GlobalStateContext);

  if (!badges || Object.keys(badges).length === 0) {
    return (
      <div className="tr-hero mt-4">
        <div className="tr-hero__body text-center">
          <h2 className="tr-hero__title">No badges yet</h2>
          <p className="mt-2 text-base text-ink-soft">Badges unlock as you play. Come back after a round.</p>
        </div>
      </div>
    );
  }

  const allBadges = Object.values(badges);
  const earnedCount = allBadges.filter(
    (b) => visitorInventory && Object.keys(visitorInventory).includes(b.name),
  ).length;

  return (
    <div className="mt-4 pb-12">
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="font-display text-2xl font-extrabold text-ink">Badges</h2>
        <span className="font-mono text-sm font-bold text-ink-mute uppercase tracking-widest">
          {earnedCount} / {allBadges.length}
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {allBadges.map((badge) => {
          const { name, description, icon } = badge;
          const hasBadge = visitorInventory && Object.keys(visitorInventory).includes(name);
          const style = { maxWidth: "100%", filter: "none", opacity: "1" };
          if (!hasBadge) {
            style.filter = "grayscale(1)";
            style.opacity = "0.7";
          }
          return (
            <div className="tooltip" key={name}>
              <span className="p3 tooltip-content" style={{ width: "115px" }}>
                {description ? description : name}
              </span>
              <img src={icon} alt={name} style={style} />
              <p className="p3 pb-2">{name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BadgesTab;
