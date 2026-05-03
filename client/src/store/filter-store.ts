import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_FILTERS, type CallFilterState } from "@/components/ui/call-filters";

interface PageFilterState {
  filters: CallFilterState;
  page: number;
  setFilters: (f: CallFilterState) => void;
  setPage: (p: number) => void;
  reset: () => void;
}

function makeDefaultState(defaultPage: number) {
  return { filters: { ...DEFAULT_FILTERS }, page: defaultPage };
}

function mergeFilters<T extends CallFilterState>(persisted: Partial<T>, _current: T): T {
  return { ...DEFAULT_FILTERS, ...persisted } as T;
}

export const useMyCallsFilterStore = create<PageFilterState>()(
  persist(
    (set) => ({
      ...makeDefaultState(1),
      setFilters: (filters) => set({ filters, page: 1 }),
      setPage: (page) => set({ page }),
      reset: () => set(makeDefaultState(1)),
    }),
    {
      name: "my-calls-filters",
      storage: createJSONStorage(() => sessionStorage),
      merge: (persisted, current) => ({
        ...current,
        filters: mergeFilters(persisted?.filters ?? {}, current.filters),
      }),
    },
  ),
);

export const useAllCallsFilterStore = create<PageFilterState>()(
  persist(
    (set) => ({
      ...makeDefaultState(0),
      setFilters: (filters) => set({ filters, page: 0 }),
      setPage: (page) => set({ page }),
      reset: () => set(makeDefaultState(0)),
    }),
    {
      name: "all-calls-filters",
      storage: createJSONStorage(() => sessionStorage),
      merge: (persisted, current) => ({
        ...current,
        filters: mergeFilters(persisted?.filters ?? {}, current.filters),
      }),
    },
  ),
);
