"use client";

import { useState } from "react";
import { toast } from "sonner";
import { NewOrder } from "@/components/new-order";
import { Shell } from "@/components/shell";
import { Tracking } from "@/components/tracking";
import { useLavaya } from "@/components/use-lavaya";
import { enableAlerts } from "@/components/api";
import { Button } from "@/components/ui/button";
import { GarmentLine, StatusPill } from "@/components/widgets";
import { customerHeadline } from "@/lib/catalog";
import { formatDateTime, mxn } from "@/lib/format";
import { Mark } from "@/components/logo";

export function ClienteApp() {
  const { data, error, reload } = useLavaya("cliente");
  const [view, setView] = useState<"home" | "new" | "order">("home");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<string | null>(null);

  if (error) {
    return (
      <ScreenMessage
        title="No cargó LavaYa"
        body={error}
        action="Reintentar"
        onAction={() => void reload()}
      />
    );
  }
  if (!data || data.me.role !== "cliente") return <ScreenMessage title="Abriendo tu cuenta…" body="Un momento." />;

  const active = data.orders.filter((order) => order.status !== "entregado" && order.status !== "cancelado");
  const past = data.orders.filter((order) => order.status === "entregado" || order.status === "cancelado");
  const selected = data.orders.find((order) => order.id === orderId) ?? null;

  function openOrder(id: string) {
    setOrderId(id);
    setView("order");
  }

  return (
    <Shell data={data} onOpenOrder={openOrder}>
      {view === "new" ? (
        <NewOrder
          rates={data.rates}
          initialCoupon={coupon}
          onCancel={() => setView("home")}
          onCreated={(id) => {
            setCoupon(null);
            openOrder(id);
          }}
        />
      ) : null}
      {view === "order" && selected ? (
        <Tracking order={selected} me={data.me} people={data.people} laundry={data.laundry} onBack={() => setView("home")} />
      ) : null}
      {view === "order" && !selected ? (
        <ScreenMessage title="Ese pedido ya no está" body="Vuelve al inicio para ver los demás." action="Inicio" onAction={() => setView("home")} />
      ) : null}
      {view === "home" ? (
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2 pb-8">
          <div>
            <p className="text-sm text-muted-foreground">Hola, {data.me.name.split(" ")[0]}</p>
            <h1 className="font-display text-4xl leading-none">Tu ropa va y vuelve en moto.</h1>
          </div>
          {data.banners.filter((banner) => banner.active).map((banner) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => {
                setCoupon(banner.code);
                setView("new");
              }}
              className="block w-full rounded-3xl bg-ink p-4 text-left text-white"
            >
              <span className="text-xs font-bold uppercase tracking-wide text-mango">Promoción</span>
              <span className="mt-1 block font-display text-2xl">{banner.title}</span>
              <span className="mt-1 block text-sm text-white/80">{banner.body}</span>
            </button>
          ))}
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => {
              setCoupon(null);
              setView("new");
            }}
          >
            Nueva recolección
          </Button>
          <button
            type="button"
            className="w-full rounded-2xl bg-white px-4 py-3 text-left text-sm"
            onClick={async () => {
              const ok = await enableAlerts();
              toast(ok ? "Alertas activadas" : "Sin permiso. Los avisos siguen en la campana.");
            }}
          >
            <span className="font-semibold">Avísame cuando esté lista</span>
            <span className="mt-1 block text-muted-foreground">Pedimos permiso para alertas del navegador o del teléfono.</span>
          </button>
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">En curso</h2>
            {active.length === 0 ? (
              <p className="rounded-3xl bg-white px-4 py-6 text-sm text-muted-foreground">
                No tienes recolecciones abiertas. Cuando pidas una, aquí ves la moto, el peso real y el total.
              </p>
            ) : (
              active.map((order) => (
                <button key={order.id} type="button" onClick={() => openOrder(order.id)} className="block w-full rounded-3xl bg-white p-4 text-left">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold">{order.code}</span>
                    <StatusPill status={order.status} />
                  </span>
                  <span className="mt-2 block font-display text-2xl leading-tight">{customerHeadline(order)}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{order.address}</span>
                  <span className="mt-2 block text-sm font-semibold">
                    {order.finalPrice ? mxn(order.finalPrice.total) : `Estimado ${mxn(order.estimate.total)}`}
                  </span>
                </button>
              ))
            )}
          </section>
          {past.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Anteriores</h2>
              {past.map((order) => (
                <button key={order.id} type="button" onClick={() => openOrder(order.id)} className="block w-full rounded-3xl bg-white p-4 text-left">
                  <span className="flex items-center justify-between">
                    <span className="font-semibold">{order.code}</span>
                    <StatusPill status={order.status} />
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                  <GarmentLine items={order.receivedGarments ?? order.garments} />
                  {order.rating ? <span className="mt-1 block text-sm">{order.rating.stars} ★ para {order.courierName}</span> : null}
                </button>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </Shell>
  );
}

function ScreenMessage({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="mb-4 flex justify-center">
          <Mark size={64} />
        </div>
        <h1 className="font-display text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {action && onAction ? (
          <Button type="button" className="mt-4" onClick={onAction}>
            {action}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
