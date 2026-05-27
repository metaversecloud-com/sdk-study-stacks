import { InventoryItemInterface } from "@rtsdk/topia";
import { Credentials } from "../types/index.js";
import { Ecosystem } from "./topiaInit.js";
import { standardizeError } from "./standardizeError.js";

interface CachedInventory {
  items: InventoryItemInterface[];
  timestamp: number;
}

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;
let inventoryCache: CachedInventory | null = null;

export const getCachedInventoryItems = async ({
  credentials,
  forceRefresh = false,
}: {
  credentials: Credentials;
  forceRefresh?: boolean;
}): Promise<InventoryItemInterface[]> => {
  try {
    const now = Date.now();
    const isCacheValid =
      inventoryCache !== null && !forceRefresh && now - inventoryCache.timestamp < CACHE_DURATION_MS;
    if (isCacheValid) return inventoryCache!.items;

    const ecosystem = await Ecosystem.create({ credentials });
    await ecosystem.fetchInventoryItems();

    inventoryCache = {
      items: (ecosystem.inventoryItems as InventoryItemInterface[]) || [],
      timestamp: now,
    };
    return inventoryCache.items;
  } catch (error) {
    if (inventoryCache !== null) {
      console.warn("Failed to fetch fresh inventory, using stale cache", error);
      return inventoryCache.items;
    }
    throw standardizeError(error);
  }
};

export const clearInventoryCache = (): void => {
  inventoryCache = null;
};
