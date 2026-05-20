import type { ServiceStatus } from "./types";

export const statusColor: Record<ServiceStatus, string> = {
  idle: "bg-zinc-600",
  starting: "bg-amber-400",
  running: "bg-zinc-100",
  crashed: "bg-rose-500",
  stopped: "bg-zinc-600",
};

export const statusRing: Record<ServiceStatus, string> = {
  idle: "ring-zinc-600/30",
  starting: "ring-amber-400/40",
  running: "ring-zinc-100/30",
  crashed: "ring-rose-500/40",
  stopped: "ring-zinc-600/30",
};

export const statusLabel: Record<ServiceStatus, string> = {
  idle: "Idle",
  starting: "Starting…",
  running: "Running",
  crashed: "Crashed",
  stopped: "Stopped",
};
