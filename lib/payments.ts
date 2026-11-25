import { AppError } from "./errors";
import { paymentStatusLabel } from "./payment-label";
import { commit, emit, readDb } from "./store";
import type { Order, User } from "./types";

export { paymentStatusLabel };

export interface RemotePayment {
  id: string;
  status: string;
  external_reference: string;
  transaction_amount: number;
}

export function mercadoPagoConfigured() {
  return Boolean(process.env.MP_ACCESS_TOKEN?.trim());
}

export function mapMercadoPagoStatus(status: string): import("./types").PaymentStatus {
  switch (status) {
    case "approved":
      return "aprobado";
    case "pending":
    case "in_process":
    case "in_mediation":
    case "authorized":
      return "en_proceso";
    case "refunded":
    case "charged_back":
      return "reembolsado";
    default:
      return "rechazado";
  }
}

export function paymentIdFromWebhook(requestUrl: string, body: unknown) {
  const url = new URL(requestUrl);
  const topic = url.searchParams.get("topic") || url.searchParams.get("type");
  const queryId = url.searchParams.get("data.id") || url.searchParams.get("id");
  if (queryId && (topic === "payment" || !topic)) return queryId;
  if (!body || typeof body !== "object") return null;
  const record = body as {
    type?: string;
    topic?: string;
    action?: string;
    data?: { id?: string | number };
  };
  const type = record.type || record.topic;
  if (type && type !== "payment") return null;
  if (record.data?.id != null) return String(record.data.id);
  return null;
}

export function applyVerifiedPayment(remote: RemotePayment) {
  if (!remote.external_reference) throw new AppError("El pago no trae el pedido.", 422);
  const updated = commit((db) => {
    const order = db.orders.find((item) => item.id === remote.external_reference);
    if (!order) throw new AppError("No encontramos el pedido de ese pago.", 404);
    const expected = order.finalPrice?.total ?? order.estimate.total;
    if (!Number.isFinite(remote.transaction_amount) || Math.abs(remote.transaction_amount - expected) > 1) {
      throw new AppError("El monto del pago no coincide con el total del pedido.", 409);
    }
    order.paymentId = String(remote.id);
    order.paymentMethod = "mercadopago";
    order.paymentStatus = mapMercadoPagoStatus(remote.status);
    order.updatedAt = new Date().toISOString();
    const owner = db.laundries.find((shop) => shop.id === order.laundryId);
    const laundryUser = db.users.find((user) => user.id === owner?.ownerId);
    if (laundryUser) {
      db.notifications.unshift({
        id: `nt_${order.paymentId}`,
        userId: laundryUser.id,
        orderId: order.id,
        title: paymentStatusLabel(order.paymentStatus),
        body: `${order.code} · ${paymentStatusLabel(order.paymentStatus)}.`,
        createdAt: order.updatedAt,
        read: false,
        important: order.paymentStatus === "aprobado",
      });
    }
    db.notifications.unshift({
      id: `nt_cli_${order.paymentId}`,
      userId: order.customerId,
      orderId: order.id,
      title: paymentStatusLabel(order.paymentStatus),
      body:
        order.paymentStatus === "aprobado"
          ? `${order.code} quedó pagado con Mercado Pago.`
          : `${order.code}: ${paymentStatusLabel(order.paymentStatus)}.`,
      createdAt: order.updatedAt,
      read: false,
      important: order.paymentStatus === "aprobado",
    });
    return structuredClone(order);
  });
  emit({ type: "changed" });
  return updated;
}

export async function fetchRemotePayment(id: string): Promise<RemotePayment> {
  if (!mercadoPagoConfigured()) throw new AppError("Mercado Pago no está configurado.", 503);
  const { MercadoPagoConfig, Payment } = await import("mercadopago");
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN!.trim() });
  const payment = new Payment(client);
  const result = await payment.get({ id });
  return {
    id: String(result.id),
    status: String(result.status ?? ""),
    external_reference: String(result.external_reference ?? ""),
    transaction_amount: Number(result.transaction_amount),
  };
}

export async function handlePaymentNotification(id: string, fetcher: (paymentId: string) => Promise<RemotePayment> = fetchRemotePayment) {
  const remote = await fetcher(id);
  return applyVerifiedPayment(remote);
}

function appBase(request: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost";
  return `${proto}://${host}`;
}

export async function choosePayment(user: User, orderId: string, method: "efectivo" | "mercadopago", request: Request) {
  if (user.role !== "cliente") throw new AppError("Solo el cliente elige cómo pagar.", 403);
  const snapshot = readDb().orders.find((item) => item.id === orderId);
  if (!snapshot || snapshot.customerId !== user.id) throw new AppError("Este pedido no es tuyo.", 404);
  if (!snapshot.finalPrice || snapshot.status === "cancelado") {
    throw new AppError("El pago se elige cuando el taller ya pesó la ropa.");
  }
  if (method === "efectivo") {
    const order = commit((db) => {
      const target = db.orders.find((item) => item.id === orderId)!;
      if (!target.customerAccepted) {
        target.customerAccepted = true;
      }
      target.paymentMethod = "efectivo";
      target.paymentStatus = "efectivo";
      target.updatedAt = new Date().toISOString();
      return structuredClone(target);
    });
    emit({ type: "changed" });
    return { mode: "efectivo" as const, order };
  }

  if (!mercadoPagoConfigured()) {
    const order = commit((db) => {
      const target = db.orders.find((item) => item.id === orderId)!;
      if (!target.customerAccepted) target.customerAccepted = true;
      target.paymentMethod = "mercadopago";
      target.paymentStatus = "demo";
      target.preferenceId = null;
      target.updatedAt = new Date().toISOString();
      return structuredClone(target);
    });
    emit({ type: "changed" });
    return { mode: "demo" as const, order };
  }

  const base = appBase(request);
  const preference = await createPreference(snapshot, user, base);
  const order = commit((db) => {
    const target = db.orders.find((item) => item.id === orderId)!;
    if (!target.customerAccepted) target.customerAccepted = true;
    target.paymentMethod = "mercadopago";
    target.paymentStatus = target.paymentStatus === "aprobado" ? "aprobado" : "en_proceso";
    target.preferenceId = preference.id;
    target.updatedAt = new Date().toISOString();
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return {
    mode: "mercadopago" as const,
    order,
    initPoint: preference.initPoint,
    sandboxInitPoint: preference.sandboxInitPoint,
  };
}

async function createPreference(order: Order, user: User, base: string) {
  const total = Math.round((order.finalPrice?.total ?? 0) * 100) / 100;
  if (total <= 0) throw new AppError("El total del pedido no se puede cobrar.");
  const { MercadoPagoConfig, Preference } = await import("mercadopago");
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN!.trim() });
  const preference = new Preference(client);
  const success = `${base}/cliente?pago=exito&pedido=${order.id}`;
  const pending = `${base}/cliente?pago=pendiente&pedido=${order.id}`;
  const failure = `${base}/cliente?pago=fallo&pedido=${order.id}`;
  const body: {
    items: Array<{ id: string; title: string; quantity: number; unit_price: number; currency_id: string }>;
    payer: { email: string; name: string };
    back_urls: { success: string; pending: string; failure: string };
    external_reference: string;
    notification_url: string;
    auto_return?: "approved";
    metadata: { order_id: string };
  } = {
    items: [
      {
        id: order.code,
        title: `LavaYa ${order.code}`,
        quantity: 1,
        unit_price: total,
        currency_id: "MXN",
      },
    ],
    payer: { email: user.email, name: user.name },
    back_urls: { success, pending, failure },
    external_reference: order.id,
    notification_url: `${base}/api/payments/webhook`,
    metadata: { order_id: order.id },
  };
  if (base.startsWith("https://")) body.auto_return = "approved";
  const result = await preference.create({ body });
  return {
    id: String(result.id),
    initPoint: result.init_point ?? "",
    sandboxInitPoint: result.sandbox_init_point ?? result.init_point ?? "",
  };
}
