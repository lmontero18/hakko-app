import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { api, type EnvFile } from "../lib/tauri";
import { parse, serialize, type DotenvLine } from "../lib/dotenv";
import { useScrollLock } from "../hooks/useScrollLock";
import { toast } from "../store/toast";

interface Props {
  /** Folder whose .env files we edit; `null` keeps the dialog closed. */
  cwd: string | null;
  onClose: () => void;
}

export function EnvFilesDialog({ cwd, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DotenvLine[]>>({});
  // Normalized baseline (content run through parse→serialize) per file, so
  // dirty-checking compares apples to apples and ignores trailing-newline noise.
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [active, setActive] = useState<string>("");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  useScrollLock(cwd !== null);

  const load = useCallback(async (dir: string) => {
    setLoading(true);
    try {
      const files: EnvFile[] = await api.readEnvFiles(dir);
      const nextDrafts: Record<string, DotenvLine[]> = {};
      const nextBaseline: Record<string, string> = {};
      for (const f of files) {
        const lines = parse(f.content);
        nextDrafts[f.name] = lines;
        nextBaseline[f.name] = serialize(lines);
      }
      const names = files.map((f) => f.name);
      setDrafts(nextDrafts);
      setBaseline(nextBaseline);
      setOrder(names);
      // Prefer .env as the first tab when present.
      setActive(names.includes(".env") ? ".env" : (names[0] ?? ""));
      setRevealed(new Set());
    } catch (e) {
      toast.error(`Failed to read env files: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cwd) void load(cwd);
  }, [cwd, load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (cwd && e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cwd, onClose]);

  const lines = drafts[active] ?? [];
  const dirty = active ? serialize(lines) !== baseline[active] : false;
  const hasEnv = order.includes(".env");
  const hasExample = order.includes(".env.example");

  async function createEnv(content: string) {
    if (!cwd || creating) return;
    setCreating(true);
    try {
      await api.writeEnvFile(cwd, ".env", content);
      toast.success("Created .env");
      await load(cwd);
    } catch (e) {
      toast.error(`Failed to create .env: ${e}`);
    } finally {
      setCreating(false);
    }
  }

  function updateLines(next: DotenvLine[]) {
    setDrafts((d) => ({ ...d, [active]: next }));
  }

  function setPair(index: number, patch: Partial<{ key: string; value: string }>) {
    updateLines(
      lines.map((line, i) =>
        i === index && line.kind === "pair" ? { ...line, ...patch } : line,
      ),
    );
  }

  function removeLine(index: number) {
    updateLines(lines.filter((_, i) => i !== index));
  }

  function addVariable() {
    updateLines([...lines, { kind: "pair", key: "", value: "" }]);
  }

  function toggleReveal(index: number) {
    setRevealed((r) => {
      const next = new Set(r);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function switchTab(name: string) {
    setActive(name);
    setRevealed(new Set());
  }

  async function handleSave() {
    if (!cwd || !active || saving) return;
    setSaving(true);
    try {
      const content = serialize(lines);
      await api.writeEnvFile(cwd, active, content);
      setBaseline((b) => ({ ...b, [active]: content }));
      toast.success(`Saved ${active}`);
    } catch (e) {
      toast.error(`Failed to save ${active}: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {cwd && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-zinc-100">
                  Environment files
                </h2>
                <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
                  {cwd}
                </p>
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

            <div className="flex items-start gap-2 border-b border-zinc-800 bg-zinc-950/40 px-5 py-2.5 text-[11px] text-zinc-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
              <span>
                Hakko reads and edits these files entirely on your machine.
                Nothing is uploaded anywhere.
              </span>
            </div>

            {order.length > 1 && (
              <div className="flex gap-1 border-b border-zinc-800 px-3 pt-3">
                {order.map((name) => {
                  const isDirty =
                    serialize(drafts[name] ?? []) !== baseline[name];
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => switchTab(name)}
                      className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 font-mono text-xs transition-colors ${
                        active === name
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {name}
                      {isDirty && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <p className="py-8 text-center text-sm text-zinc-500">Loading…</p>
              ) : order.length === 0 ? (
                <div className="rounded-md border border-dashed border-zinc-800 px-3 py-8 text-center text-xs text-zinc-500">
                  <p>No env files found in this folder.</p>
                  <button
                    type="button"
                    onClick={() => createEnv("")}
                    disabled={creating}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {creating ? "Creating…" : "Create .env"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {hasExample && !hasEnv && (
                    <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      <span className="flex-1">
                        No <code className="font-mono">.env</code> yet — only{" "}
                        <code className="font-mono">.env.example</code>.
                      </span>
                      <button
                        type="button"
                        onClick={() => createEnv(baseline[".env.example"] ?? "")}
                        disabled={creating}
                        className="shrink-0 rounded bg-amber-500/20 px-2 py-1 font-medium text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
                      >
                        {creating ? "Creating…" : "Create .env from .env.example"}
                      </button>
                    </div>
                  )}
                  {lines.map((line, i) => {
                    if (line.kind === "blank") {
                      return <div key={i} className="h-2" aria-hidden />;
                    }
                    if (line.kind === "comment") {
                      return (
                        <div
                          key={i}
                          className="truncate px-1 font-mono text-xs text-zinc-600"
                          title={line.raw}
                        >
                          {line.raw}
                        </div>
                      );
                    }
                    const isRevealed = revealed.has(i);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={line.key}
                          onChange={(e) => setPair(i, { key: e.target.value })}
                          placeholder="KEY"
                          spellCheck={false}
                          className="w-2/5 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-zinc-100 outline-none focus:border-zinc-500"
                        />
                        <span className="text-zinc-600">=</span>
                        <div className="relative flex-1">
                          <input
                            type={isRevealed ? "text" : "password"}
                            value={line.value}
                            onChange={(e) =>
                              setPair(i, { value: e.target.value })
                            }
                            placeholder="value"
                            spellCheck={false}
                            autoComplete="off"
                            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 pr-8 font-mono text-xs text-zinc-100 outline-none focus:border-zinc-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleReveal(i)}
                            className="absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500 hover:text-zinc-300"
                            aria-label={isRevealed ? "Hide value" : "Reveal value"}
                            title={isRevealed ? "Hide value" : "Reveal value"}
                          >
                            {isRevealed ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="rounded p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
                          aria-label="Remove variable"
                          title="Remove variable"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={addVariable}
                    className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add variable
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 bg-zinc-950/40 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty || !active}
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
