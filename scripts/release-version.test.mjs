import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  calendarCoreFromIsoDate,
  createUpdaterManifests,
  packageVersionFromReleaseVersion,
  parseReleaseTag,
  previousReleaseTag,
  releaseVersionFromPackageVersion,
  renameArtifactVersions,
  resolveRelease,
  stampVersion,
  validateReleaseAssets,
} from "./release-version.mjs";

describe("release version allocation", () => {
  it("increments the committed daily build and keeps channel-local notes", () => {
    assert.equal(calendarCoreFromIsoDate("2026-08-25"), "2026.8.25");
    assert.deepEqual(
      resolveRelease({
        channel: "stable",
        today: "2026-08-25",
        tags: ["nightly-2026.8.25.9", "2026.8.25.4"],
        committedVersion: "2026.8.25.9",
      }),
      {
        ok: true,
        channel: "stable",
        prerelease: false,
        previousTag: "2026.8.25.4",
        version: "2026.8.25.10",
        packageVersion: "2026.8.25010",
        tag: "2026.8.25.10",
      },
    );
  });

  it("starts at build 0 and resets the committed sequence on a new UTC day", () => {
    const first = resolveRelease({ channel: "nightly", today: "2026-08-25", tags: [] });
    assert.equal(first.version, "2026.8.25.0");
    assert.equal(first.tag, "nightly-2026.8.25.0");

    const nextDay = resolveRelease({
      channel: "nightly",
      today: "2026-08-26",
      tags: ["nightly-2026.8.25.7"],
      committedVersion: "2026.8.25.7",
    });
    assert.equal(nextDay.version, "2026.8.26.0");
  });

  it("keeps generated-note baselines within each channel", () => {
    const tags = ["nightly-2026.8.24.3", "2026.8.24.4", "nightly-2026.8.25.0", "2026.8.25.1"];
    assert.equal(previousReleaseTag(tags, "nightly"), "nightly-2026.8.25.0");
    assert.equal(previousReleaseTag(tags, "stable"), "2026.8.25.1");
  });

  it("ignores invalid dates, padded parts, and unrelated tags", () => {
    assert.equal(parseReleaseTag("nightly-2026.2.29.0"), null);
    assert.equal(parseReleaseTag("2026.08.25.0"), null);
    assert.equal(parseReleaseTag("2026.8.25.00"), null);
    assert.equal(parseReleaseTag("release-2026.8.25.0"), null);
    assert.equal(parseReleaseTag("nightly-v2026.8.25.0"), null);
    assert.equal(parseReleaseTag("v2026.8.25.0"), null);
  });

  it("packs the day and build into SemVer patch and enforces the daily ceiling", () => {
    assert.equal(packageVersionFromReleaseVersion("2026.8.25.1"), "2026.8.25001");
    assert.equal(releaseVersionFromPackageVersion("2026.8.25001"), "2026.8.25.1");
    assert.equal(releaseVersionFromPackageVersion("0.0.0-dev"), null);
    assert.equal(packageVersionFromReleaseVersion("2026.8.25.999"), "2026.8.25999");
    assert.equal(packageVersionFromReleaseVersion("2026.8.26.0"), "2026.8.26000");
    assert.throws(
      () => packageVersionFromReleaseVersion("2026.8.25.1000"),
      /build 1000 exceeds the supported daily maximum of 999/,
    );
    assert.equal(
      resolveRelease({
        channel: "stable",
        today: "2026-08-25",
        tags: [],
        committedVersion: "2026.8.25.9",
      }).version,
      "2026.8.25.10",
    );
    assert.throws(
      () =>
        resolveRelease({
          channel: "stable",
          today: "2026-08-25",
          tags: [],
          committedVersion: "2026.8.25.999",
        }),
      /build sequence for 2026\.8\.25 exceeds the supported daily maximum of 999/,
    );
  });
});

describe("stampVersion", () => {
  it("writes a version into Cargo, npm, and Tauri manifests", async () => {
    const cwd = await mkdtemp(path.join(process.cwd(), ".release-version-test-"));
    try {
      await mkdir(path.join(cwd, "apps/frontend"), { recursive: true });
      await mkdir(path.join(cwd, "apps/tauri"), { recursive: true });
      await writeFile(
        path.join(cwd, "Cargo.toml"),
        `[workspace]\nmembers = []\n\n[workspace.package]\nversion = "0.0.0-dev"\nedition = "2024"\n`,
      );
      await writeFile(
        path.join(cwd, "package.json"),
        `{\n  "name": "zai",\n  "version": "0.0.0-dev"\n}\n`,
      );
      await writeFile(
        path.join(cwd, "apps/frontend/package.json"),
        `{\n  "name": "frontend",\n  "version": "0.0.0-dev"\n}\n`,
      );
      await writeFile(
        path.join(cwd, "apps/tauri/tauri.conf.json"),
        `{\n  "productName": "Zai",\n  "version": "0.0.0-dev"\n}\n`,
      );

      assert.throws(() => stampVersion("2026.8.25010-rc.1", cwd), /without a prerelease suffix/);
      stampVersion("2026.8.25010", cwd);

      assert.match(
        await readFile(path.join(cwd, "Cargo.toml"), "utf8"),
        /version = "2026\.8\.25010"/,
      );
      for (const relativePath of ["package.json", "apps/frontend/package.json"]) {
        assert.equal(
          JSON.parse(await readFile(path.join(cwd, relativePath), "utf8")).version,
          "2026.8.25010",
        );
      }
      const tauriConfig = JSON.parse(
        await readFile(path.join(cwd, "apps/tauri/tauri.conf.json"), "utf8"),
      );
      assert.equal(tauriConfig.version, "2026.8.25010");

      await mkdir(path.join(cwd, "target/release/bundle"), { recursive: true });
      await writeFile(path.join(cwd, "target/release/bundle/Zai_2026.8.25010_x64.dmg"), "");
      await writeFile(path.join(cwd, "target/release/bundle/Zai_2026.8.25010_x64.dmg.sig"), "");
      await writeFile(path.join(cwd, "target/release/bundle/Zai.app.tar.gz"), "archive");
      await writeFile(path.join(cwd, "target/release/bundle/Zai.app.tar.gz.sig"), "signature");

      assert.equal(
        renameArtifactVersions("2026.8.25.10", "2026.8.25010", path.join(cwd, "target"), "aarch64"),
        4,
      );
      assert.equal(
        await readFile(path.join(cwd, "target/release/bundle/Zai_2026.8.25.10_x64.dmg"), "utf8"),
        "",
      );
      assert.equal(
        await readFile(
          path.join(cwd, "target/release/bundle/Zai_2026.8.25.10_aarch64.app.tar.gz"),
          "utf8",
        ),
        "archive",
      );
      assert.equal(
        await readFile(
          path.join(cwd, "target/release/bundle/Zai_2026.8.25.10_aarch64.app.tar.gz.sig"),
          "utf8",
        ),
        "signature",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("does not rename a macOS updater archive without its signature", async () => {
    const cwd = await mkdtemp(path.join(process.cwd(), ".release-version-test-"));
    try {
      const bundle = path.join(cwd, "target/release/bundle");
      await mkdir(bundle, { recursive: true });
      await writeFile(path.join(bundle, "Zai_2026.8.25010_x64.dmg"), "");
      await writeFile(path.join(bundle, "Zai.app.tar.gz"), "archive");

      assert.throws(
        () =>
          renameArtifactVersions(
            "2026.8.25.10",
            "2026.8.25010",
            path.join(cwd, "target"),
            "x86_64",
          ),
        /Missing macOS updater signature/,
      );
      assert.equal(await readFile(path.join(bundle, "Zai.app.tar.gz"), "utf8"), "archive");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe("release assets", () => {
  it("requires the complete platform installer set", async () => {
    const cwd = await mkdtemp(path.join(process.cwd(), ".release-assets-test-"));
    try {
      const names = [
        "Zai_2026.8.25.10_aarch64.dmg",
        "Zai_2026.8.25.10_x64.dmg",
        "Zai_2026.8.25.10_amd64.deb",
        "Zai-2026.8.25.10-1.x86_64.rpm",
        "Zai_2026.8.25.10_amd64.AppImage",
        "Zai_2026.8.25.10_x64-setup.exe",
      ];
      for (const name of names) await writeFile(path.join(cwd, name), "artifact");
      assert.equal(validateReleaseAssets("2026.8.25.10", cwd), true);
      await rm(path.join(cwd, names[0]));
      assert.throws(() => validateReleaseAssets("2026.8.25.10", cwd), /exactly 2 macOS DMGs/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe("updater manifests", () => {
  it("writes one signed manifest per channel and platform target", async () => {
    const cwd = await mkdtemp(path.join(process.cwd(), ".updater-manifest-test-"));
    try {
      const assetsDirectory = path.join(cwd, "release-assets");
      const outputDirectory = path.join(cwd, "updater-manifests");
      const fixtures = [
        ["macos-aarch64", "Zai_2026.8.25.10_aarch64.app.tar.gz"],
        ["macos-x86_64", "Zai_2026.8.25.10_x86_64.app.tar.gz"],
        ["linux-x86_64", "Zai_2026.8.25.10_amd64.AppImage"],
        ["windows-x86_64", "Zai_2026.8.25.10_x64-setup.exe"],
      ];

      for (const [target, filename] of fixtures) {
        const directory = path.join(assetsDirectory, `release-${target}`);
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, filename), "artifact");
        await writeFile(path.join(directory, `${filename}.sig`), `signature-${target}\n`);
      }

      const manifests = createUpdaterManifests({
        channel: "nightly",
        releaseVersion: "2026.8.25.10",
        packageVersion: "2026.8.25010",
        releaseTag: "nightly-2026.8.25.10",
        repository: "mastro993/zai",
        assetsDirectory,
        outputDirectory,
        publishedAt: "2026-08-25T05:00:00Z",
      });

      assert.equal(manifests.length, 4);
      const linuxManifest = JSON.parse(
        await readFile(path.join(outputDirectory, "nightly-linux-x86_64.json"), "utf8"),
      );
      assert.deepEqual(linuxManifest, {
        version: "2026.8.25010",
        notes: "Nightly release 2026.8.25.10",
        pub_date: "2026-08-25T05:00:00Z",
        platforms: {
          "nightly-linux-x86_64": {
            signature: "signature-linux-x86_64",
            url: "https://github.com/mastro993/zai/releases/download/nightly-2026.8.25.10/Zai_2026.8.25.10_amd64.AppImage",
          },
        },
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
