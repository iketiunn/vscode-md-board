import * as vscode from 'vscode';
import { DEFAULT_STATUS } from '../constants';
import { BoardPayload } from '../types';

export function getWebviewHtml(webview: vscode.Webview, payload: BoardPayload): string {
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
        <h1 id="board-title" class="text-2xl font-semibold md:text-3xl"></h1>
      </div>
      <p id="folder-path" class="max-w-[50vw] truncate text-xs text-zinc-500"></p>
    </header>
    <main id="board" class="flex gap-4 overflow-x-auto pb-2"></main>
  </div>

  <template id="column-template">
    <section class="flex min-h-[420px] min-w-[320px] max-w-[320px] flex-col rounded-2xl border border-zinc-300 bg-white shadow-sm">
      <header class="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 class="status-name text-sm font-semibold"></h2>
        <span class="count rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium"></span>
      </header>
      <div class="drop-zone flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"></div>
    </section>
  </template>

  <template id="card-template">
    <article class="card cursor-pointer rounded-xl border border-zinc-300 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div class="mb-1 flex items-start justify-between gap-2">
        <p class="title line-clamp-2 text-sm font-medium"></p>
        <span class="drag-handle inline-flex h-7 w-7 shrink-0 cursor-move items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100" draggable="true" title="Drag to move" aria-label="Drag card">⋮⋮</span>
      </div>
      <p class="summary mt-1 line-clamp-3 text-xs text-zinc-700"></p>
    </article>
  </template>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const defaultStatus = ${JSON.stringify(DEFAULT_STATUS)};
    const state = ${serialized};

    const boardEl = document.getElementById('board');
    const boardTitleEl = document.getElementById('board-title');
    const folderPathEl = document.getElementById('folder-path');
    const columnTemplate = document.getElementById('column-template');
    const cardTemplate = document.getElementById('card-template');

    function render() {
      boardTitleEl.textContent = state.folderName;
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
          const dragHandle = cardNode.querySelector('.drag-handle');
          const summaryEl = cardNode.querySelector('.summary');
          if (card.summary) {
            summaryEl.textContent = card.summary;
          } else {
            summaryEl.remove();
          }

          dragHandle.addEventListener('dragstart', (event) => {
            event.dataTransfer.setData('text/plain', card.id);
            event.dataTransfer.effectAllowed = 'move';
            cardNode.classList.add('opacity-60');
            cardNode.dataset.dragging = 'true';
          });

          dragHandle.addEventListener('dragend', () => {
            cardNode.classList.remove('opacity-60');
            setTimeout(() => {
              delete cardNode.dataset.dragging;
            }, 0);
          });

          dragHandle.addEventListener('click', (event) => {
            event.stopPropagation();
          });

          cardNode.addEventListener('click', () => {
            if (cardNode.dataset.dragging === 'true') {
              return;
            }

            vscode.postMessage({ type: 'openCard', id: card.id });
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
      state.folderName = message.payload.folderName;
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
