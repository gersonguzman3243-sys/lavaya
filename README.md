# LavaYa

Recolección de ropa en moto, al estilo de un viaje en el mapa. El cliente dice qué ropa tiene y dónde está. Un recolector en moto la lleva a la lavandería. El taller pesa y cuenta lo que de verdad llegó, y el cliente ve el total en pesos mexicanos antes de aceptarlo.

La interfaz, los textos y esta guía están en español de México. Los precios van en MXN.

## Por qué este stack

- **Next.js y TypeScript** sirven la app y la API en un solo proyecto. Es fácil de correr en local y, más adelante, de publicar en un servidor.
- **Tailwind** y componentes al estilo de shadcn (botones, campos, diálogos) mantienen la interfaz consistente y táctil.
- **Leaflet y OpenStreetMap** dibujan el mapa sin llave de pago.
- **Eventos en vivo (SSE)** más un refresco de respaldo mantienen alineados al cliente, al recolector y a la lavandería.
- **PWA**: se puede instalar desde el navegador.
- **Capacitor** envuelve esa misma web en un proyecto Android. El APK abre LavaYa desde la dirección del servidor, así el teléfono no queda amarrado a `localhost`.

No hay base de datos externa ni cobros reales. Los pedidos viven en un JSON (`LAVAYA_DATA_DIR/db.json`; en local, `data/db.json`). Las fotos de la ropa se guardan en `uploads` dentro de ese mismo directorio. Si el archivo no existe, al arrancar se siembran solas las cuentas ana, luis y rosa (`@lavaya.mx`, contraseña `lavaya123`).

## Render

El servicio es Docker (`render.yaml`: tipo web, runtime docker, plan free). Render inyecta `PORT` (en el plan gratis suele ser 10000). El proceso escucha en `process.env.PORT` o, si no viene, en **7860**, siempre en `0.0.0.0`. La comprobación de salud es `GET /api/health`.

El plan gratis tiene disco efímero: al reiniciar o redesplegar se borra `/home/user/data`. El arranque vuelve a sembrar la demo. No hace falta un volumen.

La URL prevista es [https://lavaya.onrender.com](https://lavaya.onrender.com). El proxy termina HTTPS. La app usa rutas relativas (`/api/...`, `/cliente`, eventos en `/api/events`), así que el navegador se queda en ese origen. El chat no usa WebSocket: son peticiones HTTP y SSE. La cookie se marca `Secure` cuando llega `X-Forwarded-Proto: https`.

## Requisitos

- Node.js 22
- npm

Para el APK, además: JDK 21 y Android SDK (compileSdk 36). El script `npm run android:apk` usa `ANDROID_HOME` o, si no está definida, `$HOME/android-sdk`.

## Instalar y correr

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:43123](http://127.0.0.1:43123). El servidor escucha en todas las interfaces (`0.0.0.0`) y en el puerto **43123**, para que un teléfono en la misma red pueda entrar.

Otras órdenes:

```bash
npm test          # precios, cupones, distancia y estados
npm run lint
npm run build
npm start         # producción, mismo puerto
```

En la portada hay un botón **Restablecer demo** por si quieres volver a los pedidos de ejemplo.

## Cuentas de demostración

Las tres usan la contraseña `lavaya123`.

| Rol | Nombre | Correo |
| --- | --- | --- |
| Cliente | Ana García | ana@lavaya.mx |
| Recolector | Luis Hernández | luis@lavaya.mx |
| Lavandería | Rosa Méndez | rosa@lavaya.mx |

También existe Carlos Ruiz (`carlos@lavaya.mx`, misma contraseña) con una recolección programada en la Condesa, para que el recolector vea un viaje disponible al entrar.

La lavandería de la demo es **LavaYa Taller Doctores** (Dr. García Diego 45, Col. Doctores, CDMX).

## Cómo probar cada rol

1. Entra como **Ana**. Verás un pedido ya en el taller y otro entregado. Puedes pedir otra recolección: dirección en el mapa, ahora o más tarde, prendas, lavado normal o en seco, planchado, foto y cupón `LAVAYA20`.
2. Entra como **Luis** (otra ventana o, si compartes cookies, otro host como `localhost`). Toma el viaje, sigue la moto en el mapa, escribe en el chat y marca recogida y entrega en el taller. La moto se mueve sola; los botones grandes sirven aunque el punto todavía vaya en camino.
3. Entra como **Rosa**. Registra kilos, conteo y fotos. El cliente ve la cantidad que llegó y el total, y lo acepta. Luego Rosa pasa a lavando y a lista. Luis hace la entrega de regreso. Ana califica con estrellas.

Los avisos salen en la campana y, si das permiso, también como notificación del navegador. En el APK se usan notificaciones locales del teléfono.

## Precios

Tarifas iniciales, todas editables en la pestaña **Tarifas** de la lavandería. Un pedido ya creado conserva las tarifas con las que se pidió.

| Concepto | Valor de arranque | Nota |
| --- | --- | --- |
| Lavado normal | $12.00 MXN por kg | Tarifa base |
| Lavado en seco | $48.00 MXN por kg | Ejemplo. Sustituye al lavado normal |
| Planchado | $18.00 MXN por kg | Ejemplo. Se suma al servicio principal |
| Recolección | $5.00 MXN por km | Casa del cliente → taller |
| Entrega | $5.00 MXN por km | Taller → casa del cliente |

El desglose, en el estimado y en el precio final, muestra cada línea por separado:

`lavado ($12 × kg) + planchado u otro extra + recolección (km × $5) + entrega (km × $5) − cupón = total`

La recolección y la entrega usan los mismos kilómetros (ida y vuelta por la misma ruta) y se cobran las dos. Cada tarifa por kilómetro se puede cambiar sola.

Los extras por prenda nacen en $0: la prenda solo se cuenta y el dinero va por kilo. Si la lavandería les pone precio, aparecen como línea propia.

**Distancia.** Primero se pide la ruta en coche al servicio público de OpenStreetMap [OSRM](https://router.project-osrm.org) (`router.project-osrm.org`). Si responde, los kilómetros son por calles y el mapa dibuja esa ruta. Si no responde a tiempo, se usa la línea recta (haversine) multiplicada por **1.35** para aproximar el recorrido urbano. El desglose dice cuál de las dos se usó. Los kilómetros se redondean a un decimal para que la cuenta coincida con lo que se lee.

El pago es simulado: se muestra el monto y no hay cargo real.

## Cupones, chat y fotos

- La lavandería crea cupones de porcentaje o de pesos, con vencimiento y límite de usos, y anuncios para el inicio del cliente.
- El chat es entre el cliente y el recolector asignado, con mensajes sin leer.
- El cliente puede adjuntar una foto al pedir. El taller adjunta fotos al pesar. Esas fotos salen en el detalle del pedido junto con el conteo.

## PWA

En Chrome o Edge, con la app en `localhost` o en HTTPS, puedes instalarla desde el menú del navegador. El manifiesto se llama LavaYa, el idioma es `es-MX` y el color es el verde de la marca. Hay un service worker mínimo: la app sigue necesitando al servidor para los pedidos.

## App Android (APK)

Sí se generó un **APK de depuración** en este entorno:

`android/app/build/outputs/apk/debug/app-debug.apk`

Nombre de paquete `mx.lavaya.app`, nombre visible **LavaYa**, ícono y pantalla de arranque de la marca. Permite HTTP local (`usesCleartextTraffic`), notificaciones, ubicación y cámara.

El APK no trae el servidor adentro. Al abrirlo ya viene escrita `https://lavaya.onrender.com` y puedes cambiarla. Cada arranque espera unos segundos por si quieres otra dirección. HTTPS no necesita tráfico sin cifrar.

| Dónde corre el teléfono | Dirección que debes escribir |
| --- | --- |
| Emulador de Android en la misma computadora | `http://10.0.2.2:43123` |
| Teléfono real, misma red Wi-Fi | `http://LA-IP-DE-TU-COMPUTADORA:43123` |
| Servidor publicado | `https://lavaya.onrender.com` |

No uses `localhost` ni `127.0.0.1` en un teléfono físico: eso apunta al propio teléfono, no a tu computadora. El servidor de desarrollo ya escucha en `0.0.0.0`. Si el teléfono no conecta, revisa que el firewall deje pasar el puerto 43123.

Para instalar el APK de depuración: pásalo al teléfono y ábrelo, o con el teléfono conectado:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Volver a construir el APK

```bash
# ANDROID_HOME debe apuntar al SDK, o existir ~/android-sdk
npm run android:apk
```

Eso ejecuta `npx cap sync android` y `./gradlew assembleDebug`.

También puedes abrir la carpeta `android/` en Android Studio y usar Run.

### Publicar en Google Play, más adelante

1. Crea un keystore de firma y no lo subas al repositorio.
2. Configura `signingConfigs` de release en `android/app/build.gradle`.
3. Genera `./gradlew bundleRelease` (AAB, que es lo que pide Play).
4. En Play Console crea la ficha, la política de privacidad y la clasificación de contenido.
5. Sustituye la URL de depuración por el HTTPS de producción. El usuario también puede escribirla en la pantalla inicial del APK.
6. Para un build de tienda conviene desactivar el tráfico HTTP claro y dejar solo HTTPS.

## Qué falta para lanzarlo de verdad

- **Pagos reales** (por ejemplo Mercado Pago o Stripe) en lugar del pago simulado, con reembolsos si el cliente no acepta el peso.
- **Cuentas de verdad**: registro, recuperación de contraseña y sesiones firmadas. Hoy la sesión es una cookie de demostración.
- **Base de datos** y un servidor con más de un proceso. El archivo JSON y la moto simulada viven en la memoria de un solo Node.
- **GPS real del recolector** en lugar de la ruta simulada, con la app en segundo plano.
- **Notificaciones push** cuando la app está cerrada (FCM en Android, Web Push con llaves VAPID en el navegador). Hoy el aviso del sistema sale si la app está abierta o, en el APK, como notificación local al recibir el evento.
- **Apps nativas** firmadas para Play y, si hace falta, App Store. El proyecto Android ya está; iOS sería otro target de Capacitor.
- **Operación**: varias lavanderías, zonas de cobertura, horarios, comprobantes fiscales (CFDI) y soporte.
- **OSRM propio** si el servicio público se satura. La app ya cae a la línea recta × 1.35.

## Pruebas

`npm test` cubre el cobro a $12/kg, planchado, lavado en seco, las dos líneas de distancia, cupones y el orden de los estados. `scripts/smoke.mjs` recorre el flujo completo contra un servidor encendido (`LAVAYA_URL` opcional).
