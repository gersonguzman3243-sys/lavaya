import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AppError } from "./orders";
import { readDb } from "./store";
import type { User } from "./types";

const COOKIE = "lavaya_session";

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  return readDb().users.find((user) => user.id === id) ?? null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError("Inicia sesión para continuar.", 401);
  return user;
}

export function fail(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Algo salió mal. Intenta de nuevo." }, { status: 500 });
}

export async function setSession(userId: string, request?: Request) {
  const forwarded = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const jar = await cookies();
  jar.set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: forwarded === "https",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
