import { NextResponse } from "next/server";
import { startTicker } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  startTicker();
  return NextResponse.json({ ok: true, service: "lavaya" });
}
