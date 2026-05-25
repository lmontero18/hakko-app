import { create } from "zustand";
import { api, isTauri } from "../lib/tauri";
import { toast } from "../store/toast";
import type { DetectionResult, Project, Service, ServiceState } from "../lib/types";

interface ProjectsStore {
  projects: Project[];
  states: Record<string, ServiceState>;
  /** Service IDs whose running config differs from saved (user-edited mid-run). */
  pendingRestart: Set<string>;
  loading: boolean;

  load: () => Promise<void>;
  markPendingRestart: (serviceId: string) => void;
  clearPendingRestart: (serviceId: string) => void;
  createFromDetection: (detection: DetectionResult) => Promise<Project>;
  addFolderToProject: (
    projectId: string,
    detection: DetectionResult,
  ) => Promise<Project>;
  updateProject: (project: Project) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  deleteService: (projectId: string, serviceId: string) => Promise<void>;
  deleteFolder: (projectId: string, folderLabel: string) => Promise<void>;

  startService: (service: Service) => Promise<void>;
  stopService: (service: Service) => Promise<void>;
  restartService: (service: Service) => Promise<void>;
  refreshRunning: () => Promise<void>;

  applyServiceState: (state: ServiceState) => void;
}

function indexStates(list: ServiceState[]): Record<string, ServiceState> {
  return list.reduce<Record<string, ServiceState>>((acc, s) => {
    acc[s.serviceId] = s;
    return acc;
  }, {});
}

function isAlive(s: ServiceState | undefined): boolean {
  return s?.status === "running" || s?.status === "starting";
}

export const useProjects = create<ProjectsStore>((set, get) => ({
  projects: [],
  states: {},
  pendingRestart: new Set(),
  loading: false,

  markPendingRestart(serviceId) {
    set((s) => ({ pendingRestart: new Set([...s.pendingRestart, serviceId]) }));
  },
  clearPendingRestart(serviceId) {
    set((s) => {
      if (!s.pendingRestart.has(serviceId)) return s;
      const next = new Set(s.pendingRestart);
      next.delete(serviceId);
      return { pendingRestart: next };
    });
  },

  async load() {
    if (!isTauri()) {
      toast.info("Run inside Tauri (npm run tauri dev) to load real data");
      return;
    }
    set({ loading: true });
    try {
      const [projects, running] = await Promise.all([
        api.listProjects(),
        api.listRunning(),
      ]);
      set({ projects, states: indexStates(running), loading: false });
    } catch (e) {
      set({ loading: false });
      toast.error(`Failed to load projects: ${e}`);
    }
  },

  async createFromDetection(detection) {
    const project = await api.createProjectFromDetection(detection);
    set((s) => ({ projects: [...s.projects, project] }));
    return project;
  },

  async addFolderToProject(projectId, detection) {
    const updated = await api.addFolderToProject(projectId, detection);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === updated.id ? updated : p)),
    }));
    return updated;
  },

  async updateProject(project) {
    await api.updateProject(project);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === project.id ? project : p)),
    }));
  },

  async deleteProject(projectId) {
    const project = get().projects.find((p) => p.id === projectId);
    if (project) {
      for (const s of project.services) {
        if (isAlive(get().states[s.id])) {
          try {
            await api.stopService(s.id);
          } catch {
            // Best-effort; continue even if stop fails
          }
        }
      }
    }
    await api.deleteProject(projectId);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== projectId),
    }));
  },

  async deleteService(projectId, serviceId) {
    if (isAlive(get().states[serviceId])) {
      try {
        await api.stopService(serviceId);
      } catch {
        // Best-effort
      }
    }
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const updated: Project = {
      ...project,
      services: project.services.filter((s) => s.id !== serviceId),
    };
    await api.updateProject(updated);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === projectId ? updated : p)),
    }));
  },

  async deleteFolder(projectId, folderLabel) {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const inFolder = project.services.filter(
      (s) => (s.folderLabel ?? "(root)") === folderLabel,
    );
    for (const s of inFolder) {
      if (isAlive(get().states[s.id])) {
        try {
          await api.stopService(s.id);
        } catch {
          // Best-effort
        }
      }
    }
    const updated: Project = {
      ...project,
      services: project.services.filter(
        (s) => (s.folderLabel ?? "(root)") !== folderLabel,
      ),
    };
    await api.updateProject(updated);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === projectId ? updated : p)),
    }));
  },

  async startService(service) {
    // Starting fresh — config is now in sync with what's running.
    get().clearPendingRestart(service.id);
    // Optimistic "starting" — keep any prior fields if they exist.
    set((s) => ({
      states: {
        ...s.states,
        [service.id]: {
          ...s.states[service.id],
          serviceId: service.id,
          status: "starting",
        },
      },
    }));
    try {
      const pid = await api.startService(service.id);
      // Merge into whatever the backend's service-status event already set
      // (notably `actualPort` which arrives via event before this resolves).
      set((s) => ({
        states: {
          ...s.states,
          [service.id]: {
            ...s.states[service.id],
            serviceId: service.id,
            status: "running",
            pid,
            startedAt: new Date().toISOString(),
          },
        },
      }));
    } catch (e) {
      set((s) => ({
        states: {
          ...s.states,
          [service.id]: { serviceId: service.id, status: "crashed" },
        },
      }));
      toast.error(`Failed to start ${service.name}: ${e}`);
    }
  },

  async stopService(service) {
    try {
      await api.stopService(service.id);
      get().clearPendingRestart(service.id);
      set((s) => ({
        states: {
          ...s.states,
          [service.id]: { serviceId: service.id, status: "stopped" },
        },
      }));
    } catch (e) {
      toast.error(`Failed to stop ${service.name}: ${e}`);
    }
  },

  async restartService(service) {
    try {
      await api.stopService(service.id);
      // Wait for the backend to fully finalize the process (waiter task
      // sends `service-status` Stopped/Crashed when done). Poll briefly.
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const status = get().states[service.id]?.status;
        if (status !== "running" && status !== "starting") break;
        await new Promise((r) => setTimeout(r, 200));
      }
      await get().startService(service);
    } catch (e) {
      toast.error(`Failed to restart ${service.name}: ${e}`);
    }
  },

  async refreshRunning() {
    if (!isTauri()) return;
    try {
      const running = await api.listRunning();
      set({ states: indexStates(running) });
    } catch {
      // Non-fatal
    }
  },

  applyServiceState(serviceState) {
    set((s) => ({
      states: { ...s.states, [serviceState.serviceId]: serviceState },
    }));
  },
}));
