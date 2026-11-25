import { haversineKm, lineRoute, ROAD_FACTOR, type LatLng } from "./geo";
import type { DistanceMethod } from "./types";

export interface RouteResult {
  km: number;
  method: DistanceMethod;
  route: Array<[number, number]>;
}

const cache = new Map<string, RouteResult>();

export async function routeBetween(from: LatLng, to: LatLng): Promise<RouteResult> {
  const key = [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(4)).join(",");
  const cached = cache.get(key);
  if (cached) return cached;

  const fallback = (): RouteResult => ({
    km: haversineKm(from, to) * ROAD_FACTOR,
    method: "haversine",
    route: lineRoute(from, to),
  });

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      headers: { "User-Agent": "LavaYa/0.1 (demo educativa)" },
    });
    if (!response.ok) throw new Error("osrm");
    const data = (await response.json()) as {
      routes?: Array<{
        distance: number;
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };
    const route = data.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!route || !coordinates?.length) throw new Error("sin ruta");
    const result: RouteResult = {
      km: route.distance / 1000,
      method: "osrm",
      route: coordinates.map(([lng, lat]) => [lat, lng]),
    };
    cache.set(key, result);
    return result;
  } catch {
    const result = fallback();
    cache.set(key, result);
    return result;
  }
}
