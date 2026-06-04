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

  listAvailableEditors: () =>
    invoke<EditorInfo[]>("list_available_editors"),

  openInEditor: (editorName: string, path: string) =>
    invoke<void>("open_in_editor", { editorName, path }),

  listAvailableTerminals: () =>
    invoke<TerminalInfo[]>("list_available_terminals"),

  openInTerminal: (terminalName: string, path: string) =>
    invoke<void>("open_in_terminal", { terminalName, path }),

  readEnvFiles: (dir: string) => invoke<EnvFile[]>("read_env_files", { dir }),

  writeEnvFile: (dir: string, name: string, content: string) =>
    invoke<void>("write_env_file", { dir, name, content }),

  findProjectIcon: (dirs: string[]) =>
    invoke<string | null>("find_project_icon", { dirs }),

  getStats: () => invoke<StatsSummary>("get_stats"),

  getDailyActivity: (projectId: string | null) =>
    invoke<DayActivity[]>("get_daily_activity", { projectId }),
};

export interface DayActivity {
  date: string;
  totalSecs: number;
  sessions: number;
}

export interface ServiceStat {
  serviceId: string;
  serviceName: string;
  totalSecs: number;
  sessions: number;
}

export interface ProjectStat {
  projectId: string;
  projectName: string;
  totalSecs: number;
  weekSecs: number;
  sessions: number;
  services: ServiceStat[];
}

export interface StatsSummary {
  totalSecs: number;
  weekSecs: number;
  totalSessions: number;
  projects: ProjectStat[];
}

export interface EnvFile {
  name: string;
  content: string;
}

export interface EditorInfo {
  id: string;
  name: string;
}

export interface TerminalInfo {
  id: string;
  name: string;
}

export interface PortInfo {
  port: number;
  pid: number;
  command: string;
  address: string;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
