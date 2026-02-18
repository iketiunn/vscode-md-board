import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Command Contributions', () => {
	test('registers open-folder-as-kanban command', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('extension.openFolderAsKanban'));
	});
});
