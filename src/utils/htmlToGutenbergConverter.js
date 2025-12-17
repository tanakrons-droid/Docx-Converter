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
      if (/font-style\s*:\s*italic/i.test(classStyle)) {
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
    
    // For td cells: skip if cell contains an image (we already handled Alt text above)
    if (el.tagName.toLowerCase() === 'td') {
      const hasImage = $el.find('img').length > 0;
      if (hasImage) {
        return; // Don't remove td cells that have images
      }
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
  
  // ===== MERGE AND NEST GOOGLE DOCS LISTS =====
  // IMPORTANT: This must run BEFORE merging consecutive lists to preserve level information
  // Google Docs creates separate <ul> elements with level in class (e.g., lst-kix_xxx-0, lst-kix_xxx-1)
  // We need to: 1) Merge lists with same ID, 2) Create nested structure based on levels
  
  // First pass: collect all lists with their IDs and levels (store element references)
  const listGroups = new Map(); // listId -> [{ el, level, items }]
  const allLists = $('ul, ol').toArray();
  
  allLists.forEach((listEl) => {
    const $list = $(listEl);
    const listClass = $list.attr('class') || '';
    
    // Check if this is a Google Docs list (level is in <ul> class, not <li>)
    const listIdMatch = listClass.match(/lst-kix_([a-z0-9_]+)-(\d+)/i);
    if (!listIdMatch) return;
    
    const listId = listIdMatch[1];
    const level = parseInt(listIdMatch[2], 10);
    
    // Collect items from this list
    const items = [];
    $list.children('li').each((_, li) => {
      items.push({
        html: $(li).html() || '',
        level: level
      });
    });
    
    if (!listGroups.has(listId)) {
      listGroups.set(listId, []);
    }
    listGroups.get(listId).push({ el: listEl, $list, level, items, listClass });
  });
  
  // Second pass: merge and nest lists for each group
  // IMPORTANT: Only merge lists that are CONSECUTIVE (no content between them)
  listGroups.forEach((lists) => {
    if (lists.length === 0) return;
    
    // Group lists into consecutive segments (lists separated by content should not merge)
    const consecutiveGroups = [];
    let currentGroup = [lists[0]];
    
    for (let i = 1; i < lists.length; i++) {
      const prevList = lists[i - 1];
      const currList = lists[i];
      
      // Check if there's any significant content between these two lists
      let $next = prevList.$list.next();
      let hasContentBetween = false;
      
      while ($next.length > 0 && $next.get(0) !== currList.el) {
        // Check if this is significant content (not empty, not whitespace)
        const isEmptyOrWhitespace = !$next.text().trim() && $next.find('img').length === 0;
        const isBr = $next.is('br');
        
        if (!isEmptyOrWhitespace && !isBr) {
          // There's content between lists - check if it's an image or paragraph with content
          if ($next.is('p, img, figure, div, table, h1, h2, h3, h4, h5, h6')) {
            hasContentBetween = true;
            break;
          }
        }
        $next = $next.next();
      }
      
      if (hasContentBetween) {
        // Start new group - don't merge across content boundaries
        consecutiveGroups.push(currentGroup);
        currentGroup = [currList];
      } else {
        // Add to current group - these are consecutive
        currentGroup.push(currList);
      }
    }
    consecutiveGroups.push(currentGroup);
    
    // Process each consecutive group separately
    consecutiveGroups.forEach((groupLists) => {
      if (groupLists.length === 0) return;
      
      // Collect all items with their levels in order
      const allItems = [];
      groupLists.forEach(({ items }) => {
        allItems.push(...items);
      });
      
      // Check if there are any nested items
      const hasNestedItems = allItems.some(item => item.level > 0);
      if (!hasNestedItems && groupLists.length === 1) return;
    
      // Build nested structure
      const buildNestedList = (items, startIndex, parentLevel) => {
        const result = [];
        let i = startIndex;
        
        while (i < items.length) {
          const item = items[i];
          
          if (item.level < parentLevel) {
            break;
          }
          
          if (item.level === parentLevel) {
            // Check if next items are children
            let j = i + 1;
            while (j < items.length && items[j].level > parentLevel) {
              j++;
            }
            
            if (j > i + 1) {
              // Has children
              const sublistHtml = buildNestedList(items, i + 1, parentLevel + 1);
              result.push({ html: item.html, sublist: sublistHtml });
              i = j;
            } else {
              result.push({ html: item.html, sublist: null });
              i++;
            }
          } else {
            // Item at higher level - process as part of sublist
            i++;
          }
        }
        
        return result;
      };
      
      const nestedItems = buildNestedList(allItems, 0, 0);
      
      // Rebuild list HTML with proper nesting
      const listTag = groupLists[0].$list.is('ol') ? 'ol' : 'ul';
      
      const buildListHtml = (items) => {
        return items.map(item => {
          if (item.sublist && item.sublist.length > 0) {
            const sublistHtml = `<${listTag}>${buildListHtml(item.sublist)}</${listTag}>`;
            return `<li>${item.html}${sublistHtml}</li>`;
          }
          return `<li>${item.html}</li>`;
        }).join('');
      };
      
      const newListHtml = buildListHtml(nestedItems);
      
      // Update first list with new nested content, remove others
      groupLists[0].$list.html(newListHtml);
      
      // Remove other lists in this group
      for (let i = 1; i < groupLists.length; i++) {
        $(groupLists[i].el).remove();
      }
    });
  });

  // ===== MERGE CONSECUTIVE TOC LISTS WITH LEVEL AWARENESS =====
  // This handles cases where TOC lists have different listIds but should be nested
  $('p').each((_, pEl) => {
    const $p = $(pEl);
    const pText = $p.text().trim();
    
    // Check if this is a TOC header
    if (pText.startsWith('สารบัญ')) {
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
  // Check both style attribute, innerHTML, AND CSS classes for font-weight/font-style
  $('*').each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName ? el.tagName.toLowerCase() : '';
    
    // Skip certain tags (including 'a' to prevent underline on links)
    if (['html', 'head', 'body', 'script', 'style', 'strong', 'b', 'em', 'i', 'u', 'a'].includes(tagName)) return;
    
    let style = $el.attr('style') || '';
    let html = $el.html() || '';
    const text = $el.text().trim();
    let styleChanged = false;
    
    // Check for font-weight in style attribute, innerHTML, OR CSS class
    const hasBoldInStyle = /font-weight\s*:\s*(bold|bolder|[5-9]00)/i.test(style);
    const hasBoldInHtml = /font-weight\s*:\s*(bold|bolder|[5-9]00)/i.test(html);
    const hasBoldInClass = hasBoldFromClass($el);
    
    if ((hasBoldInStyle || hasBoldInHtml || hasBoldInClass) && text && !html.includes('<strong>') && !html.includes('<b>')) {
      // If the element itself has bold style (inline or from class), wrap content
      if (hasBoldInStyle || hasBoldInClass) {
        html = `<strong>${html}</strong>`;
        styleChanged = true;
      }
      // Remove font-weight from style
      style = style.replace(/font-weight\s*:\s*[^;]+;?/gi, '');
    }
    
    // Check for font-style: italic in style attribute, innerHTML, OR CSS class
    const hasItalicInStyle = /font-style\s*:\s*italic/i.test(style);
    const hasItalicInHtml = /font-style\s*:\s*italic/i.test(html);
    const hasItalicInClass = hasItalicFromClass($el);
    
    if ((hasItalicInStyle || hasItalicInHtml || hasItalicInClass) && text && !html.includes('<em>') && !html.includes('<i>')) {
      if (hasItalicInStyle || hasItalicInClass) {
        html = `<em>${html}</em>`;
        styleChanged = true;
      }
      // Remove font-style from style
      style = style.replace(/font-style\s*:\s*[^;]+;?/gi, '');
    }
    
    // Check for text-decoration: underline in style attribute, innerHTML, OR CSS class
    // BUT skip if the element contains or is a link (links should not be underlined with <u>)
    const hasUnderlineInStyle = /text-decoration[^:]*:\s*[^;]*underline/i.test(style);
    const hasUnderlineInHtml = /text-decoration[^:]*:\s*[^;]*underline/i.test(html);
    const hasUnderlineInClass = hasUnderlineFromClass($el);
    const containsLink = $el.find('a').length > 0 || html.includes('<a ');
    
    if ((hasUnderlineInStyle || hasUnderlineInHtml || hasUnderlineInClass) && text && !html.includes('<u>') && !containsLink) {
      if (hasUnderlineInStyle || hasUnderlineInClass) {
        html = `<u>${html}</u>`;
        styleChanged = true;
      }
      // Remove text-decoration from style (only underline part)
      style = style.replace(/text-decoration[^:]*:\s*[^;]*underline[^;]*;?/gi, '');
    }
    
    // Apply changes
    if (styleChanged) {
      $el.html(html);
    }
    
    style = style.trim();
    if (style) {
      $el.attr('style', style);
    } else if ($el.attr('style') !== undefined) {
      $el.removeAttr('style');
    }
  });
  
  // Second pass: Process spans with style containing font-weight/font-style in innerHTML
  // This handles cases where the style is on a child element
  $('span[style]').each((_, el) => {
    const $el = $(el);
    let style = $el.attr('style') || '';
    let html = $el.html() || '';
    const text = $el.text().trim();
    let changed = false;
    
    // Bold
    if (/font-weight\s*:\s*(bold|bolder|[5-9]00)/i.test(style)) {
      if (text && !html.includes('<strong>') && !html.includes('<b>')) {
        html = `<strong>${html}</strong>`;
        changed = true;
      }
      style = style.replace(/font-weight\s*:\s*[^;]+;?/gi, '');
    }
    
    // Italic
    if (/font-style\s*:\s*italic/i.test(style)) {
      if (text && !html.includes('<em>') && !html.includes('<i>')) {
        html = `<em>${html}</em>`;
        changed = true;
      }
      style = style.replace(/font-style\s*:\s*[^;]+;?/gi, '');
    }
    
    // Underline (but skip if contains a link)
    const containsLink = $el.find('a').length > 0 || html.includes('<a ');
    if (/text-decoration[^:]*:\s*[^;]*underline/i.test(style)) {
      if (text && !html.includes('<u>') && !containsLink) {
        html = `<u>${html}</u>`;
        changed = true;
      }
      style = style.replace(/text-decoration[^:]*:\s*[^;]*underline[^;]*;?/gi, '');
    }
    
    if (changed) {
      $el.html(html);
    }
    
    style = style.trim();
    if (style) {
      $el.attr('style', style);
    } else {
      $el.removeAttr('style');
    }
  });

  // Unwrap ALL spans - replace with their content (after font-weight processing)
  // Process innermost spans first to preserve nested strong/em tags
  const unwrapSpans = () => {
    let changed = false;
    $('span').each((_, el) => {
      const $el = $(el);
      // Only unwrap if this span doesn't contain other spans
      if ($el.find('span').length === 0) {
        $el.replaceWith($el.html() || '');
        changed = true;
      }
    });
    return changed;
  };
  while (unwrapSpans()) { /* keep unwrapping */ }

  // Remove data attributes and clean up styles
  $('[data-docs-internal-guid]').removeAttr('data-docs-internal-guid');
  $('*').each((_, el) => {
    const $el = $(el);
    const attrs = el.attribs || {};
    Object.keys(attrs).forEach(attr => {
      if (attr.startsWith('data-')) {
        $el.removeAttr(attr);
      }
    });
    
    // Remove font-size and other unwanted styles (but keep font-weight for paragraph processing)
    const style = $el.attr('style');
    if (style) {
      const cleanedStyle = style
        .replace(/font-size\s*:\s*[^;]+;?/gi, '')
        .replace(/line-height\s*:\s*[^;]+;?/gi, '')
        .replace(/font-family\s*:\s*[^;]+;?/gi, '')
        .replace(/color\s*:\s*inherit;?/gi, '')
        .replace(/text-decoration\s*:\s*inherit;?/gi, '')
        // Note: font-weight is NOT removed here - it will be processed in paragraph case
        .trim();
      if (cleanedStyle) {
        $el.attr('style', cleanedStyle);
      } else {
        $el.removeAttr('style');
      }
    }
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
  
  // Clean up &nbsp; - replace multiple with single space, remove standalone
  let htmlContent = $('body').length > 0 ? $('body').html() : $.html();
  htmlContent = htmlContent
    .replace(/(&nbsp;\s*)+/g, ' ')  // Replace multiple &nbsp; with single space
    .replace(/>\s*&nbsp;\s*</g, '> <')  // Clean &nbsp; between tags
    .replace(/&nbsp;/g, ' ')  // Replace remaining &nbsp; with space
    .replace(/\s+/g, ' ')  // Normalize multiple spaces
    .trim();

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
function isDefaultColor(color) {
  const defaultColors = [
    '#000000', '#000', 'black', 'rgb(0, 0, 0)', 'rgb(0,0,0)',
    '#212121', 'rgb(33, 33, 33)', 'rgb(33,33,33)' // Google Docs default
  ];
  return defaultColors.includes(color.toLowerCase().trim());
}

/**
 * Extract alignment and generate Gutenberg classes
 */
function getAlignmentFromStyle(style) {
  const alignMatch = style.match(/text-align:\s*(center|right|left|justify)/i);
  const align = alignMatch ? alignMatch[1].toLowerCase() : null;
  const className = align && align !== 'left' ? `has-text-align-${align}` : '';
  return { align, className };
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
  
  if (color && !isDefaultColor(color)) {
    classes.push('has-text-color');
    classes.push('has-link-color');
    styles.push(`color: ${color}`);
    textColor = color;
  }
  
  if (bgColor && bgColor !== 'transparent' && bgColor !== 'none') {
    classes.push('has-background');
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
 * Create YouTube embed block
 * Caption styling follows original - only italic if source was italic
 * @param {string} url - YouTube URL
 * @param {string} caption - Caption text
 * @param {boolean} isItalic - Whether caption should be italic (from source)
 */
function createYouTubeEmbedBlock(url, caption, isItalic = false) {
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
    // Only wrap in <em> if source was italic
    if (isItalic) {
      content += `<figcaption class="wp-element-caption"><em>${captionHtml}</em></figcaption>`;
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
  return alt.replace(/^alt:\s*/i, '').trim();
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
  const col1Id = generateKadenceUniqueId();
  const col2Id = generateKadenceUniqueId();
  
  // For 2 images - use the new format
  if (images.length === 2) {
    return `<!-- wp:kadence/rowlayout {"uniqueID":"${uniqueId}","colLayout":"equal","firstColumnWidth":0,"secondColumnWidth":0,"thirdColumnWidth":0,"fourthColumnWidth":0,"fifthColumnWidth":0,"sixthColumnWidth":0,"kbVersion":2} -->

<!-- wp:kadence/column {"borderWidth":["","","",""],"uniqueID":"${col1Id}","kbVersion":2} -->

<div class="wp-block-kadence-column kadence-column${col1Id}"><div class="kt-inside-inner-col"><!-- wp:image -->

<figure class="wp-block-image"><img alt=""/></figure>

<!-- /wp:image --></div></div>

<!-- /wp:kadence/column -->

<!-- wp:kadence/column {"id":2,"borderWidth":["","","",""],"uniqueID":"${col2Id}","kbVersion":2} -->

<div class="wp-block-kadence-column kadence-column${col2Id}"><div class="kt-inside-inner-col"><!-- wp:image -->

<figure class="wp-block-image"><img alt=""/></figure>

<!-- /wp:image --></div></div>

<!-- /wp:kadence/column -->

<!-- /wp:kadence/rowlayout -->`;
  }
  
  // For 3+ images - use similar format with more columns
  const columns = images.length;
  let innerBlocks = '';
  
  images.forEach((img, index) => {
    const colId = generateKadenceUniqueId();
    const idAttr = index === 0 ? '' : `"id":${index + 1},`;
    
    innerBlocks += `<!-- wp:kadence/column {${idAttr}"borderWidth":["","","",""],"uniqueID":"${colId}","kbVersion":2} -->

<div class="wp-block-kadence-column kadence-column${colId}"><div class="kt-inside-inner-col"><!-- wp:image -->

<figure class="wp-block-image"><img alt=""/></figure>

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
  if (trimmedText.startsWith('สารบัญ') || trimmedText.startsWith('คลิกอ่านหัวข้อ')) {
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
      trimmedText.startsWith('แหล่งข้อมูลอ้างอิง')) {
    return { class: 'references', addSeparator: true };
  }
  
  // Headline - บทความเจาะลึก/บทความแนะนำ
  if (trimmedText === 'บทความเจาะลึก' || trimmedText === 'บทความแนะนำ') {
    return { class: 'headline', addSeparator: false, align: 'center' };
  }
  
  // ข้อควรรู้ - special quote block (check BEFORE general quote detection)
  // Check if text contains \"ข้อควรรู้\" with quote marks at beginning and end
  const containsKnowledgeQuote = trimmedText.includes('\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e23\u0e23\u0e39\u0e49');
  if (containsKnowledgeQuote) {
    // Check if surrounded by any type of quote marks
    const firstChar = trimmedText.charAt(0);
    const lastChar = trimmedText.charAt(trimmedText.length - 1);
    const quoteChars = ['"', '\u201C', '\u201D', "'", '\u2018', '\u2019'];
    const hasQuoteMarks = quoteChars.includes(firstChar) && quoteChars.includes(lastChar);
    return { isQuote: true, isKnowledgeQuote: true, hasQuoteMarks: hasQuoteMarks };
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
  if (/^(Alt|alt|ALT)\s*:\s*/i.test(trimmedText) ||
      /\b(Alt|alt|ALT)\s*:\s*/i.test(trimmedText) ||
      trimmedText.startsWith('(alt') ||
      trimmedText.startsWith('(Alt') ||
      trimmedText.startsWith('(ALT')) {
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
 */
function generateHashId(text) {
  return text
    .replace(/<\/?[^>]+(>|$)/g, '')  // Remove HTML tags first
    .toLowerCase()
    .replace(/\?/g, '')
    .replace(/\./g, '')
    .replace(/:/g, '')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/&amp;/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\u0E00-\u0E7Fa-z0-9-]/g, '');
}

/**
 * Check if element is explicitly centered
 * Based on Home.jsx isExplicitCentered function
 */
function isExplicitCentered(style, className) {
  const styleLower = (style || '').toLowerCase();
  const classLower = (className || '').toLowerCase();
  
  return (
    /(^|;)\s*text-align\s*:\s*center\b/.test(styleLower) ||
    /(^|;)\s*mso-text-align\s*:\s*center\b/.test(styleLower) ||
    /\bhas-text-align-center\b/.test(classLower) ||
    /\btext-center\b/.test(classLower)
  );
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
      trimmedText.startsWith('คำถามที่พบบ่อย') || 
      trimmedText.includes('FAQ') ||
      (trimmedText.includes('คำถาม') && trimmedText.includes('คำตอบ')) ||
      (trimmedText.startsWith('คำถาม') && trimmedText.includes('ที่พบบ่อย'))) {
    return { class: 'label-heading', align: 'center' };
  }
  
  // สรุป heading
  if (trimmedText === 'สรุป' || trimmedText.startsWith('สรุป')) {
    return { class: 'subtext-gtb', addSeparator: true };
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

  // Pre-process: Convert H:1, H:2, H:3 indicators to actual headings
  // Based on Home.jsx logic
  $('p').each((_, p) => {
    const $p = $(p);
    const text = $p.text().trim();
    
    // Check if paragraph starts with H:1, H:2, H:3, H:4, H:5, or H:6
    const headingMatch = text.match(/^H\s*:\s*([1-6])\s+(.+)$/i);
    if (headingMatch) {
      const level = headingMatch[1];
      const headingText = headingMatch[2].trim();
      
      // Replace paragraph with heading
      $p.replaceWith(`<h${level}>${headingText}</h${level}>`);
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
  
  // Pre-process: Find YouTube links and collect their caption paragraphs
  // Map<youtubeUrl, { text: string, isItalic: boolean, elements: Element[] }>
  const youtubeCaptions = new Map();
  $('p').each((_, pEl) => {
    const $p = $(pEl);
    const pText = $p.text().trim();
    
    // Check if this paragraph contains a YouTube link
    // Support: https://, http://, // (protocol-relative), and without protocol
    let youtubeMatch = pText.match(/((?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]+[^\s]*)/i);
    
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
    
    // Helper to check if paragraph has italic styling (font-style: italic in p or children)
    const hasItalicStyle = ($para) => {
      const paraStyle = $para.attr('style') || '';
      const paraHtml = $para.html() || '';
      
      // Check p tag style
      if (/font-style\s*:\s*italic/i.test(paraStyle)) return true;
      
      // Check children with font-style: italic
      const hasItalicChild = $para.find('[style*="font-style"]').filter((_, el) => {
        const style = $(el).attr('style') || '';
        return /font-style\s*:\s*italic/i.test(style);
      }).length > 0;
      
      // Check for <em> or <i> tags
      const hasItalicTag = paraHtml.includes('<em>') || paraHtml.includes('<i>') ||
                          $para.find('em, i').length > 0;
      
      return hasItalicChild || hasItalicTag;
    };
    
    // Helper to check if paragraph is caption-like (centered or italic)
    const isCaptionParagraph = ($para) => {
      if (!$para || $para.length === 0) return false;
      
      const paraText = $para.text().trim();
      if (!paraText || paraText.length === 0 || paraText.length > 200) return false;
      
      // Skip special content
      if (paraText.startsWith('สารบัญ') || paraText.startsWith('อ้างอิง') ||
          paraText.startsWith('สรุป') || paraText.startsWith('Q&A') ||
          /^(Alt|alt|ALT)\s*:/i.test(paraText) ||
          /^H\s*:\s*[1-6]/i.test(paraText)) {
        return false;
      }
      
      // Skip paragraphs that contain URLs (they are not captions)
      if (/https?:\/\//i.test(paraText) || $para.find('a[href]').length > 0) {
        return false;
      }
      
      const paraStyle = $para.attr('style') || '';
      const paraClass = $para.attr('class') || '';
      const paraHtml = $para.html() || '';
      
      // Check italic - font-style: italic in p or children, or <em>/<i> tags
      const isItalicInStyle = /font-style\s*:\s*italic/i.test(paraStyle);
      const hasItalicChild = $para.find('[style*="font-style"]').filter((_, el) => {
        const style = $(el).attr('style') || '';
        return /font-style\s*:\s*italic/i.test(style);
      }).length > 0;
      const hasItalicTag = paraHtml.includes('<em>') || paraHtml.includes('<i>');
      const isItalic = isItalicInStyle || hasItalicChild || hasItalicTag;
      
      // Check centered - multiple patterns
      const isCentered = /text-align\s*:\s*center/i.test(paraStyle) ||
                        paraClass.includes('text-center') || 
                        paraClass.includes('center') ||
                        paraClass.includes('has-text-align-center');
      
      return isItalic || isCentered;
    };
    
    // Helper to check if paragraph is alt text
    const isAltTextParagraph = ($para) => {
      const text = $para.text().trim();
      return /^(Alt|alt|ALT)\s*:/i.test(text) ||
             /\b(Alt|alt|ALT)\s*:\s*/i.test(text) ||
             text.startsWith('(alt') ||
             text.startsWith('(Alt') ||
             text.startsWith('(ALT');
    };
    
    // Collect caption text from following paragraphs
    // Also handle case: Alt: text → Caption (skip alt, collect caption)
    const captionTexts = [];
    const captionElements = []; // Store elements to skip later
    let hasAnyItalic = false;
    let nextEl = $p.next('p');
    while (nextEl.length > 0) {
      const nextText = nextEl.text().trim();
      
      // If it's alt text, skip it but continue looking for caption
      if (isAltTextParagraph(nextEl)) {
        skipParagraphs.add(nextEl.get(0)); // Mark for skipping
        nextEl = nextEl.next('p');
        continue;
      }
      
      // If it's a caption paragraph, collect it (but don't skip yet)
      if (isCaptionParagraph(nextEl)) {
        captionTexts.push(nextText);
        captionElements.push(nextEl.get(0)); // Store element for later skipping
        if (hasItalicStyle(nextEl)) {
          hasAnyItalic = true;
        }
        nextEl = nextEl.next('p');
      } else {
        // Not alt or caption, stop
        break;
      }
    }
    
    if (captionTexts.length > 0) {
      youtubeCaptions.set(youtubeUrl, {
        text: captionTexts.join('\n'),
        isItalic: hasAnyItalic,
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
    if (tagName === 'h2' && (
        headingText.includes('Q&A') || headingText.includes('Q&amp;A') || 
        headingText.includes('คำถามที่พบบ่อย') || headingText.includes('FAQ') ||
        (headingText.includes('คำถาม') && headingText.includes('คำตอบ')))) {
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
      
      // Stop at next H2 or สรุป heading
      if (tagName === 'h2' || headingText.startsWith('สรุป')) {
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
  }

  function processNode(node) {
    if (node.type === 'text') {
      const text = node.data?.trim();
      if (text) {
        blockCount++;
        return wrapBlock('paragraph', `<p>${text}</p>`);
      }
      return null;
    }

    if (node.type !== 'tag') return null;

    const element = node;
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
        
        // Remove <a> tags within headings (keep content)
        $el.find('a').each((_, a) => {
          const $a = $(a);
          $a.replaceWith($a.html());
        });
        
        let content = $el.html() || '';
        // Clean heading text - remove H:2, H2, Header 2, <H1>:, <H2>:, etc. patterns
        content = content
          .replace(/<H([1-5])>\s*:\s*/gi, '')  // <H1>:, <H2>:, <H3>:, <H4>:, <H5>:
          .replace(/&lt;H([1-5])&gt;\s*:\s*/gi, '')  // HTML entities: &lt;H1&gt;:, &lt;H2&gt;:, etc.
          .replace(/^H\s*:\s*[1-6]\s*/gi, '')  // H:2, H : 3
          .replace(/^:\s*/gi, '')  // Leading colon
          .replace(/1st/gi, '')
          .replace(/(?:h\s*[1-6]|h\s+[1-6]|header\s*tag\s*[1-6]|header\s*[1-6]) ?:?\s*/gi, '')  // h2, h 2, header tag 2, header 2
          .trim();
        
        // Remove leading colon again after other replacements
        while (content.startsWith(':')) {
          content = content.substring(1).trim();
        }
        
        if (!content.trim()) return null;
        
        const textOnly = content.replace(/<\/?[^>]+(>|$)/g, '').trim();
        
        // Skip headings with no meaningful text content (empty or only whitespace/symbols)
        if (!textOnly || textOnly.length === 0) return null;
        
        // Extract styles from element
        const style = $el.attr('style') || '';
        const elClass = $el.attr('class') || '';
        const isCentered = isExplicitCentered(style, elClass);
        
        // Check for special heading patterns
        const specialHeading = getSpecialHeadingClass(textOnly);
        
        // Build classes and attributes
        let classBlock = 'wp-block-heading';
        let attrLevel = level === 2 ? '' : `,"level":${level}`;
        let textAlignAttr = '';
        let extraClass = '';
        let blockSeparator = '';
        let blockTarget = '';
        
        // Generate hash ID for anchor
        const hashTagId = generateHashId(textOnly);
        
        if (specialHeading) {
          extraClass = specialHeading.class;
          if (specialHeading.align === 'center' || isCentered) {
            classBlock += ' has-text-align-center';
            textAlignAttr = '"textAlign":"center"';
          }
          // Note: specialHeading.addSeparator is handled below with H2/H3 logic
        } else if (isCentered) {
          classBlock += ' has-text-align-center';
          textAlignAttr = '"textAlign":"center"';
        }
        
        // Check if this H3 should have "headtext" class (between Q&A and สรุป)
        if (level === 3 && h3sWithHeadtext.has(element)) {
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
        // Rule: H2 always gets separator EXCEPT the first H2
        if (level === 2) {
          if (isFirstH2) {
            // If there were blocks before the first H2, still add separator
            if (blocks.length > 0) {
              blockSeparator = '<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->';
              if (hashTagId) {
                blockTarget = `<!-- wp:ps2id-block/target --><div class="wp-block-ps2id-block-target" id="${hashTagId}"></div><!-- /wp:ps2id-block/target -->`;
              }
            }
            isFirstH2 = false;
          } else {
            // All other H2: ALWAYS add separator
            blockSeparator = '<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->';
            // Add target only if hashTagId exists
            if (hashTagId) {
              blockTarget = `<!-- wp:ps2id-block/target --><div class="wp-block-ps2id-block-target" id="${hashTagId}"></div><!-- /wp:ps2id-block/target -->`;
            }
          }
        } else if (level === 3 && hashTagId) {
          // H3: only "สรุป" gets separator, but all get target
          if (textOnly === 'สรุป' || textOnly.startsWith('สรุป')) {
            blockSeparator = '<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->';
          }
          blockTarget = `<!-- wp:ps2id-block/target --><div class="wp-block-ps2id-block-target" id="${hashTagId}"></div><!-- /wp:ps2id-block/target -->`;
        }
        // H4, H5, H6: no separator, no target
        
        blockCount++;
        const headingBlock = `<!-- wp:heading${attrString} --><${tagName} class="${classBlock}">${textOnly}</${tagName}><!-- /wp:heading -->`;
        
        return `${blockSeparator}${blockTarget}${headingBlock}`;
      }

      case 'p': {
        // Skip paragraphs that were used as YouTube captions
        if (skipParagraphs.has(element)) {
          return null;
        }
        
        // Process styled spans in paragraph first
        $el.find('span[style]').each((_, span) => {
          const $span = $(span);
          const processedContent = processStyledContent($span, $);
          $span.replaceWith(processedContent);
        });
        
        const content = $el.html() || '';
        const textContent = $el.text().trim();
        if (!content.trim()) return null;
        
        const style = $el.attr('style') || '';
        const elClass = $el.attr('class') || '';
        
        // Check for YouTube links in paragraph (support protocol-relative URLs)
        // First check text content
        let youtubeMatch = textContent.match(/((?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]+[^\s]*)/i);
        
        // If not found in text, check href attributes of <a> tags (for Google Docs links)
        if (!youtubeMatch) {
          const $links = $el.find('a[href]');
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
        
        if (youtubeMatch) {
          const youtubeUrl = youtubeMatch[1];
          
          // Normalize URL for lookup (handle &amp; vs &)
          const normalizedUrl = youtubeUrl.replace(/&amp;/g, '&');
          
          // Get caption from pre-processed Map (try both original and normalized)
          let captionData = youtubeCaptions.get(youtubeUrl) || youtubeCaptions.get(normalizedUrl);
          let captionText = captionData?.text || '';
          let isItalic = captionData?.isItalic || false;
          
          // ถ้าไม่มี caption จาก next paragraphs ให้ดึงจากข้อความหลัง URL
          if (!captionText) {
            const afterUrl = textContent.substring(textContent.indexOf(youtubeUrl) + youtubeUrl.length).trim();
            if (afterUrl && /[\u0E00-\u0E7F]/.test(afterUrl)) {
              captionText = afterUrl;
              isItalic = false; // Text after URL is not italic
            }
          }
          
          const embedBlock = createYouTubeEmbedBlock(youtubeUrl, captionText || undefined, isItalic);
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
          prevSibling.is('figure') ||
          prevSibling.find('img').length > 0 ||
          prevSibling.html()?.includes('wp-block-image') ||
          prevSibling.html()?.includes('wp-block-embed')
        );
        
        // Check if previous sibling is a caption (centered/italic paragraph under image)
        // This allows multiple consecutive captions under an image
        const prevIsCaption = prevSibling.length > 0 && prevSibling.is('p') && (
          (prevSibling.attr('class') || '').includes('caption-img') ||
          (prevSibling.attr('class') || '').includes('text-center') ||
          (prevSibling.attr('class') || '').includes('has-text-align-center') ||
          /text-align\s*:\s*center/i.test(prevSibling.attr('style') || '')
        );
        
        // hasImgAbove is true if previous is image OR previous is a caption (which means image is above that)
        const hasImgAbove = prevIsImage || prevIsCaption;
        
        // If paragraph is under an image and contains alt text patterns, check for caption after it
        if (hasImgAbove) {
          const isAltText = /^(Alt|alt|ALT)\s*:/i.test(textContent) ||
                           /^\(alt|\(Alt|\(ALT/i.test(textContent) ||
                           /alt\s*text/i.test(textContent.toLowerCase());
          
          if (isAltText) {
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
                                nextClass.includes('center');
              
              // If next paragraph is italic or centered, not special content, and not too long → caption
              // Skip ข้อควรรู้ - it should be a quote block
              const isNextKnowledgeQuote = nextText.includes('ข้อควรรู้');
              if ((isItalic || isCentered) && nextText.length > 0 && nextText.length < 200 &&
                  !nextText.startsWith('สารบัญ') && !nextText.startsWith('อ้างอิง') &&
                  !/^(Alt|alt|ALT)\s*:/i.test(nextText) && !isNextKnowledgeQuote) {
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
          $el.find('em, i').length > 0
        );
        
        const isCenteredPara = /text-align\s*:\s*center/i.test(style) ||
                              elClass.includes('has-text-align-center') ||
                              elClass.includes('text-center');
        
        // Only create caption-img if NOT already in skipParagraphs (not used as figcaption)
        // AND if paragraph doesn't contain multiple images (those should be Kadence Row Layout)
        // AND if not "ข้อควรรู้" with surrounding quotes (should be quote block, not caption)
        // AND if not headline text (บทความแนะนำ, อ่านบทความเพิ่มเติม, etc.)
        const imgsInPara = $el.find('img');
        // Check for ข้อควรรู้ pattern - check if text contains ข้อควรรู้
        const isKnowledgeQuoteWithMarks = textContent.includes('ข้อควรรู้');
        // Check for headline text - these should NOT be caption-img
        const isHeadlineContent = textContent.includes('บทความแนะนำ') || 
                                  textContent.includes('โปรแนะนำ') || 
                                  textContent.includes('อ่านบทความเพิ่มเติม') ||
                                  textContent.includes('คลิกอ่านบทความ') ||
                                  textContent.includes('อ่านเพิ่มเติม') ||
                                  textContent.includes('บทความเจาะลึก');
        if ((isItalicPara || isCenteredPara) && hasImgAbove && !skipParagraphs.has(element) && imgsInPara.length === 0 && !isKnowledgeQuoteWithMarks && !isHeadlineContent) {
          // Check if the previous image already has this as figcaption
          // If so, skip creating a separate paragraph
          const prevHtml = prevSibling.html() || '';
          const currentText = textContent.trim();
          
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
        if (textContent.startsWith('อ้างอิง') || textContent.startsWith('เอกสารอ้างอิง') || 
            textContent.startsWith('เอกสาร อ้างอิง') || textContent.startsWith('แหล่งข้อมูลอ้างอิง')) {
          blockCount++;
          // Always add separator above references
          const separatorBlock = '<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->';
          const paragraphBlock = wrapBlock('paragraph', `<p class="references">${content}</p>`, { className: 'references' });
          return `${separatorBlock}${paragraphBlock}`;
        }
        
        // Check if paragraph starts with "Q :" or "Q:" under H2 Q&A - add headtext class
        if (/^Q\s*:/i.test(textContent)) {
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
        const isHeadlineText = textContent.includes('บทความแนะนำ') || 
                              textContent.includes('โปรแนะนำ') || 
                              textContent.includes('อ่านบทความเพิ่มเติม') ||
                              textContent.includes('คลิกอ่านบทความ') ||
                              textContent.includes('อ่านเพิ่มเติม') ||
                              textContent.includes('บทความเจาะลึก');
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
          const firstImageClone = firstImage.clone();
          const hasValidSrc = !!(firstImageClone.attr('src') || '').trim();
          const imageMarkup = '<img alt=""/>';

          // NEW: If paragraph ONLY contains image(s) (no meaningful text), treat as image block(s)
          // Get text content WITHOUT the HTML tags
          const $tempEl = $el.clone();
          $tempEl.find('img').remove(); // Remove all images
          // Don't remove span - just get text
          let textWithoutImg = $tempEl.text().trim();
          // Remove Alt text patterns
          textWithoutImg = textWithoutImg.replace(/Alt\s*:\s*[^\n]+/gi, '').trim();
          // Remove all whitespace
          textWithoutImg = textWithoutImg.replace(/\s+/g, '');
          const hasOnlyImages = textWithoutImg.length === 0;
          
          if (hasOnlyImages) {
            // Paragraph contains only images (no text)
            if (images.length === 1) {
              // Single image - look for caption paragraphs after this
              const allCaptionParagraphs = [];
              let allCaptionsHaveItalic = false;
              
              // Use nextAll to find all following siblings, then filter for p tags
              let nextP = $el.nextAll('p').first();
              while (nextP.length > 0) {
                const pStyle = nextP.attr('style') || '';
                const pHtml = nextP.html() || '';
                const pText = nextP.text().trim();
                
                // Check if centered
                const isCentered = /text-align\s*:\s*center/i.test(pStyle) ||
                                  nextP.attr('class')?.includes('has-text-align-center') ||
                                  nextP.attr('class')?.includes('text-center');
                
                // Check if italic
                const isItalic = /font-style\s*:\s*italic/i.test(pStyle) ||
                                pHtml.includes('<em>') || pHtml.includes('<i>') ||
                                nextP.find('em, i').length > 0;
                
                // Skip alt text
                if (/^(Alt|alt|ALT)\s*:/i.test(pText)) {
                  skipParagraphs.add(nextP.get(0));
                  nextP = nextP.nextAll('p').first();
                  continue;
                }
                
                // If centered or italic, and not special content → it's a caption
                if ((isCentered || isItalic) && pText.length > 0 && pText.length < 200 &&
                    !pText.startsWith('สารบัญ') && !pText.startsWith('อ้างอิง') &&
                    !pText.startsWith('สรุป') && !pText.startsWith('Q&A') &&
                    !/^H\s*:\s*[1-6]/i.test(pText)) {
                  allCaptionParagraphs.push(pText);
                  if (isItalic) allCaptionsHaveItalic = true;
                  skipParagraphs.add(nextP.get(0)); // Mark for skipping
                  nextP = nextP.nextAll('p').first();
                } else {
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
              images.each((_, img) => {
                imageData.push({
                  src: $(img).attr('src') || '',
                  alt: $(img).attr('alt') || ''
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
          
          // Helper function to check if text is alt text
          const isAltTextPattern = (text) => {
            return /^(Alt|alt|ALT)\s*:/i.test(text) ||
                   /^\(alt|\(Alt|\(ALT/i.test(text) ||
                   /alt\s*text/i.test(text.toLowerCase());
          };
          
          // Helper function to check if paragraph has italic style (font-style: italic in p or children)
          const hasItalicStyle = ($p) => {
            const pStyle = $p.attr('style') || '';
            const pHtml = $p.html() || '';
            
            // Check p tag style
            if (/font-style\s*:\s*italic/i.test(pStyle)) return true;
            
            // Check children with font-style: italic
            const hasItalicChild = $p.find('[style*="font-style"]').filter((_, el) => {
              const style = $(el).attr('style') || '';
              return /font-style\s*:\s*italic/i.test(style);
            }).length > 0;
            
            // Check for <em> or <i> tags
            const hasItalicTag = pHtml.includes('<em>') || pHtml.includes('<i>') ||
                                $p.find('em, i').length > 0;
            
            return hasItalicChild || hasItalicTag;
          };
          
          // Helper function to check if paragraph is italic (for caption detection)
          const isItalicParagraph = ($p) => {
            return hasItalicStyle($p);
          };
          
          // Helper function to check if not special content
          const isNotSpecialContent = (text) => {
            return text.length > 0 &&
                   text.length < 200 &&
                   !text.startsWith('สารบัญ') &&
                   !text.startsWith('อ้างอิง') &&
                   !text.startsWith('สรุป') &&
                   !text.startsWith('Q&A') &&
                   !/^H\s*:\s*[1-6]/i.test(text);
          };
          
          let captionIsItalic = false;
          
          // Helper function to check if paragraph is centered
          const isCenteredParagraph = ($p) => {
            const pStyle = $p.attr('style') || '';
            const pClass = $p.attr('class') || '';
            return /text-align\s*:\s*center/i.test(pStyle) ||
                   pClass.includes('text-center') ||
                   pClass.includes('center') ||
                   pClass.includes('has-text-align-center');
          };
          
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
                const isItalic = isItalicParagraph(afterAltP);
                const isCentered = isCenteredParagraph(afterAltP);
                
                // If italic or centered, and not special content → it's a caption
                if ((isItalic || isCentered) && isNotSpecialContent(afterAltText) && !isAltTextPattern(afterAltText)) {
                  caption = afterAltText;
                  captionIsItalic = isItalic;
                  skipParagraphs.add(afterAltP.get(0)); // Mark for skipping
                  afterAltP.remove();
                }
              }
            } else {
              // Check pattern: caption → alt (next is caption, next-next is alt)
              if (nextNextSibling && nextNextSibling.length > 0) {
                const nextNextText = nextNextSibling.text().trim();
                
                // If next-next is alt text, then next is caption
                if (isAltTextPattern(nextNextText) && isNotSpecialContent(nextText)) {
                  caption = nextText;
                  captionIsItalic = hasItalicStyle(nextSibling);
                  skipParagraphs.add(nextSibling.get(0)); // Mark for skipping
                  skipParagraphs.add(nextNextSibling.get(0)); // Mark alt text for skipping
                  nextSibling.remove();
                  nextNextSibling.remove(); // Remove alt text too
                }
              }
              
              // If no caption found yet, check if next is italic or centered (original logic)
              if (!caption && (isItalicParagraph(nextSibling) || isCenteredParagraph(nextSibling)) && isNotSpecialContent(nextText)) {
                caption = nextText;
                captionIsItalic = hasItalicStyle(nextSibling);
                skipParagraphs.add(nextSibling.get(0)); // Mark for skipping
                nextSibling.remove();
              }
            }
          }
          
          // Multiple images - create Kadence Row Layout
          if (images.length > 1) {
            const imageData = [];
            images.each((idx, img) => {
              const $img = $(img);
              imageData.push({
                src: $img.attr('src') || '',
                alt: cleanAltText($img.attr('alt') || ''),
                caption: idx === 0 ? caption : undefined
              });
            });
            blockCount++;
            
            // Check for caption paragraphs after images (centered/italic)
            // Collect all consecutive centered/italic paragraphs as caption
            const captionParagraphs = [];
            let captionHasItalic = false;
            let captionTextColor = null; // Store color from first caption paragraph
            let nextP = $el.nextAll('p').first();
            while (nextP.length > 0) {
              const pStyle = nextP.attr('style') || '';
              const pHtml = nextP.html() || '';
              const pText = nextP.text().trim();
              
              // Check if centered
              const isCentered = /text-align\s*:\s*center/i.test(pStyle);
              // Check if italic
              const isItalic = /font-style\s*:\s*italic/i.test(pStyle) ||
                              pHtml.includes('<em>') || pHtml.includes('<i>') ||
                              nextP.find('[style*="font-style: italic"]').length > 0 ||
                              nextP.find('em, i').length > 0;
              
              // Skip alt text
              if (/^(Alt|alt|ALT)\s*:/i.test(pText)) {
                skipParagraphs.add(nextP.get(0));
                nextP = nextP.nextAll('p').first();
                continue;
              }
              
              // Skip paragraphs with URLs (YouTube links, etc.) - they are not captions
              const hasUrlInCaption = /https?:\/\//i.test(pText) || nextP.find('a[href]').length > 0;
              
              if ((isCentered || isItalic) && pText.length > 0 && pText.length < 200 && !hasUrlInCaption) {
                captionParagraphs.push(pText);
                if (isItalic) captionHasItalic = true;
                // Extract color from first caption paragraph
                if (captionTextColor === null) {
                  const { textColor } = getColorStyles(pStyle);
                  captionTextColor = textColor;
                }
                skipParagraphs.add(nextP.get(0)); // Mark for skipping
                nextP = nextP.nextAll('p').first();
              } else {
                break;
              }
            }
            
            // If we have caption paragraphs, create caption-img block with color if available
            let captionBlock = '';
            if (captionParagraphs.length > 0) {
              const captionContent = captionParagraphs.join('<br>');
              const captionHtml = captionHasItalic ? `<em>${captionContent}</em>` : captionContent;
              
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
          
          // Add the first caption if exists
          if (caption) {
            allCaptionParagraphs.push(caption);
            if (captionIsItalic) allCaptionsHaveItalic = true;
          }
          
          // Check for additional caption paragraphs after the image
          let nextP = $el.nextAll('p').first();
          while (nextP.length > 0) {
            const pStyle = nextP.attr('style') || '';
            const pHtml = nextP.html() || '';
            const pText = nextP.text().trim();
            
            // Check if centered
            const isCentered = /text-align\s*:\s*center/i.test(pStyle) ||
                              nextP.attr('class')?.includes('has-text-align-center') ||
                              nextP.attr('class')?.includes('text-center');
            
            // Check if italic
            const isItalic = /font-style\s*:\s*italic/i.test(pStyle) ||
                            pHtml.includes('<em>') || pHtml.includes('<i>') ||
                            nextP.find('em, i').length > 0;
            
            // Skip alt text
            if (/^(Alt|alt|ALT)\s*:/i.test(pText)) {
              skipParagraphs.add(nextP.get(0));
              nextP = nextP.nextAll('p').first();
              continue;
            }
            
            // Skip paragraphs with URLs (YouTube links, etc.) - they are not captions
            const hasUrl = /https?:\/\//i.test(pText) || nextP.find('a[href]').length > 0;
            
            // If centered or italic, and not special content, and not too long, and no URL → it's a caption
            if ((isCentered || isItalic) && pText.length > 0 && pText.length < 200 &&
                !pText.startsWith('สารบัญ') && !pText.startsWith('อ้างอิง') &&
                !pText.startsWith('สรุป') && !pText.startsWith('Q&A') &&
                !pText.startsWith('คลิกอ่านบทความ') && !pText.startsWith('อ่านบทความ') &&
                !pText.startsWith('คลิกอ่านเพิ่มเติม') && !pText.startsWith('อ่านเพิ่มเติม') &&
                !/^(Alt|alt|ALT)\s*:/i.test(pText) && !/^H\s*:\s*[1-6]/i.test(pText) &&
                !hasUrl) {
              allCaptionParagraphs.push(pText);
              if (isItalic) allCaptionsHaveItalic = true;
              skipParagraphs.add(nextP.get(0)); // Mark for skipping
              nextP = nextP.nextAll('p').first();
            } else {
              break;
            }
          }
          
          // Build figcaption with all collected captions
          if (hasValidSrc && allCaptionParagraphs.length > 0) {
            // Join all captions with <br>
            const captionContent = allCaptionParagraphs.join('<br>');
            const captionHtml = allCaptionsHaveItalic ? `<em>${captionContent}</em>` : captionContent;
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
        const specialClass = getSpecialParagraphClass(textContent, content);
        if (specialClass) {
          // Should remove (Alt text)
          if (specialClass.shouldRemove) {
            return null;
          }
          
          // Quote block
          if (specialClass.isQuote) {
            let quoteText = content; // Use content to preserve HTML formatting (em, a, etc.)
            let quoteTextPlain = textContent;
            
            // Remove surrounding quotes from both - support all quote types
            // " (U+0022), " (U+201C), " (U+201D)
            if (specialClass.hasQuoteMarks) {
              // Remove first and last character (quote marks)
              quoteTextPlain = quoteTextPlain.slice(1, -1).trim();
              // Also remove from content (HTML) - use regex to handle all quote types
              quoteText = quoteText.replace(/^[""\u201C\u201D]/, '').replace(/[""\u201C\u201D]$/, '').trim();
            }
            
            // Special handling for "ข้อควรรู้" - make it bold and center aligned
            if (specialClass.isKnowledgeQuote) {
              // Make "ข้อควรรู้" bold
              quoteText = quoteText.replace(/^ข้อควรรู้/, '<strong>ข้อควรรู้</strong>');
              
              blockCount++;
              return `<!-- wp:quote -->
<blockquote class="wp-block-quote"><!-- wp:paragraph {"align":"center"} -->
<p class="has-text-align-center">${quoteText}</p>
<!-- /wp:paragraph --></blockquote>
<!-- /wp:quote -->`;
            }
            
            // General quote block
            blockCount++;
            return `<!-- wp:quote -->
<blockquote class="wp-block-quote"><!-- wp:paragraph -->
<p>${quoteTextPlain}</p>
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
            const headlineBlock = wrapBlock('paragraph', `<p class="has-text-align-center headline">${textContent}</p>`, { align: 'center', className: 'headline' });
            const buttonBlock = `<!-- wp:buttons {"className":"btn-addline"} --><div class="wp-block-buttons"><!-- wp:button {"className":"btn-addline"} --><div class="wp-block-button btn-addline"><a class="wp-block-button__link wp-element-button" href="${href}">Add LINE</a></div><!-- /wp:button --></div><!-- /wp:buttons -->`;
            return `${headlineBlock}\n${buttonBlock}`;
          }
          
          const result = [];
          
          // Add separator before references
          if (specialClass.addSeparator) {
            blockCount++;
            result.push('<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity">\n<!-- /wp:separator -->');
          }
          
          // สารบัญ (Table of Contents) - just output the paragraph
          // The first list will be converted to TOC menu automatically (listIndex === 0)
          if (specialClass.isTOC) {
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
                               (linkText.length / textContent.length) > 0.8; // If >80% of text is link
        
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
          // Use HTML content if available, otherwise use text content
          const contentToWrap = content.trim() || textContent.trim();
          if (contentToWrap) {
            finalContent = `<strong>${contentToWrap}</strong>`;
          }
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
        const currentListIndex = listIndex;
        listIndex++; // Increment for next list
        
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
        
        // Check previous element for class (like Home.jsx)
        let classPrev = null;
        if (prevSibling.length > 0 && prevSibling.is('p')) {
          const prevClass = prevSibling.attr('class') || '';
          if (prevClass.includes('references')) {
            classPrev = 'references';
          }
        }
        
        // Build class names (like Home.jsx)
        const classNames = [];
        
        // FIRST LIST (index === 0) becomes TOC menu - like Home.jsx convertListToMenu
        if (currentListIndex === 0) {
          classNames.push('listmenu');
          if (totalItems > 5) {
            classNames.push('two-column');
          }
        } else {
          // Other lists - normal processing
          if (classPrev === 'references') {
            classNames.push('references');
          }
          if (isDashed) {
            classNames.push('list-dashed');
          }
          if (hasCorrectlist) {
            classNames.push('correctlist');
          }
          // Add two-column class if > 5 items (general rule for all lists)
          if (totalItems > 5 && !hasCorrectlist) {
            classNames.push('two-column');
          }
        }
        
        // Build tag comment (like Home.jsx)
        let tagComment = '<!-- wp:list -->';
        if (classNames.length > 0) {
          tagComment = `<!-- wp:list {"className":"${classNames.join(' ')}"} -->`;
        }
        
        if (tagName === 'ol') {
          tagComment = '<!-- wp:list {"ordered":true} -->';
          if (classNames.length > 0) {
            tagComment = `<!-- wp:list {"ordered":true,"className":"${classNames.join(' ')}"} -->`;
          }
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
              if (currentListIndex === 0) {
                nestedLiContent = cleanListItemContent($clone, true);
              } else {
                nestedLiContent = $clone.html() || '';
                // Replace Google Docs style href with hash ID from link text
                if ($nestedA.length > 0 && $nestedA.text().trim()) {
                  const rawLinkText = $nestedA.text().trim();
                  const currentHref = $nestedA.attr('href') || '';
                  const isExternalLink = rawLinkText.includes('http://') || rawLinkText.includes('https://') ||
                                         currentHref.includes('http://') || currentHref.includes('https://');
                  if (!isExternalLink) {
                    const cleanedLinkText = cleanLinkText(rawLinkText);
                    const newHref = generateHashId(cleanedLinkText);
                    nestedLiContent = nestedLiContent.replace(/href="[^"]*"/, `href="#${newHref}"`);
                  }
                }
              }
              
              // Remove style attribute from links
              nestedLiContent = nestedLiContent.replace(/<a\s+style="[^"]*"\s+href=/g, '<a href=');
              nestedLiContent = nestedLiContent.replace(/<a\s+href="([^"]*)"\s+style="[^"]*"/g, '<a href="$1"');
              
              nestedItems.push(`<!-- wp:list-item -->\n<li>${nestedLiContent}${deeperSubItems}</li>\n<!-- /wp:list-item -->`);
            } else {
              let nestedLiContent;
              
              // For listmenu (TOC), use the clean helper that merges adjacent links
              if (currentListIndex === 0) {
                nestedLiContent = cleanListItemContent($nestedLi, true);
              } else {
                nestedLiContent = $nestedLi.html() || '';
                // Replace Google Docs style href with hash ID from link text (only for internal links)
                if ($nestedA.length > 0 && $nestedA.text().trim()) {
                  const rawLinkText = $nestedA.text().trim();
                  const currentHref = $nestedA.attr('href') || '';
                  const isExternalLink = rawLinkText.includes('http://') || rawLinkText.includes('https://') ||
                                         currentHref.includes('http://') || currentHref.includes('https://');
                  if (!isExternalLink) {
                    const cleanedLinkText = cleanLinkText(rawLinkText);
                    const newHref = generateHashId(cleanedLinkText);
                    nestedLiContent = nestedLiContent.replace(/href="[^"]*"/, `href="#${newHref}"`);
                  }
                }
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
            if (currentListIndex === 0) {
              liContent = cleanListItemContent($clone, true);
            } else {
              liContent = $clone.html() || '';
              // Remove "- " prefix if it's a dashed list
              if (isDashed) {
                liContent = liContent.replace(/^-\s*/, '');
              }
              // Replace Google Docs style href with hash ID from link text
              if ($aTag.length > 0 && $aTag.text().trim()) {
                const rawLinkText = $aTag.text().trim();
                const currentHref = $aTag.attr('href') || '';
                const isExternalLink = rawLinkText.includes('http://') || rawLinkText.includes('https://') ||
                                       currentHref.includes('http://') || currentHref.includes('https://');
                if (!isExternalLink) {
                  const cleanedLinkText = cleanLinkText(rawLinkText);
                  const newHref = generateHashId(cleanedLinkText);
                  liContent = liContent.replace(/href="[^"]*"/, `href="#${newHref}"`);
                }
              }
            }
            
            // Remove style attribute from links in list items
            liContent = liContent.replace(/<a\s+style="[^"]*"\s+href=/g, '<a href=');
            liContent = liContent.replace(/<a\s+href="([^"]*)"\s+style="[^"]*"/g, '<a href="$1"');
            
            listItems.push(`<!-- wp:list-item -->\n<li>${liContent}${listSubItems}</li>\n<!-- /wp:list-item -->`);
          } else {
            // No nested list
            let liContent;
            
            // For listmenu (TOC), use the clean helper that merges adjacent links
            if (currentListIndex === 0) {
              liContent = cleanListItemContent($li, true);
            } else {
              liContent = $li.html() || '';
              // Remove "- " prefix if it's a dashed list
              if (isDashed) {
                liContent = liContent.replace(/^-\s*/, '');
              }
              // Replace Google Docs style href with hash ID from link text
              if ($aTag.length > 0 && $aTag.text().trim()) {
                const rawLinkText = $aTag.text().trim();
                const currentHref = $aTag.attr('href') || '';
                const isExternalLink = rawLinkText.includes('http://') || rawLinkText.includes('https://') ||
                                       currentHref.includes('http://') || currentHref.includes('https://');
                if (!isExternalLink) {
                  const cleanedLinkText = cleanLinkText(rawLinkText);
                  const newHref = generateHashId(cleanedLinkText);
                  liContent = liContent.replace(/href="[^"]*"/, `href="#${newHref}"`);
                }
              }
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
        return `${tagComment}\n<${tagName}${classAttr}>\n${listItems.join('\n\n')}\n</${tagName}>\n<!-- /wp:list -->`;
      }

      case 'img': {
        const src = $el.attr('src') || '';
        const alt = $el.attr('alt') || '';
        
        // Look for caption paragraphs after this image
        const allCaptionParagraphs = [];
        let allCaptionsHaveItalic = false;
        
        let nextP = $el.nextAll('p').first();
        while (nextP.length > 0) {
          const pStyle = nextP.attr('style') || '';
          const pHtml = nextP.html() || '';
          const pText = nextP.text().trim();
          
          // Check if centered
          const isCentered = /text-align\s*:\s*center/i.test(pStyle) ||
                            nextP.attr('class')?.includes('has-text-align-center') ||
                            nextP.attr('class')?.includes('text-center');
          
          // Check if italic
          const isItalic = /font-style\s*:\s*italic/i.test(pStyle) ||
                          pHtml.includes('<em>') || pHtml.includes('<i>') ||
                          nextP.find('em, i').length > 0;
          
          // Skip alt text
          if (/^(Alt|alt|ALT)\s*:/i.test(pText)) {
            skipParagraphs.add(nextP.get(0));
            nextP = nextP.nextAll('p').first();
            continue;
          }
          
          // If centered or italic, and not special content → it's a caption
          if ((isCentered || isItalic) && pText.length > 0 && pText.length < 200 &&
              !pText.startsWith('สารบัญ') && !pText.startsWith('อ้างอิง') &&
              !pText.startsWith('สรุป') && !pText.startsWith('Q&A') &&
              !/^H\s*:\s*[1-6]/i.test(pText)) {
            allCaptionParagraphs.push(pText);
            if (isItalic) allCaptionsHaveItalic = true;
            skipParagraphs.add(nextP.get(0)); // Mark for skipping
            nextP = nextP.nextAll('p').first();
          } else {
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
          
          let nextP = $el.nextAll('p').first();
          while (nextP.length > 0) {
            const pStyle = nextP.attr('style') || '';
            const pHtml = nextP.html() || '';
            const pText = nextP.text().trim();
            
            // Check if centered
            const isCentered = /text-align\s*:\s*center/i.test(pStyle) ||
                              nextP.attr('class')?.includes('has-text-align-center') ||
                              nextP.attr('class')?.includes('text-center');
            
            // Check if italic
            const isItalic = /font-style\s*:\s*italic/i.test(pStyle) ||
                            pHtml.includes('<em>') || pHtml.includes('<i>') ||
                            nextP.find('em, i').length > 0;
            
            // Skip alt text
            if (/^(Alt|alt|ALT)\s*:/i.test(pText)) {
              skipParagraphs.add(nextP.get(0));
              nextP = nextP.nextAll('p').first();
              continue;
            }
            
            // If centered or italic, and not special content → it's a caption
            if ((isCentered || isItalic) && pText.length > 0 && pText.length < 200 &&
                !pText.startsWith('สารบัญ') && !pText.startsWith('อ้างอิง') &&
                !pText.startsWith('สรุป') && !pText.startsWith('Q&A') &&
                !/^H\s*:\s*[1-6]/i.test(pText)) {
              allCaptionParagraphs.push(pText);
              if (isItalic) allCaptionsHaveItalic = true;
              skipParagraphs.add(nextP.get(0)); // Mark for skipping
              nextP = nextP.nextAll('p').first();
            } else {
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
        return wrapBlock('separator', '<hr class="wp-block-separator has-alpha-channel-opacity">');
      }

      case 'table': {
        // Check if table contains "Note" or internal instructions - remove it completely
        const tableText = $el.text().trim();
        const tableHtml = $el.html() || '';

        // Convert clinic info table to button for specific domains
        const normalizedWebsite = website ? website.replace(/^www\./, '') : '';
        if ((normalizedWebsite === 'bestbrandclinic.com' || normalizedWebsite === 'monghaclinic.com') && tableText.includes('คลิกดูข้อมูลคลินิกเพิ่มเติม')) {
          const rawButtonText = ($el.find('p').first().text() || tableText).trim();
          const buttonText = rawButtonText.replace(/\s*\[[^\]]+\]\s*$/g, '').trim();

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

              if (!isInternalLink) {
                targetAttr = ' target="_blank"';
                relAttr = ' rel="noreferrer noopener nofollow"';
              }
            }

            const safeText = escapeHtml(buttonText);
            blockCount++;
            return `<!-- wp:buttons {"metadata":{"categories":[],"patternName":"core/block/536","name":"คลิกดูข้อมูล"},"layout":{"type":"flex","justifyContent":"center"}} -->\n` +
                   `<div class="wp-block-buttons"><!-- wp:button -->\n` +
                   `<div class="wp-block-button"><a class="wp-block-button__link wp-element-button"${hrefAttr}${targetAttr}${relAttr}>${safeText}</a></div>\n` +
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
          // Check if cells contain images
          const $firstRow = $tableRows.first();
          const $cells = $firstRow.find('td');
          const cellsWithImages = $cells.filter((_, cell) => {
            return $(cell).find('img').length > 0;
          }).length;
          
          // If at least 2 cells have images, check if we should combine rows or keep them separate
          if (cellsWithImages >= 2) {
            // Special case: If table has 2 rows with 3 columns each, combine into 1 layout with 6 columns
            const shouldCombineRows = $tableRows.length === 2 && 
                                     $tableRows.first().find('td').length === 3 &&
                                     $tableRows.last().find('td').length === 3;
            
            if (shouldCombineRows) {
              // Combine all images from both rows into one layout
              // Use columns = number of columns per row (3), not total (6)
              const allImages = [];
              const columnsPerRow = $tableRows.first().find('td').length; // 3
              
              $tableRows.each((_, row) => {
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
                    
                    allImages.push({
                      src: $img.attr('src') || '',
                      alt: altText || $img.attr('alt') || ''
                    });
                  }
                });
              });
              
              if (allImages.length === 6) {
                const uniqueId = generateKadenceUniqueId();
                
                let innerBlocks = '';
                allImages.forEach((img, index) => {
                  const colId = generateKadenceUniqueId();
                  const idAttr = index === 0 ? '' : `"id":${index + 1},`;
                  const escapedAlt = (img.alt || '').replace(/"/g, '&quot;');
                  
                  innerBlocks += `<!-- wp:kadence/column {${idAttr}"borderWidth":["","","",""],"uniqueID":"${colId}","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-column${colId}"><div class="kt-inside-inner-col"><!-- wp:image -->
<figure class="wp-block-image"><img alt="${escapedAlt}"/></figure>
<!-- /wp:image --></div></div>
<!-- /wp:kadence/column -->

`;
                });
                
                blockCount++;
                // Use columns = columnsPerRow (3), with equal layouts
                return `<!-- wp:kadence/rowlayout {"uniqueID":"${uniqueId}","columns":${columnsPerRow},"mobileLayout":"equal","tabletLayout":"equal","colLayout":"equal","kbVersion":2} -->
${innerBlocks}<!-- /wp:kadence/rowlayout -->`;
              }
            }
            
            // Default: Process each row separately
            const rowLayouts = [];
            
            // Process each row separately
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
          
          // Get inner HTML and clean it - keep only text and <br> tags
          let buttonHtml = $tableLink.html() || '';
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
        
        // Helper function to check if cell is centered
        // Center if: cell/paragraph has explicit center, OR content is bold (row header)
        // Left if: explicit left alignment, OR regular text content
        const isCellCentered = ($cell) => {
          const cellStyle = $cell.attr('style') || '';
          const cellHtml = $cell.html() || '';
          
          // Check if explicitly left-aligned on cell
          if (/text-align\s*:\s*left/i.test(cellStyle)) return false;
          // Check if explicitly centered on cell
          if (/text-align\s*:\s*center/i.test(cellStyle)) return true;
          
          // Check first paragraph
          const $firstP = $cell.find('p').first();
          if ($firstP.length > 0) {
            const pStyle = $firstP.attr('style') || '';
            if (/text-align\s*:\s*left/i.test(pStyle)) return false;
            if (/text-align\s*:\s*center/i.test(pStyle)) return true;
          }
          
          // If content is primarily bold (row header), center it
          const isBoldContent = cellHtml.trim().startsWith('<strong>') || 
                               cellHtml.trim().startsWith('<b>') ||
                               (cellHtml.includes('<strong>') && cellHtml.indexOf('<strong>') < 5);
          if (isBoldContent) return true;
          
          // Default to left-aligned for regular content
          return false;
        };
        
        // Helper function to get clean cell content (without p tags)
        const getCleanCellContent = ($cell) => {
          let content = '';
          const $p = $cell.find('p');
          if ($p.length > 0) {
            // Get content from p tags
            $p.each((_, p) => {
              content += $(p).html() || '';
            });
          } else {
            content = $cell.html() || '';
          }
          // Clean up spans without important styles
          const $temp = $('<div>').html(content);
          $temp.find('span').each((_, span) => {
            const $span = $(span);
            const spanStyle = $span.attr('style') || '';
            const hasImportantStyle = /font-weight|font-style|text-decoration/i.test(spanStyle);
            if (!hasImportantStyle) {
              $span.replaceWith($span.html());
            }
          });
          return $temp.html().trim();
        };
        
        // Find all rows
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
          // First row becomes thead
          const $firstRow = $bodyRows.first();
          const $thead = $('<thead>');
          const $headRow = $('<tr>');
          
          $firstRow.find('td').each((_, td) => {
            const $td = $(td);
            const content = getCleanCellContent($td);
            const colspan = $td.attr('colspan') || '1';
            const rowspan = $td.attr('rowspan') || '1';
            
            // Header cells are always centered
            const $th = $('<th>')
              .addClass('has-text-align-center')
              .attr('data-align', 'center');
            
            if (colspan !== '1') $th.attr('colspan', colspan);
            if (rowspan !== '1') $th.attr('rowspan', rowspan);
            
            $th.html(content);
            $headRow.append($th);
          });
          
          $thead.append($headRow);
          
          // Remove first row from tbody
          $firstRow.remove();
          
          // Process remaining rows in tbody
          $tbody.find('tr').each((_, tr) => {
            $(tr).find('td').each((colIdx, td) => {
              const $td = $(td);
              const content = getCleanCellContent($td);
              const isCentered = isCellCentered($td);
              
              // Preserve colspan/rowspan from source
              const colspan = $td.attr('colspan') || '1';
              const rowspan = $td.attr('rowspan') || '1';
              
              // Clear and rebuild cell
              $td.empty().html(content);
              $td.removeAttr('style').removeAttr('class').removeAttr('colspan').removeAttr('rowspan');
              
              // Only add colspan/rowspan if not "1" (default value)
              if (colspan !== '1') $td.attr('colspan', colspan);
              if (rowspan !== '1') $td.attr('rowspan', rowspan);
              
              // Use detected alignment from source cell
              if (isCentered) {
                $td.addClass('has-text-align-center').attr('data-align', 'center');
              } else {
                // Default to left for body cells if not explicitly centered
                $td.addClass('has-text-align-left').attr('data-align', 'left');
              }
            });
          });
          
          // Insert thead before tbody
          $tbody.before($thead);
        }
        
        // Add has-fixed-layout class to table
        $el.addClass('has-fixed-layout');
        
        // Clean up remaining attributes
        $el.find('tr').removeAttr('style').removeAttr('class');
        $tbody.removeAttr('style').removeAttr('class');
        $el.removeAttr('style');
        
        blockCount++;
        // Return table with hasFixedLayout attribute in comment
        return `<!-- wp:table {"hasFixedLayout":true} -->\n<figure class="wp-block-table">${$el.prop('outerHTML')}</figure>\n<!-- /wp:table -->`;
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
      return;
    }

    if (href.startsWith('/') || href.startsWith('#') || !href.includes('://')) {
      $a.removeAttr('target');
      $a.removeAttr('rel');
      return;
    }

    try {
      const url = new URL(href);
      const linkDomain = url.hostname.replace(/^www\./, '');
      const selectedDomainClean = selectedDomain.replace(/^www\./, '');

      const sameDomain = linkDomain === selectedDomainClean;
      const isInternalDomain = (
        linkDomain === selectedDomainClean ||
        linkDomain.endsWith(`.${selectedDomainClean}`)
      );

      if (sameDomain || isInternalDomain) {
        $a.removeAttr('target');
        $a.removeAttr('rel');
        return;
      }

      $a.removeAttr('target').removeAttr('rel');
      $a.attr('target', '_blank');
      $a.attr('rel', 'noreferrer noopener');
    } catch (e) {
      $a.removeAttr('target');
      $a.removeAttr('rel');
    }
  });
  
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
    'en.vsquareclinic.com': '\n<!-- wp:block {"ref":66914} /-->',
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
    
    // Step 7c: For bestbrandclinic.com, special processing
    if (options.website === 'bestbrandclinic.com') {
      // Remove separator that appears after the last paragraph block at the end
      gutenbergHtml = gutenbergHtml.replace(
        /(<!-- \/wp:paragraph -->\s*)\n*<!-- wp:separator -->\s*<hr class="wp-block-separator[^"]*"\s*\/?>\s*<!-- \/wp:separator -->(\s*)$/gi,
        '$1$2'
      );
    }
    
    // Step 8: Add website-specific footer
    if (options.website) {
      const footer = getWebsiteFooter(options.website);
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
