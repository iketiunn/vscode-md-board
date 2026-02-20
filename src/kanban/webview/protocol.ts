import type { BoardPayload } from '../types';

export type HostToWebviewMessage = {
	type: 'refresh';
	payload: BoardPayload;
};

export type MoveCardMessage = {
	type: 'moveCard';
	id: string;
	status: string;
};

export type OpenCardMessage = {
	type: 'openCard';
	id: string;
};

export type EditCardMessage = {
	type: 'editCard';
	id: string;
};

export type CreateCardMessage = {
	type: 'createCard';
	status: string;
};

export type DeleteCardMessage = {
	type: 'deleteCard';
	id: string;
};

export type ReorderColumnsMessage = {
	type: 'reorderColumns';
	columns: string[];
};

export type WebviewToHostMessage =
	| MoveCardMessage
	| OpenCardMessage
	| EditCardMessage
	| CreateCardMessage
	| DeleteCardMessage
	| ReorderColumnsMessage;
