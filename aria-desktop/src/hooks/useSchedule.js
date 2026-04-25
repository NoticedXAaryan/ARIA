import { useQuery } from "@tanstack/react-query";
import { API } from "../lib/api";

export function useSchedule() {
  return useQuery({
    queryKey: ["schedule"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/schedule/today`);
      return res.json();
    },
    refetchInterval: 60000
  });
}
