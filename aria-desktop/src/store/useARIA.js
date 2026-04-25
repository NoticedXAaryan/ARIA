import { create } from "zustand";

export const useARIA = create((set) => ({
  activeNudges: [],
  schedule: [],
  habits: [],
  setActiveNudges: (activeNudges) => set({ activeNudges }),
  setSchedule: (schedule) => set({ schedule }),
  setHabits: (habits) => set({ habits })
}));
