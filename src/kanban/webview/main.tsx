import { render } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { BoardPayload, WebviewCard } from '../types';
import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol';
import { BoardColumn } from './components/BoardColumn';
import { BoardHeader } from './components/BoardHeader';
import { BoardScrollbar } from './components/BoardScrollbar';
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

function App() {
	const [board, setBoard] = useState<BoardPayload>(window.__MD_BOARD_INITIAL_STATE__);
	const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
	const [menu, setMenu] = useState<MenuState | null>(null);
	const suppressOpenRef = useRef(false);

	const columns = useMemo(
		() => [...new Set(board.columns.concat(board.cards.map((card) => card.status)))],
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
		if (draggingCardId) {
			document.body.classList.add('dragging');
			return;
		}

		document.body.classList.remove('dragging');
	}, [draggingCardId]);

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

	const openCard = useCallback((cardId: string) => {
		vscode.postMessage({ type: 'openCard', id: cardId });
	}, []);

	const editCard = useCallback((cardId: string) => {
		vscode.postMessage({ type: 'editCard', id: cardId });
	}, []);

	const onCardDragStart = useCallback((cardId: string) => {
		suppressOpenRef.current = true;
		setDraggingCardId(cardId);
	}, []);

	const onCardDragEnd = useCallback(() => {
		setDraggingCardId(null);
		setTimeout(() => {
			suppressOpenRef.current = false;
		}, 0);
	}, []);

	return (
		<div class="app-shell">
			<BoardHeader folderName={board.folderName} folderPath={board.folderPath} />
			<main ref={boardRef} class="board" onScroll={() => setMenu(null)}>
				{columns.map((status) => (
					<BoardColumn
						key={status}
						status={status}
						cards={cardsByStatus[status] ?? []}
						columns={columns}
						menu={menu}
						draggingCardId={draggingCardId}
						suppressOpenRef={suppressOpenRef}
						setMenu={setMenu}
						onMoveCard={moveCard}
						onOpenCard={openCard}
						onEditCard={editCard}
						onCardDragStart={onCardDragStart}
						onCardDragEnd={onCardDragEnd}
					/>
				))}
			</main>
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
