import { garmentLabel } from "./catalog";
import { money, mxn, round1 } from "./format";
import type {
  AppliedCoupon,
  BaseService,
  DistanceMethod,
  GarmentCount,
  PriceBreakdown,
  Rates,
} from "./types";

export function computePrice(input: {
  rates: Rates;
  kg: number;
  baseService: BaseService;
  planchado: boolean;
  garments: GarmentCount[];
  km: number;
  distanceMethod: DistanceMethod;
  coupon: AppliedCoupon | null;
}): PriceBreakdown {
  const kg = round1(Math.max(0, input.kg));
  const km = input.km > 0 ? Math.max(0.1, round1(input.km)) : 0;
  const lines: PriceBreakdown["lines"] = [];

  if (input.baseService === "lavado_normal") {
    lines.push({
      id: "lavado",
      label: "Lavado normal",
      detail: `${kg.toFixed(1)} kg × ${mxn(input.rates.lavadoNormalPerKg)}`,
      amount: money(kg * input.rates.lavadoNormalPerKg),
    });
  } else {
    lines.push({
      id: "seco",
      label: "Lavado en seco",
      detail: `${kg.toFixed(1)} kg × ${mxn(input.rates.lavadoEnSecoPerKg)}`,
      amount: money(kg * input.rates.lavadoEnSecoPerKg),
    });
  }

  if (input.planchado) {
    lines.push({
      id: "planchado",
      label: "Planchado",
      detail: `${kg.toFixed(1)} kg × ${mxn(input.rates.planchadoPerKg)}`,
      amount: money(kg * input.rates.planchadoPerKg),
    });
  }

  for (const garment of input.garments) {
    const rate = input.rates.itemRates[garment.type] ?? 0;
    if (rate > 0 && garment.count > 0) {
      lines.push({
        id: `item-${garment.type}`,
        label: garmentLabel(garment.type),
        detail: `${garment.count} × ${mxn(rate)}`,
        amount: money(garment.count * rate),
      });
    }
  }

  lines.push({
    id: "recoleccion",
    label: "Recolección",
    detail: `${km.toFixed(1)} km × ${mxn(input.rates.recoleccionPerKm)}`,
    amount: money(km * input.rates.recoleccionPerKm),
  });
  lines.push({
    id: "entrega",
    label: "Entrega",
    detail: `${km.toFixed(1)} km × ${mxn(input.rates.entregaPerKm)}`,
    amount: money(km * input.rates.entregaPerKm),
  });

  const subtotal = money(lines.reduce((sum, line) => sum + line.amount, 0));
  let discount = 0;
  let discountLabel: string | null = null;
  if (input.coupon && subtotal > 0) {
    discount =
      input.coupon.type === "percent"
        ? money(subtotal * (input.coupon.value / 100))
        : money(Math.min(input.coupon.value, subtotal));
    discountLabel =
      input.coupon.type === "percent"
        ? `Cupón ${input.coupon.code} · ${input.coupon.value}%`
        : `Cupón ${input.coupon.code}`;
  }

  return {
    lines,
    subtotal,
    discount,
    discountLabel,
    total: money(Math.max(0, subtotal - discount)),
    km,
    distanceMethod: input.distanceMethod,
    kg,
  };
}

export function distanceNote(method: DistanceMethod) {
  if (method === "osrm") {
    return "Kilómetros por calles (OpenStreetMap). La recolección y la entrega se cobran por separado, aunque el recorrido sea el mismo de ida y vuelta.";
  }
  return "No hubo ruta de calles. Usamos la línea recta × 1.35 como aproximación urbana. La recolección y la entrega se cobran por separado.";
}
