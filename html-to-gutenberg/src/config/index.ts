/**
 * Configuration loader
 * Loads and validates configuration from YAML/JSON files
 */

import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { ConverterConfigSchema } from './schemas.js';
import type { ConverterConfig } from '../types/index.js';

/**
 * Default configuration
 */
export const defaultConfig: ConverterConfig = {
  mode: 'relaxed',
  keepClasses: false,
  inlineStyles: true,
  outputFormat: 'html',
  policies: {
    requireH2: { enabled: true, options: { minCount: 1 } },
    minImageCount: { enabled: true, options: { minCount: 0 } },
    forbiddenTags: { enabled: true, options: { tags: ['script', 'iframe', 'object', 'embed'] } },
    addDisclaimer: { enabled: false, options: { keywords: ['โปรโมชั่น', 'ส่วนลด', 'ราคาพิเศษ'] } }
  }
};

/**
 * Load configuration from file
 * @param configPath - Path to config file (YAML or JSON)
 * @returns Merged configuration
 */
export function loadConfig(configPath?: string): ConverterConfig {
  if (!configPath || !existsSync(configPath)) {
    return defaultConfig;
  }

  const content = readFileSync(configPath, 'utf-8');
  let parsed: unknown;

  if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
    parsed = parseYaml(content);
  } else {
    parsed = JSON.parse(content);
  }

  // Validate and merge with defaults
  const validated = ConverterConfigSchema.parse({
    ...defaultConfig,
    ...(typeof parsed === 'object' && parsed !== null ? parsed : {})
  });

  return validated;
}

/**
 * Normalize policy config to standard format
 */
export function normalizePolicyConfig(
  config: boolean | { enabled: boolean; options?: Record<string, unknown> }
): { enabled: boolean; options: Record<string, unknown> } {
  if (typeof config === 'boolean') {
    return { enabled: config, options: {} };
  }
  return { enabled: config.enabled, options: config.options || {} };
}

export * from './schemas.js';
