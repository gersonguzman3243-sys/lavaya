export type Role = "cliente" | "recolector" | "lavanderia" | "admin";

export type AccountStatus = "activo" | "pendiente" | "rechazado" | "suspendido";

export type PaymentMethod = "efectivo" | "mercadopago";

export type PaymentStatus =
  | "pendiente"
  | "demo"
  | "aprobado"
  | "rechazado"
  | "en_proceso"
  | "efectivo"
  | "reembolsado";

export type LocationMode = "gps" | "simulado";

export type OrderStatus =
  | "solicitado"
  | "recolector_asignado"
  | "en_camino"
  | "recogido"
  | "en_lavanderia"
  | "pesado"
  | "lavando"
  | "listo"
  | "en_entrega"
  | "entregado"
  | "cancelado";

export type BaseService = "lavado_normal" | "lavado_en_seco";

export type DistanceMethod = "osrm" | "haversine";

export interface GarmentCount {
  type: string;
  count: number;
}

export interface Rates {
  /** Pesos por kilo. El lavado normal arranca en 12. */
  lavadoNormalPerKg: number;
  /** Ejemplo configurable. Sustituye al lavado normal. */
  lavadoEnSecoPerKg: number;
  /** Ejemplo configurable. Se suma al servicio principal, por kilo. */
  planchadoPerKg: number;
  /** Pesos por kilómetro, casa del cliente → lavandería. */
  recoleccionPerKm: number;
  /** Pesos por kilómetro, lavandería → casa del cliente. */
  entregaPerKm: number;
  /** Extra por prenda. 0 = esa prenda solo se cuenta y el cobro va por kilo. */
  itemRates: Record<string, number>;
}

export interface PriceLine {
  id: string;
  label: string;
  detail: string;
  amount: number;
}

export interface PriceBreakdown {
  lines: PriceLine[];
  subtotal: number;
  discount: number;
  discountLabel: string | null;
  total: number;
  km: number;
  distanceMethod: DistanceMethod;
  kg: number;
}

export interface AppliedCoupon {
  code: string;
  type: "percent" | "fixed";
  value: number;
  description: string;
}

export interface Coupon {
  code: string;
  description: string;
  type: "percent" | "fixed";
  value: number;
  expiresAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
}

export interface Banner {
  id: string;
  title: string;
  body: string;
  code: string | null;
  active: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: "cliente" | "recolector";
  senderName: string;
  text: string;
  createdAt: string;
  readBy: string[];
}

export interface Rating {
  stars: number;
  comment: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  orderId: string | null;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  important: boolean;
}

export interface CourierProfile {
  plate: string;
  idPhoto: string | null;
  available: boolean;
  liveGps: boolean;
}

export interface PublicCourier {
  plate: string;
  available: boolean;
  liveGps: boolean;
  hasIdPhoto: boolean;
}

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  password: string;
  phone: string;
  ratingAvg: number;
  ratingCount: number;
  lat: number;
  lng: number;
  status: AccountStatus;
  /** Taller de este usuario cuando el rol es lavandería. */
  laundryId: string | null;
  courier: CourierProfile | null;
}

export type PublicUser = Omit<User, "password" | "courier"> & {
  courier: PublicCourier | null;
};

export interface OrderPricing {
  rates: Rates;
  km: number;
  distanceMethod: DistanceMethod;
  coupon: AppliedCoupon | null;
}

export interface Order {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  courierId: string | null;
  courierName: string | null;
  status: OrderStatus;
  address: string;
  reference: string;
  lat: number;
  lng: number;
  notes: string;
  customerPhoto: string | null;
  garments: GarmentCount[];
  baseService: BaseService;
  planchado: boolean;
  /** null = ahora mismo */
  scheduledFor: string | null;
  estimatedKg: number;
  actualKg: number | null;
  receivedGarments: GarmentCount[] | null;
  laundryPhotos: string[];
  pricing: OrderPricing;
  estimate: PriceBreakdown;
  finalPrice: PriceBreakdown | null;
  customerAccepted: boolean;
  courierLat: number | null;
  courierLng: number | null;
  /** [lat, lng] */
  route: Array<[number, number]>;
  routeProgress: number;
  laundryId: string;
  laundryName: string;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  preferenceId: string | null;
  paymentId: string | null;
  locationMode: LocationMode;
  etaMinutes: number | null;
  rating: Rating | null;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  statusLog: Array<{ status: OrderStatus; at: string }>;
}

export interface LaundryPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
}

export interface LaundryBusiness extends LaundryPlace {
  id: string;
  ownerId: string;
  hours: string;
  /** null = tarifas de la plataforma (12/kg y 5 MXN/km). */
  rates: Rates | null;
  status: AccountStatus;
}

export interface DB {
  schemaVersion: number;
  seq: number;
  users: User[];
  orders: Order[];
  rates: Rates;
  coupons: Coupon[];
  banners: Banner[];
  notifications: AppNotification[];
  laundry: LaundryPlace;
  laundries: LaundryBusiness[];
}
