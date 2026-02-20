import * as path from 'node:path';
import * as vscode from 'vscode';
import { DEFAULT_STATUS, PANEL_VIEW_TYPE } from './constants';
import { loadCards, toBoardPayload } from './data';
import { updateCardStatus } from './markdownStatus';
import { WebviewToHostMessage } from './webview/protocol';
import { getWebviewHtml } from './webview/html';

function getColumnOrderKey(folderUri: vscode.Uri): string {
	return `mdBoard:columnOrder:${folderUri.fsPath}`;
}

function getDeletedColumnsKey(folderUri: vscode.Uri): string {
	return `mdBoard:deletedColumns:${folderUri.fsPath}`;
}

function getPersistedColumnsKey(folderUri: vscode.Uri): string {
	return `mdBoard:persistedColumns:${folderUri.fsPath}`;
}

async function readColumnOrder(context: vscode.ExtensionContext, folderUri: vscode.Uri): Promise<string[] | undefined> {
	const value = context.workspaceState.get<unknown>(getColumnOrderKey(folderUri));
	if (!Array.isArray(value)) {
		return undefined;
	}

	const normalized = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
	return normalized.length > 0 ? normalized : undefined;
}

async function readDeletedColumns(context: vscode.ExtensionContext, folderUri: vscode.Uri): Promise<Set<string>> {
	const value = context.workspaceState.get<unknown>(getDeletedColumnsKey(folderUri));
	if (!Array.isArray(value)) {
		return new Set();
	}

	return new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0));
}

async function readPersistedColumns(context: vscode.ExtensionContext, folderUri: vscode.Uri): Promise<string[] | undefined> {
	const value = context.workspaceState.get<unknown>(getPersistedColumnsKey(folderUri));
	if (!Array.isArray(value)) {
		return undefined;
	}

	return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export async function openFolderAsKanban(context: vscode.ExtensionContext, folderUri: vscode.Uri): Promise<void> {
	const folderName = path.basename(folderUri.fsPath);
	let previewColumn: vscode.ViewColumn | undefined;
	const webviewDistUri = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview');
	const webviewScriptUri = vscode.Uri.joinPath(webviewDistUri, 'app.js');
	const webviewStyleUri = vscode.Uri.joinPath(webviewDistUri, 'app.css');
	const panel = vscode.window.createWebviewPanel(
		PANEL_VIEW_TYPE,
		`Kanban: ${folderName}`,
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			localResourceRoots: [folderUri, webviewDistUri],
		}
	);

	const refresh = async () => {
		const cards = await loadCards(folderUri);
		const deletedColumns = await readDeletedColumns(context, folderUri);
		const persistedColumns = await readPersistedColumns(context, folderUri);

		// Get current columns from cards and merge with persisted
		const discoveredColumns = [...new Set(cards.map((c) => c.status))];
		const allColumns = persistedColumns
			? [...new Set([...persistedColumns, ...discoveredColumns])]
			: discoveredColumns;

		// Persist the merged column list (so empty columns are kept)
		await writePersistedColumns(context, folderUri, allColumns);

		const payload = withColumnOrder(
			toBoardPayload(cards, folderUri, allColumns, deletedColumns),
			await readColumnOrder(context, folderUri)
		);
		panel.webview.postMessage({ type: 'refresh', payload });
	};

	const initialCards = await loadCards(folderUri);
	const deletedColumns = await readDeletedColumns(context, folderUri);
	const persistedColumns = await readPersistedColumns(context, folderUri);

	// Get current columns from cards and merge with persisted
	const initialDiscoveredColumns = [...new Set(initialCards.map((c) => c.status))];
	const initialAllColumns = persistedColumns
		? [...new Set([...persistedColumns, ...initialDiscoveredColumns])]
		: initialDiscoveredColumns;

	// Persist the merged column list
	await writePersistedColumns(context, folderUri, initialAllColumns);

	panel.webview.html = getWebviewHtml(
		panel.webview,
		withColumnOrder(
			toBoardPayload(initialCards, folderUri, initialAllColumns, deletedColumns),
			await readColumnOrder(context, folderUri)
		),
		webviewScriptUri,
		webviewStyleUri
	);

	const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folderUri, '*.md'));
	const refreshOnFsChange = () => {
		void refresh();
	};

	watcher.onDidCreate(refreshOnFsChange);
	watcher.onDidChange(refreshOnFsChange);
	watcher.onDidDelete(refreshOnFsChange);

	context.subscriptions.push(watcher);
	panel.onDidDispose(() => watcher.dispose());

	panel.webview.onDidReceiveMessage(async (message: WebviewToHostMessage) => {
		if (message.type === 'moveCard') {
			await updateCardStatus(message.id, message.status);
			await refresh();
			return;
		}

		if (message.type === 'openCard') {
			if (!previewColumn) {
				const panelColumn = panel.viewColumn;
				previewColumn = panelColumn ? ((panelColumn + 1) as vscode.ViewColumn) : vscode.ViewColumn.Beside;
			}

			const fileUri = vscode.Uri.file(message.id);
			await vscode.commands.executeCommand('vscode.openWith', fileUri, 'vscode.markdown.preview.editor', {
				viewColumn: previewColumn,
				preview: true,
				preserveFocus: true,
			});
		}

		if (message.type === 'editCard') {
			const fileUri = vscode.Uri.file(message.id);
			const document = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(document, {
				viewColumn: vscode.ViewColumn.Beside,
				preview: true,
			});
			return;
		}

		if (message.type === 'createCard') {
			const columnStatus = message.status?.trim() || DEFAULT_STATUS;

			const title = await vscode.window.showInputBox({
				title: 'Create Card',
				prompt: 'Enter a title for the new card.',
				placeHolder: 'Card title',
				ignoreFocusOut: true,
				validateInput: (value) => (value.trim().length > 0 ? null : 'Title is required.'),
			});
			if (!title) {
				return;
			}

			const predefinedStatuses = ['Todo', 'Doing', 'Done'];
			const quickPickItems: (vscode.QuickPickItem & { status?: string; isCustom?: boolean })[] = [
				...predefinedStatuses
					.filter((s) => s !== columnStatus)
					.map((s) => ({ label: s, status: s })),
				{ label: columnStatus, status: columnStatus, description: '(current column)' },
				{ label: '$(add) Create new status', isCustom: true },
			];

			const selected = await vscode.window.showQuickPick(quickPickItems, {
				title: 'Select Status',
				placeHolder: 'Choose a status for the new card',
				ignoreFocusOut: true,
			});

			if (!selected) {
				return;
			}

			let status: string;
			if (selected.isCustom) {
				const customStatus = await vscode.window.showInputBox({
					title: 'Create New Status',
					prompt: 'Enter a custom status name.',
					placeHolder: 'Status name',
					ignoreFocusOut: true,
					validateInput: (value) => (value.trim().length > 0 ? null : 'Status is required.'),
				});
				if (!customStatus) {
					return;
				}
				status = customStatus.trim();
			} else {
				status = selected.status!;
			}

			const normalizedTitle = title.trim();
			const fileName = await buildUniqueFileName(folderUri, normalizedTitle);
			const fileUri = vscode.Uri.joinPath(folderUri, fileName);
			const template = `---\ntitle: ${JSON.stringify(normalizedTitle)}\nstatus: ${JSON.stringify(status)}\n---\n\n`;

			await vscode.workspace.fs.writeFile(fileUri, Buffer.from(template, 'utf8'));

			const document = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(document, {
				viewColumn: vscode.ViewColumn.Beside,
				preview: false,
			});

			await refresh();
			return;
		}

		if (message.type === 'deleteCard') {
			const fileUri = vscode.Uri.file(message.id);
			const fileName = path.basename(fileUri.fsPath);
			const action = await vscode.window.showWarningMessage(`Delete "${fileName}"?`, { modal: true }, 'Delete');
			if (action !== 'Delete') {
				return;
			}

			await vscode.workspace.fs.delete(fileUri, { useTrash: true });
			await refresh();
		}

		if (message.type === 'reorderColumns') {
			const cards = await loadCards(folderUri);
			const deletedColumns = await readDeletedColumns(context, folderUri);
			const persistedColumns = await readPersistedColumns(context, folderUri);
			const currentColumns = toBoardPayload(cards, folderUri, persistedColumns, deletedColumns).columns;
			const nextOrder = normalizeColumnOrder(message.columns, currentColumns);
			await writeColumnOrder(context, folderUri, nextOrder);
			await refresh();
		}

		if (message.type === 'deleteColumn') {
			const statusToDelete = message.status;
			if (statusToDelete === DEFAULT_STATUS) {
				void vscode.window.showErrorMessage('The Inbox column cannot be deleted.');
				return;
			}

			const cards = await loadCards(folderUri);
			const cardsInColumn = cards.filter((card) => card.status === statusToDelete);
			if (cardsInColumn.length > 0) {
				void vscode.window.showWarningMessage(
					`Cannot delete "${statusToDelete}" column because it contains ${cardsInColumn.length} card(s). Move or delete the cards first.`
				);
				return;
			}

			await removeColumnFromOrder(context, folderUri, statusToDelete);
			await refresh();
		}
	});
}

async function writeColumnOrder(
	context: vscode.ExtensionContext,
	folderUri: vscode.Uri,
	columns: string[]
): Promise<void> {
	await context.workspaceState.update(getColumnOrderKey(folderUri), columns);
}

async function removeColumnFromOrder(
	context: vscode.ExtensionContext,
	folderUri: vscode.Uri,
	statusToRemove: string
): Promise<void> {
	const currentOrder = await readColumnOrder(context, folderUri);
	if (currentOrder) {
		const newOrder = currentOrder.filter((s) => s !== statusToRemove);
		await writeColumnOrder(context, folderUri, newOrder);
	}

	const deletedKey = getDeletedColumnsKey(folderUri);
	const deleted = context.workspaceState.get<string[]>(deletedKey) ?? [];
	if (!deleted.includes(statusToRemove)) {
		await context.workspaceState.update(deletedKey, [...deleted, statusToRemove]);
	}

	const persistedKey = getPersistedColumnsKey(folderUri);
	const persisted = context.workspaceState.get<string[]>(persistedKey) ?? [];
	const newPersisted = persisted.filter((s) => s !== statusToRemove);
	if (newPersisted.length !== persisted.length) {
		await context.workspaceState.update(persistedKey, newPersisted);
	}
}

async function writePersistedColumns(
	context: vscode.ExtensionContext,
	folderUri: vscode.Uri,
	columns: string[]
): Promise<void> {
	await context.workspaceState.update(getPersistedColumnsKey(folderUri), columns);
}

function withColumnOrder(payload: ReturnType<typeof toBoardPayload>, savedOrder: string[] | undefined) {
	return {
		...payload,
		columns: normalizeColumnOrder(savedOrder ?? payload.columns, payload.columns),
	};
}

function normalizeColumnOrder(candidateOrder: string[], discoveredColumns: string[]): string[] {
	const dedupedCandidate = dedupe(candidateOrder);
	const dedupedDiscovered = dedupe(discoveredColumns);
	const discoveredSet = new Set(dedupedDiscovered);
	const merged = dedupedCandidate.filter((status) => discoveredSet.has(status));

	for (const status of dedupedDiscovered) {
		if (!merged.includes(status)) {
			merged.push(status);
		}
	}

	const withoutDefault = merged.filter((status) => status !== DEFAULT_STATUS);
	return [DEFAULT_STATUS, ...withoutDefault];
}

function dedupe(values: string[]): string[] {
	const result: string[] = [];
	for (const value of values) {
		if (!result.includes(value)) {
			result.push(value);
		}
	}
	return result;
}

async function buildUniqueFileName(folderUri: vscode.Uri, title: string): Promise<string> {
	const normalized = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	const prefix = normalized.length > 0 ? normalized : 'untitled';

	for (let index = 1; index <= 9999; index += 1) {
		const suffix = index === 1 ? '' : `-${index}`;
		const fileName = `${prefix}${suffix}.md`;
		const fileUri = vscode.Uri.joinPath(folderUri, fileName);
		try {
			await vscode.workspace.fs.stat(fileUri);
		} catch {
			return fileName;
		}
	}

	return `${prefix}-${Date.now()}.md`;
}
