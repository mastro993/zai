import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lefthookEntry = path.join(root, "node_modules/lefthook/bin/index.js");
const receivedArgs = process.argv.slice(2);
const args = receivedArgs[0] === "lefthook" ? receivedArgs.slice(1) : receivedArgs;
const env = { ...process.env };

if (args[0] === "run" && args[1] === "agent-stop") {
  env.LEFTHOOK_OUTPUT = "execution_out";
}

const result = spawnSync(process.execPath, [lefthookEntry, ...args], {
  cwd: root,
  env,
  stdio: "inherit",
});

if (result.error) {
  process.stderr.write(`Unable to run Lefthook: ${result.error.message}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
