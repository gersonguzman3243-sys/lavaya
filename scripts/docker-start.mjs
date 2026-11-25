// Render inyecta PORT (en el plan gratis suele ser 10000). Sin esa variable, 7860.
process.env.PORT = process.env.PORT || "7860";
// Docker define HOSTNAME con el id del contenedor. Hay que escuchar en todas las interfaces.
process.env.HOSTNAME = "0.0.0.0";

await import("./server.js");
