import * as path from 'node:path';
import matter from 'gray-matter';
import * as vscode from 'vscode';
import { DEFAULT_STATUS } from './constants';
import { BoardPayload, Card } from './types';

export async function loadCards(folderUri: vscode.Uri): Promise<Card[]> {
	const entries = await vscode.workspace.fs.readDirectory(folderUri);
	const mdEntries = entries.filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.md'));

	const maybeCards = await Promise.all(
		mdEntries.map(async ([name]) => {
			const fileUri = vscode.Uri.joinPath(folderUri, name);
			const bytes = await vscode.workspace.fs.readFile(fileUri);
			const raw = Buffer.from(bytes).toString('utf8');
			const parsed = matter(raw);
			const title = normalizeTitle(parsed.data.title);
			if (!title) {
				return undefined;
			}
			const summary = normalizeSummary(parsed.data.summary);
			const status = normalizeStatus(parsed.data.status);

			const card: Card = {
				id: fileUri.fsPath,
				title,
				status,
				filePath: fileUri.fsPath,
				assetPath: path.dirname(fileUri.fsPath),
				...(summary ? { summary } : {}),
			};

			return card;
		})
	);

	const cards = maybeCards.filter((card): card is Card => Boolean(card));
	cards.sort((a, b) => a.title.localeCompare(b.title));
	return cards;
}

export function toBoardPayload(
	cards: Card[],
	folderUri: vscode.Uri,
	persistedColumns?: string[],
	deletedColumns?: Set<string>
): BoardPayload {
	// Get columns from current cards
	const discoveredColumns = uniqueColumns(cards.map((card) => card.status));

	// Merge with persisted columns (to keep empty columns)
	const allColumns = persistedColumns
		? mergeColumns(persistedColumns, discoveredColumns)
		: discoveredColumns;

	if (!allColumns.includes(DEFAULT_STATUS)) {
		allColumns.unshift(DEFAULT_STATUS);
	}

	// Filter out deleted columns
	const filteredColumns = deletedColumns
		? allColumns.filter((col) => !deletedColumns.has(col))
		: allColumns;

	return {
		folderPath: folderUri.fsPath,
		folderName: path.basename(folderUri.fsPath),
		columns: filteredColumns,
		cards: cards.map((card) => ({
			id: card.id,
			title: card.title,
			summary: card.summary,
			status: card.status,
			filePath: card.filePath,
			assetPath: card.assetPath,
		})),
	};
}

function mergeColumns(persisted: string[], discovered: string[]): string[] {
	const result = [...persisted];
	for (const col of discovered) {
		if (!result.includes(col)) {
			result.push(col);
		}
	}
	return result;
}

function normalizeTitle(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim().length > 0) {
		return value.trim();
	}
	return undefined;
}

function normalizeStatus(value: unknown): string {
	if (typeof value !== 'string') {
		return DEFAULT_STATUS;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? DEFAULT_STATUS : trimmed;
}

function normalizeSummary(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? undefined : trimmed;
}

function uniqueColumns(statuses: string[]): string[] {
	const result: string[] = [];
	for (const status of statuses) {
		if (!result.includes(status)) {
			result.push(status);
		}
	}

	return result;
}
