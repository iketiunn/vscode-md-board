import * as vscode from 'vscode';

export async function resolveFolderUri(resource?: vscode.Uri): Promise<vscode.Uri | undefined> {
	if (resource) {
		const stat = await vscode.workspace.fs.stat(resource);
		if (stat.type === vscode.FileType.Directory) {
			return resource;
		}
	}

	const selected = await vscode.window.showOpenDialog({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		openLabel: 'Open as Kanban',
	});

	return selected?.[0];
}
