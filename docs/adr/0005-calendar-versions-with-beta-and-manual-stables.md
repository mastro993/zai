---
status: superseded by ADR-0006
---

# Calendar versions with beta prerelease and manual stables

Zai identifies shipped builds with a UTC calendar version, not SemVer
meaning. Cargo, npm, and Tauri still require SemVer *syntax*, so the
product version is `YYYY.M.D` (no zero-padded month or day) with an
optional prerelease.

Beta ships are `YYYY.M.D-beta.N`. `N` starts at 0 for the first ship of
that UTC date; later ships the same UTC day increment `N`. The next `N`
comes from existing git tags for that date. A nightly job on `main` at
05:00 UTC publishes a beta when HEAD has moved since the last beta tag;
the same workflow can be dispatched for a retry or extra ship. A
scheduled run skips when HEAD is already the latest beta tag;
dispatching channel `beta` mints the next `N` even for that same commit.
Publish jobs build the commit SHA the version job captured, not a later
`main` tip. Stable ships are naked `YYYY.M.D`, cut only by manual
dispatch from `main` HEAD. There is at most one stable per UTC date. A
beta after that date's stable uses the next UTC date so SemVer still
treats it as newer (`YYYY.M.D` is greater than `YYYY.M.D-beta.N`).

The committed tree stays `0.0.0-dev`. About shows App version and Release
channel as two rows. Unstamped builds use `dev` and Dev. Stamped ships
use the technical version and Beta or Stable. CI stamps the calendar
version onto release artifacts only. Git tags are `v` plus that version.
Beta GitHub Releases are published prereleases; stables are published
and not prerelease. A stable may ship with no prior beta. Release notes
are `git log --oneline --no-merges` since the previous tag, any channel.
The first ship (no previous tag) caps that log at 100 commits. In-app
update checks stay out of this decision.

Four-part `YYYY.M.D.N` was rejected because it is not valid SemVer.
`-rc.N` and `-alpha.N` were rejected because the product channel is Beta
and the first same-day ship is `.0`.
