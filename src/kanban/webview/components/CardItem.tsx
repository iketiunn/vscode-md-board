import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import type { WebviewCard } from '../../types';
import type { MenuState } from './types';

type CardItemProps = {
	card: WebviewCard;
	columns: string[];
	menu: MenuState | null;
	draggingCardId: string | null;
	suppressOpenRef: { current: boolean };
	setMenu: Dispatch<StateUpdater<MenuState | null>>;
	onMoveCard: (cardId: string, nextStatus: string) => void;
	onOpenCard: (cardId: string) => void;
	onEditCard: (cardId: string) => void;
	onDeleteCard: (cardId: string) => void;
	onCardDragStart: (cardId: string) => void;
	onCardDragEnd: () => void;
};

export function CardItem({
	card,
	columns,
	menu,
	draggingCardId,
	suppressOpenRef,
	setMenu,
	onMoveCard,
	onOpenCard,
	onEditCard,
	onDeleteCard,
	onCardDragStart,
	onCardDragEnd
}: CardItemProps) {
	const availableStatuses = columns.filter((value) => value !== card.status);
	const isMenuOpen = menu?.cardId === card.id;
	const isMoveOpen = isMenuOpen && Boolean(menu?.submenuOpen);
	const canMove = availableStatuses.length > 0;
	const menuId = `card-menu-${card.id}`;
	const moveMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
	const moveMenuRef = useRef<HTMLDivElement | null>(null);
	const closeMoveMenuTimerRef = useRef<number | null>(null);
	const [moveMenuPosition, setMoveMenuPosition] = useState<{
		top: number;
		left: number;
		horizontal: 'left' | 'right';
	} | null>(null);

	const clearMoveMenuCloseTimer = useCallback(() => {
		if (closeMoveMenuTimerRef.current === null) {
			return;
		}
		window.clearTimeout(closeMoveMenuTimerRef.current);
		closeMoveMenuTimerRef.current = null;
	}, []);

	const openMoveMenu = useCallback(() => {
		if (!canMove) {
			return;
		}
		clearMoveMenuCloseTimer();
		setMenu({ cardId: card.id, submenuOpen: true });
	}, [canMove, card.id, clearMoveMenuCloseTimer, setMenu]);

	const closeMoveMenuSoon = useCallback(() => {
		clearMoveMenuCloseTimer();
		closeMoveMenuTimerRef.current = window.setTimeout(() => {
			setMenu((current) => {
				if (!current || current.cardId !== card.id) {
					return current;
				}
				return { cardId: card.id, submenuOpen: false };
			});
			closeMoveMenuTimerRef.current = null;
		}, 120);
	}, [card.id, clearMoveMenuCloseTimer, setMenu]);

	const updateMoveMenuPosition = useCallback(() => {
		const triggerElement = moveMenuTriggerRef.current;
		if (!triggerElement || !isMoveOpen || !canMove) {
			return;
		}

		const triggerRect = triggerElement.getBoundingClientRect();
		const menuWidth = moveMenuRef.current?.offsetWidth ?? 190;
		const menuHeight = moveMenuRef.current?.offsetHeight ?? 140;
		const sideGap = 4;
		const verticalOffset = 8;
		const viewportPadding = 12;
		const canPlaceRight = triggerRect.right + sideGap + menuWidth <= window.innerWidth - viewportPadding;
		const canPlaceLeft = triggerRect.left - sideGap - menuWidth >= viewportPadding;
		const horizontal: 'left' | 'right' = canPlaceRight || !canPlaceLeft ? 'right' : 'left';
		let left =
			horizontal === 'right'
				? triggerRect.right + sideGap
				: triggerRect.left - sideGap - menuWidth;
		left = Math.min(Math.max(viewportPadding, left), window.innerWidth - viewportPadding - menuWidth);

		let top = triggerRect.top - verticalOffset;
		top = Math.min(Math.max(viewportPadding, top), window.innerHeight - viewportPadding - menuHeight);

		setMoveMenuPosition({ top, left, horizontal });
	}, [canMove, isMoveOpen]);

	useLayoutEffect(() => {
		if (!isMoveOpen || !canMove) {
			setMoveMenuPosition(null);
			return;
		}
		updateMoveMenuPosition();
		const frameId = window.requestAnimationFrame(updateMoveMenuPosition);
		return () => window.cancelAnimationFrame(frameId);
	}, [canMove, isMoveOpen, updateMoveMenuPosition, availableStatuses.length]);

	useEffect(() => {
		if (!isMoveOpen || !canMove) {
			return;
		}

		const handleWindowChange = () => updateMoveMenuPosition();
		window.addEventListener('resize', handleWindowChange);
		window.addEventListener('scroll', handleWindowChange, true);
		return () => {
			window.removeEventListener('resize', handleWindowChange);
			window.removeEventListener('scroll', handleWindowChange, true);
		};
	}, [canMove, isMoveOpen, updateMoveMenuPosition]);

	useEffect(
		() => () => {
			clearMoveMenuCloseTimer();
		},
		[clearMoveMenuCloseTimer]
	);

	return (
		<article
			key={card.id}
			class={`card ${isMenuOpen ? 'card-menu-open' : ''}`}
			draggable
			tabIndex={0}
			onDragStart={(event) => {
				event.dataTransfer?.setData('text/plain', card.id);
				if (event.dataTransfer) {
					event.dataTransfer.effectAllowed = 'move';
				}
				onCardDragStart(card.id);
			}}
			onDragEnd={onCardDragEnd}
			onClick={() => {
				if (!draggingCardId && !suppressOpenRef.current) {
					setMenu(null);
					onOpenCard(card.id);
				}
			}}
			onKeyDown={(event) => {
				if (event.key === 'Escape' && isMenuOpen) {
					event.stopPropagation();
					setMenu(null);
					return;
				}
				if (event.target !== event.currentTarget) {
					return;
				}
				if ((event.key === 'Enter' || event.key === ' ') && !draggingCardId && !suppressOpenRef.current) {
					event.preventDefault();
					setMenu(null);
					onOpenCard(card.id);
				}
			}}
		>
			<button
				type="button"
				class="card-menu-trigger"
				aria-label="Open card menu"
				aria-haspopup="menu"
				aria-expanded={isMenuOpen}
				aria-controls={menuId}
				onClick={(event) => {
					event.stopPropagation();
					setMenu(isMenuOpen ? null : { cardId: card.id, submenuOpen: false });
				}}
			>
				•••
			</button>
			<p class="card-title">{card.title}</p>
			{card.summary ? <p class="card-summary">{card.summary}</p> : null}
			{isMenuOpen ? (
				<div id={menuId} class="card-menu" role="menu" onClick={(event) => event.stopPropagation()}>
					<button
						type="button"
						class="menu-item"
						role="menuitem"
						onClick={() => {
							setMenu(null);
							onEditCard(card.id);
						}}
					>
						Edit
					</button>
					<button
						type="button"
						class="menu-item menu-item-danger"
						role="menuitem"
						onClick={() => {
							setMenu(null);
							onDeleteCard(card.id);
						}}
					>
						Delete
					</button>
					<div
						class="menu-move-wrap"
						onMouseEnter={openMoveMenu}
						onMouseLeave={closeMoveMenuSoon}
					>
						<button
							ref={moveMenuTriggerRef}
							type="button"
							class="menu-item menu-item-move"
							role="menuitem"
							aria-expanded={isMoveOpen}
							disabled={!canMove}
							onClick={(event) => {
								event.stopPropagation();
								if (!canMove) {
									return;
								}
								if (isMoveOpen) {
									closeMoveMenuSoon();
									return;
								}
								openMoveMenu();
							}}
						>
							<span>Move</span>
							<span>›</span>
						</button>
					</div>
				</div>
			) : null}
			{canMove && isMoveOpen
				? createPortal(
						<div
							ref={moveMenuRef}
							class="move-submenu move-submenu-portal"
							data-horizontal={moveMenuPosition?.horizontal ?? 'right'}
							style={
								moveMenuPosition
									? {
											top: `${moveMenuPosition.top}px`,
											left: `${moveMenuPosition.left}px`
									  }
									: undefined
							}
							onClick={(event) => event.stopPropagation()}
							onMouseEnter={openMoveMenu}
							onMouseLeave={closeMoveMenuSoon}
						>
							{availableStatuses.map((next) => (
								<button
									key={next}
									type="button"
									class="menu-item"
									role="menuitem"
									onClick={() => {
										setMenu(null);
										onMoveCard(card.id, next);
									}}
								>
									{next}
								</button>
							))}
						</div>,
						document.body
				  )
				: null}
		</article>
	);
}
