import { create } from "zustand";

type SelectionStore = {
  selectedCategoryIds: number[];
  toggleCategory: (categoryId: number) => void;
  clearSelection: () => void;
  setSelectedCategoryIds: (categoryIds: number[] | undefined) => void;
};

const useSelectionStore = create<SelectionStore>((set) => ({
  selectedCategoryIds: [],
  toggleCategory: (categoryId: number) =>
    set((state) => ({
      selectedCategoryIds: state.selectedCategoryIds.includes(categoryId)
        ? state.selectedCategoryIds.filter((id) => id !== categoryId)
        : [...state.selectedCategoryIds, categoryId],
    })),
  setSelectedCategoryIds: (categoryIds: number[] | undefined) =>
    set({ selectedCategoryIds: categoryIds ?? [] }),
  clearSelection: () => set({ selectedCategoryIds: [] }),
}));

export { useSelectionStore };
