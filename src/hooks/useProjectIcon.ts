import { useEffect, useState } from "react";
import { api, isTauri } from "../lib/tauri";
import type { Project } from "../lib/types";

// Session cache so we resolve each project's icon at most once. Keyed by the
// project id + its folders, so adding a folder re-resolves.
const cache = new Map<string, string | null>();

/**
 * Resolves a project's own icon (favicon / app icon) by scanning its folders,
 * returning a `data:` URI or `null` when none is found. Cached per session.
 */
export function useProjectIcon(project: Project): string | null {
  const [icon, setIcon] = useState<string | null>(null);

  useEffect(() => {
    const dirs = [...new Set(project.services.map((s) => s.cwd))];
    const key = `${project.id}:${dirs.join("|")}`;

    if (cache.has(key)) {
      setIcon(cache.get(key) ?? null);
      return;
    }
    if (!isTauri() || dirs.length === 0) {
      setIcon(null);
      return;
    }

    let cancelled = false;
    api
      .findProjectIcon(dirs)
      .then((res) => {
        cache.set(key, res ?? null);
        if (!cancelled) setIcon(res ?? null);
      })
      .catch(() => {
        cache.set(key, null);
        if (!cancelled) setIcon(null);
      });

    return () => {
      cancelled = true;
    };
  }, [project]);

  return icon;
}
