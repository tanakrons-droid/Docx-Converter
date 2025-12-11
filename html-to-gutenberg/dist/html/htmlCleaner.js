/**
 * HTML Cleaner
 * Cleans and normalizes HTML from Google Docs/Word exports
 */
import * as cheerio from 'cheerio';
const defaultOptions = {
    removeTags: [
        'script', 'style', 'meta', 'link', 'title', 'head',
        'o:p', 'xml', 'w:sdt', 'w:sdtpr', 'w:sdtcontent'
    ],
    unwrapTags: ['font', 'o:p'],
    removeEmptyParagraphs: true,
    removeEmptySpans: true,
    mergeNestedSpans: true,
    removeComments: true,
    removeDataAttributes: true,
    removeIds: false
};
/**
 * Clean HTML content
 * @param html - Input HTML string
 * @param options - Cleaner options
 * @returns Cleaned HTML string
 */
export function cleanHTML(html, options = {}) {
    const opts = { ...defaultOptions, ...options };
    const $ = cheerio.load(html);
    // Remove specified tags completely
    if (opts.removeTags) {
        for (const tag of opts.removeTags) {
            $(tag).remove();
        }
    }
    // Unwrap specified tags (keep content)
    if (opts.unwrapTags) {
        for (const tag of opts.unwrapTags) {
            $(tag).each((_, el) => {
                $(el).replaceWith($(el).contents());
            });
        }
    }
    // Remove comments
    if (opts.removeComments) {
        $('*').contents().each((_, node) => {
            if (node.type === 'comment') {
                $(node).remove();
            }
        });
    }
    // Remove data-* attributes
    if (opts.removeDataAttributes) {
        $('*').each((_, el) => {
            const element = $(el);
            const attribs = el.attribs || {};
            for (const attr of Object.keys(attribs)) {
                if (attr.startsWith('data-')) {
                    element.removeAttr(attr);
                }
            }
        });
    }
    // Remove id attributes
    if (opts.removeIds) {
        $('[id]').removeAttr('id');
    }
    // Remove empty spans
    if (opts.removeEmptySpans) {
        removeEmptyElements($, 'span');
    }
    // Merge nested spans
    if (opts.mergeNestedSpans) {
        mergeNestedSpans($);
    }
    // Remove empty paragraphs
    if (opts.removeEmptyParagraphs) {
        removeEmptyElements($, 'p');
    }
    // Clean up whitespace in text nodes
    normalizeWhitespace($);
    // Extract body content if present
    const body = $('body');
    if (body.length > 0) {
        return body.html() || '';
    }
    return $.html();
}
/**
 * Remove empty elements of a specific type
 */
function removeEmptyElements($, selector) {
    let changed = true;
    // Keep removing until no more changes (handles nested empty elements)
    while (changed) {
        changed = false;
        $(selector).each((_, el) => {
            const element = $(el);
            const content = element.html()?.trim() || '';
            const text = element.text().trim();
            // Check if element is empty or contains only whitespace/nbsp
            if (!text && (!content || content === '&nbsp;' || content.match(/^(\s|&nbsp;)*$/))) {
                element.remove();
                changed = true;
            }
        });
    }
}
/**
 * Merge nested spans with the same or combinable styles
 */
function mergeNestedSpans($) {
    // Find spans that only contain another span
    $('span').each((_, el) => {
        const element = $(el);
        const children = element.children();
        // If span has exactly one child and it's a span
        if (children.length === 1 && children.first().is('span')) {
            const innerSpan = children.first();
            // Merge styles
            const outerStyle = element.attr('style') || '';
            const innerStyle = innerSpan.attr('style') || '';
            const mergedStyle = mergeStyles(outerStyle, innerStyle);
            // Replace outer span content with inner span content
            element.html(innerSpan.html() || '');
            if (mergedStyle) {
                element.attr('style', mergedStyle);
            }
        }
    });
}
/**
 * Merge two style strings
 */
function mergeStyles(outer, inner) {
    const outerProps = parseStyleString(outer);
    const innerProps = parseStyleString(inner);
    // Inner styles override outer styles
    const merged = { ...outerProps, ...innerProps };
    return Object.entries(merged)
        .map(([prop, value]) => `${prop}: ${value}`)
        .join('; ');
}
/**
 * Parse style string into object
 */
function parseStyleString(style) {
    const result = {};
    if (!style)
        return result;
    const props = style.split(';');
    for (const prop of props) {
        const trimmed = prop.trim();
        if (!trimmed)
            continue;
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1)
            continue;
        const property = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        if (property && value) {
            result[property] = value;
        }
    }
    return result;
}
/**
 * Normalize whitespace in text nodes
 */
function normalizeWhitespace($) {
    // This is a simplified version - just removes excessive whitespace
    $('p, span, div, li, td, th').each((_, el) => {
        const element = $(el);
        const html = element.html();
        if (html) {
            // Replace multiple spaces with single space
            // But preserve intentional line breaks
            const normalized = html
                .replace(/\s+/g, ' ')
                .replace(/>\s+</g, '><')
                .trim();
            element.html(normalized);
        }
    });
}
/**
 * Remove Google Docs specific artifacts
 */
export function removeGoogleDocsArtifacts(html) {
    const $ = cheerio.load(html);
    // Remove Google Docs specific classes
    $('[class*="docs-"]').removeAttr('class');
    // Remove Google specific attributes
    $('[data-docs-delta]').removeAttr('data-docs-delta');
    $('[data-docs-has-only-inline-content]').removeAttr('data-docs-has-only-inline-content');
    // Remove empty anchors used for bookmarks
    $('a[id]:not([href])').each((_, el) => {
        const element = $(el);
        if (!element.text().trim()) {
            element.remove();
        }
    });
    return $.html();
}
/**
 * Remove Word/Office specific artifacts
 */
export function removeWordArtifacts(html) {
    const $ = cheerio.load(html);
    // Remove MsoNormal and other Mso* classes
    $('[class*="Mso"]').each((_, el) => {
        const element = $(el);
        const classes = (element.attr('class') || '').split(/\s+/);
        const filteredClasses = classes.filter(c => !c.startsWith('Mso'));
        if (filteredClasses.length > 0) {
            element.attr('class', filteredClasses.join(' '));
        }
        else {
            element.removeAttr('class');
        }
    });
    // Remove conditional comments
    let htmlStr = $.html();
    htmlStr = htmlStr.replace(/<!--\[if[\s\S]*?endif\]-->/gi, '');
    htmlStr = htmlStr.replace(/<!\[if[\s\S]*?<!\[endif\]>/gi, '');
    return htmlStr;
}
//# sourceMappingURL=htmlCleaner.js.map