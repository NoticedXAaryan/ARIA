import { useQuery } from "@tanstack/react-query";

export function useNudges() {
  return useQuery({
    queryKey: ["nudges"],
    queryFn: async () => {
      const res = await fetch("http://127.0.0.1:8742/api/nudges/active");
      return res.json();
    },
    refetchInterval: 10000
  });
}
