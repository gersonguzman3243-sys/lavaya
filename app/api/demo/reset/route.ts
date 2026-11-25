import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { resetDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    resetDb();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
