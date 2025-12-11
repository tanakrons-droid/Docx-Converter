/**
 * Forbidden Tags Policy
 * Removes or reports forbidden HTML tags
 */

import type { CheerioAPI } from 'cheerio';
import type { Policy, PolicyOptions, PolicyResult } from '../types.js';
import { createSuccessResult, createFailedResult, createWarningResult } from '../types.js';

export interface ForbiddenTagsPolicyOptions extends PolicyOptions {
  /** List of forbidden tag names */
  tags?: string[];
  /** Whether to auto-remove forbidden tags */
  autoRemove?: boolean;
  /** Whether to keep the content when removing tags */
  keepContent?: boolean;
}

const defaultOptions: ForbiddenTagsPolicyOptions = {
  tags: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  autoRemove: true,
  keepContent: false
};

/**
 * Forbidden Tags Policy Implementation
 */
export const forbiddenTagsPolicy: Policy = {
  name: 'forbiddenTags',
  description: 'ตรวจสอบและลบแท็ก HTML ที่ไม่อนุญาต (เช่น script, iframe)',
  priority: 5, // Run early to clean up dangerous content

  apply(html: string, $: CheerioAPI, options: PolicyOptions = {}): PolicyResult {
    const opts = { ...defaultOptions, ...options } as ForbiddenTagsPolicyOptions;
    const forbiddenTags = opts.tags || [];

    // Find all forbidden tags
    const foundTags: { tag: string; count: number }[] = [];

    for (const tag of forbiddenTags) {
      const elements = $(tag);
      if (elements.length > 0) {
        foundTags.push({ tag, count: elements.length });
      }
    }

    // No forbidden tags found
    if (foundTags.length === 0) {
      return createSuccessResult(html);
    }

    // Build summary
    const summary = foundTags.map(t => `${t.tag} (${t.count})`).join(', ');

    if (opts.autoRemove) {
      // Remove forbidden tags
      for (const { tag } of foundTags) {
        $(tag).each((_: number, el: any) => {
          const element = $(el);
          if (opts.keepContent) {
            // Replace with content only
            element.replaceWith(element.contents());
          } else {
            // Remove completely
            element.remove();
          }
        });
      }

      return createWarningResult(
        $.html(),
        [`ลบแท็กที่ไม่อนุญาต: ${summary}`],
        [`removed forbidden tags: ${summary}`]
      );
    }

    // Return error if auto-remove is disabled
    return createFailedResult(
      html,
      [`พบแท็กที่ไม่อนุญาต: ${summary}`]
    );
  }
};

export default forbiddenTagsPolicy;
