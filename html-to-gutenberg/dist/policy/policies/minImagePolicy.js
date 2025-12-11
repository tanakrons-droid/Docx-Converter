/**
 * Minimum Image Policy
 * Ensures the document has a minimum number of images
 */
import { createSuccessResult, createFailedResult, createWarningResult } from '../types.js';
const defaultOptions = {
    minCount: 1,
    autoInsertPlaceholder: false,
    placeholderUrl: 'https://via.placeholder.com/800x400?text=Image+Placeholder',
    placeholderAlt: 'รูปภาพประกอบบทความ'
};
/**
 * Minimum Image Policy Implementation
 */
export const minImagePolicy = {
    name: 'minImageCount',
    description: 'ตรวจสอบว่าบทความมีรูปภาพอย่างน้อยตามจำนวนที่กำหนด',
    priority: 20,
    apply(html, $, options = {}) {
        const opts = { ...defaultOptions, ...options };
        const minCount = opts.minCount || 0;
        // If minCount is 0, always pass
        if (minCount === 0) {
            return createSuccessResult(html);
        }
        // Count existing images
        const images = $('img');
        const currentCount = images.length;
        if (currentCount >= minCount) {
            return createSuccessResult(html);
        }
        // Not enough images
        const missing = minCount - currentCount;
        if (opts.autoInsertPlaceholder) {
            // Find the first H2 or first paragraph to insert after
            const insertAfter = $('h2').first().length > 0
                ? $('h2').first()
                : $('p').first();
            for (let i = 0; i < missing; i++) {
                const placeholderImg = `<figure><img src="${opts.placeholderUrl}" alt="${opts.placeholderAlt}" /><figcaption>กรุณาเพิ่มรูปภาพ</figcaption></figure>`;
                if (insertAfter.length > 0) {
                    insertAfter.after(placeholderImg);
                }
                else {
                    // If no suitable element, prepend to body
                    const body = $('body');
                    if (body.length > 0) {
                        body.prepend(placeholderImg);
                    }
                    else {
                        $.root().prepend(placeholderImg);
                    }
                }
            }
            return createWarningResult($.html(), [`เพิ่มรูปภาพ placeholder ${missing} รูป (ต้องการ ${minCount}, มี ${currentCount}) - กรุณาแทนที่ด้วยรูปจริง`], [`auto-inserted ${missing} placeholder image(s)`]);
        }
        // Return error if auto-insert is disabled
        return createFailedResult(html, [`บทความต้องมีรูปภาพอย่างน้อย ${minCount} รูป (พบ ${currentCount} รูป)`]);
    }
};
export default minImagePolicy;
//# sourceMappingURL=minImagePolicy.js.map