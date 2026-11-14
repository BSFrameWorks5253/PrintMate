# ⚡ live-edit

> **Visual, in-browser live editing for your local web applications — wired directly to your source code and your AI coding agent.**

[![Node.js](https://img.shields.io/badge/Node.js-18+-68a063?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](scripts/live.mjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Skill: Antigravity / Agent Ready](https://img.shields.io/badge/AI%20Skill-Ready-purple?style=flat-square)](SKILL.md)

---

## 💡 What is live-edit?

**live-edit** bridges the gap between seeing your website in the browser and editing your code. It wraps your existing dev server with a lightweight local proxy, injecting a clean Shadow-DOM overlay.

- **Edit visually:** Double-click any text to change it inline. Reorder, duplicate, or delete cards and components with instant visual feedback.
- **Direct-to-source writes:** Direct text changes are automatically located and written straight into your `.tsx`, `.jsx`, `.vue`, `.svelte`, `.astro`, `.html`, or `.json` files.
- **Smart Disambiguation:** If the same text appears multiple times (e.g. repeated pricing cards or team member bios), `live-edit` analyzes sibling element context to edit the exact right line.
- **AI Agent Collaboration:** Structural transformations (adding/removing items from mapped arrays, state toggles) are placed into a pending queue. Your AI coding agent (Antigravity, Cursor, Claude Code) picks them up, writes idiomatic code, and marks them complete.

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│                 │ 4321  │      live-edit       │       │   Your Dev App  │
│  Browser Window │◄─────►│    Reverse Proxy     │◄─────►│   (Vite, Next,  │
│ (Shadow Overlay)│       │  (Node.js / Zero-dep)│       │  Astro, Nuxt)   │
└────────┬────────┘       └──────────┬───────────┘       └─────────────────┘
         │                           │
         │ Direct Text Edit          │ Structural Queue
         ▼                           ▼
┌──────────────────┐      ┌──────────────────────┐
│ Local Source File│      │  .live/pending.json  │
│  (Written Live)  │      └──────────┬───────────┘
└──────────────────┘                 │
                                     ▼
                          ┌──────────────────────┐
                          │    AI Coding Agent   │
                          │(live.mjs wait & done)│
                          └──────────────────────┘
```

---

## ✨ Features

- 🚀 **Zero Dependencies & Fast:** Written in pure Node.js standard libraries (`http`, `net`, `fs`, `crypto`). No heavy npm install steps.
- 🎯 **Non-Invasive Shadow DOM:** The entire editing interface renders in an isolated Shadow DOM container (`#__live-host`), ensuring zero CSS style bleed into your app.
- 🔄 **HMR & WebSocket Passthrough:** Transparent WebSocket upgrade proxying keeps Vite, Next.js, and Webpack Hot Module Replacement alive without interruptions.
- 🧠 **Context-Aware Code Matcher:** Searches through project source files matching visible rendered text against raw source patterns (handling HTML entities, single/double quotes, template string line breaks).
- 🛠️ **Visual Toolbar:**
  - `Edit text`: Inline contentEditable editing (Enter commits, Esc cancels).
  - `Parent ↑` / `Child ↓`: Effortless DOM tree traversal to select container cards or child elements.
  - `Duplicate`: Duplicates visual cards immediately and queues array/component duplication for the agent.
  - `Delete`: Removes elements visually and queues removal for code cleanup.
  - `Enable / Disable`: Toggles button disabled states.
- 🛡️ **Local & Secure:** Binds exclusively to `127.0.0.1` and authenticates save requests with a cryptographically secure per-session token (`x-live-token`).

---

## 📦 Quick Start

### 1. Initialize in your project

From the root of any frontend project (Vite, Next.js, Nuxt, SvelteKit, Astro, etc.):

```bash
node <path-to-live-edit>/scripts/live.mjs init
```

This will:
- Copy the skill files to `.agent/skills/live-edit/`
- Add `"live": "node .agent/skills/live-edit/scripts/live.mjs start"` to your `package.json`
- Add `.live/` to `.gitignore`

> **Global installation for Antigravity AI:**  
> Copy this folder to `~/.gemini/antigravity/skills/live-edit/` to enable `/live-edit` across all projects.

---

### 2. Start Live Editing

1. Start your project's dev server as normal:
   ```bash
   npm run dev
   ```
2. Start the `live-edit` proxy:
   ```bash
   npm run live
   ```
   *(Auto-detects common dev server ports: 5173, 3000, 4321, 5174, 8080, 3001, 4200, 8000, 5500, 1313).*
3. Open **`http://localhost:4321`** in your browser.

---

## 🖱️ Using the Visual Overlay

| Interaction | Action | Description |
|---|---|---|
| **Hover** | Highlight | Shows element boundaries and tag name. |
| **Click** | Select | Selects the element and brings up the floating action toolbar. |
| **Double-Click** | Inline Edit | Turns text directly into an editable field. Press `Enter` to commit, `Esc` to cancel. |
| **Parent ↑** | Traverse Up | Jumps selection to the parent card, container, or section. |
| **Child ↓** | Traverse Down | Jumps selection into the first child node. |
| **Duplicate** | Clone Item | Clones the element visually in real-time and queues structural code creation. |
| **Delete** | Remove Item | Removes element visually in real-time and queues deletion in code. |
| **Enable / Disable** | Button State | Toggles button disabled attributes and states. |
| **Undo** | Revert | Rolls back the last visual change. |
| **Save to code** | `Ctrl + S` / `Cmd + S` | Commits changes: writes direct text to source files and flushes structural changes to queue. |

---

## 🤖 The AI Agent Workflow

When you trigger **Save to code**, `live-edit` splits operations:

1. **Direct text replacements** with unique locations are written directly to your code files (`✓ file:line`).
2. **Structural changes** (duplications, deletions, ambiguous text matches) are staged into `.live/pending.json`.

### How your AI Agent resolves pending tasks

Your coding agent runs:

```bash
node scripts/live.mjs wait
```

This blocks until you click **Save to code** and outputs the pending actions:

```text
[a8f2c1] DUPLICATE  page: /
  element: <div class="pricing-card"> "Pro Plan - $29/mo"
  selector: div.pricing-grid > div.pricing-card:nth-of-type(2)
  sibling texts: ["Starter Plan", "$9/mo", "Pro Plan", "$29/mo"]
```

The agent then:
- Identifies if the card is driven by a data array (`plans.map(...)`) or static JSX/HTML.
- Inserts the new entry cleanly following project conventions and unique keys.
- Acknowledges and clears the item:
  ```bash
  node scripts/live.mjs done a8f2c1
  ```

---

## 💻 CLI Commands

The CLI runner `live.mjs` supports the following commands:

```bash
node scripts/live.mjs <command> [options]
```

| Command | Options | Description |
|---|---|---|
| `init` | — | Sets up `.agent/skills/live-edit`, adds `npm run live` and `.gitignore`. |
| `start` | `--target <url>`<br>`--port <number>` | Starts the proxy server (defaults to port `4321`, targets detected dev server). |
| `wait` | `--timeout <seconds>` | Blocks until structural changes are queued by the browser, then prints them. |
| `pending` | — | Prints all currently queued changes without blocking. |
| `done` | `[id ...]` | Clears resolved items by ID, or clears all items if no ID is passed. |

### Example CLI usage:

```bash
# Start on custom port proxying custom backend
node scripts/live.mjs start --port 8888 --target http://localhost:3000

# Inspect currently pending edits
node scripts/live.mjs pending

# Clear all items from queue
node scripts/live.mjs done
```

---

## 🔍 How File Matching & Disambiguation Works

When modifying text, `live-edit`:
1. Walks through your project directory, skipping build artifacts (`node_modules`, `dist`, `.next`, etc.).
2. Normalizes visible characters (smart quotes `’` / `‘`, quotation marks `"` / `“`, and HTML entities like `&amp;`, `&apos;`, `&nbsp;`).
3. If a match occurs in multiple places, `live-edit` scores candidates based on their proximity to sibling texts from the same visual parent card.
4. If scoring resolves a confident match, it applies the replacement and preserves file encoding and syntax escapes.
5. If truly ambiguous, it marks it as `ambiguous` and delegates to the AI agent with candidate file lines.

---

## 📁 Repository Structure

```
live-edit/
├── SKILL.md            # Agent skill definition and prompt instructions
├── README.md           # Documentation and guides
└── scripts/
    ├── live.mjs        # Zero-dependency reverse proxy, matcher & CLI server
    └── client.js       # Shadow-DOM visual editing overlay client
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
