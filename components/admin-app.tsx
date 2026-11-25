"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/components/api";
import { Shell } from "@/components/shell";
import { useLavaya, type ApplicationCard } from "@/components/use-lavaya";
import { Button } from "@/components/ui/button";

export function AdminApp() {
  const { data, error, reload } = useLavaya("admin");
  const [busy, setBusy] = useState<string | null>(null);

  if (error) return <Plain title="No cargó LavaYa" body={error} />;
  if (!data || data.me.role !== "admin") return <Plain title="Abriendo administración…" body="Un momento." />;

  const cards = data.applications ?? [];
  const pending = cards.filter((item) => item.status === "pendiente");
  const rest = cards.filter((item) => item.status !== "pendiente");

  async function decide(userId: string, decision: "aprobar" | "rechazar" | "suspender") {
    setBusy(`${userId}:${decision}`);
    try {
      await api("/api/admin/review", { userId, decision });
      toast.success(decision === "aprobar" ? "Cuenta aprobada." : decision === "suspender" ? "Cuenta suspendida." : "Cuenta rechazada.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar la decisión.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell data={data}>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2 pb-8">
        <div>
          <p className="text-sm text-muted-foreground">Administración</p>
          <h1 className="font-display text-4xl leading-none">Aprobaciones</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Las lavanderías y los recolectores nuevos empiezan en pendiente. Los clientes entran solos.
          </p>
        </div>
        {pending.length === 0 ? <p className="rounded-3xl bg-white p-4 text-sm">No hay solicitudes pendientes.</p> : null}
        {pending.map((item) => (
          <Card key={item.id} item={item} busy={busy} onDecide={decide} />
        ))}
        {rest.length > 0 ? <h2 className="font-display text-2xl">Ya revisadas</h2> : null}
        {rest.map((item) => (
          <Card key={item.id} item={item} busy={busy} onDecide={decide} />
        ))}
      </div>
    </Shell>
  );
}

function Card({
  item,
  busy,
  onDecide,
}: {
  item: ApplicationCard;
  busy: string | null;
  onDecide: (userId: string, decision: "aprobar" | "rechazar" | "suspender") => void;
}) {
  return (
    <article className="space-y-3 rounded-3xl bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-leaf">{item.role === "lavanderia" ? "Lavandería" : "Recolector"}</p>
          <h2 className="font-display text-2xl leading-none">{item.shop?.name ?? item.name}</h2>
          <p className="text-sm text-muted-foreground">{item.email} · {item.phone}</p>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold">{label(item.status)}</span>
      </div>
      {item.shop ? (
        <p className="text-sm">
          {item.shop.address}
          <br />
          {item.shop.hours}
          {item.shop.hasCustomRates ? " · tarifas propias" : " · tarifas de la plataforma"}
        </p>
      ) : null}
      {item.plate ? <p className="text-sm">Placa {item.plate}</p> : null}
      {item.idPhoto ? <img src={item.idPhoto} alt="Identificación del recolector" className="h-36 w-full rounded-2xl object-cover" /> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={Boolean(busy)} onClick={() => onDecide(item.id, "aprobar")}>
          Aprobar
        </Button>
        <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => onDecide(item.id, "rechazar")}>
          Rechazar
        </Button>
        <Button type="button" variant="danger" disabled={Boolean(busy)} onClick={() => onDecide(item.id, "suspender")}>
          Suspender
        </Button>
      </div>
    </article>
  );
}

function label(status: ApplicationCard["status"]) {
  if (status === "activo") return "Aprobada";
  if (status === "pendiente") return "Pendiente";
  if (status === "suspendido") return "Suspendida";
  return "Rechazada";
}

function Plain({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="font-display text-4xl">{title}</h1>
        <p className="mt-2 text-muted-foreground">{body}</p>
      </div>
    </main>
  );
}
