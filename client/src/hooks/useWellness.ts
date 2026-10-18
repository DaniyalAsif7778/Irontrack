import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api/api";
import type { WellnessDay } from "../types";
import { queryKeys } from "./queryKeys";

export function useWellness(date: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.wellness(date);
  const query = useQuery({ queryKey, queryFn: () => api<WellnessDay[]>(`/wellness?days=7&through=${date}`) });
  const save = useMutation({
    mutationFn: (value: WellnessDay) => api<WellnessDay>(`/wellness/${value.date}`, { method: "PUT", body: JSON.stringify({ waterGlasses: value.waterGlasses, movementBreaks: value.movementBreaks }) }),
    onMutate: async value => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WellnessDay[]>(queryKey);
      queryClient.setQueryData<WellnessDay[]>(queryKey, current => current?.map(item => item.date === value.date ? value : item));
      return { previous };
    },
    onError: (_error, _value, context) => { if (context?.previous) queryClient.setQueryData(queryKey, context.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  return { ...query, save };
}
