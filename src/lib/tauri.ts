import { invoke } from "@tauri-apps/api/core";
import type {
  DetectionResult,
  LogPayload,
  Project,
  ServiceState,
} from "./types";

export const api = {
  listProjects: () => invoke<Project[]>("list_projects"),

  detectServices: (path: string) =>
    invoke<DetectionResult>("detect_services", { path }),

  createProjectFromDetection: (detection: DetectionResult) =>
    invoke<Project>("create_project_from_detection", { detection }),

  addFolderToProject: (projectId: string, detection: DetectionResult) =>
    invoke<Project>("add_folder_to_project", { projectId, detection }),

  updateProject: (project: Project) =>
    invoke<void>("update_project", { project }),

  deleteProject: (projectId: string) =>
    invoke<void>("delete_project", { projectId }),

  startService: (serviceId: string) =>
    invoke<number>("start_service", { serviceId }),

  stopService: (serviceId: string) =>
    invoke<void>("stop_service", { serviceId }),

  listRunning: () => invoke<ServiceState[]>("list_running"),

  getRecentLogs: (serviceId: string) =>
    invoke<LogPayload[]>("get_recent_logs", { serviceId }),

  listListeningPorts: () => invoke<PortInfo[]>("list_listening_ports"),

  killPortProcess: (pid: number, force: boolean) =>
    invoke<void>("kill_port_process", { pid, force }),
};

export interface PortInfo {
  port: number;
  pid: number;
  command: string;
  address: string;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
