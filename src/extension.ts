import * as vscode from 'vscode';
import { registerKanbanCommand } from './kanban/command';

export function activate(context: vscode.ExtensionContext) {
	registerKanbanCommand(context);
}

export function deactivate() {}
