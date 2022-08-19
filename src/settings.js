export default {
    // time in ms to wait between requesting image files
    // increase this if you see timeouts or server errors
    image_file_request_delay: 10,

    // time in ms to wait between saving Markdown files
    // increase this if your file system becomes overloaded
    markdown_file_write_delay: 5,

    // enable this to include time with post dates
    // for example, "2020-12-25" would become "2020-12-25T11:20:35.000Z"
    include_time_with_date: false,

    // override post date formatting with a custom formatting string (for example: 'yyyy LLL dd')
    // tokens are documented here: https://moment.github.io/luxon/docs/manual/formatting.html#table-of-tokens
    // if set, this takes precedence over include_time_with_date
    custom_date_formatting: '',

    // categories to be excluded from post frontmatter
    // this does not filter out posts themselves, just the categories listed in their frontmatter
    filter_categories: ['uncategorized'],

    category_ids: new Map([
        ['net', 1],
        ['js', 2],
        ['mobile', 3],
        ['process', 4],
        ['qa', 5],
        ['web', 6],
    ])
};