/**
 * Minimum Image Policy
 * Ensures the document has a minimum number of images
 */
import type { Policy, PolicyOptions } from '../types.js';
export interface MinImagePolicyOptions extends PolicyOptions {
    /** Minimum number of images required */
    minCount?: number;
    /** Whether to auto-insert placeholder image if missing */
    autoInsertPlaceholder?: boolean;
    /** Placeholder image URL */
    placeholderUrl?: string;
    /** Placeholder image alt text */
    placeholderAlt?: string;
}
/**
 * Minimum Image Policy Implementation
 */
export declare const minImagePolicy: Policy;
export default minImagePolicy;
//# sourceMappingURL=minImagePolicy.d.ts.map