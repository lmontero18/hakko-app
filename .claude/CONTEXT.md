# [App Name] — Project Overview

## What is this

[App Name] is a desktop application that acts as a visual dashboard for managing local development environments. Each project is represented as a "card" containing one or more services (commands like `npm run dev`, `docker compose up`, `npm run develop` for Strapi, etc.). The user clicks a card to expand it, then start/stop services individually or all at once, with real-time logs streamed per service.

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
- **Rust crates:**
  - `tauri` — core
  - `serde` + `serde_json` — serialization
  - `tokio` — async runtime for spawning processes
  - `uuid` — IDs
  - `dirs` — finding home/config directories
  - `anyhow` — error handling

## Architecture

### Two layers
1. **Frontend (React)** — All UI, project list, cards, modals, log viewers. Calls Rust via `invoke()`.
2. **Backend (Rust)** — Process spawning/killing, file I/O, folder analysis, config persistence, log streaming via Tauri events.

### Project structure