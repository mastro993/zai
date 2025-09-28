import { create } from "zustand";

type SelectionStore = {
  selectedCategoryIds: ReadonlyArray<string>;
  toggleCategory: (categoryId: string) => void;
  clearSelection: () => void;
  setSelectedCategoryIds: (
    categoryIds: ReadonlyArray<string> | undefined
  ) => void;
};

const useSelectionStore = create<SelectionStore>((set) => ({
  selectedCategoryIds: [],
  toggleCategory: (categoryId: string) =>
    set((state) => ({
      selectedCategoryIds: state.selectedCategoryIds.includes(categoryId)
        ? state.selectedCategoryIds.filter((id) => id !== categoryId)
        : [...state.selectedCategoryIds, categoryId],
    })),
  setSelectedCategoryIds: (categoryIds: ReadonlyArray<string> | undefined) =>
    set({ selectedCategoryIds: categoryIds ?? [] }),
  clearSelection: () => set({ selectedCategoryIds: [] }),
}));

export { useSelectionStore };
