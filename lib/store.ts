import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { DEFAULT_RATES, LAUNDRY } from "./catalog";
import { haversineKm, pointAlong, ROAD_FACTOR } from "./geo";
import { computePrice } from "./pricing";
import type { AccountStatus, CourierProfile, DB, LaundryBusiness, Order, OrderStatus, User } from "./types";

const SCHEMA_VERSION = 2;
const DEMO_LAUNDRY_ID = "ldy_doctores";

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
      positions: Array<{
        id: string;
        lat: number;
        lng: number;
        progress: number;
        etaMinutes?: number | null;
        locationMode?: "gps" | "simulado";
      }>;
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
    status: "activo" as const,
    laundryId: null,
    courier: { plate: "MX-4821-A", idPhoto: null, available: true, liveGps: false },
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

  const delivered = {
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
  const openOrder = {
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
  const atLaundry = {
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

  return finalizeSeed({
    schemaVersion: SCHEMA_VERSION,
    seq: 2403,
    users: [ana, carlos, luis, rosa] as User[],
    orders: [atLaundry, openOrder, delivered] as unknown as Order[],
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
    laundries: [],
  });
}

function finalizeSeed(input: {
  schemaVersion: number;
  seq: number;
  users: User[];
  orders: Order[];
  rates: DB["rates"];
  coupons: DB["coupons"];
  banners: DB["banners"];
  notifications: DB["notifications"];
  laundry: DB["laundry"];
  laundries: LaundryBusiness[];
}): DB {
  const admin: User = {
    id: "usr_admin",
    role: "admin",
    name: "Administración LavaYa",
    email: "admin@lavaya.mx",
    password: "lavaya123",
    phone: "55 0000 0000",
    ratingAvg: 0,
    ratingCount: 0,
    lat: LAUNDRY.lat,
    lng: LAUNDRY.lng,
    status: "activo",
    laundryId: null,
    courier: null,
  };
  const users = input.users.some((user) => user.email === admin.email) ? input.users : [...input.users, admin];
  return normalizeDb({ ...input, users });
}

export function normalizeDb(input: DB): DB {
  const laundryPlace = input.laundry ?? LAUNDRY;
  const laundries: LaundryBusiness[] = (input.laundries ?? []).map((shop) => ({
    ...shop,
    hours: shop.hours || "Lun a sáb · 8:00 a 20:00",
    rates: shop.rates ?? null,
    status: shop.status ?? "activo",
  }));
  if (!laundries.some((shop) => shop.id === DEMO_LAUNDRY_ID)) {
    const rosa = input.users.find((user) => user.role === "lavanderia");
    laundries.unshift({
      id: DEMO_LAUNDRY_ID,
      ownerId: rosa?.id ?? "usr_rosa",
      name: laundryPlace.name,
      address: laundryPlace.address,
      lat: laundryPlace.lat,
      lng: laundryPlace.lng,
      phone: laundryPlace.phone,
      hours: "Lun a sáb · 8:00 a 20:00",
      rates: null,
      status: "activo",
    });
  }
  const users: User[] = input.users.map((user) => {
    const status: AccountStatus = user.status ?? "activo";
    let laundryId = user.laundryId ?? null;
    let courier: CourierProfile | null = user.courier ?? null;
    if (user.role === "lavanderia" && !laundryId) {
      laundryId = laundries.find((shop) => shop.ownerId === user.id)?.id ?? DEMO_LAUNDRY_ID;
    }
    if (user.role === "recolector" && !courier) {
      courier = { plate: "DEMO-00", idPhoto: null, available: true, liveGps: false };
    }
    if (user.role !== "recolector") courier = courier;
    return { ...user, status, laundryId, courier: user.role === "recolector" ? courier : null };
  });
  const primary = laundries.find((shop) => shop.status === "activo") ?? laundries[0];
  const orders: Order[] = input.orders.map((order) => {
    const shop = laundries.find((item) => item.id === order.laundryId) ?? primary;
    const done = order.status === "entregado";
    return {
      ...order,
      laundryId: order.laundryId || shop.id,
      laundryName: order.laundryName || shop.name,
      paymentMethod: order.paymentMethod ?? (done ? "efectivo" : null),
      paymentStatus: order.paymentStatus ?? (done ? "efectivo" : "pendiente"),
      preferenceId: order.preferenceId ?? null,
      paymentId: order.paymentId ?? null,
      locationMode: order.locationMode ?? "simulado",
      etaMinutes: order.etaMinutes ?? null,
    };
  });
  return {
    ...input,
    schemaVersion: SCHEMA_VERSION,
    users,
    orders,
    laundries,
    laundry: {
      name: primary.name,
      address: primary.address,
      lat: primary.lat,
      lng: primary.lng,
      phone: primary.phone,
    },
  };
}

type PgPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null; rows: Array<{ doc: DB }> }>;
};

const globalState = globalThis as typeof globalThis & {
  __lavayaMemory?: DB;
  __lavayaReady?: Promise<void>;
  __lavayaPersist?: Promise<void>;
  __lavayaPool?: PgPool;
};

function memory(): DB {
  if (!globalState.__lavayaMemory) {
    if (databaseUrl()) {
      throw new Error("La base todavía no está lista.");
    }
    globalState.__lavayaMemory = readJsonFile();
  }
  return globalState.__lavayaMemory;
}

function readJsonFile(): DB {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.mkdirSync(uploadsDir(), { recursive: true });
  const file = dbFile();
  if (!fs.existsSync(file)) {
    const seeded = buildSeed();
    fs.writeFileSync(file, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return normalizeDb(JSON.parse(fs.readFileSync(file, "utf8")) as DB);
  } catch {
    const seeded = buildSeed();
    fs.writeFileSync(file, JSON.stringify(seeded));
    return seeded;
  }
}

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  return value || "";
}

async function pgPool() {
  if (globalState.__lavayaPool) return globalState.__lavayaPool;
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl(), max: 3 });
  globalState.__lavayaPool = pool as unknown as PgPool;
  return globalState.__lavayaPool;
}

/** Crea la tabla si hace falta y carga el documento. Sin DATABASE_URL usa el JSON. */
export function initDb() {
  if (!globalState.__lavayaReady) {
    globalState.__lavayaReady = (async () => {
      if (!databaseUrl()) {
        globalState.__lavayaMemory = readJsonFile();
        return;
      }
      const pool = await pgPool();
      await pool.query(`CREATE TABLE IF NOT EXISTS lavaya_state (
        id text PRIMARY KEY,
        doc jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      const found = await pool.query("SELECT doc FROM lavaya_state WHERE id = $1", ["main"]);
      if (found.rowCount && found.rows[0]) {
        globalState.__lavayaMemory = normalizeDb(found.rows[0].doc);
        return;
      }
      const seeded = buildSeed();
      globalState.__lavayaMemory = seeded;
      await pool.query(
        "INSERT INTO lavaya_state (id, doc) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
        ["main", JSON.stringify(seeded)],
      );
    })();
  }
  return globalState.__lavayaReady;
}

function schedulePersist(snapshot: DB) {
  if (!databaseUrl()) {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.mkdirSync(uploadsDir(), { recursive: true });
    fs.writeFileSync(dbFile(), JSON.stringify(snapshot));
    return;
  }
  const chain = globalState.__lavayaPersist ?? Promise.resolve();
  globalState.__lavayaPersist = chain
    .then(async () => {
      const pool = await pgPool();
      await pool.query(
        `INSERT INTO lavaya_state (id, doc, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
        ["main", JSON.stringify(snapshot)],
      );
    })
    .catch((error) => {
      console.error("lavaya persist", error);
    });
}

export function readDb(): DB {
  return memory();
}

export function writeDb(db: DB) {
  globalState.__lavayaMemory = db;
  schedulePersist(structuredClone(db));
}

/** Espera a que el último guardado en Postgres termine. En archivo ya es síncrono. */
export async function flushDb() {
  if (globalState.__lavayaPersist) await globalState.__lavayaPersist;
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
  if (order.locationMode === "gps") return false;
  return order.route.length > 1 && (order.status === "en_camino" || order.status === "recogido" || order.status === "en_entrega");
}

function tick() {
  if (!globalState.__lavayaMemory) return;
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
  if (!globalState.__lavayaMemory && !databaseUrl()) memory();
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
