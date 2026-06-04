import { type Ref, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  Copy,
  Eraser,
  FolderPlus,
  Pause,
  Pencil,
  Play,
  Trash2,
  X,
} from "lucide-react";
import type { Project, Service, ServiceState } from "../lib/types";
import {
  aggregateStatus,
  countEnabled,
  countRunning,
  groupByFolder,
} from "../lib/project";
import { useProjectIcon } from "../hooks/useProjectIcon";
import { ProjectActivity } from "./ProjectActivity";
import { FolderGroup } from "./FolderGroup";
import { LogViewer, type LogViewerHandle } from "./LogViewer";
import { ActivityBars } from "./ActivityBars";

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

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
};

export function ProjectDetail({
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
  const [activeLogServiceId, setActiveLogServiceId] = useState<string | null>(
    null,
  );
  const [tab, setTab] = useState<"services" | "activity">("services");
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
  const running = countRunning(project.services, states);
  const total = countEnabled(project.services);
  const groups = groupByFolder(project.services);
  const icon = useProjectIcon(project);

  return (
    <section className="min-w-0 flex-1 overflow-y-auto">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-3xl px-6 py-6"
      >
        <motion.div
          variants={itemVariants}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-900/30 p-5 shadow-xl shadow-black/20"
        >
          <div className="relative flex items-start gap-4">
            {/* The project's own icon when we can find one, otherwise a
                colored avatar with its initial. Both keep the identity color. */}
            {icon ? (
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-zinc-900 shadow-lg ring-1 ring-white/10">
                <img src={icon} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-800 text-base font-semibold text-zinc-200 shadow-lg ring-1 ring-white/10">
                {project.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {renaming ? (
                  <input
                    ref={renameInputRef}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void saveRename();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                    onBlur={() => void saveRename()}
                    className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xl font-semibold text-zinc-100 outline-none focus:border-zinc-400"
                    maxLength={80}
                  />
                ) : (
                  <>
                    <h2 className="truncate text-xl font-semibold tracking-tight text-zinc-100">
                      {project.name}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setNameDraft(project.name);
                        setRenaming(true);
                      }}
                      className="rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-100 focus:opacity-100 group-hover:opacity-100"
                      aria-label="Rename project"
                      title="Rename project"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <ActivityBars
                  running={running}
                  total={total}
                  starting={status === "starting"}
                />
              </div>

              <div className="mt-1 text-xs text-zinc-500">
                {groups.size} folder{groups.size !== 1 ? "s" : ""} ·{" "}
                {project.services.length} service
                {project.services.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          <div className="relative mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPlayAll(project)}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-white"
            >
              <Play className="h-3.5 w-3.5" fill="currentColor" />
              Play all
            </button>
            <button
              type="button"
              onClick={() => onStopAll(project)}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              <Pause className="h-3.5 w-3.5" fill="currentColor" />
              Stop all
            </button>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => onAddFolder(project)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Add folder
              </button>
              <button
                type="button"
                onClick={() => onDeleteProject(project)}
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                aria-label="Delete project"
                title="Delete project"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-4 flex w-fit gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-0.5"
        >
          {(["services", "activity"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t}
            </button>
          ))}
        </motion.div>

        {tab === "services" && (
        <div className="mt-4 space-y-4">
          {[...groups.entries()].map(([label, services]) => (
            <motion.div key={label} variants={itemVariants}>
              <FolderGroup
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
            </motion.div>
          ))}

          {project.services.length === 0 && (
            <motion.div
              variants={itemVariants}
              className="rounded-md border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-500"
            >
              No services in this project. Add a folder or delete the project.
            </motion.div>
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
                <LogViewer ref={logViewerRef} serviceId={activeLogService.id} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {tab === "activity" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4"
          >
            <ProjectActivity projectId={project.id} />
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}
