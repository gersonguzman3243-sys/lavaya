export async function fileToDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Elige una imagen.");
  }
  const bitmap = await createImageBitmap(file);
  const max = 1100;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No pudimos leer esa foto.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function samplePhoto(title: string, subtitle: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const wash = context.createLinearGradient(0, 0, 960, 720);
  wash.addColorStop(0, "#e5f6ee");
  wash.addColorStop(1, "#fff1e6");
  context.fillStyle = wash;
  context.fillRect(0, 0, 960, 720);
  round(context, 250, 140, 460, 400, 40);
  context.fillStyle = "#0e8f6e";
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "700 64px sans-serif";
  context.fillText("LavaYa", 360, 310);
  context.font = "500 28px sans-serif";
  context.fillText(clip(title, 22), 300, 370);
  context.fillStyle = "#14382e";
  context.font = "600 30px sans-serif";
  context.fillText(clip(subtitle, 36), 180, 620);
  context.fillStyle = "#ff7a1a";
  context.beginPath();
  context.arc(650, 210, 28, 0, Math.PI * 2);
  context.fill();
  return canvas.toDataURL("image/jpeg", 0.82);
}

function clip(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function round(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
