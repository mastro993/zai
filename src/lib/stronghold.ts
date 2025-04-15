import * as tauri from "@tauri-apps/plugin-stronghold";
import { appDataDir } from "@tauri-apps/api/path";

const CLIENT_NAME = "zai-client";
const VAULT_FILE = `vault.hold`;
const VAULT_PASSWORD = "WjlWZ1W5tNDc30HamIQegK/nNuYTfuHI6Pe6aoyr6zc=";

/**
 * Stronghold class provides a secure storage solution using the Tauri Stronghold plugin.
 * It manages encrypted data storage with a client-based approach, allowing for
 * secure key-value storage operations.
 */
export class Stronghold {
  private static _instance: Stronghold;

  private client: tauri.Client;
  private stronghold: tauri.Stronghold;

  /**
   * Creates a new Stronghold instance.
   *
   * @param client - The Tauri client instance for store operations
   * @param stronghold - The Tauri Stronghold instance for vault operations
   * @private
   */
  private constructor(client: tauri.Client, stronghold: tauri.Stronghold) {
    this.client = client;
    this.stronghold = stronghold;
  }

  /**
   * Gets the singleton instance of the Stronghold class.
   * If an instance doesn't exist, it creates one by calling the init method.
   *
   * @returns A promise that resolves to the Stronghold instance
   * @static
   */
  static async instance(): Promise<Stronghold> {
    if (!this._instance) {
      this._instance = await this.init();
    }
    return this._instance;
  }

  /**
   * Initializes a new Stronghold instance or loads an existing one.
   * This method creates a new vault if one doesn't exist, or loads an existing vault
   * from the application data directory.
   *
   * @returns A promise that resolves to a new Stronghold instance
   * @static
   * @throws {Error} If the vault cannot be loaded or created
   */
  static async init(): Promise<Stronghold> {
    const vaultPath = `${await appDataDir()}/${VAULT_FILE}`;
    const stronghold = await tauri.Stronghold.load(vaultPath, VAULT_PASSWORD);

    let client: tauri.Client;
    try {
      client = await stronghold.loadClient(CLIENT_NAME);
    } catch {
      client = await stronghold.createClient(CLIENT_NAME);
    }
    return new Stronghold(client, stronghold);
  }

  /**
   * Inserts a key-value pair into the store.
   * The value is encoded using TextEncoder before being stored.
   *
   * @param key - The key to store the value under
   * @param value - The value to store
   * @returns A promise that resolves when the value is stored
   * @throws {Error} If the store operation fails
   */
  async insert(key: string, value: string): Promise<void> {
    const store = this.client.getStore();
    const data = Array.from(new TextEncoder().encode(value));
    await store.insert(key, data);
  }

  /**
   * Retrieves a value from the store by its key.
   * The value is decoded using TextDecoder before being returned.
   *
   * @param key - The key to retrieve
   * @returns A promise that resolves to the stored value or undefined if not found
   * @throws {Error} If the retrieval operation fails
   */
  async get(key: string): Promise<unknown> {
    const store = this.client.getStore();
    const data = await store.get(key);
    return data ? new TextDecoder().decode(data) : undefined;
  }

  /**
   * Removes a key-value pair from the store.
   *
   * @param key - The key to remove
   * @returns A promise that resolves when the key-value pair is removed
   * @throws {Error} If the removal operation fails
   */
  async remove(key: string): Promise<void> {
    const store = this.client.getStore();
    await store.remove(key);
  }

  /**
   * Saves the current state of the Stronghold vault to disk.
   * This method should be called after making changes to ensure data persistence.
   *
   * @returns A promise that resolves when the vault is saved
   * @throws {Error} If the save operation fails
   */
  async save(): Promise<void> {
    await this.stronghold.save();
  }
}
