import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { DEFAULT_RATES, LAUNDRY } from "./catalog";
import { haversineKm, pointAlong, ROAD_FACTOR } from "./geo";
import { computePrice } from "./pricing";
import type { DB, Order, OrderStatus } from "./types";

const SCHEMA_VERSION = 1;

/** Directorio escribible. En Spaces es /home/user/data (uid 1000). */
export function dataDir() {
  return process.env.LAVAYA_DATA_DIR || path.join(process.cwd(), "data");
}

export function uploadsDir() {
  return path.join(dataDir(), "uploads");
}

function dbFile() {
  return path.join(dataDir(), "db.json");
}

export type BusEvent =
  | { type: "changed" }
  | {
      type: "positions";
      positions: Array<{ id: string; lat: number; lng: number; progress: number }>;
    };

type Bus = EventEmitter;

const globalBus = globalThis as typeof globalThis & {
  __lavayaBus?: Bus;
  __lavayaTimer?: NodeJS.Timeout;
};

function bus() {
  if (!globalBus.__lavayaBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    globalBus.__lavayaBus = emitter;
  }
  return globalBus.__lavayaBus;
}

export function subscribe(listener: (event: BusEvent) => void) {
  bus().on("event", listener);
  return () => bus().off("event", listener);
}

export function emit(event: BusEvent) {
  bus().emit("event", event);
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function isoDaysFromNow(days: number, hour: number, minute: number) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, hour + 6, minute, 0)).toISOString();
}

export function buildSeed(): DB {
  const now = Date.now();
  const ana = {
    id: "usr_ana",
    role: "cliente" as const,
    name: "Ana García",
    email: "ana@lavaya.mx",
    password: "lavaya123",
    phone: "55 1234 5601",
    ratingAvg: 0,
    ratingCount: 0,
    lat: 19.4187,
    lng: -99.1622,
  };
  const carlos = {
    id: "usr_carlos",
    role: "cliente" as const,
    name: "Carlos Ruiz",
    email: "carlos@lavaya.mx",
    password: "lavaya123",
    phone: "55 1234 5604",
    ratingAvg: 0,
    ratingCount: 0,
    lat: 19.4102,
    lng: -99.1715,
  };
  const luis = {
    id: "usr_luis",
    role: "recolector" as const,
    name: "Luis Hernández",
    email: "luis@lavaya.mx",
    password: "lavaya123",
    phone: "55 1234 5602",
    ratingAvg: 4.8,
    ratingCount: 26,
    lat: 19.4128,
    lng: -99.1688,
  };
  const rosa = {
    id: "usr_rosa",
    role: "lavanderia" as const,
    name: "Rosa Méndez",
    email: "rosa@lavaya.mx",
    password: "lavaya123",
    phone: "55 1234 5603",
    ratingAvg: 0,
    ratingCount: 0,
    lat: LAUNDRY.lat,
    lng: LAUNDRY.lng,
  };

  const rates = structuredClone(DEFAULT_RATES);
  const historyKm = haversineKm(ana, LAUNDRY) * ROAD_FACTOR;
  const historyPricing = {
    rates: structuredClone(rates),
    km: historyKm,
    distanceMethod: "haversine" as const,
    coupon: null,
  };
  const historyGarments = [
    { type: "camisa", count: 3 },
    { type: "pantalon", count: 2 },
  ];
  const historyEstimate = computePrice({
    ...historyPricing,
    kg: 1.8,
    baseService: "lavado_normal",
    planchado: true,
    garments: historyGarments,
    coupon: null,
  });
  const historyFinal = computePrice({
    ...historyPricing,
    kg: 2.1,
    baseService: "lavado_normal",
    planchado: true,
    garments: historyGarments,
    coupon: null,
  });

  const delivered: Order = {
    id: "ord_hist_ana",
    code: "LY-2401",
    customerId: ana.id,
    customerName: ana.name,
    customerPhone: ana.phone,
    courierId: luis.id,
    courierName: luis.name,
    status: "entregado",
    address: "Orizaba 89, Roma Norte, CDMX",
    reference: "Departamento 4, timbre García",
    lat: ana.lat,
    lng: ana.lng,
    notes: "Camisas de trabajo. Cuidado con los cuellos.",
    customerPhoto: null,
    garments: historyGarments,
    baseService: "lavado_normal",
    planchado: true,
    scheduledFor: null,
    estimatedKg: 1.8,
    actualKg: 2.1,
    receivedGarments: historyGarments,
    laundryPhotos: [],
    pricing: historyPricing,
    estimate: historyEstimate,
    finalPrice: historyFinal,
    customerAccepted: true,
    courierLat: ana.lat,
    courierLng: ana.lng,
    route: [],
    routeProgress: 1,
    rating: {
      stars: 5,
      comment: "Llegó rápido y con la ropa bien doblada.",
      createdAt: new Date(now - 1000 * 60 * 60 * 20).toISOString(),
    },
    messages: [
      {
        id: "msg_hist_1",
        senderId: ana.id,
        senderRole: "cliente",
        senderName: ana.name,
        text: "Estoy en el departamento 4.",
        createdAt: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
        readBy: [ana.id, luis.id],
      },
      {
        id: "msg_hist_2",
        senderId: luis.id,
        senderRole: "recolector",
        senderName: luis.name,
        text: "Ya voy subiendo.",
        createdAt: new Date(now - 1000 * 60 * 60 * 26 + 60000).toISOString(),
        readBy: [ana.id, luis.id],
      },
    ],
    createdAt: new Date(now - 1000 * 60 * 60 * 30).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 60 * 20).toISOString(),
    statusLog: (["solicitado", "recolector_asignado", "en_camino", "recogido", "en_lavanderia", "pesado", "lavando", "listo", "en_entrega", "entregado"] as OrderStatus[]).map(
      (status, index) => ({
        status,
        at: new Date(now - 1000 * 60 * 60 * (30 - index)).toISOString(),
      }),
    ),
  };

  const carlosKm = haversineKm(carlos, LAUNDRY) * ROAD_FACTOR;
  const carlosGarments = [
    { type: "playera", count: 6 },
    { type: "pantalon", count: 2 },
    { type: "toalla", count: 1 },
  ];
  const carlosPricing = {
    rates: structuredClone(rates),
    km: carlosKm,
    distanceMethod: "haversine" as const,
    coupon: {
      code: "LAVAYA20",
      type: "percent" as const,
      value: 20,
      description: "20% de bienvenida",
    },
  };
  const openOrder: Order = {
    id: "ord_carlos_open",
    code: "LY-2402",
    customerId: carlos.id,
    customerName: carlos.name,
    customerPhone: carlos.phone,
    courierId: null,
    courierName: null,
    status: "solicitado",
    address: "Colima 180, Condesa, CDMX",
    reference: "Portón negro. Preguntar por Ramón.",
    lat: carlos.lat,
    lng: carlos.lng,
    notes: "Hay una toalla de playa grande.",
    customerPhoto: null,
    garments: carlosGarments,
    baseService: "lavado_normal",
    planchado: false,
    scheduledFor: isoDaysFromNow(1, 10, 0),
    estimatedKg: 2.6,
    actualKg: null,
    receivedGarments: null,
    laundryPhotos: [],
    pricing: carlosPricing,
    estimate: computePrice({
      ...carlosPricing,
      kg: 2.6,
      baseService: "lavado_normal",
      planchado: false,
      garments: carlosGarments,
    }),
    finalPrice: null,
    customerAccepted: false,
    courierLat: null,
    courierLng: null,
    route: [],
    routeProgress: 0,
    rating: null,
    messages: [],
    createdAt: new Date(now - 1000 * 60 * 25).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 25).toISOString(),
    statusLog: [{ status: "solicitado", at: new Date(now - 1000 * 60 * 25).toISOString() }],
  };

  const anaActiveGarments = [
    { type: "playera", count: 4 },
    { type: "camisa", count: 2 },
    { type: "interior", count: 5 },
  ];
  const anaKm = historyKm;
  const anaPricing = {
    rates: structuredClone(rates),
    km: anaKm,
    distanceMethod: "haversine" as const,
    coupon: null,
  };
  const atLaundry: Order = {
    id: "ord_ana_taller",
    code: "LY-2403",
    customerId: ana.id,
    customerName: ana.name,
    customerPhone: ana.phone,
    courierId: luis.id,
    courierName: luis.name,
    status: "en_lavanderia",
    address: "Orizaba 89, Roma Norte, CDMX",
    reference: "Departamento 4, timbre García",
    lat: ana.lat,
    lng: ana.lng,
    notes: "Sin suavizante, por favor.",
    customerPhoto: null,
    garments: anaActiveGarments,
    baseService: "lavado_normal",
    planchado: true,
    scheduledFor: null,
    estimatedKg: 1.7,
    actualKg: null,
    receivedGarments: null,
    laundryPhotos: [],
    pricing: anaPricing,
    estimate: computePrice({
      ...anaPricing,
      kg: 1.7,
      baseService: "lavado_normal",
      planchado: true,
      garments: anaActiveGarments,
    }),
    finalPrice: null,
    customerAccepted: false,
    courierLat: LAUNDRY.lat,
    courierLng: LAUNDRY.lng,
    route: [],
    routeProgress: 1,
    rating: null,
    messages: [
      {
        id: "msg_ana_1",
        senderId: luis.id,
        senderRole: "recolector",
        senderName: luis.name,
        text: "Ya dejé tu bolsa en el taller.",
        createdAt: new Date(now - 1000 * 60 * 12).toISOString(),
        readBy: [luis.id],
      },
    ],
    createdAt: new Date(now - 1000 * 60 * 50).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 12).toISOString(),
    statusLog: [
      { status: "solicitado", at: new Date(now - 1000 * 60 * 50).toISOString() },
      { status: "recolector_asignado", at: new Date(now - 1000 * 60 * 46).toISOString() },
      { status: "en_camino", at: new Date(now - 1000 * 60 * 45).toISOString() },
      { status: "recogido", at: new Date(now - 1000 * 60 * 28).toISOString() },
      { status: "en_lavanderia", at: new Date(now - 1000 * 60 * 12).toISOString() },
    ],
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    seq: 2403,
    users: [ana, carlos, luis, rosa],
    orders: [atLaundry, openOrder, delivered],
    rates,
    coupons: [
      {
        code: "LAVAYA20",
        description: "20% de bienvenida en tu recolección",
        type: "percent",
        value: 20,
        expiresAt: null,
        usageLimit: 100,
        usedCount: 1,
        active: true,
      },
      {
        code: "FIJO25",
        description: "$25 de descuento",
        type: "fixed",
        value: 25,
        expiresAt: isoDaysFromNow(45, 23, 59),
        usageLimit: 40,
        usedCount: 0,
        active: true,
      },
    ],
    banners: [
      {
        id: "ban_bienvenida",
        title: "Primera recolección con 20% off",
        body: "Usa LAVAYA20 al pedir. El descuento se ve en el desglose, antes de confirmar.",
        code: "LAVAYA20",
        active: true,
      },
    ],
    notifications: [
      {
        id: "nt_seed_ana",
        userId: ana.id,
        orderId: atLaundry.id,
        title: "En la lavandería",
        body: "Tu pedido LY-2403 ya está en el taller. En un momento verás el peso y el total.",
        createdAt: atLaundry.updatedAt,
        read: false,
        important: false,
      },
      {
        id: "nt_seed_rosa",
        userId: rosa.id,
        orderId: atLaundry.id,
        title: "Llegó ropa al taller",
        body: "LY-2403 de Ana García espera peso y conteo.",
        createdAt: atLaundry.updatedAt,
        read: false,
        important: true,
      },
      {
        id: "nt_seed_luis",
        userId: luis.id,
        orderId: openOrder.id,
        title: "Nueva recolección",
        body: "Carlos Ruiz programó una recolección en la Condesa.",
        createdAt: openOrder.createdAt,
        read: false,
        important: false,
      },
    ],
    laundry: LAUNDRY,
  };
}

function ensure() {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.mkdirSync(uploadsDir(), { recursive: true });
  const file = dbFile();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(buildSeed()));
    return;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as DB;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      fs.writeFileSync(file, JSON.stringify(buildSeed()));
    }
  } catch {
    fs.writeFileSync(file, JSON.stringify(buildSeed()));
  }
}

export function readDb(): DB {
  ensure();
  return JSON.parse(fs.readFileSync(dbFile(), "utf8")) as DB;
}

export function writeDb(db: DB) {
  ensure();
  fs.writeFileSync(dbFile(), JSON.stringify(db));
}

/** Lectura y escritura seguidas, sin awaits en medio. */
export function commit<T>(fn: (db: DB) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

export function resetDb() {
  const db = buildSeed();
  writeDb(db);
  emit({ type: "changed" });
  return db;
}

function moving(order: Order) {
  return order.route.length > 1 && (order.status === "en_camino" || order.status === "recogido" || order.status === "en_entrega");
}

function tick() {
  const db = readDb();
  const positions: Array<{ id: string; lat: number; lng: number; progress: number }> = [];
  for (const order of db.orders) {
    if (!moving(order)) continue;
    order.routeProgress = Math.min(1, order.routeProgress + 0.045);
    const [lat, lng] = pointAlong(order.route, order.routeProgress);
    order.courierLat = lat;
    order.courierLng = lng;
    order.updatedAt = new Date().toISOString();
    positions.push({ id: order.id, lat, lng, progress: order.routeProgress });
  }
  if (!positions.length) return;
  writeDb(db);
  emit({ type: "positions", positions });
}

export function startTicker() {
  if (globalBus.__lavayaTimer) return;
  ensure();
  globalBus.__lavayaTimer = setInterval(() => {
    try {
      tick();
    } catch (error) {
      console.error("lavaya tick", error);
    }
  }, 1200);
  globalBus.__lavayaTimer.unref?.();
}

export function newId(prefix: string) {
  return uid(prefix);
}

startTicker();
