import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, X } from "lucide-react";
import { api, type StatsSummary } from "../lib/tauri";
import { useScrollLock } from "../hooks/useScrollLock";
import { toast } from "../store/toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

function fmtDuration(secs: number): string {
  if (secs <= 0) return "0m";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function StatsPanel({ open, onClose }: Props) {
  const [stats, setStats] = useState<StatsSummary | null>(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    let active = true;

    const fetchStats = (initial: boolean) => {
      api
        .getStats()
        .then((s) => active && setStats(s))
        .catch(
          (e) => initial && active && toast.error(`Failed to load stats: ${e}`),
        );
    };

    fetchStats(true);
    const id = setInterval(() => fetchStats(false), 1000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (open && e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const maxTotal =
    stats?.projects.reduce((m, p) => Math.max(m, p.totalSecs), 0) ?? 0;

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
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-400" />
                <h2 className="text-base font-semibold text-zinc-100">
                  Time tracking
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-px border-b border-zinc-800 bg-zinc-800/60">
              {[
                { label: "This week", value: fmtDuration(stats?.weekSecs ?? 0) },
                { label: "All time", value: fmtDuration(stats?.totalSecs ?? 0) },
                { label: "Sessions", value: String(stats?.totalSessions ?? 0) },
              ].map((s) => (
                <div key={s.label} className="bg-zinc-900 px-4 py-3 text-center">
                  <div className="text-lg font-semibold tracking-tight text-zinc-100">
                    {s.value}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {stats === null ? (
                <p className="py-8 text-center text-sm text-zinc-500">Loading…</p>
              ) : stats.projects.length === 0 ? (
                <div className="rounded-md border border-dashed border-zinc-800 px-3 py-10 text-center text-xs text-zinc-500">
                  No tracked time yet. Start a service and your hours will show
                  up here.
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.projects.map((p) => {
                    const pct =
                      maxTotal > 0
                        ? Math.max(4, (p.totalSecs / maxTotal) * 100)
                        : 0;
                    return (
                      <div key={p.projectId}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-zinc-100">
                            {p.projectName}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-zinc-300">
                            {fmtDuration(p.totalSecs)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-zinc-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                          <span>{fmtDuration(p.weekSecs)} this week</span>
                          <span>·</span>
                          <span>
                            {p.sessions} session{p.sessions !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {p.services.length > 1 && (
                          <div className="mt-2 space-y-1 border-l border-zinc-800 pl-3">
                            {p.services.map((s) => (
                              <div
                                key={s.serviceId}
                                className="flex items-center justify-between gap-2 text-[11px]"
                              >
                                <span className="truncate text-zinc-400">
                                  {s.serviceName}
                                </span>
                                <span className="shrink-0 font-mono text-zinc-500">
                                  {fmtDuration(s.totalSecs)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950/40 px-5 py-2.5 text-center text-[10px] text-zinc-600">
              Tracked locally on your machine · nothing is uploaded
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
