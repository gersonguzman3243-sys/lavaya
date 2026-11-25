import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import {
  acceptJob,
  acceptPrice,
  advanceOrder,
  cancelOrder,
  deliverJob,
  dropoffJob,
  intakeOrder,
  pickupJob,
  rateOrder,
  startDelivery,
} from "@/lib/orders";
import type { GarmentCount } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = (await request.json()) as {
      type?: string;
      kg?: number;
      garments?: GarmentCount[];
      photos?: string[];
      to?: "lavando" | "listo";
      stars?: number;
      comment?: string;
    };

    let order;
    switch (body.type) {
      case "accept":
        order = await acceptJob(user, id);
        break;
      case "pickup":
        order = await pickupJob(user, id);
        break;
      case "dropoff":
        order = await dropoffJob(user, id);
        break;
      case "start_delivery":
        order = await startDelivery(user, id);
        break;
      case "deliver":
        order = deliverJob(user, id);
        break;
      case "cancel":
        order = cancelOrder(user, id);
        break;
      case "accept_price":
        order = acceptPrice(user, id);
        break;
      case "intake":
        order = intakeOrder(user, id, {
          kg: Number(body.kg),
          garments: body.garments ?? [],
          photos: body.photos ?? [],
        });
        break;
      case "advance":
        if (body.to !== "lavando" && body.to !== "listo") {
          return NextResponse.json({ error: "Ese paso no existe." }, { status: 400 });
        }
        order = advanceOrder(user, id, body.to);
        break;
      case "rate":
        order = rateOrder(user, id, Number(body.stars), body.comment ?? "");
        break;
      default:
        return NextResponse.json({ error: "No reconocemos esa acción." }, { status: 400 });
    }
    return NextResponse.json({ order });
  } catch (error) {
    return fail(error);
  }
}
