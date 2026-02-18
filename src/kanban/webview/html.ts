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
  <style>
    html, body {
      height: 100%;
      overflow: hidden;
    }

    body.dragging, body.dragging * {
      cursor: grabbing !important;
    }

    #board {
      scrollbar-gutter: stable both-edges;
      scrollbar-width: thin;
      scrollbar-color: #a1a1aa #e4e4e7;
    }

    #board::-webkit-scrollbar {
      height: 11px;
    }

    #board::-webkit-scrollbar-track {
      background: #e4e4e7;
      border-radius: 9999px;
    }

    #board::-webkit-scrollbar-thumb {
      background: #a1a1aa;
      border-radius: 9999px;
    }

    .drop-zone {
      scrollbar-width: thin;
      scrollbar-color: #b4b4bb #f4f4f5;
    }

    .drop-zone::-webkit-scrollbar {
      width: 9px;
    }

    .drop-zone::-webkit-scrollbar-track {
      background: #f4f4f5;
      border-radius: 9999px;
    }

    .drop-zone::-webkit-scrollbar-thumb {
      background: #b4b4bb;
      border-radius: 9999px;
    }
  </style>
  <title>Markdown Kanban</title>
</head>
<body class="h-screen bg-zinc-100 text-zinc-900 antialiased">
  <div class="flex h-screen flex-col p-5 md:p-7">
    <header class="mb-5 shrink-0 flex items-end justify-between gap-4 border-b border-zinc-300 pb-4">
      <div>
        <p class="text-xs uppercase tracking-[0.28em] text-zinc-500">Markdown Board</p>
        <h1 id="board-title" class="text-2xl font-semibold md:text-3xl"></h1>
      </div>
      <p id="folder-path" class="max-w-[50vw] truncate text-xs text-zinc-500"></p>
    </header>
    <main id="board" class="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-2 pr-2"></main>
  </div>

  <template id="column-template">
    <section class="flex h-full min-w-[320px] max-w-[320px] flex-col rounded-2xl border border-zinc-300 bg-white shadow-sm">
      <header class="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 class="status-name text-sm font-semibold"></h2>
        <span class="count rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium"></span>
      </header>
      <div class="drop-zone min-h-0 flex flex-1 flex-col gap-3 overflow-x-visible overflow-y-auto px-3 py-3"></div>
    </section>
  </template>

  <template id="card-template">
    <article class="card group relative z-0 cursor-pointer rounded-xl border border-zinc-300 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" draggable="true">
      <div class="mb-1 flex items-start justify-between gap-2">
        <p class="title line-clamp-2 pr-6 text-sm font-medium"></p>
        <button type="button" class="menu-trigger absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100 focus:opacity-100" aria-label="Move card">•••</button>
      </div>
      <div class="menu-panel absolute right-2 top-9 z-50 hidden min-w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg"></div>
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

    function getAllStatuses() {
      return [...new Set(state.columns.concat(state.cards.map((card) => card.status)))];
    }

    function closeAllMenus() {
      document.querySelectorAll('.menu-panel').forEach((menu) => {
        menu.classList.add('hidden');
        const card = menu.closest('.card');
        if (card) {
          card.classList.remove('z-30');
        }
      });
      document.querySelectorAll('.move-submenu').forEach((submenu) => {
        submenu.classList.add('hidden');
      });
    }

    function moveCard(cardId, nextStatus) {
      const card = state.cards.find((item) => item.id === cardId);
      if (!card || !nextStatus || card.status === nextStatus) {
        return;
      }

      card.status = nextStatus;
      if (!state.columns.includes(nextStatus)) {
        state.columns.push(nextStatus);
      }

      render();
      vscode.postMessage({ type: 'moveCard', id: cardId, status: nextStatus });
    }

    function render() {
      boardTitleEl.textContent = state.folderName;
      folderPathEl.textContent = state.folderPath;
      boardEl.innerHTML = '';

      const columns = getAllStatuses();
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
          const menuTrigger = cardNode.querySelector('.menu-trigger');
          const menuPanel = cardNode.querySelector('.menu-panel');
          const summaryEl = cardNode.querySelector('.summary');
          if (card.summary) {
            summaryEl.textContent = card.summary;
          } else {
            summaryEl.remove();
          }

          const availableStatuses = columns.filter((value) => value !== card.status);
          if (availableStatuses.length === 0) {
            menuTrigger.classList.add('hidden');
          } else {
            const editItem = document.createElement('button');
            editItem.type = 'button';
            editItem.className = 'flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100';
            editItem.textContent = 'Edit';
            editItem.addEventListener('click', (event) => {
              event.stopPropagation();
              closeAllMenus();
              vscode.postMessage({ type: 'editCard', id: card.id });
            });
            menuPanel.appendChild(editItem);

            const moveWrap = document.createElement('div');
            moveWrap.className = 'relative';

            const moveItem = document.createElement('button');
            moveItem.type = 'button';
            moveItem.className = 'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100';
            moveItem.innerHTML = '<span>Move</span><span>›</span>';
            moveWrap.appendChild(moveItem);

            const submenu = document.createElement('div');
            submenu.className = 'move-submenu mt-1 hidden rounded-md border border-zinc-200 bg-zinc-50 p-1';
            availableStatuses.forEach((targetStatus) => {
              const item = document.createElement('button');
              item.type = 'button';
              item.className = 'flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100';
              item.textContent = targetStatus;
              item.addEventListener('click', (event) => {
                event.stopPropagation();
                closeAllMenus();
                moveCard(card.id, targetStatus);
              });
              submenu.appendChild(item);
            });
            moveWrap.appendChild(submenu);

            moveItem.addEventListener('click', (event) => {
              event.stopPropagation();
            });

            moveWrap.addEventListener('mouseenter', () => {
              document.querySelectorAll('.move-submenu').forEach((panel) => panel.classList.add('hidden'));
              submenu.classList.remove('hidden');
            });

            moveWrap.addEventListener('mouseleave', () => {
              submenu.classList.add('hidden');
            });

            menuPanel.appendChild(moveWrap);

            menuTrigger.addEventListener('click', (event) => {
              event.stopPropagation();
              const isHidden = menuPanel.classList.contains('hidden');
              closeAllMenus();
              if (isHidden) {
                cardNode.classList.add('z-30');
                menuPanel.classList.remove('hidden');
              }
            });
          }

          cardNode.addEventListener('dragstart', (event) => {
            event.dataTransfer.setData('text/plain', card.id);
            event.dataTransfer.effectAllowed = 'move';
            cardNode.classList.add('opacity-60');
            cardNode.dataset.dragging = 'true';
            document.body.classList.add('dragging');
          });

          cardNode.addEventListener('dragend', () => {
            cardNode.classList.remove('opacity-60');
            document.body.classList.remove('dragging');
            setTimeout(() => {
              delete cardNode.dataset.dragging;
            }, 0);
          });

          cardNode.addEventListener('click', () => {
            if (cardNode.dataset.dragging === 'true') {
              return;
            }

            closeAllMenus();
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
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move';
        }
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

        const nextStatus = dropZone.dataset.status;
        if (!nextStatus) {
          return;
        }

        closeAllMenus();
        moveCard(cardId, nextStatus);
      });
    }

    document.addEventListener('click', () => {
      closeAllMenus();
    });

    boardEl.addEventListener('scroll', () => {
      closeAllMenus();
    }, { passive: true });

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
