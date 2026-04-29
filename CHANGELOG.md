# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Upgraded `@mui/material` and `@mui/icons-material` from v7 to v9. Adjusted breaking changes (`PaperProps` -> `slotProps.paper`, `disableEscapeKeyDown` -> `onClose` reason filter, `DeleteOutline` -> `DeleteOutlined` icon).
- Set `moduleResolution` to `bundler` in the root TypeScript config and pinned `node` resolution in the main-process TypeScript config so MUI v9's `.d.mts` types resolve correctly while CommonJS output keeps working.
- `electron-builder.yml`: switched `publish.releaseType` to `draft` and normalized `publish.repo` to a repository name.
- Auto-updater is now a no-op when running the portable build (detected via `PORTABLE_EXECUTABLE_FILE`), so portable users no longer have the NSIS installer downloaded and launched on their behalf. NSIS-based installations behave as before.

### Added

- Auto-update support via `electron-updater` (no-op in development): startup check after the main window finishes loading, opt-in download, automatic install on download completion, and an i18n-aware Snackbar UI with progress feedback in the renderer.
- `afterAllArtifactBuild` hook (`scripts/zip-portable.js`) that wraps the Windows portable `.exe` in a `.zip` and removes the original `.exe`. The `.zip` is added to the publish payload. NSIS artifacts (`.exe`, `.exe.blockmap`, `latest.yml`) and non-Windows builds are untouched.
