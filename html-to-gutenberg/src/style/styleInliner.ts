/**
 * Style Inliner
 * Converts CSS classes, IDs, and element styles to inline styles
 * Enhanced to support all selector types
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { CSSClassMap } from '../types/index.js';
import { getCombinedStyles, propertiesToInlineStyle, extractAllStyles } from './styleExtractor.js';

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

const defaultOptions: InlinerOptions = {
  keepClasses: false,
  mergeExisting: true,
  ignoreClasses: [],
  applyIdStyles: true,
  applyElementStyles: true
};

/**
 * Inline CSS classes into style attributes
 * @param html - Input HTML string
 * @param cssMap - CSS class to style mapping
 * @param options - Inliner options
 * @returns HTML with inlined styles
 */
export function inlineStyles(
  html: string,
  cssMap: CSSClassMap,
  options: InlinerOptions = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const $ = cheerio.load(html, { xml: false });

  // Find all elements with class attributes
  $('[class]').each((_: number, el: Element) => {
    const element = $(el);
    const classAttr = element.attr('class');

    if (!classAttr) return;

    // Split classes and filter out ignored ones
    const classes = classAttr.split(/\s+/).filter(c => c.trim());
    const classesToInline = classes.filter(c => !opts.ignoreClasses?.includes(c));

    // Get combined styles for all classes
    const newStyles = getCombinedStyles(classesToInline, cssMap);

    if (Object.keys(newStyles).length > 0) {
      // Get existing inline styles
      let existingStyles: Record<string, string> = {};
      if (opts.mergeExisting) {
        const existingStyleAttr = element.attr('style');
        if (existingStyleAttr) {
          existingStyles = parseInlineStyle(existingStyleAttr);
        }
      }

      // Merge styles (existing styles take precedence)
      const mergedStyles = { ...newStyles, ...existingStyles };
      const styleString = propertiesToInlineStyle(mergedStyles);

      element.attr('style', styleString);
    }

    // Remove or keep class attribute
    if (!opts.keepClasses) {
      element.removeAttr('class');
    }
  });

  return $.html();
}

/**
 * Inline all styles (classes, IDs, element styles) into style attributes
 * Uses extended style extraction for comprehensive coverage
 * @param html - Input HTML string
 * @param options - Inliner options
 * @returns HTML with all styles inlined
 */
export function inlineAllStyles(
  html: string,
  options: InlinerOptions = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const $ = cheerio.load(html, { xml: false });
  
  // Extract all styles from the HTML
  const styleData = extractAllStyles(html);
  const { cssMap, idMap, elementMap } = styleData;

  // Process all elements in the document body
  $('body *').each((_: number, el) => {
    const element = $(el);
    const tagName = (el as Element).tagName?.toLowerCase();
    
    if (!tagName || tagName === 'html' || tagName === 'head' || tagName === 'style' || tagName === 'script') {
      return;
    }

    let combinedStyles: Record<string, string> = {};

    // 1. Apply element/tag styles (lowest specificity)
    if (opts.applyElementStyles && elementMap[tagName]) {
      combinedStyles = { ...combinedStyles, ...elementMap[tagName] };
    }

    // 2. Apply class styles (medium specificity)
    const classAttr = element.attr('class');
    if (classAttr) {
      const classes = classAttr.split(/\s+/).filter(c => c.trim());
      const classesToInline = classes.filter(c => !opts.ignoreClasses?.includes(c));
      const classStyles = getCombinedStyles(classesToInline, cssMap);
      combinedStyles = { ...combinedStyles, ...classStyles };
    }

    // 3. Apply ID styles (higher specificity)
    if (opts.applyIdStyles) {
      const idAttr = element.attr('id');
      if (idAttr && idMap[idAttr]) {
        combinedStyles = { ...combinedStyles, ...idMap[idAttr] };
      }
    }

    // 4. Merge with existing inline styles (highest specificity)
    if (opts.mergeExisting) {
      const existingStyleAttr = element.attr('style');
      if (existingStyleAttr) {
        const existingStyles = parseInlineStyle(existingStyleAttr);
        combinedStyles = { ...combinedStyles, ...existingStyles };
      }
    }

    // Apply combined styles if any
    if (Object.keys(combinedStyles).length > 0) {
      const styleString = propertiesToInlineStyle(combinedStyles);
      element.attr('style', styleString);
    }

    // Remove or keep class attribute
    if (!opts.keepClasses && classAttr) {
      element.removeAttr('class');
    }
  });

  return $.html();
}

/**
 * Parse inline style string into object
 * @param styleString - Inline style string
 * @returns Object with property-value pairs
 */
export function parseInlineStyle(styleString: string): Record<string, string> {
  const result: Record<string, string> = {};

  const props = styleString.split(';');
  for (const prop of props) {
    const trimmed = prop.trim();
    if (!trimmed) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const property = trimmed.substring(0, colonIndex).trim();
    const value = trimmed.substring(colonIndex + 1).trim();

    if (property && value) {
      result[property] = value;
    }
  }

  return result;
}

/**
 * Remove all class attributes from HTML
 * @param html - Input HTML
 * @returns HTML without class attributes
 */
export function removeAllClasses(html: string): string {
  const $ = cheerio.load(html, { xml: false });
  $('[class]').removeAttr('class');
  return $.html();
}

/**
 * Remove style tags from HTML
 * @param html - Input HTML
 * @returns HTML without style tags
 */
export function removeStyleTags(html: string): string {
  const $ = cheerio.load(html, { xml: false });
  $('style').remove();
  return $.html();
}
