import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const mark = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="8" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1ec99a"/>
      <stop offset="0.55" stop-color="#0e8f6e"/>
      <stop offset="1" stop-color="#075844"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="18" fill="url(#g)"/>
  <path d="M32 10c7.2 9.2 16 18.2 16 28.2A16 16 0 1 1 16 38.2C16 28.2 24.8 19.2 32 10z" fill="white"/>
  <circle cx="24.5" cy="44" r="4.2" fill="none" stroke="#12382e" stroke-width="2.4"/>
  <circle cx="39.5" cy="44" r="4.2" fill="none" stroke="#12382e" stroke-width="2.4"/>
  <path d="M24.5 44h6.2l4.4-6.2h6.2" fill="none" stroke="#12382e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="43" cy="22" r="4" fill="#ff7a1a"/>
</svg>`;

const splash = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#0e8f6e"/>
  <g transform="translate(1106 980) scale(8)">
    <rect width="64" height="64" rx="18" fill="white"/>
    <path d="M32 10c7.2 9.2 16 18.2 16 28.2A16 16 0 1 1 16 38.2C16 28.2 24.8 19.2 32 10z" fill="#0e8f6e"/>
    <circle cx="24.5" cy="44" r="4.2" fill="none" stroke="#12382e" stroke-width="2.4"/>
    <circle cx="39.5" cy="44" r="4.2" fill="none" stroke="#12382e" stroke-width="2.4"/>
    <path d="M24.5 44h6.2l4.4-6.2h6.2" fill="none" stroke="#12382e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="43" cy="22" r="4" fill="#ff7a1a"/>
  </g>
  <text x="1366" y="1680" text-anchor="middle" font-family="Georgia, serif" font-size="180" fill="white">LavaYa</text>
  <text x="1366" y="1800" text-anchor="middle" font-family="sans-serif" font-size="64" fill="#d8f5ea">Tu ropa, recogida en moto</text>
</svg>`;

await mkdir("public/icons", { recursive: true });
await mkdir("assets", { recursive: true });
await mkdir("mobile/www", { recursive: true });

const icon = sharp(Buffer.from(mark));
await icon.clone().resize(192, 192).png().toFile("public/icons/icon-192.png");
await icon.clone().resize(512, 512).png().toFile("public/icons/icon-512.png");
await icon.clone().resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
await icon.clone().resize(1024, 1024).png().toFile("assets/icon.png");
await icon.clone().resize(512, 512).png().toFile("app/icon.png");
await sharp(Buffer.from(splash)).png().toFile("assets/splash.png");
await writeFile("assets/icon.svg", mark);

console.log("iconos listos");
