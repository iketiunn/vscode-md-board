import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { closestCenter, DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { render } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { DEFAULT_STATUS } from '../constants';
import type { BoardPayload, WebviewCard } from '../types';
import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol';
import { BoardColumn } from './components/BoardColumn';
import { BoardHeader } from './components/BoardHeader';
import { BoardScrollbar } from './components/BoardScrollbar';
import { columnDragId, parseCardDragId, parseColumnDragId } from './components/dndIds';
import type { MenuState } from './components/types';
import { useBoardScrollbar } from './hooks/useBoardScrollbar';
import './styles.css';

declare function acquireVsCodeApi(): {
	postMessage(message: WebviewToHostMessage): void;
};

declare global {
	interface Window {
		__MD_BOARD_INITIAL_STATE__: BoardPayload;
	}
}

const vscode = acquireVsCodeApi();
const DndContextCompat = DndContext as unknown as (props: Record<string, unknown>) => JSX.Element;
const SortableContextCompat = SortableContext as unknown as (props: Record<string, unknown>) => JSX.Element;
const DragOverlayCompat = DragOverlay as unknown as (props: Record<string, unknown>) => JSX.Element;
const pointerThenCenterCollision: CollisionDetection = (args) => {
	const pointerCollisions = pointerWithin(args);
	return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};

function App() {
	const [board, setBoard] = useState<BoardPayload>(window.__MD_BOARD_INITIAL_STATE__);
	const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
	const [draggingColumnStatus, setDraggingColumnStatus] = useState<string | null>(null);
	const [dragOverlayCard, setDragOverlayCard] = useState<WebviewCard | null>(null);
	const [menu, setMenu] = useState<MenuState | null>(null);
	const suppressOpenRef = useRef(false);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 6,
			},
		})
	);

	const columns = useMemo(
		() => {
			const combined = [...new Set(board.columns.concat(board.cards.map((card) => card.status)))];
			if (!combined.includes(DEFAULT_STATUS)) {
				return combined;
			}

			return [DEFAULT_STATUS, ...combined.filter((status) => status !== DEFAULT_STATUS)];
		},
		[board.columns, board.cards]
	);
	const cardsByStatus = useMemo(() => {
		const grouped: Record<string, WebviewCard[]> = {};
		for (const card of board.cards) {
			if (!grouped[card.status]) {
				grouped[card.status] = [];
			}
			grouped[card.status].push(card);
		}
		return grouped;
	}, [board.cards]);
	const sortableColumnIds = useMemo(() => columns.map((status) => columnDragId(status)), [columns]);
	const cardStatusById = useMemo(() => {
		const map = new Map<string, string>();
		for (const card of board.cards) {
			map.set(card.id, card.status);
		}
		return map;
	}, [board.cards]);
	const cardById = useMemo(() => {
		const map = new Map<string, WebviewCard>();
		for (const card of board.cards) {
			map.set(card.id, card);
		}
		return map;
	}, [board.cards]);

	const {
		boardRef,
		trackRef,
		hasHorizontalOverflow,
		thumbWidth,
		thumbOffset,
		beginThumbDrag,
		jumpToTrackPosition
	} = useBoardScrollbar(`${board.columns.length}:${board.cards.length}`);

	useEffect(() => {
		const onMessage = (event: MessageEvent<HostToWebviewMessage>) => {
			if (event.data?.type === 'refresh') {
				setBoard(event.data.payload);
				setMenu(null);
			}
		};

		const closeMenus = () => setMenu(null);

		window.addEventListener('message', onMessage as EventListener);
		document.addEventListener('click', closeMenus);

		return () => {
			window.removeEventListener('message', onMessage as EventListener);
			document.removeEventListener('click', closeMenus);
		};
	}, []);

	useEffect(() => {
		if (draggingCardId || draggingColumnStatus) {
			document.body.classList.add('dragging');
			return;
		}

		document.body.classList.remove('dragging');
	}, [draggingCardId, draggingColumnStatus]);

	const moveCard = useCallback((cardId: string, nextStatus: string) => {
		setBoard((previous) => {
			const card = previous.cards.find((item) => item.id === cardId);
			if (!card || !nextStatus || card.status === nextStatus) {
				return previous;
			}

			const cards = previous.cards.map((item) => (item.id === cardId ? { ...item, status: nextStatus } : item));
			const columns = previous.columns.includes(nextStatus) ? previous.columns : [...previous.columns, nextStatus];
			return { ...previous, cards, columns };
		});

		vscode.postMessage({ type: 'moveCard', id: cardId, status: nextStatus });
	}, []);

	const findCardElement = useCallback((cardId: string): HTMLElement | null => {
		const cardElements = document.querySelectorAll<HTMLElement>('.card[data-card-id]');
		for (const element of cardElements) {
			if (element.dataset.cardId === cardId) {
				return element;
			}
		}
		return null;
	}, []);

	const moveCardFromMenu = useCallback((cardId: string, nextStatus: string) => {
		const card = cardById.get(cardId);
		if (!card || !nextStatus || card.status === nextStatus) {
			return;
		}

		const previousRect = findCardElement(cardId)?.getBoundingClientRect();
		moveCard(cardId, nextStatus);

		if (!previousRect) {
			return;
		}

		window.requestAnimationFrame(() => {
			const movedElement = findCardElement(cardId);
			if (!movedElement) {
				return;
			}

			const nextRect = movedElement.getBoundingClientRect();
			const deltaX = previousRect.left - nextRect.left;
			const deltaY = previousRect.top - nextRect.top;
			if (deltaX === 0 && deltaY === 0) {
				return;
			}

			movedElement.style.transition = 'none';
			movedElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
			movedElement.style.zIndex = '35';
			movedElement.getBoundingClientRect();

			movedElement.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
			movedElement.style.transform = 'translate(0, 0)';

			const cleanup = () => {
				movedElement.style.transition = '';
				movedElement.style.transform = '';
				movedElement.style.zIndex = '';
			};

			movedElement.addEventListener('transitionend', cleanup, { once: true });
			window.setTimeout(cleanup, 280);
		});
	}, [cardById, findCardElement, moveCard]);

	const openCard = useCallback((cardId: string) => {
		vscode.postMessage({ type: 'openCard', id: cardId });
	}, []);

	const editCard = useCallback((cardId: string) => {
		vscode.postMessage({ type: 'editCard', id: cardId });
	}, []);

	const deleteCard = useCallback((cardId: string) => {
		vscode.postMessage({ type: 'deleteCard', id: cardId });
	}, []);

	const createCard = useCallback((status: string) => {
		vscode.postMessage({ type: 'createCard', status });
	}, []);

	const deleteColumn = useCallback((status: string) => {
		vscode.postMessage({ type: 'deleteColumn', status });
	}, []);

	const onCardDragEnd = useCallback(() => {
		setDraggingCardId(null);
		setDragOverlayCard(null);
		setTimeout(() => {
			suppressOpenRef.current = false;
		}, 0);
	}, []);

	const reorderColumns = useCallback((draggedStatus: string, targetStatus: string) => {
		let nextColumnsForSave: string[] | undefined;
		setBoard((previous) => {
			if (draggedStatus === DEFAULT_STATUS) {
				return previous;
			}
			const nonDefault = previous.columns.filter((status) => status !== DEFAULT_STATUS);
			const sourceIndex = nonDefault.indexOf(draggedStatus);
			if (sourceIndex < 0) {
				return previous;
			}
			const targetIndex = targetStatus === DEFAULT_STATUS ? 0 : nonDefault.indexOf(targetStatus);
			if (targetIndex < 0 || sourceIndex === targetIndex) {
				return previous;
			}
			const moved = arrayMove(nonDefault, sourceIndex, targetIndex);
			const pinnedColumns = moved.filter((status) => status !== DEFAULT_STATUS);
			const columns = [DEFAULT_STATUS, ...pinnedColumns];
			nextColumnsForSave = columns;
			return { ...previous, columns };
		});
		if (nextColumnsForSave) {
			vscode.postMessage({ type: 'reorderColumns', columns: nextColumnsForSave });
		}
	}, []);

	const onColumnDragEnd = useCallback(() => {
		setDraggingColumnStatus(null);
	}, []);

	const onDragStart = useCallback((event: DragStartEvent) => {
		const activeId = String(event.active.id);
		const cardId = parseCardDragId(activeId);
		if (cardId) {
			suppressOpenRef.current = true;
			setDraggingCardId(cardId);
			setDragOverlayCard(cardById.get(cardId) ?? null);
			setMenu(null);
			return;
		}

		const columnStatus = parseColumnDragId(activeId);
		if (columnStatus) {
			setDraggingColumnStatus(columnStatus);
			setMenu(null);
		}
	}, [cardById]);

	const onDragCancel = useCallback(() => {
		onCardDragEnd();
		onColumnDragEnd();
	}, [onCardDragEnd, onColumnDragEnd]);

	const resolveDropStatus = useCallback((event: DragEndEvent): string | undefined => {
		const over = event.over;
		if (!over) {
			return undefined;
		}

		const overId = String(over.id);
		const fromColumnIds = parseColumnDragId(overId);
		if (fromColumnIds) {
			return fromColumnIds;
		}

		const overCardId = parseCardDragId(overId);
		if (overCardId) {
			return cardStatusById.get(overCardId);
		}

		const maybeStatus = (over.data.current as { status?: unknown } | undefined)?.status;
		return typeof maybeStatus === 'string' ? maybeStatus : undefined;
	}, [cardStatusById]);

	const onDragEnd = useCallback((event: DragEndEvent) => {
		const activeId = String(event.active.id);
		const targetStatus = resolveDropStatus(event);
		const draggedCardId = parseCardDragId(activeId);
		if (draggedCardId) {
			if (targetStatus) {
				moveCard(draggedCardId, targetStatus);
			}
			onCardDragEnd();
			return;
		}

		const draggedStatus = parseColumnDragId(activeId);
		if (!draggedStatus) {
			onColumnDragEnd();
			return;
		}

		if (targetStatus && targetStatus !== draggedStatus) {
			reorderColumns(draggedStatus, targetStatus);
		}
		onColumnDragEnd();
	}, [moveCard, onCardDragEnd, onColumnDragEnd, reorderColumns, resolveDropStatus]);

	return (
		<div class="app-shell">
			<BoardHeader folderName={board.folderName} folderPath={board.folderPath} />
			<DndContextCompat
				sensors={sensors}
				collisionDetection={pointerThenCenterCollision}
				onDragStart={onDragStart}
				onDragEnd={onDragEnd}
				onDragCancel={onDragCancel}
			>
				<main ref={boardRef} class="board" onScroll={() => setMenu(null)}>
					<SortableContextCompat items={sortableColumnIds} strategy={horizontalListSortingStrategy}>
						{columns.map((status) => (
							<BoardColumn
								key={status}
								status={status}
								cards={cardsByStatus[status] ?? []}
								columns={columns}
								menu={menu}
								draggingCardId={draggingCardId}
								draggingColumnStatus={draggingColumnStatus}
								suppressOpenRef={suppressOpenRef}
								setMenu={setMenu}
								onMoveCard={moveCardFromMenu}
								onOpenCard={openCard}
								onEditCard={editCard}
								onDeleteCard={deleteCard}
								onCreateCard={createCard}
								onDeleteColumn={status === DEFAULT_STATUS ? undefined : deleteColumn}
							/>
						))}
					</SortableContextCompat>
				</main>
				<DragOverlayCompat>
					{dragOverlayCard ? (
						<article class="card card-drag-overlay">
							<p class="card-title">{dragOverlayCard.title}</p>
							{dragOverlayCard.summary ? <p class="card-summary">{dragOverlayCard.summary}</p> : null}
						</article>
					) : null}
				</DragOverlayCompat>
			</DndContextCompat>
			<BoardScrollbar
				trackRef={trackRef}
				hasHorizontalOverflow={hasHorizontalOverflow}
				thumbWidth={thumbWidth}
				thumbOffset={thumbOffset}
				onTrackMouseDown={jumpToTrackPosition}
				onThumbMouseDown={beginThumbDrag}
			/>
		</div>
	);
}

render(<App />, document.getElementById('app') as HTMLElement);
