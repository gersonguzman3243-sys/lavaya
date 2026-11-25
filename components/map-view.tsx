"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  kind: "home" | "shop" | "moto" | "drop";
  glyph: string;
  label?: string;
}

interface MapViewProps {
  pins: MapPin[];
  route?: Array<[number, number]>;
  fitKey?: string;
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}

export function MapView({ pins, route = [], fitKey = "map", onPick, className }: MapViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    const map = L.map(host.current, { zoomControl: false, attributionControl: false }).setView(
      [19.42, -99.16],
      13,
    );
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomleft" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    groupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const timer = window.setTimeout(() => map.invalidateSize(), 180);
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (route.length > 1) {
      L.polyline(route, { color: "#0e8f6e", weight: 5, opacity: 0.9 }).addTo(group);
    }
    for (const pin of pins) {
      const icon = L.divIcon({
        className: "lavaya-divicon",
        html: `<div class="lavaya-pin ${pin.kind}">${pin.glyph}</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const marker = L.marker([pin.lat, pin.lng], { icon, keyboard: false });
      if (pin.label) marker.bindPopup(pin.label);
      marker.addTo(group);
    }
  }, [pins, route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points: L.LatLng[] = pins.map((pin) => L.latLng(pin.lat, pin.lng));
    if (points.length === 1) map.setView(points[0], 16, { animate: false });
    else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 16, animate: false });
    }
    map.invalidateSize();
  }, [fitKey, pins.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onPick) return;
    const handler = (event: L.LeafletMouseEvent) => {
      pickRef.current?.(event.latlng.lat, event.latlng.lng);
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [onPick]);

  return <div ref={host} className={className ?? "h-64 w-full"} />;
}
