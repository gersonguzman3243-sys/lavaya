import { NextResponse } from "next/server";
import { fail, setSession } from "@/lib/http";
import { AppError, publicUser } from "@/lib/orders";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const user = readDb().users.find((item) => item.email === email && item.password === password);
    if (!user) throw new AppError("Ese correo o la contraseña no coinciden.", 401);
    await setSession(user.id, request);
    return NextResponse.json({ user: publicUser(user) });
  } catch (error) {
    return fail(error);
  }
}
