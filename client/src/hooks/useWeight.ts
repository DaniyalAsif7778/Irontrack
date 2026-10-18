import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api/api";
import type { WeightFormValues } from "../schemas/weight";
import type { Weight } from "../types";
import { queryKeys } from "./queryKeys";

export function useWeightLogs() {
  return useQuery({ queryKey: queryKeys.weights, queryFn: () => api<Weight[]>("/weight-logs") });
}

export function useWeightMutations() {
  const queryClient = useQueryClient();
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.weights }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics }),
  ]);
  const saveWeight = useMutation({
    mutationFn: (value: WeightFormValues) => api("/weight-logs", { method: "POST", body: JSON.stringify(value) }),
    onSuccess: refresh,
  });
  const removeWeight = useMutation({
    mutationFn: (id: string) => api(`/weight-logs/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { saveWeight, removeWeight };
}
