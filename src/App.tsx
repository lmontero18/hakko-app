import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2, Network } from "lucide-react";
import { HakkoLogo } from "./components/HakkoLogo";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DropZone } from "./components/DropZone";
import { EmptyState } from "./components/EmptyState";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { ProjectDetail } from "./components/ProjectDetail";
import { CreateProjectDialog } from "./components/CreateProjectDialog";
import { EditServiceDialog } from "./components/EditServiceDialog";
import { PortsPanel } from "./components/PortsPanel";
import { StatsPanel } from "./components/StatsPanel";
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
  const [statsOpen, setStatsOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );

  const loadEditors = useEditors((s) => s.load);
  const loadTerminals = useTerminals((s) => s.load);
  useEffect(() => {
    load();
    void loadEditors();
    void loadTerminals();
  }, [load, loadEditors, loadTerminals]);

  useServiceEvents();

  // Keep a valid project selected: default to the first, re-point if the
  // selected one was deleted, and clear when there are no projects.
  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }
    setSelectedProjectId((cur) =>
      cur && projects.some((p) => p.id === cur) ? cur : projects[0].id,
    );
  }, [projects]);

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

  async function handleCreateEnvFromExample(rootPath: string) {
    try {
      const files = await api.readEnvFiles(rootPath);
      const example = files.find((f) => f.name === ".env.example");
      if (!example) {
        toast.error("No .env.example found in this folder");
        return;
      }
      await api.writeEnvFile(rootPath, ".env", example.content);
      toast.success("Created .env from .env.example");
      setPendingDetection((d) =>
        d
          ? {
              ...d,
              warnings: d.warnings.filter((w) => !w.startsWith("Missing .env")),
            }
          : d,
      );
    } catch (e) {
      toast.error(`Failed to create .env: ${e}`);
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

  async function handleCreateNew(detection: DetectionResult) {
    const project = await createFromDetection(detection);
    setSelectedProjectId(project.id);
  }

  async function handleAddToExisting(
    projectId: string,
    detection: DetectionResult,
  ) {
    await addFolderToProject(projectId, detection);
    setSelectedProjectId(projectId);
  }

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) ?? null;

  return (
    <main
      onMouseDown={handleWindowMouseDown}
      className="flex h-screen flex-col bg-zinc-950 text-zinc-100"
    >
      <header className="z-30 flex shrink-0 select-none items-center gap-3 border-b border-white/5 bg-zinc-950/40 py-3 pl-24 pr-6 backdrop-blur-2xl">
        <HakkoLogo className="h-5 w-5 text-zinc-100" />
        <h1 className="text-sm font-semibold tracking-tight">Hakko</h1>
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
          v0.2
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
            onClick={() => setStatsOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800"
            title="Time tracking"
          >
            <BarChart3 className="h-4 w-4" />
            Stats
          </button>
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
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 py-8">
            <EmptyState onPickFolder={handlePickFolder} isOver={isOver} />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ProjectSidebar
            projects={projects}
            states={states}
            selectedId={selectedProjectId}
            onSelect={(id) => setSelectedProjectId(id)}
            onAdd={handlePickFolder}
          />
          {selectedProject ? (
            <ProjectDetail
              key={selectedProject.id}
              project={selectedProject}
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
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
              Select a project
            </div>
          )}
        </div>
      )}

      {isOver && projects.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-dashed border-zinc-600 px-8 py-6 text-sm font-medium text-zinc-200">
            Drop a folder to add a project
          </div>
        </div>
      )}

      <CreateProjectDialog
        detection={pendingDetection}
        projects={projects}
        onClose={() => setPendingDetection(null)}
        onCreateNew={handleCreateNew}
        onAddToExisting={handleAddToExisting}
        onCreateEnvFromExample={handleCreateEnvFromExample}
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

      <StatsPanel open={statsOpen} onClose={() => setStatsOpen(false)} />

      <Toaster />
    </main>
  );
}

export default App;
