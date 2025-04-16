import { createLocalStorage, createStrongholdStorage } from "@/lib/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export type BankConnectionStore = {
  firstName: string;
  setName: (name: string) => void;
};

export const useBankConnectionStore = create<BankConnectionStore>()(
  persist(
    immer((set, get) => ({
      firstName: "Jolyne",
      setName: (name: string) => set({ firstName: name }),
    })),
    {
      name: "bank-connection",
      storage: import.meta.env.DEV
        ? createLocalStorage()
        : createStrongholdStorage(),
    }
  )
);
