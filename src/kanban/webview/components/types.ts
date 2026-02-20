export type CardMenuState = {
	type: 'card';
	cardId: string;
	submenuOpen: boolean;
};

export type ColumnMenuState = {
	type: 'column';
	status: string;
};

export type MenuState = CardMenuState | ColumnMenuState;
