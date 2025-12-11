/**
 * HTML Cleaner
 * Cleans and normalizes HTML from Google Docs/Word exports
 */
export interface CleanerOptions {
    /** Tags to remove completely (including content) */
    removeTags?: string[];
    /** Tags to unwrap (keep content, remove tag) */
    unwrapTags?: string[];
    /** Remove empty paragraphs */
    removeEmptyParagraphs?: boolean;
    /** Remove empty spans */
    removeEmptySpans?: boolean;
    /** Merge nested spans with same styles */
    mergeNestedSpans?: boolean;
    /** Remove comments */
    removeComments?: boolean;
    /** Remove data-* attributes */
    removeDataAttributes?: boolean;
    /** Remove id attributes */
    removeIds?: boolean;
}
/**
 * Clean HTML content
 * @param html - Input HTML string
 * @param options - Cleaner options
 * @returns Cleaned HTML string
 */
export declare function cleanHTML(html: string, options?: CleanerOptions): string;
/**
 * Remove Google Docs specific artifacts
 */
export declare function removeGoogleDocsArtifacts(html: string): string;
/**
 * Remove Word/Office specific artifacts
 */
export declare function removeWordArtifacts(html: string): string;
//# sourceMappingURL=htmlCleaner.d.ts.map