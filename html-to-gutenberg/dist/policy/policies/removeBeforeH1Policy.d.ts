/**
 * Remove Before H1 Policy
 * Removes all content that appears before the first H1 heading
 */
import type { Policy, PolicyOptions } from '../types.js';
export interface RemoveBeforeH1PolicyOptions extends PolicyOptions {
    /** Whether to auto-remove content before H1 */
    autoRemove?: boolean;
}
/**
 * Remove Before H1 Policy Implementation
 */
export declare const removeBeforeH1Policy: Policy;
//# sourceMappingURL=removeBeforeH1Policy.d.ts.map