import { create } from "zustand";
import { api, isTauri, type EditorInfo } from "../lib/tauri";

interface EditorsStore {
  editors: EditorInfo[];
  loaded: boolean;
  load: () => Promise<void>;
}

export const useEditors = create<EditorsStore>((set, get) => ({
  editors: [],
  loaded: false,
  async load() {
    if (!isTauri()) return;
    if (get().loaded) return;
    try {
      const list = await api.listAvailableEditors();
      set({ editors: list, loaded: true });
    } catch {
      set({ editors: [], loaded: true });
    }
  },
}));
