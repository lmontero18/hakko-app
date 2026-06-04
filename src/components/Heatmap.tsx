import { type CSSProperties, useState } from "react";
import type { DayActivity } from "../lib/tauri";

interface Props {
  data: DayActivity[];
  year: number;
}

// GitHub dark-mode contribution greens, level 0 → 4.
const LEVEL_COLORS = [
  "rgba(255,255,255,0.06)",
  "#0e4429",
  "#006d32",
  "#26a641",
  "#39d353",
];
// What each color level means, matching levelOf() thresholds below.
const LEVEL_LABELS = [
  "No activity",
  "Less than 30m",
  "30m – 1h",
  "1h – 3h",
  "3h or more",
];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Fixed thresholds on running time per day.
function levelOf(secs: number): number {
  if (secs <= 0) return 0;
  if (secs < 1800) return 1; // < 30m
  if (secs < 3600) return 2; // 30m – 1h
  if (secs < 10800) return 3; // 1h – 3h
  return 4; // ≥ 3h
}

function fmt(secs: number): string {
  if (secs <= 0) return "No activity";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function Heatmap({ data, year }: Props) {
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    date: Date;
    secs: number;
    sessions: number;
  } | null>(null);
  const [legendHover, setLegendHover] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);

  const map = new Map(data.map((d) => [d.date, d]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calendar year: weeks from the Sunday on/before Jan 1 through Dec 31.
  const yearEnd = new Date(year, 11, 31);
  const firstSunday = new Date(year, 0, 1);
  firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());

  const weeks: Date[][] = [];
  const cursor = new Date(firstSunday);
  while (cursor <= yearEnd) {
    const col: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(cursor);
      day.setDate(cursor.getDate() + d);
      col.push(day);
    }
    weeks.push(col);
    cursor.setDate(cursor.getDate() + 7);
  }
  const weekCount = weeks.length;

  // Place each month's label at the column containing the 1st of that month.
  const labelByCol: string[] = weeks.map(() => "");
  weeks.forEach((col, w) => {
    for (const day of col) {
      if (day.getFullYear() === year && day.getDate() === 1) {
        labelByCol[w] = MONTHS[day.getMonth()];
      }
    }
  });

  const columnsStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${weekCount}, minmax(0, 1fr))`,
  };
  const cellsStyle: CSSProperties = {
    ...columnsStyle,
    gridTemplateRows: "repeat(7, auto)",
    gridAutoFlow: "column",
    gap: "2px",
  };

  return (
    <div className="relative w-full">
      <div className="mb-1 text-[10px] text-zinc-500" style={columnsStyle}>
        {labelByCol.map((m, i) => (
          <div key={i} className="overflow-visible whitespace-nowrap">
            {m}
          </div>
        ))}
      </div>

      <div style={cellsStyle}>
        {weeks.map((col, w) =>
          col.map((day, d) => {
            const inYear = day.getFullYear() === year;
            const future = day > today;
            const show = inYear && !future;
            const rec = show ? map.get(ymd(day)) : undefined;
            const secs = rec?.totalSecs ?? 0;
            const sessions = rec?.sessions ?? 0;
            return (
              <div
                key={`${w}-${d}`}
                className="aspect-square w-full rounded-[2px]"
                style={{
                  backgroundColor: show
                    ? LEVEL_COLORS[levelOf(secs)]
                    : "transparent",
                }}
                onMouseEnter={
                  show
                    ? (e) =>
                        setHover({
                          x: e.clientX,
                          y: e.clientY,
                          date: day,
                          secs,
                          sessions,
                        })
                    : undefined
                }
                onMouseLeave={show ? () => setHover(null) : undefined}
              />
            );
          }),
        )}
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-zinc-500">
        <span className="mr-0.5">Less</span>
        {LEVEL_COLORS.map((c, i) => (
          <span
            key={i}
            className="h-[10px] w-[10px] cursor-help rounded-[2px]"
            style={{ backgroundColor: c }}
            onMouseEnter={(e) =>
              setLegendHover({
                x: e.clientX,
                y: e.clientY,
                label: LEVEL_LABELS[i],
              })
            }
            onMouseLeave={() => setLegendHover(null)}
          />
        ))}
        <span className="ml-0.5">More</span>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-[70] rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 shadow-xl"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="text-xs font-medium text-zinc-100">
            {fmt(hover.secs)}
          </div>
          <div className="text-[11px] text-zinc-400">
            {hover.date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {hover.sessions > 0 &&
              ` · ${hover.sessions} session${hover.sessions !== 1 ? "s" : ""}`}
          </div>
        </div>
      )}

      {legendHover && (
        <div
          className="pointer-events-none fixed z-[70] rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-100 shadow-xl"
          style={{ left: legendHover.x + 12, top: legendHover.y + 12 }}
        >
          {legendHover.label}
        </div>
      )}
    </div>
  );
}
