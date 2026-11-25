import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { quoteOrder, type OrderDraft } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = (await request.json()) as OrderDraft;
    const quote = await quoteOrder(body);
    return NextResponse.json(quote);
  } catch (error) {
    return fail(error);
  }
}
