import { motion, type Variants } from "framer-motion";
import { Plus } from "lucide-react";
import type { Project, ServiceState } from "../lib/types";
import {
  aggregateStatus,
  countEnabled,
  countRunning,
} from "../lib/project";
import { useProjectIcon } from "../hooks/useProjectIcon";
import { StatusDot } from "./StatusDot";

interface Props {
  projects: Project[];
  states: Record<string, ServiceState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
};

function ProjectSidebarItem({
  project,
  states,
  selected,
  onSelect,
}: {
  project: Project;
  states: Record<string, ServiceState>;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const status = aggregateStatus(project.services, states);
  const running = countRunning(project.services, states);
  const total = countEnabled(project.services);
  const icon = useProjectIcon(project);

  return (
    <motion.button
      type="button"
      variants={itemVariants}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(project.id)}
      className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${
        selected ? "" : "hover:bg-zinc-800/40"
      }`}
    >
      {selected && (
        <motion.span
          layoutId="activeProject"
          className="absolute inset-0 rounded-lg bg-zinc-800/80 ring-1 ring-white/10"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}

      {/* Mini avatar: the project's own icon, or its colored initial. */}
      {icon ? (
        <span className="relative z-10 h-5 w-5 shrink-0 overflow-hidden rounded-md bg-zinc-900 ring-1 ring-white/10">
          <img src={icon} alt="" className="h-full w-full object-cover" />
        </span>
      ) : (
        <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-[10px] font-semibold text-zinc-300">
          {project.name.charAt(0).toUpperCase()}
        </span>
      )}

      <span className="relative z-10">
        <StatusDot status={status} ariaLabel={status} />
      </span>
      <span
        className={`relative z-10 flex-1 truncate text-sm ${
          selected
            ? "font-medium text-zinc-100"
            : "text-zinc-300 group-hover:text-zinc-100"
        }`}
      >
        {project.name}
      </span>
      {running > 0 && (
        <span className="relative z-10 shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
          {running}/{total}
        </span>
      )}
    </motion.button>
  );
}

export function ProjectSidebar({
  projects,
  states,
  selectedId,
  onSelect,
  onAdd,
}: Props) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/5 bg-zinc-950/60">
      <div className="flex-1 overflow-y-auto p-2">
        <div className="px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Projects
        </div>
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="space-y-0.5"
        >
          {projects.map((p) => (
            <ProjectSidebarItem
              key={p.id}
              project={p}
              states={states}
              selected={p.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </motion.div>
      </div>
      <div className="border-t border-white/5 p-2">
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800/40 hover:text-zinc-100"
        >
          <Plus className="h-4 w-4" />
          Add project
        </button>
      </div>
    </aside>
  );
}
