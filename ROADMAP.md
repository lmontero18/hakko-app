# Hako — Roadmap

Lo que NO entró en v1 pero está en el radar.

## v1.1 — Polish + most-wanted

- **Docker container view (light)**: dentro de cada card, mostrar los containers que `docker compose up` levantó con su estado individual, puerto, y logs por container (en vez de los logs mezclados actuales). Parsear `docker compose ps --format json`. ~2-4h.
- **+ Add service manually**: crear servicios from scratch sin pasar por auto-detección. Cubre casos como Selenium aparte, custom scripts (`./dev.sh`), o stacks no detectables aún. Reusa `EditServiceDialog`. ~30min.
- **Edit cwd** en `EditServiceDialog`: hoy es readonly. Útil cuando la auto-detección anidó mal el path o el repo se movió.
- **Re-scan folder**: botón en la card para re-detectar servicios si se agregó algo nuevo (ej: añadiste un `Dockerfile` después de crear el proyecto).
- **Templates**: arrancar un proyecto desde plantillas pre-armadas ("Next.js + Strapi", "Vite + Express", "Laravel + MySQL"). Click → boilerplate listo.

## v1.2 — Value-add

- **Git ops sin CLI** — fetch, pull, switch branch desde la card. Plan detallado guardado de la sesión previa: shell-out al binario `git` (no libgit2), envs defensivas anti-prompt, errores tipados. Empezar por badge read-only de estado.
- **Port conflict detection**: warning si el puerto del servicio ya está ocupado antes de spawn.
- **Per-service env vars** (UI): hoy se setean editando JSON manualmente. UI de key/value rows.
- **`.env` editor in-app**: detectar `.env.example` sin `.env` (ya warneamos) y permitir crear/editar inline.
- **System tray + global hotkeys**: ícono en menubar, cmd+shift+H para abrir, etc.
- **Self-hosted Satoshi**: descargar woff2 a `public/fonts/`, eliminar dependencia de Fontshare CDN para offline-first.
- **CLI companion (`hako` desde terminal)**: devs ya viven en terminal, quieren atajos sin cambiar de contexto.
  - `hako list` — lista proyectos con su estado
  - `hako start <project>` / `hako stop <project>` — control rápido
  - `hako logs <service> [-f]` — tail de logs (sin tener que abrir la app)
  - `hako add <folder>` — agregar un folder al proyecto sin drag-and-drop
  - `hako open <project>` — abre la app en esa card específica
  - Implementación: binario separado en Rust que habla con el daemon de Hako (Unix socket en `~/Library/Application Support/Hako/hako.sock`) o lee/escribe `db.json` directo si la app no está corriendo. La app expone un IPC server cuando abierta.
- **Distribución vía Homebrew**: `brew install --cask hako` en vez de descargar .dmg manual. Requiere repo público + formula en `homebrew-cask` o un tap propio (`brew tap monteromolina/hako`).

## Pro tier ($5/mo) — Analytics & Insights

Features que justifican el upgrade del Hobby al Pro tier. Cobramos por data collection + storage + share infra.

- **Project time tracking** — cada vez que un servicio está running, Hako acumula tiempo. Dashboard muestra:
  - Horas totales por proyecto (esta semana / mes / año)
  - Distribución por servicio (cuánto tiempo Strapi vs Docker vs Frontend)
  - Comparativa por proyecto ("Ecoterra: 47h este mes, Peoplecor: 23h")
  - Storage: `~/Library/Application Support/Hako/sessions.json` con entries `{projectId, serviceId, startedAt, stoppedAt, duration}`. Agregado on-the-fly al renderizar el dashboard.
  - Cero red, todo local — alineado con local-first.
- **Commits dashboard** — si el folder es un repo git, parsear `git log` (vía CLI shell-out) y mostrar:
  - Commits por día/semana/mes
  - Lines added/removed
  - Most-edited files
  - Co-autores si los hay
- **GitHub-style contribution heatmap** — grid 53×7 (semanas × días del año) coloreando intensidad de actividad. Combinación de: tiempo running + commits + servicios arrancados. Cada celda hover muestra desglose del día.
- **"Year in code" — Hako Wrapped** — shareable link estilo Spotify Wrapped al cerrar año:
  - Total de horas shipeadas
  - Top 3 proyectos por tiempo invertido
  - Stack favorito (qué framework usaste más)
  - Día más productivo / más procrastinador
  - Total de commits / servicios arrancados / logs vistos
  - Genera una imagen 1080×1920 (story-format) auto-renderable a PNG via Tauri canvas/server
  - Link público `runhako.app/wrapped/<short-code>` con animaciones tipo Spotify
  - Compartible en Twitter/LinkedIn al instante — viral loop incorporado
- **Weekly digest email** (opcional, requiere email opt-in y se acerca a la línea de telemetría) — resumen semanal de tu actividad
- **Implementación**:
  - El time tracking es trivial (timestamp on start/stop, persistir en JSON local).
  - Commits requiere `git log --pretty=format:'%H|%an|%at|%s' --numstat` parseando.
  - Heatmap: SVG generado en frontend desde la data agregada.
  - Wrapped: pre-renderizado server-side al hacer click "Share". Endpoint en `runhako.app/api/wrapped` recibe el JSON serializado del año (anonimizado, sin nombres reales de proyecto si el user opt-out), guarda en KV/Postgres, devuelve short-code. Página `/wrapped/<code>` renderiza la story con scroll-animations.

**Por qué cobrar $5 por esto y no regalarlo:**
1. Storage de Wrapped links (Cloudflare KV o Vercel KV) — cada usuario consume MB de storage
2. Compute para generar imágenes social en server (Vercel ImageResponse, ~1 call cents)
3. Bandwidth para servir las stories virales
4. Soporte para el feature (gente preguntando "por qué mis horas están mal")
5. Justifica que el producto cobre — devs valoran herramientas pulidas. $5 es el precio "no me importa" para devs profesionales (lo gastan en cafés).

## v2 — Big bets

- ~~**Windows + Linux polish**~~ — descartado para alpha/v1. macOS-only se queda. Reconsiderar solo si usuarios reales lo piden con fuerza.
- **Docker GUI mode (heavy)**: tab separada con todos los containers/images/volumes/networks. **Riesgo**: scope creep, pierde foco. Solo si usuarios lo piden con fuerza.
- **Cloud sync**: configuración compartida entre máquinas para developers que trabajan en multiple devices. Requiere account/auth → cambio de modelo de negocio (free local → freemium).
- **Auto-update mechanism**: feed de releases, prompt para actualizar dentro de la app.
- **Code signing + notarization**: para distribución pública en macOS sin warnings de Gatekeeper.

## Won't do (explicit)

- **Replace CLI git workflow** (commit, push, merge, rebase, conflict resolution, stash). Hay tooling especializado mejor (Tower, GitHub Desktop, Lazygit). Hako solo facilita pull/fetch/switch read-mostly.
- **Container build pipeline / CI** — out of scope, no es lo que somos.
- **Telemetría / analytics** — explícitamente no, parte del pitch es "local, sin cloud, sin tracking".
- **Login / accounts** — local-first siempre.
