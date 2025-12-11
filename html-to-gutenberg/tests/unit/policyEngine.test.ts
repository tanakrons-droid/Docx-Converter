/**
 * Policy Engine Tests
 */

import { describe, it, expect } from 'vitest';
import { createPolicyEngine, runPolicies } from '../../src/policy/policyEngine.js';

describe('PolicyEngine', () => {
  describe('headingPolicy', () => {
    it('should pass when H2 exists', () => {
      const html = '<h2>Heading</h2><p>Content</p>';
      const result = runPolicies(html, {
        requireH2: { enabled: true, options: { minCount: 1 } }
      });
      
      expect(result.allPassed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when H2 is missing in strict mode', () => {
      const html = '<p>Content without heading</p>';
      const result = runPolicies(html, {
        requireH2: { enabled: true, options: { minCount: 1, autoGenerate: false } }
      }, { mode: 'strict' });
      
      expect(result.allPassed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should auto-generate H2 when enabled', () => {
      const html = '<p>Content without heading</p>';
      const result = runPolicies(html, {
        requireH2: { enabled: true, options: { minCount: 1, autoGenerate: true } }
      });
      
      expect(result.html).toContain('<h2>');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.policiesTriggered).toContain('requireH2');
    });
  });

  describe('forbiddenTagsPolicy', () => {
    it('should remove script tags', () => {
      const html = '<p>Hello</p><script>alert("xss")</script>';
      const result = runPolicies(html, {
        forbiddenTags: { enabled: true, options: { tags: ['script'], autoRemove: true } }
      });
      
      expect(result.html).not.toContain('<script>');
      expect(result.policiesTriggered).toContain('forbiddenTags');
    });

    it('should remove iframe tags', () => {
      const html = '<p>Content</p><iframe src="http://evil.com"></iframe>';
      const result = runPolicies(html, {
        forbiddenTags: { enabled: true, options: { tags: ['iframe'], autoRemove: true } }
      });
      
      expect(result.html).not.toContain('<iframe');
    });

    it('should pass when no forbidden tags exist', () => {
      const html = '<p>Clean content</p>';
      const result = runPolicies(html, {
        forbiddenTags: { enabled: true, options: { tags: ['script', 'iframe'] } }
      });
      
      expect(result.allPassed).toBe(true);
      expect(result.policiesTriggered).not.toContain('forbiddenTags');
    });
  });

  describe('disclaimerPolicy', () => {
    it('should add disclaimer when keyword found', () => {
      const html = '<p>Check out our โปรโมชั่น today!</p>';
      const result = runPolicies(html, {
        addDisclaimer: { 
          enabled: true, 
          options: { 
            keywords: ['โปรโมชั่น'],
            position: 'end'
          } 
        }
      });
      
      expect(result.html).toContain('disclaimer-block');
      expect(result.policiesTriggered).toContain('addDisclaimer');
    });

    it('should not add disclaimer when no keywords found', () => {
      const html = '<p>Regular content without special words</p>';
      const result = runPolicies(html, {
        addDisclaimer: { 
          enabled: true, 
          options: { keywords: ['โปรโมชั่น', 'ส่วนลด'] } 
        }
      });
      
      expect(result.html).not.toContain('disclaimer-block');
    });
  });

  describe('Policy Engine Configuration', () => {
    it('should skip disabled policies', () => {
      const html = '<script>bad</script><p>Content</p>';
      const result = runPolicies(html, {
        forbiddenTags: false
      });
      
      // Script should still be there since policy is disabled
      expect(result.html).toContain('<script>');
    });

    it('should run multiple policies in order', () => {
      const html = '<script>bad</script><p>โปรโมชั่น content</p>';
      const result = runPolicies(html, {
        forbiddenTags: { enabled: true, options: { autoRemove: true } },
        addDisclaimer: { enabled: true, options: { keywords: ['โปรโมชั่น'] } }
      });
      
      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('disclaimer-block');
      expect(result.policiesTriggered).toContain('forbiddenTags');
      expect(result.policiesTriggered).toContain('addDisclaimer');
    });
  });
});
