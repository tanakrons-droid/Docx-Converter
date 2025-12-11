/**
 * Remove Before H1 Policy
 * Removes all content that appears before the first H1 heading
 */
import { createSuccessResult, createWarningResult } from '../types.js';
const defaultOptions = {
    autoRemove: true
};
/**
 * Remove Before H1 Policy Implementation
 */
export const removeBeforeH1Policy = {
    name: 'removeBeforeH1',
    description: 'ลบเนื้อหาทั้งหมดที่อยู่ก่อนหัวข้อ H1 แรก',
    priority: 3, // Run early, after forbidden tags but before other content policies
    apply(html, $, options = {}) {
        const opts = { ...defaultOptions, ...options };
        // Find the first H1 element
        const firstH1 = $('h1').first();
        // If no H1 found, pass without changes
        if (firstH1.length === 0) {
            return createSuccessResult(html);
        }
        if (!opts.autoRemove) {
            return createSuccessResult(html);
        }
        // Count elements before H1
        let removedCount = 0;
        const removedElements = [];
        // Get all siblings before the H1
        firstH1.prevAll().each((_, el) => {
            const tagName = $(el).prop('tagName')?.toLowerCase();
            if (tagName) {
                removedElements.push(tagName);
            }
            removedCount++;
            $(el).remove();
        });
        // Also check if H1 is nested inside other elements
        // We need to remove content before H1's parent containers
        let parent = firstH1.parent();
        while (parent.length > 0 && parent.prop('tagName')?.toLowerCase() !== 'body') {
            parent.prevAll().each((_, el) => {
                const tagName = $(el).prop('tagName')?.toLowerCase();
                if (tagName) {
                    removedElements.push(tagName);
                }
                removedCount++;
                $(el).remove();
            });
            parent = parent.parent();
        }
        // Remove the first H1 itself
        removedElements.push('h1');
        removedCount++;
        firstH1.remove();
        const uniqueTags = [...new Set(removedElements)].join(', ');
        return createWarningResult($.html(), [`ลบเนื้อหาก่อน H1 และ H1 แรก จำนวน ${removedCount} รายการ (แท็ก: ${uniqueTags})`], [`removed ${removedCount} element(s) before and including first H1`]);
    }
};
//# sourceMappingURL=removeBeforeH1Policy.js.map