import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, FolderPlus, Plus, X } from "lucide-react";
import type { DetectionResult, Project } from "../lib/types";
import { useScrollLock } from "../hooks/useScrollLock";

interface Props {
  detection: DetectionResult | null;
  projects: Project[];
  onClose: () => void;
  onCreateNew: (detection: DetectionResult) => Promise<unknown> | void;
  onAddToExisting: (
    projectId: string,
    detection: DetectionResult,
  ) => Promise<unknown> | void;
}

type Mode = "new" | "existing";

export function CreateProjectDialog({
  detection,
  projects,
  onClose,
  onCreateNew,
  onAddToExisting,
}: Props) {
  const [mode, setMode] = useState<Mode>("new");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useScrollLock(detection !== null);

  useEffect(() => {
    if (!detection) return;
    setMode("new");
    setSelectedProjectId(projects[0]?.id ?? "");
    setSubmitting(false);
  }, [detection, projects]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!detection) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detection, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!detection || submitting) return;
    setSubmitting(true);
    try {
      if (mode === "new") {
        await onCreateNew(detection);
      } else if (selectedProjectId) {
        await onAddToExisting(selectedProjectId, detection);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {detection && (
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
                  Folder analyzed
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  <span className="font-mono">{detection.folderLabel}</span> —{" "}
                  {detection.services.length} service
                  {detection.services.length !== 1 ? "s" : ""} detected
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
              {detection.services.length === 0 ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  No services detected in this folder. You can still create the
                  project and add services manually.
                </div>
              ) : (
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-md bg-zinc-950/60 px-3 py-2">
                  {detection.services.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-100" />
                      <span className="font-medium text-zinc-200">
                        {s.name}
                      </span>
                      <code className="truncate font-mono text-zinc-500">
                        {s.command}
                      </code>
                    </div>
                  ))}
                </div>
              )}

              {detection.warnings.length > 0 && (
                <div className="space-y-1">
                  {detection.warnings.map((w) => (
                    <div
                      key={w}
                      className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-800 px-3 py-2.5 transition-colors hover:bg-zinc-800/40">
                  <input
                    type="radio"
                    name="mode"
                    value="new"
                    checked={mode === "new"}
                    onChange={() => setMode("new")}
                    className="mt-0.5 accent-zinc-100"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                      <Plus className="h-3.5 w-3.5" />
                      Create new project
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Default name:{" "}
                      <span className="font-mono">{detection.folderLabel}</span>
                    </p>
                  </div>
                </label>

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-md border border-zinc-800 px-3 py-2.5 transition-colors hover:bg-zinc-800/40 ${
                    projects.length === 0 ? "cursor-not-allowed opacity-50" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value="existing"
                    checked={mode === "existing"}
                    onChange={() => setMode("existing")}
                    disabled={projects.length === 0}
                    className="mt-0.5 accent-zinc-100"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                      <FolderPlus className="h-3.5 w-3.5" />
                      Add to existing project
                    </div>
                    {mode === "existing" && projects.length > 0 && (
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {projects.length === 0 && (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        No existing projects yet
                      </p>
                    )}
                  </div>
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
                disabled={
                  submitting || (mode === "existing" && !selectedProjectId)
                }
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Saving…"
                  : mode === "new"
                    ? "Create project"
                    : "Add folder"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
