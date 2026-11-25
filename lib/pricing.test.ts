import { describe, expect, it } from "vitest";
import { DEFAULT_RATES, canTransition, estimateKg } from "./catalog";
import { couponError } from "./coupons";
import { haversineKm } from "./geo";
import { computePrice } from "./pricing";
import type { Coupon } from "./types";

describe("precio LavaYa", () => {
  it("cobra lavado a 12 por kg y los dos tramos de distancia", () => {
    const price = computePrice({
      rates: DEFAULT_RATES,
      kg: 2,
      baseService: "lavado_normal",
      planchado: false,
      garments: [{ type: "playera", count: 4 }],
      km: 3,
      distanceMethod: "osrm",
      coupon: null,
    });
    expect(price.lines.map((line) => [line.id, line.amount])).toEqual([
      ["lavado", 24],
      ["recoleccion", 15],
      ["entrega", 15],
    ]);
    expect(price.total).toBe(54);
    expect(price.lines.find((line) => line.id === "lavado")?.detail).toContain("12");
  });

  it("suma planchado y aplica un cupón de porcentaje", () => {
    const price = computePrice({
      rates: DEFAULT_RATES,
      kg: 2,
      baseService: "lavado_normal",
      planchado: true,
      garments: [],
      km: 3.14,
      distanceMethod: "haversine",
      coupon: { code: "LAVAYA20", type: "percent", value: 20, description: "bienvenida" },
    });
    const planchado = price.lines.find((line) => line.id === "planchado");
    expect(planchado?.amount).toBe(36);
    expect(price.km).toBe(3.1);
    expect(price.subtotal).toBe(24 + 36 + 15.5 + 15.5);
    expect(price.discount).toBeCloseTo(price.subtotal * 0.2, 2);
    expect(price.total).toBeCloseTo(price.subtotal - price.discount, 2);
    expect(price.discountLabel).toContain("LAVAYA20");
  });

  it("el lavado en seco sustituye al normal y el cupón fijo no deja el total en negativo", () => {
    const price = computePrice({
      rates: DEFAULT_RATES,
      kg: 1,
      baseService: "lavado_en_seco",
      planchado: false,
      garments: [{ type: "chamarra", count: 1 }],
      km: 1,
      distanceMethod: "osrm",
      coupon: { code: "FIJO25", type: "fixed", value: 500, description: "fijo" },
    });
    expect(price.lines.some((line) => line.id === "lavado")).toBe(false);
    expect(price.lines.find((line) => line.id === "seco")?.amount).toBe(48);
    expect(price.total).toBe(0);
    expect(price.discount).toBe(price.subtotal);
  });

  it("suma extras por prenda solo si la tarifa es mayor a cero", () => {
    const rates = {
      ...DEFAULT_RATES,
      itemRates: { ...DEFAULT_RATES.itemRates, chamarra: 25 },
    };
    const price = computePrice({
      rates,
      kg: 1,
      baseService: "lavado_normal",
      planchado: false,
      garments: [
        { type: "chamarra", count: 2 },
        { type: "playera", count: 3 },
      ],
      km: 2,
      distanceMethod: "osrm",
      coupon: null,
    });
    expect(price.lines.find((line) => line.id === "item-chamarra")?.amount).toBe(50);
    expect(price.lines.some((line) => line.id === "item-playera")).toBe(false);
  });
});

describe("cupones", () => {
  const base: Coupon = {
    code: "LAVAYA20",
    description: "bienvenida",
    type: "percent",
    value: 20,
    expiresAt: null,
    usageLimit: 2,
    usedCount: 0,
    active: true,
  };

  it("acepta un cupón vigente", () => {
    expect(couponError(base, new Date("2026-01-01"))).toBeNull();
  });

  it("rechaza vencido, agotado o apagado", () => {
    expect(couponError(undefined)).toMatch(/No encontramos/);
    expect(couponError({ ...base, active: false })).toMatch(/No encontramos/);
    expect(couponError({ ...base, expiresAt: "2020-01-01T00:00:00.000Z" }, new Date("2026-01-01"))).toMatch(/venció/);
    expect(couponError({ ...base, usedCount: 2 })).toMatch(/agotó/);
  });
});

describe("estado y peso", () => {
  it("solo permite el siguiente paso y cancelar al inicio", () => {
    expect(canTransition("solicitado", "recolector_asignado")).toBe(true);
    expect(canTransition("solicitado", "en_camino")).toBe(false);
    expect(canTransition("pesado", "lavando")).toBe(true);
    expect(canTransition("listo", "en_entrega")).toBe(true);
    expect(canTransition("entregado", "en_camino")).toBe(false);
    expect(canTransition("solicitado", "cancelado")).toBe(true);
    expect(canTransition("en_camino", "cancelado")).toBe(false);
  });

  it("estima kilos con un mínimo de medio kilo", () => {
    expect(estimateKg([{ type: "interior", count: 1 }])).toBe(0.5);
    expect(estimateKg([{ type: "playera", count: 4 }, { type: "camisa", count: 2 }])).toBe(1.3);
  });
});

describe("distancia", () => {
  it("la línea recta es simétrica y crece con la separación", () => {
    const roma = { lat: 19.4187, lng: -99.1622 };
    const doctores = { lat: 19.4216, lng: -99.1436 };
    const ida = haversineKm(roma, doctores);
    const vuelta = haversineKm(doctores, roma);
    expect(ida).toBeCloseTo(vuelta, 6);
    expect(ida).toBeGreaterThan(1);
    expect(ida).toBeLessThan(4);
  });
});
