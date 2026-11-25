import type { BaseService, OrderStatus } from "./types";

export const GARMENTS = [
  { id: "playera", label: "Playeras", kg: 0.2 },
  { id: "camisa", label: "Camisas", kg: 0.25 },
  { id: "pantalon", label: "Pantalones", kg: 0.45 },
  { id: "vestido", label: "Vestidos", kg: 0.35 },
  { id: "interior", label: "Ropa interior", kg: 0.08 },
  { id: "toalla", label: "Toallas", kg: 0.5 },
  { id: "cama", label: "Ropa de cama", kg: 0.7 },
  { id: "chamarra", label: "Chamarras", kg: 0.85 },
] as const;

export type GarmentId = (typeof GARMENTS)[number]["id"];

export const PLACES = [
  {
    id: "roma",
    label: "Roma Norte",
    address: "Orizaba 89, Roma Norte, CDMX",
    lat: 19.4187,
    lng: -99.1622,
  },
  {
    id: "condesa",
    label: "Condesa",
    address: "Colima 180, Condesa, CDMX",
    lat: 19.4102,
    lng: -99.1715,
  },
  {
    id: "juarez",
    label: "Juárez",
    address: "Liverpool 90, Juárez, CDMX",
    lat: 19.4272,
    lng: -99.1608,
  },
  {
    id: "delvalle",
    label: "Del Valle",
    address: "Adolfo Prieto 420, Del Valle, CDMX",
    lat: 19.3908,
    lng: -99.1674,
  },
  {
    id: "narvarte",
    label: "Narvarte",
    address: "Xochicalco 540, Narvarte, CDMX",
    lat: 19.3972,
    lng: -99.1528,
  },
  {
    id: "coyoacan",
    label: "Coyoacán",
    address: "Francisco Sosa 120, Coyoacán, CDMX",
    lat: 19.345,
    lng: -99.171,
  },
  {
    id: "polanco",
    label: "Polanco",
    address: "Homero 415, Polanco, CDMX",
    lat: 19.4338,
    lng: -99.1905,
  },
] as const;

export const LAUNDRY = {
  name: "LavaYa Taller Doctores",
  address: "Dr. García Diego 45, Col. Doctores, CDMX",
  lat: 19.4216,
  lng: -99.1436,
  phone: "55 1234 5603",
};

export const STATUS_FLOW: OrderStatus[] = [
  "solicitado",
  "recolector_asignado",
  "en_camino",
  "recogido",
  "en_lavanderia",
  "pesado",
  "lavando",
  "listo",
  "en_entrega",
  "entregado",
];

export function garmentById(id: string) {
  return GARMENTS.find((item) => item.id === id);
}

export function garmentLabel(id: string) {
  return garmentById(id)?.label ?? "Prenda";
}

/** Peso estimado a partir de las prendas. Mínimo medio kilo para no cotizar en cero. */
export function estimateKg(garments: Array<{ type: string; count: number }>) {
  const sum = garments.reduce((acc, item) => {
    const spec = garmentById(item.type);
    return acc + (spec?.kg ?? 0.3) * Math.max(0, item.count);
  }, 0);
  const rounded = Math.round(sum * 10) / 10;
  return Math.max(0.5, rounded);
}

export function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    solicitado: "Solicitado",
    recolector_asignado: "Recolector asignado",
    en_camino: "En camino",
    recogido: "Recogido",
    en_lavanderia: "En lavandería",
    pesado: "Pesado y contado",
    lavando: "Lavando",
    listo: "Listo",
    en_entrega: "En entrega",
    entregado: "Entregado",
    cancelado: "Cancelado",
  };
  return labels[status];
}

export function serviceLabel(service: BaseService) {
  return service === "lavado_normal" ? "Lavado normal" : "Lavado en seco";
}

export function canTransition(from: OrderStatus, to: OrderStatus) {
  if (to === "cancelado") return from === "solicitado";
  const current = STATUS_FLOW.indexOf(from);
  const next = STATUS_FLOW.indexOf(to);
  return current >= 0 && next === current + 1;
}

export function customerHeadline(input: {
  status: OrderStatus;
  courierName: string | null;
  actualKg: number | null;
}) {
  const who = input.courierName ?? "Tu recolector";
  switch (input.status) {
    case "solicitado":
      return "Buscamos un recolector en moto";
    case "recolector_asignado":
      return `${who} ya tomó tu pedido`;
    case "en_camino":
      return `${who} va en camino`;
    case "recogido":
      return "Tu ropa va a la lavandería";
    case "en_lavanderia":
      return "Ya está en el taller";
    case "pesado":
      return input.actualKg != null
        ? `Llegaron ${input.actualKg.toFixed(1)} kg`
        : "Ya pesamos tu ropa";
    case "lavando":
      return "Estamos lavando tu ropa";
    case "listo":
      return "Tu ropa está lista";
    case "en_entrega":
      return `${who} lleva tu ropa limpia`;
    case "entregado":
      return "Ropa entregada";
    case "cancelado":
      return "Pedido cancelado";
  }
}

export const DEFAULT_RATES = {
  lavadoNormalPerKg: 12,
  lavadoEnSecoPerKg: 48,
  planchadoPerKg: 18,
  recoleccionPerKm: 5,
  entregaPerKm: 5,
  itemRates: Object.fromEntries(GARMENTS.map((item) => [item.id, 0])) as Record<string, number>,
};
