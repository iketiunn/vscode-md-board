import * as path from 'node:path';
import * as vscode from 'vscode';
import { PANEL_VIEW_TYPE } from './constants';
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
		const payload = toBoardPayload(cards, folderUri);
		panel.webview.postMessage({ type: 'refresh', payload });
	};

	const initialCards = await loadCards(folderUri);
	panel.webview.html = getWebviewHtml(
		panel.webview,
		toBoardPayload(initialCards, folderUri),
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
		}
	});
}
