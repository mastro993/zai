import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../../..");

const DESKTOP_ONLY_COMMANDS = new Set(["get_stronghold_vault_password"]);

const FRONTEND_WRAPPER_FILES = [
  "apps/frontend/src/features/cash-flow/commands/budgets.ts",
  "apps/frontend/src/features/cash-flow/commands/transaction-categories.ts",
  "apps/frontend/src/features/cash-flow/commands/transactions.ts",
] as const;

const WEB_COMMAND_MAP_FILES = [
  "apps/frontend/src/commands/web-command-map.ts",
  "apps/frontend/src/commands/alerts-web-command-map.ts",
] as const;

const readFile = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

const readFrontendCommands = (): Set<string> => {
  const commands = new Set<string>();

  for (const relativePath of FRONTEND_WRAPPER_FILES) {
    const source = readFile(relativePath);
    for (const match of source.matchAll(/invokeCommand<[^>]*>\(\s*"([^"]+)"/g)) {
      commands.add(match[1]);
    }
  }

  return commands;
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

  for (const command of DESKTOP_ONLY_COMMANDS) {
    commands.delete(command);
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

const toSortedArray = (commands: Set<string>): Array<string> =>
  [...commands].toSorted((left, right) => left.localeCompare(right));

describe("cash flow command parity", () => {
  it("keeps Tauri IPC and web command map registrations aligned", () => {
    const tauriCommands = readTauriCommands();
    const webCommands = readWebCommands();

    expect(tauriCommands).not.toBeNull();
    if (!tauriCommands) {
      return;
    }

    expect(toSortedArray(tauriCommands)).toEqual(toSortedArray(webCommands));
  });

  it("registers every frontend Cash flow command in Tauri IPC and the web map", () => {
    const frontendCommands = readFrontendCommands();
    const tauriCommands = readTauriCommands();
    const webCommands = readWebCommands();

    expect(tauriCommands).not.toBeNull();
    if (!tauriCommands) {
      return;
    }

    for (const command of frontendCommands) {
      expect(tauriCommands.has(command), `missing Tauri registration for ${command}`).toBe(true);
      expect(webCommands.has(command), `missing web command map entry for ${command}`).toBe(true);
    }
  });

  it("excludes desktop-only secret commands from parity expectations", () => {
    const tauriSource = readFile("apps/tauri/src/lib.rs");

    expect(tauriSource).toContain("get_stronghold_vault_password");
    expect(readWebCommands().has("get_stronghold_vault_password")).toBe(false);
  });
});
