import fs from "fs";
import path from "path";
import { uploadsDir } from "./store";

const MEDIA_PATH = /^\/api\/media\/([A-Za-z0-9._-]+)$/;

/** Guarda una foto de la ropa en el directorio de uploads y devuelve una ruta relativa. */
export function persistPhoto(value: string) {
  const existing = MEDIA_PATH.exec(value);
  if (existing) return value;
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
  if (!match) {
    throw new Error("La foto tiene que ser una imagen.");
  }
  const mime = match[1].toLowerCase();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const name = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dir = uploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), Buffer.from(match[2], "base64"));
  return `/api/media/${name}`;
}

export function resolveUpload(name: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null;
  const file = path.resolve(uploadsDir(), name);
  const root = path.resolve(uploadsDir());
  if (!file.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(file)) return null;
  const ext = path.extname(file).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { file, type };
}
