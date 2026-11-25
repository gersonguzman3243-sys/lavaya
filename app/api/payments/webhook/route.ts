import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { handlePaymentNotification, paymentIdFromWebhook } from "@/lib/payments";
import { initDb } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function receive(request: Request) {
  await initDb();
  const body = request.method === "POST" ? await request.json().catch(() => null) : null;
  const id = paymentIdFromWebhook(request.url, body);
  if (!id) return NextResponse.json({ ok: true, ignored: true });
  const order = await handlePaymentNotification(id);
  return NextResponse.json({ ok: true, orderId: order.id, paymentStatus: order.paymentStatus });
}

export async function POST(request: Request) {
  try {
    return await receive(request);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "No pudimos verificar el pago." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    return await receive(request);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "No pudimos verificar el pago." }, { status: 500 });
  }
}
