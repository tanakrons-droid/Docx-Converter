/**
 * Configuration loader
 * Loads and validates configuration from YAML/JSON files
 */
import type { ConverterConfig } from '../types/index.js';
/**
 * Default configuration
 */
export declare const defaultConfig: ConverterConfig;
/**
 * Load configuration from file
 * @param configPath - Path to config file (YAML or JSON)
 * @returns Merged configuration
 */
export declare function loadConfig(configPath?: string): ConverterConfig;
/**
 * Normalize policy config to standard format
 */
export declare function normalizePolicyConfig(config: boolean | {
    enabled: boolean;
    options?: Record<string, unknown>;
}): {
    enabled: boolean;
    options: Record<string, unknown>;
};
export * from './schemas.js';
//# sourceMappingURL=index.d.ts.map