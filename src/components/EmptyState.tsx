import { motion } from "framer-motion";
import { MousePointerClick, Sparkles, Zap } from "lucide-react";
import { DropZone } from "./DropZone";
import { HakkoLogo } from "./HakkoLogo";
import { getBrandIcon } from "../lib/brandIcons";

interface Props {
  onPickFolder: () => void;
  isOver?: boolean;
}

interface Stack {
  name: string;
  command: string;
}

const STACKS: Stack[] = [
  { name: "Next.js", command: "npm run dev" },
  { name: "Vite", command: "npm run dev" },
  { name: "Strapi", command: "npm run develop" },
  { name: "Docker", command: "docker compose up" },
  { name: "Django", command: "python manage.py runserver" },
  { name: "Python", command: "python main.py" },
  { name: "Rust", command: "cargo run" },
  { name: "Node", command: "npm run dev / npm start" },
];

interface Step {
  icon: typeof MousePointerClick;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: MousePointerClick,
    title: "Drop a folder",
    body: "Anywhere on the window, or click browse.",
  },
  {
    icon: Sparkles,
    title: "We auto-detect",
    body: "package.json, Cargo.toml, manage.py, docker-compose…",
  },
  {
    icon: Zap,
    title: "Run everything",
    body: "Start/stop services with one click. Logs streamed live.",
  },
];

export function EmptyState({ onPickFolder, isOver }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-8"
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-100">
          <HakkoLogo className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Your local environments, all in one place.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
          Drop a project folder. Hakko detects the services inside, groups them
          by repo, and lets you start everything with one click — no config
          files, no terminal hopping.
        </p>
      </div>

      <DropZone onPickFolder={onPickFolder} isOver={isOver} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 + i * 0.06 }}
              className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4"
            >
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-white/5 p-1.5 text-zinc-200">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium text-zinc-200">
                  {step.title}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {step.body}
              </p>
            </motion.div>
          );
        })}
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Auto-detected stacks
          </h3>
          <span className="text-[10px] text-zinc-600">
            More on the way
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STACKS.map((stack) => {
            const { Icon, color } = getBrandIcon(stack.name);
            return (
              <div
                key={stack.name}
                className="group/stack flex items-center gap-2.5 rounded-md border border-zinc-800/60 bg-zinc-900/30 px-2.5 py-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-800/60"
              >
                <Icon
                  className="h-4 w-4 shrink-0 transition-all duration-200 ease-out group-hover/stack:scale-125 group-hover/stack:[filter:drop-shadow(0_0_10px_currentColor)]"
                  style={{ color }}
                />
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-zinc-200 transition-colors group-hover/stack:text-white">
                    {stack.name}
                  </div>
                  <code className="block truncate font-mono text-[10px] text-zinc-500">
                    {stack.command}
                  </code>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
