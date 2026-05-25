export type ServiceStatus =
  | "idle"
  | "starting"
  | "running"
  | "crashed"
  | "stopped";

export interface Service {
  id: string;
  name: string;
  command: string;
  cwd: string;
  folderLabel?: string;
  port?: number;
  env?: Record<string, string>;
  enabled: boolean;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  services: Service[];
  createdAt: string;
}

export interface ServiceState {
  serviceId: string;
  status: ServiceStatus;
  pid?: number;
  startedAt?: string;
  /** Port sniffed from logs at runtime; falls back to service.port if absent. */
  actualPort?: number;
}

export interface DetectionResult {
  folderLabel: string;
  services: Service[];
  warnings: string[];
}

export interface LogPayload {
  serviceId: string;
  line: string;
  stream: "stdout" | "stderr";
  timestamp: string;
}
