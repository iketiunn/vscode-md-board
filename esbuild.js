const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',
	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				if (location) {
					console.error(`    ${location.file}:${location.line}:${location.column}:`);
				}
			});
			console.log('[watch] build finished');
		});
	},
};

const shared = {
	bundle: true,
	minify: production,
	sourcemap: !production,
	sourcesContent: false,
	logLevel: 'silent',
	plugins: [esbuildProblemMatcherPlugin],
};

const extensionBuild = {
	...shared,
	entryPoints: ['src/extension.ts'],
	format: 'cjs',
	platform: 'node',
	outfile: 'dist/extension.js',
	external: ['vscode'],
};

const webviewBuild = {
	...shared,
	entryPoints: ['src/kanban/webview/main.tsx'],
	format: 'iife',
	platform: 'browser',
	target: ['es2022'],
	outfile: 'dist/webview/app.js',
};

async function main() {
	const extensionCtx = await esbuild.context(extensionBuild);
	const webviewCtx = await esbuild.context(webviewBuild);

	if (watch) {
		await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
		return;
	}

	await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);	
	await Promise.all([extensionCtx.dispose(), webviewCtx.dispose()]);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
