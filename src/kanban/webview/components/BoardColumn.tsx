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
	onCardDragStart,
	onCardDragEnd
}: BoardColumnProps) {
	return (
		<section class={`column ${status === DEFAULT_STATUS ? 'column-inbox' : ''}`}>
			<header class="column-header">
				<h2>{status}</h2>
				<span>{cards.length}</span>
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
						onCardDragStart={onCardDragStart}
						onCardDragEnd={onCardDragEnd}
					/>
				))}
			</div>
		</section>
	);
}
