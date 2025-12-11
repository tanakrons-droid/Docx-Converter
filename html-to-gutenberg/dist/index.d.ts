/**
 * HTML to Gutenberg Converter
 * Main pipeline that orchestrates the conversion process
 */
import type { ConverterConfig, ConversionResult } from './types/index.js';
export interface ConvertOptions {
    /** Path to config file */
    configPath?: string;
    /** Override config options */
    config?: Partial<ConverterConfig>;
    /** Input file path (if not providing HTML string) */
    inputPath?: string;
}
/**
 * Main conversion pipeline
 */
export declare function convert(input: string, options?: ConvertOptions): Promise<ConversionResult>;
/**
 * Synchronous conversion (for simple use cases)
 */
export declare function convertSync(input: string, options?: ConvertOptions): ConversionResult;
export * from './types/index.js';
export * from './config/index.js';
export * from './importer/index.js';
export * from './style/index.js';
export * from './html/index.js';
export { createPolicyEngine, runPolicies, getPolicy, policies, policyMap, registerPolicy, type PolicyConfiguration } from './policy/index.js';
export type { Policy as PolicyInterface, PolicyResult as PolicyResultType, PolicyOptions, PolicyEngineResult, PolicyEngineOptions } from './policy/index.js';
export * from './gutenberg/index.js';
export * from './output/index.js';
//# sourceMappingURL=index.d.ts.map