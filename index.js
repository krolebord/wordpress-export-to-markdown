#!/usr/bin/env node

import compareVersions from 'compare-versions';
import path from 'path';
import process from 'process';

import { getConfig } from './src/wizard.js';
import { parseFilePromise } from './src/parser.js';
import { writeFilesPromise } from './src/writer.js';

(async () => {
	// Node version check
	const requiredVersion = '12.14.0';
	const currentVersion = process.versions.node;
	if (compareVersions(currentVersion, requiredVersion) === -1) {
		throw `This script requires Node v${requiredVersion} or higher, but you are using v${currentVersion}.`;
	}

	// parse any command line arguments and run wizard
	const config = await getConfig(process.argv);

	// parse data from XML and do Markdown translations
	const posts = await parseFilePromise(config)

	// write files, downloading images as needed
	await writeFilesPromise(posts, config);

	// happy goodbye
	console.log('\nAll done!');
	console.log('Look for your output files in: ' + path.resolve(config.output));
})().catch(ex => {
	// sad goodbye
	console.log('\nSomething went wrong, execution halted early.');
	console.error(ex);
});
