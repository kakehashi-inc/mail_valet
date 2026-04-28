# Mail Valet

## 1. System Overview

Mail Valet is a desktop application that manages multiple Gmail and IMAP email accounts in one place and helps you efficiently clean up unwanted emails.

### Key Features

- **Multi-Account Management**: Gmail (OAuth2) and IMAP (credential-based) account support
- **Email Sampling**: Fetch emails by day count or date range, grouped by sender (From), subject, or custom rules
- **Rule-Based Grouping**: Define regex-based rules to group emails by subject/body patterns (supports AND/OR conditions)
- **Ollama AI Classification**: Automatic marketing/spam scoring (0-10 scale) using a local AI
- **Bulk Deletion**: Move unwanted groups to trash in bulk (with options to exclude important/starred emails)
- **Period Deletion**: Delete only the sampled emails from selected groups
- **Detail View**: View email list, body, and raw data per group in a modeless window
- **Trash Viewer**: Browse and permanently delete emails in trash (select individual or empty all)
- **Label/Folder Management**: Gmail label / IMAP folder tree view with selectable fetch targets
- **Multilingual**: Japanese / English (auto-detected from OS language)
- **Themes**: Light / Dark mode (auto-detected from OS theme)
- **Data Management**: Settings export/import, AI judgment cache / all cache clear

### Tech Stack

| Category | Technology |
| --- | --- |
| Framework | Electron 38 |
| Frontend | React 19 + MUI v7 |
| Language | TypeScript 5 |
| State Management | Zustand 5 |
| i18n | i18next |
| Build | Vite 7 (Renderer) / tsc (Main) |
| IMAP | imapflow |
| External Services | GCP Gmail API, Ollama |
| Data Storage | `~/.mailvalet/` (file-based JSON + AES-256-GCM encryption) |

## 2. Supported Platforms

- Windows 10/11
- macOS 10.15+
- Linux (Debian-based / RHEL-based)

Note: This project does not code-sign on Windows. If SmartScreen displays a warning, click "More info" then "Run anyway".

## 3. Developer Reference

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

- Windows: `yarn dist:win`
- macOS: `yarn dist:mac`
- Linux: `yarn dist:linux`

In development, BrowserRouter loads `http://localhost:3001`; in production builds, HashRouter loads `dist/renderer/index.html`.

### Direct GitHub Release (for Auto-Update)

These commands upload build artifacts and `latest*.yml` (auto-update metadata) directly to the GitHub repository configured under `publish:` in `electron-builder.yml`. Because `releaseType: draft` is set, every command **aggregates into the same draft release for that version** on GitHub. Once all platforms are uploaded, click "Publish release" in the GitHub UI to deliver it to users.

- Windows: `yarn release:win`
- macOS: `yarn release:mac`
- Linux: `yarn release:linux`

Before running, set a GitHub Personal Access Token (with the `public_repo` scope) in the `GH_TOKEN` environment variable.

```bash
export GH_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
```

When building each platform on a separate machine, make sure the `version` field in `package.json` matches across all machines, then run the corresponding `release:*` command on each.

### macOS Prerequisite: Signing & Notarization Environment Variables

To build a signed and notarized macOS distribution, set the following environment variables before running `yarn dist:mac`:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

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
└── shared/                # Type definitions & constants (defaults / storage paths)
public/                    # Icons, etc.
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
