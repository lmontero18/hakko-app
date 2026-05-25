import { Code2, ExternalLink, Eye, Pencil, Play, RotateCcw, Square, Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Service, ServiceState } from "../lib/types";
import { statusLabel } from "../lib/status";
import { useTickingUptime } from "../lib/format";
import { api, isTauri } from "../lib/tauri";
import { toast } from "../store/toast";
import { getBrandIcon } from "../lib/brandIcons";
import { useEditors } from "../hooks/useEditors";
import { useTerminals } from "../hooks/useTerminals";
import { useProjects } from "../hooks/useProjects";
import { StatusDot } from "./StatusDot";

interface Props {
  service: Service;
  state: ServiceState | undefined;
  onToggle: (service: Service, running: boolean) => void;
  onViewLogs: (service: Service) => void;
  onDelete: (service: Service) => void;
  onEdit: (service: Service) => void;
  onRestart: (service: Service) => void;
}

export function ServiceRow({
  service,
  state,
  onToggle,
  onViewLogs,
  onDelete,
  onEdit,
  onRestart,
}: Props) {
  const status = state?.status ?? "idle";
  const isRunning = status === "running" || status === "starting";
  const isAlive = status === "running";
  const disabled = !service.enabled;
  const uptime = useTickingUptime(isAlive ? state?.startedAt : undefined);
  const brand = getBrandIcon(`${service.name} ${service.command}`);
  const BrandIcon = brand.Icon;
  // Sniffed port from logs wins over configured one (handles 3000→3001 fallback).
  const effectivePort = state?.actualPort ?? service.port;
  const editors = useEditors((s) => s.editors);
  const preferredEditor = editors[0];
  const terminals = useTerminals((s) => s.terminals);
  const preferredTerminal = terminals[0];

  async function handleOpenInTerminal() {
    if (!preferredTerminal) return;
    try {
      await api.openInTerminal(preferredTerminal.name, service.cwd);
    } catch (e) {
      toast.error(`Failed to open in ${preferredTerminal.name}: ${e}`);
    }
  }
  const isPendingRestart = useProjects((s) =>
    s.pendingRestart.has(service.id),
  );
  // The ⟲ restart button only makes sense when the user explicitly edited
  // the service while it was running. Auto-shift mismatches (port was
  // taken at start) don't get a restart suggestion since restarting would
  // just auto-shift again.
  const showRestart = isAlive && isPendingRestart;

  async function handleOpenInEditor() {
    if (!preferredEditor) return;
    try {
      await api.openInEditor(preferredEditor.name, service.cwd);
    } catch (e) {
      toast.error(`Failed to open in ${preferredEditor.name}: ${e}`);
    }
  }

  async function handleOpenUrl() {
    if (!effectivePort) return;
    const url = `http://localhost:${effectivePort}`;
    if (!isTauri()) {
      window.open(url, "_blank");
      return;
    }
    try {
      await openUrl(url);
    } catch (e) {
      toast.error(`Failed to open ${url}: ${e}`);
    }
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
        disabled ? "opacity-50" : "hover:bg-zinc-800/40"
      }`}
    >
      <StatusDot status={status} ariaLabel={statusLabel[status]} />

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BrandIcon
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: brand.color }}
        />
        <span className="truncate font-medium text-zinc-100">
          {service.name}
        </span>
        <code className="truncate font-mono text-xs text-zinc-400">
          {service.command}
        </code>
        {effectivePort !== undefined && (
          <button
            type="button"
            onClick={handleOpenUrl}
            disabled={!isAlive}
            className="group/port flex shrink-0 items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 transition-colors enabled:hover:bg-white/10 enabled:hover:text-zinc-100 disabled:cursor-default"
            title={
              isAlive
                ? `Open http://localhost:${effectivePort}${state?.actualPort && service.port && state.actualPort !== service.port ? ` (auto-fallback from :${service.port})` : ""}`
                : `Port :${effectivePort}`
            }
            aria-label={
              isAlive
                ? `Open localhost:${effectivePort}`
                : `Port ${effectivePort}`
            }
          >
            :{effectivePort}
            {state?.actualPort &&
              service.port &&
              state.actualPort !== service.port && (
                <span
                  className="text-amber-400/80"
                  title={`Configured :${service.port}, running on :${state.actualPort}`}
                >
                  ⚠
                </span>
              )}
            {isAlive && (
              <ExternalLink className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover/port:opacity-100" />
            )}
          </button>
        )}
      </div>

      <span className="hidden w-24 shrink-0 text-right text-xs text-zinc-500 sm:block">
        {isAlive && uptime ? (
          <span className="font-mono tabular-nums text-zinc-300">
            {uptime}
          </span>
        ) : (
          statusLabel[status]
        )}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(service)}
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Edit service"
          title="Edit service"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(service)}
          className="rounded p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
          aria-label="Delete service"
          title="Delete service"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {preferredEditor && (
          <button
            type="button"
            onClick={handleOpenInEditor}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label={`Open in ${preferredEditor.name}`}
            title={`Open in ${preferredEditor.name}`}
          >
            <Code2 className="h-4 w-4" />
          </button>
        )}
        {preferredTerminal && (
          <button
            type="button"
            onClick={handleOpenInTerminal}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label={`Open in ${preferredTerminal.name}`}
            title={`Open in ${preferredTerminal.name}`}
          >
            <TerminalIcon className="h-4 w-4" />
          </button>
        )}
        {showRestart && (
          <button
            type="button"
            onClick={() => onRestart(service)}
            className="rounded p-1.5 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            aria-label="Restart to apply changes"
            title="Config changed. Restart to apply."
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onViewLogs(service)}
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="View logs"
          title="View logs"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggle(service, !isRunning)}
          className={`rounded p-1.5 transition-colors ${
            isRunning
              ? "text-rose-400 hover:bg-rose-500/10"
              : "text-zinc-100 hover:bg-white/10"
          } disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label={isRunning ? "Stop service" : "Start service"}
          title={isRunning ? "Stop" : "Start"}
        >
          {isRunning ? (
            <Square className="h-4 w-4" fill="currentColor" />
          ) : (
            <Play className="h-4 w-4" fill="currentColor" />
          )}
        </button>
      </div>
    </div>
  );
}
