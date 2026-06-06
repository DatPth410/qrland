import { create } from 'zustand';

/** 'scene' = isometric world, 'scan' = top-down (still 3D, just scannable) */
export type View = 'scene' | 'scan';

interface ViewState {
  view: View;
  toggle: () => void;
  setView: (v: View) => void;
}

export const useView = create<ViewState>()((set) => ({
  view: 'scene',
  toggle: () => set((s) => ({ view: s.view === 'scene' ? 'scan' : 'scene' })),
  setView: (view) => set({ view }),
}));
