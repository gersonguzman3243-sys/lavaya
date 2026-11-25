import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerAccount, reviewAccount } from "./accounts";
import { createOrder, visibleOrders } from "./orders";
import { readDb, resetDb } from "./store";
import type { User } from "./types";

vi.mock("./routing", () => ({
  routeBetween: async (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => ({
    km: 2.4,
    method: "haversine" as const,
    route: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
  }),
}));

const admin = (): User => readDb().users.find((user) => user.role === "admin")!;

describe("registro y aprobación", () => {
  beforeEach(() => {
    resetDb();
  });

  it("deja al cliente activo y a la lavandería y al recolector en pendiente", () => {
    const customer = registerAccount({
      role: "cliente",
      name: "Eva Solís",
      email: "eva@ejemplo.mx",
      password: "secreto1",
      phone: "5511112222",
    });
    const shop = registerAccount({
      role: "lavanderia",
      name: "Nora Pérez",
      email: "nora@ejemplo.mx",
      password: "secreto1",
      phone: "5533334444",
      businessName: "Burbujas Del Valle",
      address: "Avenida del Taller 10, CDMX",
      lat: 19.3,
      lng: -99.2,
      hours: "Lun a vie · 9 a 18",
    });
    const courier = registerAccount({
      role: "recolector",
      name: "Hugo Díaz",
      email: "hugo@ejemplo.mx",
      password: "secreto1",
      phone: "5555556666",
      plate: "AB-12-CD",
    });
    expect(customer.status).toBe("activo");
    expect(shop.status).toBe("pendiente");
    expect(courier.status).toBe("pendiente");
    expect(visibleOrders(courier, readDb().orders)).toEqual([]);
  });

  it("asigna el pedido a la lavandería aprobada más cercana y el recolector cercano lo ve", async () => {
    const customer = registerAccount({
      role: "cliente",
      name: "Eva Solís",
      email: "eva@ejemplo.mx",
      password: "secreto1",
      phone: "5511112222",
    });
    const shop = registerAccount({
      role: "lavanderia",
      name: "Nora Pérez",
      email: "nora@ejemplo.mx",
      password: "secreto1",
      phone: "5533334444",
      businessName: "Burbujas Del Valle",
      address: "Avenida del Taller 10, CDMX",
      lat: 19.3002,
      lng: -99.2002,
      hours: "Lun a vie · 9 a 18",
    });
    registerAccount({
      role: "recolector",
      name: "Hugo Díaz",
      email: "hugo@ejemplo.mx",
      password: "secreto1",
      phone: "5555556666",
      plate: "AB-12-CD",
    });
    const before = await createOrder(customer, draft(19.3, -99.2));
    expect(before.laundryName).toBe("LavaYa Taller Doctores");

    reviewAccount(admin(), { userId: shop.id, decision: "aprobar" });
    const approvedShop = readDb().users.find((user) => user.email === "nora@ejemplo.mx")!;
    expect(approvedShop.status).toBe("activo");
    const order = await createOrder(customer, draft(19.3, -99.2));
    expect(order.laundryName).toBe("Burbujas Del Valle");
    expect(order.pricing.rates.lavadoNormalPerKg).toBe(12);
    expect(order.pricing.rates.recoleccionPerKm).toBe(5);
    expect(order.pricing.rates.entregaPerKm).toBe(5);

    const hugo = readDb().users.find((user) => user.email === "hugo@ejemplo.mx")!;
    expect(visibleOrders(hugo, readDb().orders).some((item) => item.id === order.id)).toBe(false);
    reviewAccount(admin(), { userId: hugo.id, decision: "aprobar" });
    const hugoLive = { ...readDb().users.find((user) => user.id === hugo.id)!, lat: 19.301, lng: -99.201 };
    expect(visibleOrders(hugoLive, readDb().orders).some((item) => item.id === order.id)).toBe(true);

    reviewAccount(admin(), { userId: hugo.id, decision: "suspender" });
    const suspended = readDb().users.find((user) => user.id === hugo.id)!;
    expect(visibleOrders(suspended, readDb().orders)).toEqual([]);
  });
});

function draft(lat: number, lng: number) {
  return {
    address: "Calle de prueba 20, CDMX",
    reference: "Portón verde",
    lat,
    lng,
    notes: "",
    customerPhoto: null,
    garments: [{ type: "playera", count: 2 }],
    baseService: "lavado_normal" as const,
    planchado: false,
    scheduledFor: null,
    couponCode: null,
  };
}
