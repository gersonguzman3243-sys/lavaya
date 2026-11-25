"use client";

import { GARMENTS, STATUS_FLOW, garmentLabel, statusLabel } from "@/lib/catalog";
import { mxn } from "@/lib/format";
import { distanceNote } from "@/lib/pricing";
import type { GarmentCount, Order, OrderStatus, PriceBreakdown } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Minus, Plus, Star } from "lucide-react";

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-foam md:my-4 md:h-[calc(100dvh-2rem)] md:rounded-[2rem] md:border md:border-white/80 md:bg-white md:shadow-[0_30px_80px_rgba(16,40,32,0.16)]">
      {children}
    </div>
  );
}

export function PriceCard({
  price,
  title,
  caption,
}: {
  price: PriceBreakdown;
  title?: string;
  caption?: string;
}) {
  return (
    <section className="rounded-3xl bg-cream p-4">
      {title ? <h3 className="mb-3 font-display text-xl text-ink">{title}</h3> : null}
      <ul className="space-y-2.5">
        {price.lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 text-sm">
            <span>
              <span className="block font-semibold text-ink">{line.label}</span>
              <span className="text-muted-foreground">{line.detail}</span>
            </span>
            <span className="font-semibold tabular-nums text-ink">{mxn(line.amount)}</span>
          </li>
        ))}
      </ul>
      {price.discount > 0 ? (
        <div className="mt-3 flex items-start justify-between gap-3 border-t border-dashed border-[#efd7c4] pt-3 text-sm">
          <span>
            <span className="block font-semibold text-leaf">{price.discountLabel}</span>
            <span className="text-muted-foreground">Subtotal {mxn(price.subtotal)}</span>
          </span>
          <span className="font-semibold text-leaf">−{mxn(price.discount)}</span>
        </div>
      ) : null}
      <div className="mt-3 flex items-end justify-between border-t border-dashed border-[#efd7c4] pt-3">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-right">
          <span className="font-display text-4xl leading-none text-ink">{mxn(price.total)}</span>
          <span className="mt-1 block text-[11px] font-bold tracking-wide text-muted-foreground">MXN</span>
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {distanceNote(price.distanceMethod)} Precios en pesos mexicanos (MXN).
      </p>
      {caption ? <p className="mt-1 text-xs text-muted-foreground">{caption}</p> : null}
    </section>
  );
}

export function StatusRail({ status }: { status: OrderStatus }) {
  if (status === "cancelado") {
    return <p className="rounded-2xl bg-muted px-3 py-2 text-sm">Este pedido se canceló.</p>;
  }
  const current = STATUS_FLOW.indexOf(status);
  return (
    <ol>
      {STATUS_FLOW.map((step, index) => {
        const done = status === "entregado" || index < current;
        const now = status !== "entregado" && index === current;
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full text-xs font-bold",
                  done ? "bg-leaf text-white" : now ? "bg-mango text-ink" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? "✓" : index + 1}
              </span>
              {index < STATUS_FLOW.length - 1 ? <span className="min-h-3 w-px flex-1 bg-border" /> : null}
            </div>
            <p className={cn("pb-3 text-sm", now ? "font-bold text-ink" : "text-muted-foreground")}>
              {statusLabel(step)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-bold text-leaf">
      {statusLabel(status)}
    </span>
  );
}

export function GarmentLine({ items }: { items: GarmentCount[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Sin prendas</p>;
  return (
    <p className="text-sm leading-relaxed text-ink">
      {items.map((item) => `${item.count} ${garmentLabel(item.type).toLowerCase()}`).join(" · ")}
    </p>
  );
}

export function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-white px-3 py-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Quitar ${label}`}
          className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-ink"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-6 text-center font-bold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`Sumar ${label}`}
          className="grid h-9 w-9 place-items-center rounded-full bg-leaf text-white"
          onClick={() => onChange(Math.min(99, value + 1))}
        >
          <Plus className="h-4 w-4" />
        </button>
      </span>
    </div>
  );
}

export function emptyCounts() {
  return Object.fromEntries(GARMENTS.map((item) => [item.id, 0]));
}

export function countsFrom(items: GarmentCount[]) {
  const counts = emptyCounts();
  for (const item of items) counts[item.type] = item.count;
  return counts;
}

export function garmentsFrom(counts: Record<string, number>): GarmentCount[] {
  return GARMENTS.filter((item) => (counts[item.id] ?? 0) > 0).map((item) => ({
    type: item.id,
    count: counts[item.id],
  }));
}

export function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange?: (value: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} estrellas`}
          disabled={!onChange}
          onClick={() => onChange?.(star)}
          className="disabled:cursor-default"
        >
          <Star
            className={cn("h-8 w-8", star <= value ? "fill-mango text-mango" : "text-border")}
          />
        </button>
      ))}
    </div>
  );
}

export function unreadCount(order: Order, userId: string) {
  return order.messages.filter((message) => message.senderId !== userId && !message.readBy.includes(userId))
    .length;
}
