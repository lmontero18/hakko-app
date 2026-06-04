# Hakko — Roadmap

Lo que NO entró en v1 pero está en el radar.

## Modelo de planes

Sin tier gratis. Toda la app es de pago, con **7 días de prueba gratis** en cualquier plan.

- **Pro — $5/mo** · un dev, una máquina. La app completa: todo el core (multi-folder, auto-detect, logs, comandos, open in browser) + env vars manager + resource monitor + sync entre tus propias máquinas + analytics personales (ver sección Pro abajo) + priority support.
- **Team — $10/mo per seat** · colaboración / nube. Todo lo de Pro + workspaces compartidos + env vars & secrets compartidos + onboarding centralizado + gestión de seats.

> Las secciones `v1.1` / `v1.2` de abajo son **orden de construcción**, NO tiers. Como no hay plan gratis, todo lo single-user vive en Pro y lo colaborativo en Team.

## Done ✅ (shipped)

- **Env management — `.env` editor in-app**: lee/edita los archivos `.env`, `.env.local`, `.env.example` reales del proyecto, con valores enmascarados + toggle de ojo, aviso de privacidad (sin gate), parser line-aware que preserva comentarios, "Create .env from .env.example" + CTA en el warning de detección. *(Reemplazó el enfoque db.json/overrides — Opción A. Cubre el pedido del tester.)*
- **UI rediseñado — sidebar + detalle**: navegación maestro-detalle (adiós acordeón). Sidebar con lista de proyectos + highlight deslizante; panel de detalle con header rediseñado, animaciones de entrada con stagger y transición al cambiar de proyecto.
- **Identidad de proyecto**: color estable y distinto por proyecto (derivado del nombre) + detección del **favicon/app-icon real** del repo (SVG/PNG/ico → data URI) como avatar cuadrado, con fallback a inicial + color.
- **Time tracking + stats**: cada sesión de servicio (start→stop) se persiste en `sessions.json`; tracking **en tiempo real** (incluye lo que corre ahora mismo). Panel global de **Stats** (this week / all time / sessions + ranking por proyecto) y, por proyecto, una pestaña **Activity** con resumen del año. *(La data ya se acumula desde ahora.)*
- **Contribution heatmap (por proyecto)**: estilo GitHub, **por año calendario** con selector de año, responsive sin scrollbar, verde GitHub, tooltip por día con tiempo + sesiones. Vive en la pestaña Activity de cada proyecto.

## v1.2 — Value-add

- **Port conflict detection**: warning si el puerto del servicio ya está ocupado antes de spawn.
- **Resource monitor (CPU / RAM) por servicio** *(nueva — no estaba en el roadmap)*: muestrear el uso del proceso spawneado y mostrarlo en la `ServiceRow`. Necesita código nuevo en Rust (sampling por PID) + UI.

## Pro — Analytics & Insights (engagement)

Las features de **engagement** que hacen que la gente use Hakko por mucho tiempo y se encariñe: *"este fue mi proyecto top del año, estos fueron mis commits"*. Viven en **Pro**.

**Secuencia clave — la data es retroactiva-imposible:** no puedes mostrar "tu año en código" si empezaste a medir la semana pasada. Por eso el **tracking (la recolección de data) se construye YA**, aunque las visualizaciones bonitas vengan después. Plumbing barato ahora = data acumulada para el Wrapped del año que viene. Si lo dejas todo como "futuro", el día que lo construyas arrancas con la data en cero.

### ✅ Recolección — YA construido

- **Project time tracking** — ✅ **shipped.** Cada sesión de servicio (start→stop) se persiste en `~/Library/Application Support/Hakko/sessions.json` con `{projectId, projectName, serviceId, serviceName, startedAt, stoppedAt, durationSecs}`. Agregado on-the-fly. La data **ya se acumula**. Incluye un panel de stats básico (total por proyecto, últimos 7 días, desglose por servicio).

### Visualizaciones — estado

- ✅ **Dashboard de horas** — **shipped.** Totales por proyecto y por servicio, this week / all time, ranking entre proyectos (panel global Stats) + resumen por año en la pestaña Activity de cada proyecto. En tiempo real.
- ✅ **GitHub-style contribution heatmap** — **shipped.** Por proyecto, por año calendario (selector de año), responsive sin scrollbar, verde GitHub, tooltip por día. *(Por ahora colorea por tiempo trackeado; sumar commits queda atado al commits dashboard de abajo.)*
- 🟡 **Commits dashboard** — pendiente. Si el folder es repo git, parsear `git log` (CLI shell-out): commits por día/semana/mes, lines added/removed, most-edited files, co-autores. `git log --pretty=format:'%H|%an|%at|%s' --numstat`. Al construirse, su data se puede sumar al heatmap.

### 🔴 Construir mucho después — requiere nube (la única excepción a "local-first")

- **"Year in code" — Hakko Wrapped** — shareable link estilo Spotify Wrapped al cerrar año:
  - Total de horas shipeadas, top 3 proyectos, stack favorito, día más/menos productivo, totales de commits/servicios/logs.
  - Imagen 1080×1920 (story-format) auto-renderable a PNG.
  - Link público `runhako.app/wrapped/<short-code>` con scroll-animations tipo Spotify. Compartible en Twitter/LinkedIn — loop viral.
  - **Es lo único que sale de la máquina:** opt-in, server-side (storage de links en KV/Postgres + generación de imagen social). Solo tiene sentido **cuando tengas usuarios reales + un año de data acumulada**.
- **Weekly digest email** (opcional, opt-in) — resumen semanal. Se acerca a la línea de telemetría → opt-in explícito, nunca por default.

**Por qué Pro vale $5 (y no se regala):**
1. Es producto pulido y completo — los devs valoran herramientas que les ahorran fricción a diario. $5 es el precio "no me importa" para un dev profesional (lo gastan en cafés).
2. El time tracking + dashboards locales generan **apego**: ves tu propio progreso, no te quieres ir. Eso es retención.
3. Wrapped + share infra (cuando exista) tiene costo real: storage de links (Cloudflare/Vercel KV), compute para imágenes sociales, bandwidth para las stories virales.
4. Soporte del feature ("por qué mis horas están mal").

## Futuro (sin fecha) — infra, distribución & conveniencia

Cosas que queremos pero NO son prioridad. Sin fecha, se construyen cuando haya tracción/tiempo.

- **Re-scan folder**: botón en la card para re-detectar servicios si se agregó algo nuevo (ej: añadiste un `Dockerfile` después de crear el proyecto). Aún no ha sido un problema real → sin prioridad.
- **System tray + global hotkeys**: ícono en menubar, cmd+shift+H para abrir, etc.
- **Self-hosted Satoshi**: descargar woff2 a `public/fonts/`, eliminar dependencia de Fontshare CDN para offline-first.
- **CLI companion (`hako` desde terminal)**: devs ya viven en terminal, quieren atajos sin cambiar de contexto.
  - `hako list` — lista proyectos con su estado
  - `hako start <project>` / `hako stop <project>` — control rápido
  - `hako logs <service> [-f]` — tail de logs (sin tener que abrir la app)
  - `hako add <folder>` — agregar un folder al proyecto sin drag-and-drop
  - `hako open <project>` — abre la app en esa card específica
  - Implementación: binario separado en Rust que habla con el daemon de Hakko (Unix socket en `~/Library/Application Support/Hakko/hako.sock`) o lee/escribe `db.json` directo si la app no está corriendo. La app expone un IPC server cuando abierta.
- **Distribución vía Homebrew**: `brew install --cask hako` en vez de descargar .dmg manual. Requiere repo público + formula en `homebrew-cask` o un tap propio (`brew tap monteromolina/hako`).

## v2 — Big bets

- ~~**Windows + Linux polish**~~ — descartado para alpha/v1. macOS-only se queda. Reconsiderar solo si usuarios reales lo piden con fuerza.
- **Docker GUI mode (heavy)**: tab separada con todos los containers/images/volumes/networks. **Riesgo**: scope creep, pierde foco. Solo si usuarios lo piden con fuerza.
- **Cloud sync (base del tier Team)**: configuración compartida entre máquinas + workspaces de equipo, env vars & secrets compartidos, onboarding centralizado y gestión de seats. Requiere account/auth → es justo lo que justifica el plan **Team ($10/mo per seat)** y su precio recurrente (costo real de servidores). Ojo: el sync personal "entre tus propias máquinas" es **Pro**; el compartido entre personas es **Team**.
- **Auto-update mechanism**: feed de releases, prompt para actualizar dentro de la app.
- **Code signing + notarization**: para distribución pública en macOS sin warnings de Gatekeeper.

## Won't do (explicit)

- **Replace CLI git workflow** (commit, push, merge, rebase, conflict resolution, stash). Hay tooling especializado mejor (Tower, GitHub Desktop, Lazygit). Hakko solo facilita pull/fetch/switch read-mostly.
- **Container build pipeline / CI** — out of scope, no es lo que somos.
- **Telemetría** (mandarnos a NOSOTROS tu uso) — explícitamente no. Ojo: los "analytics" de Pro (time tracking, commits, heatmap) se calculan **100% en tu máquina** y son TUYOS — eso NO es telemetría. La única excepción que sale a la nube es Hakko Wrapped, y es **opt-in**.
- **Login / accounts obligatorios para single-user** — Pro es local-first, sin login. *(El tier Team sí requiere account para el sync/colaboración, pero es opt-in: solo si te unes a un equipo.)*
