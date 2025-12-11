/**
 * Remove Internal Notes Policy Tests
 */

import { describe, it, expect } from 'vitest';
import { removeInternalNotesPolicy } from '../../src/policy/policies/removeInternalNotesPolicy.js';
import * as cheerio from 'cheerio';

describe('removeInternalNotesPolicy', () => {
  const defaultPatterns = [
    '^\\[([a-z0-9])\\]\\s*',
    '^(To\\s+Team\\s+\\w+\\s*:)',
    '^\\s*@\\w+',
    '^(กราฟิก|Graphic|Image|GRAPHIC|IMAGE)',
    '^\\(\\s*(ฝาก|Note:|Internal:|TODO:|FIXME:)',
    '^(Alt|alt|ALT)\\s*:',
    '^(NOTE\\s+SEO\\s+Writer|NOTE\\s+SEO|note\\s+seo)',
    '^(กราฟิก Zip|ราคากราฟิก|Credit|เครดิต)',
    '^(Landing\\s*:|Link\\s*:|URL\\s*:)',
    '^\\[.*?(ฝาก|Note|Internal|TODO|ทีม|Team)',
  ];

  describe('Pattern matching', () => {
    it('should remove [a] internal notes pattern', () => {
      const html = '<p>[a] ฝากระบุราคา (ให้ทีมเดิมกันทำ AI ตอบเฉพาะ)</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.html).not.toContain('[a]');
    });

    it('should remove "To Team Web:" pattern', () => {
      const html = '<p>To Team Web: Banner+Internallink</p><p>- Allergan https://example.com</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('To Team Web');
    });

    it('should remove "To Team Design:" pattern', () => {
      const html = '<p>To Team Design: Please update the logo</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('To Team Design');
    });

    it('should remove @ mentions pattern', () => {
      const html = '<p>@thitikron.t@vsqclinic.com แก้ไขแล้วนะครับ</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('@thitikron');
    });

    it('should remove "กราฟิก" pattern', () => {
      const html = '<p>กราฟิก Zip</p><p>- Alt: สิตร์บริการ ราคา</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('กราฟิก');
    });

    it('should remove "(ฝาก..." pattern', () => {
      const html = '<p>(ฝากอธิบายเพิ่มเติมเกี่ยวกับ AI)</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('(ฝาก');
    });

    it('should remove "(FIXME:..." pattern', () => {
      const html = '<p>(FIXME: Need to verify this information)</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('FIXME');
    });

    it('should remove Alt: text pattern (from Google Docs)', () => {
      const html = '<p>Alt: รูปสิตร์ ราคา 7,500</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('Alt:');
    });

    it('should remove alt: (lowercase) pattern', () => {
      const html = '<p>alt: image description</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('alt:');
    });

    it('should remove NOTE SEO Writer pattern', () => {
      const html = `
        <p>Some content here</p>
        <p>NOTE SEO Writer</p>
        <p>This should be removed</p>
      `;
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('NOTE SEO Writer');
    });

    it('should remove note seo (lowercase) pattern', () => {
      const html = '<p>note seo</p><p>Real content</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('note seo');
      expect(result.html).toContain('Real content');
    });

    it('should remove "กราฟิก Zip" pattern', () => {
      const html = `
        <p>กราฟิก Zip</p>
        <p>- Alt: สิตร์บริการ ราคา 7,500</p>
      `;
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('กราฟิก Zip');
    });

    it('should remove Landing: pattern', () => {
      const html = '<p>Landing: https://example.com/special-offer</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('Landing:');
    });

    it('should remove Link: pattern', () => {
      const html = '<p>Link: https://example.com/product</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('Link:');
    });

    it('should remove [bracketed team notes] pattern', () => {
      const html = '<p>[ฝากอธิบายเพิ่มเติม]</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('[ฝาก');
    });
  });

  describe('Container cleanup', () => {
    it('should remove empty containers after text removal', () => {
      const html = '<p>[a] ฝากระบุ</p><p>Real content here</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        removeEmptyContainers: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      // The first paragraph should be removed entirely
      const resultHtml = result.html;
      expect(resultHtml).toContain('Real content here');
    });

    it('should preserve non-empty containers', () => {
      const html = '<p>Text before<br/>[a] ฝากระบุ<br/>Text after</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        removeEmptyContainers: false,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).toContain('Text before');
      expect(result.html).toContain('Text after');
    });
  });

  describe('Edge cases', () => {
    it('should handle no internal notes', () => {
      const html = '<h2>Section Title</h2><p>This is normal content about the service.</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBe(0);
      expect(result.html).toContain('normal content');
    });

    it('should handle multiple internal notes in one document', () => {
      const html = `
        <p>[a] ฝากระบุราคา</p>
        <p>Good content here</p>
        <p>To Team Web: Add links</p>
        <p>More good content</p>
        <p>กราฟิก</p>
      `;
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        removeEmptyContainers: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.html).toContain('Good content here');
      expect(result.html).not.toContain('[a]');
      expect(result.html).not.toContain('To Team Web');
      expect(result.html).not.toContain('กราฟิก');
    });

    it('should handle mixed Thai and English internal notes', () => {
      const html = `
        <div>
          <p>Valid content</p>
          <p>To Team Web: Banner+Internallink</p>
          <p>More valid content</p>
          <p>[b] @thitikron.t@vsqclinic.com</p>
        </div>
      `;
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        removeEmptyContainers: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).toContain('Valid content');
      expect(result.html).not.toContain('To Team Web');
      expect(result.html).not.toContain('@thitikron');
    });

    it('should be case-insensitive', () => {
      const html = '<p>GRAPHIC IMAGE</p><p>Real Content</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('GRAPHIC IMAGE');
      expect(result.html).toContain('Real Content');
    });
  });

  describe('Auto-remove flag', () => {
    it('should fail when autoRemove is false', () => {
      const html = '<p>[a] ฝากระบุ</p>';
      const $ = cheerio.load(html, { decodeEntities: false });
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: false,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.html).toContain('[a]');
    });
  });

  describe('Policy metadata', () => {
    it('should have correct name', () => {
      expect(removeInternalNotesPolicy.name).toBe('removeInternalNotes');
    });

    it('should have correct priority', () => {
      expect(removeInternalNotesPolicy.priority).toBe(8);
    });

    it('should have description', () => {
      expect(removeInternalNotesPolicy.description).toBeTruthy();
    });
  });

  describe('Google Docs cmnt_ref removal', () => {
    it('should remove elements with cmnt_ref links', () => {
      const html = `
        <p>Normal content here</p>
        <p>This is a comment: <a href="#cmnt_ref1" id="cmnt1">[a]</a> with reference</p>
        <p>More normal content</p>
      `;
      const $ = cheerio.load(html);
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).toContain('Normal content');
      expect(result.html).not.toContain('cmnt_ref');
      expect(result.html).not.toContain('[a]');
    });

    it('should remove entire paragraph containing cmnt_ref link', () => {
      const html = '<p>This entire paragraph <a href="#cmnt_ref2" id="cmnt2">[b]</a> should be removed</p>';
      const $ = cheerio.load(html);
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).not.toContain('This entire paragraph');
      expect(result.html).not.toContain('cmnt_ref');
    });

    it('should handle multiple comment references', () => {
      const html = `
        <p>First comment <a href="#cmnt_ref1" id="cmnt1">[a]</a></p>
        <p>Second comment <a href="#cmnt_ref2" id="cmnt2">[b]</a></p>
        <p>Normal text without comments</p>
      `;
      const $ = cheerio.load(html);
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).toContain('Normal text without comments');
      expect(result.html).not.toContain('cmnt_ref');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should not break elements without cmnt_ref', () => {
      const html = '<p><a href="https://example.com">Normal link</a></p>';
      const $ = cheerio.load(html);
      
      const result = removeInternalNotesPolicy.apply(html, $, {
        autoRemove: true,
        patterns: defaultPatterns
      });

      expect(result.passed).toBe(true);
      expect(result.html).toContain('example.com');
    });
  });
});
