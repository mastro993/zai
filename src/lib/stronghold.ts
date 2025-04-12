/**
 * Stronghold Integration Module
 *
 * This module provides a secure storage solution using the Tauri Stronghold plugin.
 * Stronghold is a secure storage system that encrypts data at rest and provides
 * a simple key-value store interface.
 */

import { Client, Store, Stronghold } from "@tauri-apps/plugin-stronghold";
import { appDataDir } from "@tauri-apps/api/path";

const CLIENT_NAME = "zai-client";
const VAULT_PASSWORD = "WjlWZ1W5tNDc30HamIQegK/nNuYTfuHI6Pe6aoyr6zc=";

/**
 * Initializes a Stronghold vault and client for secure data storage.
 *
 * This function:
 * 1. Creates a vault file in the application data directory
 * 2. Loads or creates a client within the vault
 * 3. Returns both the stronghold instance and client for further operations
 */
export const initStronghold = async (): Promise<{
  stronghold: Stronghold;
  client: Client;
}> => {
  const vaultPath = `${await appDataDir()}/vault.hold`;
  const stronghold = await Stronghold.load(vaultPath, VAULT_PASSWORD);

  let client: Client;
  try {
    client = await stronghold.loadClient(CLIENT_NAME);
  } catch {
    client = await stronghold.createClient(CLIENT_NAME);
  }

  return {
    stronghold,
    client,
  };
};

/**
 * Inserts a record into a Stronghold store.
 *
 * @param store - The Stronghold store to insert the record into
 * @param key - The key to associate with the value
 * @param value - The string value to store
 */
export async function insertRecord(
  store: Store,
  key: string,
  value: string
): Promise<void> {
  const data = Array.from(new TextEncoder().encode(value));
  await store.insert(key, data);
}

/**
 * Retrieves a record from a Stronghold store.
 *
 * @param store - The Stronghold store to retrieve the record from
 * @param key - The key of the record to retrieve
 * @throws {Error} If the record does not exist or is null
 */
export async function getRecord(store: Store, key: string): Promise<string> {
  const data = await store.get(key);
  if (data === null) {
    throw new Error("data is null");
  }
  return new TextDecoder().decode(data);
}
