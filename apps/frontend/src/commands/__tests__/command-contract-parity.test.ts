import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BACKEND_COMMAND_NAMES, WEB_MAPPED_BACKEND_COMMAND_NAMES } from "@/commands/registry";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const featuresCommandsRoot = path.join(repoRoot, "apps/frontend/src/features");
const centralWebCommandMapPath = "apps/frontend/src/commands/web-command-map.ts";

const readFile = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

const discoverFeatureWebCommandMapFiles = (): Array<string> => {
  const maps: Array<string> = [];

  for (const featureName of readdirSync(featuresCommandsRoot).toSorted()) {
    const relativePath = path.join(
      "apps/frontend/src/features",
      featureName,
      "commands",
      "web-command-map.ts",
    );
    if (existsSync(path.join(repoRoot, relativePath))) {
      maps.push(relativePath);
    }
  }

  return maps;
};

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

  for (const relativePath of discoverFeatureWebCommandMapFiles()) {
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
  it("discovers every feature-owned web command map", () => {
    const discoveredMaps = discoverFeatureWebCommandMapFiles();
    expect(discoveredMaps).toEqual([
      "apps/frontend/src/features/alerts/commands/web-command-map.ts",
      "apps/frontend/src/features/budgets/commands/web-command-map.ts",
      "apps/frontend/src/features/categories/commands/web-command-map.ts",
      "apps/frontend/src/features/recurring-transactions/commands/web-command-map.ts",
      "apps/frontend/src/features/transactions/commands/web-command-map.ts",
    ]);

    const centralSource = readFile(centralWebCommandMapPath);
    for (const relativePath of discoveredMaps) {
      const importPath = relativePath.replace(/^apps\/frontend\/src\//, "@/").replace(/\.ts$/, "");
      expect(centralSource).toContain(`from "${importPath}"`);
    }
  });

  it("lists every backend command in the typed registry", () => {
    expect(toSortedArray(BACKEND_COMMAND_NAMES)).toEqual(
      toSortedArray([
        "adopt_recurring_transaction",
        "create_budget",
        "create_recurring_transaction",
        "create_transaction",
        "create_transaction_category",
        "delete_budget",
        "delete_recurring_transaction",
        "delete_transaction",
        "delete_transaction_categories",
        "delete_transactions",
        "execute_recurring_bulk",
        "export_transactions_csv",
        "find_existing_duplicate_keys",
        "get_budget",
        "get_budget_history",
        "get_budgets",
        "get_filtered_transaction_ids",
        "get_matching_recurring_transaction_ids",
        "get_recurring_budget_projections",
        "get_recurring_generation_failure_diagnostics",
        "get_recurring_transaction",
        "get_recurring_transaction_failure_history",
        "get_recurring_transaction_occurrences",
        "get_recurring_transactions",
        "get_transaction",
        "get_transaction_categories",
        "get_transaction_category",
        "get_transaction_recurring_provenance",
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
        "pause_recurring_transaction",
        "preflight_recurring_bulk",
        "preview_delete_transaction_categories",
        "preview_recurring_adoption",
        "preview_recurring_generation_repair",
        "repair_recurring_generation_failure",
        "resume_budget",
        "resume_recurring_transaction",
        "retry_recurring_generation_failure",
        "stop_recurring_transaction",
        "update_budget",
        "update_recurring_transaction",
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
