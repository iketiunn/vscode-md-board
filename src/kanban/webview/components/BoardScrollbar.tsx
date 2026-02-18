type BoardScrollbarProps = {
	trackRef: { current: HTMLDivElement | null };
	hasHorizontalOverflow: boolean;
	thumbWidth: number;
	thumbOffset: number;
	onTrackMouseDown: (clientX: number) => void;
	onThumbMouseDown: (clientX: number) => void;
};

export function BoardScrollbar({
	trackRef,
	hasHorizontalOverflow,
	thumbWidth,
	thumbOffset,
	onTrackMouseDown,
	onThumbMouseDown
}: BoardScrollbarProps) {
	return (
		<div class={`board-scrollbar ${hasHorizontalOverflow ? '' : 'board-scrollbar-hidden'}`}>
			<div
				ref={trackRef}
				class="board-scrollbar-track"
				aria-hidden="true"
				onMouseDown={(event) => {
					onTrackMouseDown(event.clientX);
				}}
			>
				<div
					class="board-scrollbar-thumb"
					style={{ width: `${thumbWidth}px`, transform: `translateX(${thumbOffset}px)` }}
					onMouseDown={(event) => {
						event.stopPropagation();
						onThumbMouseDown(event.clientX);
					}}
				/>
			</div>
		</div>
	);
}
