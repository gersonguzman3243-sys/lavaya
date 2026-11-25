import { beforeEach, describe, expect, it } from "vitest";
import { intakeOrder } from "./orders";
import {
  applyVerifiedPayment,
  choosePayment,
  handlePaymentNotification,
  paymentIdFromWebhook,
} from "./payments";
import { readDb, resetDb } from "./store";

describe("pagos", () => {
  beforeEach(() => {
    resetDb();
    delete process.env.MP_ACCESS_TOKEN;
  });

  it("sin token deja el pedido en modo demo y conserva el efectivo", async () => {
    const db = readDb();
    const ana = db.users.find((user) => user.email === "ana@lavaya.mx")!;
    const rosa = db.users.find((user) => user.email === "rosa@lavaya.mx")!;
    const weighed = intakeOrder(rosa, "ord_ana_taller", {
      kg: 2,
      garments: [{ type: "playera", count: 4 }],
      photos: [],
    });
    const demo = await choosePayment(ana, weighed.id, "mercadopago", new Request("http://127.0.0.1/api/payments/checkout"));
    expect(demo.mode).toBe("demo");
    expect(demo.order.paymentStatus).toBe("demo");
    expect(demo.order.customerAccepted).toBe(true);

    resetDb();
    const again = readDb();
    const ana2 = again.users.find((user) => user.email === "ana@lavaya.mx")!;
    const rosa2 = again.users.find((user) => user.email === "rosa@lavaya.mx")!;
    const second = intakeOrder(rosa2, "ord_ana_taller", {
      kg: 2,
      garments: [{ type: "playera", count: 4 }],
      photos: [],
    });
    const cash = await choosePayment(ana2, second.id, "efectivo", new Request("http://127.0.0.1/api/payments/checkout"));
    expect(cash.mode).toBe("efectivo");
    expect(cash.order.paymentStatus).toBe("efectivo");
  });

  it("el webhook solo actualiza el pedido después de leer el pago en Mercado Pago", async () => {
    const db = readDb();
    const rosa = db.users.find((user) => user.email === "rosa@lavaya.mx")!;
    const order = intakeOrder(rosa, "ord_ana_taller", {
      kg: 2,
      garments: [{ type: "playera", count: 4 }],
      photos: [],
    });
    const total = order.finalPrice!.total;
    const url = "https://lavaya.onrender.com/api/payments/webhook?topic=payment&id=9988";
    expect(paymentIdFromWebhook(url, null)).toBe("9988");
    expect(paymentIdFromWebhook("https://lavaya.onrender.com/api/payments/webhook", { type: "payment", data: { id: 42 } })).toBe("42");

    const updated = await handlePaymentNotification("9988", async () => ({
      id: "9988",
      status: "approved",
      external_reference: order.id,
      transaction_amount: total,
    }));
    expect(updated.paymentStatus).toBe("aprobado");
    expect(updated.paymentMethod).toBe("mercadopago");
    expect(readDb().orders.find((item) => item.id === order.id)?.paymentId).toBe("9988");

    expect(() =>
      applyVerifiedPayment({
        id: "9990",
        status: "approved",
        external_reference: order.id,
        transaction_amount: total + 50,
      }),
    ).toThrow(/no coincide/);
  });
});
