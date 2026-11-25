import { NextResponse } from "next/server";
import { reviewAccount } from "@/lib/accounts";
import { fail, requireUser } from "@/lib/http";
import { publicUser } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { userId?: string; decision?: "aprobar" | "rechazar" | "suspender" };
    const updated = reviewAccount(user, {
      userId: body.userId ?? "",
      decision: body.decision ?? "aprobar",
    });
    return NextResponse.json({ user: publicUser(updated) });
  } catch (error) {
    return fail(error);
  }
}
