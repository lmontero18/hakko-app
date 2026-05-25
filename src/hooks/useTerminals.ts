import { create } from "zustand";
import { api, isTauri, type TerminalInfo } from "../lib/tauri";

interface TerminalsStore {
  terminals: TerminalInfo[];
  loaded: boolean;
  load: () => Promise<void>;
}

export const useTerminals = create<TerminalsStore>((set, get) => ({
  terminals: [],
  loaded: false,
  async load() {
    if (!isTauri()) return;
    if (get().loaded) return;
    try {
      const list = await api.listAvailableTerminals();
      set({ terminals: list, loaded: true });
    } catch {
      set({ terminals: [], loaded: true });
    }
  },
}));
