import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, RefreshCw, Skull, X } from "lucide-react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { api, type PortInfo } from "../lib/tauri";
import { toast } from "../store/toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PortsPanel({ open, onClose }: Props) {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [killing, setKilling] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listListeningPorts();
      setPorts(list);
    } catch (e) {
      toast.error(`Failed to list ports: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (open && e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleKill(p: PortInfo, force: boolean) {
    const ok = await confirm(
      `${p.command} (PID ${p.pid}) is holding port :${p.port}. ${force ? "Force-kill (SIGKILL)" : "Stop gracefully (SIGTERM)"}?`,
      {
        title: force ? "Force-kill process" : "Kill process",
        kind: "warning",
        okLabel: force ? "Force-kill" : "Kill",
        cancelLabel: "Cancel",
      },
    );
    if (!ok) return;

    setKilling(p.pid);
    try {
      await api.killPortProcess(p.pid, force);
      toast.success(`Freed :${p.port} (${p.command})`);
      setTimeout(() => void refresh(), 200);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setKilling(null);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">
                  Open ports
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  TCP listeners on your machine. Kill any process holding a
                  port you need.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={loading}
                  className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading && ports.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Listing ports…
                </div>
              ) : ports.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-zinc-500">
                  No TCP listeners found.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-900 text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-5 py-2 text-left font-medium">Port</th>
                      <th className="py-2 text-left font-medium">Process</th>
                      <th className="py-2 text-left font-medium">PID</th>
                      <th className="py-2 text-left font-medium">Address</th>
                      <th className="px-5 py-2 text-right font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ports.map((p) => (
                      <tr
                        key={`${p.pid}-${p.port}`}
                        className="border-t border-zinc-800/60 transition-colors hover:bg-zinc-800/40"
                      >
                        <td className="px-5 py-2.5 font-mono text-zinc-100">
                          :{p.port}
                        </td>
                        <td className="py-2.5 text-zinc-300">{p.command}</td>
                        <td className="py-2.5 font-mono text-xs text-zinc-500">
                          {p.pid}
                        </td>
                        <td className="py-2.5 font-mono text-xs text-zinc-500">
                          {p.address}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => void handleKill(p, false)}
                              disabled={killing === p.pid}
                              className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                              title="Send SIGTERM (graceful)"
                            >
                              Kill
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleKill(p, true)}
                              disabled={killing === p.pid}
                              className="rounded p-1 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
                              title="Force-kill (SIGKILL)"
                            >
                              <Skull className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950/40 px-5 py-3 text-[11px] text-zinc-500">
              <span className="font-mono">{ports.length}</span> listening ·
              uses <span className="font-mono">lsof -iTCP -sTCP:LISTEN</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
