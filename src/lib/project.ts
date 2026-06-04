import type { Service, ServiceState, ServiceStatus } from "./types";

/** Roll a project's services up into a single status for the dot/badge. */
export function aggregateStatus(
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

export function countRunning(
  services: Service[],
  states: Record<string, ServiceState>,
): number {
  return services.filter((s) => states[s.id]?.status === "running").length;
}

export function countEnabled(services: Service[]): number {
  return services.filter((s) => s.enabled).length;
}

/**
 * A stable, distinct accent color for a project. Uses the user-set color when
 * present, otherwise derives a consistent hue from the name so every project
 * looks distinct instead of all-gray.
 */
export function colorFor(project: { color?: string; name: string }): string {
  if (project.color) return project.color;
  let hash = 0;
  for (let i = 0; i < project.name.length; i++) {
    hash = (hash * 31 + project.name.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 62% 56%)`;
}

/** Group services by their folder label (services with no label go to "(root)"). */
export function groupByFolder(services: Service[]): Map<string, Service[]> {
  const groups = new Map<string, Service[]>();
  for (const service of services) {
    const key = service.folderLabel ?? "(root)";
    const list = groups.get(key) ?? [];
    list.push(service);
    groups.set(key, list);
  }
  return groups;
}
