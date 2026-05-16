import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCreateSuperConfig, apiListSuperConfigs, apiUpdateSuperConfig } from "@/lib/api";
import type { SuperConfig } from "@/types";

export function useSuperConfigs(category: string) {
  return useQuery({
    queryKey: ["super-configs", category],
    queryFn: () => apiListSuperConfigs(category),
    staleTime: 60_000,
  });
}

export function useCreateSuperConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof apiCreateSuperConfig>[0]) =>
      apiCreateSuperConfig(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["super-configs", variables.category] });
    },
  });
}

export function useUpdateSuperConfig(category: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<SuperConfig> }) =>
      apiUpdateSuperConfig(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["super-configs", category] });
    },
  });
}
