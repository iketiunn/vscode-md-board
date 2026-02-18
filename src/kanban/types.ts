export type Card = {
	id: string;
	title: string;
	summary?: string;
	status: string;
	filePath: string;
	assetPath: string;
};

export type WebviewCard = {
	id: string;
	title: string;
	summary?: string;
	status: string;
	filePath: string;
	assetPath: string;
};

export type BoardPayload = {
	folderPath: string;
	folderName: string;
	columns: string[];
	cards: WebviewCard[];
};

export type WebviewMessage = {
	type?: string;
	id?: string;
	status?: string;
};
