# Mail Valet

## 1. System Overview

Mail Valet is a desktop application that manages multiple Gmail accounts in one place and helps you efficiently clean up unwanted emails.

### Key Features

- **Multi-Gmail Account Management**: Secure multi-account support via OAuth2 authentication
- **Email Sampling**: Fetch emails by day count or date range, grouped by sender (From)
- **Ollama AI Classification**: Automatic marketing/spam scoring (0-10 scale) using a local AI
- **Bulk Deletion**: Move unwanted sender groups to trash in bulk (with options to exclude important/starred emails)
- **Detail View**: View email list, body, and raw data per sender group in a modeless window
- **Label Management**: Gmail label tree view with selectable fetch targets
- **Multilingual**: Japanese / English (auto-detected from OS language)
- **Themes**: Light / Dark mode (auto-detected from OS theme)
- **Data Management**: Settings export/import, cache clear, full data reset

### Tech Stack

| Category | Technology |
| --- | --- |
| Framework | Electron 38 |
| Frontend | React 19 + MUI v7 |
| Language | TypeScript 5 |
| State Management | Zustand 5 |
| i18n | i18next |
| Build | Vite 7 (Renderer) / tsc (Main) |
| External Services | GCP Gmail API, Ollama |
| Data Storage | `~/.mailvalet/` (file-based JSON + AES-256-GCM encryption) |

## 2. Supported Platforms

- Windows 10/11
- macOS 10.15+
- Linux (Debian-based / RHEL-based)

Note: This project does not code-sign on Windows. If SmartScreen displays a warning, click "More info" then "Run anyway".

## 3. Developer Reference

### Development Rules

- All developer-facing documents, except `README.md`, must be placed in the `Documents` directory.
- After every change, run the linter and fix all issues. If a linter error is intentionally suppressed, add a comment explaining the reason. **A full build is only required for releases; running the linter alone is sufficient during development.**
- Temporary or investigative scripts (e.g., research/debug scripts) must be placed in the `scripts` directory.
- When implementing data models, create one file per table.
- When creating or modifying a data model, update `Documents/テーブル定義.md`. Table definitions must be expressed as one table per database table, with column names, types, and relations documented within the table.
- When system behavior changes, update `Documents/システム仕様.md`.

### Prerequisites

- Node.js 22.x or later
- yarn 4
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd <repository-name>

# Install dependencies
yarn install

# Start in development mode
yarn dev
```

DevTools during development:

- DevTools opens automatically in detached mode
- Toggle with F12 or Ctrl+Shift+I (Cmd+Option+I on macOS)

### Build / Distribution

- All platforms: `yarn dist`
- Windows: `yarn dist:win`
- macOS: `yarn dist:mac`
- Linux: `yarn dist:linux`

In development, BrowserRouter loads `http://localhost:3001`; in production builds, HashRouter loads `dist/renderer/index.html`.

### Windows Prerequisite: Developer Mode

To run and test unsigned local builds on Windows, enable Developer Mode:

1. Settings > Privacy & Security > For Developers
2. Turn on "Developer Mode"
3. Restart the OS

### Project Structure (excerpt)

```text
src/
├── main/                  # Electron main: IPC / managers
│   ├── index.ts           # Startup, window creation, service initialization
│   ├── ipc/               # IPC handlers
│   ├── services/          # Services
│   └── utils/             # Utilities
├── preload/               # Safely bridges APIs to the renderer
├── renderer/              # React + MUI UI
├── shared/                # Type definitions & constants (defaults / storage paths)
└── public/                # Icons, etc.
```

### Technologies Used

- **Electron**
- **React (MUI v7)**
- **TypeScript**
- **Zustand**
- **i18next**
- **Vite**

### Creating Windows Icons

```bash
magick public/icon.png -define icon:auto-resize=256,128,96,64,48,32,24,16 public/icon.ico
```
