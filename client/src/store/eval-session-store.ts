import { create } from "zustand";

interface EvalSessionState {
  skippedIds: string[];
  skipCall: (id: string) => void;
  clearSession: () => void;
}

export const useEvalSessionStore = create<EvalSessionState>((set) => ({
  skippedIds: [],
  skipCall: (id) => set((s) => ({ skippedIds: [...s.skippedIds, id] })),
  clearSession: () => set({ skippedIds: [] }),
}));
