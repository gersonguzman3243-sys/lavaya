import fs from "fs";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/http";
import { resolveUpload } from "@/lib/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  }
  const { name } = await context.params;
  const upload = resolveUpload(name);
  if (!upload) return NextResponse.json({ error: "No encontramos esa foto." }, { status: 404 });
  const body = fs.readFileSync(upload.file);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": upload.type,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
