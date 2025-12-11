/**
 * Heading Policy
 * Ensures the document has a minimum number of H2 headings
 */
import type { Policy, PolicyOptions } from '../types.js';
export interface HeadingPolicyOptions extends PolicyOptions {
    /** Minimum number of H2 headings required */
    minCount?: number;
    /** Whether to auto-generate headings if missing */
    autoGenerate?: boolean;
    /** Default heading text when auto-generating */
    defaultHeadingText?: string;
}
/**
 * Heading Policy Implementation
 */
export declare const headingPolicy: Policy;
export default headingPolicy;
//# sourceMappingURL=headingPolicy.d.ts.map