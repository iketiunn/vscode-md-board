# Markdown Board

Markdown Board is a VS Code extension that turns a folder of Markdown files into a Kanban board.

Each Markdown file is one card. Card position is controlled by YAML frontmatter (`status`).

## Features

- Open any folder as a Kanban board from Explorer context menu.
- Build columns dynamically from unique `status` values.
- Use `Inbox 📥` automatically when `status` is missing/empty.
- Drag and drop cards across columns.
- Move cards via menu (`Edit`, `Move -> <status>`).
- Click a card to open a Markdown preview in a side pane.
- Auto-refresh board when Markdown files are created/edited/deleted.
- Keep Markdown body intact when status is updated.

## Install

### From source

1. Clone the repo.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build extension:
   ```bash
   npm run compile
   ```
4. Press `F5` in VS Code to launch the Extension Development Host.

## Usage

1. In VS Code Explorer, right-click a folder.
2. Click `Open Folder as Kanban Board`.
3. Interact with cards:
   - Click card: open Markdown preview in side pane.
   - Drag card to another column: updates frontmatter `status`.
   - Use `•••` menu:
     - `Edit`: open markdown editor.
     - `Move`: move to another status.

## Card Frontmatter

Supported frontmatter fields:

- `title`: optional, card title.
- `summary`: optional, card subtitle text.
- `status`: optional, board column.

If `title` is missing, filename is used.
If `status` is missing/empty, `Inbox 📥` is used.

Example:

```md
---
title: "Kanban Extension MVP"
summary: "Folder-as-a-card workflow with YAML status"
status: "In Progress"
---

Implementation notes...
```

## Example Data

Use:

- `/Users/ike/Code/github.com/iketiunn/md-board/example/personal-board`

## Development

```bash
npm run lint
npm run check-types
npm run compile
```

## Architecture (Current)

- `/Users/ike/Code/github.com/iketiunn/md-board/src/extension.ts`: extension entrypoint
- `/Users/ike/Code/github.com/iketiunn/md-board/src/kanban/command.ts`: command registration
- `/Users/ike/Code/github.com/iketiunn/md-board/src/kanban/panel.ts`: webview panel lifecycle + message handling
- `/Users/ike/Code/github.com/iketiunn/md-board/src/kanban/data.ts`: markdown scan + frontmatter normalization
- `/Users/ike/Code/github.com/iketiunn/md-board/src/kanban/markdownStatus.ts`: safe status write-back
- `/Users/ike/Code/github.com/iketiunn/md-board/src/kanban/webview/html.ts`: webview HTML shell + CSP
- `/Users/ike/Code/github.com/iketiunn/md-board/src/kanban/webview/main.tsx`: Preact board UI
- `/Users/ike/Code/github.com/iketiunn/md-board/src/kanban/webview/styles.css`: static webview styles

## Known Limitations

- Card scan is non-recursive (`*.md` directly inside selected folder).
- Remote images are not rendered in card list (by design in current MVP).

## License

MIT (or project default if changed in repository settings).
