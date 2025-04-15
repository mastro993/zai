import { LazyStore } from "@tauri-apps/plugin-store";
import { PersistStorage, StorageValue } from "zustand/middleware";
import { Stronghold } from "./stronghold";

/**
 * Creates a persistent storage adapter for Zustand using Tauri's LazyStore.
 * This adapter allows Zustand stores to persist their state to the filesystem.
 *
 * @returns A PersistStorage object that implements the required methods for Zustand persistence
 */
export const createLocalStorage = <S>(): PersistStorage<S> => {
  const store = new LazyStore("store.json", { autoSave: 1000 });
  return {
    getItem: async (name) => {
      const value = await store.get(name);
      return value as StorageValue<S>;
    },
    setItem: async (name, storageValue) => {
      await store.set(name, storageValue);
    },
    removeItem: async (name) => {
      await store.delete(name);
    },
  };
};

/**
 * Creates a persistent storage adapter for Zustand using Stronghold.
 * This adapter allows Zustand stores to persist their state in an encrypted format.
 *
 * @returns A PersistStorage object that implements the required methods for Zustand persistence
 */
export const createStrongholdStorage = <S>(): PersistStorage<S> => ({
  async getItem(name) {
    const instance = await Stronghold.instance();
    const value = await instance.get(name);
    return value ? (value as StorageValue<S>) : null;
  },
  async setItem(name, storageValue) {
    const instance = await Stronghold.instance();
    await instance.insert(name, JSON.stringify(storageValue));
  },
  async removeItem(name) {
    const instance = await Stronghold.instance();
    await instance.remove(name);
  },
});
