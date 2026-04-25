import { create } from "zustand";

export const usePanelStore = create((set, get) => ({
  isExpanded: false,
  currentTab: "today",
  nudges: [],
  context: {},
  composeContext: null,
  status: null,

  setExpanded: (expanded) => {
    set({ isExpanded: expanded });
    if (window.ariaDesktop) {
      if (expanded) {
        window.ariaDesktop.expandPanel();
      } else {
        window.ariaDesktop.collapsePanel();
      }
    }
  },

  toggleExpanded: () => {
    const isExpanded = !get().isExpanded;
    get().setExpanded(isExpanded);
  },

  setCurrentTab: (tab) => set({ currentTab: tab }),

  setNudges: (nudges) => set({ nudges }),
  
  removeNudge: (id) => set((state) => ({ 
    nudges: state.nudges.filter(n => n.id !== id) 
  })),

  setContext: (context) => set({ context }),
  
  setComposeContext: (composeContext) => set({ composeContext }),
  
  setStatus: (status) => set({ status }),
}));
