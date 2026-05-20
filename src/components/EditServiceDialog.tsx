import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb, X } from "lucide-react";
import type { Service } from "../lib/types";

interface Props {
  service: Service | null;
  isRunning: boolean;
  onClose: () => void;
  onSave: (updated: Service) => Promise<unknown> | void;
}

export function EditServiceDialog({
  service,
  isRunning,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [port, setPort] = useState<string>("");
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!service) return;
    setName(service.name);
    setCommand(service.command);
    setPort(service.port?.toString() ?? "");
    setEnabled(service.enabled);
    setSubmitting(false);
  }, [service]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!service) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [service, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || submitting) return;
    const trimmedName = name.trim();
    const trimmedCommand = command.trim();
    if (!trimmedName || !trimmedCommand) return;

    const parsedPort = port.trim() === "" ? undefined : Number.parseInt(port, 10);
    if (parsedPort !== undefined && (Number.isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535)) {
      return;
    }

    setSubmitting(true);
    try {
      const updated: Service = {
        ...service,
        name: trimmedName,
        command: trimmedCommand,
        port: parsedPort,
        enabled,
      };
      await onSave(updated);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {service && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.form
            onSubmit={handleSubmit}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">
                  Edit service
                </h2>
                <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
                  {service.cwd}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {isRunning && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  This service is currently running. Changes apply the next time
                  you start it.
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">
                  Command
                </span>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  placeholder="npm run dev"
                  spellCheck={false}
                  required
                />
                <div className="flex items-start gap-1.5 text-[11px] text-zinc-500">
                  <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-400/70" />
                  <span>
                    Chain with <code className="rounded bg-zinc-800 px-1 font-mono text-zinc-300">&amp;&amp;</code>:
                    e.g., <code className="rounded bg-zinc-800 px-1 font-mono text-zinc-300">npm rebuild &amp;&amp; npm run dev</code>
                  </span>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Port <span className="text-zinc-500">(optional)</span>
                  </span>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    min="1"
                    max="65535"
                    placeholder="3000"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  />
                </label>

                <label className="flex cursor-pointer items-center gap-2 self-end pb-2.5">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="accent-zinc-100"
                  />
                  <span className="text-xs font-medium text-zinc-300">
                    Enabled
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 bg-zinc-950/40 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim() || !command.trim()}
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
