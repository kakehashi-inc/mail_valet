# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Upgraded `@mui/material` and `@mui/icons-material` from v7 to v9. Adjusted breaking changes (`PaperProps` -> `slotProps.paper`, `disableEscapeKeyDown` -> `onClose` reason filter, `DeleteOutline` -> `DeleteOutlined` icon).
- Set `moduleResolution` to `bundler` in the root TypeScript config and pinned `node` resolution in the main-process TypeScript config so MUI v9's `.d.mts` types resolve correctly while CommonJS output keeps working.
- `electron-builder.yml`: switched `publish.releaseType` to `draft` and normalized `publish.repo` to a repository name.

### Added

- Auto-update support via `electron-updater` (no-op in development): startup check after the main window finishes loading, opt-in download, automatic install on download completion, and an i18n-aware Snackbar UI with progress feedback in the renderer.
