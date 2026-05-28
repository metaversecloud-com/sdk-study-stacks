import { VisitorInterface } from "@rtsdk/topia";
import { Visitor } from "./topiaInit.js";
import { Credentials } from "../types/index.js";
import { standardizeError } from "./standardizeError.js";
import { VisitorStudyData } from "@shared/types/StudyStacksTypes.js";
import { getVisitorBadges } from "./getVisitorBadges.js";

export const DEFAULT_VISITOR_STUDY_DATA = (): VisitorStudyData => ({
  decks: {},
  streak: { current: 0, longest: 0, lastDay: "" },
  totalCardsStudied: 0,
  totalSessionsCompleted: 0,
});

/**
 * Coerce any shape (legacy `{ dateStarted }`, partial, undefined) into a fully
 * populated VisitorStudyData. Always safe to index — `decks`, `streak`, etc. exist.
 */
export const normalizeStudyData = (raw: any): VisitorStudyData => ({
  decks: (raw && typeof raw === "object" && raw.decks) || {},
  streak: {
    current: raw?.streak?.current ?? 0,
    longest: raw?.streak?.longest ?? 0,
    lastDay: raw?.streak?.lastDay ?? "",
  },
  totalCardsStudied: raw?.totalCardsStudied ?? 0,
  totalSessionsCompleted: raw?.totalSessionsCompleted ?? 0,
});

/**
 * Study Stacks is ecosystem-wide: a visitor's progress follows their profile
 * across every desk and world, so it lives under one fixed key rather than
 * being scoped by urlSlug/sceneDropId.
 */
export const STUDY_STACKS_DATA_KEY = "studyStacksData";

const hasFullShape = (raw: any): boolean =>
  Boolean(
    raw &&
      typeof raw === "object" &&
      raw.decks &&
      raw.streak &&
      typeof raw.totalCardsStudied === "number" &&
      typeof raw.totalSessionsCompleted === "number",
  );

export const getVisitor = async (credentials: Credentials, shouldGetVisitorDetails = false) => {
  try {
    const { urlSlug, visitorId } = credentials;

    let visitor: VisitorInterface;
    if (shouldGetVisitorDetails) visitor = await Visitor.get(visitorId, urlSlug, { credentials });
    else visitor = await Visitor.create(visitorId, urlSlug, { credentials });

    if (!visitor) throw "Not in world";

    const dataObject = ((await visitor.fetchDataObject()) as Record<string, any>) || {};
    const key = STUDY_STACKS_DATA_KEY;
    const existing = dataObject[key];

    if (!hasFullShape(existing)) {
      // Either undefined, legacy, or partial — merge defaults onto whatever's
      // there so we never destroy useful state but always end up with the full
      // VisitorStudyData shape.
      const merged: VisitorStudyData = {
        ...DEFAULT_VISITOR_STUDY_DATA(),
        ...(existing && typeof existing === "object" ? normalizeStudyData(existing) : {}),
      };
      const lockId = `${key}-${new Date(Math.round(Date.now() / 60000) * 60000)}`;
      if (!dataObject || Object.keys(dataObject).length === 0) {
        await visitor.setDataObject({ [key]: merged }, { lock: { lockId, releaseLock: true } });
      } else {
        await visitor.updateDataObject({ [key]: merged }, { lock: { lockId, releaseLock: true } });
      }
      // The SDK doesn't refresh `visitor.dataObject` automatically after writes — patch
      // the local view so downstream callers see the normalized data without an extra
      // fetch round-trip.
      (visitor as any).dataObject = { ...dataObject, [key]: merged };
    }

    await visitor.fetchInventoryItems();
    const visitorInventory = getVisitorBadges(visitor.inventoryItems);

    return { visitor, visitorInventory };
  } catch (error) {
    throw standardizeError(error);
  }
};
