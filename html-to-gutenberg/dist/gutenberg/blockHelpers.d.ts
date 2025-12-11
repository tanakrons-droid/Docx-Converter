/**
 * Gutenberg Block Helpers
 * Helper functions for creating Gutenberg block markup
 */
import type { GutenbergBlock } from '../types/index.js';
/**
 * Create a Gutenberg block comment wrapper
 */
export declare function wrapBlock(blockType: string, content: string, attrs?: Record<string, unknown>): string;
/**
 * Create a paragraph block
 */
export declare function createParagraphBlock(content: string, attrs?: {
    align?: string;
}): string;
/**
 * Create a heading block
 */
export declare function createHeadingBlock(content: string, level?: number, attrs?: {
    align?: string;
}): string;
/**
 * Create a list block
 */
export declare function createListBlock(items: string[], ordered?: boolean): string;
/**
 * Create an image block
 */
export declare function createImageBlock(src: string, alt?: string, attrs?: {
    caption?: string;
    align?: 'left' | 'center' | 'right' | 'wide' | 'full';
    width?: number;
    height?: number;
    linkDestination?: string;
}): string;
/**
 * Create a quote block
 */
export declare function createQuoteBlock(content: string, citation?: string): string;
/**
 * Create a code block
 */
export declare function createCodeBlock(code: string, language?: string): string;
/**
 * Create a separator block
 */
export declare function createSeparatorBlock(): string;
/**
 * Create a raw HTML block
 */
export declare function createHtmlBlock(html: string): string;
/**
 * Create a group block (container)
 */
export declare function createGroupBlock(innerBlocks: string[]): string;
/**
 * Create a table block
 */
export declare function createTableBlock(headers: string[], rows: string[][]): string;
/**
 * Escape HTML special characters
 */
export declare function escapeHtml(text: string): string;
/**
 * Convert a GutenbergBlock object to markup string
 */
export declare function blockToMarkup(block: GutenbergBlock): string;
//# sourceMappingURL=blockHelpers.d.ts.map