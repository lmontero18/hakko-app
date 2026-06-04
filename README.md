# Hakko

**A visual dashboard for your local dev environments.** Drop in a folder, Hakko detects your services, and you start, stop, and watch them all from one window — no `cd`-ing, no remembering commands, no config files.

`v0.1 alpha` · macOS only · built with [Tauri 2](https://v2.tauri.app/) · [Join the waitlist →](https://runhakko.app)

<!-- Add a real screenshot at docs/screenshot.png and it will show up here -->
![Hakko](docs/screenshot.png)

## Why it exists

Juggling 3+ active projects means constantly navigating between directories, remembering which commands to run in what order, checking what's already running, and stitching together logs from a dozen terminal tabs.

Existing tools (Docker Desktop, Lazydocker, Tilt, tmuxinator) solve parts of this but are fragmented, CLI-heavy, or container-only. Hakko's bet: a clean, opinionated UI that wraps the commands you already know, agnostic to your stack.

The defining product decision is **zero manual setup**. You never write a config file or fill out a form with command names and paths. Hakko detects everything by scanning the folders you drop in. Editing is there as a fallback — most people never need it.

## Features

- **Auto-detection** — drop a folder and Hakko finds your services: Next.js, Vite, Strapi, Docker Compose, Rust, Django, generic `npm` scripts, and more.
- **Multi-folder projects** — group separate repos (e.g. `app-frontend` + `app-backend`) under a single project card, even when they live in different folders.
- **Real-time logs** — per-service log streaming rendered with xterm.js, one tab per service inside the card.
- **One-click control** — start/stop a service individually, or play/stop the whole project at once.
- **Open in editor or terminal** — jump straight into a service's folder in your editor or a terminal.
- **Smart ports** — Hakko shifts a dev server off a busy port automatically and shows the port it actually bound to.
- **Local & private** — all data lives in a single hidden file on your machine. No login, no cloud, no telemetry.
- **Dark by default** — a calm zinc/neutral UI built to stay out of your way.

## How it works

1. **Drag a folder** into the window (or click **+ Add folder**).
2. Hakko **scans and detects** the services in it — usually in well under a second.
3. **Click to start.** The environment comes up, logs stream in, and you're working.

Your projects and services are persisted locally (under your platform's app config / Application Support directory) and managed entirely by the app — there's no `.yml` to maintain in your project folders.

## Tech stack

**Frontend:** React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · Framer Motion · xterm.js · lucide-react

**Backend:** Rust + [Tauri 2](https://v2.tauri.app/) — process spawning/killing (tokio), folder analysis, config persistence, and log streaming over Tauri events (serde, uuid, dirs, anyhow).

## Getting started (development)

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** (stable, via [rustup](https://rustup.rs/))
- **Xcode Command Line Tools** — `xcode-select --install`

See the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for full details.

### Run it

```bash
# install frontend dependencies
npm install

# run the app in development (hot-reloads the Rust + web layers)
npm run tauri dev

# build a production .app bundle
npm run tauri build
```

To work on the frontend in a browser without the native shell, use `npm run dev`.

## Project structure

```
hakko/
├── src/                  Frontend (React)
│   ├── components/        ProjectCard, FolderGroup, ServiceRow, LogViewer, DropZone
│   ├── hooks/             Zustand store + log event subscriptions
│   ├── lib/               Typed invoke() wrappers and shared types
│   └── App.tsx
└── src-tauri/            Backend (Rust)
    ├── src/
    │   ├── commands/      projects · detection · process · storage
    │   ├── state.rs       AppState (running processes)
    │   └── models.rs      Project / Service / ServiceState
    └── tauri.conf.json
```

The Rust `models.rs` structs mirror the TypeScript interfaces in `src/lib` so the IPC layer stays in sync. The frontend never touches the filesystem directly — everything goes through Rust commands.

## Roadmap

Hakko v1 is intentionally small. What's on deck — per-service env var UI, `.env` editing, port-conflict warnings, a per-service resource monitor, and local time/commit analytics — lives in [`ROADMAP.md`](ROADMAP.md).

## License

TBD — no license has been chosen yet. Until one is added, all rights reserved.
