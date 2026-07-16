import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const oversizedContent = Array.from({ length: 401 }, (_, index) => `line ${index + 1}`).join("\n");
const boundaryContent = `${Array.from({ length: 400 }, (_, index) => `line ${index + 1}`).join("\n")}\n`;
const checkerPath = fileURLToPath(new URL("./check-file-size.mjs", import.meta.url));

test("flags oversized production files and excludes tests and generated UI", async () => {
  const root = await mkdtemp(join(tmpdir(), "zai-file-size-"));

  try {
    await mkdir(join(root, "apps/frontend/src/components/ui"), { recursive: true });
    await mkdir(join(root, "apps/frontend/src/features/example/__tests__"), { recursive: true });
    await mkdir(join(root, "crates/example/src"), { recursive: true });
    await mkdir(join(root, "scripts"), { recursive: true });
    await writeFile(join(root, "crates/example/src/oversized.rs"), oversizedContent);
    await writeFile(join(root, "crates/example/src/boundary.rs"), boundaryContent);
    await writeFile(
      join(root, "apps/frontend/src/features/example/__tests__/oversized.test.ts"),
      oversizedContent,
    );
    await writeFile(
      join(root, "apps/frontend/src/components/ui/generated.tsx"),
      oversizedContent,
    );
    await writeFile(join(root, "scripts/file-size-exceptions.json"), "{}\n");

    const failed = spawnSync(process.execPath, [checkerPath, "--root", root], {
      encoding: "utf8",
    });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /oversized\.rs: 401 lines/);
    assert.doesNotMatch(failed.stderr, /boundary\.rs/);
    assert.doesNotMatch(failed.stderr, /oversized\.test\.ts/);
    assert.doesNotMatch(failed.stderr, /components\/ui/);

    await rm(join(root, "crates/example/src/oversized.rs"));
    const passed = spawnSync(process.execPath, [checkerPath, "--root", root], {
      encoding: "utf8",
    });
    assert.equal(passed.status, 0);
    assert.match(passed.stdout, /Production files stay within 400 lines/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
