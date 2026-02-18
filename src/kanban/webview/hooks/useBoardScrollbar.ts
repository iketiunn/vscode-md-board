import { useEffect, useRef, useState } from 'preact/hooks';

export type BoardScrollbarState = {
	boardRef: { current: HTMLElement | null };
	trackRef: { current: HTMLDivElement | null };
	hasHorizontalOverflow: boolean;
	thumbWidth: number;
	thumbOffset: number;
	beginThumbDrag: (startClientX: number) => void;
	jumpToTrackPosition: (clientX: number) => void;
};

export function useBoardScrollbar(contentKey: string): BoardScrollbarState {
	const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
	const [boardScrollLeft, setBoardScrollLeft] = useState(0);
	const [boardScrollWidth, setBoardScrollWidth] = useState(0);
	const [boardClientWidth, setBoardClientWidth] = useState(0);
	const boardRef = useRef<HTMLElement | null>(null);
	const trackRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const boardElement = boardRef.current;
		if (!boardElement) {
			return;
		}

		const syncMetrics = () => {
			setBoardScrollWidth(boardElement.scrollWidth);
			setBoardClientWidth(boardElement.clientWidth);
			setHasHorizontalOverflow(boardElement.scrollWidth > boardElement.clientWidth + 1);
		};

		const syncFromBoard = () => {
			setBoardScrollLeft(boardElement.scrollLeft);
		};

		const observer = new ResizeObserver(() => {
			syncMetrics();
			syncFromBoard();
		});

		observer.observe(boardElement);
		boardElement.addEventListener('scroll', syncFromBoard, { passive: true });

		syncMetrics();
		syncFromBoard();

		return () => {
			observer.disconnect();
			boardElement.removeEventListener('scroll', syncFromBoard);
		};
	}, [contentKey]);

	const thumbWidth = hasHorizontalOverflow
		? Math.max(48, (boardClientWidth * boardClientWidth) / Math.max(1, boardScrollWidth))
		: 0;
	const maxThumbOffset = Math.max(0, boardClientWidth - thumbWidth);
	const thumbOffset = hasHorizontalOverflow
		? (boardScrollLeft / Math.max(1, boardScrollWidth - boardClientWidth)) * maxThumbOffset
		: 0;

	const beginThumbDrag = (startClientX: number) => {
		const boardElement = boardRef.current;
		if (!boardElement || !hasHorizontalOverflow) {
			return;
		}

		const startScrollLeft = boardElement.scrollLeft;
		const scrollRange = Math.max(1, boardScrollWidth - boardClientWidth);
		const thumbRange = Math.max(1, maxThumbOffset);
		const ratio = scrollRange / thumbRange;

		const onMove = (event: MouseEvent) => {
			const delta = event.clientX - startClientX;
			boardElement.scrollLeft = startScrollLeft + delta * ratio;
		};

		const onUp = () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	};

	const jumpToTrackPosition = (clientX: number) => {
		const boardElement = boardRef.current;
		const trackElement = trackRef.current;
		if (!boardElement || !trackElement || !hasHorizontalOverflow) {
			return;
		}

		const rect = trackElement.getBoundingClientRect();
		const targetThumbLeft = Math.min(Math.max(0, clientX - rect.left - thumbWidth / 2), maxThumbOffset);
		const ratio = targetThumbLeft / Math.max(1, maxThumbOffset);
		boardElement.scrollLeft = ratio * (boardScrollWidth - boardClientWidth);
	};

	return {
		boardRef,
		trackRef,
		hasHorizontalOverflow,
		thumbWidth,
		thumbOffset,
		beginThumbDrag,
		jumpToTrackPosition
	};
}
