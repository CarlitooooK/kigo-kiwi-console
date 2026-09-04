# Kigo Welcome — Mini-app de anfitrión (HostAuthorize)

Mini-app web que el anfitrión (colaborador Kigo) usa para autorizar / rechazar
una visita y registrar su salida. Vive en `src/pages/HostAuthorize.jsx` dentro
de `kigo-console` y comparte su backend Supabase con el kiosko `kiwi_kigo`.

## Cómo se abre

- Rutas: `#/authorize/:id` o `#/authorize?visit=<id>` (HashRouter, fuera del
  login de la consola).
- Embebida en la app Kigo vía `KigoWebViewScreen(url, miniAppId: 'kigo-welcome')`.
- El deeplink de la notificación push es `kigo://welcome/authorize?visit=<id>`.

## Verificación de anfitrión (las dos mitades)

1. **Quién es el anfitrión de la visita** — el kiosko escribe `host_kigo_user_id`
   en el payload del evento `VISIT_CREATED` al registrar la visita.
2. **Quién abrió la mini-app** — `bridgeAuthUserId()` (usa `kigo.auth.init()` del
   marketplace SDK) devuelve el userId del colaborador que la abrió desde su Kigo.

La página compara ambos:
- `match` → muestra Autorizar / Rechazar.
- `mismatch` → bloquea y avisa "esta visita es de otro anfitrión".
- `unverified` (navegador sin bridge, o visita sin host id) → permite (modo demo).

## El bridge es opcional

`src/lib/kigoBridge.js` carga el SDK con import dinámico + try/catch. Si la
mini-app NO corre dentro de Kigo, todo degrada a no-op y la página funciona igual
en navegador. Solo usa `ui.toast`, `navigation.close` y `auth.init` (lectura de
identidad) — nunca pagos.

## Checklist para PRODUCCIÓN (hoy es demo)

- [ ] **Desplegar** esta app a una URL pública HTTPS (gh-pages / Vercel / hosting
      Kigo). Hoy la demo la sirve la Mac en LAN (`192.168.1.71:4173`).
- [ ] **Registrar** la mini-app en el marketplace de Kigo con esa URL como
      `actionTarget` (lo hace el equipo Kigo en su backend). No aparece sola.
- [ ] **Host real**: el kiosko debe capturar el `host_kigo_user_id` REAL desde un
      directorio de colaboradores de Kigo (hoy usa el usuario de prueba fijo
      `EnvConfig.testHostLegacyUserId` = 2085972). Sin esto, el match solo cuadra
      con la app Kigo local del usuario de prueba.
- [ ] **Escrituras seguras**: hoy la mini-app escribe a Supabase con la anon key
      desde el webview. En prod, mover las escrituras (autorizar/rechazar) tras un
      backend o RLS estricto de Kigo.
- [ ] La `sk_live_` de Notifications (en el kiosko) debe salir de un backend, no
      del APK.

Ninguno de estos puntos es un cambio de arquitectura: la mini-app es compatible
con `KigoWebViewScreen` desde el día uno; son ajustes de despliegue, identidad y
política de datos.


## Consola-lite del anfitrión (webview del FAB)

`src/pages/HostConsole.jsx` — ruta `#/host`. Es lo que abre el **FAB "Welcome"** de la
app Kigo. Identidad del anfitrión vía `bridgeAuthUserId()` (en navegador sin bridge
muestra todo). **Tabs** (con scroll horizontal):

- **Pendientes** (`IN_PROGRESS`/`PENDING`/`PRE_AUTHORIZED`)
- **Activas** (`ACTIVE`/`CHECKED_IN`) → Dar salida (check-out) + WhatsApp
- **Completadas** (`COMPLETED`) → solo lectura
- **Canceladas** (`CANCELLED`/`REJECTED`)
- **Invitaciones** — historial completo (200) con badge de vigencia

**Gate de acciones** (autorizar/rechazar/WhatsApp), tanto en card como en el detalle
`HostAuthorize`:
- Solo si la visita tiene evento **`HOST_NOTIFIED`** (walk-in que llegó al paso de
  autorización del host).
- Las **invitaciones pre-autorizadas** entran directo → NO muestran "Autorizar";
  muestran "Invitación · acceso directo".

**Filtro de datos** (`getTodayVisitsForHost`): creadas HOY **+** pre-autorizadas aún
vigentes (`scheduled_end >= now`) aunque sean de otro día. Invitaciones: historial completo.

Acciones compartidas en `src/lib/hostActions.js` (`approveVisit`, `rejectVisit`,
`checkOutVisit`, `whatsappLink`).

## Formulario de invitación (`#/invite`)

`src/pages/InviteForm.jsx`. Botón "Invitar" en el header de `#/host`, o link directo.
Captura tipo, nombre, celular, anfitrión, detalle por tipo y **vigencia** (30 min–1 semana).
Crea visita `PRE_AUTHORIZED` (`source: KIGO_APP`, `scheduled_start/end`) + genera QR
descargable (`WELCOME:<visitId>`). Usa `supabaseAnon` (cliente sin sesión) para evitar el
bloqueo RLS cuando el anfitrión está logueado. Guardas de un solo uso + vigencia se validan
en el kiosko (`visit_lookup_screen._usageBlockMessage`).

## Deploy (GitHub Pages)

- `npm run deploy` → build + `gh-pages -d dist` (push a la rama `gh-pages`).
- URL pública: `https://carlitooook.github.io/kigo-kiwi-console/#/host`
- **Requisito de una sola vez:** habilitar Pages en el repo
  (`Settings → Pages → Source: Deploy from a branch → gh-pages / root`).
  Sin esto, `gh-pages` sube los archivos pero la URL da 404.
- El FAB de kigo_app apunta a esta URL en
  `welcome_miniapp_demo_screen.dart` (`_baseUrl`, con `hostConsole: true`).
