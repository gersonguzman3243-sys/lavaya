import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LavaYa",
    short_name: "LavaYa",
    description: "Recolección de ropa en moto en la Ciudad de México.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0E8F6E",
    theme_color: "#0E8F6E",
    lang: "es-MX",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
