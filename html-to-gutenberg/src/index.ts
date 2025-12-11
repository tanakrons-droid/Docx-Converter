/**
 * HTML to Gutenberg Converter
 * Main pipeline that orchestrates the conversion process
 */

import { loadFromFile, loadFromString } from './importer/htmlLoader.js';
import { inlineAllStyles, removeStyleTags } from './style/styleInliner.js';
import { cleanHTML, removeGoogleDocsArtifacts, removeWordArtifacts } from './html/htmlCleaner.js';
import { createPolicyEngine, type PolicyConfiguration } from './policy/policyEngine.js';
import { convertToGutenberg } from './gutenberg/gutenbergConverter.js';
import { loadConfig, defaultConfig } from './config/index.js';
import type { 
  ConverterConfig, 
  ConversionResult, 
  ConversionReport 
} from './types/index.js';

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
export async function convert(
  input: string,
  options: ConvertOptions = {}
): Promise<ConversionResult> {
  const startTime = Date.now();

  // Load configuration
  const baseConfig = options.configPath 
    ? loadConfig(options.configPath) 
    : defaultConfig;
  
  const config: ConverterConfig = {
    ...baseConfig,
    ...options.config
  };

  // Initialize report
  const report: ConversionReport = {
    inputFile: options.inputPath || '(string input)',
    outputFile: undefined,
    timestamp: new Date().toISOString(),
    policiesTriggered: [],
    warnings: [],
    errors: [],
    actions: [],
    success: true,
    executionTimeMs: 0
  };

  try {
    // Step 1: Load HTML
    const loadResult = input.trim().startsWith('<') 
      ? loadFromString(input)
      : loadFromFile(input);
    
    let html = loadResult.html;
    if (loadResult.sourcePath) {
      report.inputFile = loadResult.sourcePath;
    }

    // Step 2: Clean HTML first (before style extraction for better parsing)
    html = removeGoogleDocsArtifacts(html);
    html = removeWordArtifacts(html);
    html = cleanHTML(html);

    // Step 3: Inline styles (if enabled) - uses comprehensive style extraction
    if (config.inlineStyles) {
      // Use inlineAllStyles for comprehensive style extraction
      // This handles class, ID, element selectors, and inline styles
      html = inlineAllStyles(html, {
        keepClasses: config.keepClasses,
        applyIdStyles: true,
        applyElementStyles: true
      });
    }

    // Remove style tags after inlining
    html = removeStyleTags(html);

    // Step 5: Run policy engine
    const policyEngine = createPolicyEngine(
      config.policies as PolicyConfiguration,
      { mode: config.mode }
    );
    
    const policyResult = policyEngine.run(html);
    
    html = policyResult.html;
    report.policiesTriggered = policyResult.policiesTriggered;
    report.warnings.push(...policyResult.warnings);
    report.errors.push(...policyResult.errors);
    report.actions.push(...policyResult.actions);

    // Check if policies passed (in strict mode)
    if (config.mode === 'strict' && !policyResult.allPassed) {
      report.success = false;
    }

    // Step 6: Convert to Gutenberg
    const gutenbergHtml = convertToGutenberg(html, {
      preserveStyles: config.inlineStyles
    });

    // Finalize report
    report.executionTimeMs = Date.now() - startTime;

    return {
      html: gutenbergHtml,
      report
    };

  } catch (error) {
    report.success = false;
    report.errors.push(error instanceof Error ? error.message : String(error));
    report.executionTimeMs = Date.now() - startTime;

    return {
      html: '',
      report
    };
  }
}

/**
 * Synchronous conversion (for simple use cases)
 */
export function convertSync(
  input: string,
  options: ConvertOptions = {}
): ConversionResult {
  // Since our current implementation is synchronous, we can just call convert
  // In a real async scenario, this would need different handling
  const startTime = Date.now();

  const baseConfig = options.configPath 
    ? loadConfig(options.configPath) 
    : defaultConfig;
  
  const config: ConverterConfig = {
    ...baseConfig,
    ...options.config
  };

  const report: ConversionReport = {
    inputFile: options.inputPath || '(string input)',
    outputFile: undefined,
    timestamp: new Date().toISOString(),
    policiesTriggered: [],
    warnings: [],
    errors: [],
    actions: [],
    success: true,
    executionTimeMs: 0
  };

  try {
    const loadResult = input.trim().startsWith('<') 
      ? loadFromString(input)
      : loadFromFile(input);
    
    let html = loadResult.html;
    if (loadResult.sourcePath) {
      report.inputFile = loadResult.sourcePath;
    }

    html = removeGoogleDocsArtifacts(html);
    html = removeWordArtifacts(html);
    html = cleanHTML(html);

    if (config.inlineStyles) {
      // Use inlineAllStyles for comprehensive style extraction
      html = inlineAllStyles(html, {
        keepClasses: config.keepClasses,
        applyIdStyles: true,
        applyElementStyles: true
      });
    }

    html = removeStyleTags(html);

    const policyEngine = createPolicyEngine(
      config.policies as PolicyConfiguration,
      { mode: config.mode }
    );
    
    const policyResult = policyEngine.run(html);
    
    html = policyResult.html;
    report.policiesTriggered = policyResult.policiesTriggered;
    report.warnings.push(...policyResult.warnings);
    report.errors.push(...policyResult.errors);
    report.actions.push(...policyResult.actions);

    if (config.mode === 'strict' && !policyResult.allPassed) {
      report.success = false;
    }

    const gutenbergHtml = convertToGutenberg(html, {
      preserveStyles: config.inlineStyles
    });

    report.executionTimeMs = Date.now() - startTime;

    return {
      html: gutenbergHtml,
      report
    };

  } catch (error) {
    report.success = false;
    report.errors.push(error instanceof Error ? error.message : String(error));
    report.executionTimeMs = Date.now() - startTime;

    return {
      html: '',
      report
    };
  }
}

// Re-export modules for direct access
export * from './types/index.js';
export * from './config/index.js';
export * from './importer/index.js';
export * from './style/index.js';
export * from './html/index.js';
export { 
  createPolicyEngine, 
  runPolicies, 
  getPolicy,
  policies,
  policyMap,
  registerPolicy,
  type PolicyConfiguration
} from './policy/index.js';
export type { 
  Policy as PolicyInterface, 
  PolicyResult as PolicyResultType,
  PolicyOptions,
  PolicyEngineResult,
  PolicyEngineOptions
} from './policy/index.js';
export * from './gutenberg/index.js';
export * from './output/index.js';
