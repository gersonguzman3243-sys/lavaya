import { NextResponse } from "next/server";
import { initDb, startTicker } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let db: "json" | "postgres" | "error" = process.env.DATABASE_URL?.trim() ? "postgres" : "json";
  try {
    await initDb();
    startTicker();
  } catch (error) {
    console.error(error);
    db = "error";
  }
  return NextResponse.json({ ok: true, service: "lavaya", db });
}
