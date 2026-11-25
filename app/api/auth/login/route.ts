import { NextResponse } from "next/server";
import { fail, setSession } from "@/lib/http";
import { AppError, publicUser } from "@/lib/orders";
import { initDb, readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const user = readDb().users.find((item) => item.email === email && item.password === password);
    if (!user) throw new AppError("Ese correo o la contraseña no coinciden.", 401);
    if (user.status === "suspendido") {
      throw new AppError("Tu cuenta está suspendida. Escribe a administración.", 403);
    }
    if (user.status === "rechazado") {
      throw new AppError("No aprobamos esta cuenta. Puedes registrarte de nuevo con otro correo.", 403);
    }
    await setSession(user.id, request);
    return NextResponse.json({ user: publicUser(user) });
  } catch (error) {
    return fail(error);
  }
}
