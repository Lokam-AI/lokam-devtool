import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  apiGetCalls,
  apiGetCallsCount,
  apiGetCall,
  apiSubmitEval,
  apiGetTeam,
  apiGetHealth,
  apiGetUsers,
  apiCreateUser,
  apiUpdateUser,
  apiGetBugs,
  apiGetBugsCount,
  apiGetBugsStats,
  apiGetMyBugs,
  apiGetMyBugsCount,
  apiAssignBug,
  apiResolveBug,
  apiGetDashboardStats,
  apiGetAssignmentConfig,
  apiUpdateAssignmentConfig,
  apiCreateBug,
  type CreateBugPayload,
  type MyCallsParams,
  type BugsParams,
  type BugsStatsResult,
  type MyBugsParams,
} from "@/lib/api";
import type { AssignmentConfig } from "@/types";
import type { Eval } from "@/types";
import { useAuthStore } from "@/store/auth-store";

const STALE_MS = 5 * 60 * 1000;

export function useCalls(params?: MyCallsParams) {
  return useQuery({
    queryKey: ["calls", params],
    queryFn: () => apiGetCalls(params),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useCallsCount(params?: Omit<MyCallsParams, "limit" | "offset" | "sort_by" | "sort_dir">) {
  return useQuery({
    queryKey: ["calls-count", params],
    queryFn: () => apiGetCallsCount(params),
    staleTime: STALE_MS,
  });
}

export function useCall(id: string) {
  return useQuery({
    queryKey: ["call", id],
    queryFn: () => apiGetCall(id),
    enabled: !!id,
  });
}

export function useSubmitEval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ evalId, data }: { evalId: string; data: Partial<Eval> }) =>
      apiSubmitEval(evalId, data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["calls"] });
      qc.invalidateQueries({ queryKey: ["calls-count"] });
      qc.removeQueries({ queryKey: ["call", result.call_id] });
    },
  });
}

export function useTeam() {
  const isAdmin = useAuthStore((s) => s.isAtLeast("admin"));
  return useQuery({ queryKey: ["team"], queryFn: apiGetTeam, enabled: isAdmin });
}

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: apiGetHealth, refetchInterval: 60000 });
}

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: apiGetUsers });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: apiCreateUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useBugs(params: BugsParams) {
  return useQuery({
    queryKey: ["bugs", params],
    queryFn: () => apiGetBugs(params),
    enabled: !!(params.date_from && params.date_to),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useBugsCount(params: Omit<BugsParams, "limit" | "offset">) {
  return useQuery({
    queryKey: ["bugs-count", params],
    queryFn: () => apiGetBugsCount(params),
    enabled: !!(params.date_from && params.date_to),
    staleTime: STALE_MS,
  });
}

export function useBugsStats(params: { date_from: string; date_to: string; source_env?: string }) {
  return useQuery({
    queryKey: ["bugs-stats", params],
    queryFn: () => apiGetBugsStats(params),
    enabled: !!(params.date_from && params.date_to),
    staleTime: STALE_MS,
  });
}

export function useMyBugs(params?: MyBugsParams) {
  return useQuery({
    queryKey: ["bugs-my", params],
    queryFn: () => apiGetMyBugs(params),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useMyBugsCount(params?: Omit<MyBugsParams, "limit" | "offset">) {
  return useQuery({
    queryKey: ["bugs-my-count", params],
    queryFn: () => apiGetMyBugsCount(params),
    staleTime: STALE_MS,
  });
}

export function useResolveBug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bugId, isResolved }: { bugId: number; isResolved: boolean }) =>
      apiResolveBug(bugId, isResolved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bugs"] });
      qc.invalidateQueries({ queryKey: ["bugs-count"] });
      qc.invalidateQueries({ queryKey: ["bugs-stats"] });
      qc.invalidateQueries({ queryKey: ["bugs-my"] });
      qc.invalidateQueries({ queryKey: ["bugs-my-count"] });
    },
  });
}

export function useDashboardStats() {
  const isAdmin = useAuthStore((s) => s.isAtLeast("admin"));
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: apiGetDashboardStats,
    staleTime: 60 * 1000,
    enabled: isAdmin,
  });
}

export function useAssignBug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bugId, userId }: { bugId: number; userId: number | null }) =>
      apiAssignBug(bugId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bugs"] });
      qc.invalidateQueries({ queryKey: ["bugs-count"] });
      qc.invalidateQueries({ queryKey: ["bugs-stats"] });
      qc.invalidateQueries({ queryKey: ["bugs-my"] });
      qc.invalidateQueries({ queryKey: ["bugs-my-count"] });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, patch }: { userId: string; patch: { is_active?: boolean; role?: string } }) =>
      apiUpdateUser(userId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useAssignmentConfig() {
  return useQuery({
    queryKey: ["assignment-config"],
    queryFn: apiGetAssignmentConfig,
    staleTime: 60_000,
  });
}

export function useUpdateAssignmentConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AssignmentConfig>) => apiUpdateAssignmentConfig(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment-config"] });
    },
  });
}

export function useCreateBug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBugPayload) => apiCreateBug(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bugs-my"] });
    },
  });
}
