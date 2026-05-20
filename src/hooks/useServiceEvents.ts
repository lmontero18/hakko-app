import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProjects } from "./useProjects";
import { isTauri } from "../lib/tauri";
import type { ServiceState } from "../lib/types";

export function useServiceEvents() {
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    listen<ServiceState>("service-status", (event) => {
      useProjects.getState().applyServiceState(event.payload);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
