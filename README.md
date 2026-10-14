# SQL Sandbox

A responsive, browser-based learning system for anyone who wants to learn SQL. No installation, no server — everything runs in your browser using WebAssembly.

![SQL Sandbox screenshot](https://raw.githubusercontent.com/dwilson-coder/sqlsandbox/refs/heads/main/og.jpg)

## Features

- 🗄️ **Database Management**: Create, select, and delete databases (real SQLite via WebAssembly).
- 📋 **Table Management**: Create tables with constraints (PK, FK, Unique, Not Null), inspect columns, and drop tables.
- 📊 **Interactive SQL Schema & ER Diagram**:
  - Live Mermaid ER diagram generation with automatic relationship mapping.
  - Visual connecting lines from the database root to all tables, plus table-to-table foreign keys.
  - Supabase-style interactive Table Cards view with PK, FK, and UK badges.
  - Exportable, copy-ready Mermaid syntax for Mermaid Live Editor, GitHub Markdown, Obsidian, and Notion.
  - Resizable and maximizable modal window with dynamic auto-scaling and accent-colored scrollbars.
  - Interactive pan & zoom navigation: click and drag anywhere inside the window to move the schema, mouse wheel to zoom in and out centered on cursor, and toolbar zoom buttons (`+`, `−`, `Fit`).
  - Active table relationship highlighting: displays distinctive amber lines and markers for all relationships connected to the active table (switchable via toolbar dropdown, clicking visual diagram nodes, or selecting table cards).
- 💻 **VS Code–Style Interface**: Collapsible sidebar, CodeMirror 6 SQL editor with syntax highlighting, and an output terminal panel.
- ✨ **One-Click SQL Formatting**: Beautify and standardize SQL queries (Ctrl+K).
- 🔍 **Command Search & Palette**: Quick command search (Ctrl+Shift+P) with syntax examples, copy shortcuts, and one-click editor insertion.
- 💾 **Client-Side Persistence**: Saves databases and state directly in your browser using localStorage / IndexedDB.
- 🌙 **Theme Support**: Seamless Dark and Light modes.

## Getting Started

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run unit test suite
npm test

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Tech Stack

- **Vite** — Fast frontend build tool
- **sql.js** — SQLite compiled to WebAssembly (WASM)
- **CodeMirror 6** — Modern, extensible in-browser code editor
- **Mermaid.js** — Diagramming and visual ER relationship rendering
- **sql-formatter** — SQL prettifier and dialect formatting
- **Tailwind CSS** — Modern styling and layout utilities

## Social & Links

- 🌐 [Website](https://codeboxllc.net/)
- 💼 [LinkedIn](https://www.linkedin.com/in/damion-coder-wilson)
- 🦋 [Bluesky](https://bsky.app/profile/dwilsoncoder.bsky.social)
- 🐙 [GitHub](https://github.com/dwilson-coder/sqlsandbox.git)

Built with ❤️ by Damion Wilson for [CodeBox LLC](https://codeboxllc.net/).
