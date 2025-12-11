/**
 * Style Extractor
 * Extracts <style> tags from HTML and parses CSS rules
 * Enhanced to support multiple selector types and inline styles
 */
import type { CSSClassMap, StyleExtractionResult, ExtendedStyleExtractionResult, SelectorStyleMap } from '../types/index.js';
/**
 * Extract all <style> tags from HTML
 * @param html - Input HTML string
 * @returns StyleExtractionResult with CSS map and raw CSS
 */
export declare function extractStyles(html: string): StyleExtractionResult;
/**
 * Extract all styles from HTML including:
 * - <style> tags
 * - Inline style attributes
 * - All selector types (class, ID, element, compound)
 * @param html - Input HTML string
 * @returns ExtendedStyleExtractionResult with comprehensive style data
 */
export declare function extractAllStyles(html: string): ExtendedStyleExtractionResult;
/**
 * Parse CSS string into a class-to-styles map
 * Handles Google Docs exported CSS format (e.g., .c1, .c2, etc.)
 * @param css - Raw CSS string
 * @returns CSSClassMap
 */
export declare function parseCSS(css: string): CSSClassMap;
/**
 * Extended CSS parser that extracts all selector types
 * @param css - Raw CSS string
 * @returns Object containing maps for different selector types
 */
export declare function parseCSSExtended(css: string): {
    cssMap: CSSClassMap;
    idMap: Record<string, Record<string, string>>;
    elementMap: Record<string, Record<string, string>>;
    selectorMap: SelectorStyleMap;
    mediaQueries: Array<{
        query: string;
        rules: SelectorStyleMap;
    }>;
};
/**
 * Parse CSS properties string into an object
 * Enhanced to handle complex values like url(), content, CSS variables, and !important
 * @param properties - CSS properties string (e.g., "color: red; font-size: 12px")
 * @returns Object with property-value pairs
 */
export declare function parseProperties(properties: string): Record<string, string>;
/**
 * Convert CSS properties object to inline style string
 * @param properties - Object with CSS property-value pairs
 * @returns Inline style string
 */
export declare function propertiesToInlineStyle(properties: Record<string, string>): string;
/**
 * Get combined styles for multiple classes
 * @param classes - Array of class names
 * @param cssMap - CSS class map
 * @returns Combined properties object
 */
export declare function getCombinedStyles(classes: string[], cssMap: CSSClassMap): Record<string, string>;
//# sourceMappingURL=styleExtractor.d.ts.map