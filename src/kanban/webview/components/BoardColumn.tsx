import type { Dispatch, StateUpdater } from 'preact/hooks';
import { DEFAULT_STATUS } from '../../constants';
import type { WebviewCard } from '../../types';
import { CardItem } from './CardItem';
import type { MenuState } from './types';

type BoardColumnProps = {
	status: string;
	cards: WebviewCard[];
	columns: string[];
	menu: MenuState | null;
	draggingCardId: string | null;
	suppressOpenRef: { current: boolean };
	setMenu: Dispatch<StateUpdater<MenuState | null>>;
	onMoveCard: (cardId: string, nextStatus: string) => void;
	onOpenCard: (cardId: string) => void;
	onEditCard: (cardId: string) => void;
	onDeleteCard: (cardId: string) => void;
	onCreateCard: (status: string) => void;
	onCardDragStart: (cardId: string) => void;
	onCardDragEnd: () => void;
};

export function BoardColumn({
	status,
	cards,
	columns,
	menu,
	draggingCardId,
	suppressOpenRef,
	setMenu,
	onMoveCard,
	onOpenCard,
	onEditCard,
	onDeleteCard,
	onCreateCard,
	onCardDragStart,
	onCardDragEnd
}: BoardColumnProps) {
	return (
		<section class={`column ${status === DEFAULT_STATUS ? 'column-inbox' : ''}`}>
			<header class="column-header">
				<h2>{status}</h2>
				<div class="column-header-actions">
					<button class="column-create-button" type="button" onClick={() => onCreateCard(status)}>
						Create
					</button>
					<span>{cards.length}</span>
				</div>
			</header>
			<div
				class="column-body"
				onDragOver={(event) => {
					event.preventDefault();
					if (event.dataTransfer) {
						event.dataTransfer.dropEffect = 'move';
					}
				}}
				onDrop={(event) => {
					event.preventDefault();
					const cardId = event.dataTransfer?.getData('text/plain');
					if (!cardId) {
						return;
					}

					setMenu(null);
					onMoveCard(cardId, status);
				}}
			>
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
							onCardDragStart={onCardDragStart}
							onCardDragEnd={onCardDragEnd}
						/>
				))}
			</div>
		</section>
	);
}
