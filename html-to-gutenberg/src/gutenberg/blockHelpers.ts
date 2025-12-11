/**
 * Gutenberg Block Helpers
 * Helper functions for creating Gutenberg block markup
 */

import type { GutenbergBlock } from '../types/index.js';

/**
 * Create a Gutenberg block comment wrapper
 */
export function wrapBlock(
  blockType: string,
  content: string,
  attrs?: Record<string, unknown>
): string {
  const attrString = attrs && Object.keys(attrs).length > 0
    ? ` ${JSON.stringify(attrs)}`
    : '';

  return `<!-- wp:${blockType}${attrString} -->\n${content}\n<!-- /wp:${blockType} -->`;
}

/**
 * Create a paragraph block
 */
export function createParagraphBlock(content: string, attrs?: { align?: string }): string {
  const attrObj: Record<string, unknown> = {};
  
  if (attrs?.align) {
    attrObj.align = attrs.align;
  }

  const hasAttrs = Object.keys(attrObj).length > 0;
  const pClass = attrs?.align ? ` class="has-text-align-${attrs.align}"` : '';
  
  return wrapBlock(
    'paragraph',
    `<p${pClass}>${content}</p>`,
    hasAttrs ? attrObj : undefined
  );
}

/**
 * Create a heading block
 */
export function createHeadingBlock(
  content: string,
  level: number = 2,
  attrs?: { align?: string }
): string {
  const attrObj: Record<string, unknown> = { level };
  
  if (attrs?.align) {
    attrObj.textAlign = attrs.align;
  }

  const hClass = attrs?.align ? ` class="has-text-align-${attrs.align}"` : '';
  
  return wrapBlock(
    'heading',
    `<h${level}${hClass}>${content}</h${level}>`,
    attrObj
  );
}

/**
 * Create a list block
 */
export function createListBlock(
  items: string[],
  ordered: boolean = false
): string {
  const tag = ordered ? 'ol' : 'ul';
  const listItems = items.map(item => `<li>${item}</li>`).join('\n');
  
  return wrapBlock(
    'list',
    `<${tag}>\n${listItems}\n</${tag}>`,
    ordered ? { ordered: true } : undefined
  );
}

/**
 * Create an image block
 */
export function createImageBlock(
  src: string,
  alt: string = '',
  attrs?: {
    caption?: string;
    align?: 'left' | 'center' | 'right' | 'wide' | 'full';
    width?: number;
    height?: number;
    linkDestination?: string;
  }
): string {
  const attrObj: Record<string, unknown> = {};
  
  if (attrs?.align) {
    attrObj.align = attrs.align;
  }
  if (attrs?.width) {
    attrObj.width = attrs.width;
  }
  if (attrs?.height) {
    attrObj.height = attrs.height;
  }

  const figureClass = attrs?.align ? ` class="align${attrs.align}"` : '';
  const imgAttrs = [
    `src="${src}"`,
    alt ? `alt="${alt}"` : 'alt=""'
  ];
  
  if (attrs?.width) {
    imgAttrs.push(`width="${attrs.width}"`);
  }
  if (attrs?.height) {
    imgAttrs.push(`height="${attrs.height}"`);
  }

  let content = `<figure${figureClass}><img ${imgAttrs.join(' ')}/>`;
  
  if (attrs?.caption) {
    content += `<figcaption class="wp-element-caption">${attrs.caption}</figcaption>`;
  }
  
  content += '</figure>';

  return wrapBlock('image', content, Object.keys(attrObj).length > 0 ? attrObj : undefined);
}

/**
 * Create a quote block
 */
export function createQuoteBlock(
  content: string,
  citation?: string
): string {
  let quoteContent = `<blockquote class="wp-block-quote"><p>${content}</p>`;
  
  if (citation) {
    quoteContent += `<cite>${citation}</cite>`;
  }
  
  quoteContent += '</blockquote>';

  return wrapBlock('quote', quoteContent);
}

/**
 * Create a code block
 */
export function createCodeBlock(code: string, language?: string): string {
  const escapedCode = escapeHtml(code);
  
  return wrapBlock(
    'code',
    `<pre class="wp-block-code"><code>${escapedCode}</code></pre>`,
    language ? { language } : undefined
  );
}

/**
 * Create a separator block
 */
export function createSeparatorBlock(): string {
  return wrapBlock(
    'separator',
    '<hr class="wp-block-separator has-alpha-channel-opacity"/>'
  );
}

/**
 * Create a raw HTML block
 */
export function createHtmlBlock(html: string): string {
  return wrapBlock('html', html);
}

/**
 * Create a group block (container)
 */
export function createGroupBlock(innerBlocks: string[]): string {
  return wrapBlock(
    'group',
    `<div class="wp-block-group">${innerBlocks.join('\n')}</div>`,
    { layout: { type: 'constrained' } }
  );
}

/**
 * Create a table block
 */
export function createTableBlock(
  headers: string[],
  rows: string[][]
): string {
  const headerCells = headers.map(h => `<th>${h}</th>`).join('');
  const headerRow = `<tr>${headerCells}</tr>`;
  
  const bodyRows = rows.map(row => {
    const cells = row.map(cell => `<td>${cell}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('\n');

  const tableHtml = `<figure class="wp-block-table"><table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table></figure>`;

  return wrapBlock('table', tableHtml);
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, char => escapeMap[char] || char);
}

/**
 * Convert a GutenbergBlock object to markup string
 */
export function blockToMarkup(block: GutenbergBlock): string {
  return wrapBlock(block.type, block.innerHTML, block.attrs);
}
