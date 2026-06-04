import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, type DayActivity } from "../lib/tauri";
import { Heatmap } from "./Heatmap";

function fmtDuration(secs: number): string {
  if (secs <= 0) return "0m";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const CURRENT_YEAR = new Date().getFullYear();

export function ProjectActivity({ projectId }: { projectId: string }) {
  const [daily, setDaily] = useState<DayActivity[]>([]);
  const [year, setYear] = useState(CURRENT_YEAR);

  useEffect(() => {
    let active = true;
    const fetchIt = () =>
      api
        .getDailyActivity(projectId)
        .then((d) => active && setDaily(d))
        .catch(() => {});
    fetchIt();
    const id = setInterval(fetchIt, 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [projectId]);

  const inYear = daily.filter((d) => d.date.startsWith(`${year}-`));
  const total = inYear.reduce((a, d) => a + d.totalSecs, 0);
  const sessions = inYear.reduce((a, d) => a + d.sessions, 0);
  const activeDays = inYear.filter((d) => d.totalSecs > 0).length;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-3 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800/60">
          {[
            { label: "Total", value: fmtDuration(total) },
            { label: "Sessions", value: String(sessions) },
            { label: "Active days", value: String(activeDays) },
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

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-12 text-center font-mono text-sm font-medium text-zinc-100">
            {year}
          </span>
          <button
            type="button"
            onClick={() => setYear((y) => Math.min(CURRENT_YEAR, y + 1))}
            disabled={year >= CURRENT_YEAR}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Heatmap data={daily} year={year} />
    </div>
  );
}
