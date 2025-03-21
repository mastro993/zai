import { create } from "zustand";

const useExportStore = create((set) => ({
  isExporting: false,
  setIsExporting: (isExporting: boolean) => set({ isExporting }),
}));
