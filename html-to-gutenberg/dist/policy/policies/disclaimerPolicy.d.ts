/**
 * Disclaimer Policy
 * Automatically adds disclaimer blocks when certain keywords are found
 */
import type { Policy, PolicyOptions } from '../types.js';
export interface DisclaimerPolicyOptions extends PolicyOptions {
    /** Keywords that trigger disclaimer insertion */
    keywords?: string[];
    /** Disclaimer HTML content */
    disclaimerHtml?: string;
    /** Where to insert the disclaimer: 'start', 'end', or 'after-keyword' */
    position?: 'start' | 'end' | 'after-keyword';
    /** CSS class for the disclaimer block */
    disclaimerClass?: string;
}
/**
 * Disclaimer Policy Implementation
 */
export declare const disclaimerPolicy: Policy;
export default disclaimerPolicy;
//# sourceMappingURL=disclaimerPolicy.d.ts.map