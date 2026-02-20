import * as path from 'node:path';
import * as vscode from 'vscode';
import { DEFAULT_STATUS, PANEL_VIEW_TYPE } from './constants';
import { loadCards, toBoardPayload } from './data';
import { updateCardStatus } from './markdownStatus';
import { WebviewToHostMessage } from './webview/protocol';
import { getWebviewHtml } from './webview/html';

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
		const payload = withColumnOrder(
			toBoardPayload(cards, folderUri),
			await readColumnOrder(context, folderUri)
		);
		panel.webview.postMessage({ type: 'refresh', payload });
	};

	const initialCards = await loadCards(folderUri);
	panel.webview.html = getWebviewHtml(
		panel.webview,
		withColumnOrder(
			toBoardPayload(initialCards, folderUri),
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
			const status = message.status?.trim() || DEFAULT_STATUS;
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
			const currentColumns = toBoardPayload(cards, folderUri).columns;
			const nextOrder = normalizeColumnOrder(message.columns, currentColumns);
			await writeColumnOrder(context, folderUri, nextOrder);
			await refresh();
		}
	});
}

function getColumnOrderKey(folderUri: vscode.Uri): string {
	return `mdBoard:columnOrder:${folderUri.fsPath}`;
}

async function readColumnOrder(context: vscode.ExtensionContext, folderUri: vscode.Uri): Promise<string[] | undefined> {
	const value = context.workspaceState.get<unknown>(getColumnOrderKey(folderUri));
	if (!Array.isArray(value)) {
		return undefined;
	}

	const normalized = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
	return normalized.length > 0 ? normalized : undefined;
}

async function writeColumnOrder(
	context: vscode.ExtensionContext,
	folderUri: vscode.Uri,
	columns: string[]
): Promise<void> {
	await context.workspaceState.update(getColumnOrderKey(folderUri), columns);
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
