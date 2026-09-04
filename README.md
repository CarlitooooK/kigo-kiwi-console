# Kigo Console

Consola web de **Kigo Welcome** (FEPRO 2026): SPA en React + Vite que comparte el
mismo backend Supabase que el kiosko (`kiwi_kigo`). Funciona embebida como
**mini-app en la app Kigo** (WebView) y también como sitio independiente.

**Publicada en:** `https://carlitooook.github.io/kigo-kiwi-console/`

---

## Qué incluye

### Consola-lite del anfitrión (`#/host`)
Pensada para correr embebida en la app Kigo. Muestra las visitas de **hoy**
dirigidas al anfitrión autenticado, agrupadas en pestañas
(Pendientes / Activas / Completadas / Canceladas / Invitaciones):
- **Aprobar** walk-ins que ya notificaron al anfitrión y **dar salida** a las activas.
- **Auto-aprobación por Trust Score ≥ 70** — toggle persistente (`localStorage`):
  cuando está activo, aprueba automáticamente las visitas pendientes elegibles.
- **WhatsApp** al visitante y gestión de **enrolamiento facial recurrente** tras el checkout.

### Formulario de invitación (`#/invite`)
Crea una visita **pre-autorizada** (tipo, nombre, celular, anfitrión, detalle,
vigencia) y genera un **QR descargable** que el invitado presenta en el kiosko.

### Detalle y autorización
- `#/authorize/:id` — autorizar/rechazar una visita.
- `#/visit/:id` — detalle completo: visitante, Trust Score, evidencia (fotos vía
  signed URLs), timeline del journey, gestión de rostro.

---

## Stack

- **React 18** + **Vite 5** + `react-router-dom` (**HashRouter**, base `/kigo-kiwi-console/`).
- **`@supabase/supabase-js`** — mismas tablas que el kiosko: `visits`, `visitors`,
  `profiles`, `trust_evaluations`, `access_decisions`, `visitor_journey_events`,
  `face_enrollments`; buckets `visit-evidence` y `visitor-photos`.
- **`@kigo-dev/marketplace-sdk`** — bridge con la app Kigo (auth del host, toasts)
  cuando corre embebida (`src/lib/kigoBridge.js`).
- **`qrcode`** (QR de invitación) · **`jspdf` / `jspdf-autotable`** (export PDF).
- Deploy: **`gh-pages`** → GitHub Pages.

---

## Configurar

```bash
cp .env.example .env   # si existe; si no, crea .env
```

Variables (`.env`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ORGANIZATION_ID` — organización (default `a0000000-0000-0000-0000-000000000001`)
- `VITE_KIOSK_URL` (opcional) — enlace "Volver al kiosco".

> El formulario de invitación usa un cliente Supabase **anónimo sin sesión**
> (`supabaseAnon`) para que los inserts pasen por la política RLS del rol `anon`
> (mismo mecanismo que el kiosko). La consola general usa el cliente autenticado.

---

## Instalar y correr

```bash
npm install

npm run dev       # desarrollo → http://localhost:5173
npm run build     # build de producción → dist/
npm run deploy    # build + publish a GitHub Pages (gh-pages -d dist)
```

---

## Rutas (HashRouter → llevan `#/`)

| Ruta | Pantalla |
|---|---|
| `#/host` | Consola-lite del anfitrión (visitas de hoy + auto-aprobación) |
| `#/invite` | Formulario de invitación + QR |
| `#/authorize/:id` | Autorización de una visita |
| `#/visit/:id` | Detalle de la visita |

---

## Notas

- Las políticas **RLS** de tablas/buckets ya existen en el proyecto Supabase — esta
  app no las modifica. Rol `anon`: INSERT y UPDATE de `visits` permitidos; DELETE bloqueado.
- La limpieza de visitas fantasma corre **server-side** (pg_cron en Supabase), no en la consola.
- Para embeber en la app Kigo: se abre `#/host` desde el FAB "Welcome" de `kigo_app`.
