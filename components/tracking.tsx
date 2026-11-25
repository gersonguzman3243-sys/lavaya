"use client";

import { useState } from "react";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/components/api";
import { ChatSheet } from "@/components/chat-sheet";
import { MapView, type MapPin } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  GarmentLine,
  PriceCard,
  Stars,
  StatusPill,
  StatusRail,
  unreadCount,
} from "@/components/widgets";
import { customerHeadline, serviceLabel } from "@/lib/catalog";
import { formatDateTime, mxn } from "@/lib/format";
import { paymentStatusLabel } from "@/lib/payment-label";
import type { LaundryPlace, Order, PublicUser } from "@/lib/types";

export function Tracking({
  order,
  me,
  people,
  laundry,
  mercadoPago,
  onBack,
}: {
  order: Order;
  me: PublicUser;
  people: PublicUser[];
  laundry: LaundryPlace;
  mercadoPago: boolean;
  onBack: () => void;
}) {
  const [chat, setChat] = useState(false);
  const [stars, setStars] = useState(order.rating?.stars ?? 5);
  const [comment, setComment] = useState(order.rating?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const courier = people.find((person) => person.id === order.courierId);
  const unread = unreadCount(order, me.id);
  const moving = order.status === "en_camino" || order.status === "recogido" || order.status === "en_entrega";
  const pins: MapPin[] = [
    { id: "home", lat: order.lat, lng: order.lng, kind: "home", glyph: "🏠", label: "Tu dirección" },
    { id: "shop", lat: laundry.lat, lng: laundry.lng, kind: "shop", glyph: "🧺", label: laundry.name },
  ];
  if (moving && order.courierLat != null && order.courierLng != null) {
    pins.push({
      id: "moto",
      lat: order.courierLat,
      lng: order.courierLng,
      kind: "moto",
      glyph: "🛵",
      label: order.courierName ?? "Recolector",
    });
  }

  async function pay(method: "efectivo" | "mercadopago") {
    setBusy(true);
    try {
      const result = await api<{
        mode: "efectivo" | "demo" | "mercadopago";
        initPoint?: string;
        sandboxInitPoint?: string;
      }>("/api/payments/checkout", { orderId: order.id, method });
      if (result.mode === "demo") {
        toast.success("Modo demo: el pago quedó simulado. No hubo cargo.");
        return;
      }
      if (result.mode === "efectivo") {
        toast.success("Pagarás en efectivo al recibir la ropa.");
        return;
      }
      const next = result.sandboxInitPoint || result.initPoint;
      if (next) window.location.href = next;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos preparar el pago.");
    } finally {
      setBusy(false);
    }
  }

  async function act(type: string, extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/api/orders/${order.id}/action`, { type, ...extra });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el pedido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative h-[38dvh] shrink-0">
        <MapView
          className="h-full w-full"
          pins={pins}
          route={moving ? order.route : []}
          fitKey={`${order.id}-${order.status}`}
        />
        <button
          type="button"
          onClick={onBack}
          className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-semibold shadow"
        >
          <ChevronLeft className="h-4 w-4" />
          Inicio
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-wide text-muted-foreground">{order.code}</p>
            <h2 className="font-display text-3xl leading-none">
              {customerHeadline(order)}
            </h2>
          </div>
          <StatusPill status={order.status} />
        </div>
        {courier && order.courierId ? (
          <p className="text-sm text-muted-foreground">
            {courier.name} · {courier.ratingAvg.toFixed(1)} ★ ({courier.ratingCount}) · moto
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">En cuanto alguien tome el viaje, lo verás en el mapa.</p>
        )}
        {moving && order.courierLat != null ? (
          <p className="rounded-2xl bg-white px-3 py-2 text-sm">
            {order.etaMinutes ? `Llega en unos ${order.etaMinutes} min. ` : ""}
            {order.locationMode === "gps" ? "Ubicación en vivo del recolector." : "Recorrido estimado: no hay GPS del teléfono."}
          </p>
        ) : null}
        {order.scheduledFor ? (
          <p className="rounded-2xl bg-cream px-3 py-2 text-sm">Programada para {formatDateTime(order.scheduledFor)}.</p>
        ) : null}
        <p className="text-sm">
          {serviceLabel(order.baseService)}
          {order.planchado ? " + planchado" : ""} · {order.address}
        </p>
        <StatusRail status={order.status} />
        <div className="rounded-3xl bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Lo que declaraste</p>
          <GarmentLine items={order.garments} />
          <p className="mt-1 text-xs text-muted-foreground">Estimado {order.estimatedKg.toFixed(1)} kg</p>
          {order.customerPhoto ? (
            <img src={order.customerPhoto} alt="Foto que enviaste de tu ropa" className="mt-3 h-32 w-full rounded-2xl object-cover" />
          ) : null}
        </div>
        {order.receivedGarments ? (
          <div className="rounded-3xl bg-secondary p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-leaf">Lo que llegó al taller</p>
            <GarmentLine items={order.receivedGarments} />
            <p className="mt-1 text-sm font-semibold">{order.actualKg?.toFixed(1)} kg en báscula</p>
            {order.laundryPhotos.length > 0 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {order.laundryPhotos.map((photo, index) => (
                  <img key={photo.slice(0, 32) + index} src={photo} alt={`Ropa recibida, foto ${index + 1}`} className="h-28 w-36 shrink-0 rounded-2xl object-cover" />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">El taller no adjuntó fotos.</p>
            )}
          </div>
        ) : null}
        <PriceCard
          price={order.finalPrice ?? order.estimate}
          title={order.finalPrice ? "Precio final" : "Precio estimado"}
          caption={
            order.finalPrice
              ? "El total usa el peso real, las tarifas de este pedido y los dos tramos de distancia."
              : "Todavía es un estimado. El final sale cuando el taller pesa la ropa."
          }
        />
        {order.finalPrice ? <PaymentPanel order={order} busy={busy} mercadoPago={mercadoPago} onPay={pay} /> : null}
        {order.customerAccepted && order.status === "pesado" ? (
          <p className="rounded-2xl bg-secondary px-3 py-2 text-sm">Aceptaste el total. El taller ya puede empezar a lavar.</p>
        ) : null}
        {order.status === "solicitado" ? (
          <Button type="button" variant="danger" disabled={busy} onClick={() => void act("cancel")}>
            Cancelar pedido
          </Button>
        ) : null}
        {order.status === "entregado" ? (
          <section className="space-y-3 rounded-3xl bg-white p-4">
            <h3 className="font-display text-2xl">¿Cómo estuvo el viaje{order.courierName ? ` con ${order.courierName.split(" ")[0]}` : ""}?</h3>
            {order.rating ? (
              <>
                <Stars value={order.rating.stars} />
                {order.rating.comment ? <p className="text-sm">{order.rating.comment}</p> : null}
              </>
            ) : (
              <>
                <Stars value={stars} onChange={setStars} />
                <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Un comentario, si quieres" />
                <Button type="button" disabled={busy} onClick={() => void act("rate", { stars, comment })}>
                  Enviar calificación
                </Button>
              </>
            )}
          </section>
        ) : null}
      </div>
      {order.courierId && order.status !== "cancelado" ? (
        <div className="border-t border-border bg-white p-4">
          <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => setChat(true)}>
            <MessageCircle className="h-5 w-5" />
            Chat con {order.courierName?.split(" ")[0] ?? "recolector"}
            {unread > 0 ? <span className="rounded-full bg-mango px-2 py-0.5 text-xs text-ink">{unread}</span> : null}
          </Button>
        </div>
      ) : null}
      <ChatSheet order={order} userId={me.id} open={chat} onOpenChange={setChat} />
    </div>
  );
}

function PaymentPanel({
  order,
  busy,
  mercadoPago,
  onPay,
}: {
  order: Order;
  busy: boolean;
  mercadoPago: boolean;
  onPay: (method: "efectivo" | "mercadopago") => void;
}) {
  const waiting = order.paymentStatus === "pendiente" || order.paymentStatus === "rechazado";
  const canChoose = Boolean(order.finalPrice) && order.status !== "cancelado" && waiting;
  return (
    <section className="space-y-3 rounded-3xl bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-2xl">Pago</h3>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold">{paymentStatusLabel(order.paymentStatus)}</span>
      </div>
      {order.paymentStatus === "demo" ? (
        <p className="text-sm">Modo demo: no hay llaves de Mercado Pago, así que este cobro es simulado y no sale de tu tarjeta.</p>
      ) : null}
      {order.paymentStatus === "efectivo" ? <p className="text-sm">Pagas en efectivo cuando te entreguen la ropa limpia.</p> : null}
      {order.paymentStatus === "aprobado" ? <p className="text-sm">Mercado Pago confirmó el cobro de {mxn(order.finalPrice?.total ?? order.estimate.total)}.</p> : null}
      {order.paymentStatus === "en_proceso" ? <p className="text-sm">El pago sigue en proceso (puede ser OXXO o una transferencia).</p> : null}
      {canChoose ? (
        <>
          <p className="text-sm text-muted-foreground">
            {mercadoPago
              ? "Checkout Pro de Mercado Pago, en modo prueba: tarjeta, OXXO o transferencia."
              : "Sin credenciales de Mercado Pago el botón deja el pedido en modo demo."}
          </p>
          <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => onPay("mercadopago")}>
            Pagar con Mercado Pago · {mxn(order.finalPrice?.total ?? 0)}
          </Button>
          <Button type="button" size="lg" variant="outline" className="w-full" disabled={busy} onClick={() => onPay("efectivo")}>
            Efectivo al recibir
          </Button>
        </>
      ) : null}
    </section>
  );
}
