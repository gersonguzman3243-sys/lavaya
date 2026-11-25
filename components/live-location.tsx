"use client";

import { useEffect, useRef } from "react";
import { api } from "@/components/api";

/** Comparte la ubicación del recolector. Si el permiso se niega, el servidor vuelve al recorrido simulado. */
export function LiveLocation({ enabled }: { enabled: boolean }) {
  const last = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let stop = () => {};
    let closed = false;

    async function send(lat: number, lng: number) {
      const now = Date.now();
      if (now - last.current < 2000) return;
      last.current = now;
      try {
        await api("/api/courier/location", { lat, lng });
      } catch {
        /* el siguiente punto lo reintenta */
      }
    }

    async function start() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { Geolocation } = await import("@capacitor/geolocation");
          const perm = await Geolocation.requestPermissions();
          const coarse = (perm as { coarseLocation?: string }).coarseLocation;
          if (perm.location !== "granted" && coarse !== "granted") {
            throw new Error("denied");
          }
          const id = await Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
            if (closed || err || !pos) return;
            void send(pos.coords.latitude, pos.coords.longitude);
          });
          stop = () => {
            void Geolocation.clearWatch({ id });
          };
          return;
        }
      } catch {
        /* navegador o permiso negado en el APK */
      }
      if (closed || !navigator.geolocation) {
        void api("/api/courier/location", { denied: true }).catch(() => undefined);
        return;
      }
      const watch = navigator.geolocation.watchPosition(
        (pos) => void send(pos.coords.latitude, pos.coords.longitude),
        () => {
          void api("/api/courier/location", { denied: true }).catch(() => undefined);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 },
      );
      stop = () => navigator.geolocation.clearWatch(watch);
    }

    void start();
    return () => {
      closed = true;
      stop();
    };
  }, [enabled]);

  return null;
}
