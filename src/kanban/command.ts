import * as vscode from 'vscode';
import { COMMAND_ID } from './constants';
import { resolveFolderUri } from './folderPicker';
import { openFolderAsKanban } from './panel';

export function registerKanbanCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(COMMAND_ID, async (resource?: vscode.Uri) => {
		const folderUri = await resolveFolderUri(resource);
		if (!folderUri) {
			return;
		}

		await openFolderAsKanban(context, folderUri);
	});

	context.subscriptions.push(disposable);
}
