import { useQuery } from "@tanstack/react-query";
import { API } from "../lib/api";

export function useNudges() {
  return useQuery({
    queryKey: ["nudges"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/nudges/active`);
      return res.json();
    },
    refetchInterval: 10000
  });
}
