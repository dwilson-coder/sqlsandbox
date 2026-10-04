# SQL Sandbox

A responsive, browser-based learning system for anyone who wants to learn SQL. No installation, no server — everything runs in your browser using WebAssembly.

## Features

- 🗄️ Create, select, and delete databases (SQLite via WebAssembly)
- 📋 Create, select, and delete tables
- 💻 VS Code–style UI: sidebar, editor, terminal
- ✨ One-click SQL formatting
- 🔍 Command palette to search SQL commands
- 💾 Persists to localStorage / IndexedDB
- 🌙 Dark & Light themes

## Getting Started

```bash
npm install
npm run dev   
npm run build
npm run preview   
```

## Tech Stack
- Vite — build tool
- sql.js — SQLite in WebAssembly
- CodeMirror 6 — SQL editor
- sql-formatter — SQL prettifier
- Tailwind CSS — utility-first styling

## Social
- Website
- LinkedIn
- Bluesky
- GitHub
Built by Damion Wilson for CodeBox LLC
```json

### `package.json` (scripts section)

```json
{
  "name": "sqlsandbox",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}   
```

### Claude / Copilot Prompt
Copy-paste this into Claude or GitHub Copilot Chat to build out the full project:
```bash
You are building "SQL Sandbox" — a responsive, browser-based SQL learning app.
Stack: Vanilla JS, Vite, sql.js (SQLite WASM), CodeMirror 6, Tailwind CSS v4, sql-formatter.
No framework. No backend. All data persists in localStorage (IndexedDB for >5MB DBs).

## Architecture
- src/main.js — entry, mounts app
- src/app.js — layout shell (header, sidebar, editor, terminal, footer)
- src/state/store.js — central state object with init/save/toggleTheme
- src/state/persistence.js — localStorage + IndexedDB abstraction
- src/db/engine.js — sql.js init, create/select/delete database
- src/db/tables.js — table CRUD within a loaded database
- src/db/sample-datasets.js — 3 preloaded demo DBs (employees, orders, chess)
- src/ui/layout/Sidebar.js — tree view: databases > tables > columns
- src/ui/layout/Editor.js — CodeMirror 6 with SQL highlighting, Ctrl+Enter to run
- src/ui/layout/Terminal.js — output panel showing query results as a table
- src/ui/layout/StatusBar.js — shows current DB name, row count, connection state
- src/ui/components/CommandPalette.js — fuzzy-search over SQL_COMMANDS array
- src/ui/components/FormatButton.js — formats current editor content
- src/ui/components/ThemeToggle.js — dark/light, persisted
- src/commands/sql-commands.js — curated list of ~40 SQL commands with descriptions
- src/utils/sql-format.js — wraps sql-formatter
- src/styles/main.css — Tailwind + CSS custom properties for VS Code theme

## Core Features to Implement
1. **Database management**: Create (name prompt), select (click in sidebar), delete (confirm dialog). Serialize to base64 in localStorage.
2. **Table management**: Within a selected DB, create table (name + columns with types), select (show columns in sidebar), delete (confirm).
3. **SQL Editor**: CodeMirror 6 with @codemirror/lang-sql. Ctrl+Enter executes. Show results in terminal as an HTML table. Show errors inline.
4. **Terminal**: Bottom panel. Shows query output (table for SELECT, row count for INSERT/UPDATE/DELETE, error messages). Scrollable history.
5. **Prettify SQL**: Button in header + Ctrl+K. Uses sql-formatter with sqlite dialect.
6. **Command Search**: Ctrl+Shift+P opens a fuzzy-search overlay (simple: filter SQL_COMMANDS by substring). Shows cmd, description, category. Click to insert into editor.
7. **Theme**: Dark (default) and light. CSS custom properties. Toggle button in header. Persist in localStorage.
8. **Responsive**: On screens < 768px, sidebar hides (toggle via hamburger). Terminal and editor stack.

## UI Layout (VS Code–style)
┌─────────────────────────────────────────────┐
│ Header: [Logo] [Format] [Commands] [Theme]  │
├──────────┬──────────────────────────────────┤
│ Sidebar  │  Editor (CodeMirror)             │
│ (DB tree)│                                  │
│          ├──────────────────────────────────┤
│          │  Terminal (results / output)     │
├──────────┴──────────────────────────────────┤
│ Footer: © CodeBox LLC | Social Links        │
└─────────────────────────────────────────────┘

## Additional Features
- Query history (last 50, per database, shown in terminal on up-arrow)
- Sample datasets: "Load Sample" button in sidebar loads a pre-built DB
- ER Diagram: simple SVG rendering of tables + FK relationships (click a table to see)
- Export: download current DB as .sql dump or .db binary
- Keyboard shortcuts: Ctrl+Enter (run), Ctrl+K (format), Ctrl+Shift+P (palette)
- Toast notifications for errors/success

## SEO & Meta
- index.html must include Open Graph tags (og:title, og:description, og:type, og:url, og:image)
- og:image points to /og.jpg (1200×630)
- twitter:card = summary_large_image
- Footer: "© 2026 CodeBox LLC — Built by Damion Wilson" with links to:
  - https://codeboxllc.net/ (Website)
  - https://www.linkedin.com/in/damion-coder-wilson (LinkedIn)
  - https://bsky.app/profile/dwilsoncoder.bsky.social (Bluesky)
  - https://github.com/dwilson-coder/sqlsandbox.git (GitHub)
  All footer links: target="_blank" rel="noopener noreferrer"

## Constraints
- No React, no Vue, no Svelte. Pure vanilla JS with ES modules.
- No backend. No API calls. Everything client-side.
- Use sql.js for actual SQL execution (real SQLite, not a mock).
- Keep bundle size < 500 KB gzipped (sql.js WASM is ~1.2 MB, acceptable).
- Accessible: ARIA labels on buttons, keyboard navigable, focus management.

Build the complete project file by file. Start with package.json, vite.config.js, index.html, then all src/ files.   
```


### Quick-start after scaffolding
```bash
mkdir sqlsandbox && cd sqlsandbox
npm init -y
npm install sql.js @codemirror/state @codemirror/view @codemirror/language @codemirror/commands @codemirror/lang-sql @codemirror/autocomplete @codemirror/search @codemirror/theme sql-formatter
npm install -D vite @tailwindcss/vite tailwindcss
# Then add the files from the tree above
npm run dev   
```