import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiGetBucketConfig,
  apiBulkUpdateReviewerCapacities,
  apiListReviewerCapacities,
  apiUpdateBucketConfig,
  apiUpdateReviewerCapacity,
} from "@/lib/api";
import type { BucketConfig } from "@/types";

export function useBucketConfig() {
  return useQuery({
    queryKey: ["bucket-config"],
    queryFn: apiGetBucketConfig,
    staleTime: 60_000,
  });
}

export function useUpdateBucketConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<BucketConfig>) => apiUpdateBucketConfig(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bucket-config"] });
    },
  });
}

export function useReviewerCapacities() {
  return useQuery({
    queryKey: ["reviewer-capacities"],
    queryFn: apiListReviewerCapacities,
    staleTime: 60_000,
  });
}

export function useUpdateReviewerCapacity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, capacity }: { userId: number; capacity: number | null }) =>
      apiUpdateReviewerCapacity(userId, capacity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviewer-capacities"] });
    },
  });
}

export function useBulkUpdateReviewerCapacities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: { user_id: number; capacity: number | null }[]) =>
      apiBulkUpdateReviewerCapacities(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviewer-capacities"] });
    },
  });
}
