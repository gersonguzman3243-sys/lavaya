"use client";

import dynamic from "next/dynamic";
import type { MapPin } from "@/components/map-view";

export type { MapPin };

const Inner = dynamic(() => import("@/components/map-view").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-48 w-full place-items-center bg-[#d7ebe3] text-sm text-[#5c6f67]">
      Cargando mapa…
    </div>
  ),
});

export function MapView(props: {
  pins: MapPin[];
  route?: Array<[number, number]>;
  fitKey?: string;
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}) {
  return (
    <div className={props.className}>
      <Inner {...props} className="h-full w-full" />
    </div>
  );
}
