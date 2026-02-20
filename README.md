# Markdown Board

Visualize a folder of Markdown files as a Kanban board in VS Code.

Markdown Board treats each `.md` file as a card when it has a valid frontmatter `title`, and uses frontmatter `status` as the column.

## Why Markdown Board

- Keep tasks in plain files, not a separate database
- Use Git-native workflows (branching, PRs, history)
- Edit cards in Markdown while still getting a visual board
- File based management make it easy to share or work with LLMs

## Quick Start

1. Open VS Code.
2. In Explorer, right-click a folder.
3. Select `Open Folder as Kanban Board`.
4. Manage cards from the board UI:
   - Click card to open Markdown preview.
   - Drag card to a new column to update `status`.
   - Use `•••` for `Edit`, `Move`, and `Delete`.
   - Use column `Create` to add a new card in that status.

## Card Format

### Minimum Required Format

A Markdown file is recognized as a card only if it includes:

- YAML frontmatter
- `title` as a non-empty string

```md
---
title: "My Card Title"
---
```

### Supported Frontmatter Fields

- `title`: required, non-empty string
- `summary`: optional, short subtitle text
- `status`: optional, column name

If `status` is missing or empty, the card is placed in `Inbox 📥`.

```md
---
title: "Kanban Extension MVP"
summary: "Folder-as-a-card workflow with YAML status"
status: "In Progress"
---

Implementation notes...
```

### New Card Template

`Create` now asks for a title and requires confirmation before writing a new file. The new file is created with:

```md
---
title: "<your entered title>"
status: "<column status>"
---
```

## Command

- `Open Folder as Kanban Board` (`extension.openFolderAsKanban`)

Available from Explorer folder context menu.

## Example Data

- `example/personal-board`

## Install (From Source)

```bash
npm install
npm run compile
```

Press `F5` in VS Code to start the Extension Development Host.

## Development

`F5` in VS Code to start the Extension Development Host.

## Project Structure

- `src/extension.ts`: extension entrypoint
- `src/kanban/command.ts`: command registration
- `src/kanban/panel.ts`: panel lifecycle and message handling
- `src/kanban/data.ts`: card loading and frontmatter normalization
- `src/kanban/markdownStatus.ts`: safe status write-back
- `src/kanban/webview/main.tsx`: board UI

## Current Limitations

- Scans only `*.md` files directly inside the selected folder (non-recursive)
- Markdown files without valid frontmatter `title` are ignored
- Card list does not render remote images

## License

MIT
