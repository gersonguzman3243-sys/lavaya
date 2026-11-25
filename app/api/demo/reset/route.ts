import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { initDb, resetDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await initDb();
    resetDb();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
