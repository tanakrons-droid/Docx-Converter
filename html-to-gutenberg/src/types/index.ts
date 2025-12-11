/**
 * Shared types for the HTML to Gutenberg converter
 */

import type { CheerioAPI } from 'cheerio';

/**
 * CSS class to style mapping
 */
export interface CSSClassMap {
  [className: string]: {
    [property: string]: string;
  };
}

/**
 * Result from style extraction
 */
export interface StyleExtractionResult {
  cssMap: CSSClassMap;
  rawCSS: string;
}

/**
 * Selector to style mapping (for full selectors)
 */
export interface SelectorStyleMap {
  [selector: string]: Record<string, string>;
}

/**
 * Extended result from style extraction with all selector types
 */
export interface ExtendedStyleExtractionResult {
  /** Class name to styles mapping */
  cssMap: CSSClassMap;
  /** ID to styles mapping */
  idMap: Record<string, Record<string, string>>;
  /** Element/tag to styles mapping */
  elementMap: Record<string, Record<string, string>>;
  /** Full selector to styles mapping */
  selectorMap: SelectorStyleMap;
  /** Inline styles extracted from elements */
  inlineStyles: Map<string, Record<string, string>>;
  /** Media queries with their rules */
  mediaQueries: Array<{ query: string; rules: SelectorStyleMap }>;
  /** Raw CSS string */
  rawCSS: string;
}

/**
 * Result from policy application
 */
export interface PolicyResult {
  /** Updated HTML string */
  html: string;
  /** Warning messages (non-blocking) */
  warnings: string[];
  /** Error messages (may block in strict mode) */
  errors: string[];
  /** Whether the policy passed */
  passed: boolean;
  /** Actions taken by the policy */
  actions: string[];
}

/**
 * Policy interface - all policies must implement this
 */
export interface Policy {
  /** Unique identifier for the policy */
  name: string;
  /** Human-readable description */
  description: string;
  /** Priority (lower = runs first) */
  priority?: number;
  /** 
   * Apply the policy to the HTML
   * @param html - Input HTML string
   * @param $ - Cheerio instance (optional, for DOM manipulation)
   * @param config - Policy-specific configuration
   */
  apply(html: string, $?: CheerioAPI, config?: PolicyConfig): PolicyResult;
}

/**
 * Policy configuration from YAML/JSON
 */
export interface PolicyConfig {
  enabled: boolean;
  options?: Record<string, unknown>;
}

/**
 * Full policies configuration
 */
export interface PoliciesConfig {
  [policyName: string]: PolicyConfig | boolean;
}

/**
 * Conversion mode
 */
export type ConversionMode = 'strict' | 'relaxed';

/**
 * Main configuration for the converter
 */
export interface ConverterConfig {
  /** Conversion mode: strict fails on errors, relaxed auto-fixes */
  mode: ConversionMode;
  /** Whether to keep original CSS classes */
  keepClasses: boolean;
  /** Whether to inline styles */
  inlineStyles: boolean;
  /** Output format */
  outputFormat: 'html' | 'json';
  /** Policies configuration */
  policies: PoliciesConfig;
}

/**
 * Pipeline execution report
 */
export interface ConversionReport {
  /** Input file path */
  inputFile: string;
  /** Output file path */
  outputFile?: string;
  /** Timestamp */
  timestamp: string;
  /** Policies that were triggered */
  policiesTriggered: string[];
  /** All warnings from the pipeline */
  warnings: string[];
  /** All errors from the pipeline */
  errors: string[];
  /** Actions taken during conversion */
  actions: string[];
  /** Whether conversion was successful */
  success: boolean;
  /** Execution time in ms */
  executionTimeMs: number;
}

/**
 * Conversion result
 */
export interface ConversionResult {
  /** Converted Gutenberg HTML */
  html: string;
  /** Conversion report */
  report: ConversionReport;
}

/**
 * Gutenberg block types
 */
export type GutenbergBlockType = 
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'list-item'
  | 'image'
  | 'quote'
  | 'code'
  | 'preformatted'
  | 'table'
  | 'separator'
  | 'html'
  | 'group';

/**
 * Gutenberg block structure
 */
export interface GutenbergBlock {
  type: GutenbergBlockType;
  attrs?: Record<string, unknown>;
  innerHTML: string;
}
