/**
 * Gutenberg Converter Tests
 */

import { describe, it, expect } from 'vitest';
import { convertToGutenberg } from '../../src/gutenberg/gutenbergConverter.js';
import { 
  createParagraphBlock, 
  createHeadingBlock, 
  createListBlock,
  createImageBlock 
} from '../../src/gutenberg/blockHelpers.js';

describe('convertToGutenberg', () => {
  it('should convert paragraph to Gutenberg block', () => {
    const html = '<p>Hello World</p>';
    const result = convertToGutenberg(html);
    
    expect(result).toContain('<!-- wp:paragraph -->');
    expect(result).toContain('<!-- /wp:paragraph -->');
    expect(result).toContain('Hello World');
  });

  it('should convert heading to Gutenberg block', () => {
    const html = '<h2>My Heading</h2>';
    const result = convertToGutenberg(html);
    
    expect(result).toContain('<!-- wp:heading');
    expect(result).toContain('"level":2');
    expect(result).toContain('My Heading');
  });

  it('should convert unordered list to Gutenberg block', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = convertToGutenberg(html);
    
    expect(result).toContain('<!-- wp:list -->');
    expect(result).toContain('Item 1');
    expect(result).toContain('Item 2');
  });

  it('should convert ordered list to Gutenberg block', () => {
    const html = '<ol><li>First</li><li>Second</li></ol>';
    const result = convertToGutenberg(html);
    
    expect(result).toContain('<!-- wp:list');
    expect(result).toContain('"ordered":true');
  });

  it('should convert image to Gutenberg block', () => {
    const html = '<img src="https://example.com/image.jpg" alt="Test Image">';
    const result = convertToGutenberg(html);
    
    expect(result).toContain('<!-- wp:image');
    expect(result).toContain('https://example.com/image.jpg');
    expect(result).toContain('Test Image');
  });

  it('should convert blockquote to Gutenberg block', () => {
    const html = '<blockquote>Famous quote here</blockquote>';
    const result = convertToGutenberg(html);
    
    expect(result).toContain('<!-- wp:quote -->');
    expect(result).toContain('Famous quote here');
  });

  it('should convert horizontal rule to separator block', () => {
    const html = '<hr>';
    const result = convertToGutenberg(html);
    
    expect(result).toContain('<!-- wp:separator -->');
  });

  it('should handle multiple elements', () => {
    const html = `
      <h2>Title</h2>
      <p>First paragraph</p>
      <p>Second paragraph</p>
    `;
    const result = convertToGutenberg(html);
    
    expect(result).toContain('<!-- wp:heading');
    expect((result.match(/<!-- wp:paragraph -->/g) || []).length).toBe(2);
  });

  it('should preserve inline styles when enabled', () => {
    const html = '<p style="color: red;">Styled text</p>';
    const result = convertToGutenberg(html, { preserveStyles: true });
    
    expect(result).toContain('style="color: red;"');
  });
});

describe('Block Helpers', () => {
  describe('createParagraphBlock', () => {
    it('should create basic paragraph block', () => {
      const result = createParagraphBlock('Hello');
      
      expect(result).toContain('<!-- wp:paragraph -->');
      expect(result).toContain('<p>Hello</p>');
      expect(result).toContain('<!-- /wp:paragraph -->');
    });

    it('should handle alignment', () => {
      const result = createParagraphBlock('Centered', { align: 'center' });
      
      expect(result).toContain('has-text-align-center');
    });
  });

  describe('createHeadingBlock', () => {
    it('should create H2 by default', () => {
      const result = createHeadingBlock('Title');
      
      expect(result).toContain('<h2>Title</h2>');
      expect(result).toContain('"level":2');
    });

    it('should support different heading levels', () => {
      const result = createHeadingBlock('Title', 3);
      
      expect(result).toContain('<h3>Title</h3>');
      expect(result).toContain('"level":3');
    });
  });

  describe('createListBlock', () => {
    it('should create unordered list', () => {
      const result = createListBlock(['A', 'B', 'C']);
      
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>A</li>');
      expect(result).toContain('<li>B</li>');
      expect(result).toContain('<li>C</li>');
    });

    it('should create ordered list', () => {
      const result = createListBlock(['First', 'Second'], true);
      
      expect(result).toContain('<ol>');
      expect(result).toContain('"ordered":true');
    });
  });

  describe('createImageBlock', () => {
    it('should create image block with src and alt', () => {
      const result = createImageBlock('https://example.com/img.jpg', 'Alt text');
      
      expect(result).toContain('<!-- wp:image');
      expect(result).toContain('src="https://example.com/img.jpg"');
      expect(result).toContain('alt="Alt text"');
    });

    it('should support caption', () => {
      const result = createImageBlock('img.jpg', 'Alt', { caption: 'My caption' });
      
      expect(result).toContain('My caption');
      expect(result).toContain('figcaption');
    });
  });
});
