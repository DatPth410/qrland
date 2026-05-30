import { create } from 'zustand';

/** 'scene' = isometric island, 'scan' = top-down (still 3D, just scannable) */
export type View = 'scene' | 'scan';

export interface ScanResult {
  ok: boolean;
  decoded: string | null;
}

interface ViewState {
  view: View;
  toggle: () => void;
  setView: (v: View) => void;
  /** latest scannability self-check result, or null if not run yet */
  scan: ScanResult | null;
  setScan: (r: ScanResult) => void;
}

export const useView = create<ViewState>((set) => ({
  view: 'scene',
  toggle: () => set((s) => ({ view: s.view === 'scene' ? 'scan' : 'scene' })),
  setView: (view) => set({ view }),
  scan: null,
  setScan: (scan) => set({ scan }),
}));
