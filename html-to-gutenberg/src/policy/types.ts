/**
 * Policy Engine Types
 */

import type { CheerioAPI } from 'cheerio';

/**
 * Result from a single policy application
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
 * Policy configuration
 */
export interface PolicyOptions {
  [key: string]: unknown;
}

/**
 * Policy interface - all policies must implement this
 */
export interface Policy {
  /** Unique identifier for the policy */
  name: string;
  /** Human-readable description */
  description: string;
  /** Priority (lower = runs first, default 100) */
  priority: number;
  /** 
   * Apply the policy to the HTML
   * @param html - Input HTML string
   * @param $ - Cheerio instance for DOM manipulation
   * @param options - Policy-specific configuration
   */
  apply(html: string, $: CheerioAPI, options: PolicyOptions): PolicyResult;
}

/**
 * Policy registration info
 */
export interface PolicyRegistration {
  policy: Policy;
  enabled: boolean;
  options: PolicyOptions;
}

/**
 * Combined result from running all policies
 */
export interface PolicyEngineResult {
  /** Final HTML after all policies */
  html: string;
  /** All warnings from all policies */
  warnings: string[];
  /** All errors from all policies */
  errors: string[];
  /** Names of policies that were triggered */
  policiesTriggered: string[];
  /** All actions taken */
  actions: string[];
  /** Whether all policies passed */
  allPassed: boolean;
}

/**
 * Policy engine options
 */
export interface PolicyEngineOptions {
  /** Run mode: strict fails on errors, relaxed continues */
  mode: 'strict' | 'relaxed';
  /** Stop on first error */
  stopOnError: boolean;
}

/**
 * Helper to create a successful policy result
 */
export function createSuccessResult(html: string, actions: string[] = []): PolicyResult {
  return {
    html,
    warnings: [],
    errors: [],
    passed: true,
    actions
  };
}

/**
 * Helper to create a failed policy result
 */
export function createFailedResult(
  html: string, 
  errors: string[], 
  warnings: string[] = []
): PolicyResult {
  return {
    html,
    warnings,
    errors,
    passed: false,
    actions: []
  };
}

/**
 * Helper to create a warning policy result
 */
export function createWarningResult(
  html: string, 
  warnings: string[], 
  actions: string[] = []
): PolicyResult {
  return {
    html,
    warnings,
    errors: [],
    passed: true,
    actions
  };
}
