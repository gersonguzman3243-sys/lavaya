import { DEFAULT_RATES } from "./catalog";
import { haversineKm } from "./geo";
import type { DB, LaundryBusiness, Rates } from "./types";

export const NEARBY_KM = 18;

export function activeLaundries(db: DB) {
  return db.laundries.filter((shop) => shop.status === "activo");
}

export function effectiveRates(db: DB, shop: LaundryBusiness | undefined): Rates {
  return structuredClone(shop?.rates ?? db.rates ?? DEFAULT_RATES);
}

export function nearestLaundry(db: DB, lat: number, lng: number) {
  const shops = activeLaundries(db);
  let best: { shop: LaundryBusiness; km: number } | null = null;
  for (const shop of shops) {
    const km = haversineKm({ lat, lng }, shop);
    if (!best || km < best.km) best = { shop, km };
  }
  return best;
}

export function laundryOf(db: DB, laundryId: string | null | undefined) {
  return db.laundries.find((shop) => shop.id === laundryId) ?? null;
}
