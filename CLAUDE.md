# [App Name] — Project Overview

## What is this

Hakko is a desktop application that acts as a visual dashboard for managing local development environments. Each project is represented as a "card" containing one or more services (commands like `npm run dev`, `docker compose up`, `npm run develop` for Strapi, etc.). The user clicks a card to expand it, then start/stop services individually or all at once, with real-time logs streamed per service.

The goal is to eliminate the friction of `cd`-ing into multiple directories and remembering which commands to run for each project. The user opens the app, clicks a card, and the entire environment is up and running.

## Why it exists

Solo developers and small teams juggling 3+ active projects waste significant time on:

- Navigating between project directories
- Remembering which commands to run and in what order
- Checking which services are currently running
- Aggregating logs from multiple terminals

Existing tools (Docker Desktop, Lazydocker, Tilt, tmuxinator) solve parts of this but are fragmented, CLI-heavy, or container-only. The bet here: a clean, opinionated UI that wraps the commands developers already know, agnostic to stack, with **zero manual configuration**.

## Core UX principle: zero forms

The defining product decision is **zero manual setup**. The user never writes config files, never fills out forms with command names and paths. The app detects everything by scanning the folders the user drops in. Editing is available, but only as a fallback for cases auto-detection misses.

## Target users

- Indie developers with multiple side projects
- Small dev shops/agencies juggling client environments
- Stack-agnostic: works with anything that runs from a shell command (Vite, Next.js, Strapi, Docker, Python, etc.)

## Tech stack

- **Framework:** Tauri 2 (Rust backend + web frontend, native WebView)
- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **State management:** Zustand
- **Animations:** Framer Motion
- **Icons:** lucide-react
- **Terminal/logs rendering:** xterm.js (`@xterm/xterm` + `@xterm/addon-fit`)
- **Rust crates:** `tauri` (core), `serde` + `serde_json` (serialization), `tokio` (async runtime for spawning processes), `uuid` (IDs), `dirs` (finding home/config directories), `anyhow` (error handling)

## Architecture

### Two layers

1. **Frontend (React)** — All UI, project list, cards, modals, log viewers. Calls Rust via `invoke()`.
2. **Backend (Rust)** — Process spawning/killing, file I/O, folder analysis, config persistence, log streaming via Tauri events.

### Project structure

```
[app-name]/
├── src/                          (Frontend)
│   ├── components/
│   │   ├── ProjectCard.tsx       — One card per project
│   │   ├── FolderGroup.tsx       — Group of services within a card, by folder
│   │   ├── ServiceRow.tsx        — Individual service row
│   │   ├── LogViewer.tsx         — xterm.js wrapper
│   │   └── DropZone.tsx          — Drag-and-drop area for folders
│   ├── hooks/
│   │   ├── useProjects.ts        — Zustand store for project list
│   │   └── useServiceLogs.ts     — Subscribes to Tauri log events
│   ├── lib/
│   │   ├── tauri.ts              — Typed wrappers around invoke()
│   │   └── types.ts              — TS interfaces (mirror Rust structs)
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                    (Backend)
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── projects.rs       — CRUD: list/create/update/delete
│   │   │   ├── detection.rs      — analyze a folder, return detected services
│   │   │   ├── process.rs        — spawn/stop/list running
│   │   │   └── storage.rs        — read/write app database
│   │   ├── state.rs              — AppState (HashMap of running processes)
│   │   └── models.rs             — Project, Service, ServiceState structs
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## Data model

A project is a logical grouping of services — it does NOT have its own path. Each service carries its own absolute path. This allows a single project to span multiple folders (e.g., separate `ecoterra-frontend` and `ecoterra-backend` repositories grouped under one "Ecoterra" project).

```typescript
type ServiceStatus = 'idle' | 'starting' | 'running' | 'crashed' | 'stopped';

interface Service {
  id: string;
  name: string;            // e.g. "Frontend", "Strapi", "Docker"
  command: string;         // e.g. "npm run dev"
  cwd: string;             // ABSOLUTE path to the folder where command runs
  folderLabel?: string;    // display label for grouping (e.g. "ecoterra-frontend")
  port?: number;           // display only, not enforced
  env?: Record<string, string>;
  enabled: boolean;        // user can toggle off without deleting
}

interface Project {
  id: string;
  name: string;            // editable, defaults to first folder's name
  color?: string;          // for visual identity
  services: Service[];     // services may live in different folders
  createdAt: string;
}

interface ServiceState {
  serviceId: string;
  status: ServiceStatus;
  pid?: number;
  startedAt?: string;
}
```

Mirror these structs in Rust with `serde::Serialize` + `serde::Deserialize` derives.

## Persistence strategy

All app data lives in a single hidden file, managed entirely by the app. The user never sees it, never edits it.

- **Location:** `~/.config/[app-name]/db.json` (or platform equivalent via `dirs` crate)
- **Format:** JSON serialized by `serde_json`
- **Contents:** array of projects with all their services

The user does not configure persistence. There is no `.yml` file in the project folders. The app is the source of truth.

**Future v2 feature:** optional "Export config to project folder" button that writes a portable file alongside the project, for sharing with teammates. Out of scope for v1.

## Auto-detection (the magic)

When the user drops a folder, the app runs `detect_services(path)` in Rust. This function scans for known signals and returns a list of services. No user input required.

Detection rules (Rust pseudocode):

```rust
async fn detect_services(path: &Path) -> DetectionResult {
    let mut services = vec![];
    let folder_label = path.file_name().unwrap().to_string_lossy().to_string();

    // Node.js detection (root-level)
    if let Some(pkg) = read_package_json(path) {
        let deps = pkg.all_dependencies();
        // Framework detection priority: Next > Vite > Strapi > generic
        if deps.contains_key("next") {
            services.push(Service::new("Frontend (Next.js)", "npm run dev", path));
        } else if deps.contains_key("vite") {
            services.push(Service::new("Frontend (Vite)", "npm run dev", path));
        } else if deps.contains_key("@strapi/strapi") {
            services.push(Service::new("Strapi", "npm run develop", path));
        } else if pkg.scripts.contains_key("dev") {
            services.push(Service::new(&folder_label, "npm run dev", path));
        } else if pkg.scripts.contains_key("start") {
            services.push(Service::new(&folder_label, "npm start", path));
        }
    }

    // Subfolder detection (monorepo / split structures)
    for subdir in &["backend", "server", "api", "frontend", "client", "web"] {
        let sub_path = path.join(subdir);
        if sub_path.is_dir() {
            // Recursively detect services in subfolder
            // Each detected service uses sub_path as cwd, with folderLabel = "<root>/<subdir>"
        }
    }

    // Docker
    if path.join("docker-compose.yml").exists()
       || path.join("docker-compose.yaml").exists() {
        services.push(Service::new("Docker", "docker compose up", path));
    }

    // Other languages
    if path.join("Cargo.toml").exists() {
        services.push(Service::new("Rust", "cargo run", path));
    }
    if path.join("manage.py").exists() {
        services.push(Service::new("Django", "python manage.py runserver", path));
    }
    if path.join("pyproject.toml").exists() && path.join("main.py").exists() {
        services.push(Service::new("Python", "python main.py", path));
    }

    // Warnings
    let mut warnings = vec![];
    if path.join(".env.example").exists() && !path.join(".env").exists() {
        warnings.push("Missing .env file (.env.example exists)".into());
    }

    DetectionResult { folder_label, services, warnings }
}
```

The function is fast (filesystem reads only, no network), runs in ~50–200ms for typical projects.

## Project creation flow (UX)

1. User drags a folder into the app window OR clicks "+ Add folder" → file picker
2. App calls `detect_services(folderPath)` in Rust
3. Brief loading state ("Analyzing folder...")
4. One small dialog appears with two options: **"Create new project"** (default — Enter key confirms) or **"Add to existing project"** (dropdown with current projects)
5. User picks; project card either appears (new) or expands the existing card with the new folder's services grouped under it
6. Done. No forms. No commands typed.

If the user picks "Create new project", the project name defaults to the folder name and can be renamed later via right-click → Rename.

## Multi-folder projects

A project can span multiple folders. Example:

```
Project: "Ecoterra"
├── Folder: ecoterra-frontend       → 1 service: Next.js
├── Folder: ecoterra-backend        → 2 services: Strapi, Docker
└── Folder: ecoterra-mobile         → 1 service: Expo
```

UI representation when card is expanded:

```
┌─ Ecoterra ──────────────────────────────────────┐
│  📁 ecoterra-frontend                           │
│     ● Frontend (Next.js)   npm run dev   [▶]   │
│                                                  │
│  📁 ecoterra-backend                            │
│     ● Strapi               npm run develop [▶] │
│     ● Docker               docker compose  [▶] │
│                                                  │
│  📁 ecoterra-mobile                             │
│     ● Expo                 npm run start  [▶]  │
│                                                  │
│  [+ Add folder]    [▶ Play all]   [⏸ Stop all] │
└──────────────────────────────────────────────────┘
```

To add another folder to an existing project: button "+ Add folder" inside the expanded card OR drag-and-drop a folder onto the card itself.

## Rust commands (IPC surface)

The minimum set for v1:

```rust
#[tauri::command]
async fn list_projects() -> Result<Vec<Project>, String>;

#[tauri::command]
async fn detect_services(path: String) -> Result<DetectionResult, String>;
// Pure: scans the folder, returns suggested services. Does NOT save anything.

#[tauri::command]
async fn create_project_from_detection(detection: DetectionResult) -> Result<Project, String>;
// Creates a new project with the detected services, persists to db.json

#[tauri::command]
async fn add_folder_to_project(project_id: String, detection: DetectionResult) -> Result<Project, String>;
// Appends detected services to an existing project

#[tauri::command]
async fn update_project(project: Project) -> Result<(), String>;
// For renames, color changes, manual service edits

#[tauri::command]
async fn delete_project(project_id: String) -> Result<(), String>;

#[tauri::command]
async fn start_service(service_id: String) -> Result<u32, String>;
// returns PID

#[tauri::command]
async fn stop_service(service_id: String) -> Result<(), String>;

#[tauri::command]
async fn list_running() -> Result<Vec<ServiceState>, String>;
```

## Log streaming

Spawn child processes with stdout/stderr piped. In a Tokio task, read line-by-line and emit Tauri events:

```rust
window.emit("service-log", LogPayload {
    service_id,
    line,
    stream,        // "stdout" or "stderr"
    timestamp,
})?;
```

Frontend subscribes per service:

```ts
import { listen } from '@tauri-apps/api/event';

listen<LogPayload>('service-log', (event) => {
  if (event.payload.serviceId === currentServiceId) {
    xtermInstance.writeln(event.payload.line);
  }
});
```

## State management

- **Frontend:** Zustand store holds projects array + ephemeral `runningServices` map (serviceId → status). Updates come from polling `list_running()` on mount + reactive event listeners.
- **Backend:** `AppState` with `Mutex<HashMap<String, ChildHandle>>` keyed by serviceId. Stored in Tauri's managed state.

## UI/UX principles

- Dark theme by default (zinc/neutral palette, `bg-zinc-950`)
- Cards with status indicator dot (gray idle, yellow starting, green running, red crashed)
- Expanding a card reveals services grouped visually by folder
- Logs shown in tabs within the expanded card (one tab per service), rendered with xterm.js
- Drag-and-drop is the primary way to add folders. File picker is the secondary path.
- Editing services is hidden behind a small "edit" icon — most users will never need it
- Framer Motion for card expand/collapse and modal transitions
- No login, no cloud, no telemetry in v1. Everything local.

## V1 scope (build in this order)

1. ✅ Static UI with mock data (current state)
2. Shared types in TS + Rust mirroring `models.rs`
3. Storage layer: read/write `db.json`
4. Auto-detection logic in Rust — the magic
5. Drag-and-drop + "+ Add folder" UI
6. Project creation flow with the new/existing dialog
7. Card expansion with folder grouping
8. Process spawning: `start_service` / `stop_service` with Tokio
9. Real-time log streaming with Tauri events + xterm.js
10. Project rename, service toggle (enable/disable), service delete
11. Visual polish: animations, status indicators, empty states

## Out of scope for v1 (deferred to v2)

- Export config to project folder (for team sharing)
- Templates ("Next.js + Strapi", "Vite + Express", etc.)
- System tray + global hotkeys
- Port conflict detection
- Per-service environment variable UI
- `.env` editor inside the app
- Auto-update mechanism
- Code signing for distribution
- Re-scan folder for new services after initial detection
- Cloud sync / multi-device

## Constraints and conventions

- All `cwd` values in services are absolute paths. No relative paths.
- Service IDs and project IDs are UUIDv4 strings
- Errors from Rust commands return `Result<T, String>` (string error messages, displayed as toasts)
- Frontend never directly touches the file system — always goes through Rust
- Process killing uses SIGTERM first, SIGKILL after 5s timeout
- xterm.js instances are created once per service and kept alive while the card is expanded; logs are buffered in Rust if no listener is active (last 1000 lines)
- Detection is one-shot at folder-add time. The folder is NOT re-scanned automatically afterward (deferred to v2).

## Naming TODO

The app currently has no name. Once chosen:

- Replace `[App Name]` and `[app-name]` placeholders throughout
- Update `tauri.conf.json` identifier and product name
- Decide config directory name (`~/.config/<name>/`)
