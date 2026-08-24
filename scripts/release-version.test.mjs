import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  addUtcDays,
  calendarCoreFromIsoDate,
  compareReleaseTags,
  formatReleaseNotes,
  parseReleaseTag,
  previousReleaseTag,
  resolveBetaRelease,
  resolveStableRelease,
  stampVersion,
} from "./release-version.mjs";

describe("calendarCoreFromIsoDate", () => {
  it("drops leading zeros on month and day", () => {
    assert.equal(calendarCoreFromIsoDate("2026-08-24"), "2026.8.24");
    assert.equal(calendarCoreFromIsoDate("2026-11-02"), "2026.11.2");
  });
});

describe("addUtcDays", () => {
  it("crosses month boundaries in UTC", () => {
    assert.equal(addUtcDays("2026-08-31", 1), "2026-09-01");
  });
});

describe("parseReleaseTag", () => {
  it("parses beta and stable tags and ignores other tags", () => {
    assert.deepEqual(parseReleaseTag("v2026.8.24-beta.0"), {
      kind: "beta",
      year: 2026,
      month: 8,
      day: 24,
      n: 0,
      tag: "v2026.8.24-beta.0",
      version: "2026.8.24-beta.0",
      core: "2026.8.24",
    });
    assert.equal(parseReleaseTag("v2026.8.24")?.kind, "stable");
    assert.equal(parseReleaseTag("app-v0.0.1-alpha.1"), null);
  });
});

describe("compareReleaseTags", () => {
  it("orders same-day stable after every beta", () => {
    const beta = parseReleaseTag("v2026.8.24-beta.99");
    const stable = parseReleaseTag("v2026.8.24");
    assert.ok(beta);
    assert.ok(stable);
    assert.ok(compareReleaseTags(stable, beta) > 0);
  });
});

describe("resolveBetaRelease", () => {
  it("starts at beta.0 when no tags exist", () => {
    const result = resolveBetaRelease({
      today: "2026-08-24",
      tags: [],
      headSha: "aaa",
      tagShas: {},
    });
    assert.deepEqual(result, {
      ok: true,
      skip: false,
      channel: "beta",
      prerelease: true,
      version: "2026.8.24-beta.0",
      tag: "v2026.8.24-beta.0",
    });
  });

  it("increments N for a second ship of the same UTC date", () => {
    const result = resolveBetaRelease({
      today: "2026-08-24",
      tags: ["v2026.8.24-beta.0"],
      headSha: "bbb",
      tagShas: { "v2026.8.24-beta.0": "aaa" },
    });
    assert.equal(result.version, "2026.8.24-beta.1");
  });

  it("skips when HEAD already has the latest beta tag", () => {
    const result = resolveBetaRelease({
      today: "2026-08-24",
      tags: ["v2026.8.24-beta.0"],
      headSha: "aaa",
      tagShas: { "v2026.8.24-beta.0": "aaa" },
    });
    assert.deepEqual(result, { ok: true, skip: true });
  });

  it("mints the next N for the same HEAD when allowSameHead is set", () => {
    const result = resolveBetaRelease({
      today: "2026-08-24",
      tags: ["v2026.8.24-beta.0"],
      headSha: "aaa",
      tagShas: { "v2026.8.24-beta.0": "aaa" },
      allowSameHead: true,
    });
    assert.equal(result.version, "2026.8.24-beta.1");
    assert.equal(result.skip, false);
  });

  it("uses the next UTC date when that date already has a stable", () => {
    const result = resolveBetaRelease({
      today: "2026-08-24",
      tags: ["v2026.8.23-beta.0", "v2026.8.24"],
      headSha: "ccc",
      tagShas: { "v2026.8.23-beta.0": "aaa" },
    });
    assert.equal(result.version, "2026.8.25-beta.0");
  });

  it("walks forward while consecutive stables exist", () => {
    const result = resolveBetaRelease({
      today: "2026-08-24",
      tags: ["v2026.8.24", "v2026.8.25"],
      headSha: "ddd",
      tagShas: {},
    });
    assert.equal(result.version, "2026.8.26-beta.0");
  });
});

describe("resolveStableRelease", () => {
  it("mints a naked calendar version", () => {
    const result = resolveStableRelease({ today: "2026-08-24", tags: ["v2026.8.24-beta.0"] });
    assert.deepEqual(result, {
      ok: true,
      skip: false,
      channel: "stable",
      prerelease: false,
      version: "2026.8.24",
      tag: "v2026.8.24",
    });
  });

  it("rejects a second stable on the same UTC date", () => {
    const result = resolveStableRelease({ today: "2026-08-24", tags: ["v2026.8.24"] });
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /already exists/);
  });
});

describe("previousReleaseTag", () => {
  it("picks the newest tag across channels", () => {
    assert.equal(
      previousReleaseTag(["v2026.8.23-beta.0", "v2026.8.24-beta.1", "v2026.8.24"]),
      "v2026.8.24",
    );
  });
});

describe("formatReleaseNotes", () => {
  it("lists commits and records the build SHA", () => {
    assert.equal(
      formatReleaseNotes({
        commits: ["abc1234 Add About page", "def5678 Fix budget rollover"],
        sha: "abc1234",
        builtOn: "2026-08-24",
      }),
      `## What's Changed

- abc1234 Add About page
- def5678 Fix budget rollover

---
*Built from \`abc1234\` on 2026-08-24*
`,
    );
  });
});

describe("stampVersion", () => {
  it("writes the calendar version into Cargo, npm, and Tauri manifests", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "zai-stamp-"));
    await mkdir(path.join(cwd, "apps/frontend"), { recursive: true });
    await mkdir(path.join(cwd, "apps/tauri"), { recursive: true });
    await writeFile(
      path.join(cwd, "Cargo.toml"),
      `[workspace]\nmembers = []\n\n[workspace.package]\nversion = "0.0.0-dev"\nedition = "2024"\n`,
    );
    await writeFile(path.join(cwd, "package.json"), `{\n  "name": "zai",\n  "version": "0.0.0-dev"\n}\n`);
    await writeFile(
      path.join(cwd, "apps/frontend/package.json"),
      `{\n  "name": "frontend",\n  "version": "0.0.0-dev"\n}\n`,
    );
    await writeFile(
      path.join(cwd, "apps/tauri/tauri.conf.json"),
      `{\n  "productName": "Zai",\n  "version": "0.0.0-dev"\n}\n`,
    );

    stampVersion("2026.8.24-beta.0", cwd);

    assert.match(await readFile(path.join(cwd, "Cargo.toml"), "utf8"), /version = "2026\.8\.24-beta\.0"/);
    assert.equal(JSON.parse(await readFile(path.join(cwd, "package.json"), "utf8")).version, "2026.8.24-beta.0");
    assert.equal(
      JSON.parse(await readFile(path.join(cwd, "apps/frontend/package.json"), "utf8")).version,
      "2026.8.24-beta.0",
    );
    assert.equal(
      JSON.parse(await readFile(path.join(cwd, "apps/tauri/tauri.conf.json"), "utf8")).version,
      "2026.8.24-beta.0",
    );
  });
});
