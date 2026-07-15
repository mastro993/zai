import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BACKEND_COMMAND_NAMES, WEB_MAPPED_BACKEND_COMMAND_NAMES } from "@/commands/registry";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

const WEB_COMMAND_MAP_FILES = [
  "apps/frontend/src/commands/web-command-map.ts",
  "apps/frontend/src/commands/alerts-web-command-map.ts",
] as const;

const readFile = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

const readTauriCommands = (): Set<string> | null => {
  const source = readFile("apps/tauri/src/lib.rs");
  const handlerBlock = source.match(/generate_handler!\[([\s\S]*?)\]/)?.[1];

  if (!handlerBlock) {
    return null;
  }

  const commands = new Set<string>();
  for (const match of handlerBlock.matchAll(/commands::\w+::(\w+)/g)) {
    commands.add(match[1]);
  }

  return commands;
};

const readWebCommands = (): Set<string> => {
  const commands = new Set<string>();

  for (const relativePath of WEB_COMMAND_MAP_FILES) {
    const source = readFile(relativePath);
    for (const match of source.matchAll(/case "([^"]+)":/g)) {
      commands.add(match[1]);
    }
  }

  return commands;
};

const toSortedArray = (commands: Iterable<string>): Array<string> =>
  [...commands].toSorted((left, right) => left.localeCompare(right));

describe("command transport registry parity", () => {
  it("lists every backend command in the typed registry", () => {
    expect(toSortedArray(BACKEND_COMMAND_NAMES)).toEqual(
      toSortedArray([
        "create_budget",
        "create_transaction",
        "create_transaction_category",
        "delete_budget",
        "delete_transaction",
        "delete_transaction_categories",
        "delete_transactions",
        "get_budget",
        "get_budget_history",
        "get_budgets",
        "get_transaction",
        "get_transaction_categories",
        "get_transaction_category",
        "get_transactions",
        "get_unread_alert_count",
        "import_transaction_batch",
        "import_transaction_categories",
        "import_transactions",
        "list_alerts",
        "mark_alert_read",
        "mark_alert_unread",
        "mark_all_alerts_read",
        "pause_budget",
        "resume_budget",
        "update_budget",
        "update_transaction",
        "update_transaction_category",
      ]),
    );
  });

  it("keeps Tauri IPC and web command map registrations aligned with the registry", () => {
    const tauriCommands = readTauriCommands();
    const webCommands = readWebCommands();

    expect(tauriCommands).not.toBeNull();
    if (!tauriCommands) {
      return;
    }

    expect(toSortedArray(tauriCommands)).toEqual(toSortedArray(WEB_MAPPED_BACKEND_COMMAND_NAMES));
    expect(toSortedArray(webCommands)).toEqual(toSortedArray(WEB_MAPPED_BACKEND_COMMAND_NAMES));
  });

  it("registers every web-mapped backend command in Tauri IPC and the web map", () => {
    const tauriCommands = readTauriCommands();
    const webCommands = readWebCommands();

    expect(tauriCommands).not.toBeNull();
    if (!tauriCommands) {
      return;
    }

    for (const command of WEB_MAPPED_BACKEND_COMMAND_NAMES) {
      expect(tauriCommands.has(command), `missing Tauri registration for ${command}`).toBe(true);
      expect(webCommands.has(command), `missing web command map entry for ${command}`).toBe(true);
    }
  });
});
