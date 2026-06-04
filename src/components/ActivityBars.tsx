import { motion } from "framer-motion";

interface Props {
  /** How many services are currently running. */
  running: number;
  /** Total enabled services (kept for the aria-label only). */
  total: number;
  /** True while a service is booting — bars glow amber instead of green. */
  starting?: boolean;
}

// Three deliberately mismatched equalizer bars: different keyframes, different
// durations, different start delays — so each dances to its own beat instead of
// bouncing in sync (the in-sync version read as robotic / "AI slop").
const BARS = [
  { keys: [4, 16, 6, 13, 5], duration: 1.15, delay: 0 },
  { keys: [6, 9, 17, 7, 14], duration: 1.65, delay: 0.28 },
  { keys: [5, 12, 5, 16, 8], duration: 0.95, delay: 0.5 },
];

/**
 * Liveness indicator: three little equalizer bars that animate in green while
 * anything is running (amber while starting), and sit as dim static dots when
 * everything is stopped. Purely visual — no "N/M running" text.
 */
export function ActivityBars({ running, total, starting }: Props) {
  const live = running > 0;
  const liveColor = starting ? "bg-amber-400" : "bg-emerald-400";
  const glow = starting
    ? "drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]"
    : "drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]";

  return (
    <span
      className={`ml-auto inline-flex h-4 shrink-0 items-end gap-[3px] ${live ? glow : ""}`}
      role="img"
      aria-label={
        live ? `${running} of ${total} services running` : "all stopped"
      }
    >
      {BARS.map((bar, i) =>
        live ? (
          <motion.span
            key={i}
            className={`w-[3px] rounded-full ${liveColor}`}
            initial={{ height: 4 }}
            animate={{ height: bar.keys }}
            transition={{
              duration: bar.duration,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
              delay: bar.delay,
            }}
          />
        ) : (
          <span key={i} className="h-[3px] w-[3px] rounded-full bg-zinc-700" />
        ),
      )}
    </span>
  );
}
