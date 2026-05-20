import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { isTauri } from "../lib/tauri";

interface Options {
  onDropPaths: (paths: string[]) => void;
}

export function useDragDrop({ onDropPaths }: Options) {
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsOver(true);
        } else if (event.payload.type === "leave") {
          setIsOver(false);
        } else if (event.payload.type === "drop") {
          setIsOver(false);
          if (event.payload.paths.length > 0) {
            onDropPaths(event.payload.paths);
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, [onDropPaths]);

  return { isOver };
}
