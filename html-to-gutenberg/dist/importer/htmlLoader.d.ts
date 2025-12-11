/**
 * HTML Loader
 * Loads HTML content from files or strings
 */
export interface LoadResult {
    html: string;
    sourcePath?: string;
}
/**
 * Load HTML from a file path
 * @param filePath - Path to HTML file
 * @returns LoadResult with HTML content
 */
export declare function loadFromFile(filePath: string): LoadResult;
/**
 * Load HTML from a string
 * @param html - HTML string
 * @returns LoadResult with HTML content
 */
export declare function loadFromString(html: string): LoadResult;
/**
 * Detect if input is a file path or HTML string
 * @param input - File path or HTML string
 * @returns LoadResult
 */
export declare function loadHTML(input: string): LoadResult;
//# sourceMappingURL=htmlLoader.d.ts.map