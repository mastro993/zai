# Calendar versions with beta prerelease and manual stables

Zai identifies shipped builds with a UTC calendar version, not SemVer
meaning. Cargo, npm, and Tauri still require SemVer *syntax*, so the
product version is `YYYY.M.D` (no zero-padded month or day) with an
optional prerelease.

Beta ships are `YYYY.M.D-beta.N`. `N` starts at 0 for the first ship of
that UTC date; later ships the same UTC day increment `N`. The next `N`
comes from existing git tags for that date. A nightly job on `main` at
05:00 UTC publishes a beta when HEAD has moved since the last beta tag;
the same workflow can be dispatched for a retry. Stable ships are naked
`YYYY.M.D`, cut only by manual dispatch from `main` HEAD. There is at
most one stable per UTC date. A beta after that date's stable uses the
next UTC date so SemVer still treats it as newer (`YYYY.M.D` is greater
than `YYYY.M.D-beta.N`).

The committed tree stays `0.0.0-dev` and About shows `dev` for unstamped
builds. CI stamps the calendar version onto release artifacts only.
Display equals the technical version. About channel is Beta on beta
ships and Stable on stable ships. Git tags are `v` plus that version.
Beta GitHub Releases are published prereleases; stables are published
and not prerelease. A stable may ship with no prior beta. Release notes
are `git log` since the previous tag, any channel. In-app update checks
stay out of this decision.

Four-part `YYYY.M.D.N` was rejected because it is not valid SemVer.
`-rc.N` was rejected because the product channel is Beta. Tolaria's
`-alpha.N` starting at 1 was rejected: Zai is not Alpha and the first
same-day ship is `.0`.
