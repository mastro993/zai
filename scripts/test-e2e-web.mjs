import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const shard = args.find((arg) => arg.startsWith("--shard="));
const positional = args.filter((arg) => !arg.startsWith("-"));
const runSetup =
  (!shard || shard === "--shard=1/2") &&
  (positional.length === 0 || positional.some((arg) => arg.includes("currency-setup")));

const main = spawnSync("pnpm", ["exec", "playwright", "test", ...args], { stdio: "inherit" });
if (main.status) {
  process.exit(main.status);
}

if (!runSetup) {
  process.exit(0);
}

const setupArgs = args.filter((arg) => !arg.startsWith("--shard="));
const setup = spawnSync(
  "pnpm",
  ["exec", "playwright", "test", "-c", "playwright.currency-setup.config.ts", ...setupArgs],
  { stdio: "inherit" },
);
process.exit(setup.status ?? 0);
