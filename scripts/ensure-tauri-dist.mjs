import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST_INDEX = "<!doctype html><html><body></body></html>\n";

export function ensureTauriDist(root = process.cwd()) {
  const indexPath = path.join(root, "dist", "index.html");
  if (!fs.existsSync(indexPath)) {
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, DIST_INDEX);
  }
  return indexPath;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  ensureTauriDist();
}
