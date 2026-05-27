import { VisitorBadgeRecord } from "@shared/types/StudyStacksTypes.js";

export const getVisitorBadges = (visitorInventoryItems: any[]): VisitorBadgeRecord => {
  const visitorInventory: VisitorBadgeRecord = {};
  for (const visitorItem of visitorInventoryItems || []) {
    const { id, status, item } = visitorItem;
    const { name, type, image_url = "" } = item || {};
    if (status === "ACTIVE" && type === "BADGE" && name) {
      visitorInventory[name] = { id, name, icon: image_url };
    }
  }
  return visitorInventory;
};
