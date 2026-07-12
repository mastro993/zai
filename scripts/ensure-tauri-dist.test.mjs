import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureTauriDist } from "./ensure-tauri-dist.mjs";

test("creates the Tauri dist stub only when the frontend build is absent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zai-dist-test-"));
  const indexPath = path.join(root, "dist", "index.html");

  ensureTauriDist(root);
  assert.equal(fs.readFileSync(indexPath, "utf8"), "<!doctype html><html><body></body></html>\n");

  fs.writeFileSync(indexPath, "<!doctype html><html><body>built</body></html>\n");
  ensureTauriDist(root);
  assert.equal(
    fs.readFileSync(indexPath, "utf8"),
    "<!doctype html><html><body>built</body></html>\n",
  );

  fs.rmSync(root, { recursive: true, force: true });
});
