"use client";

import { useState } from "react";
import { ChevronLeft, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/components/api";
import { ChatSheet } from "@/components/chat-sheet";
import { MapView, type MapPin } from "@/components/map";
import { Shell } from "@/components/shell";
import { useLavaya } from "@/components/use-lavaya";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GarmentLine, StatusPill, unreadCount } from "@/components/widgets";
import { Mark } from "@/components/logo";
import { haversineKm } from "@/lib/geo";
import { formatDateTime } from "@/lib/format";
import type { Order } from "@/lib/types";

export function RecolectorApp() {
  const { data, error, reload } = useLavaya("recolector");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <Plain title="No cargó LavaYa" body={error} action="Reintentar" onAction={() => void reload()} />;
  if (!data || data.me.role !== "recolector") return <Plain title="Abriendo tu moto…" body="Un momento." />;

  const me = data.me;
  const selected = data.orders.find((order) => order.id === orderId) ?? null;
  const disponibles = data.orders.filter((order) => order.status === "solicitado");
  const activos = data.orders.filter(
    (order) => order.courierId === me.id && order.status !== "entregado" && order.status !== "cancelado",
  );
  const hechos = data.orders.filter(
    (order) => order.courierId === me.id && (order.status === "entregado" || order.status === "cancelado"),
  );

  async function accept(order: Order) {
    setBusy(true);
    try {
      await api(`/api/orders/${order.id}/action`, { type: "accept" });
      setConfirm(null);
      setOrderId(order.id);
      toast.success("Viaje tomado. La moto ya va en el mapa.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos tomar el viaje.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell data={data} onOpenOrder={setOrderId}>
      {selected ? (
        <Trip
          order={selected}
          userId={me.id}
          laundry={data.laundry}
          onBack={() => setOrderId(null)}
        />
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-2 pb-8">
          <div>
            <p className="text-sm text-muted-foreground">Hola, {me.name.split(" ")[0]}</p>
            <h1 className="font-display text-4xl leading-none">Tus viajes</h1>
            <p className="mt-2 text-sm">
              {me.ratingAvg.toFixed(1)} ★ · {me.ratingCount} calificaciones · moto
            </p>
          </div>
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">En curso</h2>
            {activos.length === 0 ? (
              <p className="rounded-3xl bg-white px-4 py-5 text-sm text-muted-foreground">
                No llevas un viaje abierto. Toma una recolección de la lista.
              </p>
            ) : (
              activos.map((order) => (
                <OrderCard key={order.id} order={order} meId={me.id} onOpen={() => setOrderId(order.id)} />
              ))
            )}
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Disponibles</h2>
            {disponibles.length === 0 ? (
              <p className="rounded-3xl bg-white px-4 py-5 text-sm text-muted-foreground">
                Cuando un cliente pida recolección, el viaje aparece aquí.
              </p>
            ) : (
              disponibles.map((order) => {
                const km = haversineKm(me, { lat: order.lat, lng: order.lng });
                return (
                  <article key={order.id} className="rounded-3xl bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold">{order.code}</p>
                      <StatusPill status={order.status} />
                    </div>
                    <p className="mt-1 font-display text-2xl leading-tight">{order.customerName}</p>
                    <p className="text-sm text-muted-foreground">{order.address}</p>
                    <p className="mt-1 text-sm">A unos {km.toFixed(1)} km en línea recta</p>
                    {order.scheduledFor ? (
                      <p className="mt-2 rounded-2xl bg-cream px-3 py-2 text-sm">Programada para {formatDateTime(order.scheduledFor)}</p>
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-leaf">Para ahora</p>
                    )}
                    <div className="mt-2">
                      <GarmentLine items={order.garments} />
                    </div>
                    <Button type="button" size="lg" className="mt-3 w-full" onClick={() => (order.scheduledFor ? setConfirm(order) : void accept(order))}>
                      Tomar este viaje
                    </Button>
                  </article>
                );
              })
            )}
          </section>
          {hechos.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Hechos</h2>
              {hechos.map((order) => (
                <OrderCard key={order.id} order={order} meId={me.id} onOpen={() => setOrderId(order.id)} />
              ))}
            </section>
          ) : null}
        </div>
      )}
      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿La tomas ahora?</DialogTitle>
            <DialogDescription>
              {confirm?.scheduledFor
                ? `Esta recolección es para ${formatDateTime(confirm.scheduledFor)}. Puedes adelantarla si ya vas para allá.`
                : "Este viaje es para ahora."}
            </DialogDescription>
          </DialogHeader>
          <Button type="button" size="lg" disabled={busy} onClick={() => confirm && void accept(confirm)}>
            Sí, tomar el viaje
          </Button>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function OrderCard({
  order,
  onOpen,
  meId,
}: {
  order: Order;
  meId: string;
  onOpen: () => void;
}) {
  const unread = unreadCount(order, meId);
  return (
    <button type="button" onClick={onOpen} className="block w-full rounded-3xl bg-white p-4 text-left">
      <span className="flex items-center justify-between gap-2">
        <span className="font-bold">{order.code}</span>
        <StatusPill status={order.status} />
      </span>
      <span className="mt-1 block text-sm">{order.customerName}</span>
      <span className="block text-sm text-muted-foreground">{order.address}</span>
      {unread > 0 ? <span className="mt-2 inline-block rounded-full bg-mango px-2 py-0.5 text-xs font-bold">{unread} sin leer</span> : null}
    </button>
  );
}

function Trip({
  order,
  userId,
  laundry,
  onBack,
}: {
  order: Order;
  userId: string;
  laundry: { name: string; lat: number; lng: number; address: string };
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState(false);
  const unread = unreadCount(order, userId);
  const moving = order.status === "en_camino" || order.status === "recogido" || order.status === "en_entrega";
  const pins: MapPin[] = [
    { id: "home", lat: order.lat, lng: order.lng, kind: "home", glyph: "🏠", label: order.address },
    { id: "shop", lat: laundry.lat, lng: laundry.lng, kind: "shop", glyph: "🧺", label: laundry.name },
  ];
  if (moving && order.courierLat != null && order.courierLng != null) {
    pins.push({ id: "moto", lat: order.courierLat, lng: order.courierLng, kind: "moto", glyph: "🛵", label: "Tú" });
  }
  const action = actionFor(order);

  async function run(type: string) {
    setBusy(true);
    try {
      await api(`/api/orders/${order.id}/action`, { type });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el viaje.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative h-[40dvh] shrink-0">
        <MapView className="h-full w-full" pins={pins} route={moving ? order.route : []} fitKey={`${order.id}-${order.status}`} />
        <button type="button" onClick={onBack} className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-semibold shadow">
          <ChevronLeft className="h-4 w-4" />
          Viajes
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-muted-foreground">{order.code}</p>
            <h2 className="font-display text-3xl leading-none">{headline(order)}</h2>
          </div>
          <StatusPill status={order.status} />
        </div>
        <p className="text-sm">{order.customerName}</p>
        <p className="text-sm text-muted-foreground">{order.address}</p>
        {order.reference ? <p className="text-sm">Referencia: {order.reference}</p> : null}
        {order.scheduledFor ? <p className="rounded-2xl bg-cream px-3 py-2 text-sm">Programada para {formatDateTime(order.scheduledFor)}</p> : null}
        <GarmentLine items={order.garments} />
        {order.notes ? <p className="rounded-2xl bg-foam px-3 py-2 text-sm">{order.notes}</p> : null}
        <a href={`tel:${order.customerPhone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-sm font-semibold text-leaf">
          <Phone className="h-4 w-4" />
          Llamar al {order.customerPhone}
        </a>
        {action ? <p className="text-sm text-muted-foreground">{action.hint}</p> : <Waiting order={order} />}
      </div>
      <div className="space-y-2 border-t border-border bg-white p-4">
        {action ? (
          <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => void run(action.type)}>
            {action.label}
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => setChat(true)}>
          <MessageCircle className="h-5 w-5" />
          Chat
          {unread > 0 ? <span className="rounded-full bg-mango px-2 py-0.5 text-xs">{unread}</span> : null}
        </Button>
      </div>
      <ChatSheet order={order} userId={userId} open={chat} onOpenChange={setChat} />
    </div>
  );
}

function Waiting({ order }: { order: Order }) {
  if (order.status === "entregado") return <p className="text-sm">Viaje cerrado.{order.rating ? ` Te dejó ${order.rating.stars} estrellas.` : ""}</p>;
  if (order.status === "cancelado") return <p className="text-sm">El cliente canceló este pedido.</p>;
  return <p className="text-sm text-muted-foreground">La lavandería tiene la ropa. Te avisamos cuando esté lista para la entrega.</p>;
}

function headline(order: Order) {
  switch (order.status) {
    case "en_camino":
      return "Vas por la ropa";
    case "recogido":
      return "Rumbo al taller";
    case "en_entrega":
      return "Llevas la ropa limpia";
    case "listo":
      return "Lista para entregar";
    case "entregado":
      return "Entregada";
    default:
      return "En la lavandería";
  }
}

function actionFor(order: Order) {
  switch (order.status) {
    case "en_camino":
      return { type: "pickup", label: "Ya recogí la ropa", hint: "La moto avanza sola en el mapa. Márcalo cuando tengas la bolsa, aunque el punto todavía vaya en camino." };
    case "recogido":
      return { type: "dropoff", label: "La dejé en la lavandería", hint: "El taller está en la Doctores. Márcalo al entregar la bolsa." };
    case "listo":
      return { type: "start_delivery", label: "Iniciar entrega", hint: "La ropa ya se puede llevar de regreso a la casa." };
    case "en_entrega":
      return { type: "deliver", label: "Ya entregué la ropa limpia", hint: "Márcalo cuando el cliente la reciba." };
    default:
      return null;
  }
}

function Plain({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <div className="mb-3 flex justify-center"><Mark size={56} /></div>
        <h1 className="font-display text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {action && onAction ? <Button className="mt-4" onClick={onAction}>{action}</Button> : null}
      </div>
    </div>
  );
}
