import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { reportCourierLocation } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { lat?: number; lng?: number; denied?: boolean };
    const result = reportCourierLocation(user, body);
    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}
