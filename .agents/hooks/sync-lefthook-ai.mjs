import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const launcher =
  'cd "$(git rev-parse --show-toplevel)" && node .agents/hooks/run-lefthook.mjs lefthook';

function command(hook) {
  return `${launcher} run ${hook}`;
}

function isManagedCommand(entry) {
  return (
    typeof entry?.command === "string" &&
    entry.command.includes(".agents/hooks/run-lefthook.mjs") &&
    /\brun agent-(?:fix|stop)\b/.test(entry.command)
  );
}

function withoutManagedMatchers(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.flatMap((entry) => {
    if (!Array.isArray(entry?.hooks)) {
      return [entry];
    }

    const hooks = entry.hooks.filter((hook) => !isManagedCommand(hook));
    return hooks.length > 0 ? [{ ...entry, hooks }] : [];
  });
}

function withoutManagedFlatEntries(entries) {
  return Array.isArray(entries) ? entries.filter((entry) => !isManagedCommand(entry)) : [];
}

function matcherEntry(hook, metadata = {}) {
  return {
    hooks: [
      {
        type: "command",
        command: command(hook),
        ...metadata,
      },
    ],
  };
}

async function readJson(relativePath) {
  const file = path.join(root, relativePath);
  return { file, input: await readFile(file, "utf8") };
}

async function writeJson(file, input, value) {
  const output = `${JSON.stringify(value, null, 2)}\n`;
  if (output !== input) {
    const temporaryFile = `${file}.${process.pid}.tmp`;
    await writeFile(temporaryFile, output);
    await rename(temporaryFile, file);
  }
}

async function planMatcherProvider(relativePath, metadata) {
  const { file, input } = await readJson(relativePath);
  const document = JSON.parse(input);
  const hooks = document.hooks && typeof document.hooks === "object" ? document.hooks : {};

  hooks.PostToolUse = [...withoutManagedMatchers(hooks.PostToolUse), matcherEntry("agent-fix")];
  hooks.Stop = [...withoutManagedMatchers(hooks.Stop), matcherEntry("agent-stop", metadata)];

  return { file, input, value: { ...document, hooks } };
}

async function planCursor() {
  const { file, input } = await readJson(".cursor/hooks.json");
  const document = JSON.parse(input);
  const hooks = document.hooks && typeof document.hooks === "object" ? document.hooks : {};

  hooks.afterFileEdit = [
    ...withoutManagedFlatEntries(hooks.afterFileEdit),
    { command: command("agent-fix") },
  ];
  hooks.stop = [
    ...withoutManagedFlatEntries(hooks.stop),
    { command: command("agent-stop"), timeout: 900, loop_limit: 5 },
  ];

  const { hooks: ignoredHooks, version: ignoredVersion, ...rest } = document;
  return { file, input, value: { version: 1, ...rest, hooks } };
}

async function planCopilot() {
  const { file, input } = await readJson(".github/hooks/lefthook.json");
  return {
    file,
    input,
    value: {
      version: 1,
      hooks: {
        postToolUse: [{ command: command("agent-fix") }],
        agentStop: [
          {
            type: "command",
            command: command("agent-stop"),
            timeoutSec: 900,
          },
        ],
      },
    },
  };
}

const plans = await Promise.all([
  planMatcherProvider(".claude/settings.json", { timeout: 900 }),
  planMatcherProvider(".codex/hooks.json", {
    timeout: 900,
    statusMessage: "Running repository checks",
  }),
  planCursor(),
  planCopilot(),
]);

for (const plan of plans) {
  await writeJson(plan.file, plan.input, plan.value);
}
