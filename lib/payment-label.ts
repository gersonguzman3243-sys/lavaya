import type { PaymentStatus } from "./types";

export function paymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case "pendiente":
      return "Pago pendiente";
    case "demo":
      return "Modo demo";
    case "aprobado":
      return "Pagado";
    case "rechazado":
      return "Pago rechazado";
    case "en_proceso":
      return "Pago en proceso";
    case "efectivo":
      return "Efectivo al recibir";
    case "reembolsado":
      return "Reembolsado";
  }
}
