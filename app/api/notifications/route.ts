import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { markNotificationsRead } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { all?: boolean; ids?: string[] };
    markNotificationsRead(user, body.all ? "all" : (body.ids ?? []));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
