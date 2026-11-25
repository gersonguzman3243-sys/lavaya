import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { deleteBanner, saveBanner, saveCoupon, setCouponActive } from "@/lib/orders";
import type { Coupon } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      kind?: string;
      coupon?: Omit<Coupon, "usedCount">;
      code?: string;
      active?: boolean;
      id?: string;
      title?: string;
      body?: string;
    };
    if (body.kind === "coupon" && body.coupon) {
      return NextResponse.json({ coupon: saveCoupon(user, body.coupon) });
    }
    if (body.kind === "coupon_toggle" && body.code) {
      return NextResponse.json({ coupon: setCouponActive(user, body.code, Boolean(body.active)) });
    }
    if (body.kind === "banner") {
      return NextResponse.json({
        banner: saveBanner(user, {
          id: body.id,
          title: body.title ?? "",
          body: body.body ?? "",
          code: body.code,
          active: body.active,
        }),
      });
    }
    if (body.kind === "banner_delete" && body.id) {
      deleteBanner(user, body.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "No reconocemos esa promoción." }, { status: 400 });
  } catch (error) {
    return fail(error);
  }
}
