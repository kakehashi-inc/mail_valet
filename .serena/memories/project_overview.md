# Mail Valet Project Overview

## Purpose
Desktop email management app for Gmail and IMAP accounts with bulk cleanup features.

## Tech Stack
- Electron 38, React 19, MUI v7, TypeScript 5, Zustand 5, Vite 7
- i18next for i18n, imapflow for IMAP
- Data: ~/.mailvalet/ (JSON + AES-256-GCM encryption)

## Project Structure
```
src/
├── main/           # Electron main process
│   ├── ipc/        # IPC handlers
│   ├── services/   # Gmail/IMAP/account services
│   └── utils/      # Utilities
├── preload/        # Bridge APIs
├── renderer/       # React UI
│   ├── components/ # UI components
│   └── stores/     # Zustand stores
├── shared/         # Types & constants
└── public/         # Icons
```

## Key Commands
- `yarn dev` - Development mode
- `yarn lint` - Run linter (required after changes)
- `yarn dist` - Build for all platforms

## Development Rules
- Run linter after every change
- Update Documents/テーブル定義.md for data model changes
- Update Documents/システム仕様.md for behavior changes
- Docs go in Documents/ directory
