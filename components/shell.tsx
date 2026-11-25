"use client";

import { useState } from "react";
import { Bell, LogOut } from "lucide-react";
import { toast } from "sonner";
import { api, enableAlerts } from "@/components/api";
import { Wordmark } from "@/components/logo";
import { PhoneFrame } from "@/components/widgets";
import type { Bootstrap } from "@/components/use-lavaya";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Shell({
  data,
  children,
  onOpenOrder,
}: {
  data: Bootstrap;
  children: React.ReactNode;
  onOpenOrder?: (orderId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const unread = data.notifications.filter((note) => !note.read).length;

  async function logout() {
    await api("/api/auth/logout", {});
    window.location.href = "/";
  }

  async function openBell() {
    setOpen(true);
    if (unread) {
      try {
        await api("/api/notifications", { all: true });
      } catch {
        /* el listado igual se puede leer */
      }
    }
  }

  return (
    <PhoneFrame>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-white/90 px-4 py-3 backdrop-blur">
        <Wordmark size="sm" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={unread ? `Avisos, ${unread} sin leer` : "Avisos"}
            onClick={() => void openBell()}
            className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-secondary"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 ? (
              <span className="absolute top-1 right-1 grid h-5 min-w-5 place-items-center rounded-full bg-mango px-1 text-[11px] font-bold text-ink">
                {unread}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            aria-label="Salir"
            onClick={() => void logout()}
            className="grid h-11 w-11 place-items-center rounded-full hover:bg-secondary"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {open ? (
        <div className="absolute inset-0 z-[1300] flex flex-col bg-white md:rounded-[2rem]">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="font-display text-3xl">Avisos</h2>
            <button type="button" className="text-sm font-semibold text-leaf" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-6">
            <button
              type="button"
              className="mb-3 w-full rounded-2xl bg-secondary px-4 py-3 text-left text-sm font-semibold text-ink"
              onClick={async () => {
                const ok = await enableAlerts();
                toast(ok ? "Listo, te avisamos en este aparato" : "Puedes seguir viendo los avisos aquí dentro");
              }}
            >
              Activar alertas del aparato
              <span className="mt-1 block font-normal text-muted-foreground">
                Sobre todo cuando tu ropa esté lista. Si el navegador o el teléfono lo permiten, también salen fuera de la app.
              </span>
            </button>
            {data.notifications.length === 0 ? (
              <p className="rounded-3xl bg-foam px-4 py-8 text-center text-sm text-muted-foreground">
                Aquí van los cambios de tu pedido. Todavía no hay avisos.
              </p>
            ) : (
              data.notifications.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => {
                    if (note.orderId && onOpenOrder) onOpenOrder(note.orderId);
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full rounded-3xl px-4 py-3 text-left",
                    note.important ? "bg-cream" : "bg-foam",
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink">{note.title}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(note.createdAt)}</span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{note.body}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </PhoneFrame>
  );
}
