import { canTransition, estimateKg, garmentById, statusLabel } from "./catalog";
import { couponError, normalizeCode } from "./coupons";
import { AppError } from "./errors";
import { haversineKm, ROAD_FACTOR } from "./geo";
import { computePrice } from "./pricing";
import { persistPhoto } from "./media";
import { routeBetween } from "./routing";
import { effectiveRates, laundryOf, nearestLaundry, NEARBY_KM } from "./shops";
import { commit, emit, newId, readDb } from "./store";
import type {
  AppliedCoupon,
  Banner,
  BaseService,
  Coupon,
  GarmentCount,
  Order,
  OrderStatus,
  PublicUser,
  Rates,
  PaymentStatus,
  User,
} from "./types";

export { AppError };

const MAX_KM = 40;

export function publicUser(user: User): PublicUser {
  const { password, courier, ...rest } = user;
  void password;
  return {
    ...rest,
    courier: courier
      ? {
          plate: courier.plate,
          available: courier.available,
          liveGps: courier.liveGps,
          hasIdPhoto: Boolean(courier.idPhoto),
        }
      : null,
  };
}

function clean(value: string, max: number) {
  return value.replace(/[<>]/g, "").trim().slice(0, max);
}

function assertImage(dataUrl: string, label: string) {
  if (dataUrl.startsWith("/api/media/")) return;
  if (!dataUrl.startsWith("data:image/")) {
    throw new AppError(`${label} tiene que ser una imagen.`);
  }
  if (dataUrl.length > 450_000) {
    throw new AppError(`${label} pesa demasiado. Prueba con una foto más pequeña.`);
  }
}

function keepPhoto(value: string, label: string) {
  assertImage(value, label);
  try {
    return persistPhoto(value);
  } catch {
    throw new AppError(`${label} no se pudo guardar.`);
  }
}

export function normalizeGarments(input: GarmentCount[]) {
  const counts = new Map<string, number>();
  for (const item of input ?? []) {
    if (!garmentById(item.type)) continue;
    const count = Math.round(Number(item.count));
    if (!Number.isFinite(count) || count <= 0) continue;
    counts.set(item.type, Math.min(99, (counts.get(item.type) ?? 0) + count));
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
}

function findOrder(db: ReturnType<typeof readDb>, id: string) {
  const order = db.orders.find((item) => item.id === id);
  if (!order) throw new AppError("No encontramos ese pedido.", 404);
  return order;
}

function setStatus(order: Order, status: OrderStatus) {
  if (!canTransition(order.status, status)) {
    throw new AppError("Este pedido ya cambió de estado. Actualiza la pantalla.");
  }
  order.status = status;
  order.updatedAt = new Date().toISOString();
  order.statusLog.push({ status, at: order.updatedAt });
}

function notify(
  db: ReturnType<typeof readDb>,
  userId: string,
  input: { orderId: string | null; title: string; body: string; important?: boolean },
) {
  db.notifications.unshift({
    id: newId("nt"),
    userId,
    orderId: input.orderId,
    title: input.title,
    body: input.body,
    createdAt: new Date().toISOString(),
    read: false,
    important: Boolean(input.important),
  });
}

function notifyCustomer(db: ReturnType<typeof readDb>, order: Order) {
  const copy = customerNotice(order);
  notify(db, order.customerId, { orderId: order.id, ...copy });
}

function customerNotice(order: Order): { title: string; body: string; important?: boolean } {
  const who = order.courierName ?? "Tu recolector";
  switch (order.status) {
    case "solicitado":
      return {
        title: "Pedido recibido",
        body: order.scheduledFor
          ? `Programamos ${order.code} para la hora que elegiste.`
          : `Ya tenemos ${order.code}. Buscamos un recolector en moto.`,
      };
    case "en_camino":
      return { title: "Va en camino", body: `${who} va en moto hacia tu domicilio.` };
    case "recogido":
      return { title: "Ropa recogida", body: "Tu ropa ya va rumbo a la lavandería." };
    case "en_lavanderia":
      return {
        title: "En la lavandería",
        body: "Llegó al taller. En un momento verás el peso y el total.",
      };
    case "pesado":
      return {
        title: "Ya sabemos cuánto llegó",
        body: `Recibimos ${order.actualKg?.toFixed(1)} kg en ${order.code}. Revisa el total y acéptalo.`,
        important: true,
      };
    case "lavando":
      return { title: "Estamos lavando", body: `Tu pedido ${order.code} ya está en lavado.` };
    case "listo":
      return {
        title: "Tu ropa está lista",
        body: `${order.code} ya puede salir de regreso a tu casa.`,
        important: true,
      };
    case "en_entrega":
      return { title: "Va de regreso", body: `${who} lleva tu ropa limpia.` };
    case "entregado":
      return {
        title: "Entregado",
        body: "Listo. ¿Nos cuentas cómo te fue con el recolector?",
      };
    case "cancelado":
      return { title: "Pedido cancelado", body: `Cancelamos ${order.code}.` };
    default:
      return { title: statusLabel(order.status), body: `Tu pedido ${order.code} se actualizó.` };
  }
}

function laundryUser(db: ReturnType<typeof readDb>, order?: Order) {
  if (order) {
    const shop = laundryOf(db, order.laundryId);
    return db.users.find((user) => user.id === shop?.ownerId) ?? null;
  }
  return db.users.find((user) => user.role === "lavanderia" && user.status === "activo") ?? null;
}

function notifyLaundryArrival(db: ReturnType<typeof readDb>, order: Order) {
  const laundry = laundryUser(db, order);
  if (!laundry) return;
  notify(db, laundry.id, {
    orderId: order.id,
    title: "Llegó ropa al taller",
    body: `${order.code} de ${order.customerName} espera peso y conteo.`,
    important: true,
  });
}

export interface OrderDraft {
  address: string;
  reference: string;
  lat: number;
  lng: number;
  notes: string;
  customerPhoto: string | null;
  garments: GarmentCount[];
  baseService: BaseService;
  planchado: boolean;
  scheduledFor: string | null;
  couponCode: string | null;
}

function assertDraft(draft: OrderDraft) {
  if (!Number.isFinite(draft.lat) || !Number.isFinite(draft.lng)) {
    throw new AppError("Falta el punto en el mapa.");
  }
  if (draft.address.trim().length < 6) {
    throw new AppError("Escribe la dirección donde pasamos por la ropa.");
  }
  const garments = normalizeGarments(draft.garments);
  if (!garments.length) throw new AppError("Cuéntanos al menos una prenda.");
  if (draft.baseService !== "lavado_normal" && draft.baseService !== "lavado_en_seco") {
    throw new AppError("Elige lavado normal o lavado en seco.");
  }
  if (draft.customerPhoto) assertImage(draft.customerPhoto, "La foto");
  if (draft.scheduledFor) {
    const when = new Date(draft.scheduledFor);
    if (Number.isNaN(when.getTime())) throw new AppError("Esa fecha no es válida.");
    const delta = when.getTime() - Date.now();
    if (delta < 15 * 60 * 1000) {
      throw new AppError("Elige una hora con al menos 15 minutos de anticipación, o pide ahora mismo.");
    }
    if (delta > 30 * 24 * 60 * 60 * 1000) {
      throw new AppError("Puedes programar hasta 30 días adelante.");
    }
  }
  return garments;
}

async function distanceToLaundry(lat: number, lng: number) {
  const db = readDb();
  const nearest = nearestLaundry(db, lat, lng);
  if (!nearest) throw new AppError("Todavía no hay una lavandería aprobada para recibir ropa.");
  if (nearest.km > MAX_KM) {
    throw new AppError("Por ahora recolectamos a menos de 40 km de una lavandería aprobada.");
  }
  const routed = await routeBetween({ lat, lng }, nearest.shop);
  return { ...routed, shop: nearest.shop, rates: effectiveRates(db, nearest.shop) };
}

function priceFrom(
  orderLike: {
    pricing: Order["pricing"];
    baseService: BaseService;
    planchado: boolean;
    garments: GarmentCount[];
  },
  kg: number,
  garments: GarmentCount[],
) {
  return computePrice({
    rates: orderLike.pricing.rates,
    km: orderLike.pricing.km,
    distanceMethod: orderLike.pricing.distanceMethod,
    coupon: orderLike.pricing.coupon,
    baseService: orderLike.baseService,
    planchado: orderLike.planchado,
    garments,
    kg,
  });
}

export async function quoteOrder(draft: OrderDraft) {
  const garments = assertDraft({ ...draft, couponCode: null, customerPhoto: null });
  const routed = await distanceToLaundry(draft.lat, draft.lng);
  const db = readDb();
  let coupon: AppliedCoupon | null = null;
  let couponErrorMessage: string | null = null;
  if (draft.couponCode && draft.couponCode.trim()) {
    const code = normalizeCode(draft.couponCode);
    const found = db.coupons.find((item) => item.code === code);
    const error = couponError(found);
    if (error || !found) couponErrorMessage = error ?? "No encontramos ese cupón.";
    else {
      coupon = {
        code: found.code,
        type: found.type,
        value: found.value,
        description: found.description,
      };
    }
  }
  const kg = estimateKg(garments);
  const price = computePrice({
    rates: routed.rates,
    km: routed.km,
    distanceMethod: routed.method,
    coupon,
    baseService: draft.baseService,
    planchado: draft.planchado,
    garments,
    kg,
  });
  return {
    price,
    couponError: couponErrorMessage,
    estimatedKg: kg,
    laundry: { id: routed.shop.id, name: routed.shop.name, rates: routed.rates },
  };
}

export async function createOrder(user: User, draft: OrderDraft) {
  if (user.role !== "cliente") throw new AppError("Solo un cliente puede pedir una recolección.", 403);
  const garments = assertDraft(draft);
  const routed = await distanceToLaundry(draft.lat, draft.lng);
  const kg = estimateKg(garments);
  const customerPhoto = draft.customerPhoto ? keepPhoto(draft.customerPhoto, "La foto") : null;
  const order = commit((db) => {
    let coupon: AppliedCoupon | null = null;
    if (draft.couponCode && draft.couponCode.trim()) {
      const code = normalizeCode(draft.couponCode);
      const found = db.coupons.find((item) => item.code === code);
      const error = couponError(found);
      if (error || !found) throw new AppError(error ?? "No encontramos ese cupón.");
      found.usedCount += 1;
      coupon = {
        code: found.code,
        type: found.type,
        value: found.value,
        description: found.description,
      };
    }
    db.seq += 1;
    const created: Order = {
      id: newId("ord"),
      code: `LY-${db.seq}`,
      customerId: user.id,
      customerName: user.name,
      customerPhone: user.phone,
      courierId: null,
      courierName: null,
      status: "solicitado",
      address: clean(draft.address, 160),
      reference: clean(draft.reference ?? "", 120),
      lat: draft.lat,
      lng: draft.lng,
      notes: clean(draft.notes ?? "", 400),
      customerPhoto,
      garments,
      baseService: draft.baseService,
      planchado: Boolean(draft.planchado),
      scheduledFor: draft.scheduledFor,
      estimatedKg: kg,
      actualKg: null,
      receivedGarments: null,
      laundryPhotos: [],
      pricing: {
        rates: structuredClone(routed.rates),
        km: routed.km,
        distanceMethod: routed.method,
        coupon,
      },
      estimate: computePrice({
        rates: routed.rates,
        km: routed.km,
        distanceMethod: routed.method,
        coupon,
        baseService: draft.baseService,
        planchado: Boolean(draft.planchado),
        garments,
        kg,
      }),
      finalPrice: null,
      customerAccepted: false,
      courierLat: null,
      courierLng: null,
      route: [],
      routeProgress: 0,
      laundryId: routed.shop.id,
      laundryName: routed.shop.name,
      paymentMethod: null,
      paymentStatus: "pendiente" as PaymentStatus,
      preferenceId: null,
      paymentId: null,
      locationMode: "simulado" as const,
      etaMinutes: null,
      rating: null,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusLog: [{ status: "solicitado", at: new Date().toISOString() }],
    };
    db.orders.unshift(created);
    notifyCustomer(db, created);
    const shop = laundryOf(db, created.laundryId);
    const owner = db.users.find((item) => item.id === shop?.ownerId);
    if (owner) {
      notify(db, owner.id, {
        orderId: created.id,
        title: "Nuevo pedido para tu taller",
        body: `${created.customerName} pidió recolección. ${created.code}.`,
      });
    }
    for (const courier of db.users.filter((item) => item.role === "recolector" && item.status === "activo")) {
      const away = haversineKm(courier, { lat: created.lat, lng: created.lng });
      if (away > NEARBY_KM) continue;
      notify(db, courier.id, {
        orderId: created.id,
        title: "Nueva recolección",
        body: created.scheduledFor
          ? `${created.customerName} programó una recolección.`
          : `${created.customerName} pide recoger ropa ahora.`,
      });
    }
    return structuredClone(created);
  });
  emit({ type: "changed" });
  return order;
}

export async function acceptJob(user: User, orderId: string) {
  if (user.role !== "recolector") throw new AppError("Solo un recolector puede tomar el viaje.", 403);
  if (user.status !== "activo") throw new AppError("Tu cuenta de recolector todavía no está aprobada.", 403);
  const snapshot = readDb();
  const current = snapshot.orders.find((item) => item.id === orderId);
  if (!current) throw new AppError("No encontramos ese pedido.", 404);
  if (current.status !== "solicitado" || current.courierId) {
    throw new AppError("Otro recolector ya tomó este viaje.");
  }
  const courier = snapshot.users.find((item) => item.id === user.id)!;
  if (haversineKm(courier, { lat: current.lat, lng: current.lng }) > NEARBY_KM) {
    throw new AppError("Este viaje queda lejos de donde estás ahora.");
  }
  const routed = await routeBetween(
    { lat: courier.lat, lng: courier.lng },
    { lat: current.lat, lng: current.lng },
  );
  const order = commit((db) => {
    const target = findOrder(db, orderId);
    if (target.status !== "solicitado" || target.courierId) {
      throw new AppError("Otro recolector ya tomó este viaje.");
    }
    target.courierId = user.id;
    target.courierName = user.name;
    setStatus(target, "recolector_asignado");
    setStatus(target, "en_camino");
    target.route = routed.route;
    target.routeProgress = 0;
    target.courierLat = routed.route[0]?.[0] ?? courier.lat;
    target.courierLng = routed.route[0]?.[1] ?? courier.lng;
    target.locationMode = courier.courier?.liveGps ? "gps" : "simulado";
    target.etaMinutes = etaBetween(
      { lat: target.courierLat ?? courier.lat, lng: target.courierLng ?? courier.lng },
      { lat: target.lat, lng: target.lng },
    );
    notifyCustomer(db, target);
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

export async function pickupJob(user: User, orderId: string) {
  const snapshot = readDb();
  const current = findOrder(snapshot, orderId);
  assertCourier(user, current);
  if (current.status !== "en_camino") throw new AppError("Este viaje no está en camino a la casa.");
  const laundry = shopPoint(snapshot, current);
  const routed = await routeBetween({ lat: current.lat, lng: current.lng }, laundry);
  const order = commit((db) => {
    const target = findOrder(db, orderId);
    assertCourier(user, target);
    setStatus(target, "recogido");
    target.route = routed.route;
    target.routeProgress = 0;
    target.courierLat = routed.route[0]?.[0] ?? current.lat;
    target.courierLng = routed.route[0]?.[1] ?? current.lng;
    notifyCustomer(db, target);
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

export async function dropoffJob(user: User, orderId: string) {
  const snapshot = readDb();
  const current = findOrder(snapshot, orderId);
  assertCourier(user, current);
  if (current.status !== "recogido") throw new AppError("Primero marca que ya recogiste la ropa.");
  const order = commit((db) => {
    const target = findOrder(db, orderId);
    assertCourier(user, target);
    setStatus(target, "en_lavanderia");
    target.route = [];
    target.routeProgress = 1;
    const shop = shopPoint(db, target);
    target.courierLat = shop.lat;
    target.courierLng = shop.lng;
    target.etaMinutes = 1;
    notifyCustomer(db, target);
    notifyLaundryArrival(db, target);
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

export async function startDelivery(user: User, orderId: string) {
  const snapshot = readDb();
  const current = findOrder(snapshot, orderId);
  assertCourier(user, current);
  if (current.status !== "listo") throw new AppError("La lavandería todavía no marca la ropa como lista.");
  const routed = await routeBetween(shopPoint(snapshot, current), { lat: current.lat, lng: current.lng });
  const order = commit((db) => {
    const target = findOrder(db, orderId);
    assertCourier(user, target);
    setStatus(target, "en_entrega");
    target.route = routed.route;
    target.routeProgress = 0;
    const shop = shopPoint(db, target);
    target.courierLat = routed.route[0]?.[0] ?? shop.lat;
    target.courierLng = routed.route[0]?.[1] ?? shop.lng;
    target.etaMinutes = etaBetween(
      { lat: target.courierLat, lng: target.courierLng },
      { lat: target.lat, lng: target.lng },
    );
    notifyCustomer(db, target);
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

export function deliverJob(user: User, orderId: string) {
  const order = commit((db) => {
    const target = findOrder(db, orderId);
    assertCourier(user, target);
    if (target.status !== "en_entrega") throw new AppError("La entrega todavía no va en camino.");
    setStatus(target, "entregado");
    target.route = [];
    target.routeProgress = 1;
    target.courierLat = target.lat;
    target.courierLng = target.lng;
    notifyCustomer(db, target);
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

export function cancelOrder(user: User, orderId: string) {
  const order = commit((db) => {
    const target = findOrder(db, orderId);
    if (user.role !== "cliente" || target.customerId !== user.id) {
      throw new AppError("Solo quien pidió la recolección puede cancelarla.", 403);
    }
    if (target.pricing.coupon) {
      const coupon = db.coupons.find((item) => item.code === target.pricing.coupon?.code);
      if (coupon && coupon.usedCount > 0) coupon.usedCount -= 1;
    }
    setStatus(target, "cancelado");
    notifyCustomer(db, target);
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

export function acceptPrice(user: User, orderId: string) {
  const order = commit((db) => {
    const target = findOrder(db, orderId);
    if (user.role !== "cliente" || target.customerId !== user.id) {
      throw new AppError("Solo el cliente puede aceptar el total.", 403);
    }
    if (target.status !== "pesado" || !target.finalPrice) {
      throw new AppError("El taller todavía no registra lo que llegó.");
    }
    if (target.customerAccepted) throw new AppError("Este total ya estaba aceptado.");
    target.customerAccepted = true;
    target.updatedAt = new Date().toISOString();
    const laundry = laundryUser(db, target);
    if (laundry) {
      notify(db, laundry.id, {
        orderId: target.id,
        title: "El cliente aceptó el total",
        body: `${target.customerName} aceptó ${target.code}. Ya puedes empezar el lavado.`,
        important: true,
      });
    }
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

export function intakeOrder(
  user: User,
  orderId: string,
  input: { kg: number; garments: GarmentCount[]; photos: string[] },
) {
  if (user.role !== "lavanderia") throw new AppError("Solo la lavandería puede registrar la ropa.", 403);
  if (user.status !== "activo") throw new AppError("Tu taller todavía no está aprobado.", 403);
  const kg = Math.round(Number(input.kg) * 10) / 10;
  if (!Number.isFinite(kg) || kg < 0.2 || kg > 80) {
    throw new AppError("Escribe un peso entre 0.2 y 80 kg.");
  }
  const garments = normalizeGarments(input.garments);
  if (!garments.length) throw new AppError("Cuenta al menos una prenda que sí llegó.");
  const photos = (input.photos ?? [])
    .slice(0, 4)
    .map((photo, index) => keepPhoto(photo, `La foto ${index + 1}`));

  const order = commit((db) => {
    const target = findOrder(db, orderId);
    if (user.laundryId && target.laundryId !== user.laundryId) {
      throw new AppError("Este pedido es de otro taller.", 403);
    }
    const canEdit =
      target.status === "en_lavanderia" || (target.status === "pesado" && !target.customerAccepted);
    if (!canEdit) throw new AppError("Este pedido ya no se puede pesar.");
    target.actualKg = kg;
    target.receivedGarments = garments;
    target.laundryPhotos = photos;
    target.finalPrice = priceFrom(target, kg, garments);
    target.customerAccepted = false;
    if (target.status === "en_lavanderia") setStatus(target, "pesado");
    else target.updatedAt = new Date().toISOString();
    notifyCustomer(db, target);
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

export function advanceOrder(user: User, orderId: string, to: "lavando" | "listo") {
  if (user.role !== "lavanderia") throw new AppError("Solo la lavandería puede avanzar el lavado.", 403);
  if (user.status !== "activo") throw new AppError("Tu taller todavía no está aprobado.", 403);
  const order = commit((db) => {
    const target = findOrder(db, orderId);
    if (user.laundryId && target.laundryId !== user.laundryId) {
      throw new AppError("Este pedido es de otro taller.", 403);
    }
    if (to === "lavando" && !target.customerAccepted) {
      throw new AppError("Espera a que el cliente acepte la cantidad y el total.");
    }
    setStatus(target, to);
    notifyCustomer(db, target);
    if (to === "listo" && target.courierId) {
      notify(db, target.courierId, {
        orderId: target.id,
        title: "Ropa lista para entrega",
        body: `${target.code} de ${target.customerName} ya se puede llevar.`,
        important: true,
      });
    }
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

export function rateOrder(user: User, orderId: string, stars: number, comment: string) {
  if (user.role !== "cliente") throw new AppError("Solo el cliente califica al recolector.", 403);
  const score = Math.round(Number(stars));
  if (score < 1 || score > 5) throw new AppError("Elige de 1 a 5 estrellas.");
  const order = commit((db) => {
    const target = findOrder(db, orderId);
    if (target.customerId !== user.id) throw new AppError("Este pedido no es tuyo.", 403);
    if (target.status !== "entregado") throw new AppError("Puedes calificar cuando la ropa ya se entregó.");
    if (target.rating) throw new AppError("Este viaje ya tiene calificación.");
    target.rating = {
      stars: score,
      comment: clean(comment ?? "", 280),
      createdAt: new Date().toISOString(),
    };
    target.updatedAt = target.rating.createdAt;
    const courier = db.users.find((item) => item.id === target.courierId);
    if (courier) {
      const total = courier.ratingAvg * courier.ratingCount + score;
      courier.ratingCount += 1;
      courier.ratingAvg = Math.round((total / courier.ratingCount) * 10) / 10;
    }
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

export function sendChat(user: User, orderId: string, text: string) {
  const message = clean(text ?? "", 500);
  if (!message) throw new AppError("Escribe un mensaje.");
  const order = commit((db) => {
    const target = findOrder(db, orderId);
    const role = chatRole(user, target);
    if (target.status === "cancelado" || target.status === "entregado") {
      throw new AppError("Este chat ya se cerró.");
    }
    if (!target.courierId) throw new AppError("El chat se abre cuando un recolector toma el viaje.");
    const entry = {
      id: newId("msg"),
      senderId: user.id,
      senderRole: role,
      senderName: user.name,
      text: message,
      createdAt: new Date().toISOString(),
      readBy: [user.id],
    };
    target.messages.push(entry);
    if (target.messages.length > 200) target.messages.splice(0, target.messages.length - 200);
    target.updatedAt = entry.createdAt;
    const recipient = role === "cliente" ? target.courierId : target.customerId;
    if (recipient) {
      notify(db, recipient, {
        orderId: target.id,
        title: `Mensaje de ${user.name}`,
        body: message,
      });
    }
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

export function markChatRead(user: User, orderId: string) {
  const order = commit((db) => {
    const target = findOrder(db, orderId);
    chatRole(user, target);
    for (const message of target.messages) {
      if (!message.readBy.includes(user.id)) message.readBy.push(user.id);
    }
    return structuredClone(target);
  });
  emit({ type: "changed" });
  return order;
}

function chatRole(user: User, order: Order): "cliente" | "recolector" {
  if (user.role === "cliente" && order.customerId === user.id) return "cliente";
  if (user.role === "recolector" && order.courierId === user.id) return "recolector";
  throw new AppError("No participas en este chat.", 403);
}

function assertCourier(user: User, order: Order) {
  if (user.role !== "recolector" || order.courierId !== user.id) {
    throw new AppError("Este viaje lo tiene otro recolector.", 403);
  }
}

export function saveRates(user: User, rates: Rates) {
  if (user.role !== "lavanderia") throw new AppError("Solo la lavandería cambia las tarifas.", 403);
  if (user.status !== "activo") throw new AppError("Tu taller todavía no está aprobado.", 403);
  const next = sanitizeRates(rates);
  commit((db) => {
    const shop = db.laundries.find((item) => item.id === user.laundryId || item.ownerId === user.id);
    if (shop) shop.rates = structuredClone(next);
    const active = db.laundries.filter((item) => item.status === "activo");
    if (!shop || active.length <= 1) db.rates = next;
  });
  emit({ type: "changed" });
  return next;
}

export function sanitizeRates(input: Rates): Rates {
  const number = (value: number, label: string, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
      throw new AppError(`${label} tiene que ser un número entre 0 y ${max}.`);
    }
    return Math.round(parsed * 100) / 100;
  };
  const itemRates: Record<string, number> = {};
  for (const [key, value] of Object.entries(input.itemRates ?? {})) {
    if (!garmentById(key)) continue;
    itemRates[key] = number(value, `El extra de ${key}`, 500);
  }
  return {
    lavadoNormalPerKg: number(input.lavadoNormalPerKg, "El lavado normal", 500),
    lavadoEnSecoPerKg: number(input.lavadoEnSecoPerKg, "El lavado en seco", 800),
    planchadoPerKg: number(input.planchadoPerKg, "El planchado", 500),
    recoleccionPerKm: number(input.recoleccionPerKm, "La recolección por km", 100),
    entregaPerKm: number(input.entregaPerKm, "La entrega por km", 100),
    itemRates,
  };
}

export function saveCoupon(user: User, input: Omit<Coupon, "usedCount"> & { usedCount?: number }) {
  if (user.role !== "lavanderia") throw new AppError("Solo la lavandería crea cupones.", 403);
  const code = normalizeCode(input.code ?? "");
  if (!/^[A-Z0-9]{3,16}$/.test(code)) {
    throw new AppError("El código usa de 3 a 16 letras o números, sin espacios.");
  }
  if (input.type !== "percent" && input.type !== "fixed") throw new AppError("Elige porcentaje o pesos.");
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) throw new AppError("El descuento tiene que ser mayor a cero.");
  if (input.type === "percent" && value > 100) throw new AppError("El porcentaje no puede pasar de 100.");
  let usageLimit: number | null = null;
  if (input.usageLimit != null && String(input.usageLimit) !== "") {
    usageLimit = Math.round(Number(input.usageLimit));
    if (!Number.isFinite(usageLimit) || usageLimit < 1) {
      throw new AppError("El límite de usos tiene que ser al menos 1, o vacío si no hay límite.");
    }
  }
  let expiresAt: string | null = null;
  if (input.expiresAt) {
    const when = new Date(input.expiresAt);
    if (Number.isNaN(when.getTime())) throw new AppError("Esa fecha de vencimiento no es válida.");
    expiresAt = when.toISOString();
  }
  const description = clean(input.description || "Promoción LavaYa", 120);
  const coupon = commit((db) => {
    const existing = db.coupons.find((item) => item.code === code);
    if (existing) {
      existing.description = description;
      existing.type = input.type;
      existing.value = Math.round(value * 100) / 100;
      existing.expiresAt = expiresAt;
      existing.usageLimit = usageLimit;
      existing.active = input.active !== false;
      return structuredClone(existing);
    }
    const created: Coupon = {
      code,
      description,
      type: input.type,
      value: Math.round(value * 100) / 100,
      expiresAt,
      usageLimit,
      usedCount: 0,
      active: input.active !== false,
    };
    db.coupons.unshift(created);
    return created;
  });
  emit({ type: "changed" });
  return coupon;
}

export function setCouponActive(user: User, code: string, active: boolean) {
  if (user.role !== "lavanderia") throw new AppError("Solo la lavandería cambia cupones.", 403);
  const coupon = commit((db) => {
    const found = db.coupons.find((item) => item.code === normalizeCode(code));
    if (!found) throw new AppError("No encontramos ese cupón.", 404);
    found.active = active;
    return structuredClone(found);
  });
  emit({ type: "changed" });
  return coupon;
}

export function saveBanner(
  user: User,
  input: { id?: string; title: string; body: string; code?: string | null; active?: boolean },
) {
  if (user.role !== "lavanderia") throw new AppError("Solo la lavandería publica promociones.", 403);
  const title = clean(input.title ?? "", 60);
  const body = clean(input.body ?? "", 160);
  if (title.length < 3 || body.length < 3) throw new AppError("Escribe un título y un texto para el anuncio.");
  const banner = commit((db) => {
    const next: Banner = {
      id: input.id || newId("ban"),
      title,
      body,
      code: input.code ? normalizeCode(input.code) : null,
      active: input.active !== false,
    };
    const index = db.banners.findIndex((item) => item.id === next.id);
    if (index >= 0) db.banners[index] = next;
    else db.banners.unshift(next);
    return next;
  });
  emit({ type: "changed" });
  return banner;
}

export function deleteBanner(user: User, id: string) {
  if (user.role !== "lavanderia") throw new AppError("Solo la lavandería quita anuncios.", 403);
  commit((db) => {
    db.banners = db.banners.filter((item) => item.id !== id);
  });
  emit({ type: "changed" });
}

export function markNotificationsRead(user: User, ids: string[] | "all") {
  commit((db) => {
    for (const note of db.notifications) {
      if (note.userId !== user.id) continue;
      if (ids === "all" || ids.includes(note.id)) note.read = true;
    }
  });
  emit({ type: "changed" });
}

export function visibleOrders(user: User, orders: Order[]) {
  if (user.role === "cliente") return orders.filter((order) => order.customerId === user.id);
  if (user.role === "lavanderia") return orders.filter((order) => order.laundryId === user.laundryId);
  if (user.role === "admin") return orders;
  if (user.role !== "recolector" || user.status !== "activo") return [];
  return orders.filter((order) => {
    if (order.courierId === user.id) return true;
    if (order.status !== "solicitado" || order.courierId) return false;
    return haversineKm(user, { lat: order.lat, lng: order.lng }) <= NEARBY_KM;
  });
}

function shopPoint(db: ReturnType<typeof readDb>, order: Order) {
  return laundryOf(db, order.laundryId) ?? db.laundry;
}

function etaBetween(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const km = haversineKm(from, to) * ROAD_FACTOR;
  return Math.max(1, Math.round((km / 22) * 60));
}

const MOVING: Order["status"][] = ["en_camino", "recogido", "en_entrega"];

export function reportCourierLocation(user: User, input: { lat?: number; lng?: number; denied?: boolean }) {
  if (user.role !== "recolector") throw new AppError("Solo el recolector comparte su ubicación.", 403);
  if (user.status !== "activo") throw new AppError("Tu cuenta todavía no está aprobada.", 403);
  if (input.denied) {
    commit((db) => {
      const courier = db.users.find((item) => item.id === user.id);
      if (courier?.courier) courier.courier.liveGps = false;
      for (const order of db.orders) {
        if (order.courierId === user.id && MOVING.includes(order.status)) order.locationMode = "simulado";
      }
    });
    emit({ type: "changed" });
    return { liveGps: false as const };
  }
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new AppError("Esa ubicación no es válida.");
  }
  const positions: Array<{
    id: string;
    lat: number;
    lng: number;
    progress: number;
    etaMinutes: number | null;
    locationMode: "gps";
  }> = [];
  commit((db) => {
    const courier = db.users.find((item) => item.id === user.id);
    if (!courier) return;
    courier.lat = lat;
    courier.lng = lng;
    if (courier.courier) courier.courier.liveGps = true;
    for (const order of db.orders) {
      if (order.courierId !== user.id || !MOVING.includes(order.status)) continue;
      order.locationMode = "gps";
      order.courierLat = lat;
      order.courierLng = lng;
      const shop = shopPoint(db, order);
      const target = order.status === "recogido" ? shop : { lat: order.lat, lng: order.lng };
      order.etaMinutes = etaBetween({ lat, lng }, target);
      order.updatedAt = new Date().toISOString();
      positions.push({
        id: order.id,
        lat,
        lng,
        progress: order.routeProgress,
        etaMinutes: order.etaMinutes,
        locationMode: "gps",
      });
    }
  });
  if (positions.length) emit({ type: "positions", positions });
  return { liveGps: true as const };
}
