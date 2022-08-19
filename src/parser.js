import * as fs from 'fs';
import * as luxon from 'luxon';
import * as xml2js from 'xml2js';
import { decode } from 'html-entities';

import { getFilenameFromUrl } from './shared.js';
import settings from './settings.js';
import { createTurndownTransformService, parseMarkwondContent } from './translator.js';

async function parseFilePromise(config) {
	console.log('\nParsing...');
	const content = await fs.promises.readFile(config.input, 'utf8');
	const data = await xml2js.parseStringPromise(content, {
		trim: true,
		tagNameProcessors: [xml2js.processors.stripPrefix]
	});

	const postTypes = getPostTypes(data, config);
	const posts = collectPosts(data, postTypes, config);
	const authors = collectAuthors(data, config);

	const images = [];
	if (config.saveAttachedImages) {
		images.push(...collectAttachedImages(data));
	}
	if (config.saveScrapedImages) {
		images.push(...collectScrapedImages(data, postTypes));
	}

	mergeImagesIntoPosts(images, posts);

	return [posts, authors];
}

function getPostTypes(data, config) {
	if (config.includeOtherTypes) {
		// search export file for all post types minus some default types we don't want
		// effectively this will be 'post', 'page', and custom post types
		const types = data.rss.channel[0].item
			.map(item => item.post_type[0])
			.filter(type => !['attachment', 'revision', 'nav_menu_item', 'custom_css', 'customize_changeset'].includes(type));
		return [...new Set(types)]; // remove duplicates
	} else {
		// just plain old vanilla "post" posts
		return ['post'];
	}
}

function getItemsOfType(data, type) {
	return data.rss.channel[0].item.filter(item => item.post_type[0] === type);
}

function collectPosts(data, postTypes, config) {
	const transformService = createTurndownTransformService();

	let allPosts = [];
	postTypes.forEach(postType => {
		const postsForType = getItemsOfType(data, postType)
			.filter(post => post.status[0] !== 'trash' && post.status[0] !== 'draft')
			.map(post => ({
				frontmatter: {
					id: getPostId(post),
					slug: getPostSlug(post),
					title: getPostTitle(post),
					date: getPostDate(post),
					type: postType,
					category: getCategory(post),
					tags: getTags(post),
					author: getAuthor(post),
					coverImageId: getPostCoverImageId(post),
					imageUrls: [],
					excerpt: parseMarkwondContent(post.encoded[1], content => transformService.turndown(content), config),
				},
				content: parseMarkwondContent(post.encoded[0], content => transformService.turndown(content), config)
			}));

		if (postTypes.length > 1) {
			console.log(`${postsForType.length} "${postType}" posts found.`);
		}

		allPosts.push(...postsForType);
	});

	if (postTypes.length === 1) {
		console.log(allPosts.length + ' posts found.');
	}
	return allPosts;
}

function collectAuthors(data, config) {
	return data.rss.channel[0].author.map(author => ({
		login: author.author_login[0],
		firstName: author.author_first_name[0],
		lastName: author.author_last_name[0],
		email: author.author_email[0],
	}));
} 

function getPostId(post) {
	return post.post_id[0];
}

function getPostSlug(post) {
	return decodeURIComponent(post.post_name[0]);
}

function getPostCoverImageId(post) {
	if (post.postmeta === undefined) {
		return undefined;
	}

	const postmeta = post.postmeta.find(postmeta => postmeta.meta_key[0] === '_thumbnail_id');
	const id = postmeta ? postmeta.meta_value[0] : undefined;
	return id;
}

function getPostTitle(post) {
	return decode(post.title[0]);
}

function getPostDate(post) {
	const dateTime = luxon.DateTime.fromRFC2822(post.pubDate[0], { zone: 'utc' });

	if (settings.custom_date_formatting) {
		return dateTime.toFormat(settings.custom_date_formatting);
	} else if (settings.include_time_with_date) {
		return dateTime.toISO();
	} else {
		return dateTime.toISODate();
	}
}

function getCategory(post) {
	const categories = processCategoryTags(post, 'category');
	return categories.filter(category => !settings.filter_categories.includes(category))[0];
}

function getTags(post) {
	return processCategoryTags(post, 'post_tag');
}

function getAuthor(post) {
	return processCategoryTagValues(post, 'author')[0];
}

function processCategoryTags(post, domain) {
	if (!post.category) {
		return [];
	}

	return post.category
		.filter(category => category.$.domain === domain)
		.map(({ $: attributes }) => decodeURIComponent(attributes.nicename));
}

function processCategoryTagValues(post, domain) {
	if (!post.category) {
		return [];
	}

	return post.category
		.filter(category => category.$.domain === domain)
		.map(({_}) => _);
}

function collectAttachedImages(data) {
	const images = getItemsOfType(data, 'attachment')
		// filter to certain image file types
		.filter(attachment => (/\.(gif|jpe?g|png)$/i).test(attachment.attachment_url[0]))
		.map(attachment => ({
			id: attachment.post_id[0],
			postId: attachment.post_parent[0],
			url: attachment.attachment_url[0]
		}));

	console.log(images.length + ' attached images found.');
	return images;
}

function collectScrapedImages(data, postTypes) {
	const images = [];
	postTypes.forEach(postType => {
		getItemsOfType(data, postType).forEach(post => {
			const postId = post.post_id[0];
			const postContent = post.encoded[0];
			const postLink = post.link[0];

			const matches = [...postContent.matchAll(/<img[^>]*src="(.+?\.(?:gif|jpe?g|png))"[^>]*>/gi)];
			matches.forEach(match => {
				// base the matched image URL relative to the post URL
				const url = new URL(match[1], postLink).href;
				images.push({
					id: -1,
					postId: postId,
					url
				});
			});
		});
	});

	console.log(images.length + ' images scraped from post body content.');
	return images;
}

function mergeImagesIntoPosts(images, posts) {
	images.forEach(image => {
		posts.forEach(post => {
			let shouldAttach = false;

			// this image was uploaded as an attachment to this post
			if (image.postId === post.frontmatter.id) {
				shouldAttach = true;
			}

			// this image was set as the featured image for this post
			if (image.id === post.frontmatter.coverImageId) {
				shouldAttach = true;
				post.frontmatter.coverImage = getFilenameFromUrl(image.url);
			}

			if (shouldAttach && !post.frontmatter.imageUrls.includes(image.url)) {
				post.frontmatter.imageUrls.push(image.url);
			}
		});
	});
}

export { parseFilePromise };