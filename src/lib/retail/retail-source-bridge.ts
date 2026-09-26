/**
 * Client-side bridge for the active Retail analytics source selection.
 *
 * The Retail dashboard stores the selected connected POS source here so the
 * AI assistant can route retail questions to the selected source instead of
 * silently falling back to an unrelated uploaded dataset. Values are only
 * ever connection IDs the server re-validates for ownership.
 */

const ACTIVE_RETAIL_SOURCE_KEY = "useclevr.activeRetailSource";

export type ActiveRetailSource = {
  type: "square";
  connectionId: string;
  label: string;
};

export function setActiveRetailSource(source: ActiveRetailSource | null) {
  if (typeof window === "undefined") return;
  if (!source) {
    sessionStorage.removeItem(ACTIVE_RETAIL_SOURCE_KEY);
    return;
  }
  sessionStorage.setItem(ACTIVE_RETAIL_SOURCE_KEY, JSON.stringify(source));
}

export function getActiveRetailSource(): ActiveRetailSource | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_RETAIL_SOURCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveRetailSource>;
    if (parsed?.type === "square" && typeof parsed.connectionId === "string" && parsed.connectionId) {
      return { type: "square", connectionId: parsed.connectionId, label: parsed.label || "Square" };
    }
    return null;
  } catch {
    return null;
  }
}
