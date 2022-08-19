import turndown from 'turndown';
import * as turndownPluginGfm from 'turndown-plugin-gfm';
import {encode,decode} from 'html-entities';
import {HTMLElement, parse} from 'node-html-parser';

function createTurndownTransformService() {
	const turndownService = new turndown({
		headingStyle: 'atx',
		codeBlockStyle: 'fenced'
	});

	turndownService.use(turndownPluginGfm.tables);

	// preserve embedded tweets
	turndownService.addRule('tweet', {
		filter: node => node.nodeName === 'BLOCKQUOTE' && node.getAttribute('class') === 'twitter-tweet',
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	// preserve embedded codepens
	turndownService.addRule('codepen', {
		filter: node => {
			// codepen embed snippets have changed over the years
			// but this series of checks should find the commonalities
			return (
				['P', 'DIV'].includes(node.nodeName) &&
				node.attributes['data-slug-hash'] &&
				node.getAttribute('class') === 'codepen'
			);
		},
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	// preserve embedded scripts (for tweets, codepens, gists, etc.)
	turndownService.addRule('script', {
		filter: 'script',
		replacement: (content, node) => {
			let before = '\n\n';
			if (node.previousSibling && node.previousSibling.nodeName !== '#text') {
				// keep twitter and codepen <script> tags snug with the element above them
				before = '\n';
			}
			const html = node.outerHTML.replace('async=""', 'async');
			return before + html + '\n\n';
		}
	});

	// preserve iframes (common for embedded audio/video)
	turndownService.addRule('iframe', {
		filter: 'iframe',
		replacement: (content, node) => {
			const html = node.outerHTML.replace('allowfullscreen=""', 'allowfullscreen');
			return '\n\n' + html + '\n\n';
		}
	});

	return turndownService;
}

function parseMarkwondContent(content, transform, config) {
	const root = parse(content);

	// add code tags to pre elements
	root.getElementsByTagName('pre').forEach(pre => {
		// remove existing code tags from innerHTML
		pre.innerHTML = pre.innerHTML.replace(/<code>/g, '').replace(/<\/code>/g, '');

		const codeNode = new HTMLElement('code', {}, '');
		codeNode.innerHTML = pre.innerHTML;
		pre.innerHTML = '';
		pre.appendChild(codeNode);
	});

	// encode all html inside <code> tags
	root.querySelectorAll('code').forEach(code => {
		code.innerHTML = encode(decode(code.innerHTML));
	});

	content = root.toString();

	if (config.saveScrapedImages) {
		// writeImageFile() will save all content images to a relative /images
		// folder so update references in post content to match
		content = content.replace(/(<img[^>]*src=").*?([^/"]+\.(?:gif|jpe?g|png))("[^>]*>)/gi, '$1images/$2$3');
	}

	// this is a hack to make <iframe> nodes non-empty by inserting a "." which
	// allows the iframe rule declared in initTurndownService() to take effect
	// (using turndown's blankRule() and keep() solution did not work for me)
	content = content.replace(/(<\/iframe>)/gi, '.$1');

	// use turndown to convert HTML to Markdown
	content = transform(content);

	// decode all html inside markdown ``` code blocks
	content = content.replace(/```\n*?((.|\n)+?)\n*?```/gi, (match, code) => `\`\`\`${decode(code)}\n\`\`\``);

	// clean up extra spaces in list items
	content = content.replace(/(-|\d+\.) +/g, '$1 ');

	// clean up the "." from the iframe hack above
	content = content.replace(/\.(<\/iframe>)/gi, '$1');

	return content;
}

export { createTurndownTransformService, parseMarkwondContent };