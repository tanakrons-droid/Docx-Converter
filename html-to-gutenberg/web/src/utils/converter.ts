/**
 * HTML to Gutenberg Converter - Browser Version
 */

import * as cheerio from 'cheerio';
import type { Element, ChildNode } from 'domhandler';
import css from 'css';

// Type for CSS Rule
interface CSSRule {
  type: string;
  selectors?: string[];
  declarations?: css.Declaration[];
}

// Types
export interface CSSClassMap {
  [className: string]: string;
}

export interface ConversionResult {
  html: string;
  report: ConversionReport;
}

export interface ConversionReport {
  inputLength: number;
  outputLength: number;
  blocksCreated: number;
  policiesTriggered: string[];
  warnings: string[];
  errors: string[];
  executionTimeMs: number;
}

export interface PolicyConfig {
  forbiddenTags: {
    enabled: boolean;
    tags: string[];
  };
  removeBeforeH1: {
    enabled: boolean;
  };
  removeAfterNoteSEO: {
    enabled: boolean;
  };
  requireH2: {
    enabled: boolean;
    minCount: number;
    autoGenerate: boolean;
  };
  addDisclaimer: {
    enabled: boolean;
    keywords: string[];
  };
}

// List of supported websites
export const SUPPORTED_WEBSITES = [
  'vsquareclinic.com',
  'vsqclinic.com',
  'vsquareconsult.com',
  'vsquare-under-eye.com',
  'vsquareclinic.co',
  'vsq-injector.com',
  'vsquare.clinic',
  'drvsquare.com',
  'en.vsquareclinic.com',
  'cn.vsquareclinic.com',
  'doctorvsquareclinic.com',
  'bestbrandclinic.com',
  'monghaclinic.com'
] as const;

export type SupportedWebsite = typeof SUPPORTED_WEBSITES[number];

const defaultPolicyConfig: PolicyConfig = {
  forbiddenTags: {
    enabled: true,
    tags: ['script', 'iframe', 'object', 'embed', 'form']
  },
  removeBeforeH1: {
    enabled: true
  },
  removeAfterNoteSEO: {
    enabled: true
  },
  requireH2: {
    enabled: true,
    minCount: 1,
    autoGenerate: false
  },
  addDisclaimer: {
    enabled: true,
    keywords: ['โปรโมชั่น', 'ส่วนลด', 'promotion', 'discount']
  }
};

/**
 * Extract CSS from style tags - Enhanced for Google Docs
 */
export function extractStyles(html: string): CSSClassMap {
  const $ = cheerio.load(html);
  const cssMap: CSSClassMap = {};

  $('style').each((_, el) => {
    let cssText = $(el).html() || '';
    
    // Remove @import rules that cause parse errors
    cssText = cssText.replace(/@import[^;]+;/g, '');
    
    try {
      const parsed = css.parse(cssText, { silent: true });
      if (parsed.stylesheet?.rules) {
        for (const r of parsed.stylesheet.rules) {
          const rule = r as CSSRule;
          if (rule.type === 'rule' && rule.selectors && rule.declarations) {
            for (const selector of rule.selectors) {
              // Handle class selectors (e.g., .c4, .c19.c16)
              const classMatches = selector.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g);
              if (classMatches) {
                const styles = rule.declarations
                  .filter((d): d is css.Declaration => d.type === 'declaration')
                  .map(d => `${d.property}: ${d.value}`)
                  .join('; ');
                
                if (styles) {
                  // Store styles for each class in the selector
                  for (const classMatch of classMatches) {
                    const className = classMatch.slice(1); // Remove the dot
                    cssMap[className] = cssMap[className] 
                      ? `${cssMap[className]}; ${styles}` 
                      : styles;
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      // Fallback: Use regex to extract styles if CSS parser fails
      const regex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)\s*\{([^}]+)\}/g;
      let match;
      while ((match = regex.exec(cssText)) !== null) {
        const className = match[1];
        const styles = match[2].trim().replace(/\s+/g, ' ');
        if (styles) {
          cssMap[className] = cssMap[className] 
            ? `${cssMap[className]}; ${styles}` 
            : styles;
        }
      }
    }
  });

  return cssMap;
}

/**
 * Clean HTML from unwanted elements - Enhanced for Google Docs
 */
export function cleanHTML(html: string, forbiddenTags: string[] = []): { html: string; removed: string[] } {
  const $ = cheerio.load(html, {});
  const removed: string[] = [];

  // Remove forbidden tags (but keep style for now - we need it for extraction)
  const tagsToRemove = ['script', 'meta', 'link', 'head', 'title', ...forbiddenTags];
  tagsToRemove.forEach(tag => {
    const count = $(tag).length;
    if (count > 0) {
      removed.push(`${tag} (${count})`);
      $(tag).remove();
    }
  });

  // Remove Google Docs specific elements
  $('sup').each((_, el) => {
    const $el = $(el);
    // Remove comment references like [a], [b], [c]
    if ($el.find('a[href^="#cmnt"]').length > 0) {
      $el.remove();
    }
  });
  
  // Remove comment divs at the bottom
  $('div.c1').each((_, el) => {
    const $el = $(el);
    if ($el.find('a[href^="#cmnt_ref"]').length > 0) {
      $el.remove();
    }
  });

  // Remove empty paragraphs (but keep those with &nbsp; as they might be intentional spacing)
  $('p').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    const htmlContent = $el.html() || '';
    // Keep if has text, images, or meaningful content
    if (!text && !htmlContent.includes('<img') && !htmlContent.includes('<br') && !htmlContent.includes('&nbsp;')) {
      // Check if it's just whitespace
      if (!htmlContent.replace(/\s|&nbsp;/g, '').trim()) {
        $el.remove();
      }
    }
  });

  // Remove empty spans but preserve their content
  $('span').each((_, el) => {
    const $el = $(el);
    const content = $el.html();
    if (!content?.trim()) {
      $el.remove();
    }
  });

  // Remove data attributes
  $('[data-docs-internal-guid]').removeAttr('data-docs-internal-guid');
  $('*').each((_, el) => {
    const $el = $(el);
    const attrs = (el as Element).attribs || {};
    Object.keys(attrs).forEach(attr => {
      if (attr.startsWith('data-')) {
        $el.removeAttr(attr);
      }
    });
  });
  
  // Remove id attributes from headings (Google Docs adds these)
  $('h1, h2, h3, h4, h5, h6').removeAttr('id');

  // Get body content or full content
  const body = $('body');
  const content = body.length > 0 ? body.html() : $.html();

  return { html: content || '', removed };
}

/**
 * Parse and merge style properties
 */
function parseStyleString(styleStr: string): Map<string, string> {
  const styleMap = new Map<string, string>();
  const parts = styleStr.split(';').map(s => s.trim()).filter(Boolean);
  
  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0) {
      const prop = part.slice(0, colonIndex).trim();
      const value = part.slice(colonIndex + 1).trim();
      if (prop && value) {
        styleMap.set(prop, value);
      }
    }
  }
  
  return styleMap;
}

/**
 * Convert style map to string
 */
function styleMapToString(styleMap: Map<string, string>): string {
  const parts: string[] = [];
  styleMap.forEach((value, prop) => {
    parts.push(`${prop}: ${value}`);
  });
  return parts.join('; ');
}

/**
 * Filter important styles for Gutenberg
 */
function filterImportantStyles(styleMap: Map<string, string>): Map<string, string> {
  const importantProps = new Set([
    'color', 'background-color', 'background',
    'font-weight', 'font-style', 'font-size', 'font-family',
    'text-decoration', 'text-align',
    'border', 'border-color', 'border-width', 'border-style',
    'padding', 'margin',
    'width', 'height', 'max-width', 'max-height',
    'display', 'vertical-align'
  ]);
  
  const filtered = new Map<string, string>();
  styleMap.forEach((value, prop) => {
    if (importantProps.has(prop)) {
      filtered.set(prop, value);
    }
  });
  
  return filtered;
}

/**
 * Inline CSS styles - Enhanced for Google Docs
 */
export function inlineStyles(html: string, cssMap: CSSClassMap): string {
  const $ = cheerio.load(html, {});

  // Process all elements with classes
  $('[class]').each((_, el) => {
    const $el = $(el);
    const classes = ($el.attr('class') || '').split(/\s+/).filter(Boolean);
    
    // Collect all styles from classes
    const mergedStyles = new Map<string, string>();
    
    // First, add existing inline styles
    const existingStyle = $el.attr('style') || '';
    if (existingStyle) {
      const existingMap = parseStyleString(existingStyle);
      existingMap.forEach((v, k) => mergedStyles.set(k, v));
    }
    
    // Then add styles from CSS classes
    classes.forEach(cls => {
      if (cssMap[cls]) {
        const classStyles = parseStyleString(cssMap[cls]);
        classStyles.forEach((v, k) => mergedStyles.set(k, v));
      }
    });

    // Keep ALL styles (don't filter) - we need everything for Gutenberg
    if (mergedStyles.size > 0) {
      $el.attr('style', styleMapToString(mergedStyles));
    } else {
      $el.removeAttr('style');
    }

    $el.removeAttr('class');
  });

  // Remove style tags
  $('style').remove();

  return $.html() || '';
}

/**
 * Create Gutenberg block wrapper
 */
function wrapBlock(blockType: string, content: string, attrs?: Record<string, unknown>): string {
  const attrString = attrs && Object.keys(attrs).length > 0
    ? ` ${JSON.stringify(attrs)}`
    : '';
  return `<!-- wp:${blockType}${attrString} -->\n${content}\n<!-- /wp:${blockType} -->`;
}

/**
 * Process span content with styles - Preserve all formatting
 */
function processStyledContent($el: cheerio.Cheerio<Element>, _$: cheerio.CheerioAPI): string {
  let content = $el.html() || '';
  const style = $el.attr('style') || '';
  const styleMap = parseStyleString(style);
  
  // Collect all inline styles to preserve
  const preserveStyles: string[] = [];
  
  // Handle font-weight (bold)
  const fontWeight = styleMap.get('font-weight');
  if (fontWeight === 'bold' || fontWeight === '700' || parseInt(fontWeight || '0') >= 600) {
    content = `<strong>${content}</strong>`;
  }
  
  // Handle font-style (italic)
  if (styleMap.get('font-style') === 'italic') {
    content = `<em>${content}</em>`;
  }
  
  // Handle text-decoration
  const textDecoration = styleMap.get('text-decoration');
  if (textDecoration?.includes('underline')) {
    content = `<u>${content}</u>`;
  }
  if (textDecoration?.includes('line-through')) {
    content = `<s>${content}</s>`;
  }
  
  // Preserve color
  const color = styleMap.get('color');
  if (color && !isDefaultColor(color)) {
    preserveStyles.push(`color: ${color}`);
  }
  
  // Preserve background-color
  const bgColor = styleMap.get('background-color') || styleMap.get('background');
  if (bgColor && bgColor !== 'transparent' && bgColor !== 'none' && bgColor !== 'initial') {
    preserveStyles.push(`background-color: ${bgColor}`);
  }
  
  // Preserve font-size
  const fontSize = styleMap.get('font-size');
  if (fontSize) {
    preserveStyles.push(`font-size: ${fontSize}`);
  }
  
  // Preserve font-family (if not default)
  const fontFamily = styleMap.get('font-family');
  if (fontFamily && !fontFamily.includes('Arial') && !fontFamily.includes('sans-serif')) {
    preserveStyles.push(`font-family: ${fontFamily}`);
  }
  
  // Wrap with mark tag for highlights or span for other styles
  if (preserveStyles.length > 0) {
    const hasHighlight = bgColor && bgColor !== 'transparent' && bgColor !== 'none';
    if (hasHighlight) {
      content = `<mark style="${preserveStyles.join('; ')}">${content}</mark>`;
    } else {
      content = `<span style="${preserveStyles.join('; ')}">${content}</span>`;
    }
  }
  
  return content;
}

/**
 * Check if color is default (black)
 */
function isDefaultColor(color: string): boolean {
  const defaultColors = [
    '#000000', '#000', 'black', 'rgb(0, 0, 0)', 'rgb(0,0,0)',
    '#212121', 'rgb(33, 33, 33)', 'rgb(33,33,33)' // Google Docs default
  ];
  return defaultColors.includes(color.toLowerCase().trim());
}

/**
 * Extract alignment and generate Gutenberg classes
 */
function getAlignmentFromStyle(style: string): { align: string | null; className: string } {
  const alignMatch = style.match(/text-align:\s*(center|right|left|justify)/i);
  const align = alignMatch ? alignMatch[1].toLowerCase() : null;
  const className = align && align !== 'left' ? `has-text-align-${align}` : '';
  return { align, className };
}

/**
 * Generate Gutenberg color classes and styles
 */
function getColorStyles(style: string): { classes: string[]; inlineStyle: string } {
  const styleMap = parseStyleString(style);
  const classes: string[] = [];
  const styles: string[] = [];
  
  const color = styleMap.get('color');
  const bgColor = styleMap.get('background-color') || styleMap.get('background');
  
  if (color && !isDefaultColor(color)) {
    classes.push('has-text-color');
    styles.push(`color: ${color}`);
  }
  
  if (bgColor && bgColor !== 'transparent' && bgColor !== 'none') {
    classes.push('has-background');
    styles.push(`background-color: ${bgColor}`);
  }
  
  return {
    classes,
    inlineStyle: styles.length > 0 ? ` style="${styles.join('; ')}"` : ''
  };
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Create YouTube embed block
 */
function createYouTubeEmbedBlock(url: string, caption?: string): string {
  const videoId = extractYouTubeId(url);
  if (!videoId) return '';
  let content = `<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio">
<div class="wp-block-embed__wrapper">
${url}
</div>`;
  
  if (caption) {
    content += `\n<figcaption class="wp-element-caption">${caption}</figcaption>`;
  }
  
  content += '\n</figure>';
  
  return wrapBlock('embed', content, { url, type: 'video', providerNameSlug: 'youtube', responsive: true });
}

/**
 * Clean alt text - remove "Alt:" or "alt:" prefix
 */
function cleanAltText(alt: string): string {
  return alt.replace(/^alt:\s*/i, '').trim();
}

/**
 * Create Kadence Row Layout for multiple images
 */
function createKadenceRowLayout(images: { src: string; alt: string; caption?: string }[]): string {
  const columns = images.length;
  
  let innerBlocks = '';
  
  images.forEach((img, index) => {
    const cleanedAlt = cleanAltText(img.alt);
    let imageContent = `<figure class="wp-block-image"><img src="${img.src}" alt="${cleanedAlt}"/>`;
    if (img.caption) {
      imageContent += `<figcaption class="wp-element-caption">${img.caption}</figcaption>`;
    }
    imageContent += '</figure>';
    
    const imageBlock = wrapBlock('image', imageContent);
    
    innerBlocks += `<!-- wp:kadence/column {"id":${index + 1},"uniqueID":"_${Date.now()}_${index}"} -->
<div class="wp-block-kadence-column kadence-column_${Date.now()}_${index}">
<div class="kt-inside-inner-col">
${imageBlock}
</div>
</div>
<!-- /wp:kadence/column -->

`;
  });
  
  return `<!-- wp:kadence/rowlayout {"uniqueID":"_${Date.now()}","columns":${columns},"colLayout":"equal"} -->
<div class="wp-block-kadence-rowlayout alignnone">
<div class="kt-row-column-wrap kt-has-${columns}-columns">
${innerBlocks}
</div>
</div>
<!-- /wp:kadence/rowlayout -->`;
}

/**
 * Check if paragraph is a special type and return appropriate class
 */
function getSpecialParagraphClass(text: string): { class: string; addSeparator: boolean } | null {
  const lowerText = text.toLowerCase().trim();
  
  // Table of contents
  if (lowerText.includes('สารบัญ') || lowerText.includes('คลิกอ่านหัวข้อ')) {
    return { class: 'subtext-gtb', addSeparator: false };
  }
  
  // Read more
  if (lowerText.includes('อ่านบทความเพิ่มเติม') || lowerText.includes('อ่านเพิ่มเติม')) {
    return { class: 'vsq-readmore', addSeparator: false };
  }
  
  // References
  if (lowerText.includes('อ้างอิง') || lowerText.includes('เอกสารอ้างอิง')) {
    return { class: 'references', addSeparator: true };
  }
  
  return null;
}

/**
 * Convert HTML to Gutenberg blocks
 */
export function convertToGutenberg(html: string): { html: string; blockCount: number } {
  const $ = cheerio.load(html, {});
  const blocks: string[] = [];
  let blockCount = 0;

  // Pre-process: Convert styled spans within paragraphs
  $('p').each((_, p) => {
    const $p = $(p);
    $p.find('span[style]').each((_, span) => {
      const $span = $(span);
      const processedContent = processStyledContent($span, $);
      $span.replaceWith(processedContent);
    });
  });

  function processNode(node: ChildNode): string | null {
    if (node.type === 'text') {
      const text = (node as unknown as { data: string }).data?.trim();
      if (text) {
        blockCount++;
        return wrapBlock('paragraph', `<p>${text}</p>`);
      }
      return null;
    }

    if (node.type !== 'tag') return null;

    const element = node as Element;
    const tagName = element.tagName?.toLowerCase();
    const $el = $(element);

    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = parseInt(tagName.charAt(1), 10);
        // Process styled spans in headings
        $el.find('span[style]').each((_, span) => {
          const $span = $(span);
          const processedContent = processStyledContent($span, $);
          $span.replaceWith(processedContent);
        });
        const content = $el.html() || '';
        if (!content.trim()) return null;
        
        // Extract styles from element
        const style = $el.attr('style') || '';
        const { align, className: alignClass } = getAlignmentFromStyle(style);
        const { classes: colorClasses, inlineStyle } = getColorStyles(style);
        
        // Build classes array
        const allClasses = [alignClass, ...colorClasses].filter(Boolean);
        const classAttr = allClasses.length > 0 ? ` class="${allClasses.join(' ')}"` : '';
        
        blockCount++;
        const attrs: Record<string, unknown> = { level };
        if (align && align !== 'left') {
          attrs.textAlign = align;
        }
        
        return wrapBlock('heading', `<${tagName}${classAttr}${inlineStyle}>${content}</${tagName}>`, attrs);
      }

      case 'p': {
        // Process styled spans in paragraph first
        $el.find('span[style]').each((_, span) => {
          const $span = $(span);
          const processedContent = processStyledContent($span, $);
          $span.replaceWith(processedContent);
        });
        
        const content = $el.html() || '';
        const textContent = $el.text().trim();
        if (!content.trim()) return null;
        
        // Check for YouTube links in paragraph
        const youtubeMatch = textContent.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]+[^\s]*)/i);
        if (youtubeMatch) {
          const youtubeUrl = youtubeMatch[1];
          // Extract caption (Thai text after URL)
          const afterUrl = textContent.substring(textContent.indexOf(youtubeUrl) + youtubeUrl.length).trim();
          const caption = afterUrl && /[\u0E00-\u0E7F]/.test(afterUrl) ? afterUrl : undefined;
          const embedBlock = createYouTubeEmbedBlock(youtubeUrl, caption);
          if (embedBlock) {
            blockCount++;
            return embedBlock;
          }
        }
        
        // Check if this paragraph contains images
        const images = $el.find('img');
        if (images.length > 0) {
          // Check for italic text after images (caption)
          const nextSibling = $el.next();
          let caption: string | undefined;
          
          // Check if next element is italic text (caption)
          if (nextSibling.length > 0) {
            const nextHtml = nextSibling.html() || '';
            const isItalic = nextSibling.find('em, i').length > 0 || 
                            nextSibling.attr('style')?.includes('font-style: italic') ||
                            nextHtml.includes('<em>') || nextHtml.includes('<i>');
            if (isItalic && nextSibling.text().trim()) {
              caption = nextSibling.text().trim();
              nextSibling.remove(); // Remove the caption paragraph
            }
          }
          
          // Multiple images - create Kadence Row Layout
          if (images.length > 1) {
            const imageData: { src: string; alt: string; caption?: string }[] = [];
            images.each((idx, img) => {
              const $img = $(img);
              imageData.push({
                src: $img.attr('src') || '',
                alt: cleanAltText($img.attr('alt') || ''),
                caption: idx === 0 ? caption : undefined
              });
            });
            blockCount++;
            return createKadenceRowLayout(imageData);
          }
          
          // Single image
          const img = images.first();
          const src = img.attr('src') || '';
          const alt = cleanAltText(img.attr('alt') || '');
          const title = img.attr('title') || '';
          
          let figureContent = `<figure class="wp-block-image"><img src="${src}" alt="${alt}"${title ? ` title="${title}"` : ''}/>`;
          if (caption) {
            figureContent += `<figcaption class="wp-element-caption">${caption}</figcaption>`;
          }
          figureContent += '</figure>';
          
          blockCount++;
          return wrapBlock('image', figureContent);
        }
        
        // Check for special paragraph types
        const specialClass = getSpecialParagraphClass(textContent);
        if (specialClass) {
          const result: string[] = [];
          
          // Add separator before references
          if (specialClass.addSeparator) {
            blockCount++;
            result.push(wrapBlock('separator', '<hr class="wp-block-separator has-alpha-channel-opacity"/>'));
          }
          
          blockCount++;
          result.push(wrapBlock('paragraph', `<p class="${specialClass.class}">${content}</p>`));
          return result.join('\n\n');
        }
        
        // Extract styles from element
        const style = $el.attr('style') || '';
        const { align, className: alignClass } = getAlignmentFromStyle(style);
        const { classes: colorClasses, inlineStyle } = getColorStyles(style);
        
        // Build classes array
        const allClasses = [alignClass, ...colorClasses].filter(Boolean);
        const classAttr = allClasses.length > 0 ? ` class="${allClasses.join(' ')}"` : '';
        
        blockCount++;
        const attrs: Record<string, unknown> = {};
        if (align && align !== 'left') {
          attrs.align = align;
        }
        
        return wrapBlock('paragraph', `<p${classAttr}${inlineStyle}>${content}</p>`, Object.keys(attrs).length > 0 ? attrs : undefined);
      }

      case 'ul':
      case 'ol': {
        const items: string[] = [];
        $el.children('li').each((_, li) => {
          const $li = $(li);
          // Process styled spans in list items
          $li.find('span[style]').each((_, span) => {
            const $span = $(span);
            const processedContent = processStyledContent($span, $);
            $span.replaceWith(processedContent);
          });
          items.push(`<li>${$li.html() || ''}</li>`);
        });
        if (items.length === 0) return null;
        blockCount++;
        return wrapBlock(
          'list',
          `<${tagName}>\n${items.join('\n')}\n</${tagName}>`,
          tagName === 'ol' ? { ordered: true } : undefined
        );
      }

      case 'img': {
        const src = $el.attr('src') || '';
        const alt = $el.attr('alt') || '';
        blockCount++;
        return wrapBlock('image', `<figure class="wp-block-image"><img src="${src}" alt="${alt}"/></figure>`);
      }

      case 'figure': {
        const img = $el.find('img').first();
        const figcaption = $el.find('figcaption').first();
        if (img.length > 0) {
          const src = img.attr('src') || '';
          const alt = img.attr('alt') || '';
          let content = `<figure class="wp-block-image"><img src="${src}" alt="${alt}"/>`;
          if (figcaption.length > 0) {
            content += `<figcaption class="wp-element-caption">${figcaption.html()}</figcaption>`;
          }
          content += '</figure>';
          blockCount++;
          return wrapBlock('image', content);
        }
        return null;
      }

      case 'blockquote': {
        const content = $el.html() || '';
        blockCount++;
        return wrapBlock('quote', `<blockquote class="wp-block-quote">${content}</blockquote>`);
      }

      case 'pre': {
        const code = $el.find('code').first();
        const content = code.length > 0 ? code.text() : $el.text();
        blockCount++;
        return wrapBlock('code', `<pre class="wp-block-code"><code>${escapeHtml(content)}</code></pre>`);
      }

      case 'hr': {
        blockCount++;
        return wrapBlock('separator', '<hr class="wp-block-separator has-alpha-channel-opacity"/>');
      }

      case 'table': {
        // Clean up table for Gutenberg
        $el.find('[style]').removeAttr('style');
        $el.removeAttr('style');
        blockCount++;
        return wrapBlock('table', `<figure class="wp-block-table">${$el.prop('outerHTML')}</figure>`);
      }

      case 'div': {
        const childBlocks: string[] = [];
        $el.contents().each((_, child) => {
          const block = processNode(child);
          if (block) childBlocks.push(block);
        });
        return childBlocks.length > 0 ? childBlocks.join('\n\n') : null;
      }

      case 'a': {
        // Only create paragraph block for standalone links
        const href = $el.attr('href') || '#';
        const content = $el.html() || '';
        if (!content.trim()) return null;
        blockCount++;
        return wrapBlock('paragraph', `<p><a href="${href}">${content}</a></p>`);
      }

      case 'strong':
      case 'b':
      case 'em':
      case 'i': {
        const content = $el.prop('outerHTML') || '';
        if (content.trim()) {
          blockCount++;
          return wrapBlock('paragraph', `<p>${content}</p>`);
        }
        return null;
      }

      case 'span': {
        // Process styled span as paragraph
        const processedContent = processStyledContent($el, $);
        if (processedContent.trim()) {
          blockCount++;
          return wrapBlock('paragraph', `<p>${processedContent}</p>`);
        }
        return null;
      }

      default:
        return null;
    }
  }

  // Process body or root
  const body = $('body');
  const root = body.length > 0 ? body : $.root();

  root.contents().each((_, node) => {
    const block = processNode(node);
    if (block) blocks.push(block);
  });

  return { html: blocks.join('\n\n'), blockCount };
}

/**
 * Apply policies
 */
export function applyPolicies(
  html: string, 
  config: PolicyConfig = defaultPolicyConfig
): { html: string; triggered: string[]; warnings: string[] } {
  const $ = cheerio.load(html, {});
  const triggered: string[] = [];
  const warnings: string[] = [];

  // Forbidden tags policy
  if (config.forbiddenTags.enabled) {
    config.forbiddenTags.tags.forEach(tag => {
      const elements = $(tag);
      if (elements.length > 0) {
        elements.remove();
        triggered.push('forbiddenTags');
        warnings.push(`ลบแท็ก <${tag}> จำนวน ${elements.length} รายการ`);
      }
    });
  }

  // Remove content before H1 policy (and remove the first H1 itself)
  if (config.removeBeforeH1.enabled) {
    const firstH1 = $('h1').first();
    if (firstH1.length > 0) {
      let removedCount = 0;
      const removedElements: string[] = [];

      // Remove all siblings before the first H1
      firstH1.prevAll().each((_, el) => {
        const tagName = $(el).prop('tagName')?.toLowerCase();
        if (tagName) {
          removedElements.push(tagName);
        }
        removedCount++;
        $(el).remove();
      });

      // Also check parent containers and remove content before them
      let parent = firstH1.parent();
      while (parent.length > 0 && parent.prop('tagName')?.toLowerCase() !== 'body' && parent.prop('tagName')?.toLowerCase() !== 'html') {
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

      if (removedCount > 0) {
        const uniqueTags = [...new Set(removedElements)].join(', ');
        triggered.push('removeBeforeH1');
        warnings.push(`ลบเนื้อหาก่อน H1 และ H1 แรก จำนวน ${removedCount} รายการ (แท็ก: ${uniqueTags})`);
      }
    }
  }

  // Remove content after "NOTE SEO Writer" policy
  if (config.removeAfterNoteSEO?.enabled) {
    let foundNoteSEO = false;
    let removedCount = 0;
    
    // Find elements containing "NOTE SEO" text
    $('*').each((_, el) => {
      const $el = $(el);
      const text = $el.text();
      
      // Check if this element contains "NOTE SEO" (case insensitive)
      if (!foundNoteSEO && /note\s*seo/i.test(text)) {
        // Check if this is the actual element with the text (not a parent)
        const directText = $el.clone().children().remove().end().text();
        if (/note\s*seo/i.test(directText) || $el.children().length === 0) {
          foundNoteSEO = true;
          
          // Remove this element and all following siblings
          $el.nextAll().each((_, sibling) => {
            removedCount++;
            $(sibling).remove();
          });
          
          // Remove the element itself
          removedCount++;
          $el.remove();
        }
      }
    });
    
    if (removedCount > 0) {
      triggered.push('removeAfterNoteSEO');
      warnings.push(`ลบเนื้อหาหลัง "NOTE SEO Writer" จำนวน ${removedCount} รายการ`);
    }
  }

  // Require H2 policy
  if (config.requireH2.enabled) {
    const h2Count = $('h2').length;
    if (h2Count < config.requireH2.minCount) {
      if (config.requireH2.autoGenerate) {
        const firstP = $('p').first();
        if (firstP.length > 0) {
          firstP.before('<h2>หัวข้อบทความ</h2>');
          triggered.push('requireH2');
          warnings.push('เพิ่มหัวข้อ H2 อัตโนมัติ');
        }
      } else {
        warnings.push(`พบ H2 เพียง ${h2Count} หัวข้อ (ต้องการอย่างน้อย ${config.requireH2.minCount})`);
      }
    }
  }

  // Disclaimer policy
  if (config.addDisclaimer.enabled) {
    const text = $.text().toLowerCase();
    const foundKeywords = config.addDisclaimer.keywords.filter(kw => 
      text.includes(kw.toLowerCase())
    );

    if (foundKeywords.length > 0) {
      const bodyEl = $('body');
      const target = bodyEl.length > 0 ? bodyEl : $('html');
      target.append(`
        <div class="disclaimer-block" style="background: #fff3cd; border: 1px solid #ffc107; padding: 16px; border-radius: 8px; margin-top: 24px;">
          <strong>⚠️ หมายเหตุ:</strong> เนื้อหานี้มีการกล่าวถึงโปรโมชั่นหรือส่วนลด กรุณาตรวจสอบเงื่อนไขก่อนตัดสินใจ
        </div>
      `);
      triggered.push('addDisclaimer');
      warnings.push(`เพิ่ม Disclaimer เนื่องจากพบคำ: ${foundKeywords.join(', ')}`);
    }
  }

  return { html: $.html() || '', triggered: [...new Set(triggered)], warnings };
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, c => map[c] || c);
}

/**
 * Main conversion function
 */
export function convert(
  inputHtml: string,
  options: {
    inlineStyles?: boolean;
    policies?: Partial<PolicyConfig>;
  } = {}
): ConversionResult {
  const startTime = performance.now();
  const warnings: string[] = [];
  const errors: string[] = [];
  let policiesTriggered: string[] = [];

  try {
    // Step 1: Extract styles
    const cssMap = extractStyles(inputHtml);

    // Step 2: Clean HTML
    const forbiddenTags = options.policies?.forbiddenTags?.enabled 
      ? options.policies.forbiddenTags.tags 
      : defaultPolicyConfig.forbiddenTags.tags;
    
    const { html: cleanedHtml, removed } = cleanHTML(inputHtml, forbiddenTags);
    if (removed.length > 0) {
      warnings.push(`ลบแท็กที่ไม่ต้องการ: ${removed.join(', ')}`);
    }

    // Step 3: Inline styles (if enabled)
    let processedHtml = cleanedHtml;
    if (options.inlineStyles !== false) {
      processedHtml = inlineStyles(cleanedHtml, cssMap);
    }

    // Step 4: Apply policies
    const policyConfig: PolicyConfig = {
      ...defaultPolicyConfig,
      ...options.policies
    };
    const policyResult = applyPolicies(processedHtml, policyConfig);
    processedHtml = policyResult.html;
    policiesTriggered = policyResult.triggered;
    warnings.push(...policyResult.warnings);

    // Step 5: Convert to Gutenberg
    const { html: gutenbergHtml, blockCount } = convertToGutenberg(processedHtml);

    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      html: gutenbergHtml,
      report: {
        inputLength: inputHtml.length,
        outputLength: gutenbergHtml.length,
        blocksCreated: blockCount,
        policiesTriggered,
        warnings,
        errors,
        executionTimeMs
      }
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      html: '',
      report: {
        inputLength: inputHtml.length,
        outputLength: 0,
        blocksCreated: 0,
        policiesTriggered,
        warnings,
        errors,
        executionTimeMs: Math.round(performance.now() - startTime)
      }
    };
  }
}
