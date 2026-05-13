import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const LEGACY_PROJECT_LS_KEY = "agents_current_project_id_v1";

export type ICurrentProjectPersistSlice = {
  currentProjectId: string | null;
};

type ICurrentProjectStore = ICurrentProjectPersistSlice & {
  setCurrentProjectId: (projectId: string | null) => void;
  clearCurrentProjectIfMatches: (projectId: string) => void;
};

export const useCurrentProjectStore = create<ICurrentProjectStore>()(
  persist(
    (set, get) => ({
      currentProjectId: null,
      setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),
      clearCurrentProjectIfMatches: (projectId) => {
        if (get().currentProjectId === projectId) set({ currentProjectId: null });
      },
    }),
    {
      name: "agents-console-current-project",
      storage: createJSONStorage(() => localStorage),
      partialize: (s): ICurrentProjectPersistSlice => ({ currentProjectId: s.currentProjectId }),
      merge: (persisted, current) => {
        const rec = (persisted ?? {}) as Partial<ICurrentProjectPersistSlice>;
        let nextId = rec.currentProjectId ?? current.currentProjectId;
        try {
          if (!nextId) {
            const legacy = localStorage.getItem(LEGACY_PROJECT_LS_KEY);
            if (legacy) {
              nextId = legacy;
              localStorage.removeItem(LEGACY_PROJECT_LS_KEY);
            }
          }
        } catch {
          /* ignore storage errors */
        }
        return {
          ...current,
          currentProjectId: nextId ?? null,
        };
      },
    },
  ),
);
