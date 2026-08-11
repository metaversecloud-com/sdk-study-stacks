import { Credentials } from "../types/index.js";
import { getCachedInventoryItems } from "./inventoryCache.js";
import { standardizeError } from "./standardizeError.js";

/**
 * Idempotent badge grant. Returns:
 *  - "granted" — new badge awarded
 *  - "already-owned" — visitor already had it
 *  - "missing-from-ecosystem" — badge isn't provisioned (no-op, logged)
 *  - throws on SDK errors
 *
 * Toast text comes from the inventory item itself (never hard-coded here) —
 * follows `.ai/examples/awardBadge.md` and `.ai/examples/badges.md`.
 */
export const awardBadge = async ({
  credentials,
  visitor,
  visitorInventory,
  badgeName,
}: {
  credentials: Credentials;
  visitor: any;
  visitorInventory: { [name: string]: any };
  badgeName: string;
}): Promise<"granted" | "already-owned" | "missing-from-ecosystem"> => {
  try {
    if (visitorInventory?.[badgeName]) return "already-owned";

    const inventoryItems = await getCachedInventoryItems({ credentials });
    const inventoryItem = inventoryItems?.find(
      (item: any) => item.name === badgeName && item.type === "BADGE",
    );
    if (!inventoryItem) {
      console.warn(`awardBadge: badge "${badgeName}" not provisioned in ecosystem — skipping grant`);
      return "missing-from-ecosystem";
    }

    await visitor.grantInventoryItem(inventoryItem, 1);

    visitor
      .fireToast({
        groupId: "study-stack-badges",
        title: "Badge Awarded",
        text: `You have earned the ${badgeName} badge!`,
      })
      .catch((err: any) => console.warn(`awardBadge: toast failed for ${badgeName}`, err));

    visitor
      .triggerParticle({ name: "explosion_float", duration: 2 })
      .catch((err: any) => console.warn(`awardBadge: particle failed for ${badgeName}`, err));

    return "granted";
  } catch (error: any) {
    throw standardizeError(error);
  }
};
