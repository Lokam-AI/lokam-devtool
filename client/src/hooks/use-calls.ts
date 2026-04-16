import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiGetCalls,
  apiGetCall,
  apiSubmitEval,
  apiGetTeam,
  apiGetHealth,
  apiGetUsers,
  apiCreateUser,
} from "@/lib/api";
import type { Eval } from "@/types";

export function useCalls() {
  return useQuery({
    queryKey: ["calls"],
    queryFn: apiGetCalls,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calls"] });
    },
  });
}

export function useTeam() {
  return useQuery({ queryKey: ["team"], queryFn: apiGetTeam });
}

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: apiGetHealth, refetchInterval: 30000 });
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
