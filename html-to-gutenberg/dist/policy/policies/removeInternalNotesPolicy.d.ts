/**
 * Remove Internal Notes Policy
 * Removes internal notes, comments, team messages, and work-related annotations
 * that should not be published
 *
 * Patterns to match:
 * - [a] ฝากระบุ... (internal notes with [letter] prefix)
 * - [b] @thitikron... (comments with @ mentions)
 * - To Team Web: ... (team-specific instructions)
 * - To Team Design: ... (team-specific instructions)
 * - กราฟิก Zip (graphic notes with credit)
 * - Alt: text (image alt text notes)
 * - NOTE SEO Writer (end marker for content)
 * - Landing: / Link: (internal URLs for team)
 * - (ฝาก...) (parenthetical notes)
 */
import type { Policy, PolicyOptions } from '../types.js';
export interface RemoveInternalNotesPolicyOptions extends PolicyOptions {
    /** Whether to auto-remove internal notes */
    autoRemove?: boolean;
    /** Patterns to detect as internal notes (regex strings) */
    patterns?: string[];
    /** Whether to also remove container elements that become empty */
    removeEmptyContainers?: boolean;
}
/**
 * Remove Internal Notes Policy Implementation
 */
export declare const removeInternalNotesPolicy: Policy;
export default removeInternalNotesPolicy;
//# sourceMappingURL=removeInternalNotesPolicy.d.ts.map