/**
 * HTML Cleaner Tests
 */

import { describe, it, expect } from 'vitest';
import { cleanHTML, removeGoogleDocsArtifacts, removeWordArtifacts } from '../../src/html/htmlCleaner.js';

describe('cleanHTML', () => {
  it('should remove script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const result = cleanHTML(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('should remove style tags', () => {
    const input = '<style>.c1 { color: red; }</style><p class="c1">Text</p>';
    const result = cleanHTML(input);
    expect(result).not.toContain('<style>');
    expect(result).toContain('Text');
  });

  it('should remove empty paragraphs', () => {
    const input = '<p>Content</p><p></p><p>   </p><p>&nbsp;</p><p>More</p>';
    const result = cleanHTML(input);
    expect(result).toContain('Content');
    expect(result).toContain('More');
    // Empty paragraphs should be removed
    const pCount = (result.match(/<p/g) || []).length;
    expect(pCount).toBe(2);
  });

  it('should remove empty spans', () => {
    const input = '<p>Hello <span></span> World</p>';
    const result = cleanHTML(input);
    expect(result).not.toContain('<span></span>');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('should remove meta tags', () => {
    const input = '<meta charset="utf-8"><p>Content</p>';
    const result = cleanHTML(input);
    expect(result).not.toContain('<meta');
    expect(result).toContain('Content');
  });

  it('should extract body content', () => {
    const input = '<html><head><title>Test</title></head><body><p>Content</p></body></html>';
    const result = cleanHTML(input);
    expect(result).toContain('Content');
    expect(result).not.toContain('<title>');
  });

  it('should remove data-* attributes', () => {
    const input = '<p data-custom="value" data-id="123">Text</p>';
    const result = cleanHTML(input);
    expect(result).not.toContain('data-custom');
    expect(result).not.toContain('data-id');
    expect(result).toContain('Text');
  });
});

describe('removeGoogleDocsArtifacts', () => {
  it('should remove docs-* classes', () => {
    const input = '<p class="docs-internal-guid-abc123">Content</p>';
    const result = removeGoogleDocsArtifacts(input);
    expect(result).not.toContain('docs-internal-guid');
    expect(result).toContain('Content');
  });

  it('should remove empty bookmark anchors', () => {
    const input = '<a id="bookmark1"></a><p>Content</p>';
    const result = removeGoogleDocsArtifacts(input);
    expect(result).not.toContain('<a id="bookmark1">');
    expect(result).toContain('Content');
  });
});

describe('removeWordArtifacts', () => {
  it('should remove MsoNormal class', () => {
    const input = '<p class="MsoNormal">Content</p>';
    const result = removeWordArtifacts(input);
    expect(result).not.toContain('MsoNormal');
    expect(result).toContain('Content');
  });

  it('should remove conditional comments', () => {
    const input = '<!--[if gte mso 9]><xml>...</xml><![endif]--><p>Content</p>';
    const result = removeWordArtifacts(input);
    expect(result).not.toContain('<!--[if');
    expect(result).toContain('Content');
  });
});
