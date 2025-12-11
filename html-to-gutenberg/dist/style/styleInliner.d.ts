/**
 * Style Inliner
 * Converts CSS classes, IDs, and element styles to inline styles
 * Enhanced to support all selector types
 */
import type { CSSClassMap } from '../types/index.js';
export interface InlinerOptions {
    /** Whether to keep original class attributes */
    keepClasses?: boolean;
    /** Whether to merge with existing inline styles */
    mergeExisting?: boolean;
    /** Classes to ignore (won't be inlined) */
    ignoreClasses?: string[];
    /** Whether to apply ID-based styles */
    applyIdStyles?: boolean;
    /** Whether to apply element/tag-based styles */
    applyElementStyles?: boolean;
}
/**
 * Inline CSS classes into style attributes
 * @param html - Input HTML string
 * @param cssMap - CSS class to style mapping
 * @param options - Inliner options
 * @returns HTML with inlined styles
 */
export declare function inlineStyles(html: string, cssMap: CSSClassMap, options?: InlinerOptions): string;
/**
 * Inline all styles (classes, IDs, element styles) into style attributes
 * Uses extended style extraction for comprehensive coverage
 * @param html - Input HTML string
 * @param options - Inliner options
 * @returns HTML with all styles inlined
 */
export declare function inlineAllStyles(html: string, options?: InlinerOptions): string;
/**
 * Parse inline style string into object
 * @param styleString - Inline style string
 * @returns Object with property-value pairs
 */
export declare function parseInlineStyle(styleString: string): Record<string, string>;
/**
 * Remove all class attributes from HTML
 * @param html - Input HTML
 * @returns HTML without class attributes
 */
export declare function removeAllClasses(html: string): string;
/**
 * Remove style tags from HTML
 * @param html - Input HTML
 * @returns HTML without style tags
 */
export declare function removeStyleTags(html: string): string;
//# sourceMappingURL=styleInliner.d.ts.map