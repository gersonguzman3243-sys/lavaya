import { NextResponse } from "next/server";
import { registerAccount, type RegisterInput } from "@/lib/accounts";
import { fail, setSession } from "@/lib/http";
import { publicUser, sanitizeRates } from "@/lib/orders";
import { initDb } from "@/lib/store";
import type { Rates } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = (await request.json()) as RegisterInput & { rates?: Rates | null };
    const rates = body.rates ? sanitizeRates(body.rates) : null;
    const user = registerAccount({ ...body, rates });
    await setSession(user.id, request);
    return NextResponse.json({ user: publicUser(user) });
  } catch (error) {
    return fail(error);
  }
}
