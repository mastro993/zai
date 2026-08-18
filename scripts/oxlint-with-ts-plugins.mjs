import { spawn } from "node:child_process";

const [major, minor] = process.versions.node.split(".").map(Number);
const typeStripDefault = major >= 23 || (major === 22 && minor >= 18);
const env = { ...process.env };
if (!typeStripDefault) {
  const extra = "--experimental-strip-types --no-warnings";
  env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ${extra}` : extra;
}

const child = spawn("oxlint", process.argv.slice(2), {
  stdio: "inherit",
  env,
});
child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
