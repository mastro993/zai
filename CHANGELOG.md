# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Shipped versions follow the calendar scheme in
[ADR-0007](docs/adr/0007-commit-release-versions-before-building.md).
Release Versions are UTC year, month, day, and shared daily build number.
Release commits retain the packed internal SemVer; public identifiers use the
four-part Release Version.

## [Unreleased]

### Added

### Changed

- Nightly and Stable releases share UTC `Y.M.D.B` Release Versions, commit
  version bumps before building, and publish updater manifests on GitHub Pages.

### Fixed

### Security
