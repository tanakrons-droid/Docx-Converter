/**
 * HTML to Gutenberg Converter - Browser Version
 * Ported from html-to-gutenberg/web/src/utils/converter.ts
 */

import * as cheerio from 'cheerio';

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
];

const defaultPolicyConfig = {
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
    enabled: false,  // ปิด - ไม่เพิ่มข้อความที่ไม่ได้อยู่ใน docs
    keywords: ['โปรโมชั่น', 'ส่วนลด', 'promotion', 'discount']
  }
};

/**
 * Extract CSS from style tags - Enhanced for Google Docs
 * Uses regex-based parsing (browser compatible, no Node.js dependencies)
 */
export function extractStyles(html) {
  const $ = cheerio.load(html);
  const cssMap = {};

  $('style').each((_, el) => {
    let cssText = $(el).html() || '';

    // Remove @import rules
    cssText = cssText.replace(/@import[^;]+;/g, '');
    // Remove comments
    cssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

    // Parse CSS rules using regex
    // Match: .className { property: value; ... }
    // Also handles multiple selectors: .c1, .c2 { ... }
    const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
    let match;

    while ((match = ruleRegex.exec(cssText)) !== null) {
      const selectorsStr = match[1].trim();
      const declarationsStr = match[2].trim();

      // Parse selectors (split by comma)
      const selectors = selectorsStr.split(',').map(s => s.trim());

      // Parse declarations
      const styles = declarationsStr
        .split(';')
        .map(d => d.trim())
        .filter(d => d && d.includes(':'))
        .join('; ');

      if (!styles) continue;

      // Process each selector
      for (const selector of selectors) {
        // Extract class names from selector (e.g., .c4, .c19.c16)
        const classMatches = selector.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g);
        if (classMatches) {
          for (const classMatch of classMatches) {
            const className = classMatch.slice(1); // Remove the dot
            cssMap[className] = cssMap[className]
              ? `${cssMap[className]}; ${styles}`
              : styles;
          }
        }
      }
    }
  });

  return cssMap;
}

/**
 * Clean HTML from unwanted elements - Enhanced for Google Docs
 * @param {string} html - HTML content
 * @param {string[]} forbiddenTags - Tags to remove
 * @param {Object} cssMap - CSS class to style mapping (for detecting italic/bold from classes)
 */
export function cleanHTML(html, forbiddenTags = [], cssMap = {}) {
  const $ = cheerio.load(html, {});
  const removed = [];

  // Helper function to check if element has italic from CSS class
  const hasItalicFromClass = ($el) => {
    const classes = ($el.attr('class') || '').split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      const classStyle = cssMap[cls] || '';
      if (/font-style\s*:\s*italic/i.test(classStyle) || /\bitalic\b/i.test(cls) || /\bi\b/i.test(cls)) {
        return true;
      }
    }
    return false;
  };

  // Helper function to check if element has bold from CSS class
  const hasBoldFromClass = ($el) => {
    const classes = ($el.attr('class') || '').split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      const classStyle = cssMap[cls] || '';
      if (/font-weight\s*:\s*(bold|bolder|[5-9]00)/i.test(classStyle)) {
        return true;
      }
    }
    return false;
  };

  // Helper function to check if element has underline from CSS class
  const hasUnderlineFromClass = ($el) => {
    const classes = ($el.attr('class') || '').split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      const classStyle = cssMap[cls] || '';
      if (/text-decoration[^:]*:\s*[^;]*underline/i.test(classStyle)) {
        return true;
      }
    }
    return false;
  };

  // Helper function to check if element has color from CSS class
  const hasColorFromClass = ($el) => {
    const classes = ($el.attr('class') || '').split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      const classStyle = cssMap[cls] || '';
      const colorMatch = classStyle.match(/color\s*:\s*([^;]+)/i);
      if (colorMatch) {
        const color = colorMatch[1].trim();
        if (isRedColor(color)) {
          return color;
        }
      }
    }
    return false;
  };

  // Helper function to check if element has text-align from CSS class
  const hasTextAlignFromClass = ($el) => {
    const classes = ($el.attr('class') || '').split(/\s+/).filter(Boolean);

    // Check for leading spaces/&nbsp; hack (spacebar ยาวๆ to center text)
    // If it starts with 5+ spaces or &nbsp;, consider it center as a common Docx hack
    const rawText = $el.text();
    const htmlContent = $el.html() || '';
    if (/^[\s\u00A0]{5,}/.test(rawText) || /^(&nbsp;|\s){10,}/.test(htmlContent.trim())) {
      return 'center';
    }

    let detectedAlign = null;

    for (const cls of classes) {
      const classStyle = cssMap[cls] || '';

      // NEW: Check for large left margin/indent used as "center" hack (Google Docs/Word hack)
      const marginLeftMatch = classStyle.match(/margin-left\s*:\s*(\d+(?:\.\d+)?)(pt|px|in|cm|mm|em|rem)/i);
      const textIndentMatch = classStyle.match(/text-indent\s*:\s*(\d+(?:\.\d+)?)(pt|px|in|cm|mm|em|rem)/i);

      let marginLeftPt = 0;
      if (marginLeftMatch) {
        const val = parseFloat(marginLeftMatch[1]);
        const unit = marginLeftMatch[2].toLowerCase();
        // Rough conversion to pt for threshold check
        marginLeftPt = unit === 'pt' ? val : (unit === 'px' ? val * 0.75 : (unit === 'in' ? val * 72 : val));
      }

      let textIndentPt = 0;
      if (textIndentMatch) {
        const val = parseFloat(textIndentMatch[1]);
        const unit = textIndentMatch[2].toLowerCase();
        textIndentPt = unit === 'pt' ? val : (unit === 'px' ? val * 0.75 : (unit === 'in' ? val * 72 : val));
      }

      // If combined indent/margin is 80pt or more, it's very likely a "pseudo-centering" hack
      if ((marginLeftPt + textIndentPt) >= 80) {
        return 'center';
      }

      const alignMatch = classStyle.match(/(?:^|;)\s*(?:mso-)?text-align\s*:\s*(left|center|right|justify)\b/i);
      if (alignMatch) {
        const align = alignMatch[1].toLowerCase();
        // If we found center/right/justify, it takes priority over previous finds
        if (align !== 'left') return align;
        detectedAlign = align;
      }
      // Also check for margin center
      const s = classStyle.toLowerCase().replace(/\s+/g, '');
      if (s.includes('margin-left:auto') && s.includes('margin-right:auto')) {
        return 'center';
      }
      if (/margin\s*:\s*[^;]*auto/i.test(classStyle)) {
        return 'center';
      }
    }
    return detectedAlign;
  };


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

  // ===== ENHANCED: Remove ALL Google Docs comments and internal notes =====

  // Strategy 0a: Remove entire paragraphs/elements containing cmnt_ref links
  // These are the comment text sections from Google Docs
  // BUT don't remove table cells - only remove from p, div, li
  $('a[href*="cmnt_ref"]').closest('p, div, li').each((_, el) => {
    $(el).remove();
  });

  // Strategy 0b: Remove <sup> tags containing comment links FIRST (before removing the links)
  $('sup').each((_, el) => {
    const $el = $(el);
    // Remove if contains comment link
    if ($el.find('a[href*="cmnt"]').length > 0 || $el.find('a[id^="cmnt"]').length > 0) {
      $el.remove();
      return;
    }
    // Remove if only contains comment markers like [a], [b], [c], [j], [k], etc.
    const text = $el.text().trim();
    if (/^\[([a-z0-9]+)\]$/i.test(text)) {
      $el.remove();
    }
  });

  // For table cells, only remove the comment link itself, not the whole cell
  $('td a[href*="cmnt_ref"]').each((_, el) => {
    $(el).remove();
  });

  // Strategy 0c: Remove comment anchor markers like <a id="cmnt1">[a]</a>
  $('a[id^="cmnt"]').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    // Check if this is a comment marker like [a], [b], [c], etc.
    if (/^\[([a-z0-9]+)\]$/i.test(text)) {
      $el.remove();
    }
  });

  // Strategy 0d: Remove all elements with href containing cmnt (Google Docs comments)
  $('a[href*="cmnt"]').each((_, el) => {
    $(el).remove();
  });

  // Strategy 0e: Remove empty <sup> tags (may be left over after removing comment links)
  $('sup').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    // Remove if empty or only whitespace
    if (!text || /^\[([a-z0-9]+)\]$/i.test(text)) {
      $el.remove();
    }
  });

  // Strategy 0f: Remove paragraphs/divs that contain only comment markers
  $('p, div').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    // Remove if only contains comment markers like [a], [b], [c]
    if (/^\[([a-z0-9]+)\]$/i.test(text)) {
      $el.remove();
    }
  });

  // Strategy 0g: Remove Google Docs comment sections at the bottom of document
  // These are divs/paragraphs that start with [a], [b], [c] followed by comment text
  // Pattern: [a]To Team web : ..., [b]แทรก internal link..., etc.
  $('p, div').each((_, el) => {
    const $el = $(el);
    // Check if element contains a comment anchor link (id="cmnt1", id="cmnt2", etc.)
    if ($el.find('a[id^="cmnt"]').length > 0) {
      $el.remove();
      return;
    }

    const text = $el.text().trim();
    // Remove if starts with [a], [b], [c], etc. followed by any text (Google Docs comments)
    if (/^\[([a-z0-9]+)\]/i.test(text)) {
      $el.remove();
    }
  });

  // Strategy 0h: Remove entire comment container divs (often have class like c34, c1, etc.)
  // These contain all the Google Docs comments at the bottom
  $('div').each((_, el) => {
    const $el = $(el);
    // Check if this div contains multiple comment links (it's a comment container)
    const commentLinks = $el.find('a[id^="cmnt"]');
    if (commentLinks.length >= 2) {
      // This is likely a container with many comments - remove it
      $el.remove();
      return;
    }

    // Also check for divs that contain paragraphs starting with [a], [b], etc.
    const paragraphsWithComments = $el.find('p').filter((_, p) => {
      const pText = $(p).text().trim();
      return /^\[([a-z0-9]+)\]/i.test(pText);
    });
    if (paragraphsWithComments.length >= 2) {
      $el.remove();
    }
  });

  // Strategy 0i: Remove everything after "NOTE SEO Writer" section (internal notes at bottom)
  // Find "NOTE SEO Writer" and remove it and all following siblings
  let foundNoteSEO = false;
  $('p, h1, h2, h3, h4, h5, h6, div, ul, ol, table').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();

    // Check if this is the start of NOTE SEO Writer section
    if (/^NOTE\s+SEO\s+Writer/i.test(text) || /^NOTE\s+SEO$/i.test(text)) {
      foundNoteSEO = true;
    }

    // Remove this element and all following if we found NOTE SEO section
    if (foundNoteSEO) {
      $el.remove();
    }
  });

  // Strategy 0j: Remove SEO Writer guideline patterns (bullet points)
  const seoWriterPatterns = [
    /^Keywords\s+Top\s+of\s+your\s+page/i,
    /^URL\s+มี\s*Keywords/i,
    /^Headline\s*<h1>/i,
    /^Use\s+keyword\s+in\s+title\s+tag/i,
    /^Description\s+มี\s*Keywords/i,
    /^Use\s+Keywords\s+in\s+H1/i,
    /^Image\s+at\s+every\s+scroll/i,
    /^Internal\s+Link\s+(ควร|มี|ประมาณ)/i,
    /^External\s+Link\s+(มี|ไม่)/i,
    /^Related\s+phrases/i,
    /^Structured\s+data/i,
    /^Check\s+Search\s+Inter/i,
    /^Keyphrase\s+usage/i,
    /^Call\s+to\s+action/i,
  ];

  $('li').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();

    for (const pattern of seoWriterPatterns) {
      if (pattern.test(text)) {
        $el.remove();
        return;
      }
    }
  });

  // Strategy 1: Remove paragraphs that start with internal note patterns
  const internalNotePatterns = [
    /^\[([a-z0-9])\]\s*/i,                    // [a] ฝากระบุ..., [b] @thitikron...
    /^(To\s+Team\s+\w+\s*:)/i,                // To Team Web:, To Team Design:
    /^\s*@\w+/,                                // @thitikron..., @someone...
    /^(กราฟิก|Graphic|Image|GRAPHIC|IMAGE)/i, // กราฟิก, Graphic, Image
    /^\(\s*(ฝาก|Note:|Internal:|TODO:|FIXME:)/i, // (ฝาก...), (Note:...)
    /^(Alt|alt|ALT)\s*:/,                      // Alt: text, alt: text
    /^(NOTE\s+SEO\s+Writer|NOTE\s+SEO|note\s+seo)/i, // NOTE SEO Writer
    /^(กราฟิก Zip|ราคากราฟิก|Credit|เครดิต)/i, // กราฟิก Zip, Credit
    /^(Landing\s*:|Link\s*:|URL\s*:)/i,       // Landing:, Link:, URL:
    /^\[.*?(ฝาก|Note|Internal|TODO|ทีม|Team)/i, // [ฝาก...], [Note...]
    /^-\s*(Allergan|Dysport|Xeomin|Aestox|Nabota|Neuronox|inBo|Bienox)\s+https?:\/\//i, // - Allergan https://...
    /^-\s+https?:\/\/www\.(vsquareclinic|vsqclinic)/i, // - https://www.vsquareclinic...
    /^-\s*โบท็อก/i,                            // - โบท็อกลดริ้วรอย https://...
    /^อัปเดตรูป/i,                             // อัปเดตรูปปก (ไม่ใช้รูปพี่ต่ายค่ะ)
    /⚠️\s*หมายเหตุ/i,                         // ⚠️ หมายเหตุ: (anywhere in text)
    /เนื้อหานี้มีการกล่าวถึงโปรโมชั่น/i,        // เนื้อหานี้มีการกล่าวถึงโปรโมชั่น... (anywhere)
    /^ใส่\s*%%currentyear%%/i,                // ใส่ %%currentyear%%
    /^เพื่อให้ปี\s*ค\.\s*ศ\./i,               // เพื่อให้ปี ค.ศ. เปลี่ยนแบบอัตโนมัติ
    /^แก้วันที่เผยแพร่/i,                      // แก้วันที่เผยแพร่บทความ
    /^Link\s+Banner/i,                         // Link Banner ไปที่...
    /^ทำปุ่ม\s+Button/i,                       // ทำปุ่ม Button ระบุข้อความ...
    /^ลิงก์ไป\s*:/i,                          // ลิงก์ไป : https://...
    /^ตั้งค่าการเปิดลิงก์/i,                   // ตั้งค่าการเปิดลิงก์ เป็น Open in new tab
    /^เป็น\s*Mark\s+as\s+nofollow/i,          // เป็น Mark as nofollow
    /^ติ๊กถูก/i,                              // ติ๊กถูก ✅...
    /^Formatting\s+(short\s+)?paragraphs/i,   // Formatting short paragraphs, headers...
    /^Length\s+\d+\+?\s*words/i,              // Length 1500+ words for search optimized posts
    /^(Headers|Subheads|Bullets|Bolding)/i,   // Headers, Subheads, Bullets, Bolding
    /search\s*optimized\s*posts?/i,           // search optimized posts (anywhere)
    /^SEO\s+(guidelines?|instructions?|notes?)/i, // SEO guidelines, SEO instructions
    // New patterns for Google Docs comments
    /^แทรก\s*(internal\s*link|Internal\s*link|Internal\s*Link)/i, // แทรก internal link เพิ่มค่ะ
    /^ลบรูป/i,                                // ลบรูปพี่ต่าย, ลบรูป...
    /^ลบ$/i,                                  // ลบ (standalone)
    /^รูปตำแหน่ง/i,                           // รูปตำแหน่งฉีดฟิลเลอร์...
    /^ลิงก์แบนเนอร์/i,                        // ลิงก์แบนเนอร์ไปหน้า...
    /^อัปโหลดโดยวาง/i,                        // อัปโหลดโดยวางรูป..., อัปโหลดโดยวางแบนเนอร์...
    /^ปรับขนาดให้เท่ากัน/i,                   // ปรับขนาดให้เท่ากัน...
    /^(Sculptra|Radiesse|HArmonyCa|Juvelook|Ultracol|Gouri)\s+https?:\/\//i, // Product https://...
  ];

  // ===== SPECIAL HANDLING FOR TABLE CELLS WITH IMAGES AND ALT TEXT =====
  // Before removing internal notes, extract Alt text and apply to images in table cells
  $('td').each((_, td) => {
    const $td = $(td);
    const $img = $td.find('img').first();

    // If cell has an image, look for Alt text paragraph
    if ($img.length > 0) {
      $td.find('p').each((_, p) => {
        const $p = $(p);
        const pText = $p.text().trim();

        // Check if this paragraph contains "Alt :" text
        if (/^(Alt|alt|ALT)\s*:/.test(pText)) {
          // Extract alt text and apply to image
          const altText = pText.replace(/^(Alt|alt|ALT)\s*:\s*/i, '').trim();
          if (altText && !$img.attr('alt')) {
            $img.attr('alt', altText);
          }
          // Remove just this paragraph, not the whole cell
          $p.remove();
        }
      });
    }
  });

  $('p, div, li, td').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();

    // Skip empty elements
    if (!text) return;

    // IMPORTANT: Skip if element contains an image
    // We don't want to remove paragraphs/divs that look like internal notes but actually contain the content (the image)
    const hasImage = $el.find('img').length > 0;
    if (hasImage) {
      return;
    }

    // Check if text matches any internal note pattern
    for (const pattern of internalNotePatterns) {
      if (pattern.test(text)) {
        $el.remove();
        return;
      }
    }
  });

  // Remove H2 headings that are internal notes (กราฟิก Zip, etc.)
  $('h2').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();

    // Remove H2 with "กราฟิก" patterns
    if (/^กราฟิก/i.test(text)) {
      // Also remove the target block before it if exists
      $el.prev('div.wp-block-ps2id-block-target').remove();
      $el.remove();
    }
  });

  // ===== MERGE AND NEST GOOGLE DOCS LISTS (ADJACENCY-BASED) =====
  // Google Docs often splits a single list into multiple <ul>/ <ol> tags with different IDs (lst-kix_...)
  // We merge consecutive lists that share the same list ID prefix into a single nested structure.
  const processedLists = new Set();
  $('ul, ol').each((_, startEl) => {
    if (processedLists.has(startEl)) return;

    const $startList = $(startEl);
    const startClass = $startList.attr('class') || '';
    // Pattern for Google Docs list classes: lst-kix_xxxxxxx-N
    const startIdMatch = startClass.match(/(lst-kix_[a-z0-9_]+)-(\d+)/i);
    if (!startIdMatch) return;

    const listIdPrefix = startIdMatch[1];
    const cluster = [{ el: startEl, $list: $startList }];
    processedLists.add(startEl);

    // Look for consecutive lists that share the same listIdPrefix
    let $next = $startList.next();
    while ($next.length > 0) {
      if ($next.is('ul, ol')) {
        const nextClass = $next.attr('class') || '';
        const nextIdMatch = nextClass.match(/(lst-kix_[a-z0-9_]+)-(\d+)/i);
        if (nextIdMatch && nextIdMatch[1] === listIdPrefix) {
          cluster.push({ el: $next[0], $list: $next });
          processedLists.add($next[0]);
          $next = $next.next();
          continue;
        }
      }

      // Skip "trivial" content (empty paragraphs, BRs) to keep clustering
      const text = $next.text().trim();
      const hasImg = $next.find('img').length > 0;
      if (!text && !hasImg) {
        $next = $next.next();
      } else {
        break;
      }
    }

    if (cluster.length > 0) {
      // Step 1: Flatten all items with their level and original tag
      const allItems = [];
      cluster.forEach(({ $list }) => {
        const listClass = $list.attr('class') || '';
        const listTag = $list[0].tagName.toLowerCase();
        const levelMatch = listClass.match(/lst-kix_[a-z0-9_]+-(\d+)/i);
        const level = levelMatch ? parseInt(levelMatch[1], 10) : 0;

        $list.children('li').each((_, li) => {
          allItems.push({
            html: $(li).html() || '',
            level: level,
            tag: listTag
          });
        });
      });

      // Step 2: Build a hierarchical nested structure
      const buildNestedList = (items, startIndex, currentLevel) => {
        const result = [];
        let i = startIndex;
        while (i < items.length) {
          const item = items[i];
          // If we hit an item with a level lower than the current level, it belongs to a parent
          if (item.level < currentLevel) break;

          if (item.level === currentLevel) {
            // Check if next items are children (deeper level)
            let j = i + 1;
            let nextLevel = -1;
            while (j < items.length && items[j].level > currentLevel) {
              if (nextLevel === -1) nextLevel = items[j].level;
              j++;
            }

            if (nextLevel !== -1) {
              const children = buildNestedList(items, i + 1, nextLevel);
              result.push({ html: item.html, children, tag: item.tag });
              i = j;
            } else {
              result.push({ html: item.html, children: null, tag: item.tag });
              i++;
            }
          } else {
            // Safety skip: item level is higher than current level but no parent was found
            i++;
          }
        }
        return result;
      };

      const minLevel = Math.min(...allItems.map(i => i.level));
      const nestedStructure = buildNestedList(allItems, 0, minLevel);

      // Step 3: Render the nested structure back to HTML
      const renderList = (items) => {
        if (!items || items.length === 0) return '';
        return items.map(item => {
          let liContent = item.html;
          if (item.children && item.children.length > 0) {
            // Use the tag type of the first child at the next level
            const childTag = item.children[0].tag || 'ul';
            liContent += `\n<${childTag}>\n${renderList(item.children)}\n</${childTag}>\n`;
          }
          return `<li>${liContent}</li>`;
        }).join('\n');
      };

      const newHtml = renderList(nestedStructure);

      // Step 4: Update the DOM
      // Check if the base tag (minLevel) matches the $startList tag
      const firstLevelTag = allItems.find(it => it.level === minLevel)?.tag;
      if (firstLevelTag && firstLevelTag !== $startList[0].tagName.toLowerCase()) {
        const $newList = $(`<${firstLevelTag}>${newHtml}</${firstLevelTag}>`);
        // Preserve attributes
        const attrs = $startList[0].attribs;
        if (attrs) {
          for (const attr in attrs) {
            $newList.attr(attr, attrs[attr]);
          }
        }
        $startList.replaceWith($newList);
        // Important: we don't need to update startEl here because we've already added it to processedLists
      } else {
        $startList.html(newHtml);
      }

      // Remove the other lists in the cluster (they have been merged)
      for (let i = 1; i < cluster.length; i++) {
        $(cluster[i].el).remove();
      }
    }
  });

  // ===== MERGE CONSECUTIVE TOC LISTS WITH LEVEL AWARENESS =====
  // This handles cases where TOC lists have different listIds but should be nested
  $('p').each((_, pEl) => {
    const $p = $(pEl);
    const pText = $p.text().trim();

    // Check if this is a TOC header
    if (pText.startsWith('สารบัญ') || pText.includes('目录')) {
      // Collect ALL consecutive lists after this paragraph
      const tocLists = [];
      let $current = $p.next();
      while ($current.length > 0) {
        if ($current.is('ul, ol')) {
          const hasAnchorLinks = $current.find('a[href^="#"]').length > 0 ||
            $current.find('a[href*="#h."]').length > 0;
          if (hasAnchorLinks) {
            // Get level from class (lst-kix_xxx-N)
            const listClass = $current.attr('class') || '';
            const levelMatch = listClass.match(/lst-kix_[a-z0-9_]+-(\d+)/i);
            const level = levelMatch ? parseInt(levelMatch[1], 10) : 0;

            // Check if this list already has nested structure (from previous nesting logic)
            const hasNestedUl = $current.find('ul, ol').length > 0;

            tocLists.push({
              $list: $current,
              level,
              hasNestedUl,
              items: $current.children('li').toArray().map(li => ({
                html: $(li).html() || '',
                level
              }))
            });
          }
        }
        $current = $current.next();
        // Stop if we hit something that's not a list and not empty
        if (!$current.is('ul, ol') && $current.text().trim() &&
          !$current.is('p:empty') && !$current.is('br')) {
          break;
        }
      }

      if (tocLists.length <= 1) return; // Nothing to merge

      // Check if any list already has nested structure (skip if so)
      const anyHasNested = tocLists.some(l => l.hasNestedUl);
      if (anyHasNested) return; // Already nested, don't flatten it

      // Collect all items with levels
      const allTocItems = [];
      tocLists.forEach(({ items }) => {
        allTocItems.push(...items);
      });

      // Check if there's actually nesting to do
      const hasMultipleLevels = new Set(allTocItems.map(i => i.level)).size > 1;
      if (!hasMultipleLevels) {
        // All same level, just merge without nesting
        const $firstList = tocLists[0].$list;
        for (let i = 1; i < tocLists.length; i++) {
          tocLists[i].$list.children('li').each((_, li) => {
            $firstList.append($(li).clone());
          });
          tocLists[i].$list.remove();
        }
        return;
      }

      // Build nested structure from all items
      const minLevel = Math.min(...allTocItems.map(i => i.level));

      const buildNestedFromItems = (items, startIdx, parentLevel) => {
        const result = [];
        let i = startIdx;

        while (i < items.length) {
          const item = items[i];

          if (item.level < parentLevel) break;

          if (item.level === parentLevel) {
            // Find children (items with level > parentLevel until next item at parentLevel or below)
            let j = i + 1;
            while (j < items.length && items[j].level > parentLevel) {
              j++;
            }

            if (j > i + 1) {
              // Has children
              const children = buildNestedFromItems(items, i + 1, parentLevel + 1);
              result.push({ html: item.html, children });
            } else {
              result.push({ html: item.html, children: null });
            }
            i = j;
          } else {
            // Skip items at higher levels (they'll be processed as children)
            i++;
          }
        }

        return result;
      };

      const nestedResult = buildNestedFromItems(allTocItems, 0, minLevel);

      // Build HTML from nested structure
      const buildHtmlFromNested = (items, tag) => {
        return items.map(item => {
          if (item.children && item.children.length > 0) {
            const childHtml = `<${tag}>${buildHtmlFromNested(item.children, tag)}</${tag}>`;
            return `<li>${item.html}${childHtml}</li>`;
          }
          return `<li>${item.html}</li>`;
        }).join('');
      };

      const $firstList = tocLists[0].$list;
      const listTag = $firstList.is('ol') ? 'ol' : 'ul';
      const newHtml = buildHtmlFromNested(nestedResult, listTag);

      $firstList.html(newHtml);

      // Remove other lists
      for (let i = 1; i < tocLists.length; i++) {
        tocLists[i].$list.remove();
      }
    }
  });

  // NOTE: Removed the "duplicate TOC list removal" logic that was here.
  // It was incorrectly removing sub-item lists (level 1, 2, etc.) that are part of TOC
  // but not directly after the "สารบัญ" paragraph.
  // The nesting logic above should handle merging all TOC lists properly.

  // Remove SEO checklist and unwanted content patterns
  const unwantedPatterns = [
    /^Keywords Top of/i,
    /^URL มี Keywords/i,
    /^Headline <h1>/i,
    /^Use keyword in title tag/i,
    /^Description มี Keywords/i,
    /^Use Keywords in H1/i,
    /^Image at every scroll/i,
    /^Internal Link หาลิงก์/i,
    /^Internal Link ควรมี/i,
    /^External Link มีลิงก์/i,
    /^External Link มีโยง/i,
    /^Related phrases/i,
    /^Structured data มีหรือ/i,
    /^Structured data มีโครงสร้าง/i,
    /^Check Search Inter/i,
    /^Formatting short paragraphs/i,
    /^Keyphrase usage/i,
    /^Length 1500/i,
    /^Call to action/i,
    /^\[a\]link\s*>>/i,
    /^\[b\]link\s*>>/i,
    /^\[c\]link\s*>>/i,
    /^\[d\]link\s*>>/i,
    /^\[blog_doctorbanner\]/i,
    /^\[blog_/i,
    /^\[\/\]\s*Shortcode/i,
    /^This image has an empty alt/i,
    /^its file name is/i,
    /file name is image\d+\.png/i,
    /^Description มี/i,
    /^Image at every/i,
  ];

  $('p, li').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();

    // Check if matches any unwanted pattern
    if (unwantedPatterns.some(pattern => pattern.test(text))) {
      $el.remove();
      return;
    }
  });

  // Remove entire ul/ol lists that contain SEO checklist items
  // These are lists that contain items like "Description มี Keywords", "Internal Link ควรมี", etc.
  const seoChecklistPatterns = [
    /Description มี Keywords/i,
    /Internal Link.*ควรมี/i,
    /External Link.*มีโยง/i,
    /Structured data.*มีโครงสร้าง/i,
    /Formatting short paragraphs/i,
    /Length 1500\+? words/i,
    /Keyphrase usage/i,
    /Call to action/i,
    /Keywords.*หลัก.*รอง/i,
    /Image at every/i,
  ];

  $('ul, ol').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();

    // Check if the list contains SEO checklist items
    const isSEOChecklist = seoChecklistPatterns.some(pattern => pattern.test(text));
    if (isSEOChecklist) {
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

  // Clean Google redirect URLs - extract actual URL from q= parameter
  // Example: https://www.google.com/url?q=https://actual-url.com&sa=D&... → https://actual-url.com
  $('a[href*="google.com/url"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';

    // Extract URL from q= parameter
    const qMatch = href.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      try {
        const actualUrl = decodeURIComponent(qMatch[1]);
        $el.attr('href', actualUrl);
      } catch (e) {
        // If decoding fails, try to use the raw value
        $el.attr('href', qMatch[1]);
      }
    }
  });

  // Clean link styles and add target="_blank" for external links
  // These are Google Docs default styles that are not needed
  const internalDomainsClean = [
    'vsquareclinic.com', 'www.vsquareclinic.com',
    'vsqclinic.com', 'www.vsqclinic.com',
    'vsquareconsult.com', 'www.vsquareconsult.com',
    'vsquare.clinic', 'www.vsquare.clinic',
    'vsquare-under-eye.com', 'www.vsquare-under-eye.com',
    'vsquareclinic.co', 'www.vsquareclinic.co',
    'vsq-injector.com', 'www.vsq-injector.com',
    'en.vsquareclinic.com', 'www.en.vsquareclinic.com',
    'doctorvsquareclinic.com', 'www.doctorvsquareclinic.com',
    'cn.vsquareclinic.com', 'www.cn.vsquareclinic.com',
    'drvsquare.com', 'www.drvsquare.com',
    'monghaclinic.com', 'www.monghaclinic.com',
    'bestbrandclinic.com', 'www.bestbrandclinic.com'
  ];

  $('a').each((_, el) => {
    const $el = $(el);
    let style = $el.attr('style') || '';
    const href = $el.attr('href') || '';

    // Remove inherit styles (color: inherit, text-decoration: inherit)
    style = style.replace(/color\s*:\s*inherit\s*;?/gi, '');
    style = style.replace(/text-decoration\s*:\s*inherit\s*;?/gi, '');
    style = style.replace(/text-decoration-skip-ink\s*:\s*none\s*;?/gi, '');
    style = style.replace(/-webkit-text-decoration-skip\s*:\s*none\s*;?/gi, '');

    // Clean up empty or whitespace-only style
    style = style.trim().replace(/^;+|;+$/g, '').trim();

    if (style) {
      $el.attr('style', style);
    } else {
      $el.removeAttr('style');
    }

    // Add target="_blank" for external links
    if (href && !$el.attr('target')) {
      const isExternal = !internalDomainsClean.some(domain => href.includes(domain));
      if (isExternal) {
        $el.attr('target', '_blank');
        $el.attr('rel', 'noreferrer noopener');
      }
    }
  });

  // Remove <u> tags that wrap <a> tags (underline on links is not needed)
  // Pattern: <u><a href="...">text</a></u> → <a href="...">text</a>
  $('u').each((_, el) => {
    const $u = $(el);
    const $children = $u.children();

    // If <u> contains only an <a> tag (possibly with text), unwrap it
    if ($children.length === 1 && $children.first().is('a')) {
      // Check if all content is inside the <a> tag
      const uText = $u.text().trim();
      const aText = $children.first().text().trim();

      if (uText === aText) {
        // All content is in the <a>, so unwrap the <u>
        $u.replaceWith($u.html());
      }
    }
    // Also handle case where <u> directly contains <a> with exact same content
    else if ($u.find('a').length === 1) {
      const $a = $u.find('a').first();
      const uHtml = $u.html() || '';
      const aOuterHtml = $.html($a);

      // If <u> only contains the <a> tag (with possible whitespace)
      if (uHtml.trim() === aOuterHtml.trim()) {
        $u.replaceWith(aOuterHtml);
      }
    }
  });

  // FIRST: Convert font-weight bold and font-style italic to tags BEFORE unwrapping spans
  // This must happen before span unwrapping to preserve bold/italic formatting
  // We process BOTTOM-UP (children first) to prevent parent updates from detaching children
  $($('*').get().reverse()).each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName ? el.tagName.toLowerCase() : '';

    // Skip certain tags
    if (['html', 'head', 'body', 'script', 'style', 'strong', 'b', 'em', 'i', 'u'].includes(tagName)) return;

    let style = $el.attr('style') || '';
    let html = $el.html() || '';
    const originalHtml = html;
    const text = $el.text().trim();
    let styleChanged = false;
    let contentChanged = false;

    // Check for font-weight in style attribute, innerHTML, OR CSS class
    const hasBoldInStyle = /font-weight\s*:\s*(bold|bolder|[5-9]00)/i.test(style);
    const hasBoldInHtml = /font-weight\s*:\s*(bold|bolder|[5-9]00)/i.test(html);
    const hasBoldInClass = hasBoldFromClass($el);

    if ((hasBoldInStyle || hasBoldInHtml || hasBoldInClass) && text) {
      if (!html.includes('<strong>') && !html.includes('<b>')) {
        // If the element itself has bold style (inline or from class), wrap content
        if (hasBoldInStyle || hasBoldInClass) {
          html = `<strong>${html}</strong>`;
          contentChanged = true;
        }
      }
      // Remove font-weight from style (keep it if it's a link for safety)
      if (tagName !== 'a') {
        style = style.replace(/font-weight\s*:\s*[^;]+;?/gi, '');
        styleChanged = true;
      }
    }

    // Check for font-style: italic and text-decoration: underline
    const hasItalicInStyle = /font-style\s*:\s*italic/i.test(style);
    const hasItalicInHtml = /font-style\s*:\s*italic/i.test(html);
    const hasItalicInClass = hasItalicFromClass($el);
    const hasItalic = (hasItalicInStyle || hasItalicInHtml || hasItalicInClass);

    const hasUnderlineInStyle = /text-decoration[^:]*:\s*[^;]*underline/i.test(style);
    const hasUnderlineInHtml = /text-decoration[^:]*:\s*[^;]*underline/i.test(html);
    const hasUnderlineInClass = hasUnderlineFromClass($el);
    const containsLink = $el.find('a').length > 0 || html.includes('<a ');
    const hasUnderline = (hasUnderlineInStyle || hasUnderlineInHtml || hasUnderlineInClass) && !containsLink;

    if (hasItalic && hasUnderline && text && !html.includes('text-decoration: underline')) {
      if (hasItalicInStyle || hasItalicInClass || hasUnderlineInStyle || hasUnderlineInClass) {
        html = `<em style="text-decoration: underline;">${html}</em>`;
        contentChanged = true;
      }
      // Remove both from style
      style = style.replace(/font-style\s*:\s*[^;]+;?/gi, '');
      style = style.replace(/text-decoration[^:]*:\s*[^;]*underline[^;]*;?/gi, '');
      styleChanged = true;
    } else {
      // Handle separately
      if (hasItalic && text && !html.includes('<em>') && !html.includes('<i>')) {
        if (hasItalicInStyle || hasItalicInClass) {
          html = `<em>${html}</em>`;
          contentChanged = true;
        }
        style = style.replace(/font-style\s*:\s*[^;]+;?/gi, '');
        styleChanged = true;
      }

      if (hasUnderline && text && !html.includes('<u>')) {
        if (hasUnderlineInStyle || hasUnderlineInClass) {
          html = `<u>${html}</u>`;
          contentChanged = true;
        }
        style = style.replace(/text-decoration[^:]*:\s*[^;]*underline[^;]*;?/gi, '');
        styleChanged = true;
      }
    }

    // Color preservation
    const colorFromClass = hasColorFromClass($el);
    if (colorFromClass && !/color\s*:/i.test(style)) {
      style += (style.endsWith(';') ? ' ' : (style ? '; ' : '')) + `color: ${colorFromClass};`;
      styleChanged = true;
    }

    // Alignment preservation
    const textAlignFromClass = hasTextAlignFromClass($el);
    if (textAlignFromClass && !/text-align\s*:/i.test(style) && !/margin\s*[:\-]/i.test(style)) {
      if (textAlignFromClass === 'center' && (tagName === 'table' || tagName === 'div')) {
        style += (style.endsWith(';') ? ' ' : (style ? '; ' : '')) + 'margin-left: auto; margin-right: auto; text-align: center;';
      } else {
        style += (style.endsWith(';') ? ' ' : (style ? '; ' : '')) + `text-align: ${textAlignFromClass};`;
      }
      styleChanged = true;
    }

    // Apply content changes (only if HTML content string actually changed)
    if (contentChanged && html !== originalHtml) {
      $el.html(html);
    }

    // Apply attribute changes
    if (styleChanged) {
      style = style.trim();
      if (style) {
        $el.attr('style', style);
      } else if ($el.attr('style') !== undefined) {
        $el.removeAttr('style');
      }
    }
  });

  // Second pass: Remove redundant spans that are now empty or just wrappers
  // (The original second pass was redundant with the first one's bold/italic handling)

  // Aggressively clean unwanted and default styles - DO THIS BEFORE UNWRAPPING
  $('*').each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style');
    if (style) {
      const styleMap = parseStyleString(style);
      const propertiesToRemove = [
        'font-size', 'line-height', 'font-family', 'orphans', 'widows',
        'background-color', 'background', 'white-space', 'vertical-align',
        'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
        'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
        'border', 'border-top', 'border-bottom', 'border-left', 'border-right'
      ];

      // Remove unwanted properties
      propertiesToRemove.forEach(prop => {
        // Special case for tables: keep margin-left/right if they are 'auto' (used for centering)
        if ($el.is('table') && (prop === 'margin-left' || prop === 'margin-right' || prop === 'margin')) {
          const val = styleMap.get(prop);
          if (val && val.includes('auto')) return;
        }
        styleMap.delete(prop);
      });

      // Remove default/normal values
      if (styleMap.get('font-weight') === '400' || styleMap.get('font-weight') === 'normal') {
        styleMap.delete('font-weight');
      }
      if (styleMap.get('font-style') === 'normal') {
        styleMap.delete('font-style');
      }
      if (styleMap.get('text-decoration') === 'none') {
        styleMap.delete('text-decoration');
      }

      const color = styleMap.get('color');
      if (color && (!isRedColor(color) || color === 'inherit')) {
        styleMap.delete('color');
      }

      // Reconstruct cleaned style
      const cleanedStyle = styleMapToString(styleMap);
      if (cleanedStyle) {
        $el.attr('style', cleanedStyle);
      } else {
        $el.removeAttr('style');
      }
    }
  });

  // Unwrap unnecessary spans - remove spans with only generic font styling
  // Keep spans with meaningful styles (colors, especially red) or classes
  const unwrapSpans = () => {
    let changed = false;
    $('span').each((_, el) => {
      const $el = $(el);

      // Skip if contains nested spans (process innermost first)
      if ($el.find('span').length > 0) {
        return;
      }

      const style = $el.attr('style') || '';
      // If no style, always unwrap
      // (We ignore classes here because they are all stripped at the end of cleanHTML anyway)
      if (!style) {
        $el.replaceWith($el.html() || '');
        changed = true;
        return;
      }

      // Parse style to check if it's meaningful
      const styleMap = parseStyleString(style);

      // Check for meaningful styles that should be preserved
      const hasMeaningfulStyle = Array.from(styleMap.keys()).some(prop => {
        const value = styleMap.get(prop);

        // Keep color styles (especially red tones)
        if (prop === 'color') {
          return isRedColor(value);
        }

        // Keep background colors
        if (prop === 'background-color' || prop === 'background') {
          return true;
        }

        // Keep text decorations (underline, line-through)
        if (prop === 'text-decoration' && value !== 'none') {
          return true;
        }

        // Keep font-weight if bold
        if (prop === 'font-weight') {
          return value === 'bold' || value === '700' || parseInt(value || '0') >= 600;
        }

        // Keep font-style if italic
        if (prop === 'font-style' && value === 'italic') {
          return true;
        }

        // Ignore generic font properties (these are not meaningful)
        if (prop === 'font-family' || prop === 'font-size' || prop === 'line-height') {
          return false;
        }

        // Keep any other uncommon styles
        return true;
      });

      // If no meaningful styles, unwrap the span
      if (!hasMeaningfulStyle) {
        $el.replaceWith($el.html() || '');
        changed = true;
      }
    });
    return changed;
  };
  while (unwrapSpans()) { /* keep unwrapping */ }

  // Remove data attributes and clean up IDs
  $('[data-docs-internal-guid]').removeAttr('data-docs-internal-guid');
  $('*').each((_, el) => {
    const $el = $(el);
    const attrs = el.attribs || {};
    Object.keys(attrs).forEach(attr => {
      if (attr.startsWith('data-')) {
        $el.removeAttr(attr);
      }
    });

    $el.removeAttr('class');
  });

  // Remove style attribute from all <a> tags (links should not have inline styles)
  $('a').removeAttr('style');

  // Remove style attribute from u tags inside links
  $('a u').removeAttr('style');
  $('u').each((_, el) => {
    const $el = $(el);
    // If u is inside a link, unwrap it
    if ($el.parent('a').length > 0) {
      $el.replaceWith($el.html() || '');
    }
  });

  // Remove id attributes from headings (Google Docs adds these)
  $('h1, h2, h3, h4, h5, h6').removeAttr('id');

  // NOTE: YouTube caption processing is now done in convertToGutenberg
  // because data attributes are lost when converting to HTML string

  // Remove empty paragraphs, divs and spans - those with no text, images, or other meaningful content
  const removeEmptyTags = () => {
    let changed = false;
    $('p, div, span').each((_, el) => {
      const $el = $(el);
      // Don't remove if it contains media or structural elements
      if ($el.find('img, iframe, table, ul, ol, figure, video, audio, blockquote').length > 0) return;

      const text = $el.text().replace(/[\s\u00A0\u200B\uFEFF]/g, '').trim();
      if (!text) {
        $el.remove();
        changed = true;
      }
    });
    return changed;
  };
  while (removeEmptyTags()) { /* recursive removal */ }

  // Clean up whitespace - only trim the final result
  let htmlContent = $('body').length > 0 ? $('body').html() : $.html();
  htmlContent = htmlContent ? htmlContent.trim() : '';

  return { html: htmlContent || '', removed };
}

/**
 * Parse and merge style properties
 */
function parseStyleString(styleStr) {
  const styleMap = new Map();
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
function styleMapToString(styleMap) {
  const parts = [];
  styleMap.forEach((value, prop) => {
    parts.push(`${prop}: ${value}`);
  });
  return parts.join('; ');
}

/**
 * Inline CSS styles - Enhanced for Google Docs
 */
export function inlineStyles(html, cssMap) {
  const $ = cheerio.load(html, {});

  // Process all elements with classes
  $('[class]').each((_, el) => {
    const $el = $(el);
    const classes = ($el.attr('class') || '').split(/\s+/).filter(Boolean);

    // Collect all styles from classes
    const mergedStyles = new Map();

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
function wrapBlock(blockType, content, attrs) {
  const attrString = attrs && Object.keys(attrs).length > 0
    ? ` ${JSON.stringify(attrs)}`
    : '';
  return `<!-- wp:${blockType}${attrString} -->\n${content}\n<!-- /wp:${blockType} -->`;
}

/**
 * Process span content with styles - Preserve all formatting
 */
function processStyledContent($el, $) {
  let content = $el.html() || '';
  const style = $el.attr('style') || '';
  const styleMap = parseStyleString(style);

  // Collect all inline styles to preserve
  const preserveStyles = [];

  // Handle font-weight (bold)
  const fontWeight = styleMap.get('font-weight');
  if (fontWeight === 'bold' || fontWeight === '700' || parseInt(fontWeight || '0') >= 600) {
    content = `<strong>${content}</strong>`;
  }

  // Handle font-style (italic) and text-decoration (underline) combined
  const isItalic = styleMap.get('font-style') === 'italic';
  const textDecoration = styleMap.get('text-decoration');
  const isUnderline = textDecoration?.includes('underline');

  if (isItalic && isUnderline) {
    content = `<em style="text-decoration: underline;">${content}</em>`;
  } else if (isItalic) {
    content = `<em>${content}</em>`;
  } else if (isUnderline) {
    content = `<u>${content}</u>`;
  }

  if (textDecoration?.includes('line-through')) {
    content = `<s>${content}</s>`;
  }

  // Preserve color (only red tones)
  const color = styleMap.get('color');
  if (color && isRedColor(color)) {
    preserveStyles.push(`color: ${color}`);
  }

  // Wrap with span for other styles
  if (preserveStyles.length > 0) {
    content = `<span style="${preserveStyles.join('; ')}">${content}</span>`;
  }

  return content;
}

/**
 * Check if the color is a red tone
 * We want to keep ONLY red colors
 */
function isRedColor(color) {
  if (!color) return false;
  const c = color.toLowerCase().trim();

  // Common Red Hex/Names from Google Docs and MS Word
  const redHexes = ['#ff0000', '#f00', '#cc0000', '#990000', '#e06666', '#ea4335', '#f44336', '#ff5252', '#ff4d4d', '#dc3545'];
  if (redHexes.some(h => c.includes(h)) || c === 'red') return true;

  // RGB check for red dominance
  const rgbMatch = c.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    // Red must be dominant: R is high and R > G+40 and R > B+40
    return r > 100 && r > (g + 40) && r > (b + 40);
  }

  // Hex dominance check (e.g. #FF1212)
  if (c.startsWith('#') && (c.length === 7 || c.length === 4)) {
    let r, g, b;
    if (c.length === 7) {
      r = parseInt(c.slice(1, 3), 16);
      g = parseInt(c.slice(3, 5), 16);
      b = parseInt(c.slice(5, 7), 16);
    } else {
      r = parseInt(c[1] + c[1], 16);
      g = parseInt(c[2] + c[2], 16);
      b = parseInt(c[3] + c[3], 16);
    }
    return r > 150 && r > (g + 50) && r > (b + 50);
  }

  return false;
}

/**
 * Extract alignment and generate Gutenberg classes
 * Improved accuracy for Word/Google Docs styles
 */
function getAlignmentFromStyle(style, className = '', alignAttr = '') {
  const s = (style || '').toLowerCase();
  const c = (className || '').toLowerCase();
  const a = (alignAttr || '').toLowerCase();

  let align = null;

  // 1. Check for large left margin/indent used as "center" hack (Google Docs/Word hack)
  // This takes priority over generic text-align: left
  const marginLeftMatch = s.match(/margin-left\s*:\s*(-?\d+(?:\.\d+)?)(pt|px|in|cm|mm|em|rem)/i);
  const textIndentMatch = s.match(/text-indent\s*:\s*(-?\d+(?:\.\d+)?)(pt|px|in|cm|mm|em|rem)/i);

  let marginLeftPt = 0;
  if (marginLeftMatch) {
    const val = parseFloat(marginLeftMatch[1]);
    const unit = marginLeftMatch[2].toLowerCase();
    marginLeftPt = unit === 'pt' ? val : (unit === 'px' ? val * 0.75 : (unit === 'in' ? val * 72 : val));
  }

  let textIndentPt = 0;
  if (textIndentMatch) {
    const val = parseFloat(textIndentMatch[1]);
    const unit = textIndentMatch[2].toLowerCase();
    textIndentPt = unit === 'pt' ? val : (unit === 'px' ? val * 0.75 : (unit === 'in' ? val * 72 : val));
  }

  // If combined indent/margin is 80pt or more, it's very likely a "pseudo-centering" hack
  // Also check for mso-style-centered
  if ((marginLeftPt + textIndentPt) >= 60) {
    align = 'center';
  }

  // 2. Check align attribute
  if (!align && ['left', 'center', 'right', 'justify'].includes(a)) {
    align = a;
  }
  // 3. Check style attribute (including mso- variants)
  else if (!align) {
    const textAlignMatch = s.match(/(?:^|;)\s*(?:mso-)?text-align\s*:\s*(left|center|right|justify)\b/i);
    if (textAlignMatch) {
      align = textAlignMatch[1].toLowerCase();
    }
    // 4. Check for centered tables via margins
    else if (s.match(/margin-left\s*:\s*auto/i) && s.match(/margin-right\s*:\s*auto/i)) {
      align = 'center';
    }
    else if (s.match(/margin\s*:\s*[^;]*auto/i)) {
      align = 'center';
    }
    // 5. Check class names
    else if (/\b(has-text-align-center|text-center|center)\b/.test(c)) {
      align = 'center';
    } else if (/\b(has-text-align-right|text-right|right)\b/.test(c)) {
      align = 'right';
    } else if (/\b(has-text-align-left|text-left|left)\b/.test(c)) {
      align = 'left';
    } else if (/\b(has-text-align-justify|justify)\b/.test(c)) {
      align = 'justify';
    }
  }

  const classNameResult = align && align !== 'left' ? `has-text-align-${align}` : '';
  return { align, className: classNameResult };
}

/**
 * Unified helper to get explicit alignment from a cheerio element
 */
function getExplicitAlignment($el, checkParent = false) {
  if (!$el || $el.length === 0) return { align: null, className: '' };

  // First check the element itself
  let result = getAlignmentFromStyle(
    $el.attr('style') || '',
    $el.attr('class') || '',
    $el.attr('align') || ''
  );

  // If no alignment found and it's a table cell (td/th) or table, check first child paragraph
  if (!result.align && ($el.is('td') || $el.is('th') || $el.is('table'))) {
    const $firstP = $el.find('p').first();
    if ($firstP.length > 0) {
      result = getAlignmentFromStyle(
        $firstP.attr('style') || '',
        $firstP.attr('class') || '',
        $firstP.attr('align') || ''
      );
    }

    // If still no alignment, check any direct children for alignment
    if (!result.align) {
      $el.contents().each((_, child) => {
        if (child.type === 'tag') {
          // Access attributes directly from the raw node object to avoid cheerio function errors
          const childStyle = child.attribs?.style || '';
          const childClass = child.attribs?.class || '';
          const childAlignAttr = child.attribs?.align || '';

          const childAlign = getAlignmentFromStyle(childStyle, childClass, childAlignAttr);
          if (childAlign.align) {
            result = childAlign;
            return false; // break
          }
        }
      });
    }
  }

  // New: check parent if requested (important for tables wrapped in centered divs)
  if (!result.align && checkParent) {
    const $parent = $el.parent();
    if ($parent.length > 0 && ($parent.is('div') || $parent.is('span') || $parent.is('p'))) {
      const parentResult = getAlignmentFromStyle(
        $parent.attr('style') || '',
        $parent.attr('class') || '',
        $parent.attr('align') || ''
      );
      if (parentResult.align) {
        result = parentResult;
      }
    }
  }

  return result;
}

/**
 * Generate Gutenberg color classes and styles
 */
function getColorStyles(style) {
  const styleMap = parseStyleString(style);
  const classes = [];
  const styles = [];

  const color = styleMap.get('color');
  const bgColor = styleMap.get('background-color') || styleMap.get('background');

  // Store the actual text color (non-black) for WordPress block attributes
  let textColor = null;

  if (color && isRedColor(color)) {
    classes.push('has-text-color');
    classes.push('has-link-color');
    styles.push(`color: ${color}`);
    textColor = color;
  }

  if (bgColor && bgColor !== 'transparent' && bgColor !== 'none') {
    styles.push(`background-color: ${bgColor}`);
  }

  return {
    classes,
    inlineStyle: styles.length > 0 ? ` style="${styles.join('; ')}"` : '',
    textColor
  };
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url) {
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
 * Normalize YouTube URL for Map keys
 */
function normalizeYouTubeUrl(url) {
  if (!url) return '';
  return url
    .replace(/^(https?:)?\/\//, '')
    .replace(/^www\./, '')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Create YouTube embed block
 * Caption styling follows original - only italic if source was italic
 * @param {string} url - YouTube URL
 * @param {string} caption - Caption text
 * @param {boolean} isItalic - Whether caption should be italic (from source)
 */
function createYouTubeEmbedBlock(url, caption, isItalic = false, isUnderline = false) {
  const videoId = extractYouTubeId(url);
  if (!videoId) return '';

  // Escape & to &amp; in URL for HTML
  const escapedUrl = url.replace(/&/g, '&amp;');

  let content = `<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio"><div class="wp-block-embed__wrapper">
${escapedUrl}
</div>`;

  if (caption) {
    // Handle line breaks
    const captionHtml = caption.replace(/\n/g, '<br>');
    // Handle styling
    if (isItalic && isUnderline) {
      content += `<figcaption class="wp-element-caption"><em style="text-decoration: underline;">${captionHtml}</em></figcaption>`;
    } else if (isItalic) {
      content += `<figcaption class="wp-element-caption"><em>${captionHtml}</em></figcaption>`;
    } else if (isUnderline) {
      content += `<figcaption class="wp-element-caption"><u>${captionHtml}</u></figcaption>`;
    } else {
      content += `<figcaption class="wp-element-caption">${captionHtml}</figcaption>`;
    }
  }

  content += '</figure>';

  return `<!-- wp:embed {"url":"${url}","type":"video","providerNameSlug":"youtube","responsive":true,"className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} -->
${content}
<!-- /wp:embed -->`;
}

/**
 * Clean alt text - remove "Alt:" or "alt:" prefix
 */
function cleanAltText(alt) {
  return alt.replace(/^(Alt+|alt+)\s*:\s*/i, '').trim();
}

/**
 * Generate random unique ID for Kadence blocks
 */
function generateKadenceUniqueId() {
  const randomNum = Math.floor(Math.random() * 1000000);
  const randomHex = Math.random().toString(16).substring(2, 8);
  return `${randomNum}_${randomHex}`;
}

/**
 * Create Kadence Row Layout for multiple images (2 images side by side)
 */
function createKadenceRowLayout(images) {
  const uniqueId = generateKadenceUniqueId();

  // For 2 images - use the new format
  if (images.length === 2) {
    const col1Id = generateKadenceUniqueId();
    const col2Id = generateKadenceUniqueId();
    const img1 = images[0];
    const img2 = images[1];
    return `<!-- wp:kadence/rowlayout {"uniqueID":"${uniqueId}","colLayout":"equal","firstColumnWidth":0,"secondColumnWidth":0,"thirdColumnWidth":0,"fourthColumnWidth":0,"fifthColumnWidth":0,"sixthColumnWidth":0,"kbVersion":2} -->

<!-- wp:kadence/column {"borderWidth":["","","",""],"uniqueID":"${col1Id}","kbVersion":2} -->

<div class="wp-block-kadence-column kadence-column${col1Id}"><div class="kt-inside-inner-col"><!-- wp:image -->

<figure class="wp-block-image"><img src="" alt="${img1.alt || ''}"/></figure>

<!-- /wp:image --></div></div>

<!-- /wp:kadence/column -->

<!-- wp:kadence/column {"id":2,"borderWidth":["","","",""],"uniqueID":"${col2Id}","kbVersion":2} -->

<div class="wp-block-kadence-column kadence-column${col2Id}"><div class="kt-inside-inner-col"><!-- wp:image -->

<figure class="wp-block-image"><img src="" alt="${img2.alt || ''}"/></figure>

<!-- /wp:image --></div></div>

<!-- /wp:kadence/column -->

<!-- /wp:kadence/rowlayout -->`;
  }

  // For other number of images
  const columns = images.length;
  let innerBlocks = '';

  images.forEach((img, index) => {
    const colId = generateKadenceUniqueId();
    const idAttr = index === 0 ? '' : `"id":${index + 1},`;

    innerBlocks += `<!-- wp:kadence/column {${idAttr}"borderWidth":["","","",""],"uniqueID":"${colId}","kbVersion":2} -->

<div class="wp-block-kadence-column kadence-column${colId}"><div class="kt-inside-inner-col"><!-- wp:image -->

<figure class="wp-block-image"><img src="" alt="${img.alt || ''}"/></figure>

<!-- /wp:image --></div></div>

<!-- /wp:kadence/column -->

`;
  });

  return `<!-- wp:kadence/rowlayout {"uniqueID":"${uniqueId}","columns":${columns},"colLayout":"equal","firstColumnWidth":0,"secondColumnWidth":0,"thirdColumnWidth":0,"fourthColumnWidth":0,"fifthColumnWidth":0,"sixthColumnWidth":0,"kbVersion":2} -->

${innerBlocks}
<!-- /wp:kadence/rowlayout -->`;
}

/**
 * Check if paragraph is a special type and return appropriate class
 * Based on Home.jsx conversion rules
 */
function getSpecialParagraphClass(text, html) {
  const lowerText = text.toLowerCase().trim();
  const trimmedText = text.trim();

  // Table of contents - สารบัญ
  // Support variations: Table of content, Table of contents, TOC, etc.
  if (trimmedText.startsWith('สารบัญ') ||
    trimmedText.startsWith('คลิกอ่านหัวข้อ') ||
    trimmedText.includes('目录') ||
    lowerText.startsWith('table of content') ||
    lowerText.startsWith('toc :') ||
    lowerText.startsWith('toc:') ||
    lowerText.startsWith('toc')) {
    // Use HTML content to preserve <strong> tags if present
    const tocHtml = html && html.trim() ? html.trim() : trimmedText;
    return { class: 'subtext-gtb', addSeparator: false, isTOC: true, tocTitle: trimmedText, tocHtml: tocHtml };
  }

  // Read more - อ่านบทความเพิ่มเติม
  if (trimmedText.startsWith('อ่านบทความเพิ่มเติม') ||
    trimmedText.startsWith('อ่านเพิ่มเติม') ||
    trimmedText.startsWith('คลิกอ่านเพิ่มเติม') ||
    trimmedText.startsWith('คลิกอ่านบทความ') ||
    trimmedText.startsWith('หมอได้สรุปข้อมูล') ||
    trimmedText.startsWith('อ่านบทความแนะนำ') ||
    lowerText.includes('อ่านบทความเพิ่มเติม') ||
    lowerText.includes('อ่านบทความแนะนำ')) {
    return { class: 'vsq-readmore', addSeparator: false, isReadMore: true };
  }

  // References - อ้างอิง
  if (trimmedText.startsWith('อ้างอิง') ||
    trimmedText.startsWith('เอกสารอ้างอิง') ||
    trimmedText.startsWith('เอกสาร อ้างอิง') ||
    trimmedText.startsWith('แหล่งข้อมูลอ้างอิง') ||
    lowerText.startsWith('reference')) {
    return { class: 'references', addSeparator: true };
  }

  // Headline - บทความเจาะลึก/บทความแนะนำ
  if (trimmedText === 'บทความเจาะลึก' || trimmedText === 'บทความแนะนำ') {
    return { class: 'headline', addSeparator: false, align: 'center' };
  }

  // ข้อควรรู้ - special quote block (check BEFORE general quote detection)
  // Only convert when the paragraph is a standalone "ข้อควรรู้" message wrapped in quote marks
  const containsKnowledgeQuote = trimmedText.includes('\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e23\u0e23\u0e39\u0e49');
  if (containsKnowledgeQuote) {
    const quoteChars = ['"', '\u201C', '\u201D', "'", '\u2018', '\u2019'];
    const firstChar = trimmedText.charAt(0);
    const lastChar = trimmedText.charAt(trimmedText.length - 1);
    const hasQuoteMarks = quoteChars.includes(firstChar) && quoteChars.includes(lastChar);
    const strippedKnowledgeText = trimmedText
      .replace(/^["'\u201C\u201D\u2018\u2019]+/, '')
      .replace(/["'\u201C\u201D\u2018\u2019]+$/, '')
      .trim();

    if (strippedKnowledgeText.startsWith('\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e23\u0e23\u0e39\u0e49') && hasQuoteMarks) {
      return { isQuote: true, isKnowledgeQuote: true, hasQuoteMarks: true };
    }
  }

  // Quote detection - starts and ends with quotes (general)
  // Support all types of quote marks: " (U+0022), " (U+201C), " (U+201D)
  const quoteStartChars = ['"', '\u201C', '\u201D'];
  const quoteEndChars = ['"', '\u201C', '\u201D'];
  const firstCharGeneral = trimmedText.charAt(0);
  const lastCharGeneral = trimmedText.charAt(trimmedText.length - 1);
  const startsWithQuote = quoteStartChars.includes(firstCharGeneral);
  const endsWithQuote = quoteEndChars.includes(lastCharGeneral);
  if (startsWithQuote && endsWithQuote && trimmedText.length > 2) {
    return { isQuote: true, hasQuoteMarks: true };
  }

  // Alt text - should be removed
  if (/^(Alt+|alt+|ALT+)\s*:/i.test(trimmedText) ||
    /\b(Alt+|alt+|ALT+)\s*:/i.test(trimmedText) ||
    trimmedText.toLowerCase().startsWith('(alt') ||
    trimmedText.toLowerCase().startsWith('alt:')) {
    return { shouldRemove: true };
  }

  // Line@ promotion
  if (trimmedText === 'แอด Line@ เพื่อรับโปรโมชั่น' || trimmedText === 'แอด Line@ เพื่อรับโปรโมชัน') {
    return { class: 'headline', addSeparator: false, align: 'center', isLinePromo: true };
  }

  return null;
}

/**
 * Generate hash ID from text (for heading anchors)
 * Based on Home.jsx generateHashId function
 * Supports Thai, Chinese, and English text
 */
function generateHashId(text) {
  return text
    .replace(/\<\/?[^\>]+(\>|$)/g, '')  // Remove HTML tags first
    .replace(/\[.*?\]/g, '')       // Remove shortcodes like [current_year]
    .replace(/&nbsp;/gi, ' ')      // Convert &nbsp; to regular space (IMPORTANT: do this before &amp; normalization)
    .replace(/\u00A0/g, ' ')       // Convert Unicode non-breaking space to regular space
    .replace(/\&amp;/g, '&')      // Normalize &amp; to & first (IMPORTANT: do this before toLowerCase)
    .toLowerCase()
    // Remove common punctuation and special characters
    .replace(/['"""`]/g, '')  // Remove quotes and apostrophes
    .replace(/[,;!]/g, '')     // Remove commas, semicolons, exclamation marks
    .replace(/\?/g, '')
    .replace(/\./g, '')
    .replace(/:/g, '')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/\&/g, '-and-')      // Convert & to -and- (after normalization)
    .replace(/\+/g, '-plus-')     // Convert + to -plus-
    .replace(/\//g, '-')          // Convert / to -
    .replace(/\\/g, '-')          // Convert \ to -
    .replace(/\(/g, '')           // Remove opening parenthesis
    .replace(/\)/g, '')           // Remove closing parenthesis
    .replace(/\[/g, '')           // Remove opening bracket
    .replace(/\]/g, '')           // Remove closing bracket
    .trim()
    .replace(/\s+/g, '-')         // Replace spaces with dashes
    .replace(/-+/g, '-')          // Replace multiple dashes with single dash
    .replace(/^-+/, '')           // Remove leading dashes
    .replace(/-+$/, '')           // Remove trailing dashes
    // Keep only Thai, Chinese, English letters, numbers, and dashes
    .replace(/[^\u0E00-\u0E7F\u4E00-\u9FFFA-Za-z0-9-]/g, '');
}

/**
 * Convert Google Docs-style hash IDs in anchor links to text-based IDs
 * This syncs TOC links with the actual heading IDs that will be generated
 * @param {cheerio.Cheerio} $listElement - The list element containing anchor links
 * @param {cheerio.CheerioAPI} $ - Cheerio instance
 */
function syncTOCLinksWithHeadings($listElement, $) {
  // Build a map of Google Docs hash IDs to heading text
  // And a list of all heading texts for fuzzy matching
  const hashToTextMap = new Map();
  const allHeadingTexts = [];

  $('h1, h2, h3, h4, h5, h6').each((_, heading) => {
    const $heading = $(heading);
    const headingText = $heading.text().trim();
    if (!headingText) return;

    allHeadingTexts.push(headingText);

    // Check if heading has an id attribute (Google Docs adds these)
    const headingId = $heading.attr('id');
    if (headingId) {
      hashToTextMap.set(`#${headingId}`, headingText);
    }

    // Also check for anchor tags within or before the heading
    const $prevAnchor = $heading.prev('a[id]');
    if ($prevAnchor.length > 0) {
      const anchorId = $prevAnchor.attr('id');
      if (anchorId) {
        hashToTextMap.set(`#${anchorId}`, headingText);
      }
    }
  });

  // Now update all anchor links in the TOC list
  $listElement.find('a[href^="#"]').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href');
    const linkText = $link.text().trim();
    if (!linkText) return;

    // Strategy 1: If we have a mapping from Google Docs GUID/Internal ID to heading text, use it
    if (hashToTextMap.has(href)) {
      const headingText = hashToTextMap.get(href);
      const newHash = generateHashId(headingText);
      if (newHash) {
        $link.attr('href', `#${newHash}`);
        return;
      }
    }

    // Strategy 2: If no GUID mapping, try exact text match after cleaning
    const cleanedLinkText = linkText.replace(/^[0-9.]+\s+/, '').trim();
    const exactMatch = allHeadingTexts.find(ht =>
      generateHashId(ht) === generateHashId(linkText) ||
      generateHashId(ht) === generateHashId(cleanedLinkText)
    );

    if (exactMatch) {
      $link.attr('href', `#${generateHashId(exactMatch)}`);
      return;
    }

    // Strategy 3: Fuzzy match (one contains the other)
    // This handles the user's case: TOC "วิธีเตรียมตัวก่อนฉีดฟิลเลอร์" vs Heading "วิธีเตรียมตัวก่อนฉีดฟิลเลอร์ผู้ชาย"
    const fuzzyMatch = allHeadingTexts.find(ht => {
      const hHash = generateHashId(ht);
      const lHash = generateHashId(linkText);
      const clHash = generateHashId(cleanedLinkText);

      return hHash.includes(lHash) || lHash.includes(hHash) ||
        hHash.includes(clHash) || clHash.includes(hHash);
    });

    if (fuzzyMatch) {
      $link.attr('href', `#${generateHashId(fuzzyMatch)}`);
    } else {
      // Strategy 4: Fallback to link text if no match found
      const newHash = generateHashId(linkText);
      if (newHash) {
        $link.attr('href', `#${newHash}`);
      }
    }
  });
}

/**
 * Check if element is explicitly centered
 * Simplified wrapper for getAlignmentFromStyle
 */
function isExplicitCentered(style, className, alignAttr = '') {
  const { align } = getAlignmentFromStyle(style, className, alignAttr);
  return align === 'center';
}

/**
 * Check if text contains special heading patterns
 * Based on Home.jsx heading conversion rules
 */
function getSpecialHeadingClass(text) {
  const trimmedText = text.replace(/<\/?[^>]+(>|$)/g, '').trim();

  // Q&A / FAQ headings
  if (trimmedText.startsWith('Q&A') ||
    trimmedText.startsWith('Q&amp;A') ||
    trimmedText.includes('FAQ') ||
    (trimmedText.includes('คำถาม') && trimmedText.includes('คำตอบ')) ||
    (trimmedText.startsWith('คำถาม') && trimmedText.includes('ที่พบบ่อย'))) {
    return { class: 'label-heading', align: 'center' };
  }

  // TOC headings
  const lowerText = trimmedText.toLowerCase();
  if (lowerText.startsWith('table of content') ||
    trimmedText.startsWith('สารบัญ') ||
    trimmedText.startsWith('คลิกอ่านหัวข้อ') ||
    trimmedText.includes('目录') ||
    lowerText.startsWith('toc')) {
    return { class: 'subtext-gtb', addSeparator: false, isTOC: true };
  }

  // สรุป heading
  if (trimmedText === 'สรุป' || trimmedText.startsWith('สรุป') || trimmedText.startsWith('总结') || trimmedText.toLowerCase().startsWith('summary')) {
    return { class: 'subtext-gtb', addSeparator: true };
  }

  return null;
}

function extractHeadingLevelFromPrefix(text) {
  if (!text) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const patterns = [
    /^<\s*H\s*([1-6])\s*>\s*[:\-：—–]?\s*/i,
    /^<\s*h\s*([1-6])\s*>\s*[:\-：—–]?\s*/i,
    /^&lt;\s*H\s*([1-6])\s*&gt;\s*[:\-：—–]?\s*/i,
    /^H\s*([1-6])\b\s*[:\-：—–]?\s*/i,        // Supports "H2", "H2:", "H2 : "
    /^H\s*[:\-：—–]\s*([1-6])\b\s*/i,        // Supports "H:2", "H-2"
    /^Header\s*(?:Tag\s*)?([1-6])\b\s*[:\-：—–]?\s*/i,
    /^Heading\s*([1-6])\b\s*[:\-：—–]?\s*/i,
    /^หัวข้อ\s*([1-6])\b\s*[:\-：—–]?\s*/ // Thai "หัวข้อ" prefix
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const level = parseInt(match[1], 10);
      if (level >= 1 && level <= 6) {
        return level;
      }
    }
  }

  return null;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, c => map[c] || c);
}

function processListSpacing($el, previousTag, nextTag) {
  // Existing code processes list spacing
  // ...
}

function convertPhoneNumbers(htmlString) {
  const $ = cheerio.load(htmlString, { decodeEntities: false });
  const phoneRegex = /^\+?[0-9][0-9\s-]{5,}$/;

  $('u').each((_, el) => {
    const $u = $(el);
    if ($u.find('a').length > 0) return;

    const text = ($u.text() || '').trim();
    if (!text || !phoneRegex.test(text)) return;

    const displayText = text.replace(/\s+/g, ' ').trim();
    const hrefNumber = text.replace(/\s+/g, '').trim();
    if (!hrefNumber) return;

    const linkHtml = `<a href="http://${hrefNumber}" target="_blank" rel="noreferrer noopener">${escapeHtml(displayText)}</a>`;
    $u.replaceWith(linkHtml);
  });

  return $.html();
}

/**
 * Convert HTML structure to Gutenberg blocks using cheerio
 * This is the core conversion logic
 */
function convertToGutenberg(html, website) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const blocks = [];
  let blockCount = 0;
  let isFirstH2 = true;
  let listIndex = 0;
  let isInReferencesSection = false;
  let wasFirstH2Processed = false;
  let expectingTOCList = false;

  // Normalize website for checking
  const normalizedWebsite = website ? website.replace(/^www\./, '') : '';
  const shouldGenerateSeparators = !['bestbrandclinic.com', 'monghaclinic.com'].includes(normalizedWebsite);

  // Helper functions for common checks
  const isAltTextPattern = (text) => {
    return /^(Alt+|alt+|ALT+)\s*:/i.test(text) ||
      /^\(alt|\(Alt|\(ALT/i.test(text) ||
      /(Alt|alt)\s*text/i.test(text.toLowerCase());
  };

  const hasItalicStyle = ($p) => {
    const pStyle = $p.attr('style') || '';
    const pHtml = $p.html() || '';
    if (/font-style\s*:\s*italic/i.test(pStyle)) return true;
    const hasItalicChild = $p.find('[style*="font-style"]').filter((_, el) => {
      const style = $(el).attr('style') || '';
      return /font-style\s*:\s*italic/i.test(style);
    }).length > 0;
    const hasItalicTag = pHtml.includes('<em>') || pHtml.includes('<i>') || $p.find('em, i').length > 0;
    return hasItalicChild || hasItalicTag;
  };

  const isCenteredParagraph = ($p) => {
    const pStyle = $p.attr('style') || '';
    const pClass = $p.attr('class') || '';
    return /text-align\s*:\s*center/i.test(pStyle) ||
      pClass.includes('text-center') ||
      pClass.includes('center') ||
      pClass.includes('has-text-align-center') ||
      isExplicitCentered(pStyle, pClass);
  };

  const isNotSpecialContent = (text) => {
    const trimmed = text.trim();
    return trimmed.length > 0 &&
      trimmed.length < 500 &&
      !trimmed.startsWith('สารบัญ') &&
      !trimmed.startsWith('อ้างอิง') &&
      !trimmed.startsWith('สรุป') &&
      !trimmed.startsWith('Q&A') &&
      !/^H\s*:\s*[1-6]/i.test(trimmed) &&
      !/(https?:\/\/|www\.)/i.test(trimmed) &&
      !/^["“].*["”]$/.test(trimmed);
  };

  // Pre-process: Remove Thai characters for en.vsquareclinic.com (except in References section)
  if (normalizedWebsite === 'en.vsquareclinic.com') {
    // First, mark all elements in references section
    let inReferencesSection = false;
    $('*').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      const tagName = el.tagName?.toLowerCase();

      // Check if this is a references heading or paragraph
      if ((tagName === 'h2' || tagName === 'h3' || tagName === 'p') &&
        (text.startsWith('อ้างอิง') || text.startsWith('เอกสารอ้างอิง') ||
          text.startsWith('เอกสาร อ้างอิง') || text.startsWith('แหล่งข้อมูลอ้างอิง') ||
          text.startsWith('参考') || text.toLowerCase().includes('reference'))) {
        inReferencesSection = true;
        $el.attr('data-is-reference', 'true');
      }
      // Check if this is a summary/conclusion heading (marks end of references)
      else if ((tagName === 'h2' || tagName === 'h3') &&
        (text.startsWith('สรุป') || text.startsWith('总结') ||
          text.toLowerCase().startsWith('summary') || text.toLowerCase().startsWith('conclusion'))) {
        inReferencesSection = false;
      }
      // Mark lists in references section
      else if (inReferencesSection && (tagName === 'ul' || tagName === 'ol')) {
        $el.attr('data-is-reference', 'true');
      }
      // Mark list items in references section
      else if (inReferencesSection && tagName === 'li') {
        $el.attr('data-is-reference', 'true');
      }
    });

    // Now remove Thai characters except from marked reference elements
    $('*').each((_, el) => {
      const $el = $(el);

      // Skip non-content tags
      if (['head', 'meta', 'style', 'script', 'title', 'link'].includes(el.tagName)) return;

      // Skip if this element or any parent has data-is-reference attribute
      if ($el.attr('data-is-reference') === 'true' || $el.closest('[data-is-reference="true"]').length > 0) {
        return;
      }

      $el.contents().each((_, node) => {
        if (node.type === 'text' && node.data) {
          // Remove Thai characters \u0E00-\u0E7F
          node.data = node.data.replace(/[\u0E00-\u0E7F]+/g, '');
        }
      });
    });

    // Clean up temporary attributes
    $('[data-is-reference]').removeAttr('data-is-reference');
  }

  // Pre-process: Check for all H2s before the TOC (สารบัญ/คลิกอ่านหัวข้อ)
  // These H2s should NOT have separators
  let foundTOCInScan = false;
  const h2BeforeTOCElements = new Set();

  $('p, h1, h2, h3, h4, h5, h6').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    const tagName = el.tagName?.toLowerCase();

    // Check if this is TOC paragraph
    const textLower = text.toLowerCase();
    if (tagName === 'p' &&
      (text.startsWith('สารบัญ') ||
        text.startsWith('คลิกอ่านหัวข้อ') ||
        text.includes('目录') ||
        textLower.startsWith('table of content') ||
        textLower.startsWith('toc'))) {
      foundTOCInScan = true;
      return false; // break the scan - we've reached the TOC
    }

    // Check if this will be an H2
    const level = tagName === 'h2' ? 2 : extractHeadingLevelFromPrefix(text);
    if (level === 2 && !foundTOCInScan) {
      h2BeforeTOCElements.add(el);
    }
  });

  // Global flag to track if TOC exists anywhere in the document
  const hasTOCInDoc = foundTOCInScan || $('p').filter((_, p) => {
    const text = $(p).text().trim().toLowerCase();
    return text.startsWith('สารบัญ') || text.startsWith('คลิกอ่านหัวข้อ') || text.includes('目录') || text.startsWith('table of content') || text.startsWith('toc');
  }).length > 0;

  // Track if we have passed the TOC during actual conversion
  let hasPassedTOC = false;

  // Pre-process: Convert H:1, H:2, H:3 indicators to actual headings
  $('p').each((_, p) => {
    const $p = $(p);
    const text = $p.text().trim();

    // Use broader heading extraction logic
    const extractedLevel = extractHeadingLevelFromPrefix(text);
    if (extractedLevel) {
      // Replace paragraph with heading tag, keep the inner HTML
      $p.replaceWith(`<h${extractedLevel}>${$p.html()}</h${extractedLevel}>`);
    }
  });

  // Pre-process: Convert styled spans within paragraphs
  $('p').each((_, p) => {
    const $p = $(p);
    $p.find('span[style]').each((_, span) => {
      const $span = $(span);
      const processedContent = processStyledContent($span, $);
      $span.replaceWith(processedContent);
    });
  });

  // Track paragraphs that should be skipped (used as YouTube captions)
  const skipParagraphs = new Set();



  const isCaptionParagraph = ($para) => {
    if (!$para || $para.length === 0) return false;

    const paraText = $para.text().trim();
    if (!paraText || paraText.length === 0) return false;

    const paraStyle = $para.attr('style') || '';
    const paraClass = $para.attr('class') || '';
    const paraHtml = $para.html() || '';

    // NEW: Check if paragraph contains Alt text mixed with other content
    // Pattern: "Example: Text<br> Alt: ..." or in separate spans
    // We need to extract the non-Alt portion and check if THAT is italic+centered
    let textWithoutAlt = paraText;
    let hasAltTextMixed = false;

    // Check if Alt text is present in the paragraph
    if (/\b(Alt+|alt+|ALT+)\s*:/i.test(paraText)) {
      hasAltTextMixed = true;
      // Remove Alt text portion - everything after "Alt:" (case insensitive)
      // This handles: "Caption text<br> Alt: alt text" or "Caption Alt: alt text"
      textWithoutAlt = paraText.replace(/[\s\n]*\b(Alt+|alt+|ALT+)\s*:.*$/i, '').trim();
    }

    // If after removing Alt text, there's no meaningful text left, not a caption
    if (!textWithoutAlt || textWithoutAlt.length === 0) {
      return false;
    }

    // Check italic - font-style: italic in p or children, or <em>/<i> tags
    // For mixed Alt+Caption case, we need to check if the NON-ALT portion has italic
    let isItalic = false;
    let isUnderline = false;

    if (hasAltTextMixed) {
      // Check each span/element to see if the non-Alt portion is italic
      // Strategy: Look for spans that contain the caption text (not Alt text)
      $para.find('span, em, i').each((_, el) => {
        const $el = $(el);
        const elText = $el.text().trim();

        // Skip if this element contains Alt text
        if (/\b(Alt+|alt+|ALT+)\s*:/i.test(elText)) {
          return; // continue to next element
        }

        // Check if this element has italic styling
        const elStyle = $el.attr('style') || '';
        const elClass = $el.attr('class') || '';
        if (/font-style\s*:\s*italic/i.test(elStyle) ||
          $el.is('em') || $el.is('i') ||
          elClass.includes('italic')) {
          isItalic = true;
        }

        // Check underline
        if (/text-decoration\s*:\s*underline/i.test(elStyle) || $el.is('u')) {
          isUnderline = true;
        }
      });

      // Also check paragraph-level styling
      if (/font-style\s*:\s*italic/i.test(paraStyle) || paraClass.includes('italic')) {
        isItalic = true;
      }
      if (/text-decoration\s*:\s*underline/i.test(paraStyle)) {
        isUnderline = true;
      }
    } else {
      // Original logic for paragraphs without mixed Alt text
      const isItalicInStyle = /font-style\s*:\s*italic/i.test(paraStyle);
      const hasItalicChild = $para.find('[style*="font-style"]').filter((_, el) => {
        const style = $(el).attr('style') || '';
        return /font-style\s*:\s*italic/i.test(style);
      }).length > 0;
      const hasItalicTag = paraHtml.includes('<em>') || paraHtml.includes('<i>') || $para.find('em, i').length > 0;
      isItalic = isItalicInStyle || hasItalicChild || hasItalicTag || paraClass.includes('italic');

      // Check underline
      const isUnderlineInStyle = /text-decoration\s*:\s*underline/i.test(paraStyle);
      const hasUnderlineChild = $para.find('[style*="text-decoration"]').filter((_, el) => {
        const style = $(el).attr('style') || '';
        return /text-decoration\s*:\s*underline/i.test(style);
      }).length > 0;
      const hasUnderlineTag = paraHtml.includes('<u>') || $para.find('u').length > 0;
      isUnderline = isUnderlineInStyle || hasUnderlineChild || hasUnderlineTag;
    }

    // Check centered - multiple patterns
    const isCentered = /text-align\s*:\s*center/i.test(paraStyle) ||
      paraClass.includes('text-center') ||
      paraClass.includes('center') ||
      paraClass.includes('has-text-align-center') ||
      isExplicitCentered(paraStyle, paraClass);

    // Precise checks: Italic AND Centered -> high probability of being a caption
    // Use the cleaned text (without Alt) for length check
    const isLikelyCaption = (isItalic && isCentered) && textWithoutAlt.length > 0 && textWithoutAlt.length < 500;

    if (!isLikelyCaption) {
      return false;
    }

    // Skip special content (check the cleaned text without Alt)
    if (textWithoutAlt.startsWith('สารบัญ') || textWithoutAlt.startsWith('อ้างอิง') ||
      textWithoutAlt.startsWith('สรุป') || textWithoutAlt.startsWith('Q&A') ||
      /^H\s*:\s*[1-6]/i.test(textWithoutAlt)) {
      return false;
    }

    // Limit links: captions can have links, but shouldn't be TOO MANY.
    // Allow single-link paragraphs to be captions for YouTube/Images
    const $links = $para.find('a[href]');
    if ($links.length > 2) {
      return false;
    }

    // Return the cleaned caption text (without Alt portion)
    return { isItalic, isUnderline, cleanedText: textWithoutAlt };
  };

  const isAltTextParagraph = ($para) => {
    const text = $para.text().trim();
    return /^(Alt+|alt+|ALT+)\s*:/i.test(text) ||
      /\b(Alt+|alt+|ALT+)\s*:/i.test(text) ||
      text.toLowerCase().startsWith('(alt');
  };

  // Pre-process: Find YouTube links and collect their caption paragraphs
  // Map<youtubeUrl, { text: string, isItalic: boolean, elements: Element[] }>
  const youtubeCaptions = new Map();
  $('p').each((_, pEl) => {
    const $p = $(pEl);
    const pText = $p.text().trim();

    // Check if this paragraph contains a YouTube link
    // Support: https://, http://, // (protocol-relative), and without protocol
    let youtubeMatch = pText.match(/((?:(?:https?:)?\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}(?:[?&][a-zA-Z0-9_=-]*)?)/i);

    // If not found in text, check href attributes of <a> tags (for Google Docs links)
    if (!youtubeMatch) {
      const $links = $p.find('a[href]');
      $links.each((_, link) => {
        const href = $(link).attr('href') || '';
        // Extract YouTube URL from Google Docs redirect
        const googleMatch = href.match(/[?&]q=([^&]+)/);
        const actualUrl = googleMatch ? decodeURIComponent(googleMatch[1]) : href;

        const match = actualUrl.match(/((?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]+[^\s]*)/i);
        if (match) {
          youtubeMatch = match;
          return false; // break
        }
      });
    }

    if (!youtubeMatch) return;

    const youtubeUrl = youtubeMatch[1];

    // Collect caption text from following paragraphs
    // Also handle case: Alt: text → Caption (skip alt, collect caption)
    const captionTexts = [];
    const captionElements = []; // Store elements to skip later
    let hasAnyItalic = false;
    let hasAnyUnderline = false;
    let nextEl = $p.next('p');
    while (nextEl.length > 0) {
      const nextText = nextEl.text().trim();

      // If it's an empty paragraph, skip it and continue looking
      if (!nextText) {
        // Stop if hit another image or media block
        if (nextEl.find('img, iframe, table, figure').length > 0) break;
        nextEl = nextEl.next('p');
        continue;
      }

      // If it's alt text, skip it but continue looking for caption
      if (isAltTextParagraph(nextEl)) {
        skipParagraphs.add(nextEl.get(0)); // Mark for skipping
        nextEl = nextEl.next('p');
        continue;
      }

      // If it's a caption paragraph, collect it (but don't skip yet)
      const captionInfo = isCaptionParagraph(nextEl);
      if (captionInfo) {
        // Use cleanedText from captionInfo (has Alt text already removed)
        const captionText = captionInfo.cleanedText || nextText;
        captionTexts.push(captionText);
        captionElements.push(nextEl.get(0)); // Store element for later skipping
        // Collect styling
        if (captionInfo.isItalic) hasAnyItalic = true;
        if (captionInfo.isUnderline) hasAnyUnderline = true;
        nextEl = nextEl.next('p');
      } else {
        // Not empty, not alt, not caption, stop
        break;
      }
    }

    if (captionTexts.length > 0) {
      youtubeCaptions.set(normalizeYouTubeUrl(youtubeUrl), {
        text: captionTexts.join('\n'),
        isItalic: hasAnyItalic,
        isUnderline: hasAnyUnderline,
        elements: captionElements // Store elements to skip when embed is created
      });
    }
  });

  // Pre-process: Find H3s under Q&A/FAQ H2 headings
  // If there are 3+ H3s under the Q&A H2, mark them for "headtext" class
  // Q&A H2 is identified by: คำถามที่พบบ่อย, FAQ, Q&A, etc. with label-heading class (centered)
  const h3sWithHeadtext = new Set();

  // Find all headings
  const allHeadings = $('h1, h2, h3, h4, h5, h6').toArray();

  // Find Q&A/คำถามที่พบบ่อย H2 heading index
  let qaHeadingIndex = -1;

  allHeadings.forEach((heading, index) => {
    const headingText = $(heading).text().trim();
    const tagName = heading.tagName?.toLowerCase();

    // Check for Q&A / คำถามที่พบบ่อย / FAQ (H2 only)
    const isSpecialFAQ = normalizedWebsite === 'en.vsquareclinic.com' && headingText.trim().match(/^Frequently Asked Questions/i);

    if (tagName === 'h2' && (
      headingText.includes('Q&A') || headingText.includes('Q&amp;A') ||
      headingText.includes('คำถามที่พบบ่อย') || headingText.includes('FAQ') ||
      (headingText.includes('คำถาม') && headingText.includes('คำตอบ')) ||
      isSpecialFAQ)) {
      qaHeadingIndex = index;
    }
  });

  // If Q&A H2 found, find all H3s under it until next H2 or สรุป or end
  if (qaHeadingIndex !== -1) {
    const h3sUnderQA = [];

    for (let i = qaHeadingIndex + 1; i < allHeadings.length; i++) {
      const heading = allHeadings[i];
      const tagName = heading.tagName?.toLowerCase();
      const headingText = $(heading).text().trim();

      // Stop at next H2 or สรุป/Summary/Reference heading
      if (tagName === 'h2' ||
        headingText.startsWith('สรุป') ||
        headingText.startsWith('总结') ||
        headingText.toLowerCase().startsWith('summary') ||
        headingText.toLowerCase().startsWith('conclusion')) {
        break;
      }

      // Collect H3s
      if (tagName === 'h3') {
        h3sUnderQA.push(heading);
      }
    }

    // If there are 3+ H3s, mark them for headtext class
    if (h3sUnderQA.length >= 3) {
      h3sUnderQA.forEach(h3 => h3sWithHeadtext.add(h3));
    }

    // NEW Rule: If there are 2+ H3s with '?', mark ONLY those with '?' for headtext class
    const h3sWithQuestionMark = h3sUnderQA.filter(h3 => $(h3).text().includes('?'));
    if (h3sWithQuestionMark.length >= 2) {
      h3sWithQuestionMark.forEach(h3 => h3sWithHeadtext.add(h3));
    }
  }

  function processNode(node) {
    if (node.type === 'text') {
      const text = node.data?.trim();
      if (text) {
        blockCount++;
        // Replace years 2020-2029 with [current_year] shortcode
        const processedText = text.replace(/\b202\d\b/g, '[current_year]');
        return wrapBlock('paragraph', `<p>${processedText}</p>`);
      }
      return null;
    }

    if (node.type !== 'tag') return null;

    const element = node;
    const tagName = element.tagName?.toLowerCase();
    const $el = $(element);

    // Helper to replace years 2020-2029 with [current_year] in element text
    const replaceYearsInElement = ($element) => {
      // Process text nodes directly to avoid breaking HTML attributes
      $element.find('*').addBack().contents().each((_, n) => {
        if (n.type === 'text' && n.data) {
          // Replace 2020-2029 with [current_year]
          // Be careful not to replace things that might be part of attributes if we were using .html()
          // But here we are modifying text node data directly
          n.data = n.data.replace(/\b202\d\b/g, '[current_year]');
        }
      });
    };

    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        // Apply year replacement to headings
        replaceYearsInElement($el);

        expectingTOCList = false; // Reset if we hit a heading before a list
        const originalLevel = parseInt(tagName.charAt(1), 10);
        // Process styled spans in headings
        $el.find('span[style]').each((_, span) => {
          const $span = $(span);
          const processedContent = processStyledContent($span, $);
          $span.replaceWith(processedContent);
        });

        // Remove <a> tags within headings (keep content)
        $el.find('a').each((_, a) => {
          const $a = $(a);
          $a.replaceWith($a.html());
        });

        // Extract images from heading
        const $headingImages = $el.find('img');
        let imageBlocks = '';
        if ($headingImages.length > 0) {
          $headingImages.each((_, img) => {
            const $img = $(img);
            const src = $img.attr('src') || '';
            const alt = $img.attr('alt') || '';

            // Clean up the element containing the image if it's just a wrapper
            const $parent = $img.parent();
            $img.remove();
            if ($parent.is('span') && !$parent.text().trim() && $parent.find('img, a, b, i, u').length === 0) {
              $parent.remove();
            }

            // Generate standard image block
            imageBlocks += `\n<!-- wp:image -->\n<figure class="wp-block-image"><img src="" alt="${alt}"/></figure>\n<!-- /wp:image -->`;
          });
        }

        let content = $el.html() || '';
        const rawText = $el.text() || '';
        const extractedLevel = extractHeadingLevelFromPrefix(rawText);
        const finalLevel = extractedLevel || originalLevel;

        // Special rule for en.vsquareclinic.com: Forbidden H1
        if (finalLevel === 1 && normalizedWebsite === 'en.vsquareclinic.com') {
          return imageBlocks || null;
        }

        // Clean heading text - remove H:2, H2, Header 2, <H1>:, <H2>:, etc. patterns
        // Use more flexible regexes that handle training separators and potential tags
        content = content
          .replace(/<(?:H|h)([1-6])>\s*[:\-：—–]?\s*/i, '')
          .replace(/&lt;(?:H|h)([1-6])&gt;\s*[:\-：—–]?\s*/i, '')
          .replace(/H\s*([1-6])\b\s*[:\-：—–]?\s*/i, '')
          .replace(/H\s*[:\-：—–]\s*([1-6])\b\s*/i, '')
          .replace(/Header\s*(?:Tag\s*)?([1-6])\b\s*[:\-：—–]?\s*/i, '')
          .replace(/Heading\s*([1-6])\b\s*[:\-：—–]?\s*/i, '')
          .replace(/หัวข้อ\s*([1-6])\b\s*[:\-：—–]?\s*/i, '');

        // Remove leading colons or other separators again after other replacements
        // This handles cases like "H2: : Title" or full-width colons
        while (/^[:\-：—–]/.test(content)) {
          content = content.replace(/^[:\-：—–]+/, '');
        }

        // If heading has no text content but has images, return just the image blocks
        // This handles cases like <h3><span><img src="..."></span></h3> from Google Docs
        if (!content.trim()) {
          if (imageBlocks) {
            blockCount++;
            return imageBlocks.trim();
          }
          return null;
        }

        const textOnly = content.replace(/<\/?[^>]+(>|$)/g, '').trim();

        // Skip headings with no meaningful text content (empty or only whitespace/symbols)
        // But if we have image blocks, return those instead
        if (!textOnly || textOnly.length === 0) {
          if (imageBlocks) {
            blockCount++;
            return imageBlocks.trim();
          }
          return null;
        }

        // Check if this is a References heading, set flag
        if (/^อ้างอิง|^เอกสารอ้างอิง|^แหล่งข้อมูลอ้างอิง|^参考/.test(textOnly) || textOnly.toLowerCase().startsWith('reference')) {
          isInReferencesSection = true;
        }
        // Reset if entering another major section or any other normal heading
        else if (finalLevel === 2 || finalLevel === 3) {
          // If it's a major section like Summary/FAQ, always reset
          if (/^สรุป|^总结|^Q&A|^Q\s*&|^คำถามที่พบบ่อย/.test(textOnly)) {
            isInReferencesSection = false;
          }
          // For other headings, also reset unless we want to keep references section open (unlikely)
          else {
            isInReferencesSection = false;
          }
        }

        // Extract styles from element
        const style = $el.attr('style') || '';
        const elClass = $el.attr('class') || '';
        const isCentered = isExplicitCentered(style, elClass);

        // Check for special heading patterns
        const specialHeading = getSpecialHeadingClass(textOnly);

        // Build classes and attributes
        let classBlock = 'wp-block-heading';
        let attrLevel = finalLevel === 2 ? '' : `,"level":${finalLevel}`;
        let textAlignAttr = '';
        let extraClass = '';
        let blockSeparator = '';
        let blockTarget = '';

        // Generate hash ID for anchor
        const hashTagId = generateHashId(textOnly);

        if (specialHeading) {
          extraClass = specialHeading.class;
          if (specialHeading.isTOC) {
            expectingTOCList = true;
          }
          if (specialHeading.align === 'center' || isCentered) {
            classBlock += ' has-text-align-center';
            textAlignAttr = '"textAlign":"center"';
          }
          // Note: specialHeading.addSeparator is handled below with H2/H3 logic
        } else {
          expectingTOCList = false; // Reset if we hit a normal heading without TOC pattern
          if (isCentered) {
            classBlock += ' has-text-align-center';
            textAlignAttr = '"textAlign":"center"';
          }
        }

        // Special rule for en.vsquareclinic.com: Frequently Asked Questions H2 -> label-heading
        if (finalLevel === 2 && normalizedWebsite === 'en.vsquareclinic.com' && /^Frequently Asked Questions/i.test(textOnly)) {
          if (!extraClass.includes('label-heading')) {
            extraClass = extraClass ? `${extraClass} label-heading` : 'label-heading';
          }
          if (!classBlock.includes('has-text-align-center')) {
            classBlock += ' has-text-align-center';
            textAlignAttr = '"textAlign":"center"';
          }
        }

        // Check if this H3 should have "headtext" class (between Q&A and สรุป)
        if (finalLevel === 3 && h3sWithHeadtext.has(element)) {
          if (extraClass) {
            extraClass += ' headtext';
          } else {
            extraClass = 'headtext';
          }
        }

        if (extraClass) {
          classBlock += ` ${extraClass}`;
        }

        // Build final attributes
        let attrString = '';
        if (textAlignAttr || attrLevel || extraClass) {
          const parts = [];
          if (textAlignAttr) parts.push(textAlignAttr);
          if (attrLevel) parts.push(attrLevel.replace(/^,/, ''));
          if (extraClass) parts.push(`"className":"${extraClass}"`);
          attrString = ` {${parts.join(',')}}`;
        }

        // Add separator and target block for H2/H3
        // Rule: H2 always gets separator EXCEPT:
        // 1. The first H2 (unless immediately after TOC)
        // 2. H2 that appears BEFORE TOC (H2บนสุด) - skip separator and target entirely
        if (finalLevel === 2) {
          // Check if this H2 is one of the ones before TOC - skip separator
          // Rule: ANY H2 above TOC should NOT have a separator
          if (h2BeforeTOCElements.has(element)) {
            // H2 above TOC - no separator
            blockSeparator = '';
            // For first H2 above TOC, we usually skip target too (page title logic)
            // but for subsequent ones before TOC, we might want target? 
            // Following existing logic: skip both for all H2s before TOC to be safe
            blockTarget = '';
            isFirstH2 = false;
          } else {
            const prevBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null;
            const prevIsTOCList = prevBlock && /<!-- wp:list/.test(prevBlock) && prevBlock.includes('"listmenu"');

            if (isFirstH2) {
              const shouldForceSeparator = prevIsTOCList;
              if (blocks.length > 0 || shouldForceSeparator) {
                blockSeparator = '<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->';
                if (hashTagId) {
                  blockTarget = `<!-- wp:ps2id-block/target --><div class="wp-block-ps2id-block-target" id="${hashTagId}"></div><!-- /wp:ps2id-block/target -->`;
                }
              }
              isFirstH2 = false;
              wasFirstH2Processed = true;
            } else {
              // Not the first H2 - add separator unless we are still above TOC 
              // (but h2BeforeTOCElements.has(element) already handled the above-TOC case)
              blockSeparator = '<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->';
              if (hashTagId) {
                blockTarget = `<!-- wp:ps2id-block/target --><div class="wp-block-ps2id-block-target" id="${hashTagId}"></div><!-- /wp:ps2id-block/target -->`;
              }
            }
          }

          // TOC should never have a separator even if it is H2
          if (specialHeading && specialHeading.isTOC) {
            blockSeparator = '';
          }
        } else if (finalLevel === 3 && hashTagId) {
          // H3: only "สรุป" gets separator, but all get target
          // Suppress separator if above TOC
          if ((textOnly === 'สรุป' || textOnly.startsWith('สรุป') || textOnly.startsWith('总结') || textOnly.toLowerCase().startsWith('summary')) && shouldGenerateSeparators && (!hasTOCInDoc || hasPassedTOC)) {
            blockSeparator = '<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->';
          }
          blockTarget = `<!-- wp:ps2id-block/target --><div class="wp-block-ps2id-block-target" id="${hashTagId}"></div><!-- /wp:ps2id-block/target -->`;
        }
        // H4, H5, H6: no separator, no target

        blockCount++;
        const headingTag = `h${finalLevel}`;

        // Special Case: For bestbrandclinic.com and monghaclinic.com
        // If it's the first H2 (isFirstH2 was true before this block processed it), place target BELOW H2
        // We use a local flag because isFirstH2 was already set to false above
        const isTargetBelow = !shouldGenerateSeparators && finalLevel === 2 && blockTarget && (isFirstH2 === false && (blocks.length === 0 || (blocks.length > 0 && !(blocks[blocks.length - 1] && /<!-- wp:list/.test(blocks[blocks.length - 1]) && blocks[blocks.length - 1].includes('"listmenu"')))));
        // Note: The logic above for isTargetBelow is tricky because isFirstH2 is mutated.
        // Let's refine: We need to know if this specific H2 triggered the "isFirstH2" logic block above.
        // We can check if blockSeparator matches what was set in the isFirstH2 block.
        // OR better: Move target logic to where we construct the final string.

        let finalBlock;
        if (!shouldGenerateSeparators && finalLevel === 2 && wasFirstH2Processed) {
          // Place target AFTER heading for first H2 on special domains
          finalBlock = `${blockSeparator}<!-- wp:heading${attrString} --><${headingTag} class="${classBlock}">${content}</${headingTag}><!-- /wp:heading -->${blockTarget}${imageBlocks}`;
        } else {
          // Default behavior: target BEFORE heading
          finalBlock = `${blockSeparator}${blockTarget}<!-- wp:heading${attrString} --><${headingTag} class="${classBlock}">${content}</${headingTag}><!-- /wp:heading -->${imageBlocks}`;
        }
        return finalBlock;
      }

      case 'p': {
        // Skip paragraphs that were used as YouTube captions
        if (skipParagraphs.has(element)) {
          return null;
        }

        // Apply year replacement to paragraph
        replaceYearsInElement($el);

        // Process styled spans in paragraph first
        $el.find('span[style]').each((_, span) => {
          const $span = $(span);
          const processedContent = processStyledContent($span, $);
          $span.replaceWith(processedContent);
        });

        const content = $el.html() || '';
        const textContent = $el.text().replace(/[\s\u00A0\u200B\uFEFF]/g, '').trim(); // Remove all types of whitespace
        const textContentNormalized = $el.text().replace(/[\s\u00A0\u200B\uFEFF]+/g, ' ').trim(); // Preserve single spaces

        // Skip truly empty paragraphs (no text, no images, no structural elements)
        // We preserve paragraphs that might just have a space (often used for spacing)
        if (!content && $el.find('img, iframe, table, ul, ol, figure').length === 0) {
          return null;
        }

        const style = $el.attr('style') || '';
        const elClass = $el.attr('class') || '';

        // Check for YouTube links in paragraph (support protocol-relative URLs)
        // First check text content
        let youtubeMatch = textContent.match(/((?:(?:https?:)?\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}(?:[?&][a-zA-Z0-9_=-]*)?)/i);

        // If not found in text, check href attributes of <a> tags (for Google Docs links)
        if (!youtubeMatch) {
          const $links = $el.find('a[href]');
          $links.each((_, link) => {
            const href = $(link).attr('href') || '';
            // Extract YouTube URL from Google Docs redirect
            const googleMatch = href.match(/[?&]q=([^&]+)/);
            const actualUrl = googleMatch ? decodeURIComponent(googleMatch[1]) : href;

            const match = actualUrl.match(/((?:(?:https?:)?\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}(?:[?&][a-zA-Z0-9_=-]*)?)/i);
            if (match) {
              youtubeMatch = match;
              return false; // break
            }
          });
        }

        if (youtubeMatch) {
          const youtubeUrl = youtubeMatch[1];

          // Normalize URL for lookup
          const lookupUrl = normalizeYouTubeUrl(youtubeUrl);
          let captionData = youtubeCaptions.get(lookupUrl);
          let captionText = captionData?.text || '';
          let isItalic = captionData?.isItalic || false;
          let isUnderline = captionData?.isUnderline || false;

          // ถ้าไม่มี caption จาก next paragraphs ให้ดึงจากข้อความหลัง URL (ในย่อหน้าเดียวกัน)
          if (!captionText) {
            const afterUrl = textContentNormalized.substring(textContentNormalized.indexOf(youtubeUrl) + youtubeUrl.length).trim();
            if (afterUrl) {
              captionText = afterUrl;
              // Check if the source had styling elements
              isItalic = isItalicPara;
              isUnderline = content.includes('<u>') || $el.find('u').length > 0;
            }
          }

          const embedBlock = createYouTubeEmbedBlock(youtubeUrl, captionText || undefined, isItalic, isUnderline);
          if (embedBlock) {
            // Successfully created embed block - now skip caption paragraphs
            if (captionData && captionData.elements) {
              captionData.elements.forEach(el => skipParagraphs.add(el));
            }
            blockCount++;
            return embedBlock;
          }
        }

        // Check if this paragraph is alt text under an image - remove it completely
        const prevSibling = $el.prev();

        // Check if previous sibling is an image/embed
        const prevIsImage = prevSibling.length > 0 && (
          (prevSibling.is('figure') && !prevSibling.hasClass('wp-block-table')) ||
          (prevSibling.find('img').length > 0 && !prevSibling.is('table')) ||
          prevSibling.html()?.includes('wp-block-image') ||
          prevSibling.html()?.includes('wp-block-embed') ||
          // Also check H1-H3 as image containers (only if they mainly contain the image)
          ((prevSibling.is('h1, h2, h3, p') && prevSibling.find('img').length > 0 && prevSibling.text().trim().length < 50))
        );

        // Check if previous sibling is a caption (centered/italic paragraph under image)
        const prevIsCaption = prevSibling.length > 0 && prevSibling.is('p') && /caption-img/.test(prevSibling.attr('class') || '');
        const prevIsNonCaptionParagraph = prevSibling.length > 0 && prevSibling.is('p') && !/caption-img/.test(prevSibling.attr('class') || '');

        // hasImgAbove is true if previous is image OR previous is a caption (which means image is above that)
        const hasImgAbove = prevIsImage || prevIsCaption;
        const isRightBelowImage = prevIsImage;

        if (hasImgAbove) {
          const isAltText = isAltTextPattern(textContentNormalized);

          if (isAltText && $el.find('img').length === 0) {
            // Check if next paragraph is italic/centered → make it a caption instead of just removing alt
            const nextAfterAlt = $el.next('p');
            if (nextAfterAlt.length > 0) {
              const nextText = nextAfterAlt.text().trim();
              const nextStyle = nextAfterAlt.attr('style') || '';
              const nextClass = nextAfterAlt.attr('class') || '';
              const nextHtml = nextAfterAlt.html() || '';

              // Check if italic
              const isItalic = /font-style\s*:\s*italic/i.test(nextStyle) ||
                nextHtml.includes('<em>') || nextHtml.includes('<i>') ||
                nextAfterAlt.find('em, i').length > 0;

              // Check if centered
              const isCentered = /text-align\s*:\s*center/i.test(nextStyle) ||
                nextClass.includes('text-center') ||
                nextClass.includes('center') ||
                isExplicitCentered(nextStyle, nextClass);

              // If next paragraph is italic or centered, not special content, and not too long → caption
              // Skip ข้อควรรู้ - it should be a quote block
              const isNextKnowledgeQuote = nextText.includes('ข้อควรรู้');
              const hasNextSurroundingQuotes = /^["“].*["”]$/.test(nextText.trim());

              // New Strict Check: MUST be both if we want to treat it as caption
              if ((isItalic && isCentered) && nextText.length > 0 && nextText.length < 200 &&
                !nextText.startsWith('สารบัญ') && !nextText.startsWith('อ้างอิง') &&
                !/^(Alt+|alt+|ALT+)\s*:/i.test(nextText) && !isNextKnowledgeQuote && !hasNextSurroundingQuotes &&
                nextAfterAlt.find('img, iframe, table, figure').length === 0) {
                // Create caption-img block from next paragraph
                skipParagraphs.add(nextAfterAlt.get(0)); // Mark for skipping

                // Extract color from the next paragraph's style
                const { textColor: captionColor } = getColorStyles(nextStyle);

                nextAfterAlt.remove();
                blockCount++;
                const captionContent = isItalic ? `<em>${nextText}</em>` : nextText;

                // Build caption-img block with color if available
                const captionAttrs = { align: 'center', className: 'caption-img' };
                let captionClasses = 'has-text-align-center caption-img';
                let captionInlineStyle = '';

                if (captionColor) {
                  captionAttrs.style = {
                    color: { text: captionColor },
                    elements: { link: { color: { text: captionColor } } }
                  };
                  captionClasses += ' has-text-color has-link-color';
                  captionInlineStyle = ` style="color:${captionColor}"`;
                }

                return wrapBlock('paragraph', `<p class="${captionClasses}"${captionInlineStyle}>${captionContent}</p>`, captionAttrs);
              }
            }
            // Remove alt text paragraph - don't create any block
            skipParagraphs.add(element); // Mark alt text for skipping
            return null;
          }
        }

        // Caption detection: ข้อความใต้รูป/คลิปที่เป็นตัวเอียง -> caption-img (only if not alt text)
        // Skip if already used as figcaption (in skipParagraphs)
        const isItalicPara = (
          content.includes('<em>') || content.includes('<i>') ||
          style.includes('font-style: italic') ||
          $el.find('em, i').length > 0 ||
          elClass.includes('italic')
        );

        const isCenteredPara = /text-align\s*:\s*center/i.test(style) ||
          elClass.includes('has-text-align-center') ||
          elClass.includes('text-center') ||
          isExplicitCentered(style, elClass);

        // STRICT REQUIREMENT: Caption must be BOTH italic AND centered
        const isCaptionLogic = isItalicPara && isCenteredPara;

        // Only create caption-img if NOT already in skipParagraphs (not used as figcaption)
        // AND if paragraph doesn't contain multiple images (those should be Kadence Row Layout)
        // AND if not "ข้อควรรู้" with surrounding quotes (should be quote block, not caption)
        // AND if not headline text (บทความแนะนำ, อ่านบทความเพิ่มเติม, etc.)
        const imgsInPara = $el.find('img');
        // Check for ข้อควรรู้ pattern - check if text contains ข้อควรรู้
        const isKnowledgeQuoteWithMarks = textContentNormalized.includes('ข้อควรรู้');
        // Check for headline text - these should NOT be caption-img
        const isHeadlineContent = textContentNormalized.includes('บทความแนะนำ') ||
          textContentNormalized.includes('โปรแนะนำ') ||
          textContentNormalized.includes('อ่านบทความเพิ่มเติม') ||
          textContentNormalized.includes('คลิกอ่านบทความ') ||
          textContentNormalized.includes('อ่านเพิ่มเติม') ||
          textContentNormalized.includes('บทความเจาะลึก');
        const hasSurroundingQuotes = /^["“].*["”]$/.test(textContentNormalized);

        if (isRightBelowImage && !prevIsNonCaptionParagraph && isCaptionLogic && hasImgAbove && !skipParagraphs.has(element) && imgsInPara.length === 0 && !isKnowledgeQuoteWithMarks && !isHeadlineContent && !hasSurroundingQuotes) {
          // Check if the previous image already has this as figcaption
          // If so, skip creating a separate paragraph
          const prevHtml = prevSibling.html() || '';
          const currentText = textContentNormalized;

          // If the previous element's figcaption already contains this text, skip
          if (prevHtml.includes('<figcaption>') && prevHtml.includes(currentText.substring(0, 20))) {
            return null; // Already used as figcaption
          }

          // Extract color from the paragraph's style
          const { textColor: captionColor } = getColorStyles(style);

          blockCount++;

          // Build caption-img block with color if available
          const captionAttrs = { align: 'center', className: 'caption-img' };
          let captionClasses = 'has-text-align-center caption-img';
          let captionInlineStyle = '';

          if (captionColor) {
            captionAttrs.style = {
              color: { text: captionColor },
              elements: { link: { color: { text: captionColor } } }
            };
            captionClasses += ' has-text-color has-link-color';
            captionInlineStyle = ` style="color:${captionColor}"`;
          }

          return wrapBlock('paragraph', `<p class="${captionClasses}"${captionInlineStyle}>${content}</p>`, captionAttrs);
        }

        // Check for "อ้างอิง" or "เอกสารอ้างอิง" paragraph - add separator above
        if (textContentNormalized.startsWith('อ้างอิง') || textContentNormalized.startsWith('เอกสารอ้างอิง') ||
          textContentNormalized.startsWith('เอกสาร อ้างอิง') || textContentNormalized.startsWith('แหล่งข้อมูลอ้างอิง') || textContentNormalized.startsWith('参考') ||
          textContentNormalized.toLowerCase().startsWith('reference')) {
          isInReferencesSection = true;
          blockCount++;
          // Always add separator above references (unless disabled)
          const separatorBlock = shouldGenerateSeparators ? '<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->' : '';
          const paragraphBlock = wrapBlock('paragraph', `<p class="references">${content}</p>`, { className: 'references' });
          if (normalizedWebsite === 'en.vsquareclinic.com') {
            return `<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->\n${paragraphBlock}`;
          }
          return `${separatorBlock}${paragraphBlock}`;
        }

        // Check if paragraph starts with "Q :" or "Q:" under H2 Q&A - add headtext class
        if (/^Q\s*:/i.test(textContentNormalized)) {
          // Check if we're under a Q&A H2 heading by looking at previous headings
          let isUnderQA = false;
          let prevEl = $el.prev();

          // Look backwards for the most recent H2
          for (let i = 0; i < 20 && prevEl.length > 0; i++) {
            if (prevEl.is('h2')) {
              const h2Text = prevEl.text().trim();
              if (h2Text.startsWith('Q&A') || h2Text.startsWith('Q&amp;A') ||
                h2Text.startsWith('คำถามที่พบบ่อย') || h2Text.includes('FAQ')) {
                isUnderQA = true;
              }
              break;
            }
            prevEl = prevEl.prev();
          }

          if (isUnderQA) {
            blockCount++;
            return wrapBlock('paragraph', `<p class="headtext">${content}</p>`, { className: 'headtext' });
          }
        }

        // Bold+Underline title above image => center it
        const hasBold = content.includes('<strong>') || content.includes('<b>') ||
          /font-weight\s*:\s*(bold|[7-9]00)/i.test(style);
        const hasUnderline = content.includes('<u>') || /text-decoration\s*:\s*underline/i.test(style);
        const nextSiblingForImg = $el.next();
        const hasImgBelow = nextSiblingForImg.length > 0 && (
          nextSiblingForImg.find('img').length > 0 ||
          nextSiblingForImg.is('figure')
        );

        if (hasBold && hasUnderline && hasImgBelow) {
          blockCount++;
          return wrapBlock('paragraph', `<p class="has-text-align-center">${content}</p>`, { align: 'center' });
        }

        // Headline detection: บทความแนะนำ, โปรแนะนำ, อ่านบทความเพิ่มเติม, คลิกอ่านบทความ
        // If centered AND (above table OR is headline text) => headline class
        const isHeadlineText = textContentNormalized.includes('บทความแนะนำ') ||
          textContentNormalized.includes('โปรแนะนำ') ||
          textContentNormalized.includes('อ่านบทความเพิ่มเติม') ||
          textContentNormalized.includes('คลิกอ่านบทความ') ||
          textContentNormalized.includes('อ่านเพิ่มเติม') ||
          textContentNormalized.includes('บทความเจาะลึก');
        const nextSiblingForTable = $el.next();
        // eslint-disable-next-line no-unused-vars
        const hasTableBelow = nextSiblingForTable.length > 0 && nextSiblingForTable.is('table');
        const isCenteredForHeadline = /text-align\s*:\s*center/i.test(style) ||
          elClass.includes('has-text-align-center') ||
          elClass.includes('text-center');

        // Headline class if: (centered AND headline text) OR (centered AND above table with headline text)
        if (isHeadlineText && isCenteredForHeadline) {
          blockCount++;
          return wrapBlock('paragraph', `<p class="has-text-align-center headline">${content}</p>`, { align: 'center', className: 'headline' });
        }

        // Check if paragraph contains images
        const images = $el.find('img');
        if (images.length > 0) {
          const firstImage = images.first();
          const src = (firstImage.attr('src') || '').trim();
          let alt = (firstImage.attr('alt') || '').trim();
          const title = (firstImage.attr('title') || '').trim();

          // Try to extract Alt text markers from the paragraph text
          const paragraphTextForAlt = $el.text().trim();
          // Split by "Alt:" and skip the first part (text before first "Alt:")
          const altMarkersArr = paragraphTextForAlt.split(/\bAlt\s*:/i).slice(1).map(s => s.trim());

          if (altMarkersArr.length > 0 && (!alt || alt === '')) {
            alt = altMarkersArr[0];
          }

          // Clean up alt
          alt = cleanAltText(alt);

          const hasValidSrc = !!src;
          const imageMarkup = `<img src="" alt="${alt}"${title ? ` title="${title}"` : ''}/>`;

          // NEW: If paragraph ONLY contains image(s) (no meaningful text), treat as image block(s)
          // Get text content WITHOUT the HTML tags
          const $tempEl = $el.clone();
          $tempEl.find('img').remove(); // Remove all images
          // Don't remove span - just get text
          let textWithoutImg = $tempEl.text().trim();
          // Remove Alt text patterns
          textWithoutImg = textWithoutImg.replace(/(Alt+|alt+)\s*:\s*[^\n]+/gi, '').trim();
          // Remove all whitespace types including non-breaking spaces
          textWithoutImg = textWithoutImg.replace(/[\s\u00A0\u200B\uFEFF]+/g, '');
          const hasOnlyImages = textWithoutImg.length === 0;

          // Check if paragraph itself contains a caption (text following image within same <p>)
          let internalCaptionInfo = null;
          if (!hasOnlyImages && images.length === 1) {
            internalCaptionInfo = isCaptionParagraph($el);
          }

          if (hasOnlyImages || internalCaptionInfo) {
            // Paragraph contains only images OR image + caption text
            if (images.length === 1) {
              // Single image - look for caption paragraphs after this (and include internal caption if found)
              const allCaptionParagraphs = [];
              let allCaptionsHaveItalic = internalCaptionInfo ? internalCaptionInfo.isItalic : false;
              let allCaptionsHaveUnderline = internalCaptionInfo ? internalCaptionInfo.isUnderline : false;

              if (internalCaptionInfo) {
                // Use the cleaned text from isCaptionParagraph (already has Alt text removed)
                const captionText = internalCaptionInfo.cleanedText || $tempEl.text().trim().replace(/[\s\u00A0]*(Alt+|alt+|ALT+)\s*:.*$/gi, '').trim();
                if (captionText) {
                  allCaptionParagraphs.push(captionText);
                }
              }

              // Use nextAll to find all following siblings, then filter for p tags
              let nextP = $el.nextAll('p').first();
              while (nextP.length > 0) {
                const nextText = nextP.text().trim();

                // Skip empty paragraphs
                if (!nextText) {
                  // Stop if hit another image or media block
                  if (nextP.find('img, iframe, table, figure').length > 0) break;
                  nextP = nextP.nextAll('p').first();
                  continue;
                }

                const captionInfo = isCaptionParagraph(nextP);

                // If it is a caption paragraph, collect it
                if (captionInfo && !skipParagraphs.has(nextP.get(0))) {
                  // Use cleanedText from captionInfo (has Alt text already removed)
                  const captionText = captionInfo.cleanedText || nextText;
                  allCaptionParagraphs.push(captionText);
                  if (captionInfo.isItalic) allCaptionsHaveItalic = true;
                  if (captionInfo.isUnderline) allCaptionsHaveUnderline = true;
                  skipParagraphs.add(nextP.get(0)); // Mark for skipping
                  nextP = nextP.nextAll('p').first();
                } else if (isAltTextPattern(nextText)) {
                  // Skip alt text
                  skipParagraphs.add(nextP.get(0));
                  nextP = nextP.nextAll('p').first();
                } else {
                  break;
                }
              }

              blockCount++;

              // Build figcaption with all collected captions
              if (allCaptionParagraphs.length > 0) {
                const captionContent = allCaptionParagraphs.join('<br>');
                let captionHtml = captionContent;
                if (allCaptionsHaveItalic && allCaptionsHaveUnderline) {
                  captionHtml = `<em style="text-decoration: underline;">${captionContent}</em>`;
                } else if (allCaptionsHaveItalic) {
                  captionHtml = `<em>${captionContent}</em>`;
                } else if (allCaptionsHaveUnderline) {
                  captionHtml = `<u>${captionContent}</u>`;
                }
                return `<!-- wp:image -->
<figure class="wp-block-image">
    ${imageMarkup}
    <figcaption class="wp-element-caption">${captionHtml}</figcaption>
</figure>
<!-- /wp:image -->`;
              }

              return `<!-- wp:image -->
<figure class="wp-block-image">${imageMarkup}</figure>
<!-- /wp:image -->`;
            } else if (images.length >= 2) {
              // Multiple images - create Kadence Row Layout
              const imageData = [];
              images.each((idx, img) => {
                let imgAlt = $(img).attr('alt') || '';
                // If this image has no alt, try to use the corresponding extracted marker
                if (!imgAlt && altMarkersArr[idx]) {
                  imgAlt = altMarkersArr[idx];
                }

                imageData.push({
                  src: $(img).attr('src') || '',
                  alt: cleanAltText(imgAlt)
                });
              });
              blockCount++;
              return createKadenceRowLayout(imageData);
            }
          }
          // Check for caption after images
          // Pattern: รูป → caption → alt (caption อยู่เหนือ alt และใต้รูป)
          const nextSibling = $el.next('p');
          const nextNextSibling = nextSibling.length > 0 ? nextSibling.next('p') : null;
          let caption;

          let captionIsItalic = false;
          let captionIsUnderline = false;

          if (nextSibling.length > 0) {
            const nextText = nextSibling.text().trim();

            // Check if next is alt text
            if (isAltTextPattern(nextText)) {
              // Remove alt text paragraph
              nextSibling.remove();

              // Check if paragraph AFTER alt text is italic+centered → use as caption
              const afterAltP = $el.next('p');
              if (afterAltP.length > 0) {
                const afterAltText = afterAltP.text().trim();
                const isItalic = hasItalicStyle(afterAltP);
                const isCentered = isCenteredParagraph(afterAltP);

                // If italic AND centered, and not special content → it's a caption
                const captionInfo = isCaptionParagraph(afterAltP);
                if (captionInfo && !isAltTextPattern(afterAltText)) {
                  // Clean alt text from caption if it's accidentally merged, supporting non-breaking spaces
                  caption = afterAltText.replace(/[\s\u00A0]*(Alt+|alt+|ALT+)\s*:.*$/gi, '').trim();
                  if (caption) {
                    captionIsItalic = captionInfo.isItalic;
                    captionIsUnderline = captionInfo.isUnderline;
                    skipParagraphs.add(afterAltP.get(0)); // Mark for skipping
                    afterAltP.remove();
                  } else {
                    // It was just alt text mistakenly identified as caption
                    caption = undefined;
                    skipParagraphs.add(afterAltP.get(0));
                    afterAltP.remove();
                  }
                }
              }
            } else {
              // Check pattern: caption → alt (next is caption, next-next is alt)
              if (nextNextSibling && nextNextSibling.length > 0) {
                const nextNextText = nextNextSibling.text().trim();
                const nextIsItalic = hasItalicStyle(nextSibling);
                const nextIsCentered = isCenteredParagraph(nextSibling);

                // If next-next is alt text, then next COULD be caption if it matches criteria
                const captionInfo = isCaptionParagraph(nextSibling);
                if (isAltTextPattern(nextNextText) && captionInfo) {
                  // Clean alt text from caption if it's accidentally merged
                  caption = nextText.replace(/[\s\u00A0]*(Alt+|alt+|ALT+)\s*:.*$/gi, '').trim();
                  captionIsItalic = captionInfo.isItalic;
                  captionIsUnderline = captionInfo.isUnderline;
                  skipParagraphs.add(nextSibling.get(0)); // Mark for skipping
                  skipParagraphs.add(nextNextSibling.get(0)); // Mark alt text for skipping
                  nextSibling.remove();
                  nextNextSibling.remove(); // Remove alt text too
                }
              }

              // If no caption found yet, check if next is italic AND centered (original logic)
              const captionInfo = isCaptionParagraph(nextSibling);
              if (!caption && captionInfo) {
                // Clean alt text from caption if it's accidentally merged
                caption = nextText.replace(/[\s\u00A0]*(Alt+|alt+|ALT+)\s*:.*$/gi, '').trim();
                if (caption) {
                  captionIsItalic = captionInfo.isItalic;
                  captionIsUnderline = captionInfo.isUnderline;
                  skipParagraphs.add(nextSibling.get(0)); // Mark for skipping
                  nextSibling.remove();
                } else {
                  // It was just alt text mistakenly identified as caption
                  skipParagraphs.add(nextSibling.get(0));
                  nextSibling.remove();
                }
              }
            }
          }

          // Multiple images - create Kadence Row Layout
          if (images.length > 1) {
            const imageData = [];
            images.each((idx, img) => {
              const $img = $(img);
              let imgAlt = $img.attr('alt') || '';
              // If this image has no alt, try to use the corresponding extracted marker
              if (!imgAlt && altMarkersArr[idx]) {
                imgAlt = altMarkersArr[idx];
              }

              imageData.push({
                src: $img.attr('src') || '',
                alt: cleanAltText(imgAlt),
                caption: idx === 0 ? caption : undefined
              });
            });
            blockCount++;

            // Check for caption paragraphs after images (centered/italic)
            // Collect all consecutive centered/italic paragraphs as caption
            const captionParagraphs = [];
            let captionHasItalic = false;
            let captionHasUnderline = false;
            let captionTextColor = null; // Store color from first caption paragraph
            let nextP = $el.nextAll('p').first();
            while (nextP.length > 0) {
              const nextText = nextP.text().trim();

              // Skip empty paragraphs
              if (!nextText) {
                // Stop if hit another image or media block
                if (nextP.find('img, iframe, table, figure').length > 0) break;
                nextP = nextP.nextAll('p').first();
                continue;
              }

              const captionInfo = isCaptionParagraph(nextP);

              if (captionInfo && !skipParagraphs.has(nextP.get(0))) {
                captionParagraphs.push(nextText);
                if (captionInfo.isItalic) captionHasItalic = true;
                if (captionInfo.isUnderline) captionHasUnderline = true;

                // Extract color from first caption paragraph
                if (captionTextColor === null) {
                  const pStyle = nextP.attr('style') || '';
                  const { textColor } = getColorStyles(pStyle);
                  captionTextColor = textColor;
                }
                skipParagraphs.add(nextP.get(0)); // Mark for skipping
                nextP = nextP.nextAll('p').first();
              } else if (isAltTextPattern(nextText)) {
                skipParagraphs.add(nextP.get(0));
                nextP = nextP.nextAll('p').first();
              } else {
                break;
              }
            }

            // If we have caption paragraphs, create caption-img block with color if available
            let captionBlock = '';
            if (captionParagraphs.length > 0) {
              const captionContent = captionParagraphs.join('<br>');
              let captionHtml = captionContent;
              if (captionHasItalic && captionHasUnderline) {
                captionHtml = `<em style="text-decoration: underline;">${captionContent}</em>`;
              } else if (captionHasItalic) {
                captionHtml = `<em>${captionContent}</em>`;
              } else if (captionHasUnderline) {
                captionHtml = `<u>${captionContent}</u>`;
              }

              // Build caption attributes with color if available
              let captionAttrsStr = '"align":"center","className":"caption-img"';
              let captionClasses = 'has-text-align-center caption-img';
              let captionInlineStyle = '';

              if (captionTextColor) {
                captionAttrsStr += `,"style":{"color":{"text":"${captionTextColor}"},"elements":{"link":{"color":{"text":"${captionTextColor}"}}}}`;
                captionClasses += ' has-text-color has-link-color';
                captionInlineStyle = ` style="color:${captionTextColor}"`;
              }

              captionBlock = `\n<!-- wp:paragraph {${captionAttrsStr}} -->\n<p class="${captionClasses}"${captionInlineStyle}>${captionHtml}</p>\n<!-- /wp:paragraph -->`;
            }

            return createKadenceRowLayout(imageData) + captionBlock;
          }

          // Single image - with or without caption
          blockCount++;

          // Collect ALL consecutive caption paragraphs after the image (centered/italic)
          const allCaptionParagraphs = [];
          let allCaptionsHaveItalic = false;
          let allCaptionsHaveUnderline = false;

          // Add the first caption if exists
          if (caption) {
            allCaptionParagraphs.push(caption);
            if (captionIsItalic) allCaptionsHaveItalic = true;
            if (captionIsUnderline) allCaptionsHaveUnderline = true;
          }

          // Check for additional caption paragraphs after the image
          let nextP = $el.nextAll('p').first();
          while (nextP.length > 0) {
            const nextText = nextP.text().trim();

            // Skip empty paragraphs
            if (!nextText) {
              // Stop if hit another image or media block
              if (nextP.find('img, iframe, table, figure').length > 0) break;
              nextP = nextP.nextAll('p').first();
              continue;
            }

            const captionInfo = isCaptionParagraph(nextP);

            // If it is a caption paragraph, collect it
            if (captionInfo && !skipParagraphs.has(nextP.get(0))) {
              allCaptionParagraphs.push(nextText);
              if (captionInfo.isItalic) allCaptionsHaveItalic = true;
              if (captionInfo.isUnderline) allCaptionsHaveUnderline = true;
              skipParagraphs.add(nextP.get(0)); // Mark for skipping
              nextP = nextP.nextAll('p').first();
            } else if (/^(Alt+|alt+|ALT+)\s*:/i.test(nextText)) {
              // Skip alt text
              skipParagraphs.add(nextP.get(0));
              nextP = nextP.nextAll('p').first();
            } else {
              break;
            }
          }

          // Build figcaption with all collected captions
          if (hasValidSrc && allCaptionParagraphs.length > 0) {
            // Join all captions with <br> and ensures no Alt text remains
            const captionContent = allCaptionParagraphs
              .map(text => text.replace(/[\s\u00A0]*(Alt+|alt+|ALT+)\s*:.*$/gi, '').trim())
              .filter(text => text.length > 0)
              .join('<br>');

            if (!captionContent) {
              return `<!-- wp:image -->
<figure class="wp-block-image">${imageMarkup}</figure>
<!-- /wp:image -->`;
            }

            let captionHtml = captionContent;
            if (allCaptionsHaveItalic && allCaptionsHaveUnderline) {
              captionHtml = `<em style="text-decoration: underline;">${captionContent}</em>`;
            } else if (allCaptionsHaveItalic) {
              captionHtml = `<em>${captionContent}</em>`;
            } else if (allCaptionsHaveUnderline) {
              captionHtml = `<u>${captionContent}</u>`;
            }
            return `<!-- wp:image -->
<figure class="wp-block-image">
    ${imageMarkup}
    <figcaption class="wp-element-caption">${captionHtml}</figcaption>
</figure>
<!-- /wp:image -->`;
          }

          if (hasValidSrc) {
            // Image without caption
            return `<!-- wp:image -->
<figure class="wp-block-image">${imageMarkup}</figure>
<!-- /wp:image -->`;
          }

          // Invalid image (no src) - skip conversion
          return null;
        }

        // Check for special paragraph types
        const specialClass = getSpecialParagraphClass(textContentNormalized, content);
        if (specialClass) {
          // Should remove (Alt text)
          if (specialClass.shouldRemove) {
            return null;
          }

          // Quote block
          if (specialClass.isQuote) {
            let quoteText = content; // Use content to preserve HTML formatting (em, a, etc.)
            let quoteTextPlain = textContentNormalized;

            // Get alignment
            const { align } = getExplicitAlignment($el);
            const alignAttr = align ? ` {"align":"${align}"}` : '';
            const pTagClass = align ? ` class="has-text-align-${align}"` : '';

            // Remove surrounding quotes from both - support all quote types
            // " (U+0022), " (U+201C), " (U+201D)
            if (specialClass.hasQuoteMarks) {
              // Remove first and last character (quote marks)
              quoteTextPlain = quoteTextPlain.slice(1, -1).trim();
              // Also remove from content (HTML) - use regex to handle all quote types
              quoteText = quoteText.replace(/^[""\u201C\u201D]/, '').replace(/[""\u201C\u201D]$/, '').trim();
            }

            // Special handling for "ข้อควรรู้" - make it bold
            if (specialClass.isKnowledgeQuote) {
              // Make "ข้อควรรู้" bold
              quoteText = quoteText.replace(/^ข้อควรรู้/, '<strong>ข้อควรรู้</strong>');

              blockCount++;
              return `<!-- wp:quote -->
<blockquote class="wp-block-quote"><!-- wp:paragraph${alignAttr} -->
<p${pTagClass}>${quoteText}</p>
<!-- /wp:paragraph --></blockquote>
<!-- /wp:quote -->`;
            }

            // General quote block
            blockCount++;
            return `<!-- wp:quote -->
<blockquote class="wp-block-quote"><!-- wp:paragraph${alignAttr} -->
<p${pTagClass}>${quoteText}</p>
<!-- /wp:paragraph --></blockquote>
<!-- /wp:quote -->`;
          }

          // Read more with link - keep original text, just add class
          if (specialClass.isReadMore) {
            blockCount++;
            // Keep the original content (with links preserved), just add vsq-readmore class
            return wrapBlock('paragraph', `<p class="vsq-readmore">${content}</p>`, { className: 'vsq-readmore' });
          }

          // Line@ promotion with button
          if (specialClass.isLinePromo) {
            const linkEl = $el.find('a').first();
            const href = linkEl.length > 0 ? (linkEl.attr('href') || '') : '';
            blockCount++;
            const headlineBlock = wrapBlock('paragraph', `<p class="has-text-align-center headline">${textContentNormalized}</p>`, { align: 'center', className: 'headline' });
            const buttonBlock = `<!-- wp:buttons {"className":"btn-addline"} --><div class="wp-block-buttons"><!-- wp:button {"className":"btn-addline"} --><div class="wp-block-button btn-addline"><a class="wp-block-button__link wp-element-button" href="${href}">Add LINE</a></div><!-- /wp:button --></div><!-- /wp:buttons -->`;
            return `${headlineBlock}\n${buttonBlock}`;
          }

          const result = [];

          // Add separator before references (only if passed TOC or no TOC exists)
          if (specialClass.addSeparator && shouldGenerateSeparators && (!hasTOCInDoc || hasPassedTOC)) {
            blockCount++;
            result.push('<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->');
          }

          // สารบัญ (Table of Contents) - just output the paragraph
          // The first list will be converted to TOC menu automatically (listIndex === 0)
          if (specialClass.isTOC) {
            expectingTOCList = true;
            hasPassedTOC = true; // Mark as passed TOC
            const tocHtml = specialClass.tocHtml || specialClass.tocTitle;
            blockCount++;
            result.push(`<!-- wp:paragraph {"className":"subtext-gtb"} -->\n<p class="subtext-gtb">${tocHtml}</p>\n<!-- /wp:paragraph -->`);
            return result.join('\n\n');
          }

          // Build paragraph with special class - use exact format like Home.jsx
          let pContent = content;

          const pClass = specialClass.class;
          const pAlign = specialClass.align;

          // Build block exactly like Home.jsx
          blockCount++;
          if (pAlign === 'center') {
            result.push(`<!-- wp:paragraph {"align":"center","className":"${pClass}"} -->\n<p class="has-text-align-center ${pClass}">${pContent}</p>\n<!-- /wp:paragraph -->`);
          } else {
            result.push(`<!-- wp:paragraph {"className":"${pClass}"} -->\n<p class="${pClass}">${pContent}</p>\n<!-- /wp:paragraph -->`);
          }
          return result.join('\n\n');
        }

        // Extract styles from element (style และ elClass ประกาศไว้แล้วด้านบน)
        const { align, className: alignClass } = getAlignmentFromStyle(style);

        // Check if paragraph is primarily a link (skip color extraction for link text)
        const hasLink = $el.find('a').length > 0;
        const linkText = $el.find('a').text().trim();
        const isPrimarilyLink = hasLink && linkText.length > 0 &&
          (linkText.length / textContentNormalized.length) > 0.8; // If >80% of text is link

        const { classes: colorClasses, textColor: rawTextColor } = getColorStyles(style);
        // Don't extract color if paragraph is primarily a link
        const textColor = isPrimarilyLink ? null : rawTextColor;

        const isCentered = isExplicitCentered(style, elClass);

        // Check if paragraph has font-weight in style (bold)
        // Match font-weight: bold, 700, 800, 900, or bolder
        const hasFontWeightBold = /font-weight\s*:\s*(bold|bolder|700|800|900)/i.test(style);

        // If font-weight bold in style -> wrap content with <strong>
        let finalContent = content;
        if (hasFontWeightBold && !content.includes('<strong>') && !content.includes('<b>')) {
          // Preserve spaces when wrapping in strong
          if (content) {
            finalContent = `<strong>${content}</strong>`;
          }
        }

        // Remove surrounding quote marks from regular paragraphs
        // Support all quote types: " (U+0022), " (U+201C), " (U+201D)
        const hasSurroundingQuotesRegular = /^[""\u201C\u201D].*[""\u201C\u201D]$/.test(textContentNormalized);
        if (hasSurroundingQuotesRegular) {
          // Remove first and last quote character from HTML content but don't trim spaces
          finalContent = finalContent.replace(/^[""\u201C\u201D]/, '').replace(/[""\u201C\u201D]$/, '');
        }



        // Clean link styles and add target="_blank" for external links
        // Define internal domains (links to these domains won't open in new tab)
        const internalDomains = [
          'vsquareclinic.com',
          'www.vsquareclinic.com',
          'vsqclinic.com',
          'www.vsqclinic.com',
          'vsquareconsult.com',
          'www.vsquareconsult.com',
          'vsquare.clinic',
          'www.vsquare.clinic',
          'vsquare-under-eye.com',
          'www.vsquare-under-eye.com',
          'vsquareclinic.co',
          'www.vsquareclinic.co',
          'vsq-injector.com',
          'www.vsq-injector.com',
          'en.vsquareclinic.com',
          'www.en.vsquareclinic.com',
          'doctorvsquareclinic.com',
          'www.doctorvsquareclinic.com',
          'cn.vsquareclinic.com',
          'www.cn.vsquareclinic.com',
          'drvsquare.com',
          'www.drvsquare.com',
          'monghaclinic.com',
          'www.monghaclinic.com',
          'bestbrandclinic.com',
          'www.bestbrandclinic.com'
        ];

        const normalizedHref = href => href.replace(/^www\./, '');

        finalContent = finalContent.replace(/<a\s+([^>]*?)>/gi, (match, attributes) => {
          // Remove style attribute
          let cleanAttrs = attributes.replace(/style="[^"]*"/gi, '');

          // Extract href to check if it's external
          const hrefMatch = cleanAttrs.match(/href=["']([^"']+)["']/i);
          if (hrefMatch) {
            const href = hrefMatch[1];

            // Check if link is external (not in internal domains list)
            const isExternal = !internalDomains.some(domain => normalizedHref(href).includes(domain));

            // Add target="_blank" and rel attributes for external links
            if (isExternal && !cleanAttrs.includes('target=')) {
              cleanAttrs += ' target="_blank" rel="noreferrer noopener"';
            }
          }

          return `<a ${cleanAttrs}>`.replace(/\s+>/g, '>').replace(/\s{2,}/g, ' ');
        });

        // Bold paragraphs should be centered
        const shouldCenter = isCentered || align === 'center' || hasFontWeightBold;

        // Build classes array
        const allClasses = [];
        // Apply references class only if in references section AND it looks like a reference
        // (Has a link AND doesn't start with conversational/summary words)
        const isConversational = /^(So,|In reality|However|Moreover|Therefore|Actually|Next,|Finally,|In conclusion)/i.test(textContentNormalized);
        if (isInReferencesSection && $el.find('a').length > 0 && !isConversational) {
          allClasses.push('references');
        }
        if (shouldCenter) {
          allClasses.push('has-text-align-center');
        } else if (alignClass) {
          allClasses.push(alignClass);
        }
        allClasses.push(...colorClasses);

        const classAttr = allClasses.length > 0 ? ` class="${allClasses.filter(Boolean).join(' ')}"` : '';

        blockCount++;
        const attrs = {};
        if (shouldCenter) {
          attrs.align = 'center';
        } else if (align && align !== 'left') {
          attrs.align = align;
        }

        // Add color style to block attributes if text color is not black
        if (textColor) {
          attrs.style = {
            color: {
              text: textColor
            },
            elements: {
              link: {
                color: {
                  text: textColor
                }
              }
            }
          };
        }

        // Build inline style for <p> tag if we have text color
        const inlineStyle = textColor ? ` style="color:${textColor}"` : '';

        return wrapBlock('paragraph', `<p${classAttr}${inlineStyle}>${finalContent}</p>`, Object.keys(attrs).length > 0 ? attrs : undefined);
      }

      case 'ul':
      case 'ol': {
        const prevSibling = $el.prev();

        // Check previous element for class OR text content (like Home.jsx rules)
        // We do this early to determine if we should skip year replacement
        let classPrev = null;
        if (prevSibling.length > 0 && prevSibling.is('p')) {
          const prevClass = prevSibling.attr('class') || '';

          if (prevClass.includes('references')) {
            classPrev = 'references';
          } else {
            // Check text content if class is missing (since we don't update DOM in previous step)
            const prevText = prevSibling.text().trim();
            const prevTextLower = prevText.toLowerCase();
            if (prevText.startsWith('อ้างอิง') ||
              prevText.startsWith('เอกสารอ้างอิง') ||
              prevText.startsWith('เอกสาร อ้างอิง') ||
              prevText.startsWith('แหล่งข้อมูลอ้างอิง') ||
              prevText.startsWith('参考') ||
              prevTextLower.startsWith('references') ||
              prevTextLower.startsWith('reference')) {
              classPrev = 'references';
            }
          }
        }

        // Apply year replacement to list (Skip if it's a reference list)
        if (!isInReferencesSection && classPrev !== 'references') {
          replaceYearsInElement($el);
        }

        const currentListIndex = listIndex;
        listIndex++; // Increment for next list
        const listStart = $el.attr('start') ? parseInt($el.attr('start'), 10) : 1;

        // Count total list items (including nested) - like Home.jsx convertListToGutenberg
        const countItems = (el) => {
          let count = 0;
          $(el).children('li').each((_, li) => {
            count++;
            const $nested = $(li).children('ul, ol');
            if ($nested.length > 0) {
              count += countItems($nested);
            }
          });
          return count;
        };
        const totalItems = countItems($el);

        // Check if this is a dashed list (items starting with "- ")
        let isDashed = false;
        $el.children('li').each((_, li) => {
          const $li = $(li);
          const text = $li.text().trim();
          if (text.startsWith('- ')) {
            isDashed = true;
            return false; // break
          }
        });

        // Check if has correctlist class
        const hasCorrectlist = $el.attr('class')?.includes('correctlist') || false;

        // Build class names (like Home.jsx)
        const classNames = [];

        // A list is TOC (listmenu) ONLY if it follows an explicit TOC header
        // (Removing the automatic fallback listIndex === 0 to avoid marking summary lists as TOC)
        const isTOC = expectingTOCList;

        if (isTOC) {
          classNames.push('listmenu');
          classNames.push('two-column');
          expectingTOCList = false; // Reset after finding the TOC list
          hasPassedTOC = true;      // Mark as passed TOC
        } else {
          expectingTOCList = false; // Reset if we found a list that wasn't expecting TOC
          // Other lists - normal processing
          if (classPrev === 'references' || isInReferencesSection) {
            if (!classNames.includes('references')) classNames.push('references');
          }
          if (isDashed) {
            classNames.push('list-dashed');
          }
          if (hasCorrectlist) {
            classNames.push('correctlist');
          }
        }

        // Sync anchor links with heading IDs for ALL lists that contain anchor links
        // This handles both TOC lists and any other lists with internal links
        const hasAnchorLinks = $el.find('a[href^="#"]').length > 0;
        if (hasAnchorLinks) {
          syncTOCLinksWithHeadings($el, $);
        }

        // Build tag comment (like Home.jsx)
        let tagComment = '<!-- wp:list -->';
        if (classNames.length > 0) {
          tagComment = `<!-- wp:list {"className":"${classNames.join(' ')}"} -->`;
        }

        if (tagName === 'ol') {
          const olAttrs = { ordered: true };
          if (classNames.length > 0) olAttrs.className = classNames.join(' ');
          if (listStart && listStart !== 1) olAttrs.start = listStart;

          tagComment = `<!-- wp:list ${JSON.stringify(olAttrs)} -->`;
        }

        // Clean link text to match heading text format (for href replacement)
        const cleanLinkText = (text) => {
          if (!text) return '';
          let cleaned = text
            .replace(/<H([1-5])>\s*:\s*/gi, '')  // <H1>:, <H2>:, <H3>:, <H4>:, <H5>:
            .replace(/&lt;H([1-5])&gt;\s*:\s*/gi, '')  // HTML entities: &lt;H1&gt;:, &lt;H2&gt;:, etc.
            .replace(/^H\s*:\s*[1-6]\s*/gi, '')  // H:2, H : 3
            .replace(/^:\s*/gi, '')  // Leading colon
            .replace(/1st/gi, '')
            .replace(/(?:h\s*[1-6]|h\s+[1-6]|header\s*tag\s*[1-6]|header\s*[1-6]) ?:?\s*/gi, '')  // h2, h 2, header tag 2, header 2
            .trim();

          // Remove leading colon again after other replacements
          while (cleaned.startsWith(':')) {
            cleaned = cleaned.substring(1).trim();
          }

          return cleaned;
        };

        // Helper function to merge adjacent anchor tags and clean up listmenu item content
        // Google Docs often creates multiple <a> tags for text that should be one link
        const cleanListItemContent = ($li, isListMenu) => {
          if (!isListMenu) return $li.html() || '';

          // Get all text content (will be used for the single merged link)
          const fullText = $li.text().trim();
          if (!fullText) return '';

          // Check if there are any anchor tags
          const $anchors = $li.find('a');
          if ($anchors.length === 0) {
            // No links - wrap entire content in link
            const cleanedText = cleanLinkText(fullText);
            const newHref = generateHashId(cleanedText);
            return `<a href="#${newHref}">${fullText}</a>`;
          }

          // Check if there are multiple adjacent anchors or text before first anchor
          const liHtml = $li.html() || '';
          const hasMultipleAnchors = $anchors.length > 1;
          const hasTextBeforeLink = liHtml.match(/^[^<]*[^\s<]/); // Text before first tag

          if (hasMultipleAnchors || hasTextBeforeLink) {
            // Merge all into single link using full text
            const cleanedText = cleanLinkText(fullText);
            const newHref = generateHashId(cleanedText);
            return `<a href="#${newHref}">${fullText}</a>`;
          }

          // Single anchor - just update the href
          const cleanedText = cleanLinkText(fullText);
          const newHref = generateHashId(cleanedText);
          return liHtml.replace(/href="[^"]*"/, `href="#${newHref}"`);
        };

        // Process nested list function (like Home.jsx convertSubListToGutenberg)
        // Now supports recursive nested lists (multiple levels)
        const convertSubListToGutenberg = ($nestedUl, nestedTag) => {
          const nestedItems = [];
          $nestedUl.children('li').each((_, nestedLi) => {
            const $nestedLi = $(nestedLi);
            const $deeperNestedUl = $nestedLi.children('ul, ol').first();
            const $nestedA = $nestedLi.find('> a, > span a, > p a').first(); // Direct child links only

            // Check for deeper nested list (recursive)
            if ($deeperNestedUl.length > 0) {
              const deeperTag = $deeperNestedUl.is('ol') ? 'ol' : 'ul';
              const deeperSubItems = convertSubListToGutenberg($deeperNestedUl, deeperTag);

              // Get li content without nested list
              const $clone = $nestedLi.clone();
              $clone.children('ul, ol').remove();
              let nestedLiContent;

              // For listmenu (TOC), use the clean helper that merges adjacent links
              if (isTOC) {
                nestedLiContent = cleanListItemContent($clone, true);
              } else {
                nestedLiContent = $clone.html() || '';
                // Removed hash-replacement logic for non-TOC lists
              }

              // Remove style attribute from links
              nestedLiContent = nestedLiContent.replace(/<a\s+style="[^"]*"\s+href=/g, '<a href=');
              nestedLiContent = nestedLiContent.replace(/<a\s+href="([^"]*)"\s+style="[^"]*"/g, '<a href="$1"');

              nestedItems.push(`<!-- wp:list-item -->\n<li>${nestedLiContent}${deeperSubItems}</li>\n<!-- /wp:list-item -->`);
            } else {
              let nestedLiContent;

              // For listmenu (TOC), use the clean helper that merges adjacent links
              if (isTOC) {
                nestedLiContent = cleanListItemContent($nestedLi, true);
              } else {
                nestedLiContent = $nestedLi.html() || '';
                // Removed hash-replacement logic for non-TOC lists
              }

              // Remove style attribute from links
              nestedLiContent = nestedLiContent.replace(/<a\s+style="[^"]*"\s+href=/g, '<a href=');
              nestedLiContent = nestedLiContent.replace(/<a\s+href="([^"]*)"\s+style="[^"]*"/g, '<a href="$1"');

              nestedItems.push(`<!-- wp:list-item -->\n<li>${nestedLiContent}</li>\n<!-- /wp:list-item -->`);
            }
          });

          // Build nested list (no class attribute like Home.jsx)
          return `\n<!-- wp:list -->\n<${nestedTag}>\n${nestedItems.join('\n\n')}\n</${nestedTag}>\n<!-- /wp:list -->`;
        };

        // Process list items (like Home.jsx)
        const listItems = [];
        $el.children('li').each((_, li) => {
          const $li = $(li);
          const $nestedUl = $li.children('ul, ol').first();
          const $aTag = $li.find('a').first();

          if ($nestedUl.length > 0) {
            // Process nested list first
            const nestedTag = $nestedUl.is('ol') ? 'ol' : 'ul';
            const listSubItems = convertSubListToGutenberg($nestedUl, nestedTag);

            // Get li content and remove nested ul temporarily
            const $clone = $li.clone();
            $clone.children('ul, ol').remove();
            let liContent;

            // For listmenu (TOC), use the clean helper that merges adjacent links
            if (isTOC) {
              liContent = cleanListItemContent($clone, true);
            } else {
              liContent = $clone.html() || '';
              // Remove "- " prefix if it's a dashed list
              if (isDashed) {
                liContent = liContent.replace(/^-\s*/, '');
              }
              // Removed hash-replacement logic for non-TOC lists
            }

            // Remove style attribute from links in list items
            liContent = liContent.replace(/<a\s+style="[^"]*"\s+href=/g, '<a href=');
            liContent = liContent.replace(/<a\s+href="([^"]*)"\s+style="[^"]*"/g, '<a href="$1"');

            listItems.push(`<!-- wp:list-item -->\n<li>${liContent}${listSubItems}</li>\n<!-- /wp:list-item -->`);
          } else {
            // No nested list
            let liContent;

            // For listmenu (TOC), use the clean helper that merges adjacent links
            if (isTOC) {
              liContent = cleanListItemContent($li, true);
            } else {
              liContent = $li.html() || '';
              // Remove "- " prefix if it's a dashed list
              if (isDashed) {
                liContent = liContent.replace(/^-\s*/, '');
              }
              // Removed hash-replacement logic for non-TOC lists
            }

            // Remove style attribute from links in list items
            liContent = liContent.replace(/<a\s+style="[^"]*"\s+href=/g, '<a href=');
            liContent = liContent.replace(/<a\s+href="([^"]*)"\s+style="[^"]*"/g, '<a href="$1"');

            listItems.push(`<!-- wp:list-item -->\n<li>${liContent}</li>\n<!-- /wp:list-item -->`);
          }
        });

        if (listItems.length === 0) return null;

        // Build class attribute (no wp-block-list class like Home.jsx)
        const classAttr = classNames.length > 0 ? ` class="${classNames.join(' ')}"` : '';

        blockCount++;
        const startAttr = tagName === 'ol' && listStart && listStart !== 1 ? ` start="${listStart}"` : '';
        let listBlock = `${tagComment}\n<${tagName}${classAttr}${startAttr}>\n${listItems.join('\n\n')}\n</${tagName}>\n<!-- /wp:list -->`;

        // Add separator after references list
        if (classNames.includes('references') && shouldGenerateSeparators) {
          listBlock += '\n<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->';
        }

        return listBlock;
      }

      case 'img': {
        const src = $el.attr('src') || '';
        const alt = $el.attr('alt') || '';

        // Look for caption paragraphs after this image
        const allCaptionParagraphs = [];
        let allCaptionsHaveItalic = false;

        let $current = $el.next();
        while ($current.length > 0) {
          // Skip br tags but continue looking
          if ($current.is('br')) {
            $current = $current.next();
            continue;
          }

          // Stop if not a paragraph (e.g. heading, table, etc.)
          if (!$current.is('p')) break;

          const pStyle = $current.attr('style') || '';
          const pHtml = $current.html() || '';
          const pText = $current.text().trim();

          // Check if centered using the new getExplicitAlignment
          const { align } = getExplicitAlignment($current);
          const isCentered = align === 'center';

          // Check if italic
          const isItalic = /font-style\s*:\s*italic/i.test(pStyle) ||
            pHtml.includes('<em>') || pHtml.includes('<i>') ||
            $current.find('em, i').length > 0;

          // Skip alt text paragraphs but keep looking for a separate caption
          if (/^(Alt+|alt+)\s*:\s*/i.test(pText)) {
            skipParagraphs.add($current.get(0));
            $current = $current.next();
            continue;
          }

          // If centered or italic, and not special content → it's a caption
          if ((isCentered || isItalic) && pText.length > 0 && pText.length < 200 &&
            !pText.startsWith('สารบัญ') && !pText.startsWith('อ้างอิง') &&
            !pText.startsWith('สรุป') && !pText.startsWith('Q&A') &&
            !/(?:h\s*[1-6]|h[1-6]|header\s*[1-6]|header\s*tag\s*[1-6])\s*:\s*/i.test(pText) &&
            !/^["“].*["”]$/.test(pText)) {
            allCaptionParagraphs.push(pText);
            if (isItalic) allCaptionsHaveItalic = true;
            skipParagraphs.add($current.get(0)); // Mark for skipping
            $current = $current.next();
          } else {
            // Found a regular paragraph that isn't Alt or a caption -> Stop looking
            break;
          }
        }

        blockCount++;

        // Build figcaption with all collected captions
        if (allCaptionParagraphs.length > 0) {
          const captionContent = allCaptionParagraphs.join('<br>');
          const captionHtml = allCaptionsHaveItalic ? `<em>${captionContent}</em>` : captionContent;
          return `<!-- wp:image -->
<figure class="wp-block-image">
    <img src="${src}" alt="${alt}"/>
    <figcaption class="wp-element-caption">${captionHtml}</figcaption>
</figure>
<!-- /wp:image -->`;
        }

        return wrapBlock('image', `<figure class="wp-block-image"><img src="${src}" alt="${alt}"/></figure>`);
      }

      case 'figure': {
        const img = $el.find('img').first();
        const figcaption = $el.find('figcaption').first();
        if (img.length > 0) {
          const src = img.attr('src') || '';
          const alt = img.attr('alt') || '';

          // If already has figcaption, use it
          if (figcaption.length > 0) {
            let content = `<figure class="wp-block-image"><img src="${src}" alt="${alt}"/>`;
            content += `<figcaption class="wp-element-caption">${figcaption.html()}</figcaption>`;
            content += '</figure>';
            blockCount++;
            return wrapBlock('image', content);
          }

          // Look for caption paragraphs after this figure
          const allCaptionParagraphs = [];
          let allCaptionsHaveItalic = false;

          let $current = $el.next();
          while ($current.length > 0) {
            // Skip br tags but continue looking
            if ($current.is('br')) {
              $current = $current.next();
              continue;
            }

            // Stop if not a paragraph (e.g. heading, table, etc.)
            if (!$current.is('p')) break;

            const pStyle = $current.attr('style') || '';
            const pHtml = $current.html() || '';
            const pText = $current.text().trim();

            // Check if centered using the new getExplicitAlignment
            const { align } = getExplicitAlignment($current);
            const isCentered = align === 'center';

            // Check if italic
            const isItalic = /font-style\s*:\s*italic/i.test(pStyle) ||
              pHtml.includes('<em>') || pHtml.includes('<i>') ||
              $current.find('em, i').length > 0;

            // Skip alt text paragraphs but keep looking for a separate caption
            if (/^(Alt+|alt+)\s*:\s*/i.test(pText)) {
              skipParagraphs.add($current.get(0));
              $current = $current.next();
              continue;
            }

            // If centered or italic, and not special content → it's a caption
            if ((isCentered || isItalic) && pText.length > 0 && pText.length < 200 &&
              !pText.startsWith('สารบัญ') && !pText.startsWith('อ้างอิง') &&
              !pText.startsWith('สรุป') && !pText.startsWith('Q&A') &&
              !/(?:h\s*[1-6]|h[1-6]|header\s*[1-6]|header\s*tag\s*[1-6])\s*:\s*/i.test(pText) &&
              !/^["“].*["”]$/.test(pText)) {
              allCaptionParagraphs.push(pText);
              if (isItalic) allCaptionsHaveItalic = true;
              skipParagraphs.add($current.get(0)); // Mark for skipping
              $current = $current.next();
            } else {
              // Found a regular paragraph that isn't Alt or a caption -> Stop looking
              break;
            }
          }

          blockCount++;

          // Build figcaption with all collected captions
          if (allCaptionParagraphs.length > 0) {
            const captionContent = allCaptionParagraphs.join('<br>');
            const captionHtml = allCaptionsHaveItalic ? `<em>${captionContent}</em>` : captionContent;
            return `<!-- wp:image -->
<figure class="wp-block-image">
    <img src="${src}" alt="${alt}"/>
    <figcaption class="wp-element-caption">${captionHtml}</figcaption>
</figure>
<!-- /wp:image -->`;
          }

          return wrapBlock('image', `<figure class="wp-block-image"><img src="${src}" alt="${alt}"/></figure>`);
        }
        return null;
      }

      case 'blockquote': {
        const content = $el.html() || '';
        const { align, className } = getExplicitAlignment($el);
        const attrs = {};
        if (align) attrs.align = align;
        if (className) attrs.className = className;

        blockCount++;
        const blockClass = className ? ` class="wp-block-quote ${className}"` : ' class="wp-block-quote"';
        return wrapBlock('quote', `<blockquote${blockClass}>${content}</blockquote>`, attrs);
      }

      case 'pre': {
        const code = $el.find('code').first();
        const content = code.length > 0 ? code.text() : $el.text();
        blockCount++;
        return wrapBlock('code', `<pre class="wp-block-code"><code>${escapeHtml(content)}</code></pre>`);
      }

      case 'hr': {
        if (!shouldGenerateSeparators) return null;
        blockCount++;
        return wrapBlock('separator', '<hr class="wp-block-separator has-alpha-channel-opacity">');
      }

      case 'table': {
        // Check if table contains "Note" or internal instructions - remove it completely
        const tableText = $el.text().trim();
        const tableHtml = $el.html() || '';

        // Convert clinic info table to button for specific domains
        const normalizedWebsite = website ? website.replace(/^www\./, '') : '';
        const isBestBrand = normalizedWebsite === 'bestbrandclinic.com';
        const isButtonTable = (normalizedWebsite === 'bestbrandclinic.com' || normalizedWebsite === 'monghaclinic.com') &&
          (tableText.includes('คลิกดูข้อมูลคลินิกเพิ่มเติม') || tableText.includes('คลิกดูข้อมูลคลินิก'));

        if (isButtonTable) {
          const rawButtonText = ($el.find('p').first().text() || tableText).trim();
          const buttonText = rawButtonText.split('[')[0].trim(); // Simpler way to remove [target]

          if (buttonText) {
            const linkEl = $el.find('a[href]').first();
            let href = '';

            if (linkEl.length > 0) {
              const rawHref = (linkEl.attr('href') || '').trim();
              if (rawHref) {
                const googleMatch = rawHref.match(/[?&]q=([^&]+)/);
                href = googleMatch ? decodeURIComponent(googleMatch[1]) : rawHref;
              }
            }

            let hrefAttr = '';
            let targetAttr = '';
            let relAttr = '';

            if (href) {
              hrefAttr = ` href="${href}"`;
              const buttonInternalDomains = [
                'vsquareclinic.com', 'www.vsquareclinic.com',
                'vsqclinic.com', 'www.vsqclinic.com',
                'vsquareconsult.com', 'www.vsquareconsult.com',
                'vsquare.clinic', 'www.vsquare.clinic',
                'vsquare-under-eye.com', 'www.vsquare-under-eye.com',
                'vsquareclinic.co', 'www.vsquareclinic.co',
                'vsq-injector.com', 'www.vsq-injector.com',
                'en.vsquareclinic.com', 'www.en.vsquareclinic.com',
                'doctorvsquareclinic.com', 'www.doctorvsquareclinic.com',
                'cn.vsquareclinic.com', 'www.cn.vsquareclinic.com',
                'drvsquare.com', 'www.drvsquare.com',
                'monghaclinic.com', 'www.monghaclinic.com',
                'bestbrandclinic.com', 'www.bestbrandclinic.com'
              ];

              const normalizedHref = href.toLowerCase();
              const isInternalLink = href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') ||
                buttonInternalDomains.some(domain => normalizedHref.includes(domain));

              targetAttr = ' target="_blank"';
              if (!isInternalLink) {
                relAttr = ' rel="noreferrer noopener nofollow"';
              } else {
                relAttr = ' rel="noreferrer noopener"';
              }
            }

            const safeText = escapeHtml(buttonText);
            const metadata = isBestBrand
              ? `{"categories":[],"patternName":"core/block/3229","name":"คลิกดูข้อมูลคลินิก"}`
              : `{"categories":[],"patternName":"core/block/536","name":"คลิกดูข้อมูล"}`;

            blockCount++;
            return `<!-- wp:buttons {"metadata":${metadata},"layout":{"type":"flex","justifyContent":"center"}} -->\n` +
              `<div class="wp-block-buttons"><!-- wp:button {"textAlign":"center"} -->\n` +
              `<div class="wp-block-button"><a class="wp-block-button__link has-text-align-center wp-element-button"${hrefAttr}${targetAttr}${relAttr}>${safeText}</a></div>\n` +
              `<!-- /wp:button --></div>\n` +
              `<!-- /wp:buttons -->`;
          }
        }

        // ===== NEW: Check for table with multiple image cells (2x2, 2x3, etc.) =====
        // Convert to Kadence Row Layout with multiple columns
        let $tableRows = $el.find('tbody tr');
        if ($tableRows.length === 0) {
          // Try without tbody
          $tableRows = $el.find('tr');
        }

        // Check if table has any content at all
        if ($tableRows.length === 0) {
          return null; // Empty table
        }

        // Check if all rows are empty (no td with content)
        let hasAnyContent = false;
        $tableRows.each((_, row) => {
          const $cells = $(row).find('td');
          if ($cells.length > 0) {
            $cells.each((_, cell) => {
              const cellText = $(cell).text().trim();
              const cellImages = $(cell).find('img').length;
              // Cell has content if it has text (excluding Alt:) OR images
              const hasText = cellText && !cellText.startsWith('Alt');
              if (hasText || cellImages > 0) {
                hasAnyContent = true;
                return false; // break
              }
            });
          }
          if (hasAnyContent) return false; // break outer loop
        });

        if (!hasAnyContent) {
          return null; // Table has no content
        }

        const hasMultipleImageCells = $tableRows.length > 0 && $tableRows.first().find('td').length >= 2;

        if (hasMultipleImageCells) {
          // Count total cells and images across all rows
          const allCells = [];
          $tableRows.each((_, row) => {
            $(row).find('td').each((_, cell) => {
              const $cell = $(cell);
              const $img = $cell.find('img').first();

              // Look for Alt text in the cell
              let altText = '';
              $cell.find('p, span').each((_, p) => {
                const pText = $(p).text().trim();
                // Match Alt: or Alt text: patterns
                if (/^(Alt|alt|ALT)\s*[:\-]?\s*/i.test(pText)) {
                  altText = pText.replace(/^(Alt|alt|ALT)\s*[:\-]?\s*/i, '').trim();
                }
              });

              allCells.push({
                hasImage: $img.length > 0,
                src: $img.attr('src') || '',
                alt: altText || $img.attr('alt') || '',
                html: $cell.html()
              });
            });
          });

          const totalCells = allCells.length;
          const cellsWithImages = allCells.filter(c => c.hasImage).length;

          // If we have 2-6 cells total and at least 2 have images, combine into one layout
          const shouldCombineAll = totalCells >= 2 && totalCells <= 6 && cellsWithImages >= 2;

          if (shouldCombineAll) {
            const uniqueId = generateKadenceUniqueId();
            let innerBlocks = '';

            allCells.forEach((cell, index) => {
              const colId = generateKadenceUniqueId();
              const idAttr = index === 0 ? '' : `"id":${index + 1},`;
              const escapedAlt = (cell.alt || '').replace(/"/g, '&quot;');

              let cellContent = '';
              if (cell.hasImage) {
                cellContent = `<!-- wp:image -->\n<figure class="wp-block-image"><img alt="${escapedAlt}"/></figure>\n<!-- /wp:image -->`;
              } else {
                // For non-image cells in the grid, keep their content but clean it
                cellContent = `<!-- wp:paragraph --><p>${cell.html.replace(/<[^>]+>/g, '').trim()}</p><!-- /wp:paragraph -->`;
              }

              innerBlocks += `<!-- wp:kadence/column {${idAttr}"borderWidth":["","","",""],"uniqueID":"${colId}","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-column${colId}"><div class="kt-inside-inner-col">${cellContent}</div></div>
<!-- /wp:kadence/column -->\n\n`;
            });

            blockCount++;
            return `<!-- wp:kadence/rowlayout {"uniqueID":"${uniqueId}","columns":${totalCells},"mobileLayout":"equal","tabletLayout":"equal","colLayout":"equal","kbVersion":2} -->
${innerBlocks.trim()}\n<!-- /wp:kadence/rowlayout -->`;
          }

          // Fallback to processing each row separately if too many cells or special layout
          if (cellsWithImages >= 2) {
            // Default: Process each row separately (Existing logic)
            const rowLayouts = [];

            $tableRows.each((_, row) => {
              const rowImages = [];

              // Collect images from this row only
              $(row).find('td').each((_, cell) => {
                const $cell = $(cell);
                const $img = $cell.find('img').first();
                if ($img.length > 0) {
                  // Look for Alt text in the cell
                  let altText = '';
                  $cell.find('p').each((_, p) => {
                    const pText = $(p).text().trim();
                    if (/^Alt\s*:/i.test(pText)) {
                      altText = pText.replace(/^Alt\s*:\s*/i, '').trim();
                    }
                  });

                  rowImages.push({
                    src: $img.attr('src') || '',
                    alt: altText || $img.attr('alt') || ''
                  });
                }
              });

              // Create Kadence Row Layout for this row if it has at least 2 images
              if (rowImages.length >= 2) {
                const uniqueId = generateKadenceUniqueId();
                const columns = Math.min(rowImages.length, 6); // Max 6 columns

                // Determine colLayout by checking if all cells have equal colspan
                // Get all td elements in this row
                const $cells = $(row).find('td');
                const colspans = [];
                $cells.each((_, cell) => {
                  const colspan = parseInt($(cell).attr('colspan') || '1', 10);
                  colspans.push(colspan);
                });

                // Check if all colspans are equal (or all are 1)
                const allEqual = colspans.every(span => span === colspans[0]);

                // Determine colLayout
                let colLayout = 'equal'; // Default to equal if all cells have same colspan

                if (!allEqual) {
                  // If colspans are different, use specific layouts based on column count
                  if (columns === 3) {
                    colLayout = 'three-grid';
                  } else if (columns === 4) {
                    colLayout = 'four-grid';
                  } else if (columns === 6) {
                    colLayout = 'three-grid';
                  }
                }
                // If allEqual is true, keep 'equal' for all column counts

                let innerBlocks = '';
                rowImages.forEach((img, index) => {
                  const colId = generateKadenceUniqueId();
                  const idAttr = index === 0 ? '' : `"id":${index + 1},`;

                  // Build alt attribute (escape quotes for safety)
                  const escapedAlt = (img.alt || '').replace(/"/g, '&quot;');

                  innerBlocks += `<!-- wp:kadence/column {${idAttr}"borderWidth":["","","",""],"uniqueID":"${colId}","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-column${colId}"><div class="kt-inside-inner-col"><!-- wp:image -->
<figure class="wp-block-image"><img alt="${escapedAlt}"/></figure>
<!-- /wp:image --></div></div>
<!-- /wp:kadence/column -->

`;
                });

                rowLayouts.push(`<!-- wp:kadence/rowlayout {"uniqueID":"${uniqueId}","columns":${columns},"colLayout":"${colLayout}","kbVersion":2} -->
${innerBlocks}<!-- /wp:kadence/rowlayout -->`);
              }
            });

            // Return all row layouts joined together
            if (rowLayouts.length > 0) {
              blockCount += rowLayouts.length;
              return rowLayouts.join('\n\n');
            }
          }
        }

        // Check if table contains "Note" (case insensitive) - but not product names like "Juvelook"
        const hasNote = /\bNote\s*[:-\s]?/i.test(tableText) && !/Juvelook|Sculptra|Radiesse|HArmonyCa|Gouri|Ultracol/i.test(tableText);

        // Check if table contains internal note patterns
        const hasInternalNote = /Update\s+สารบัญ|แก้ข้อมูลรีวิว|Note\s+ให้ทีมเว็บ|ทำภาพปก|เพิ่ม\s+Internal\s+Link|ใส่\s*%%currentyear%%|เพื่อให้ปี\s*ค\.\s*ศ\.|แก้วันที่เผยแพร่|Link\s+Banner|ทำปุ่ม|ลิงก์ไป|ตั้งค่าการเปิดลิงก์|เป็น\s*Mark\s+as\s+nofollow|ติ๊กถูก|To\s+Team\s+web|แทรก\s*internal\s*link|แทรก\s*Internal\s*link|อัปโหลดโดยวาง|ลิงก์แบนเนอร์|ลบรูป|รูปตำแหน่ง/i.test(tableText);

        // Check if table starts with Google Docs comment markers [a], [b], etc.
        const hasCommentMarker = /^\[([a-z0-9]+)\]/i.test(tableText);

        // Check if table contains promotion URLs (common in internal notes)
        const hasPromotionUrl = /promotion\/picosure-pro-laser|promotion\//i.test(tableHtml);

        // If table contains Note or internal instructions, don't convert it at all
        if (hasNote || hasInternalNote || hasPromotionUrl || hasCommentMarker) {
          return null;
        }

        // ===== Check for 2-column table with links -> convert to Kadence row layout =====
        const $rows = $el.find('tr');
        if ($rows.length === 1) {
          const $cells = $rows.first().find('td');
          // Check if table has 2 columns with links
          if ($cells.length === 2) {
            const cell1Links = $cells.eq(0).find('a');
            const cell2Links = $cells.eq(1).find('a');

            // Both cells have links
            if (cell1Links.length > 0 && cell2Links.length > 0) {
              // Extract button content for each cell
              const extractButtonContent = ($cell) => {
                const paragraphs = $cell.find('p');
                const texts = [];
                let href = '';

                paragraphs.each((_, p) => {
                  const $p = $(p);
                  const $a = $p.find('a').first();
                  if ($a.length > 0) {
                    if (!href) {
                      // Get href from first link, clean Google redirect
                      const rawHref = $a.attr('href') || '';
                      const googleMatch = rawHref.match(/[?&]q=([^&]+)/);
                      href = googleMatch ? decodeURIComponent(googleMatch[1]) : rawHref;
                    }
                    texts.push($a.text().trim());
                  }
                });

                // Join texts with <br>
                const buttonText = texts.join('<br>');
                return { href, buttonText, hasBr: texts.length > 1 };
              };

              const cell1Content = extractButtonContent($cells.eq(0));
              const cell2Content = extractButtonContent($cells.eq(1));

              // Generate unique IDs for Kadence
              const rowUniqueID = `13980_${Math.random().toString(36).substr(2, 9)}`;
              const col1UniqueID = `13980_${Math.random().toString(36).substr(2, 9)}`;
              const col2UniqueID = `13980_${Math.random().toString(36).substr(2, 9)}`;

              // Build button blocks
              const buildButtonBlock = (content) => {
                const arrowClass = content.hasBr ? 'remove-arrow' : '';
                const classAttr = arrowClass ? `"className":"${arrowClass}",` : '';
                const divClass = arrowClass ? ` ${arrowClass}` : '';

                return `<!-- wp:buttons {${classAttr}"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons${divClass}"><!-- wp:button {"textAlign":"center"} -->
<div class="wp-block-button"><a class="wp-block-button__link has-text-align-center wp-element-button" href="${content.href}">${content.buttonText}</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;
              };

              blockCount++;
              return `<!-- wp:kadence/rowlayout {"uniqueID":"${rowUniqueID}","colLayout":"equal","firstColumnWidth":0,"secondColumnWidth":0,"thirdColumnWidth":0,"fourthColumnWidth":0,"fifthColumnWidth":0,"sixthColumnWidth":0,"kbVersion":2} -->
<!-- wp:kadence/column {"borderWidth":["","","",""],"uniqueID":"${col1UniqueID}","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-column${col1UniqueID}"><div class="kt-inside-inner-col">${buildButtonBlock(cell1Content)}</div></div>
<!-- /wp:kadence/column -->

<!-- wp:kadence/column {"borderWidth":["","","",""],"uniqueID":"${col2UniqueID}","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-column${col2UniqueID}"><div class="kt-inside-inner-col">${buildButtonBlock(cell2Content)}</div></div>
<!-- /wp:kadence/column -->
<!-- /wp:kadence/rowlayout -->`;
            }
          }
        }

        // Check if table is after H1 - don't convert to button if it is
        const isAfterH1 = () => {
          // Check previous siblings (up to 10 elements back)
          let prevEl = $el.prev();
          for (let i = 0; i < 10 && prevEl.length > 0; i++) {
            // Check if previous element is H1
            if (prevEl.is('h1')) {
              return true;
            }
            prevEl = prevEl.prev();
          }

          // Check parent elements
          let parent = $el.parent();
          while (parent.length > 0 && !parent.is('body')) {
            // Check if parent contains H1 before this table
            const parentChildren = parent.children();
            let foundH1 = false;
            for (let j = 0; j < parentChildren.length; j++) {
              const child = $(parentChildren[j]);
              if (child.is('h1')) {
                foundH1 = true;
              }
              if (child.is($el) && foundH1) {
                return true;
              }
            }
            parent = parent.parent();
          }

          return false;
        };

        // Check if table is inside or after a Note/internal instruction - don't convert to button if it is
        const isInNote = () => {
          // Check previous siblings (up to 10 elements back to catch Note in lists and instructions)
          let prevEl = $el.prev();
          for (let i = 0; i < 10 && prevEl.length > 0; i++) {
            const prevText = prevEl.text().trim();
            // Check if previous element starts with "Note" or internal instruction patterns
            if (/^Note\s*[:-\s]?/i.test(prevText) ||
              /^ใส่\s*%%currentyear%%/i.test(prevText) ||
              /^เพื่อให้ปี\s*ค\.\s*ศ\./i.test(prevText) ||
              /^แก้วันที่เผยแพร่/i.test(prevText) ||
              /^Link\s+Banner/i.test(prevText) ||
              /^ทำปุ่ม\s+Button/i.test(prevText) ||
              /^ลิงก์ไป\s*:/i.test(prevText) ||
              /^ตั้งค่าการเปิดลิงก์/i.test(prevText) ||
              /^เป็น\s*Mark\s+as\s+nofollow/i.test(prevText) ||
              /^ติ๊กถูก/i.test(prevText) ||
              (prevEl.is('li') && (/^Note\s*[:-\s]?/i.test(prevText) ||
                /^ใส่\s*%%currentyear%%/i.test(prevText) ||
                /^ทำปุ่ม/i.test(prevText) ||
                /^Link\s+Banner/i.test(prevText)))) {
              return true;
            }
            prevEl = prevEl.prev();
          }

          // Check parent elements and their text content
          let parent = $el.parent();
          while (parent.length > 0 && !parent.is('body')) {
            const parentText = parent.text().trim();
            // Check if parent starts with "Note" or internal instruction patterns
            if (/^Note\s*[:-\s]?/i.test(parentText) ||
              /^ใส่\s*%%currentyear%%/i.test(parentText) ||
              /^ทำปุ่ม/i.test(parentText) ||
              /^Link\s+Banner/i.test(parentText)) {
              return true;
            }
            // Check if parent is a list item that starts with "Note" or instructions
            if (parent.is('li')) {
              const liText = parent.text().trim();
              if (/^Note\s*[:-\s]?/i.test(liText) ||
                /^ใส่\s*%%currentyear%%/i.test(liText) ||
                /^ทำปุ่ม/i.test(liText) ||
                /^Link\s+Banner/i.test(liText)) {
                return true;
              }
            }
            parent = parent.parent();
          }

          return false;
        };

        // Check if table contains a link (button-style table)
        const $tableLink = $el.find('a').first();
        if ($tableLink.length > 0) {
          const href = $tableLink.attr('href') || '#';
          const linkText = $tableLink.text().trim() || '';

          // Check if table is before first H1 (at document start) - don't convert
          const isBeforeFirstH1 = () => {
            // Get all H1 elements in document
            const allH1s = $('h1');
            if (allH1s.length === 0) {
              // No H1 in document, check if this is at the start
              let prevEl = $el.prev();
              let hasContentBefore = false;
              for (let i = 0; i < 20 && prevEl.length > 0; i++) {
                const tagName = prevEl.prop('tagName')?.toLowerCase();
                if (tagName && !['meta', 'style', 'script', 'head'].includes(tagName)) {
                  hasContentBefore = true;
                  break;
                }
                prevEl = prevEl.prev();
              }
              // If no content before and no H1, likely at start - don't convert
              return !hasContentBefore;
            }

            // Find the first H1 in document order
            const body = $('body');
            const root = body.length > 0 ? body : $.root();
            const firstH1 = root.find('h1').first();

            if (firstH1.length > 0) {
              // Check if this table comes before the first H1
              // Walk backwards from first H1 to see if we encounter this table
              let checkEl = firstH1.prev();
              while (checkEl.length > 0) {
                if (checkEl.is($el) || checkEl.find($el).length > 0) {
                  // Found this table before first H1
                  return true;
                }
                checkEl = checkEl.prev();
              }

              // Also check if table and H1 are siblings and table comes first
              if ($el.parent().length > 0 && firstH1.parent().length > 0 &&
                $el.parent()[0] === firstH1.parent()[0]) {
                const tableIndex = $el.index();
                const h1Index = firstH1.index();
                if (tableIndex >= 0 && h1Index >= 0 && tableIndex < h1Index) {
                  return true;
                }
              }
            }

            return false;
          };

          // Check if URL looks like internal note/promotion link
          const isInternalNoteUrl = () => {
            if (!href || href === '#') return false;
            // Check if URL contains promotion/picosure-pro-laser or similar patterns
            // Also check if link text is just a URL (common in internal notes)
            // If link text equals the URL exactly, it's likely an internal note
            const normalizedHref = href.trim();
            const normalizedLinkText = linkText.trim();
            return /promotion\/picosure-pro-laser/i.test(href) ||
              (/promotion\//i.test(href) && normalizedLinkText.includes('https://')) ||
              (normalizedLinkText === normalizedHref && /^https?:\/\//.test(normalizedLinkText));
          };

          // Don't convert to button if:
          // 1. Table is after H1
          // 2. Table is in Note
          // 3. Table is before first H1 (at document start)
          // 4. Table URL is internal note/promotion link
          if (isAfterH1() || isInNote() || isBeforeFirstH1() || isInternalNoteUrl()) {
            // Just return as regular table
            $el.find('[style]').removeAttr('style');
            $el.removeAttr('style');
            blockCount++;
            return wrapBlock('table', `<figure class="wp-block-table">${$el.prop('outerHTML')}</figure>`);
          }

          // Collect all links in the table to support multi-line button text
          const $allLinks = $el.find('a');
          let combinedTexts = [];
          $allLinks.each((_, link) => {
            const $link = $(link);
            const text = $link.html() || $link.text();
            if (text.trim()) {
              combinedTexts.push(text.trim());
            }
          });

          // Get inner HTML and clean it - keep only text and <br> tags
          let buttonHtml = combinedTexts.join('<br>');
          // Remove all tags except <br>, keep text content
          // First, replace <br> with placeholder
          buttonHtml = buttonHtml.replace(/<br\s*\/?>/gi, '{{BR}}');
          // Remove all other HTML tags but keep their text content
          buttonHtml = buttonHtml.replace(/<[^>]+>/g, '');
          // Restore <br> tags
          buttonHtml = buttonHtml.replace(/\{\{BR\}\}/g, '<br>');
          // Clean up whitespace
          buttonHtml = buttonHtml.replace(/\s+/g, ' ').trim();

          if (buttonHtml && href !== '#') {
            blockCount++;
            // Add remove-arrow class if button has <br> (2 lines)
            const hasBr = buttonHtml.includes('<br>');
            if (hasBr) {
              return `<!-- wp:buttons {"className":"remove-arrow","layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons remove-arrow"><!-- wp:button {"textAlign":"center"} -->
<div class="wp-block-button"><a class="wp-block-button__link has-text-align-center wp-element-button" href="${href}">${buttonHtml}</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;
            } else {
              return `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button {"textAlign":"center"} -->
<div class="wp-block-button"><a class="wp-block-button__link has-text-align-center wp-element-button" href="${href}">${buttonHtml}</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;
            }
          }
        }

        // Clean up table for Gutenberg (fallback for regular tables)
        // Convert first row to thead with th elements

        // Clean up table for Gutenberg (fallback for regular tables)
        // Convert first row to thead with th elements unless it has rowspans

        // Helper function to check if cell is centered
        const isCellCentered = ($cell) => {
          const { align } = getExplicitAlignment($cell);
          if (align === 'center') return true;

          // Check first paragraph (common in Word/Google Docs tables)
          const $firstP = $cell.find('p').first();
          if ($firstP.length > 0) {
            const { align: pAlign } = getExplicitAlignment($firstP);
            if (pAlign === 'center') return true;
          }

          return false;
        };

        // Helper function to get clean cell content
        const getCleanCellContent = ($cell) => {
          // Clone to avoid modifying original
          const $temp = $('<div>').html($cell.html() || '');

          // Helper to clean links
          const cleanLink = (href) => {
            if (!href) return '';
            const googleMatch = href.match(/[?&]q=([^&]+)/);
            return googleMatch ? decodeURIComponent(googleMatch[1]) : href;
          };

          // 1. Process block elements (p, div): identify top-level blocks to avoid duplicates
          const lines = [];
          $temp.find('p, div').each((_, el) => {
            const $el = $(el);
            // Only take blocks that don't have block parents WITHIN $temp
            if ($el.parentsUntil($temp, 'p, div').length === 0) {
              lines.push($el.html() || '');

              // Promote alignment to parent cell (td)
              const { align: childAlign, className: childClass } = getExplicitAlignment($el);
              if (childAlign && !$cell.hasClass('has-text-align-' + childAlign)) {
                $cell.addClass(childClass);
              }
            }
          });

          // NEW: If the cell (td/th) itself has an alignment but no child blocks yet
          const { align: cellLevelAlign, className: cellLevelClass } = getExplicitAlignment($cell);
          if (cellLevelAlign && !$cell.hasClass('has-text-align-' + cellLevelAlign)) {
            $cell.addClass(cellLevelClass);
          }

          // If no nested P/DIV found, handle the direct content
          if (lines.length === 0) {
            let html = $temp.html() || '';
            lines.push(html);
          }

          let resultArr = lines.map(line => {
            // Deep clean each line: remove span, font, etc but keep structure
            const $lineDom = $('<div>').html(line);

            // Handle nested blocks: replace with content + break
            $lineDom.find('p, div').each((_, el) => {
              const $el = $(el);
              if ($el.next().length > 0) {
                $el.replaceWith($el.html() + '<br>');
              } else {
                $el.replaceWith($el.html());
              }
            });

            $lineDom.find('span, font, style, script').each((_, el) => {
              const $el = $(el);
              $el.replaceWith($el.html());
            });
            // Clean links
            $lineDom.find('a').each((_, el) => {
              const $a = $(el);
              $a.attr('href', cleanLink($a.attr('href')));
              $a.removeAttr('class').removeAttr('style').removeAttr('id');
            });
            // Clean all other attributes
            $lineDom.find('*').not('a, strong, b, em, i, u, br').each((_, el) => {
              const $el = $(el);
              const attrs = el.attribs || {};
              Object.keys(attrs).forEach(attr => $el.removeAttr(attr));
            });
            return $lineDom.html().trim();
          }).filter(line => line.length > 0);

          let result = resultArr.join('<br>\n');
          return result.trim();
        };

        // Find all rows and remove unwanted elements like captions
        $el.find('caption').remove();
        let $tbody = $el.find('tbody');
        if ($tbody.length === 0) {
          // Create tbody if not exists
          $tbody = $('<tbody>');
          $el.find('tr').each((_, tr) => {
            $tbody.append($(tr).clone());
          });
          $el.empty().append($tbody);
        }

        const $bodyRows = $tbody.find('tr');

        if ($bodyRows.length > 0) {
          // Determine total column count from first row
          let totalCols = 0;
          $bodyRows.first().find('td, th').each((_, cell) => {
            totalCols += parseInt($(cell).attr('colspan') || '1', 10);
          });

          // Check if first row has rowspans (if so, it can't be in thead alone)
          const $firstRowOriginal = $bodyRows.first();
          let hasRowSpanInFirstRow = false;
          $firstRowOriginal.find('td, th').each((_, cell) => {
            if (parseInt($(cell).attr('rowspan') || '1', 10) > 1) {
              hasRowSpanInFirstRow = true;
              return false;
            }
          });

          let $thead = null;
          if (!hasRowSpanInFirstRow) {
            // First row becomes thead
            const $firstRow = $bodyRows.first();
            $thead = $('<thead>');
            const $headRow = $('<tr>');

            $firstRow.find('td, th').each((idx, td) => {
              const $td = $(td);
              const content = getCleanCellContent($td);
              const colspan = $td.attr('colspan') || '1';
              const rowspan = $td.attr('rowspan') || '1';
              const { className: alignClass } = getExplicitAlignment($td);

              // Header cells
              const $th = $('<th>');
              if (alignClass) $th.addClass(alignClass);
              if (colspan !== '1') $th.attr('colspan', colspan);
              if (rowspan !== '1') $th.attr('rowspan', rowspan);
              if (parseInt(rowspan, 10) > 1) {
                $th.css('vertical-align', 'middle');
              }

              $th.html(content);
              $headRow.append($th);
            });

            $thead.append($headRow);
            // Remove first row from tbody as it's now in thead
            $firstRow.remove();
          }

          // Process remaining rows in tbody (or all rows if we skipped thead)
          $tbody.find('tr').each((trIdx, tr) => {
            const $tr = $(tr);
            const $cells = $tr.children('td, th');
            const isFullWidthRow = totalCols > 1 && $cells.length === 1 && parseInt($cells.first().attr('colspan') || '1', 10) === totalCols;

            // If we skipped head, the first row in tbody is the header row
            const isHeaderRow = hasRowSpanInFirstRow && trIdx === 0;

            $cells.each((colIdx, td) => {
              const $td = $(td);
              const content = getCleanCellContent($td);
              const { className: alignClass } = getExplicitAlignment($td);

              // Preserve colspan/rowspan from source
              const colspan = $td.attr('colspan') || '1';
              const rowspan = $td.attr('rowspan') || '1';

              // Clear and rebuild cell
              $td.empty().html(content);
              $td.removeAttr('style').removeAttr('class').removeAttr('colspan').removeAttr('rowspan');

              // Only add colspan/rowspan if not "1" (default value)
              if (colspan !== '1') $td.attr('colspan', colspan);
              if (rowspan !== '1') $td.attr('rowspan', rowspan);

              // Add alignment class if found
              if (alignClass) {
                $td.addClass(alignClass);
              }

              // Add vertical-align: middle if rowspan > 1
              if (parseInt(rowspan, 10) > 1) {
                $td.css('vertical-align', 'middle');
              }

              // If it's a full-width section header or it's the header row of a complex table, convert to <th>
              if (isFullWidthRow || isHeaderRow) {
                const $th = $('<th>').html($td.html());
                const attrs = $td.attr() || {};
                Object.keys(attrs).forEach(attr => $th.attr(attr, attrs[attr]));
                $td.replaceWith($th);
              }
            });
          });

          // Rebuild table content: Empty the table and add back only thead and tbody
          $el.empty();
          if ($thead) $el.append($thead);
          $el.append($tbody);
        }

        // Add has-fixed-layout class to table
        $el.addClass('has-fixed-layout');

        // Clean up remaining attributes
        $el.find('tr').removeAttr('style').removeAttr('class');
        $tbody.removeAttr('style').removeAttr('class');
        $el.removeAttr('style');

        // Detect table alignment - including checking parent div wrapper
        const { align, className: alignClass } = getExplicitAlignment($el, true);
        const tableAttrs = { hasFixedLayout: true };
        if (align) tableAttrs.align = align;

        const figureClass = align ? `wp-block-table align${align}` : 'wp-block-table';

        blockCount++;
        // Return table with alignment and hasFixedLayout attributes
        return `<!-- wp:table ${JSON.stringify(tableAttrs)} -->\n<figure class="${figureClass}">${$el.prop('outerHTML')}</figure>\n<!-- /wp:table -->`;
      }

      case 'div': {
        const childBlocks = [];
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
export function applyPolicies(html, config = defaultPolicyConfig) {
  const $ = cheerio.load(html, {});
  const triggered = [];
  const warnings = [];

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
      const removedElements = [];
      const elementsToRemove = [];

      // Collect all siblings before the first H1
      firstH1.prevAll().each((_, el) => {
        const tagName = $(el).prop('tagName')?.toLowerCase();
        if (tagName) {
          removedElements.push(tagName);
        }
        elementsToRemove.push(el);
      });

      // Also check parent containers and collect content before them
      let parent = firstH1.parent();
      while (parent.length > 0 && parent.prop('tagName')?.toLowerCase() !== 'body' && parent.prop('tagName')?.toLowerCase() !== 'html') {
        const prevElements = parent.prevAll().toArray();
        prevElements.forEach((el) => {
          const tagName = $(el).prop('tagName')?.toLowerCase();
          if (tagName) {
            removedElements.push(tagName);
          }
          elementsToRemove.push(el);
        });
        parent = parent.parent();
      }

      // Remove all collected elements
      elementsToRemove.forEach((el) => $(el).remove());

      // Remove the first H1 itself
      removedElements.push('h1');
      firstH1.remove();

      const removedCount = elementsToRemove.length + 1; // +1 for H1
      if (removedCount > 0) {
        const uniqueTags = [...new Set(removedElements)].join(', ');
        triggered.push('removeBeforeH1');
        warnings.push(`ลบเนื้อหาก่อน H1 และ H1 แรก จำนวน ${removedCount} รายการ (แท็ก: ${uniqueTags})`);
      }
    }
  }

  // Remove ALL "NOTE SEO Writer" elements completely (including ul/ol lists)
  if (config.removeAfterNoteSEO?.enabled) {
    let removedCount = 0;

    // Find and remove ALL elements containing "NOTE SEO" text
    // Include ul, ol for lists that contain NOTE SEO checklist items
    $('p, div, span, li, td, ul, ol, h1, h2, h3, h4, h5, h6').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();

      // Check if this element contains "NOTE SEO" (case insensitive)
      if (/note\s*seo/i.test(text)) {
        removedCount++;
        $el.remove();
      }
    });

    if (removedCount > 0) {
      triggered.push('removeNoteSEO');
      warnings.push(`ลบ "NOTE SEO Writer" จำนวน ${removedCount} รายการ`);
    }
  }

  // Remove content after "สรุป" heading - keep summary paragraphs, then only separator + footer
  // This ensures clean ending with just the summary content
  let foundSummary = false;
  let summaryRemoveCount = 0;

  // Find h2 elements containing "สรุป"
  $('h2').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();

    // Check if this is the summary heading
    if (!foundSummary && /^สรุป/i.test(text)) {
      foundSummary = true;

      // Find all siblings after the summary h2
      let nextEl = $el.next();
      let summaryParagraphCount = 0;
      const maxSummaryParagraphs = 3; // Keep up to 3 paragraphs as summary content

      while (nextEl.length > 0) {
        const nextTag = nextEl.prop('tagName')?.toLowerCase();
        const nextText = nextEl.text().trim();

        // Stop at next h2 - remove it and everything after
        if (nextTag === 'h2') {
          let toRemove = nextEl;
          while (toRemove.length > 0) {
            const nextToRemove = toRemove.next();
            summaryRemoveCount++;
            toRemove.remove();
            toRemove = nextToRemove;
          }
          break;
        }

        // Keep paragraphs that are actual summary content (up to maxSummaryParagraphs)
        if (nextTag === 'p' && nextText.length > 0 && summaryParagraphCount < maxSummaryParagraphs) {
          // Check if this looks like summary content (not internal notes)
          const isInternalNote = /^-\s*โบท็อก|⚠️|หมายเหตุ|เนื้อหานี้มีการกล่าวถึง/i.test(nextText);
          if (!isInternalNote) {
            summaryParagraphCount++;
            nextEl = nextEl.next();
            continue;
          }
        }

        // Remove everything else after summary paragraphs
        if (summaryParagraphCount > 0) {
          const toRemove = nextEl;
          nextEl = nextEl.next();
          summaryRemoveCount++;
          toRemove.remove();
        } else {
          nextEl = nextEl.next();
        }
      }
    }
  });

  if (summaryRemoveCount > 0) {
    triggered.push('removeAfterSummary');
    warnings.push(`ลบเนื้อหาหลัง "สรุป" จำนวน ${summaryRemoveCount} รายการ (เก็บแค่ separator + footer)`);
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

  // Disclaimer policy - DISABLED (ไม่เพิ่มข้อความที่ไม่ได้อยู่ใน docs)
  // ถ้าข้อความ "⚠️ หมายเหตุ" หรือ "เนื้อหานี้มีการกล่าวถึงโปรโมชั่น" ยังปรากฏ
  // แสดงว่ามาจาก Google Docs ต้นฉบับ ซึ่งจะถูกลบโดย internalNotePatterns

  return { html: $.html() || '', triggered: [...new Set(triggered)], warnings };
}

/**
 * Process external links - add target="_blank" and rel="noreferrer noopener"
 * Based on Home.jsx processLinks function
 * Skip links inside listmenu (TOC - สารบัญ) and REMOVE target="_blank" from them
 */
function processLinks(htmlString, selectedDomain) {
  if (!selectedDomain) return htmlString;

  // Use cheerio to properly handle listmenu exclusion
  const $ = cheerio.load(htmlString, { decodeEntities: false });

  // Process all anchor tags
  $('a').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';

    // If inside listmenu (TOC - สารบัญ), REMOVE target="_blank" and rel
    if ($a.closest('.listmenu').length > 0) {
      $a.removeAttr('target');
      $a.removeAttr('rel');
      $a.removeAttr('style');

      // Deep clean TOC links: remove styles from children and unwrap spans/u tags
      // This prevents unwanted underlines (often from Google Docs default styles)
      $a.find('*').removeAttr('style');
      $a.find('span, u').each((_, inner) => {
        const $inner = $(inner);
        $inner.replaceWith($inner.html() || '');
      });
      return;
    }

    if (href.startsWith('/') || href.startsWith('#') || !href.includes('://')) {
      $a.removeAttr('target');
      $a.removeAttr('rel');
      return;
    }

    try {
      const url = new URL(href);
      const linkDomain = url.hostname.toLowerCase().replace(/^www\./, '');
      const selectedDomainClean = selectedDomain.replace(/^www\./, '');

      const sameDomain = linkDomain === selectedDomainClean;
      const isInternalDomain = (
        linkDomain === selectedDomainClean ||
        linkDomain.endsWith(`.${selectedDomainClean}`)
      );

      // Internal domains whitelist
      const vsquareDomains = [
        'vsquareclinic.com', 'vsqclinic.com', 'vsquareconsult.com',
        'vsquare.clinic', 'vsquare-under-eye.com', 'vsquareclinic.co',
        'vsq-injector.com', 'en.vsquareclinic.com', 'cn.vsquareclinic.com',
        'doctorvsquareclinic.com', 'drvsquare.com', 'monghaclinic.com',
        'bestbrandclinic.com'
      ];

      const isVsquareLink = vsquareDomains.some(d => linkDomain.includes(d));

      if (sameDomain || isInternalDomain) {
        $a.removeAttr('target');
        $a.removeAttr('rel');
        return;
      }

      $a.removeAttr('target').removeAttr('rel');
      $a.attr('target', '_blank');

      if (isVsquareLink) {
        $a.attr('rel', 'noreferrer noopener');
      } else {
        $a.attr('rel', 'noreferrer noopener nofollow');
      }
    } catch (e) {
      $a.removeAttr('target');
      $a.removeAttr('rel');
    }
  });

  return $.html();
}

/**
 * Replace [current_year] with actual current year
 * Skip references section and references lists for all domains
 */
function replaceCurrentYear(htmlString) {
  const $ = cheerio.load(htmlString, { decodeEntities: false });
  const currentYear = new Date().getFullYear();

  // First, mark all elements in references section
  let inReferencesSection = false;
  $('*').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    const tagName = el.tagName?.toLowerCase();

    // Check if this is a references heading or paragraph
    if ((tagName === 'h2' || tagName === 'h3' || tagName === 'p') &&
      (text.startsWith('อ้างอิง') || text.startsWith('เอกสารอ้างอิง') ||
        text.startsWith('เอกสาร อ้างอิง') || text.startsWith('แหล่งข้อมูลอ้างอิง') ||
        text.startsWith('参考') || text.toLowerCase().includes('reference'))) {
      inReferencesSection = true;
      $el.attr('data-skip-year-replace', 'true');
    }
    // Check if this is a summary/conclusion heading (marks end of references)
    else if ((tagName === 'h2' || tagName === 'h3') &&
      (text.startsWith('สรุป') || text.startsWith('总结') ||
        text.toLowerCase().startsWith('summary') || text.toLowerCase().startsWith('conclusion'))) {
      inReferencesSection = false;
    }
    // Mark lists in references section
    else if (inReferencesSection && (tagName === 'ul' || tagName === 'ol')) {
      $el.attr('data-skip-year-replace', 'true');
    }
    // Mark list items in references section
    else if (inReferencesSection && tagName === 'li') {
      $el.attr('data-skip-year-replace', 'true');
    }
    // Mark paragraphs with 'references' class
    else if ($el.hasClass('references')) {
      $el.attr('data-skip-year-replace', 'true');
    }
  });

  // Now replace [current_year] except in marked elements
  $('*').each((_, el) => {
    const $el = $(el);

    // Skip if this element or any parent has data-skip-year-replace attribute
    if ($el.attr('data-skip-year-replace') === 'true' || $el.closest('[data-skip-year-replace="true"]').length > 0) {
      return;
    }

    $el.contents().each((_, node) => {
      if (node.type === 'text' && node.data) {
        // Replace [current_year] with actual year
        node.data = node.data.replace(/\[current_year\]/gi, currentYear.toString());
      }
    });
  });

  // Clean up temporary attributes
  $('[data-skip-year-replace]').removeAttr('data-skip-year-replace');

  return $.html();
}

/**
 * Get website-specific footer block
 * Based on Home.jsx footer logic
 */
function getWebsiteFooter(website) {
  const footers = {
    'vsquareclinic.com': '\n<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->\n\n<!-- wp:block {"ref":66914} /-->',
    'vsqclinic.com': '\n<!-- wp:block {"ref":16702} /-->',
    'vsquareconsult.com': '\n<!-- wp:block {"ref":34903} /-->',
    'vsquare-under-eye.com': '\n<!-- wp:block {"ref":8916} /-->',
    'vsquareclinic.co': '\n<!-- wp:block {"ref":148} /-->',
    'vsq-injector.com': '\n<!-- wp:block {"ref":170} /-->',
    'en.vsquareclinic.com': '\n<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->\n\n<!-- wp:block {"ref":66914} /-->',
    'cn.vsquareclinic.com': '\n<!-- wp:block {"ref":16702} /-->'
  };

  // Normalize website by removing www. prefix
  const normalizedWebsite = website ? website.replace(/^www\./, '') : '';
  return footers[normalizedWebsite] || '';
}

/**
 * Check if website should have trailing separator removed
 */
function shouldRemoveTrailingSeparator(website) {
  const websitesWithoutSeparator = [
    'vsquareconsult.com',
    'vsquareclinic.co',
    'vsq-injector.com',
    'vsquare.clinic',
    'vsqclinic.com',
    'drvsquare.com',
    'doctorvsquareclinic.com',
    'bestbrandclinic.com',
    'monghaclinic.com'
  ];
  // Normalize website by removing www. prefix
  const normalizedWebsite = website ? website.replace(/^www\./, '') : '';
  return websitesWithoutSeparator.includes(normalizedWebsite);
}

/**
 * Main conversion function
 */
export function convert(inputHtml, options = {}) {
  const startTime = performance.now();
  const warnings = [];
  const errors = [];
  let policiesTriggered = [];

  try {
    // Step 1: Extract styles
    const cssMap = extractStyles(inputHtml);

    // Step 2: Clean HTML (pass cssMap for italic/bold detection from CSS classes)
    const forbiddenTags = options.policies?.forbiddenTags?.enabled
      ? options.policies.forbiddenTags.tags
      : defaultPolicyConfig.forbiddenTags.tags;

    const { html: cleanedHtml, removed } = cleanHTML(inputHtml, forbiddenTags, cssMap);
    if (removed.length > 0) {
      warnings.push(`ลบแท็กที่ไม่ต้องการ: ${removed.join(', ')}`);
    }

    // Step 3: Inline styles (if enabled)
    let processedHtml = cleanedHtml;
    if (options.inlineStyles !== false) {
      processedHtml = inlineStyles(cleanedHtml, cssMap);
    }

    // Step 4: Apply policies
    const policyConfig = {
      ...defaultPolicyConfig,
      ...options.policies
    };
    const policyResult = applyPolicies(processedHtml, policyConfig);
    processedHtml = policyResult.html;
    policiesTriggered = policyResult.triggered;
    warnings.push(...policyResult.warnings);

    // Step 5: Convert to Gutenberg
    let { html: gutenbergHtml, blockCount } = convertToGutenberg(processedHtml, options.website);

    // Step 5b: Convert phone numbers before external-link processing
    gutenbergHtml = convertPhoneNumbers(gutenbergHtml);

    // Step 5c: Replace [current_year] with actual year (skip references section)
    gutenbergHtml = replaceCurrentYear(gutenbergHtml);

    // Step 6: Process external links (if website is specified)
    if (options.website) {
      gutenbergHtml = processLinks(gutenbergHtml, options.website);
    }

    // Step 7: Remove trailing separator for specific websites
    if (options.website && shouldRemoveTrailingSeparator(options.website)) {
      gutenbergHtml = gutenbergHtml.replace(/<!-- wp:separator -->\s*<hr class="wp-block-separator[^"]*"\/?>\s*<!-- \/wp:separator -->\s*$/gi, '');
    }

    // Step 7b: For vsquareconsult.com, remove separator after references list
    if (options.website === 'vsquareconsult.com') {
      // Remove separator that appears after a list block following references paragraph
      gutenbergHtml = gutenbergHtml.replace(
        /(<!-- \/wp:list -->\s*)\n*<!-- wp:separator -->\s*<hr class="wp-block-separator[^"]*"\s*\/?>\s*<!-- \/wp:separator -->/gi,
        '$1'
      );

      // Remove separator that appears immediately before <!-- wp:block {"ref":34903} /-->
      gutenbergHtml = gutenbergHtml.replace(
        /<!-- wp:separator -->\s*<hr class="wp-block-separator[^"]*"\s*\/?>\s*<!-- \/wp:separator -->\s*\n*(<!-- wp:block \{"ref":34903\} \/-->)/gi,
        '$1'
      );
    }

    // Step 7c: For bestbrandclinic.com and monghaclinic.com, special processing
    const isSpecialDomain = options.website === 'bestbrandclinic.com' || options.website === 'monghaclinic.com';
    if (isSpecialDomain) {
      // Remove separator that appears after H2 "สรุป" (summary) heading with class subtext-gtb
      // This regex handles intermediate paragraph blocks between the heading and the separator.
      gutenbergHtml = gutenbergHtml.replace(
        /(<h2 class="[^"]*subtext-gtb[^"]*">[\s\S]*?<\/h2><!-- \/wp:heading -->(?:(?!<!-- wp:heading)[\s\S])*?)<!-- wp:separator -->\s*<hr class="wp-block-separator[^"]*"\s*\/?\s*>\s*<!-- \/wp:separator -->/gi,
        '$1'
      );

      // Remove separator that appears after the last paragraph block at the end
      gutenbergHtml = gutenbergHtml.replace(
        /(<!-- \/wp:paragraph -->\s*)\n*<!-- wp:separator -->\s*<hr class="wp-block-separator[^"]*"\s*\/?\s*>\s*<!-- \/wp:separator -->(\s*)$/gi,
        '$1$2'
      );
    }

    // Step 8: Add website-specific footer
    if (options.website) {
      let footer = getWebsiteFooter(options.website);

      // Special condition for cn.vsquareclinic.com: add separator if no references found in content
      const normalizedWebsite = options.website.replace(/^www\./, "");
      if (normalizedWebsite === "cn.vsquareclinic.com" && !gutenbergHtml.includes('class="references"')) {
        footer = "\n<!-- wp:separator -->\n<hr class=\"wp-block-separator has-alpha-channel-opacity\">\n<!-- /wp:separator -->\n" + footer;
      }

      if (footer) {
        gutenbergHtml = gutenbergHtml.trim() + footer;
      }
    }

    // Step 9: Clean up - remove empty paragraphs, duplicate separators, and fix formatting
    gutenbergHtml = gutenbergHtml
      // Remove html/head/body tags that Cheerio may add
      .replace(/<html[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<head[^>]*>.*?<\/head>/gis, '')
      .replace(/<body[^>]*>/gi, '')
      .replace(/<\/body>/gi, '')
      // Fix self-closing hr tags FIRST (before duplicate separator check)
      .replace(/<hr([^>]*?)\/>/gi, '<hr$1>')
      // Remove style attributes from anchor tags (color: inherit, text-decoration: inherit, etc.)
      .replace(/<a\s+style="[^"]*"\s+href=/gi, '<a href=')
      .replace(/<a\s+href="([^"]*)"\s+style="[^"]*"/gi, '<a href="$1"')
      .replace(/<a\s+href="([^"]*)"\s+style='[^']*'/gi, '<a href="$1"')
      .replace(/<p>\s*(<!--[^>]*-->)\s*<\/p>/gi, '$1')  // Remove <p> wrapping comments
      .replace(/<p>\s*<\/p>/gi, '')  // Remove empty paragraphs
      // Normalize multiple newlines BEFORE duplicate separator check
      .replace(/(\n\s*){3,}/g, '\n\n')
      // Remove duplicate/consecutive separators (keep only one)
      .replace(/(<!-- wp:separator\s*[^>]*-->\s*<hr[^>]*>\s*<!-- \/wp:separator -->\s*){2,}/gi,
        '<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->\n\n')
      // Remove wp-block-list class from ul/ol (WordPress adds this automatically, we shouldn't output it)
      .replace(/<(ul|ol)\s+class="wp-block-list\s+/gi, '<$1 class="')
      .replace(/<(ul|ol)\s+class="wp-block-list"/gi, '<$1')  // Remove empty class if wp-block-list was the only class
      .replace(/<(ul|ol)\s+class="\s+/gi, '<$1 class="')
      .replace(/<(ul|ol)\s+class=""/gi, '<$1')  // Remove empty class attribute
      // Fix any remaining self-closing hr tags
      .replace(/<hr([^>]*?)\/>/gi, '<hr$1>')
      // Remove redundant colspan="1" and rowspan="1" from table cells (handle various positions)
      .replace(/\s*colspan="1"\s*/gi, ' ')
      .replace(/\s*rowspan="1"\s*/gi, ' ')
      .replace(/<(td|th)\s+/gi, '<$1 ')  // Normalize spacing after td/th
      .replace(/ {2,}/g, ' ')  // Remove double spaces (preserve newlines)
      .trim();

    // Step 10: Remove separator immediately before footer ref block for specific websites (FINAL step)
    if (options.website) {
      const normalizedSite = options.website.replace(/^www\./, '');

      // vsquareconsult.com - remove separator before ref:34903
      if (normalizedSite === 'vsquareconsult.com') {
        gutenbergHtml = gutenbergHtml.replace(
          /<!-- wp:separator[^>]*-->\s*<hr[^>]*>\s*<!-- \/wp:separator -->\s*(?=<!-- wp:block \{"ref":34903\} \/-->)/gi,
          ''
        );
      }

      // vsquareclinic.co - remove separator before ref:148
      if (normalizedSite === 'vsquareclinic.co') {
        gutenbergHtml = gutenbergHtml.replace(
          /<!-- wp:separator[^>]*-->\s*<hr[^>]*>\s*<!-- \/wp:separator -->\s*(?=<!-- wp:block \{"ref":148\} \/-->)/gi,
          ''
        );
      }
    }

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
