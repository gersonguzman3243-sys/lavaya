"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { pingDevice } from "@/components/api";
import type {
  AccountStatus,
  AppNotification,
  Banner,
  Coupon,
  LaundryPlace,
  Order,
  PublicUser,
  Rates,
  Role,
} from "@/lib/types";

export interface ShopPin extends LaundryPlace {
  id: string;
  hours: string;
}

export interface ApplicationCard {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  status: AccountStatus;
  plate: string | null;
  idPhoto: string | null;
  liveGps: boolean;
  shop: {
    name: string;
    address: string;
    hours: string;
    lat: number;
    lng: number;
    phone: string;
    hasCustomRates: boolean;
  } | null;
}

export interface Bootstrap {
  me: PublicUser;
  people: PublicUser[];
  orders: Order[];
  rates: Rates;
  laundry: LaundryPlace;
  laundries: ShopPin[];
  notifications: AppNotification[];
  banners: Banner[];
  coupons: Coupon[] | null;
  payments: { mercadoPago: boolean; publicKey: string | null };
  applications: ApplicationCard[] | null;
}

function homeFor(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "recolector") return "/recolector";
  if (role === "lavanderia") return "/lavanderia";
  return "/cliente";
}

export function useLavaya(expected?: Role) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const armed = useRef(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/";
      return;
    }
    if (!response.ok) {
      setError("No pudimos cargar LavaYa. Revisa tu conexión.");
      return;
    }
    setData((await response.json()) as Bootstrap);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    for (const note of data.notifications) {
      if (seen.current.has(note.id)) continue;
      if (armed.current && !note.read) {
        toast(note.title, { description: note.body });
        void pingDevice(note.title, note.body);
      }
      seen.current.add(note.id);
    }
    armed.current = true;
  }, [data]);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as {
          type?: string;
          positions?: Array<{
            id: string;
            lat: number;
            lng: number;
            progress: number;
            etaMinutes?: number | null;
            locationMode?: "gps" | "simulado";
          }>;
        };
        if (message.type === "positions" && message.positions) {
          const positions = message.positions;
          setData((current) => {
            if (!current) return current;
            return {
              ...current,
              orders: current.orders.map((order) => {
                const point = positions.find((item) => item.id === order.id);
                if (!point) return order;
                return {
                  ...order,
                  courierLat: point.lat,
                  courierLng: point.lng,
                  routeProgress: point.progress,
                  etaMinutes: point.etaMinutes ?? order.etaMinutes,
                  locationMode: point.locationMode ?? order.locationMode,
                };
              }),
            };
          });
          return;
        }
        if (message.type === "changed") void load();
      } catch {
        /* evento vacío */
      }
    };
    const poll = window.setInterval(() => void load(), 10000);
    return () => {
      source.close();
      window.clearInterval(poll);
    };
  }, [load]);

  useEffect(() => {
    if (!data || !expected || data.me.role === expected) return;
    window.location.href = homeFor(data.me.role);
  }, [data, expected]);

  return { data, error, reload: load };
}
