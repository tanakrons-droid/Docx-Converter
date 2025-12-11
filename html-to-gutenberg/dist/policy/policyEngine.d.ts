/**
 * Policy Engine
 * Runs all enabled policies against HTML content
 */
import type { PolicyOptions, PolicyEngineResult, PolicyEngineOptions } from './types.js';
import { getPolicy } from './policies/index.js';
export interface PolicyConfiguration {
    [policyName: string]: boolean | {
        enabled: boolean;
        options?: PolicyOptions;
    };
}
/**
 * Policy Engine class
 */
export declare class PolicyEngine {
    private options;
    private policyConfig;
    constructor(policyConfig?: PolicyConfiguration, options?: Partial<PolicyEngineOptions>);
    /**
     * Run all enabled policies against HTML
     */
    run(html: string): PolicyEngineResult;
    /**
     * Get list of enabled policies with their options, sorted by priority
     */
    private getEnabledPolicies;
    /**
     * Check if a specific policy is enabled
     */
    isPolicyEnabled(policyName: string): boolean;
    /**
     * Enable a policy
     */
    enablePolicy(policyName: string, options?: PolicyOptions): void;
    /**
     * Disable a policy
     */
    disablePolicy(policyName: string): void;
    /**
     * Get current policy configuration
     */
    getConfig(): PolicyConfiguration;
    /**
     * Update engine options
     */
    setOptions(options: Partial<PolicyEngineOptions>): void;
}
/**
 * Create a policy engine with default configuration
 */
export declare function createPolicyEngine(config?: PolicyConfiguration, options?: Partial<PolicyEngineOptions>): PolicyEngine;
/**
 * Run policies with a simple function call
 */
export declare function runPolicies(html: string, config?: PolicyConfiguration, options?: Partial<PolicyEngineOptions>): PolicyEngineResult;
export { getPolicy };
//# sourceMappingURL=policyEngine.d.ts.map