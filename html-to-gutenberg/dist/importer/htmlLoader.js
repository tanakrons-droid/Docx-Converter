/**
 * HTML Loader
 * Loads HTML content from files or strings
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
/**
 * Load HTML from a file path
 * @param filePath - Path to HTML file
 * @returns LoadResult with HTML content
 */
export function loadFromFile(filePath) {
    const absolutePath = resolve(filePath);
    if (!existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }
    const html = readFileSync(absolutePath, 'utf-8');
    return {
        html,
        sourcePath: absolutePath
    };
}
/**
 * Load HTML from a string
 * @param html - HTML string
 * @returns LoadResult with HTML content
 */
export function loadFromString(html) {
    return {
        html,
        sourcePath: undefined
    };
}
/**
 * Detect if input is a file path or HTML string
 * @param input - File path or HTML string
 * @returns LoadResult
 */
export function loadHTML(input) {
    // If it starts with < or contains DOCTYPE, treat as HTML string
    const trimmed = input.trim();
    if (trimmed.startsWith('<') || trimmed.toLowerCase().includes('<!doctype')) {
        return loadFromString(input);
    }
    // Otherwise, treat as file path
    return loadFromFile(input);
}
//# sourceMappingURL=htmlLoader.js.map