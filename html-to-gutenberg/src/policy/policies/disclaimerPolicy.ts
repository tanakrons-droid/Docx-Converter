/**
 * Disclaimer Policy
 * Automatically adds disclaimer blocks when certain keywords are found
 */

import type { CheerioAPI } from 'cheerio';
import type { Policy, PolicyOptions, PolicyResult } from '../types.js';
import { createSuccessResult, createWarningResult } from '../types.js';

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

const defaultOptions: DisclaimerPolicyOptions = {
  keywords: ['โปรโมชั่น', 'ส่วนลด', 'ราคาพิเศษ', 'ข้อเสนอพิเศษ', 'promotion', 'discount'],
  disclaimerHtml: `
    <div class="disclaimer-block" style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <strong>⚠️ หมายเหตุ:</strong> โปรโมชั่นและราคาพิเศษที่กล่าวถึงในบทความนี้อาจมีการเปลี่ยนแปลง กรุณาตรวจสอบข้อมูลล่าสุดก่อนตัดสินใจ
    </div>
  `.trim(),
  position: 'end',
  disclaimerClass: 'disclaimer-block'
};

/**
 * Disclaimer Policy Implementation
 */
export const disclaimerPolicy: Policy = {
  name: 'addDisclaimer',
  description: 'เพิ่ม Disclaimer อัตโนมัติเมื่อพบคำที่กำหนด (เช่น โปรโมชั่น, ส่วนลด)',
  priority: 50,

  apply(html: string, $: CheerioAPI, options: PolicyOptions = {}): PolicyResult {
    const opts = { ...defaultOptions, ...options } as DisclaimerPolicyOptions;
    const keywords = opts.keywords || [];

    // Check if disclaimer already exists
    const existingDisclaimer = $(`.${opts.disclaimerClass}`);
    if (existingDisclaimer.length > 0) {
      return createSuccessResult(html);
    }

    // Get all text content
    const textContent = $('body').text() || $.root().text();
    
    // Check for keywords
    const foundKeywords: string[] = [];
    for (const keyword of keywords) {
      if (textContent.toLowerCase().includes(keyword.toLowerCase())) {
        foundKeywords.push(keyword);
      }
    }

    // No keywords found, pass without changes
    if (foundKeywords.length === 0) {
      return createSuccessResult(html);
    }

    // Insert disclaimer based on position
    const disclaimerHtml = opts.disclaimerHtml || '';

    switch (opts.position) {
      case 'start': {
        const body = $('body');
        if (body.length > 0) {
          body.prepend(disclaimerHtml);
        } else {
          $.root().prepend(disclaimerHtml);
        }
        break;
      }
      
      case 'end': {
        const body = $('body');
        if (body.length > 0) {
          body.append(disclaimerHtml);
        } else {
          $.root().append(disclaimerHtml);
        }
        break;
      }
      
      case 'after-keyword': {
        // Find the first paragraph containing a keyword and insert after it
        let inserted = false;
        $('p').each((_, el) => {
          if (inserted) return;
          
          const text = $(el).text().toLowerCase();
          for (const keyword of foundKeywords) {
            if (text.includes(keyword.toLowerCase())) {
              $(el).after(disclaimerHtml);
              inserted = true;
              break;
            }
          }
        });
        
        // Fallback to end if no suitable paragraph found
        if (!inserted) {
          const body = $('body');
          if (body.length > 0) {
            body.append(disclaimerHtml);
          } else {
            $.root().append(disclaimerHtml);
          }
        }
        break;
      }
    }

    return createWarningResult(
      $.html(),
      [`เพิ่ม Disclaimer อัตโนมัติเนื่องจากพบคำ: ${foundKeywords.join(', ')}`],
      [`auto-inserted disclaimer for keywords: ${foundKeywords.join(', ')}`]
    );
  }
};

export default disclaimerPolicy;
