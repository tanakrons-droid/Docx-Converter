/**
 * Gutenberg Converter
 * Converts HTML to WordPress Gutenberg block markup
 */
export interface ConverterOptions {
    /** Preserve inline styles */
    preserveStyles?: boolean;
    /** Convert unknown elements to HTML blocks */
    convertUnknownToHtml?: boolean;
    /** Wrap loose text in paragraphs */
    wrapLooseText?: boolean;
}
/**
 * Convert HTML to Gutenberg block markup
 */
export declare function convertToGutenberg(html: string, options?: ConverterOptions): string;
/**
 * Convert HTML string to Gutenberg blocks (alias)
 */
export declare const htmlToGutenberg: typeof convertToGutenberg;
//# sourceMappingURL=gutenbergConverter.d.ts.map