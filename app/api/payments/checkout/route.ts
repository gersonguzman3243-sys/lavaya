import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { choosePayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { orderId?: string; method?: "efectivo" | "mercadopago" };
    if (body.method !== "efectivo" && body.method !== "mercadopago") {
      return NextResponse.json({ error: "Elige efectivo o Mercado Pago." }, { status: 400 });
    }
    const result = await choosePayment(user, body.orderId ?? "", body.method, request);
    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}
