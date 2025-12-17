/**
 * Gutenberg Converter
 * Converts HTML to WordPress Gutenberg block markup
 */

import * as cheerio from 'cheerio';
import type { Element, ChildNode } from 'domhandler';
import {
  createParagraphBlock,
  createHeadingBlock,
  createListBlock,
  createImageBlock,
  createQuoteBlock,
  createCodeBlock,
  createSeparatorBlock,
  createHtmlBlock,
  createTableBlock
} from './blockHelpers.js';

export interface ConverterOptions {
  /** Preserve inline styles */
  preserveStyles?: boolean;
  /** Convert unknown elements to HTML blocks */
  convertUnknownToHtml?: boolean;
  /** Wrap loose text in paragraphs */
  wrapLooseText?: boolean;
}

const defaultOptions: ConverterOptions = {
  preserveStyles: true,
  convertUnknownToHtml: true,
  wrapLooseText: true
};

/**
 * Convert HTML to Gutenberg block markup
 */
export function convertToGutenberg(
  html: string,
  options: ConverterOptions = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const $ = cheerio.load(html);

  // Get the body content or root content
  const body = $('body');
  const root = body.length > 0 ? body : ($ as any).root();

  const blocks: string[] = [];

  // Process each top-level element
  (root as any).contents().each((_: number, node: any) => {
    const block = processNode($, node, opts);
    if (block) {
      blocks.push(block);
    }
  });

  return blocks.join('\n\n');
}

/**
 * Process a single DOM node and convert to Gutenberg block
 */
function processNode(
  $: cheerio.CheerioAPI,
  node: ChildNode,
  opts: ConverterOptions
): string | null {
  // Skip comments
  if (node.type === 'comment') {
    return null;
  }

  // Handle text nodes
  if (node.type === 'text') {
    const text = (node as unknown as { data: string }).data?.trim();
    if (text && opts.wrapLooseText) {
      return createParagraphBlock(text);
    }
    return null;
  }

  // Handle element nodes
  if (node.type !== 'tag') {
    return null;
  }

  const element = node as Element;
  const tagName = element.tagName?.toLowerCase();
  const $el = $(element);

  switch (tagName) {
    // Headings
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = parseInt(tagName.charAt(1), 10);
      
      // Check if heading contains images (Google Docs img box pattern)
      const headingImages = $el.find('img');
      if (headingImages.length > 0) {
        // Extract image and convert to image block instead of heading
        const img = headingImages.first();
        const src = img.attr('src') || '';
        const alt = img.attr('alt') || '';
        const width = img.attr('width') ? parseInt(img.attr('width')!, 10) : undefined;
        const height = img.attr('height') ? parseInt(img.attr('height')!, 10) : undefined;
        return createImageBlock(src, alt, { width, height });
      }
      
      const content = getInnerHtml($, $el, opts);
      const align = extractAlignment($el);
      return createHeadingBlock(content, level, align ? { align } : undefined);
    }

    // Paragraphs
    case 'p': {
      const content = getInnerHtml($, $el, opts);
      if (!content.trim()) return null;
      const align = extractAlignment($el);
      return createParagraphBlock(content, align ? { align } : undefined);
    }

    // Lists
    case 'ul':
    case 'ol': {
      const items: string[] = [];
      $el.children('li').each((_: number, li: Element) => {
        items.push(getInnerHtml($, $(li), opts));
      });
      return createListBlock(items, tagName === 'ol');
    }

    // Images
    case 'img': {
      const src = $el.attr('src') || '';
      const alt = $el.attr('alt') || '';
      const width = $el.attr('width') ? parseInt($el.attr('width')!, 10) : undefined;
      const height = $el.attr('height') ? parseInt($el.attr('height')!, 10) : undefined;
      return createImageBlock(src, alt, { width, height });
    }

    // Figure (usually contains image with caption)
    case 'figure': {
      const img = $el.find('img').first();
      const figcaption = $el.find('figcaption').first();
      
      if (img.length > 0) {
        const src = img.attr('src') || '';
        const alt = img.attr('alt') || '';
        const caption = figcaption.length > 0 ? figcaption.html() || '' : undefined;
        return createImageBlock(src, alt, { caption });
      }
      
      // If no image, treat as HTML block
      return opts.convertUnknownToHtml ? createHtmlBlock($el.html() || '') : null;
    }

    // Blockquotes
    case 'blockquote': {
      const cite = $el.find('cite').first();
      const citation = cite.length > 0 ? cite.text() : undefined;
      
      // Remove cite from content
      cite.remove();
      
      const content = getInnerHtml($, $el, opts);
      return createQuoteBlock(content, citation);
    }

    // Code blocks
    case 'pre': {
      const code = $el.find('code').first();
      const codeContent = code.length > 0 ? code.text() : $el.text();
      const language = code.attr('class')?.match(/language-(\w+)/)?.[1];
      return createCodeBlock(codeContent, language);
    }

    // Inline code (wrap in paragraph)
    case 'code': {
      // If standalone code element, wrap in paragraph
      const content = `<code>${$el.html()}</code>`;
      return createParagraphBlock(content);
    }

    // Horizontal rules
    case 'hr': {
      return createSeparatorBlock();
    }

    // Tables
    case 'table': {
      const headers: string[] = [];
      const rows: string[][] = [];

      // Extract headers
      $el.find('thead tr th, thead tr td').each((_: number, th: Element) => {
        headers.push($(th).html() || '');
      });

      // If no thead, try first row
      if (headers.length === 0) {
        $el.find('tr').first().find('th, td').each((_: number, cell: Element) => {
          headers.push($(cell).html() || '');
        });
      }

      // Extract body rows
      const bodyRows = $el.find('tbody tr');
      if (bodyRows.length > 0) {
        bodyRows.each((_: number, tr: Element) => {
          const row: string[] = [];
          $(tr).find('td, th').each((__: number, cell: Element) => {
            row.push($(cell).html() || '');
          });
          if (row.length > 0) {
            rows.push(row);
          }
        });
      } else {
        // No tbody, skip first row (headers) and get rest
        $el.find('tr').slice(1).each((_: number, tr: Element) => {
          const row: string[] = [];
          $(tr).find('td, th').each((__: number, cell: Element) => {
            row.push($(cell).html() || '');
          });
          if (row.length > 0) {
            rows.push(row);
          }
        });
      }

      return createTableBlock(headers, rows);
    }

    // Divs - process children
    case 'div': {
      // Check if it's a special block (like disclaimer)
      if ($el.hasClass('disclaimer-block')) {
        return createHtmlBlock($el.prop('outerHTML') || '');
      }

      // Process children
      const childBlocks: string[] = [];
      $el.contents().each((_: number, child: ChildNode) => {
        const block = processNode($, child, opts);
        if (block) {
          childBlocks.push(block);
        }
      });

      if (childBlocks.length === 0) return null;
      if (childBlocks.length === 1) return childBlocks[0];
      
      // Return joined blocks
      return childBlocks.join('\n\n');
    }

    // Spans - usually inline, wrap in paragraph if standalone
    case 'span': {
      const content = getInnerHtml($, $el, opts);
      if (!content.trim()) return null;
      return createParagraphBlock(content);
    }

    // Line breaks - ignore at top level
    case 'br': {
      return null;
    }

    // Anchors - wrap in paragraph if standalone
    case 'a': {
      const href = $el.attr('href') || '#';
      const content = $el.html() || '';
      return createParagraphBlock(`<a href="${href}">${content}</a>`);
    }

    // Strong/Bold
    case 'strong':
    case 'b': {
      const content = `<strong>${$el.html()}</strong>`;
      return createParagraphBlock(content);
    }

    // Emphasis/Italic
    case 'em':
    case 'i': {
      const content = `<em>${$el.html()}</em>`;
      return createParagraphBlock(content);
    }

    // Default: convert to HTML block or skip
    default: {
      if (opts.convertUnknownToHtml) {
        const outerHtml = $el.prop('outerHTML');
        if (outerHtml && outerHtml.trim()) {
          return createHtmlBlock(outerHtml);
        }
      }
      return null;
    }
  }
}

/**
 * Get inner HTML with optional style preservation
 */
function getInnerHtml(
  _$: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
  opts: ConverterOptions
): string {
  if (!opts.preserveStyles) {
    // Strip style attributes
    $el.find('[style]').removeAttr('style');
  }
  
  return $el.html() || '';
}

/**
 * Extract text alignment from element
 */
function extractAlignment($el: cheerio.Cheerio<Element>): string | undefined {
  // Check style attribute
  const style = $el.attr('style') || '';
  const alignMatch = style.match(/text-align:\s*(left|center|right|justify)/i);
  if (alignMatch) {
    return alignMatch[1].toLowerCase();
  }

  // Check class
  const className = $el.attr('class') || '';
  if (className.includes('text-center') || className.includes('align-center')) {
    return 'center';
  }
  if (className.includes('text-right') || className.includes('align-right')) {
    return 'right';
  }
  if (className.includes('text-left') || className.includes('align-left')) {
    return 'left';
  }

  return undefined;
}

/**
 * Convert HTML string to Gutenberg blocks (alias)
 */
export const htmlToGutenberg = convertToGutenberg;
