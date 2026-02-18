import * as vscode from 'vscode';
import { BoardPayload } from '../types';

export function getWebviewHtml(
	webview: vscode.Webview,
	payload: BoardPayload,
	scriptUri: vscode.Uri,
	styleUri: vscode.Uri
): string {
	const nonce = getNonce();
	const serialized = JSON.stringify(payload).replace(/</g, '\\u003c');
	const scriptSrc = webview.asWebviewUri(scriptUri);
	const styleSrc = webview.asWebviewUri(styleUri);

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${styleSrc}" />
  <title>Markdown Kanban</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}">window.__MD_BOARD_INITIAL_STATE__ = ${serialized};</script>
  <script src="${scriptSrc}"></script>
</body>
</html>`;
}

function getNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let value = '';
	for (let i = 0; i < 32; i++) {
		value += chars.charAt(Math.floor(Math.random() * chars.length));
	}

	return value;
}
