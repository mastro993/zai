import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const codexHooks = JSON.parse(
  fs.readFileSync(path.join(root, '.codex/hooks.json'), 'utf8'),
);

function commandsFor(eventName) {
  return codexHooks.hooks[eventName].flatMap((entry) => entry.hooks ?? [entry]);
}

test('Codex hook commands reference existing local entrypoints', () => {
  const commands = [
    ...commandsFor('SessionStart'),
    ...commandsFor('PostToolUse'),
    ...commandsFor('Stop'),
  ].map((hook) => hook.command);

  assert.ok(commands.length > 0);
  assert.ok(
    commands.every((command) => typeof command === 'string' && command.length > 0),
  );
  assert.ok(
    commands.every((command) => {
      const match = command.match(/\)\/(\.[^"\s]+)/);
      return match && fs.existsSync(path.join(root, match[1]));
    }),
    `A Codex hook references a missing entrypoint:\n${commands.join('\n')}`,
  );
});
