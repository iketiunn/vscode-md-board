---
title: Add card summary preview
status: Doing
summary: >-
  Display a brief summary of each card below the title to give context without
  opening the full card
---

## Description

Cards currently only show the title, which makes it hard to remember what a task is about at a glance. Adding a summary preview will improve the board's usability.

## Implementation

The summary is extracted from frontmatter (`summary` field) and displayed below the card title on the board view.

### Example

```yaml
---
title: Important feature
status: Doing
summary: Brief description of what this card contains
---
```

## Design Decisions

- Summary is limited to 2 lines on the board view to keep cards compact
- Falls back to truncated body content if no summary is provided
- Summary is optional - cards without it still work fine

## Result

✅ Implemented in commit `a1b2c3d`
