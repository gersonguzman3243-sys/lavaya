const base = process.env.LAVAYA_URL ?? "http://127.0.0.1:43123";

function session() {
  let cookie = "";
  const request = async function request(path, body) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    if (setCookies.length) {
      cookie = setCookies.map((item) => item.split(";")[0]).join("; ");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`${path} ${response.status}: ${data.error ?? "error"}`);
    }
    return data;
  };
  request.cookie = () => cookie;
  return request;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tiny =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const ana = session();
const luis = session();
const rosa = session();

await ana("/api/demo/reset", {});
await ana("/api/auth/login", { email: "ana@lavaya.mx", password: "lavaya123" });
const quote = await ana("/api/quote", {
  address: "Orizaba 89, Roma Norte, CDMX",
  reference: "Depto 4",
  lat: 19.4187,
  lng: -99.1622,
  notes: "Sin suavizante",
  customerPhoto: null,
  garments: [
    { type: "playera", count: 4 },
    { type: "pantalon", count: 2 },
  ],
  baseService: "lavado_normal",
  planchado: true,
  scheduledFor: null,
  couponCode: "LAVAYA20",
});
const ids = quote.price.lines.map((line) => line.id);
assert(ids.includes("lavado") && ids.includes("planchado") && ids.includes("recoleccion") && ids.includes("entrega"), "faltan líneas de precio");
assert(quote.price.discount > 0, "el cupón no descontó");
assert(quote.price.lines.find((line) => line.id === "lavado").amount === quote.price.kg * 12, "lavado no está a 12 por kg");

await ana("/api/auth/login", { email: "ana@lavaya.mx", password: "lavaya123" });
await luis("/api/auth/login", { email: "luis@lavaya.mx", password: "lavaya123" });
await rosa("/api/auth/login", { email: "rosa@lavaya.mx", password: "lavaya123" });
for (const [name, client] of [["ana", ana], ["luis", luis], ["rosa", rosa]]) {
  const me = await client("/api/bootstrap");
  assert(me.me.email.endsWith("@lavaya.mx"), `${name} no entró`);
}

const created = await ana("/api/orders", {
  address: "Orizaba 89, Roma Norte, CDMX",
  reference: "Depto 4",
  lat: 19.4187,
  lng: -99.1622,
  notes: "Sin suavizante",
  customerPhoto: tiny,
  garments: [
    { type: "playera", count: 4 },
    { type: "pantalon", count: 2 },
  ],
  baseService: "lavado_normal",
  planchado: true,
  scheduledFor: null,
  couponCode: "LAVAYA20",
});
const id = created.order.id;

await luis("/api/auth/login", { email: "luis@lavaya.mx", password: "lavaya123" });
await luis(`/api/orders/${id}/action`, { type: "accept" });
await luis(`/api/orders/${id}/chat`, { text: "Ya voy en la moto." });
await luis(`/api/orders/${id}/action`, { type: "pickup" });
await luis(`/api/orders/${id}/action`, { type: "dropoff" });

await ana(`/api/orders/${id}/chat`, { text: "El timbre es García." });

await rosa("/api/auth/login", { email: "rosa@lavaya.mx", password: "lavaya123" });
const weighed = await rosa(`/api/orders/${id}/action`, {
  type: "intake",
  kg: 2.4,
  garments: [
    { type: "playera", count: 4 },
    { type: "pantalon", count: 2 },
  ],
  photos: [tiny],
});
assert(weighed.order.status === "pesado", "no quedó pesado");
assert(weighed.order.finalPrice.lines.some((line) => line.id === "recoleccion"), "falta recolección");
assert(weighed.order.finalPrice.lines.some((line) => line.id === "entrega"), "falta entrega");
assert(weighed.order.finalPrice.kg === 2.4, "el peso final no es 2.4");
assert(weighed.order.laundryPhotos[0]?.startsWith("/api/media/"), "la foto no quedó en uploads");
const photo = await fetch(base + weighed.order.laundryPhotos[0], { headers: { cookie: rosa.cookie() } });
assert(photo.ok, "no se pudo leer la foto guardada");
assert((photo.headers.get("content-type") || "").startsWith("image/"), "la foto no es una imagen");

const anaView = await ana("/api/bootstrap");
const seen = anaView.orders.find((order) => order.id === id);
assert(seen.finalPrice.total > 0, "el cliente no ve el total");
assert(seen.messages.some((message) => message.text.includes("moto")), "el cliente no ve el chat");
await ana(`/api/orders/${id}/action`, { type: "accept_price" });

await rosa(`/api/orders/${id}/action`, { type: "advance", to: "lavando" });
await rosa(`/api/orders/${id}/action`, { type: "advance", to: "listo" });
const ready = await ana("/api/bootstrap");
assert(
  ready.notifications.some((note) => note.title === "Tu ropa está lista"),
  "no hubo aviso de ropa lista",
);

await luis(`/api/orders/${id}/action`, { type: "start_delivery" });
await luis(`/api/orders/${id}/action`, { type: "deliver" });
await ana(`/api/orders/${id}/action`, { type: "rate", stars: 5, comment: "Llegó rápido." });

const end = await ana("/api/bootstrap");
const done = end.orders.find((order) => order.id === id);
assert(done.status === "entregado", "no se entregó");
assert(done.rating.stars === 5, "no se guardó la calificación");
const luisNow = end.people.find((person) => person.email === "luis@lavaya.mx");
assert(luisNow.ratingCount === 27, "no subió el conteo de estrellas");

const tomorrow = new Date(Date.now() + 26 * 60 * 60 * 1000);
const scheduled = await ana("/api/orders", {
  address: "Colima 180, Condesa, CDMX",
  reference: "",
  lat: 19.4102,
  lng: -99.1715,
  notes: "",
  customerPhoto: null,
  garments: [{ type: "camisa", count: 2 }],
  baseService: "lavado_en_seco",
  planchado: false,
  scheduledFor: tomorrow.toISOString(),
  couponCode: null,
});
assert(scheduled.order.scheduledFor, "no se programó");
assert(scheduled.order.estimate.lines.some((line) => line.id === "seco"), "no cobró lavado en seco");

console.log("flujo completo ok", {
  codigo: done.code,
  total: done.finalPrice.total,
  km: done.finalPrice.km,
  metodo: done.finalPrice.distanceMethod,
});
