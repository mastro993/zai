import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { findOversizedProductionFiles } from "./check-file-size.mjs";

const oversizedContent = Array.from({ length: 401 }, (_, index) => `line ${index + 1}`).join("\n");

test("flags oversized production files and excludes tests and generated UI", async () => {
  const root = await mkdtemp(join(tmpdir(), "zai-file-size-"));

  try {
    await mkdir(join(root, "apps/frontend/src/components/ui"), { recursive: true });
    await mkdir(join(root, "apps/frontend/src/features/example/__tests__"), { recursive: true });
    await mkdir(join(root, "crates/example/src"), { recursive: true });
    await mkdir(join(root, "scripts"), { recursive: true });
    await writeFile(join(root, "crates/example/src/oversized.rs"), oversizedContent);
    await writeFile(
      join(root, "apps/frontend/src/features/example/__tests__/oversized.test.ts"),
      oversizedContent,
    );
    await writeFile(
      join(root, "apps/frontend/src/components/ui/generated.tsx"),
      oversizedContent,
    );

    const violations = await findOversizedProductionFiles({ root, exceptions: {} });

    assert.deepEqual(violations, [
      { lineCount: 401, path: "crates/example/src/oversized.rs" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
