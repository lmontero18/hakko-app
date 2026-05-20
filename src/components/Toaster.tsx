import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToast, type ToastKind } from "../store/toast";

const config: Record<
  ToastKind,
  {
    icon: React.ComponentType<{ className?: string }>;
    border: string;
    bg: string;
    text: string;
    accent: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    border: "border-zinc-700",
    bg: "bg-zinc-900",
    text: "text-zinc-100",
    accent: "text-zinc-200",
  },
  error: {
    icon: XCircle,
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
    text: "text-rose-100",
    accent: "text-rose-400",
  },
  info: {
    icon: Info,
    border: "border-zinc-700",
    bg: "bg-zinc-900",
    text: "text-zinc-100",
    accent: "text-zinc-400",
  },
};

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const c = config[t.kind];
          const Icon = c.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border ${c.border} ${c.bg} px-3 py-2.5 shadow-lg backdrop-blur`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${c.accent}`} />
              <p className={`flex-1 text-xs leading-relaxed ${c.text}`}>
                {t.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
