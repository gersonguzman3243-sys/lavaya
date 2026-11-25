const MX = "America/Mexico_City";

export function mxn(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: MX,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: MX,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function timeAgo(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "ahora";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

/** Interpreta YYYY-MM-DDTHH:mm como hora de la Ciudad de México (UTC-6, sin horario de verano). */
export function mexicoLocalToIso(value: string) {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = (time ?? "00:00").split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute || 0, 0)).toISOString();
}

export function money(value: number) {
  return Math.round(value * 100) / 100;
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}
