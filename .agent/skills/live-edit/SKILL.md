---
name: live-edit
description: Visual live editing of a local website, wired to the codebase. Use when the user wants to click a section, card, title, subtitle or button on localhost and edit it in realtime (change text, add/duplicate a card, delete one, enable/disable a button) and have the changes saved into the source files. Trigger on "live edit", "visual editor", "edit on the page", "/live-edit", or when a queued change list from the browser needs applying.
---

# live-edit

A local proxy puts an edit overlay on top of the user's running dev server. Plain text edits are written straight into the source files by the tool. Structural edits (add/duplicate, delete, button state) are queued for you, the agent, to apply to the code properly.

## Install (once per project)

Run from the project root, pointing at wherever this skill folder currently lives:

```
node <path-to>/live-edit/scripts/live.mjs init
```

This copies the skill to `.agent/skills/live-edit/`, adds `npm run live`, and adds `.live/` to `.gitignore`. For use in all projects, copy the folder to `~/.gemini/antigravity/skills/live-edit/` instead.

## Start a session

1. Make sure the project's dev server is running (`npm run dev` or equivalent). If not, start it in a background terminal.
2. Start the overlay: `npm run live` (or `node .agent/skills/live-edit/scripts/live.mjs start`). It auto-detects the dev server port; pass `--target http://localhost:PORT` if needed.
3. Tell the user to open `http://localhost:4321`.

## The overlay (user-facing)

- Hover highlights, click selects. Double-click edits text inline. Enter commits, Esc cancels.
- Toolbar on the selection: Edit text, Parent ↑ (jump to card/section), Child ↓, Duplicate, Delete, Enable/Disable (buttons only).
- Bottom bar: Live on/off, Undo, change list, Save to code (Ctrl/Cmd+S).
- Edits show instantly in the browser. Nothing touches the code until Save.

## Your job while the session is open

Run this in a loop for as long as the user is editing:

1. `node .agent/skills/live-edit/scripts/live.mjs wait` blocks until the user clicks Save with queued items, then prints them.
2. For each item, find the source and apply the change idiomatically, then clear it with `live.mjs done <id>`.

| Item | What to do |
|---|---|
| `comment` | User added a prompt/note/feedback for this element (e.g. "make font bigger", "change color"). Locate the component and fulfill the instruction idiomatically. |
| `resize` | User resized the element to `width` × `height`. Apply the appropriate Tailwind class or inline CSS / component dimensions to match. |
| `style` | User adjusted a visual style (backgroundColor, color, padding, borderRadius). Apply the matching Tailwind class or CSS style. |
| `reorder` | Move the element before or after its sibling in the component markup. |
| `text` (ambiguous / notfound) | Candidates are listed. Pick the right file by using the selector and html context. If the text comes from a CMS, i18n file or data array, edit it there. |
| `duplicate` | If the card is rendered from a data array or `.map()`, add a new entry to the data with the same shape. Otherwise duplicate the markup right after the original. Keep keys and ids unique. |
| `delete` | Remove the card's data entry if it is data-driven, otherwise remove the markup. Clean up any imports left unused. |
| `attr` `disabled` | Set or remove `disabled` on the element. If the button state is driven by state or props, change that source instead of hardcoding. |

3. After applying, confirm in one line what changed and in which files, then run `wait` again.

## Rules

- Never edit `.live/` by hand. Use `done`.
- Match the existing code style, components and class conventions. Do not restructure unrelated code.
- If a queued change is ambiguous and a wrong guess would modify the wrong card, ask the user one short question instead of guessing.
- Text edits already saved by the tool are final. Do not redo them.
- The server binds to 127.0.0.1 and requires a per-session token for writes. Do not expose it publicly.
- Stop the loop when the user says they are done, and stop `npm run live`.

## Troubleshooting (edit vanishes on refresh)

An edit only survives a refresh if it was written to source. After Save, the overlay shows a result panel (bottom right):
- `✓ file:line` means written to source. Your dev server then hot-reloads it.
- `⚠ queued` means NOT in code yet. The agent must run `live.mjs wait` and apply it. If you see this, tell the agent: "apply live-edit changes".
- `notfound` with "Searched N files in <dir>": `npm run live` was started from the wrong folder, or the text comes from a CMS, database or API rather than the code. Restart from the project root.
- "Save failed": `npm run live` is not running.

Duplicate text (e.g. the same opening hours on every branch card) is resolved automatically using the other texts in that card. If that is still ambiguous it is queued with file:line candidates.

## Limits

Frameworks with full-page HMR may reload after Save, which clears unsaved overlay state. Save often. Text that is built from several string parts or computed at runtime will be queued as `notfound`, so resolve it by hand.
