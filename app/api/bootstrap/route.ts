import { NextResponse } from "next/server";
import { listApplications } from "@/lib/accounts";
import { fail, requireUser } from "@/lib/http";
import { publicUser, visibleOrders } from "@/lib/orders";
import { mercadoPagoConfigured } from "@/lib/payments";
import { effectiveRates, laundryOf } from "@/lib/shops";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const db = readDb();
    const ownShop = laundryOf(db, user.laundryId);
    const rates = user.role === "lavanderia" ? effectiveRates(db, ownShop ?? undefined) : db.rates;
    const laundry = ownShop
      ? { name: ownShop.name, address: ownShop.address, lat: ownShop.lat, lng: ownShop.lng, phone: ownShop.phone }
      : db.laundry;
    return NextResponse.json({
      me: publicUser(user),
      people: db.users.map(publicUser),
      orders: visibleOrders(user, db.orders),
      rates,
      laundry,
      laundries: db.laundries.filter((shop) => shop.status === "activo").map((shop) => ({
        id: shop.id,
        name: shop.name,
        address: shop.address,
        lat: shop.lat,
        lng: shop.lng,
        phone: shop.phone,
        hours: shop.hours,
      })),
      notifications: db.notifications.filter((note) => note.userId === user.id).slice(0, 40),
      banners: db.banners.filter((banner) => banner.active || user.role === "lavanderia"),
      coupons: user.role === "lavanderia" ? db.coupons : null,
      payments: {
        mercadoPago: mercadoPagoConfigured(),
        publicKey: process.env.MP_PUBLIC_KEY?.trim() || null,
      },
      applications: user.role === "admin" ? listApplications() : null,
    });
  } catch (error) {
    return fail(error);
  }
}
