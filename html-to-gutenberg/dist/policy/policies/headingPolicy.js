/**
 * Heading Policy
 * Ensures the document has a minimum number of H2 headings
 */
import { createSuccessResult, createFailedResult, createWarningResult } from '../types.js';
const defaultOptions = {
    minCount: 1,
    autoGenerate: false,
    defaultHeadingText: 'หัวข้อ'
};
/**
 * Heading Policy Implementation
 */
export const headingPolicy = {
    name: 'requireH2',
    description: 'ตรวจสอบว่าบทความมีหัวข้อ H2 อย่างน้อยตามจำนวนที่กำหนด',
    priority: 10,
    apply(html, $, options = {}) {
        const opts = { ...defaultOptions, ...options };
        const minCount = opts.minCount || 1;
        // Count existing H2 headings
        const h2Elements = $('h2');
        const currentCount = h2Elements.length;
        if (currentCount >= minCount) {
            return createSuccessResult(html);
        }
        // Not enough headings
        const missing = minCount - currentCount;
        if (opts.autoGenerate) {
            // Auto-generate missing headings
            // Find the first paragraph and insert heading before it
            const firstParagraph = $('p').first();
            for (let i = 0; i < missing; i++) {
                const headingText = `${opts.defaultHeadingText} ${currentCount + i + 1}`;
                const newHeading = `<h2>${headingText}</h2>`;
                if (firstParagraph.length > 0) {
                    firstParagraph.before(newHeading);
                }
                else {
                    // If no paragraphs, prepend to body or root
                    const body = $('body');
                    if (body.length > 0) {
                        body.prepend(newHeading);
                    }
                    else {
                        $.root().prepend(newHeading);
                    }
                }
            }
            return createWarningResult($.html(), [`เพิ่มหัวข้อ H2 อัตโนมัติ ${missing} หัวข้อ (ต้องการ ${minCount}, มี ${currentCount})`], [`auto-generated ${missing} H2 heading(s)`]);
        }
        // Return error if auto-generate is disabled
        return createFailedResult(html, [`บทความต้องมีหัวข้อ H2 อย่างน้อย ${minCount} หัวข้อ (พบ ${currentCount} หัวข้อ)`]);
    }
};
export default headingPolicy;
//# sourceMappingURL=headingPolicy.js.map