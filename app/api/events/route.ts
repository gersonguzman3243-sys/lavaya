import { requireUser } from "@/lib/http";
import { subscribe } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireUser();
  } catch {
    return new Response(JSON.stringify({ error: "Inicia sesión para continuar." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let close = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          close();
        }
      };
      send({ type: "hello" });
      const unsubscribe = subscribe((event) => send(event));
      const ping = setInterval(() => send({ type: "ping" }), 15000);
      close = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      };
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "none",
    },
  });
}
