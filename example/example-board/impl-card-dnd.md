---
title: Implement drag and drop for cards
status: Todo
summary: Add intuitive drag-and-drop functionality using dnd-kit for reordering cards within and across columns
---

## Description

Users need to be able to reorder cards within a column and move them between columns (Todo, Doing, Done). The interaction should be smooth and provide visual feedback during dragging.

## Acceptance Criteria

- [ ] Cards can be dragged within the same column to reorder
- [ ] Cards can be moved between columns
- [ ] Visual feedback shows drop target during drag
- [ ] Animation is smooth (60fps)
- [ ] Works on both desktop and touch devices

## Technical Notes

- Consider using `@dnd-kit/core` for accessibility and flexibility
- Need to handle optimistic updates for responsive UI
- May need to debounce rapid movements

## References

- [dnd-kit documentation](https://dndkit.com/)
- Similar implementation in other kanban boards
