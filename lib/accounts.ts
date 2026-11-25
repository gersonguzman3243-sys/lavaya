import { AppError } from "./errors";
import { persistPhoto } from "./media";
import { commit, emit, newId, readDb } from "./store";
import type { AccountStatus, Rates, Role, User } from "./types";

export interface RegisterInput {
  role: "cliente" | "recolector" | "lavanderia";
  name: string;
  email: string;
  password: string;
  phone: string;
  businessName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  hours?: string;
  rates?: Rates | null;
  plate?: string;
  idPhoto?: string | null;
}

function clean(value: string, max: number) {
  return value.replace(/[<>]/g, "").trim().slice(0, max);
}

function assertImage(dataUrl: string, label: string) {
  if (!dataUrl.startsWith("data:image/")) throw new AppError(`${label} tiene que ser una imagen.`);
  if (dataUrl.length > 450_000) throw new AppError(`${label} pesa demasiado. Prueba con una foto más pequeña.`);
}

export function registerAccount(input: RegisterInput) {
  const role = input.role;
  if (role !== "cliente" && role !== "recolector" && role !== "lavanderia") {
    throw new AppError("Elige si eres cliente, recolector o lavandería.");
  }
  const name = clean(input.name ?? "", 80);
  const email = clean(input.email ?? "", 120).toLowerCase();
  const password = input.password ?? "";
  const phone = clean(input.phone ?? "", 20);
  if (name.length < 3) throw new AppError("Escribe tu nombre completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("Ese correo no parece válido.");
  if (password.length < 6) throw new AppError("La contraseña necesita al menos 6 caracteres.");
  if (phone.length < 8) throw new AppError("Escribe un teléfono de contacto.");

  let plate = "";
  let idPhoto: string | null = null;
  let businessName = "";
  let address = "";
  let hours = "";
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (role === "recolector") {
    plate = clean(input.plate ?? "", 16).toUpperCase();
    if (plate.length < 4) throw new AppError("Escribe la placa de la moto.");
    if (input.idPhoto) {
      assertImage(input.idPhoto, "La identificación");
      try {
        idPhoto = persistPhoto(input.idPhoto);
      } catch {
        throw new AppError("No pudimos guardar la foto de la identificación.");
      }
    }
  }
  if (role === "lavanderia") {
    businessName = clean(input.businessName ?? "", 80);
    address = clean(input.address ?? "", 160);
    hours = clean(input.hours ?? "", 80);
    if (businessName.length < 3) throw new AppError("Escribe el nombre del negocio.");
    if (address.length < 6) throw new AppError("Escribe la dirección del taller.");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new AppError("Pon el taller en el mapa.");
    if (hours.length < 3) hours = "Horario por confirmar";
  }

  const created = commit((db) => {
    if (db.users.some((user) => user.email === email)) {
      throw new AppError("Ese correo ya tiene cuenta. Entra o usa otro.");
    }
    const status: AccountStatus = role === "cliente" ? "activo" : "pendiente";
    const id = newId("usr");
    const user: User = {
      id,
      role,
      name: role === "lavanderia" ? businessName : name,
      email,
      password,
      phone,
      ratingAvg: 0,
      ratingCount: 0,
      lat: role === "lavanderia" ? lat : 19.4326,
      lng: role === "lavanderia" ? lng : -99.1332,
      status,
      laundryId: null,
      courier:
        role === "recolector"
          ? { plate, idPhoto, available: false, liveGps: false }
          : null,
    };
    if (role === "lavanderia") {
      const shopId = newId("ldy");
      user.laundryId = shopId;
      db.laundries.push({
        id: shopId,
        ownerId: id,
        name: businessName,
        address,
        lat,
        lng,
        phone,
        hours,
        rates: input.rates ?? null,
        status: "pendiente",
      });
    }
    db.users.push(user);
    const admin = db.users.find((item) => item.role === "admin");
    if (admin && status === "pendiente") {
      db.notifications.unshift({
        id: newId("nt"),
        userId: admin.id,
        orderId: null,
        title: role === "lavanderia" ? "Nueva lavandería" : "Nuevo recolector",
        body: `${user.name} espera aprobación.`,
        createdAt: new Date().toISOString(),
        read: false,
        important: true,
      });
    }
    return structuredClone(user);
  });
  emit({ type: "changed" });
  return created;
}

export function reviewAccount(
  admin: User,
  input: { userId: string; decision: "aprobar" | "rechazar" | "suspender" },
) {
  if (admin.role !== "admin" || admin.status !== "activo") {
    throw new AppError("Solo administración puede revisar cuentas.", 403);
  }
  const decision = input.decision;
  if (decision !== "aprobar" && decision !== "rechazar" && decision !== "suspender") {
    throw new AppError("Esa decisión no existe.");
  }
  const nextStatus: AccountStatus =
    decision === "aprobar" ? "activo" : decision === "rechazar" ? "rechazado" : "suspendido";
  const updated = commit((db) => {
    const user = db.users.find((item) => item.id === input.userId);
    if (!user || (user.role !== "lavanderia" && user.role !== "recolector")) {
      throw new AppError("Esa cuenta no se puede revisar.", 404);
    }
    user.status = nextStatus;
    if (user.courier) user.courier.available = nextStatus === "activo";
    const shop = db.laundries.find((item) => item.ownerId === user.id || item.id === user.laundryId);
    if (shop) shop.status = nextStatus;
    db.notifications.unshift({
      id: newId("nt"),
      userId: user.id,
      orderId: null,
      title:
        nextStatus === "activo"
          ? "Cuenta aprobada"
          : nextStatus === "suspendido"
            ? "Cuenta suspendida"
            : "Cuenta no aprobada",
      body:
        nextStatus === "activo"
          ? "Ya puedes recibir viajes en LavaYa."
          : nextStatus === "suspendido"
            ? "Administración suspendió la cuenta. Los pedidos nuevos no te llegarán."
            : "Administración no aprobó la cuenta.",
      createdAt: new Date().toISOString(),
      read: false,
      important: true,
    });
    return structuredClone(user);
  });
  emit({ type: "changed" });
  return updated;
}

export function listApplications() {
  const db = readDb();
  return db.users
    .filter((user) => user.role === "lavanderia" || user.role === "recolector")
    .map((user) => {
      const shop = db.laundries.find((item) => item.id === user.laundryId || item.ownerId === user.id) ?? null;
      return {
        id: user.id,
        role: user.role as Role,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        plate: user.courier?.plate ?? null,
        idPhoto: user.courier?.idPhoto ?? null,
        liveGps: user.courier?.liveGps ?? false,
        shop: shop
          ? {
              name: shop.name,
              address: shop.address,
              hours: shop.hours,
              lat: shop.lat,
              lng: shop.lng,
              phone: shop.phone,
              hasCustomRates: Boolean(shop.rates),
            }
          : null,
      };
    });
}
