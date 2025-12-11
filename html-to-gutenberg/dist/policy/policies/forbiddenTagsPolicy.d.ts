/**
 * Forbidden Tags Policy
 * Removes or reports forbidden HTML tags
 */
import type { Policy, PolicyOptions } from '../types.js';
export interface ForbiddenTagsPolicyOptions extends PolicyOptions {
    /** List of forbidden tag names */
    tags?: string[];
    /** Whether to auto-remove forbidden tags */
    autoRemove?: boolean;
    /** Whether to keep the content when removing tags */
    keepContent?: boolean;
}
/**
 * Forbidden Tags Policy Implementation
 */
export declare const forbiddenTagsPolicy: Policy;
export default forbiddenTagsPolicy;
//# sourceMappingURL=forbiddenTagsPolicy.d.ts.map