import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BACKEND_COMMAND_NAMES } from "@/commands/registry";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const readFile = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");
const toSortedArray = (commands: Iterable<string>): Array<string> =>
  [...commands].toSorted((left, right) => left.localeCompare(right));

const readTauriCommands = (): Set<string> | null => {
  const handlerBlock = readFile("apps/tauri/src/lib.rs").match(
    /generate_handler!\[([\s\S]*?)\]/,
  )?.[1];
  if (!handlerBlock) return null;
  const commands = new Set<string>();
  for (const match of handlerBlock.matchAll(/commands::\w+::(\w+)/g)) {
    commands.add(match[1]);
  }
  return commands;
};

describe("command transport registry parity", () => {
  it("keeps Tauri registration aligned with every descriptor", () => {
    const tauriCommands = readTauriCommands();
    expect(tauriCommands).not.toBeNull();
    if (!tauriCommands) return;
    expect(toSortedArray(tauriCommands)).toEqual(toSortedArray(BACKEND_COMMAND_NAMES));
  });

  it("keeps privileged processing and zone inputs off public surfaces", () => {
    const surfaces = [
      "apps/tauri/src/lib.rs",
      "apps/frontend/src/commands/registry.ts",
      "apps/frontend/src/features/alerts/commands/registry.ts",
      "apps/frontend/src/features/budgets/commands/registry.ts",
      "apps/frontend/src/features/categories/commands/registry.ts",
      "apps/frontend/src/features/transactions/commands/registry.ts",
      "apps/frontend/src/features/recurring-transactions/commands/registry.ts",
      "apps/frontend/src/features/alerts/commands/web-requests.ts",
      "apps/frontend/src/features/budgets/commands/web-requests.ts",
      "apps/frontend/src/features/categories/commands/web-requests.ts",
      "apps/frontend/src/features/transactions/commands/web-requests.ts",
      "apps/frontend/src/features/recurring-transactions/commands/web-requests.ts",
    ];
    for (const relativePath of surfaces) {
      const source = readFile(relativePath);
      expect(source, relativePath).not.toMatch(/process_due|process-due|processDue/);
    }

    const recurringSources = [
      "apps/frontend/src/features/recurring-transactions/commands/web-requests.ts",
      "apps/frontend/src/features/recurring-transactions/commands/recurring-transactions.ts",
      "apps/frontend/src/features/recurring-transactions/types/recurring-transaction.ts",
      "apps/tauri/src/commands/recurring_transactions.rs",
    ];
    for (const relativePath of recurringSources) {
      const source = readFile(relativePath);
      expect(source, relativePath).not.toMatch(/\btimeZone\b/);
      if (relativePath.endsWith(".rs")) {
        expect(source, relativePath).not.toMatch(/\bzone\b/);
      } else if (!relativePath.endsWith("recurring-transaction.ts")) {
        expect(source, relativePath).not.toMatch(/\bzone\b/);
      }
    }

    const privilegedSchema = readFile(
      "apps/frontend/src/features/recurring-transactions/types/recurring-transaction.ts",
    );
    expect(privilegedSchema).toContain("zone: z.never()");
    expect(privilegedSchema).not.toMatch(/timeZone/);
  });
});
