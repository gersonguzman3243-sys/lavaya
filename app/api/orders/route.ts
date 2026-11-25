import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { createOrder, type OrderDraft } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as OrderDraft;
    const order = await createOrder(user, body);
    return NextResponse.json({ order });
  } catch (error) {
    return fail(error);
  }
}
