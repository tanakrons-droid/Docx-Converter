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
import { createSuccessResult, createFailedResult, createWarningResult } from '../types.js';
const defaultOptions = {
    autoRemove: true,
    removeEmptyContainers: true,
    patterns: [
        // Pattern 1: [a], [b], [c], etc. with descriptive text (internal notes)
        '^\\[([a-z0-9])\\]\\s*',
        // Pattern 2: To Team Web:, To Team Design: (team instructions)
        '^(To\\s+Team\\s+\\w+\\s*:)',
        // Pattern 3: @ mentions like @thitikron... (comments)
        '^\\s*@\\w+',
        // Pattern 4: Standalone graphic notes (กราฟิก, Graphic, Image, etc.)
        '^(กราฟิก|Graphic|Image|GRAPHIC|IMAGE)',
        // Pattern 5: Internal notes in parentheses
        '^\\(\\s*(ฝาก|Note:|Internal:|TODO:|FIXME:)',
        // Pattern 6: Alt: alt text patterns (from Google Docs images)
        '^(Alt|alt|ALT)\\s*:',
        // Pattern 7: NOTE SEO Writer (end marker for content)
        '^(NOTE\\s+SEO\\s+Writer|NOTE\\s+SEO|note\\s+seo)',
        // Pattern 8: Graphics/Images with credit information
        '^(กราฟิก Zip|ราคากราฟิก|Credit|เครดิต)',
        // Pattern 9: Landing URL patterns
        '^(Landing\\s*:|Link\\s*:|URL\\s*:)',
        // Pattern 10: Writer notes with square brackets and keywords
        '^\\[.*?(ฝาก|Note|Internal|TODO|ทีม|Team)',
    ]
};
/**
 * Check if text matches any internal note pattern
 */
function isInternalNote(text, patterns) {
    const trimmed = text.trim();
    for (const patternStr of patterns) {
        try {
            const regex = new RegExp(patternStr, 'i');
            if (regex.test(trimmed)) {
                return true;
            }
        }
        catch (e) {
            console.warn(`Invalid regex pattern: ${patternStr}`, e);
        }
    }
    return false;
}
/**
 * Remove Internal Notes Policy Implementation
 */
export const removeInternalNotesPolicy = {
    name: 'removeInternalNotes',
    description: 'ลบข้อความประเภทคำสั่งงานภายใน คอมเมนต์ หมายเหตุทีม และข้อความอื่นที่ไม่ควรเผยแพร่',
    priority: 8, // Run early, after basic cleanup but before content validation
    apply(html, $, options = {}) {
        const opts = { ...defaultOptions, ...options };
        const patterns = opts.patterns || [];
        const foundNotes = [];
        const removedTexts = [];
        // Strategy 0: Remove ALL comment references (cmnt_ref)
        // Google Docs comments are referenced by href="#cmnt_ref*"
        // Remove entire paragraphs or elements containing these references
        $('a[href*="cmnt_ref"]').closest('p, div, li, td').each((_, el) => {
            const element = $(el);
            const text = element.text().trim();
            if (text.length > 0) {
                const sample = text.substring(0, 60);
                removedTexts.push(sample + (text.length > 60 ? '...' : ''));
                element.remove();
                if (!foundNotes.find(n => n.selector === 'cmnt_ref')) {
                    foundNotes.push({ type: 'element', selector: 'cmnt_ref', count: 1 });
                }
                else {
                    const match = foundNotes.find(n => n.selector === 'cmnt_ref');
                    if (match)
                        match.count++;
                }
            }
        });
        // Strategy 0b: Remove comment anchors like <a href="#cmnt_ref1" id="cmnt1">[a]</a>
        // These are Google Docs comments converted to HTML
        $('a[id^="cmnt"]').each((_, el) => {
            const element = $(el);
            const text = element.text().trim();
            // Check if this is a comment marker like [a], [b], [c], etc.
            if (/^\[([a-z0-9])\]$/i.test(text)) {
                removedTexts.push(text);
                element.remove();
                if (!foundNotes.find(n => n.selector === 'a.cmnt')) {
                    foundNotes.push({ type: 'element', selector: 'a.cmnt', count: 1 });
                }
                else {
                    const match = foundNotes.find(n => n.selector === 'a.cmnt');
                    if (match)
                        match.count++;
                }
            }
        });
        // Strategy 1: Check for elements that contain internal note patterns
        // Look for paragraphs, divs, and table cells that start with internal note patterns
        const selectors = ['p', 'div', 'td', 'li', 'span'];
        for (const selector of selectors) {
            $(selector).each((_, el) => {
                const element = $(el);
                const text = element.text().trim();
                // Skip empty elements
                if (!text)
                    return;
                // Check if entire element content matches internal note pattern
                if (isInternalNote(text, patterns)) {
                    const sample = text.substring(0, 60);
                    removedTexts.push(sample + (text.length > 60 ? '...' : ''));
                    element.remove();
                    if (!foundNotes.find(n => n.selector === selector)) {
                        foundNotes.push({ type: 'element', selector, count: 1 });
                    }
                    else {
                        const match = foundNotes.find(n => n.selector === selector);
                        if (match)
                            match.count++;
                    }
                }
            });
        }
        // Strategy 2: Check for inline text nodes that match patterns within larger elements
        // This handles cases where internal notes are mixed with other content
        $('p, div, li, td').each((_, el) => {
            const element = $(el);
            const contents = element.contents();
            contents.each((_, node) => {
                if (node.type === 'text') {
                    const text = node.data;
                    const lines = text.split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed && isInternalNote(trimmed, patterns)) {
                            removedTexts.push(trimmed.substring(0, 60));
                            node.data = ''; // Clear the text node
                        }
                    }
                }
            });
            // Clean up empty text nodes
            contents.each((_, node) => {
                if (node.type === 'text' && !node.data.trim()) {
                    $(node).remove();
                }
            });
        });
        // Strategy 3: Remove elements that became empty after text removal
        if (opts.removeEmptyContainers) {
            let changed = true;
            while (changed) {
                changed = false;
                $('p, div, li, td').each((_, el) => {
                    const element = $(el);
                    const text = element.text().trim();
                    const html = element.html()?.trim() || '';
                    // Remove if truly empty or only contains whitespace/nbsp
                    if (!text && (!html || html === '&nbsp;' || html.match(/^(\s|&nbsp;|<br\s*\/?>\s*)*$/i))) {
                        element.remove();
                        changed = true;
                    }
                });
            }
        }
        // No internal notes found
        if (foundNotes.length === 0 && removedTexts.length === 0) {
            return createSuccessResult(html);
        }
        if (opts.autoRemove) {
            const summary = foundNotes
                .map(n => `${n.selector}(${n.count})`)
                .join(', ') || 'text nodes';
            const message = removedTexts.length > 0
                ? `ลบข้อความภายใน ${removedTexts.length} รายการ: ${removedTexts.slice(0, 3).join(' | ')}`
                : `ลบข้อความภายใน: ${summary}`;
            return createWarningResult($.html(), [message], [`removed ${removedTexts.length} internal note(s)`]);
        }
        // Return error if auto-remove is disabled
        const summary = foundNotes
            .map(n => `${n.selector}(${n.count})`)
            .join(', ') || 'text nodes';
        return createFailedResult(html, [`พบข้อความภายใน ${removedTexts.length} รายการที่ต้องลบ: ${summary}`]);
    }
};
export default removeInternalNotesPolicy;
//# sourceMappingURL=removeInternalNotesPolicy.js.map