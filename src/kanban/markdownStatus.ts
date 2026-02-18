import matter from 'gray-matter';
import * as vscode from 'vscode';

export async function updateCardStatus(filePath: string, nextStatus: string): Promise<void> {
	const fileUri = vscode.Uri.file(filePath);
	const bytes = await vscode.workspace.fs.readFile(fileUri);
	const originalText = Buffer.from(bytes).toString('utf8');
	const parsed = matter(originalText);
	const body = extractBodyPreservingFormatting(originalText);
	const nextData = {
		...parsed.data,
		status: nextStatus,
	};

	const nextFrontmatter = matter.stringify('', nextData).trimEnd();
	const nextText = `${nextFrontmatter}\n${body}`;

	await vscode.workspace.fs.writeFile(fileUri, Buffer.from(nextText, 'utf8'));
}

function extractBodyPreservingFormatting(text: string): string {
	if (!text.startsWith('---')) {
		return text;
	}

	const lines = text.split(/\r?\n/);
	if (lines.length === 0 || lines[0].trim() !== '---') {
		return text;
	}

	let position = lines[0].length;
	const usesCrlf = text.includes('\r\n');
	const newlineLength = usesCrlf ? 2 : 1;
	position += newlineLength;

	for (let index = 1; index < lines.length; index++) {
		position += lines[index].length;
		if (lines[index].trim() === '---') {
			if (index < lines.length - 1) {
				position += newlineLength;
			}
			return text.slice(position);
		}

		if (index < lines.length - 1) {
			position += newlineLength;
		}
	}

	return text;
}
