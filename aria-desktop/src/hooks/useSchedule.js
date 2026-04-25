import { useQuery } from "@tanstack/react-query";

export function useSchedule() {
  return useQuery({
    queryKey: ["schedule"],
    queryFn: async () => {
      const res = await fetch("http://127.0.0.1:8742/api/schedule/today");
      return res.json();
    },
    refetchInterval: 60000
  });
}
