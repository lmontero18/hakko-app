import type { Ref } from "react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Copy,
  Eraser,
  FolderPlus,
  Pause,
  Pencil,
  Play,
  Trash2,
  X,
} from "lucide-react";
import type { Project, Service, ServiceState, ServiceStatus } from "../lib/types";
import { FolderGroup } from "./FolderGroup";
import { LogViewer, type LogViewerHandle } from "./LogViewer";
import { StatusDot } from "./StatusDot";

interface Props {
  project: Project;
  states: Record<string, ServiceState>;
  onToggleService: (service: Service, running: boolean) => void;
  onPlayAll: (project: Project) => void;
  onStopAll: (project: Project) => void;
  onAddFolder: (project: Project) => void;
  onDeleteService: (project: Project, service: Service) => void;
  onDeleteFolder: (project: Project, folderLabel: string) => void;
  onDeleteProject: (project: Project) => void;
  onEditService: (project: Project, service: Service) => void;
  onRenameProject: (project: Project, newName: string) => void | Promise<void>;
  onRestartService: (project: Project, service: Service) => void;
}

function aggregateStatus(
  services: Service[],
  states: Record<string, ServiceState>,
): ServiceStatus {
  const enabled = services.filter((s) => s.enabled);
  const statuses = enabled.map((s) => states[s.id]?.status ?? "idle");
  if (statuses.some((s) => s === "crashed")) return "crashed";
  if (statuses.some((s) => s === "starting")) return "starting";
  if (statuses.some((s) => s === "running")) return "running";
  if (statuses.every((s) => s === "stopped") && statuses.length > 0)
    return "stopped";
  return "idle";
}

function groupByFolder(services: Service[]): Map<string, Service[]> {
  const groups = new Map<string, Service[]>();
  for (const service of services) {
    const key = service.folderLabel ?? "(root)";
    const list = groups.get(key) ?? [];
    list.push(service);
    groups.set(key, list);
  }
  return groups;
}

export function ProjectCard({
  project,
  states,
  onToggleService,
  onPlayAll,
  onStopAll,
  onAddFolder,
  onDeleteService,
  onDeleteFolder,
  onDeleteProject,
  onEditService,
  onRenameProject,
  onRestartService,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [activeLogServiceId, setActiveLogServiceId] = useState<string | null>(
    null,
  );
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const logViewerRef: Ref<LogViewerHandle> = useRef(null);

  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  function startRename(e: React.MouseEvent) {
    e.stopPropagation();
    setNameDraft(project.name);
    setRenaming(true);
  }

  function cancelRename() {
    setNameDraft(project.name);
    setRenaming(false);
  }

  async function saveRename() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === project.name) {
      cancelRename();
      return;
    }
    try {
      await onRenameProject(project, trimmed);
    } finally {
      setRenaming(false);
    }
  }

  function handleViewLogs(service: Service) {
    setActiveLogServiceId((curr) => (curr === service.id ? null : service.id));
  }

  const activeLogService = activeLogServiceId
    ? project.services.find((s) => s.id === activeLogServiceId)
    : null;

  const status = aggregateStatus(project.services, states);
  const runningCount = project.services.filter(
    (s) => states[s.id]?.status === "running",
  ).length;
  const totalEnabled = project.services.filter((s) => s.enabled).length;
  const groups = groupByFolder(project.services);

  return (
    <motion.div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 transition-colors duration-200 hover:border-zinc-700">
      <div
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        tabIndex={0}
        aria-expanded={expanded}
        className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-800/40 focus:outline-none focus-visible:bg-zinc-800/40"
      >
        <StatusDot status={status} size="md" />

        <div
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: project.color ?? "#52525b" }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {renaming ? (
              <input
                ref={renameInputRef}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveRename();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                onBlur={() => void saveRename()}
                className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-base font-semibold text-zinc-100 outline-none focus:border-zinc-400"
                maxLength={80}
              />
            ) : (
              <>
                <h2 className="truncate text-base font-semibold text-zinc-100">
                  {project.name}
                </h2>
                <button
                  type="button"
                  onClick={startRename}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
                  aria-label="Rename project"
                  title="Rename project"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </>
            )}
            <span className="ml-auto text-xs text-zinc-500">
              {runningCount} / {totalEnabled} running
            </span>
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {groups.size} folder{groups.size !== 1 ? "s" : ""} ·{" "}
            {project.services.length} service
            {project.services.length !== 1 ? "s" : ""}
          </div>
        </div>

        <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
          <ChevronDown className="h-5 w-5 text-zinc-500" />
        </motion.div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-zinc-800"
          >
            <div className="space-y-4 px-5 py-4">
              {[...groups.entries()].map(([label, services]) => (
                <FolderGroup
                  key={label}
                  folderLabel={label}
                  services={services}
                  states={states}
                  onToggleService={onToggleService}
                  onViewLogs={handleViewLogs}
                  onDeleteService={(service) => onDeleteService(project, service)}
                  onDeleteFolder={(folder) => onDeleteFolder(project, folder)}
                  onEditService={(service) => onEditService(project, service)}
                  onRestartService={(service) => onRestartService(project, service)}
                />
              ))}

              {project.services.length === 0 && (
                <div className="rounded-md border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-500">
                  No services in this project. Add a folder or delete the
                  project.
                </div>
              )}

              <AnimatePresence>
                {activeLogService && (
                  <motion.div
                    key={activeLogService.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                      <span className="font-medium text-zinc-200">
                        Logs · {activeLogService.name}
                      </span>
                      <code className="truncate font-mono text-zinc-500">
                        {activeLogService.command}
                      </code>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void logViewerRef.current?.copy()}
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                          aria-label="Copy logs"
                          title="Copy logs"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => logViewerRef.current?.clear()}
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                          aria-label="Clear logs"
                          title="Clear logs"
                        >
                          <Eraser className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveLogServiceId(null)}
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                          aria-label="Close logs"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <LogViewer
                      ref={logViewerRef}
                      serviceId={activeLogService.id}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => onAddFolder(project)}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Add folder
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteProject(project)}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete project
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPlayAll(project)}
                    className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/15"
                  >
                    <Play className="h-3.5 w-3.5" fill="currentColor" />
                    Play all
                  </button>
                  <button
                    type="button"
                    onClick={() => onStopAll(project)}
                    className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
                  >
                    <Pause className="h-3.5 w-3.5" fill="currentColor" />
                    Stop all
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
