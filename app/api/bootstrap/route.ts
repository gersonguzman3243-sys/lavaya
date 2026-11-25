import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { publicUser, visibleOrders } from "@/lib/orders";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const db = readDb();
    return NextResponse.json({
      me: publicUser(user),
      people: db.users.map(publicUser),
      orders: visibleOrders(user, db.orders),
      rates: db.rates,
      laundry: db.laundry,
      notifications: db.notifications.filter((note) => note.userId === user.id).slice(0, 40),
      banners: db.banners.filter((banner) => banner.active || user.role === "lavanderia"),
      coupons: user.role === "lavanderia" ? db.coupons : null,
    });
  } catch (error) {
    return fail(error);
  }
}
