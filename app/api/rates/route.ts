import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { saveRates } from "@/lib/orders";
import type { Rates } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { rates: Rates };
    const rates = saveRates(user, body.rates);
    return NextResponse.json({ rates });
  } catch (error) {
    return fail(error);
  }
}
