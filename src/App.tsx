import { useCallback, useEffect, useState } from "react";
import { Loader2, Network } from "lucide-react";
import { HakkoLogo } from "./components/HakkoLogo";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DropZone } from "./components/DropZone";
import { EmptyState } from "./components/EmptyState";
import { ProjectCard } from "./components/ProjectCard";
import { CreateProjectDialog } from "./components/CreateProjectDialog";
import { EditServiceDialog } from "./components/EditServiceDialog";
import { PortsPanel } from "./components/PortsPanel";
import { useProjects } from "./hooks/useProjects";
import { useDragDrop } from "./hooks/useDragDrop";
import { useServiceEvents } from "./hooks/useServiceEvents";
import { useEditors } from "./hooks/useEditors";
import { useTerminals } from "./hooks/useTerminals";
import { api, isTauri } from "./lib/tauri";
import { toast } from "./store/toast";
import { Toaster } from "./components/Toaster";
import type { DetectionResult, Project, Service } from "./lib/types";

function App() {
  const {
    projects,
    states,
    loading,
    load,
    createFromDetection,
    addFolderToProject,
    startService,
    stopService,
    deleteService,
    deleteFolder,
    deleteProject,
    updateProject,
    restartService,
    markPendingRestart,
  } = useProjects();

  const [pendingDetection, setPendingDetection] =
    useState<DetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [editing, setEditing] = useState<{
    project: Project;
    service: Service;
  } | null>(null);
  const [portsOpen, setPortsOpen] = useState(false);

  const loadEditors = useEditors((s) => s.load);
  const loadTerminals = useTerminals((s) => s.load);
  useEffect(() => {
    load();
    void loadEditors();
    void loadTerminals();
  }, [load, loadEditors, loadTerminals]);

  useServiceEvents();

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onCloseRequested(async (event) => {
        // Always prevent Tauri's default close — we take ownership of the
        // lifecycle and call destroy() ourselves when ready. This avoids
        // edge cases where preventDefault() detection misfires with
        // titleBarStyle: "Overlay" on macOS.
        event.preventDefault();

        const running = Object.values(useProjects.getState().states).filter(
          (s) => s.status === "running" || s.status === "starting",
        );

        if (running.length > 0) {
          const label =
            running.length === 1
              ? "1 service"
              : `${running.length} services`;
          const ok = await confirm(
            `${label} currently running will be stopped before Hakko quits.`,
            {
              title: "Quit Hakko?",
              kind: "warning",
              okLabel: "Stop & Quit",
              cancelLabel: "Cancel",
            },
          );
          if (!ok) return; // user cancelled — keep window open
          await Promise.allSettled(
            running.map((s) => api.stopService(s.serviceId)),
          );
        }

        // destroy() bypasses closeRequested, no recursive loop possible.
        await getCurrentWindow().destroy();
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const runDetection = useCallback(async (path: string) => {
    if (!isTauri()) {
      toast.error("Run inside Tauri (npm run tauri dev) to add folders");
      return;
    }
    setDetecting(true);
    try {
      const detection = await api.detectServices(path);
      setPendingDetection(detection);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDetecting(false);
    }
  }, []);

  const handleDropPaths = useCallback(
    (paths: string[]) => {
      const first = paths[0];
      if (first) void runDetection(first);
    },
    [runDetection],
  );

  const { isOver } = useDragDrop({ onDropPaths: handleDropPaths });

  async function handlePickFolder() {
    if (!isTauri()) {
      toast.error("Run inside Tauri (npm run tauri dev) to add folders");
      return;
    }
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked === "string") {
      void runDetection(picked);
    }
  }

  function handleToggleService(service: Service, running: boolean) {
    if (running) void startService(service);
    else void stopService(service);
  }

  function handlePlayAll(project: Project) {
    for (const s of project.services) {
      if (s.enabled) void startService(s);
    }
  }

  function handleStopAll(project: Project) {
    for (const s of project.services) {
      void stopService(s);
    }
  }

  function handleAddFolder(_project?: Project) {
    void handlePickFolder();
  }

  async function handleWindowMouseDown(e: React.MouseEvent) {
    if (!isTauri() || e.buttons !== 1) return;
    if (
      e.target instanceof Element &&
      e.target.closest(
        "button, a, input, select, textarea, label, [role='button'], .xterm",
      )
    ) {
      return;
    }
    await getCurrentWindow().startDragging().catch(() => {});
  }

  function aliveSummary(serviceIds: string[]): string {
    const alive = serviceIds.filter((id) => {
      const st = states[id]?.status;
      return st === "running" || st === "starting";
    });
    if (alive.length === 0) return "";
    return ` ${alive.length} service${alive.length !== 1 ? "s" : ""} currently running will be stopped.`;
  }

  async function handleDeleteService(project: Project, service: Service) {
    const ok = await confirm(
      `Delete "${service.name}" from ${project.name}?${aliveSummary([service.id])}`,
      { title: "Delete service", kind: "warning", okLabel: "Delete" },
    );
    if (!ok) return;
    try {
      await deleteService(project.id, service.id);
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function handleDeleteFolder(project: Project, folderLabel: string) {
    const inFolder = project.services.filter(
      (s) => (s.folderLabel ?? "(root)") === folderLabel,
    );
    const ok = await confirm(
      `Delete folder "${folderLabel}" from ${project.name}? ${inFolder.length} service${inFolder.length !== 1 ? "s" : ""} will be removed.${aliveSummary(inFolder.map((s) => s.id))}`,
      { title: "Delete folder", kind: "warning", okLabel: "Delete" },
    );
    if (!ok) return;
    try {
      await deleteFolder(project.id, folderLabel);
    } catch (e) {
      toast.error(String(e));
    }
  }

  function handleEditService(project: Project, service: Service) {
    setEditing({ project, service });
  }

  function handleRestartService(_project: Project, service: Service) {
    toast.info(`Restarting ${service.name}…`);
    void restartService(service);
  }

  async function handleRenameProject(project: Project, newName: string) {
    try {
      await updateProject({ ...project, name: newName });
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function handleSaveEditedService(updated: Service) {
    if (!editing) return;
    const previous = editing.service;
    const isRunning =
      states[updated.id]?.status === "running" ||
      states[updated.id]?.status === "starting";
    const portChanged = previous.port !== updated.port;
    const commandChanged = previous.command !== updated.command;
    const cmdRelevantChange = portChanged || commandChanged;

    const newProject: Project = {
      ...editing.project,
      services: editing.project.services.map((s) =>
        s.id === updated.id ? updated : s,
      ),
    };
    try {
      await updateProject(newProject);
      if (isRunning && cmdRelevantChange) {
        markPendingRestart(updated.id);
        toast.info(
          `"${updated.name}" updated. Restart it to apply ${portChanged ? "port" : "command"} changes.`,
        );
      } else {
        toast.success(`Updated "${updated.name}"`);
      }
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function handleDeleteProject(project: Project) {
    const ok = await confirm(
      `Delete project "${project.name}"? This cannot be undone.${aliveSummary(project.services.map((s) => s.id))}`,
      { title: "Delete project", kind: "warning", okLabel: "Delete" },
    );
    if (!ok) return;
    try {
      await deleteProject(project.id);
    } catch (e) {
      toast.error(String(e));
    }
  }

  return (
    <main
      onMouseDown={handleWindowMouseDown}
      className="min-h-full bg-zinc-950 text-zinc-100"
    >
      <header className="sticky top-0 z-30 select-none border-b border-white/5 bg-zinc-950/40 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 py-3 pl-24 pr-6">
          <HakkoLogo className="h-5 w-5 text-zinc-100" />
          <h1 className="text-sm font-semibold tracking-tight">Hakko</h1>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            v0.1
          </span>
          <div className="ml-auto flex items-center gap-2">
            {detecting && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyzing…
              </span>
            )}
            <button
              type="button"
              onClick={() => setPortsOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800"
              title="See open ports"
            >
              <Network className="h-4 w-4" />
              Ports
            </button>
            <DropZone onPickFolder={handlePickFolder} compact />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading projects…
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onPickFolder={handlePickFolder} isOver={isOver} />
        ) : (
          <>
            <div className="space-y-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  states={states}
                  onToggleService={handleToggleService}
                  onPlayAll={handlePlayAll}
                  onStopAll={handleStopAll}
                  onAddFolder={handleAddFolder}
                  onDeleteService={handleDeleteService}
                  onDeleteFolder={handleDeleteFolder}
                  onDeleteProject={handleDeleteProject}
                  onEditService={handleEditService}
                  onRenameProject={handleRenameProject}
                  onRestartService={handleRestartService}
                />
              ))}
            </div>
            <DropZone onPickFolder={handlePickFolder} isOver={isOver} />
          </>
        )}
      </div>

      <CreateProjectDialog
        detection={pendingDetection}
        projects={projects}
        onClose={() => setPendingDetection(null)}
        onCreateNew={createFromDetection}
        onAddToExisting={addFolderToProject}
      />

      <EditServiceDialog
        service={editing?.service ?? null}
        isRunning={
          editing
            ? states[editing.service.id]?.status === "running" ||
              states[editing.service.id]?.status === "starting"
            : false
        }
        onClose={() => setEditing(null)}
        onSave={handleSaveEditedService}
      />

      <PortsPanel open={portsOpen} onClose={() => setPortsOpen(false)} />

      <Toaster />
    </main>
  );
}

export default App;
