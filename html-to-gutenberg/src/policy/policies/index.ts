/**
 * Policy Registry
 * Central registry for all available policies
 */

import type { Policy } from '../types.js';
import { headingPolicy } from './headingPolicy.js';
import { minImagePolicy } from './minImagePolicy.js';
import { disclaimerPolicy } from './disclaimerPolicy.js';
import { forbiddenTagsPolicy } from './forbiddenTagsPolicy.js';
import { removeBeforeH1Policy } from './removeBeforeH1Policy.js';
import { removeInternalNotesPolicy } from './removeInternalNotesPolicy.js';

/**
 * All available policies
 */
export const policies: Policy[] = [
  removeInternalNotesPolicy,
  forbiddenTagsPolicy,
  removeBeforeH1Policy,
  headingPolicy,
  minImagePolicy,
  disclaimerPolicy
];

/**
 * Policy map for quick lookup by name
 */
export const policyMap: Map<string, Policy> = new Map(
  policies.map(p => [p.name, p])
);

/**
 * Get a policy by name
 */
export function getPolicy(name: string): Policy | undefined {
  return policyMap.get(name);
}

/**
 * Get all policy names
 */
export function getPolicyNames(): string[] {
  return policies.map(p => p.name);
}

/**
 * Register a custom policy
 */
export function registerPolicy(policy: Policy): void {
  if (policyMap.has(policy.name)) {
    console.warn(`Policy "${policy.name}" already exists and will be overwritten`);
  }
  policyMap.set(policy.name, policy);
  
  // Add to policies array if not exists
  const existingIndex = policies.findIndex(p => p.name === policy.name);
  if (existingIndex >= 0) {
    policies[existingIndex] = policy;
  } else {
    policies.push(policy);
  }
}

// Export individual policies
export { headingPolicy } from './headingPolicy.js';
export { minImagePolicy } from './minImagePolicy.js';
export { disclaimerPolicy } from './disclaimerPolicy.js';
export { forbiddenTagsPolicy } from './forbiddenTagsPolicy.js';
export { removeBeforeH1Policy } from './removeBeforeH1Policy.js';
export { removeInternalNotesPolicy } from './removeInternalNotesPolicy.js';
