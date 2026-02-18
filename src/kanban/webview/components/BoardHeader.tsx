import type { BoardPayload } from '../../types';

type BoardHeaderProps = {
	folderName: BoardPayload['folderName'];
	folderPath: BoardPayload['folderPath'];
};

export function BoardHeader({ folderName, folderPath }: BoardHeaderProps) {
	return (
		<header class="board-header">
			<div>
				<p class="eyebrow">Markdown Board</p>
				<h1 class="board-title">{folderName}</h1>
			</div>
			<p class="folder-path">{folderPath}</p>
		</header>
	);
}
