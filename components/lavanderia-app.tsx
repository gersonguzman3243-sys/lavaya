"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/components/api";
import { fileToDataUrl, samplePhoto } from "@/components/photos";
import { Shell } from "@/components/shell";
import { useLavaya } from "@/components/use-lavaya";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Counter, GarmentLine, PriceCard, StatusPill, countsFrom, garmentsFrom } from "@/components/widgets";
import { Mark } from "@/components/logo";
import { GARMENTS, serviceLabel, statusLabel } from "@/lib/catalog";
import { formatDateTime, mxn } from "@/lib/format";
import { paymentStatusLabel } from "@/lib/payment-label";
import { computePrice } from "@/lib/pricing";
import type { Coupon, Order, Rates } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "pedidos" | "tarifas" | "promos";

export function LavanderiaApp() {
  const { data, error, reload } = useLavaya("lavanderia");
  const [tab, setTab] = useState<Tab>("pedidos");
  const [orderId, setOrderId] = useState<string | null>(null);

  if (error) return <Plain title="No cargó el taller" body={error} action="Reintentar" onAction={() => void reload()} />;
  if (!data || data.me.role !== "lavanderia") return <Plain title="Abriendo el taller…" body="Un momento." />;
  if (data.me.status !== "activo") {
    return (
      <Plain
        title={data.me.status === "pendiente" ? "Taller en revisión" : "Taller no disponible"}
        body={
          data.me.status === "pendiente"
            ? "Administración tiene que aprobar el taller antes de que te lleguen pedidos."
            : "Esta cuenta no puede operar. Si crees que es un error, escribe a LavaYa."
        }
        action="Salir"
        onAction={() => {
          void fetch("/api/auth/logout", { method: "POST" }).then(() => {
            window.location.href = "/";
          });
        }}
      />
    );
  }

  const selected = data.orders.find((order) => order.id === orderId) ?? null;

  return (
    <Shell data={data} onOpenOrder={(id) => { setOrderId(id); setTab("pedidos"); }}>
      <div className="flex gap-2 px-4 pb-2">
        {(
          [
            ["pedidos", "Pedidos"],
            ["tarifas", "Tarifas"],
            ["promos", "Promos"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              if (id !== "pedidos") setOrderId(null);
            }}
            className={cn("rounded-full px-3 py-1.5 text-sm font-bold", tab === id ? "bg-ink text-white" : "bg-white")}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "tarifas" ? <RatesForm rates={data.rates} /> : null}
      {tab === "promos" ? <Promos coupons={data.coupons ?? []} banners={data.banners} /> : null}
      {tab === "pedidos" && selected ? (
        <OrderDesk order={selected} onBack={() => setOrderId(null)} />
      ) : null}
      {tab === "pedidos" && !selected ? (
        <OrderList orders={data.orders} onOpen={setOrderId} />
      ) : null}
    </Shell>
  );
}

function OrderList({ orders, onOpen }: { orders: Order[]; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<"taller" | "activos" | "todos">("taller");
  const visible = orders.filter((order) => {
    if (filter === "todos") return true;
    if (filter === "taller") return ["en_lavanderia", "pesado", "lavando", "listo"].includes(order.status);
    return !["entregado", "cancelado"].includes(order.status);
  });
  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-8">
      <div>
        <h1 className="font-display text-4xl leading-none">Taller</h1>
        <p className="mt-2 text-sm text-muted-foreground">Pesa lo que llegó, toma fotos y mueve el lavado.</p>
      </div>
      <div className="flex gap-2">
        {(
          [
            ["taller", "En taller"],
            ["activos", "Activos"],
            ["todos", "Todos"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={cn("rounded-full px-3 py-1 text-xs font-bold", filter === id ? "bg-leaf text-white" : "bg-white")}>
            {label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-3xl bg-white px-4 py-6 text-sm text-muted-foreground">
          Nada en esta bandeja. Cuando el recolector deje una bolsa, el pedido aparece aquí para pesarlo.
        </p>
      ) : (
        visible.map((order) => (
          <button key={order.id} type="button" onClick={() => onOpen(order.id)} className="block w-full rounded-3xl bg-white p-4 text-left">
            <span className="flex items-center justify-between gap-2">
              <span className="font-bold">{order.code}</span>
              <StatusPill status={order.status} />
            </span>
            <span className="mt-1 block">{order.customerName}</span>
            <span className="block text-sm text-muted-foreground">{serviceLabel(order.baseService)}{order.planchado ? " + planchado" : ""}</span>
            <span className="mt-2 block text-sm">{order.finalPrice ? "Peso registrado" : `Declaró ${order.estimatedKg.toFixed(1)} kg`}</span>
            {order.finalPrice ? <span className="mt-1 block text-sm font-semibold">{paymentStatusLabel(order.paymentStatus)}</span> : null}
          </button>
        ))
      )}
    </div>
  );
}

function OrderDesk({ order, onBack }: { order: Order; onBack: () => void }) {
  const [kg, setKg] = useState(String(order.actualKg ?? order.estimatedKg));
  const [counts, setCounts] = useState(countsFrom(order.receivedGarments ?? order.garments));
  const [photos, setPhotos] = useState<string[]>(order.laundryPhotos);
  const [busy, setBusy] = useState(false);
  const canWeigh = order.status === "en_lavanderia" || (order.status === "pesado" && !order.customerAccepted);
  const garments = useMemo(() => garmentsFrom(counts), [counts]);
  const preview = computePrice({
    rates: order.pricing.rates,
    km: order.pricing.km,
    distanceMethod: order.pricing.distanceMethod,
    coupon: order.pricing.coupon,
    baseService: order.baseService,
    planchado: order.planchado,
    garments,
    kg: Number(kg) || 0,
  });

  useEffect(() => {
    setKg(String(order.actualKg ?? order.estimatedKg));
    setCounts(countsFrom(order.receivedGarments ?? order.garments));
    setPhotos(order.laundryPhotos);
  }, [order.id]);

  async function saveIntake() {
    setBusy(true);
    try {
      await api(`/api/orders/${order.id}/action`, {
        type: "intake",
        kg: Number(kg),
        garments,
        photos,
      });
      toast.success("Quedó registrado. El cliente ya ve el total.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar el peso.");
    } finally {
      setBusy(false);
    }
  }

  async function advance(to: "lavando" | "listo") {
    setBusy(true);
    try {
      await api(`/api/orders/${order.id}/action`, { type: "advance", to });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos avanzar el pedido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8">
      <button type="button" className="text-sm font-semibold text-leaf" onClick={onBack}>← Pedidos</button>
      <div>
        <p className="text-xs font-bold text-muted-foreground">{order.code} · {statusLabel(order.status)}</p>
        <h2 className="font-display text-3xl leading-none">{order.customerName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</p>
        {order.finalPrice ? <p className="mt-2 text-sm font-semibold">{paymentStatusLabel(order.paymentStatus)} · {mxn(order.finalPrice.total)}</p> : null}
      </div>
      <div className="rounded-3xl bg-white p-4 text-sm">
        <p className="font-semibold">Declaró</p>
        <GarmentLine items={order.garments} />
        <p className="mt-1 text-muted-foreground">{order.estimatedKg.toFixed(1)} kg estimados · {serviceLabel(order.baseService)}{order.planchado ? " + planchado" : ""}</p>
        {order.notes ? <p className="mt-2">{order.notes}</p> : null}
        {order.customerPhoto ? <img src={order.customerPhoto} alt="Foto del cliente" className="mt-3 h-32 w-full rounded-2xl object-cover" /> : null}
      </div>
      {canWeigh ? (
        <section className="space-y-3">
          <h3 className="font-display text-2xl">Lo que llegó</h3>
          <div className="space-y-2">
            <Label htmlFor="kilos">Peso en báscula (kg)</Label>
            <Input id="kilos" inputMode="decimal" value={kg} onChange={(event) => setKg(event.target.value)} />
          </div>
          {GARMENTS.map((item) => (
            <Counter
              key={item.id}
              label={item.label}
              value={counts[item.id] ?? 0}
              onChange={(value) => setCounts((current) => ({ ...current, [item.id]: value }))}
            />
          ))}
          <div className="flex gap-2">
            <label className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-2xl border border-border bg-white text-sm font-semibold">
              Foto de la ropa
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    const url = await fileToDataUrl(file);
                    setPhotos((current) => [...current, url].slice(0, 4));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "No pudimos usar esa foto.");
                  }
                }}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPhotos((current) => [...current, samplePhoto(order.code, `${kg || "0"} kg`)].slice(0, 4))}
            >
              Ejemplo
            </Button>
          </div>
          {photos.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((photo, index) => (
                <button key={photo.slice(0, 24) + index} type="button" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))} className="relative">
                  <img src={photo} alt={`Foto ${index + 1}, toca para quitar`} className="h-24 w-24 rounded-2xl object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          <PriceCard price={preview} title="Así lo verá el cliente" />
          <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => void saveIntake()}>
            Registrar peso, conteo y fotos
          </Button>
        </section>
      ) : order.finalPrice ? (
        <div className="space-y-3">
          <div className="rounded-3xl bg-secondary p-4">
            <p className="text-sm font-semibold">Recibido: {order.actualKg?.toFixed(1)} kg</p>
            <GarmentLine items={order.receivedGarments ?? []} />
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {order.laundryPhotos.map((photo, index) => (
                <img key={index} src={photo} alt={`Recibido ${index + 1}`} className="h-24 w-24 rounded-2xl object-cover" />
              ))}
            </div>
          </div>
          <PriceCard price={order.finalPrice} title="Total del pedido" />
        </div>
      ) : null}
      {order.status === "pesado" && !order.customerAccepted ? (
        <p className="rounded-2xl bg-cream px-3 py-2 text-sm">Esperando a que {order.customerName.split(" ")[0]} acepte la cantidad y el precio.</p>
      ) : null}
      {order.status === "pesado" && order.customerAccepted ? (
        <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => void advance("lavando")}>
          Empezar lavado
        </Button>
      ) : null}
      {order.status === "lavando" ? (
        <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => void advance("listo")}>
          Marcar ropa lista
        </Button>
      ) : null}
      {order.status === "listo" ? (
        <p className="rounded-2xl bg-secondary px-3 py-2 text-sm">Lista. El recolector ya puede iniciar la entrega.</p>
      ) : null}
    </div>
  );
}

function RatesForm({ rates }: { rates: Rates }) {
  const [form, setForm] = useState(rates);
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(rates), [JSON.stringify(rates)]);

  function setNumber(key: keyof Omit<Rates, "itemRates">, value: string) {
    setForm((current) => ({ ...current, [key]: value === "" ? 0 : Number(value) }));
  }

  async function save() {
    setBusy(true);
    try {
      await api("/api/rates", { rates: form });
      toast.success("Tarifas guardadas. Los pedidos nuevos ya las usan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8">
      <div>
        <h1 className="font-display text-4xl leading-none">Tarifas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El lavado normal arranca en $12.00 por kg. Planchado y lavado en seco traen valores de ejemplo. Recolección y entrega se cobran por kilómetro, cada tramo por separado.
        </p>
      </div>
      <RateField id="normal" label="Lavado normal por kg (MXN)" help="Tarifa base. En la demo es 12." value={form.lavadoNormalPerKg} onChange={(value) => setNumber("lavadoNormalPerKg", value)} />
      <RateField id="seco" label="Lavado en seco por kg (MXN)" help="Ejemplo. Sustituye al lavado normal cuando el cliente lo elige." value={form.lavadoEnSecoPerKg} onChange={(value) => setNumber("lavadoEnSecoPerKg", value)} />
      <RateField id="plancha" label="Planchado por kg (MXN)" help="Ejemplo. Se suma al servicio principal." value={form.planchadoPerKg} onChange={(value) => setNumber("planchadoPerKg", value)} />
      <RateField id="reco" label="Recolección por km (MXN)" help="De la casa del cliente a este taller." value={form.recoleccionPerKm} onChange={(value) => setNumber("recoleccionPerKm", value)} />
      <RateField id="entrega" label="Entrega por km (MXN)" help="Del taller de regreso a la casa del cliente." value={form.entregaPerKm} onChange={(value) => setNumber("entregaPerKm", value)} />
      <details className="rounded-3xl bg-white p-4">
        <summary className="cursor-pointer font-semibold">Extras por prenda (opcional)</summary>
        <p className="mt-2 text-xs text-muted-foreground">Si dejas 0, esa prenda solo se cuenta y el cobro sigue por kilo.</p>
        <div className="mt-3 space-y-3">
          {GARMENTS.map((item) => (
            <RateField
              key={item.id}
              id={item.id}
              label={`${item.label} (MXN c/u)`}
              value={form.itemRates[item.id] ?? 0}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  itemRates: { ...current.itemRates, [item.id]: value === "" ? 0 : Number(value) },
                }))
              }
            />
          ))}
        </div>
      </details>
      <p className="text-xs text-muted-foreground">Un pedido ya creado conserva las tarifas con las que se pidió. Esto afecta a los siguientes.</p>
      <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => void save()}>
        Guardar tarifas
      </Button>
    </div>
  );
}

function RateField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="decimal" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(event.target.value)} />
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function Promos({
  coupons,
  banners,
}: {
  coupons: Coupon[];
  banners: { id: string; title: string; body: string; code: string | null; active: boolean }[];
}) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("15");
  const [limit, setLimit] = useState("50");
  const [expires, setExpires] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [bannerCode, setBannerCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveCoupon() {
    setBusy(true);
    try {
      await api("/api/promos", {
        kind: "coupon",
        coupon: {
          code,
          type,
          value: Number(value),
          description,
          expiresAt: expires ? new Date(expires).toISOString() : null,
          usageLimit: limit ? Number(limit) : null,
          active: true,
        },
      });
      setCode("");
      setDescription("");
      toast.success("Cupón listo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar el cupón.");
    } finally {
      setBusy(false);
    }
  }

  async function saveBanner() {
    setBusy(true);
    try {
      await api("/api/promos", { kind: "banner", title, body, code: bannerCode, active: true });
      setTitle("");
      setBody("");
      setBannerCode("");
      toast.success("Anuncio publicado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos publicar el anuncio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8">
      <div>
        <h1 className="font-display text-4xl leading-none">Promos</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cupones de porcentaje o pesos, con vencimiento y límite de usos. Los anuncios salen en el inicio del cliente.</p>
      </div>
      <section className="space-y-2">
        {coupons.map((coupon) => (
          <article key={coupon.code} className="rounded-3xl bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">{coupon.code}</p>
              <button
                type="button"
                className="text-sm font-semibold text-leaf"
                onClick={() => void api("/api/promos", { kind: "coupon_toggle", code: coupon.code, active: !coupon.active })}
              >
                {coupon.active ? "Apagar" : "Activar"}
              </button>
            </div>
            <p className="text-sm">{coupon.description}</p>
            <p className="text-xs text-muted-foreground">
              {coupon.type === "percent" ? `${coupon.value}%` : `$${coupon.value} MXN`} · usados {coupon.usedCount}
              {coupon.usageLimit != null ? ` de ${coupon.usageLimit}` : ""} · {coupon.active ? "activo" : "apagado"}
            </p>
          </article>
        ))}
      </section>
      <section className="space-y-2 rounded-3xl bg-white p-4">
        <h2 className="font-display text-2xl">Nuevo cupón</h2>
        <Label htmlFor="codigo">Código</Label>
        <Input id="codigo" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="VERANO10" />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={cn("rounded-2xl border px-3 py-3 text-sm font-bold", type === "percent" ? "border-leaf bg-secondary" : "border-border")} onClick={() => setType("percent")}>Porcentaje</button>
          <button type="button" className={cn("rounded-2xl border px-3 py-3 text-sm font-bold", type === "fixed" ? "border-leaf bg-secondary" : "border-border")} onClick={() => setType("fixed")}>Pesos MXN</button>
        </div>
        <Label htmlFor="valor">Valor</Label>
        <Input id="valor" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
        <Label htmlFor="limite">Límite de usos (vacío = sin límite)</Label>
        <Input id="limite" inputMode="numeric" value={limit} onChange={(event) => setLimit(event.target.value)} />
        <Label htmlFor="vence">Vence (opcional)</Label>
        <Input id="vence" type="date" value={expires} onChange={(event) => setExpires(event.target.value)} />
        <Label htmlFor="desc">Descripción</Label>
        <Input id="desc" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="10% entre semana" />
        <Button type="button" disabled={busy} onClick={() => void saveCoupon()}>Crear cupón</Button>
      </section>
      <section className="space-y-2">
        {banners.map((banner) => (
          <article key={banner.id} className="rounded-3xl bg-ink p-4 text-white">
            <p className="font-display text-2xl">{banner.title}</p>
            <p className="text-sm text-white/80">{banner.body}</p>
            <button type="button" className="mt-2 text-sm font-semibold text-mango" onClick={() => void api("/api/promos", { kind: "banner_delete", id: banner.id })}>
              Quitar anuncio
            </button>
          </article>
        ))}
      </section>
      <section className="space-y-2 rounded-3xl bg-white p-4">
        <h2 className="font-display text-2xl">Anuncio</h2>
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Label htmlFor="texto">Texto</Label>
        <Textarea id="texto" value={body} onChange={(event) => setBody(event.target.value)} />
        <Label htmlFor="codigobanner">Código que sugiere (opcional)</Label>
        <Input id="codigobanner" value={bannerCode} onChange={(event) => setBannerCode(event.target.value.toUpperCase())} />
        <Button type="button" disabled={busy} onClick={() => void saveBanner()}>Publicar anuncio</Button>
      </section>
    </div>
  );
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
