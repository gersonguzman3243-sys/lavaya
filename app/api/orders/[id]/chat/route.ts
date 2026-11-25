import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { markChatRead, sendChat } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = (await request.json()) as { text?: string; read?: boolean };
    const order = body.read ? markChatRead(user, id) : sendChat(user, id, body.text ?? "");
    return NextResponse.json({ order });
  } catch (error) {
    return fail(error);
  }
}
