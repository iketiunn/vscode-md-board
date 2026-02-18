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

export type WebviewToHostMessage = MoveCardMessage | OpenCardMessage | EditCardMessage;
