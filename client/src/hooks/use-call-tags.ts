import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiGetCallBugTypeIds,
  apiGetBugTypeStats,
  apiSetCallQualityTag,
  apiUpdateCallBugTypeIds,
} from "@/lib/api";
import type { RawCall } from "@/types";

export function useCallBugTypeIds(callId: string | null) {
  return useQuery({
    queryKey: ["call-bug-type-ids", callId],
    queryFn: () => apiGetCallBugTypeIds(callId!),
    enabled: !!callId,
    staleTime: 30_000,
  });
}

export function useUpdateCallBugTypeIds(callId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bugTypeIds: number[]) => apiUpdateCallBugTypeIds(callId, bugTypeIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["call-bug-type-ids", callId] });
    },
  });
}

export function useSetCallQualityTag(callId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      qualityTag,
      notes,
    }: {
      qualityTag: RawCall["quality_tag"];
      notes?: string | null;
    }) => apiSetCallQualityTag(callId, qualityTag, notes),
    onSuccess: (updatedCall) => {
      qc.setQueryData(["call", callId], (prev: { call: RawCall; eval: unknown } | undefined) =>
        prev ? { ...prev, call: updatedCall } : prev,
      );
      qc.invalidateQueries({ queryKey: ["calls"] });
      qc.invalidateQueries({ queryKey: ["bookmarked-calls"] });
    },
  });
}

export function useBugTypeStats(days: number = 7) {
  return useQuery({
    queryKey: ["bug-type-stats", days],
    queryFn: () => apiGetBugTypeStats(days),
    staleTime: 120_000,
  });
}
