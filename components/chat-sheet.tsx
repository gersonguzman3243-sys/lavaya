"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTime } from "@/lib/format";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChatSheet({
  order,
  userId,
  open,
  onOpenChange,
}: {
  order: Order;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const closed = order.status === "entregado" || order.status === "cancelado" || !order.courierId;

  useEffect(() => {
    if (!open) return;
    end.current?.scrollIntoView({ block: "end" });
    void api(`/api/orders/${order.id}/chat`, { read: true }).catch(() => undefined);
  }, [open, order.id, order.messages.length]);

  async function send() {
    const value = text.trim();
    if (!value) return;
    setSending(true);
    try {
      await api(`/api/orders/${order.id}/chat`, { text: value });
      setText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se envió el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] flex-col">
        <DialogHeader>
          <DialogTitle>Chat del pedido</DialogTitle>
          <DialogDescription>
            {order.courierName
              ? `Conversación de ${order.code} entre el cliente y ${order.courierName}.`
              : "El chat se abre cuando un recolector toma el viaje."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-48 flex-1 space-y-2 overflow-y-auto pr-1">
          {order.messages.length === 0 ? (
            <p className="rounded-2xl bg-foam px-3 py-6 text-center text-sm text-muted-foreground">
              Todavía no hay mensajes. Escribe si necesitas avisar el portón, el piso o un retraso.
            </p>
          ) : (
            order.messages.map((message) => {
              const mine = message.senderId === userId;
              return (
                <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      mine ? "bg-leaf text-white" : "bg-foam text-ink",
                    )}
                  >
                    <p className={cn("text-[11px] font-semibold", mine ? "text-white/80" : "text-leaf")}>
                      {message.senderName}
                    </p>
                    <p>{message.text}</p>
                    <p className={cn("mt-1 text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>
                      {formatTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={end} />
        </div>
        {closed ? (
          <p className="text-center text-xs text-muted-foreground">Este chat ya quedó de solo lectura.</p>
        ) : (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Escribe un mensaje"
              className="h-12 flex-1 rounded-2xl border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-leaf/40"
            />
            <Button type="submit" disabled={sending || !text.trim()}>
              Enviar
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
