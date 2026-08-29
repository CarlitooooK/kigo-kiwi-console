# Kigo Console

Consola de administración de **Kigo Welcome**, extraída de la app Flutter (`kiwi_kigo`) como una SPA independiente en React + CSS puro. Comparte exactamente el mismo backend Supabase (mismas tablas, mismo storage, mismo auth) que la app de kiosco original — no requiere cambios en el backend.

## Origen

El MVP original (Flutter) tenía la consola embebida bajo las rutas `/console/*`, compartiendo proceso y estado con la experiencia de kiosco del visitante. Este proyecto extrae solo esa parte administrativa a una app web independiente, más simple de desplegar y mantener por separado del kiosco.

Pantallas migradas 1:1:
- **Login** (`/login`) — Supabase Auth (email/password)
- **Dashboard** (`/`) — estadísticas del día
- **Visitas** (`/visits`) — listado con filtros por estado
- **Detalle de visita** (`/visits/:id`) — info del visitante, Trust Score, evidencia (fotos vía signed URLs), timeline del journey, autorizar/rechazar

## Stack

- React 18 + React Router
- CSS puro (tokens del Design System Kigo replicados en `src/theme.css`)
- `@supabase/supabase-js` — mismas tablas y buckets que el proyecto Flutter:
  `visits`, `visitors`, `profiles`, `trust_evaluations`, `access_decisions`, `visitor_journey_events`; buckets `visit-evidence` y `visitor-photos`.

## Configurar

```bash
cp .env.example .env
# Editar .env con las credenciales de Supabase (las mismas que usa kiwi_kigo/.env)
```

Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ORGANIZATION_ID` — organización usada por el dashboard/listado (igual que el valor hardcodeado en la app Flutter)
- `VITE_KIOSK_URL` (opcional) — si se define, muestra un enlace "Volver al kiosco" en el login apuntando a la URL donde vive la app de kiosco.

## Instalar y correr

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de producción en dist/
```

## Notas

- El acceso a la consola requiere un usuario ya creado en Supabase Auth (mismo mecanismo que antes).
- Las políticas de RLS de las tablas/buckets son las que ya existen en el proyecto Supabase — esta app no las modifica.
