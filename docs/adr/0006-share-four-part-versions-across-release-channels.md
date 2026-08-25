---
status: accepted
---

# Share four-part UTC versions across release channels

Zai assigns every Nightly and Stable ship one Release Version in the form
`Y.M.D.B`, where the date is UTC and `B` is the next build number shared by
both channels that day. The sequence starts at zero and advances from the
maximum matching tag. Gaps are harmless, but deleting the maximum tag can make
its number available for reuse, so release tags must not be deleted when their
versions must remain reserved.

Channel identity lives in the tag and GitHub Release, not in the Release
Version: Nightlies use `nightly-vY.M.D.B` and Stables use `vY.M.D.B`.

This supersedes ADR-0005. A shared sequence makes every shipped build globally
identifiable without making channel promotion part of the version, and it
allows multiple Stable releases on one UTC day. The trade-off is that Cargo,
npm, and Tauri require SemVer syntax and cannot parse four numeric components,
so release builds pack the day and build into the SemVer patch component:
`Y.M.P`, where `P = D × 1000 + B` (for example, Release Version
`2026.8.25.1` uses internal version `2026.8.25001`). The encoding preserves
ordering without a prerelease suffix and limits `B` to 999. Tags, GitHub
Release names, release-note paths, documentation, and artifact filenames keep
the canonical unpadded `Y.M.D.B` Release Version.
