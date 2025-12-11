/**
 * Policy Registry
 * Central registry for all available policies
 */
import type { Policy } from '../types.js';
/**
 * All available policies
 */
export declare const policies: Policy[];
/**
 * Policy map for quick lookup by name
 */
export declare const policyMap: Map<string, Policy>;
/**
 * Get a policy by name
 */
export declare function getPolicy(name: string): Policy | undefined;
/**
 * Get all policy names
 */
export declare function getPolicyNames(): string[];
/**
 * Register a custom policy
 */
export declare function registerPolicy(policy: Policy): void;
export { headingPolicy } from './headingPolicy.js';
export { minImagePolicy } from './minImagePolicy.js';
export { disclaimerPolicy } from './disclaimerPolicy.js';
export { forbiddenTagsPolicy } from './forbiddenTagsPolicy.js';
export { removeBeforeH1Policy } from './removeBeforeH1Policy.js';
export { removeInternalNotesPolicy } from './removeInternalNotesPolicy.js';
//# sourceMappingURL=index.d.ts.map