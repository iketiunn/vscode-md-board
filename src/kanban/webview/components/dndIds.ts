export const columnDragId = (status: string): string => `column:${status}`;

export const cardDragId = (cardId: string): string => `card:${cardId}`;

export const parseColumnDragId = (id: string): string | undefined =>
	id.startsWith('column:') ? id.slice('column:'.length) : undefined;

export const parseCardDragId = (id: string): string | undefined =>
	id.startsWith('card:') ? id.slice('card:'.length) : undefined;
