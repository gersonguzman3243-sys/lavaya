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

Los pedidos viven en Postgres si defines `DATABASE_URL`. Si no viene, se usa un JSON (`LAVAYA_DATA_DIR/db.json`; en local, `data/db.json`). Las fotos siguen en `uploads` dentro de ese directorio: el disco gratis de Render es efímero, así que las fotos se pierden al reiniciar aunque el JSON de pedidos esté en Postgres. Si el almacén está vacío, al arrancar se siembran ana, luis, rosa y la administración (`@lavaya.mx`, contraseña `lavaya123`).

## Render

El servicio es Docker (`render.yaml`: tipo web, runtime docker, plan free). Render inyecta `PORT` (en el plan gratis suele ser 10000). El proceso escucha en `process.env.PORT` o, si no viene, en **7860**, siempre en `0.0.0.0`. La comprobación de salud es `GET /api/health`.

El plan gratis tiene disco efímero: al reiniciar o redesplegar se borra `/home/user/data`. Sin `DATABASE_URL` el arranque vuelve a sembrar la demo. Con Postgres los registros, pedidos y aprobaciones se quedan.

## Postgres

Cualquier Postgres con una URL sirve: el Postgres gratis de Render o [Neon](https://neon.tech). La app crea sola la tabla `lavaya_state` (un documento JSON) la primera vez que arranca.

1. Crea la base y copia la connection string **externa** (en Render, la que no dice Internal, si el servicio web y la base no están en el mismo private network; si sí lo están, usa la Internal).
2. En el servicio web pon `DATABASE_URL` con esa URL. No la subas al repositorio.
3. Redeploy. `GET /api/health` responde `db: "postgres"` cuando conectó, o `db: "json"` si la variable no está.

Si la variable no está, no se intenta conectar y se usa el archivo.

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
| Administración | Administración LavaYa | admin@lavaya.mx |

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

## Cuentas nuevas

En la portada, **Crear cuenta** abre el registro:

- **Cliente**: nombre, correo, contraseña y teléfono. Entra de inmediato.
- **Lavandería**: nombre del negocio, dirección, pin en el mapa, teléfono y horario. Puede poner su precio de lavado normal; si no, usa $12/kg y $5 por km. Queda **pendiente**.
- **Recolector**: nombre, teléfono, placa y, si quiere, foto de INE o licencia. Queda **pendiente**.

Entra como `admin@lavaya.mx` para aprobar, rechazar o suspender. Solo un taller aprobado y cercano recibe el pedido. Solo un recolector aprobado ve viajes a menos de 18 km y puede aceptarlos.

## Pagos

Cuando el taller pesa la ropa, el cliente elige:

- **Mercado Pago** (Checkout Pro: tarjeta, OXXO o transferencia), o
- **Efectivo al recibir**.

El estado se ve en el pedido del cliente y en el escritorio de la lavandería.

Variables:

| Variable | Para qué |
| --- | --- |
| `MP_ACCESS_TOKEN` | Access token de **prueba**. Empieza con `TEST-`. Sin ella, Mercado Pago queda en **modo demo** (no hay cargo). |
| `MP_PUBLIC_KEY` | Public key de prueba, `TEST-`. La app arranca igual si falta. |
| `APP_URL` | Origen público, `https://lavaya.onrender.com`. Se usa en `back_urls` y en el webhook. |
| `DATABASE_URL` | Postgres opcional. Ver arriba. |

Credenciales de prueba de Mercado Pago (México):

1. Entra a [Tus integraciones](https://www.mercadopago.com.mx/developers/panel/app) con una cuenta de Mercado Pago.
2. Crea una aplicación y abre **Credenciales de prueba** (no las de producción).
3. Copia el Access Token y la Public Key a `MP_ACCESS_TOKEN` y `MP_PUBLIC_KEY`.
4. En la aplicación, la URL de notificaciones puede quedar vacía: LavaYa manda `notification_url` al crear la preferencia (`/api/payments/webhook`).
5. Paga con un [usuario de prueba](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/additional-content/your-integrations/test/accounts) y una [tarjeta de prueba](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards). El webhook vuelve a leer el pago en la API de Mercado Pago antes de marcar el pedido; no confía en el cuerpo del aviso.

## Ubicación

El recolector comparte `navigator.geolocation.watchPosition` (en el APK, el plugin de geolocalización de Capacitor y los permisos de Android). El servidor reenvía el punto por los mismos eventos SSE que ya usa el mapa. El cliente ve la moto moverse y una ETA. La dirección de recolección se puede poner con **Usar mi ubicación** o moviendo el pin. Si el permiso se niega, el mapa vuelve al recorrido simulado.

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

- **Pagos en producción** de Mercado Pago (hoy son credenciales de prueba, o modo demo si no hay token) y reembolsos automáticos si el cliente no acepta el peso.
- **Cuentas firmadas**: ya hay registro y aprobación, pero la sesión sigue siendo una cookie de demostración y la contraseña no está hasheada.
- **Varios procesos**: Postgres guarda el documento, pero la moto en vivo sigue en la memoria de un solo Node. El plan gratis de Render es una instancia.
- **GPS en segundo plano** cuando el recolector bloquea el teléfono. Con la app abierta ya se comparte la ubicación.
- **Notificaciones push** cuando la app está cerrada (FCM en Android, Web Push con llaves VAPID en el navegador). Hoy el aviso del sistema sale si la app está abierta o, en el APK, como notificación local al recibir el evento.
- **Apps nativas** firmadas para Play y, si hace falta, App Store. El proyecto Android ya está; iOS sería otro target de Capacitor.
- **Operación**: varias lavanderías, zonas de cobertura, horarios, comprobantes fiscales (CFDI) y soporte.
- **OSRM propio** si el servicio público se satura. La app ya cae a la línea recta × 1.35.

## Pruebas

`npm test` cubre el cobro a $12/kg, planchado, lavado en seco, las dos líneas de distancia, cupones y el orden de los estados. `scripts/smoke.mjs` recorre el flujo completo contra un servidor encendido (`LAVAYA_URL` opcional).
