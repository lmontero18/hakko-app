import { motion } from "framer-motion";
import type { ServiceStatus } from "../lib/types";
import { statusColor, statusRing } from "../lib/status";

interface Props {
  status: ServiceStatus;
  size?: "sm" | "md";
  ariaLabel?: string;
}

const sizeClass: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-2.5 w-2.5 ring-4",
  md: "h-3 w-3 ring-4",
};

export function StatusDot({ status, size = "sm", ariaLabel }: Props) {
  const animate =
    status === "running"
      ? { opacity: [1, 0.55, 1] }
      : status === "starting"
        ? { scale: [1, 0.7, 1] }
        : { opacity: 1, scale: 1 };
  const transition =
    status === "running"
      ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" as const }
      : status === "starting"
        ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" as const }
        : { duration: 0.2 };

  return (
    <motion.span
      className={`shrink-0 rounded-full ${sizeClass[size]} ${statusColor[status]} ${statusRing[status]}`}
      animate={animate}
      transition={transition}
      aria-label={ariaLabel}
    />
  );
}
