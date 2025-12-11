/**
 * Policy Engine
 * Runs all enabled policies against HTML content
 */

import * as cheerio from 'cheerio';
import type { 
  Policy, 
  PolicyOptions, 
  PolicyEngineResult, 
  PolicyEngineOptions,
  PolicyResult
} from './types.js';
import { policies, getPolicy } from './policies/index.js';

const defaultEngineOptions: PolicyEngineOptions = {
  mode: 'relaxed',
  stopOnError: false
};

export interface PolicyConfiguration {
  [policyName: string]: boolean | {
    enabled: boolean;
    options?: PolicyOptions;
  };
}

/**
 * Normalize policy configuration
 */
function normalizeConfig(
  config: boolean | { enabled: boolean; options?: PolicyOptions }
): { enabled: boolean; options: PolicyOptions } {
  if (typeof config === 'boolean') {
    return { enabled: config, options: {} };
  }
  return { enabled: config.enabled, options: config.options || {} };
}

/**
 * Policy Engine class
 */
export class PolicyEngine {
  private options: PolicyEngineOptions;
  private policyConfig: PolicyConfiguration;

  constructor(
    policyConfig: PolicyConfiguration = {},
    options: Partial<PolicyEngineOptions> = {}
  ) {
    this.options = { ...defaultEngineOptions, ...options };
    this.policyConfig = policyConfig;
  }

  /**
   * Run all enabled policies against HTML
   */
  run(html: string): PolicyEngineResult {
    const result: PolicyEngineResult = {
      html,
      warnings: [],
      errors: [],
      policiesTriggered: [],
      actions: [],
      allPassed: true
    };

    // Get enabled policies sorted by priority
    const enabledPolicies = this.getEnabledPolicies();

    // Create cheerio instance
    let $ = cheerio.load(html);
    let currentHtml = html;

    for (const { policy, options } of enabledPolicies) {
      try {
        // Apply policy
        const policyResult: PolicyResult = policy.apply(currentHtml, $, options);

        // Collect results
        result.warnings.push(...policyResult.warnings);
        result.errors.push(...policyResult.errors);
        result.actions.push(...policyResult.actions);

        // Track if policy was triggered (made changes or had issues)
        if (
          policyResult.actions.length > 0 ||
          policyResult.warnings.length > 0 ||
          policyResult.errors.length > 0
        ) {
          result.policiesTriggered.push(policy.name);
        }

        // Update HTML if policy made changes
        if (policyResult.html !== currentHtml) {
          currentHtml = policyResult.html;
          $ = cheerio.load(currentHtml);
        }

        // Handle policy failure
        if (!policyResult.passed) {
          result.allPassed = false;

          if (this.options.mode === 'strict' && this.options.stopOnError) {
            // Stop processing in strict mode
            break;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Policy "${policy.name}" threw an error: ${errorMessage}`);
        result.allPassed = false;

        if (this.options.mode === 'strict' && this.options.stopOnError) {
          break;
        }
      }
    }

    result.html = currentHtml;
    return result;
  }

  /**
   * Get list of enabled policies with their options, sorted by priority
   */
  private getEnabledPolicies(): Array<{ policy: Policy; options: PolicyOptions }> {
    const enabled: Array<{ policy: Policy; options: PolicyOptions }> = [];

    // Check each registered policy
    for (const policy of policies) {
      const config = this.policyConfig[policy.name];

      // Skip if explicitly disabled
      if (config === false) {
        continue;
      }

      // If no config, use default (enabled with no options)
      if (config === undefined || config === true) {
        enabled.push({ policy, options: {} });
        continue;
      }

      // Use configured options
      const normalized = normalizeConfig(config);
      if (normalized.enabled) {
        enabled.push({ policy, options: normalized.options });
      }
    }

    // Sort by priority (lower = first)
    enabled.sort((a, b) => (a.policy.priority || 100) - (b.policy.priority || 100));

    return enabled;
  }

  /**
   * Check if a specific policy is enabled
   */
  isPolicyEnabled(policyName: string): boolean {
    const config = this.policyConfig[policyName];
    if (config === undefined || config === true) {
      return true;
    }
    if (config === false) {
      return false;
    }
    return config.enabled;
  }

  /**
   * Enable a policy
   */
  enablePolicy(policyName: string, options?: PolicyOptions): void {
    this.policyConfig[policyName] = {
      enabled: true,
      options: options || {}
    };
  }

  /**
   * Disable a policy
   */
  disablePolicy(policyName: string): void {
    this.policyConfig[policyName] = false;
  }

  /**
   * Get current policy configuration
   */
  getConfig(): PolicyConfiguration {
    return { ...this.policyConfig };
  }

  /**
   * Update engine options
   */
  setOptions(options: Partial<PolicyEngineOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Create a policy engine with default configuration
 */
export function createPolicyEngine(
  config: PolicyConfiguration = {},
  options: Partial<PolicyEngineOptions> = {}
): PolicyEngine {
  return new PolicyEngine(config, options);
}

/**
 * Run policies with a simple function call
 */
export function runPolicies(
  html: string,
  config: PolicyConfiguration = {},
  options: Partial<PolicyEngineOptions> = {}
): PolicyEngineResult {
  const engine = createPolicyEngine(config, options);
  return engine.run(html);
}

export { getPolicy };
