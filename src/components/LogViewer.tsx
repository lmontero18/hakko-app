import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { api } from "../lib/tauri";
import { toast } from "../store/toast";
import type { LogPayload } from "../lib/types";

export interface LogViewerHandle {
  clear: () => void;
  copy: () => Promise<void>;
}

interface Props {
  serviceId: string;
}

function formatLine(log: LogPayload): string {
  if (log.stream === "stderr") return `\x1b[31m${log.line}\x1b[0m`;
  return log.line;
}

export const LogViewer = forwardRef<LogViewerHandle, Props>(function LogViewer(
  { serviceId },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        termRef.current?.clear();
      },
      copy: async () => {
        try {
          const logs = await api.getRecentLogs(serviceId);
          if (logs.length === 0) {
            toast.info("No logs to copy yet");
            return;
          }
          const text = logs.map((l) => l.line).join("\n");
          await writeText(text);
          toast.success(
            `Copied ${logs.length} log line${logs.length !== 1 ? "s" : ""}`,
          );
        } catch (e) {
          toast.error(`Failed to copy: ${e}`);
        }
      },
    }),
    [serviceId],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      convertEol: true,
      fontSize: 12,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      theme: {
        background: "#09090b",
        foreground: "#e4e4e7",
        cursor: "#09090b",
      },
      scrollback: 2000,
      disableStdin: true,
      cursorBlink: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();
    termRef.current = term;

    let alive = true;
    let unlisten: (() => void) | undefined;

    api
      .getRecentLogs(serviceId)
      .then((logs) => {
        if (!alive) return;
        for (const log of logs) {
          term.writeln(formatLine(log));
        }
      })
      .catch(() => {});

    listen<LogPayload>("service-log", (event) => {
      if (event.payload.serviceId !== serviceId) return;
      term.writeln(formatLine(event.payload));
    }).then((fn) => {
      if (!alive) fn();
      else unlisten = fn;
    });

    const obs = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // Ignore — sometimes fires before layout settles
      }
    });
    obs.observe(container);

    return () => {
      alive = false;
      unlisten?.();
      obs.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [serviceId]);

  return (
    <div
      ref={containerRef}
      className="h-72 w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 p-2"
    />
  );
});
