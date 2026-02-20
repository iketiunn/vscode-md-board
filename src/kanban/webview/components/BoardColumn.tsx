import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import { useCallback } from 'preact/hooks';
import { DEFAULT_STATUS } from '../../constants';
import type { WebviewCard } from '../../types';
import { CardItem } from './CardItem';
import { columnDragId } from './dndIds';
import type { MenuState } from './types';

type BoardColumnProps = {
	status: string;
	cards: WebviewCard[];
	columns: string[];
	menu: MenuState | null;
	draggingCardId: string | null;
	draggingColumnStatus: string | null;
	suppressOpenRef: { current: boolean };
	setMenu: Dispatch<StateUpdater<MenuState | null>>;
	onMoveCard: (cardId: string, nextStatus: string) => void;
	onOpenCard: (cardId: string) => void;
	onEditCard: (cardId: string) => void;
	onDeleteCard: (cardId: string) => void;
	onCreateCard: (status: string) => void;
	onDeleteColumn?: (status: string) => void;
};

export function BoardColumn({
	status,
	cards,
	columns,
	menu,
	draggingCardId,
	draggingColumnStatus,
	suppressOpenRef,
	setMenu,
	onMoveCard,
	onOpenCard,
	onEditCard,
	onDeleteCard,
	onCreateCard,
	onDeleteColumn
}: BoardColumnProps) {
	const isInbox = status === DEFAULT_STATUS;
	const isColumnBeingDragged = draggingColumnStatus === status;
	const isMenuOpen = menu?.type === 'column' && menu.status === status;
	const {
		setNodeRef: setSortableNodeRef,
		attributes,
		listeners,
		transform,
		transition,
	} = useSortable({
		id: columnDragId(status),
		data: {
			type: 'column',
			status,
		},
		disabled: isInbox,
	});
	const sortableStyle = {
		transform: CSS.Transform.toString(transform),
		transition,
	};
	const sortableAttributes = attributes as unknown as Record<string, unknown>;
	const sortableListeners = listeners as Record<string, unknown>;

	const handleMenuClick = useCallback((event: MouseEvent) => {
		event.stopPropagation();
		setMenu(isMenuOpen ? null : { type: 'column', status });
	}, [isMenuOpen, setMenu, status]);

	const handleDeleteColumn = useCallback(() => {
		if (onDeleteColumn && cards.length === 0) {
			onDeleteColumn(status);
		}
		setMenu(null);
	}, [onDeleteColumn, status, cards.length, setMenu]);

	return (
		<section
			class={`column ${isInbox ? 'column-inbox' : ''} ${isColumnBeingDragged ? 'column-dragging' : ''}`}
			ref={setSortableNodeRef}
			style={sortableStyle}
		>
			<header
				class={`column-header ${isInbox ? '' : 'column-header-draggable'}`}
				{...(!isInbox ? sortableAttributes : {})}
				{...(!isInbox ? sortableListeners : {})}
			>
				<h2>{status}</h2>
				<div class="column-header-actions">
					<button class="column-create-button" type="button" onClick={() => onCreateCard(status)}>
						Create
					</button>
					<span>{cards.length}</span>
					{!isInbox && onDeleteColumn && (
						<div class="column-menu-wrap">
							<button
								class="column-menu-trigger"
								type="button"
								onClick={handleMenuClick}
								aria-label="Column options"
							>
								⋮
							</button>
							{isMenuOpen && (
								<div class="menu column-menu" onClick={(e) => e.stopPropagation()}>
									<button
										class={`menu-item menu-item-danger ${cards.length > 0 ? 'menu-item-disabled' : ''}`}
										onClick={handleDeleteColumn}
										disabled={cards.length > 0}
										title={cards.length > 0 ? 'Column must be empty to delete' : 'Delete this column'}
									>
										Delete column
									</button>
								</div>
							)}
						</div>
					)}
				</div>
			</header>
			<div class="column-body">
				{cards.map((card) => (
					<CardItem
						key={card.id}
						card={card}
						columns={columns}
						menu={menu}
						draggingCardId={draggingCardId}
						suppressOpenRef={suppressOpenRef}
						setMenu={setMenu}
						onMoveCard={onMoveCard}
						onOpenCard={onOpenCard}
						onEditCard={onEditCard}
						onDeleteCard={onDeleteCard}
					/>
				))}
			</div>
		</section>
	);
}
