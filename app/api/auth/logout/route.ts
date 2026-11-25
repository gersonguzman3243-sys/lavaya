import { NextResponse } from "next/server";
import { clearSession, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
