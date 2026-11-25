export interface LatLng {
  lat: number;
  lng: number;
}

/** Factor para aproximar calles cuando no hay ruta de OpenStreetMap. */
export const ROAD_FACTOR = 1.35;

export function haversineKm(a: LatLng, b: LatLng) {
  const radius = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineRoute(a: LatLng, b: LatLng, steps = 24): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const bend = Math.sin(t * Math.PI) * 0.0018;
    points.push([
      a.lat + (b.lat - a.lat) * t + bend,
      a.lng + (b.lng - a.lng) * t - bend * 0.45,
    ]);
  }
  return points;
}

export function pointAlong(route: Array<[number, number]>, progress: number): [number, number] {
  if (route.length === 0) return [19.4326, -99.1332];
  if (route.length === 1 || progress <= 0) return route[0];
  if (progress >= 1) return route[route.length - 1];

  const segments: number[] = [];
  let total = 0;
  for (let index = 1; index < route.length; index += 1) {
    const distance = haversineKm(
      { lat: route[index - 1][0], lng: route[index - 1][1] },
      { lat: route[index][0], lng: route[index][1] },
    );
    segments.push(distance);
    total += distance;
  }
  if (total === 0) return route[route.length - 1];

  let remaining = progress * total;
  for (let index = 0; index < segments.length; index += 1) {
    if (remaining <= segments[index] || index === segments.length - 1) {
      const fraction = segments[index] === 0 ? 0 : remaining / segments[index];
      const start = route[index];
      const end = route[index + 1];
      return [
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ];
    }
    remaining -= segments[index];
  }
  return route[route.length - 1];
}

function rad(value: number) {
  return (value * Math.PI) / 180;
}
