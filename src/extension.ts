import * as path from 'node:path';
import matter from 'gray-matter';
import * as vscode from 'vscode';

type Card = {
	id: string;
	title: string;
	status: string;
	filePath: string;
	assetPath: string;
	body: string;
};

type WebviewCard = {
	id: string;
	title: string;
	status: string;
	filePath: string;
	assetPath: string;
	previewImages: string[];
};

type BoardPayload = {
	folderPath: string;
	columns: string[];
	cards: WebviewCard[];
};

const COMMAND_ID = 'extension.openFolderAsKanban';
const DEFAULT_STATUS = 'Inbox 📥';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand(COMMAND_ID, async (resource?: vscode.Uri) => {
		const folderUri = await resolveFolderUri(resource);
		if (!folderUri) {
			return;
		}

		await openFolderAsKanban(context, folderUri);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

async function resolveFolderUri(resource?: vscode.Uri): Promise<vscode.Uri | undefined> {
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

async function openFolderAsKanban(context: vscode.ExtensionContext, folderUri: vscode.Uri): Promise<void> {
	const folderName = path.basename(folderUri.fsPath);
	const panel = vscode.window.createWebviewPanel(
		'mdBoardKanban',
		`Kanban: ${folderName}`,
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			localResourceRoots: [folderUri],
		}
	);

	const refresh = async () => {
		const cards = await loadCards(folderUri);
		const payload = toBoardPayload(cards, panel.webview, folderUri);
		panel.webview.postMessage({ type: 'refresh', payload });
	};

	const initialCards = await loadCards(folderUri);
	panel.webview.html = getWebviewHtml(panel.webview, toBoardPayload(initialCards, panel.webview, folderUri));

	const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folderUri, '*.md'));
	const refreshOnFsChange = () => {
		void refresh();
	};

	watcher.onDidCreate(refreshOnFsChange);
	watcher.onDidChange(refreshOnFsChange);
	watcher.onDidDelete(refreshOnFsChange);

	context.subscriptions.push(watcher);
	panel.onDidDispose(() => watcher.dispose());

	panel.webview.onDidReceiveMessage(async (message: { type?: string; id?: string; status?: string }) => {
		if (message.type !== 'moveCard' || !message.id || typeof message.status !== 'string') {
			return;
		}

		await updateCardStatus(message.id, message.status);
		await refresh();
	});
}

async function loadCards(folderUri: vscode.Uri): Promise<Card[]> {
	const entries = await vscode.workspace.fs.readDirectory(folderUri);
	const mdEntries = entries.filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.md'));

	const cards = await Promise.all(
		mdEntries.map(async ([name]) => {
			const fileUri = vscode.Uri.joinPath(folderUri, name);
			const bytes = await vscode.workspace.fs.readFile(fileUri);
			const raw = Buffer.from(bytes).toString('utf8');
			const parsed = matter(raw);

			const title = normalizeTitle(parsed.data.title, name);
			const status = normalizeStatus(parsed.data.status);

			return {
				id: fileUri.fsPath,
				title,
				status,
				filePath: fileUri.fsPath,
				assetPath: path.dirname(fileUri.fsPath),
				body: raw,
			} satisfies Card;
		})
	);

	cards.sort((a, b) => a.title.localeCompare(b.title));
	return cards;
}

function normalizeTitle(value: unknown, fallbackFileName: string): string {
	if (typeof value === 'string' && value.trim().length > 0) {
		return value.trim();
	}

	return path.basename(fallbackFileName, path.extname(fallbackFileName));
}

function normalizeStatus(value: unknown): string {
	if (typeof value !== 'string') {
		return DEFAULT_STATUS;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? DEFAULT_STATUS : trimmed;
}

function toBoardPayload(cards: Card[], webview: vscode.Webview, folderUri: vscode.Uri): BoardPayload {
	const columns = uniqueColumns(cards.map((card) => card.status));
	if (!columns.includes(DEFAULT_STATUS)) {
		columns.unshift(DEFAULT_STATUS);
	}

	const webCards = cards.map((card) => ({
		id: card.id,
		title: card.title,
		status: card.status,
		filePath: card.filePath,
		assetPath: card.assetPath,
		previewImages: resolveImageUris(card.body, card.filePath, folderUri, webview),
	}));

	return {
		folderPath: folderUri.fsPath,
		columns,
		cards: webCards,
	};
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

function resolveImageUris(
	rawMarkdown: string,
	filePath: string,
	folderUri: vscode.Uri,
	webview: vscode.Webview
): string[] {
	const images: string[] = [];
	const imagePattern = /!\[[^\]]*\]\(([^)]+)\)/g;

	for (const match of rawMarkdown.matchAll(imagePattern)) {
		const rawTarget = stripImageTitle(match[1]);
		if (!rawTarget) {
			continue;
		}

		if (/^https?:\/\//i.test(rawTarget)) {
			images.push(rawTarget);
			continue;
		}

		const relative = rawTarget.replace(/^<|>$/g, '');
		const decoded = decodeSafe(relative);
		const normalizedPath = decoded.replace(/\\/g, '/');
		const absolutePath = normalizedPath.startsWith('/')
			? path.join(folderUri.fsPath, normalizedPath)
			: path.resolve(path.dirname(filePath), normalizedPath);
		const uri = vscode.Uri.file(absolutePath);
		images.push(webview.asWebviewUri(uri).toString());
	}

	return images;
}

function stripImageTitle(raw: string): string {
	const trimmed = raw.trim();
	const match = trimmed.match(/^([^\s]+)(?:\s+"[^"]*")?$/);
	return match ? match[1] : trimmed;
}

function decodeSafe(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

async function updateCardStatus(filePath: string, nextStatus: string): Promise<void> {
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

function getWebviewHtml(webview: vscode.Webview, payload: BoardPayload): string {
	const nonce = getNonce();
	const serialized = JSON.stringify(payload).replace(/</g, '\\u003c');

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https:; script-src 'nonce-${nonce}' https://cdn.tailwindcss.com;" />
  <script nonce="${nonce}" src="https://cdn.tailwindcss.com"></script>
  <title>Markdown Kanban</title>
</head>
<body class="bg-zinc-100 text-zinc-900 antialiased">
  <div class="min-h-screen p-5 md:p-7">
    <header class="mb-5 flex items-end justify-between gap-4 border-b border-zinc-300 pb-4">
      <div>
        <p class="text-xs uppercase tracking-[0.28em] text-zinc-500">Markdown Board</p>
        <h1 class="text-2xl font-semibold md:text-3xl">Folder Kanban</h1>
      </div>
      <p id="folder-path" class="max-w-[50vw] truncate text-xs text-zinc-500"></p>
    </header>
    <main id="board" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4"></main>
  </div>

  <template id="column-template">
    <section class="flex min-h-[420px] flex-col rounded-2xl border border-zinc-300 bg-white shadow-sm">
      <header class="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 class="status-name text-sm font-semibold"></h2>
        <span class="count rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium"></span>
      </header>
      <div class="drop-zone flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"></div>
    </section>
  </template>

  <template id="card-template">
    <article class="card cursor-grab rounded-xl border border-zinc-300 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing" draggable="true">
      <p class="title line-clamp-2 text-sm font-medium"></p>
      <p class="file line-clamp-1 text-xs text-zinc-500"></p>
      <div class="images mt-2 flex flex-col gap-2"></div>
    </article>
  </template>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const defaultStatus = ${JSON.stringify(DEFAULT_STATUS)};
    const state = ${serialized};

    const boardEl = document.getElementById('board');
    const folderPathEl = document.getElementById('folder-path');
    const columnTemplate = document.getElementById('column-template');
    const cardTemplate = document.getElementById('card-template');

    function render() {
      folderPathEl.textContent = state.folderPath;
      boardEl.innerHTML = '';

      const columns = [...new Set(state.columns.concat(state.cards.map((card) => card.status)))];
      columns.forEach((status) => {
        const columnNode = columnTemplate.content.firstElementChild.cloneNode(true);
        const isInbox = status === defaultStatus;
        if (isInbox) {
          columnNode.classList.add('bg-zinc-200/50');
        }

        columnNode.querySelector('.status-name').textContent = status;
        const dropZone = columnNode.querySelector('.drop-zone');
        const cards = state.cards.filter((card) => card.status === status);
        columnNode.querySelector('.count').textContent = String(cards.length);

        dropZone.dataset.status = status;
        bindDropZone(dropZone);

        cards.forEach((card) => {
          const cardNode = cardTemplate.content.firstElementChild.cloneNode(true);
          cardNode.dataset.cardId = card.id;
          cardNode.dataset.status = card.status;
          cardNode.querySelector('.title').textContent = card.title;
          cardNode.querySelector('.file').textContent = card.filePath;

          const imageHolder = cardNode.querySelector('.images');
          const preview = card.previewImages.slice(0, 1);
          preview.forEach((src) => {
            const image = document.createElement('img');
            image.src = src;
            image.className = 'max-h-32 w-full rounded-md border border-zinc-200 object-cover';
            image.loading = 'lazy';
            imageHolder.appendChild(image);
          });

          cardNode.addEventListener('dragstart', (event) => {
            event.dataTransfer.setData('text/plain', card.id);
            event.dataTransfer.effectAllowed = 'move';
            cardNode.classList.add('opacity-60');
          });

          cardNode.addEventListener('dragend', () => {
            cardNode.classList.remove('opacity-60');
          });

          dropZone.appendChild(cardNode);
        });

        boardEl.appendChild(columnNode);
      });
    }

    function bindDropZone(dropZone) {
      dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropZone.classList.add('ring-2', 'ring-zinc-400');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('ring-2', 'ring-zinc-400');
      });

      dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropZone.classList.remove('ring-2', 'ring-zinc-400');

        const cardId = event.dataTransfer.getData('text/plain');
        if (!cardId) {
          return;
        }

        const card = state.cards.find((item) => item.id === cardId);
        const nextStatus = dropZone.dataset.status;
        if (!card || !nextStatus || card.status === nextStatus) {
          return;
        }

        card.status = nextStatus;
        if (!state.columns.includes(nextStatus)) {
          state.columns.push(nextStatus);
        }

        render();
        vscode.postMessage({ type: 'moveCard', id: cardId, status: nextStatus });
      });
    }

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message?.type !== 'refresh') {
        return;
      }

      state.folderPath = message.payload.folderPath;
      state.columns = message.payload.columns;
      state.cards = message.payload.cards;
      render();
    });

    render();
  </script>
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
