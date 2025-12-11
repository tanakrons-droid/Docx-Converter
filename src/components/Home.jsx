import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import mammoth from 'mammoth';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileArrowUp, faFileImport, faCopy, faCircleNotch, faCheck } from '@fortawesome/free-solid-svg-icons';
import { cleanGutenbergTables } from '../utils/cleanGutenbergTables';
import { convertReadMoreToBlock } from '../utils/convertReadMoreToBlock';
import { addQAHeadingClass } from '../utils/addQAHeadingClass';
import { removeAltText } from '../utils/removeAltText';
import { convertTableToButton } from '../utils/convertTableToButton';
import { convertReadMoreLinks } from '../utils/convertReadMoreLinks';

// ✅ YouTube Detection and Conversion Functions
function isYouTubeUrl(url) {
  const ytPatterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=/i,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\//i,
    /^https?:\/\/(www\.)?youtube\.com\/embed\//i,
    /^https?:\/\/youtu\.be\//i,
    /^https?:\/\/youtube\.com\/watch\?v=/i,
    /^https?:\/\/youtube\.com\/shorts\//i,
    /^https?:\/\/(m\.)?youtube\.com\//i
  ];
  return ytPatterns.some(pattern => pattern.test(url.trim()));
}

function extractYouTubeCaption(rawText) {
  const text = rawText.trim();

  // ดึงส่วน URL (หยุดก่อนตัวอักษรไทย)
  const match = text.match(/(https?:\/\/[^\s\u0E00-\u0E7F]+)/);

  if (!match) {
    return { url: null, caption: null };
  }

  const url = match[1].trim();
  const caption = text.replace(url, '').trim();

  return {
    url,
    caption: caption || null
  };
}

function createYouTubeFigcaption(caption) {
  if (!caption) return '';
  return `<figcaption class="wp-element-caption">${caption}</figcaption>`;
}

function createYouTubeGutenbergBlock(url, caption = null) {
  const figcaptionHTML = createYouTubeFigcaption(caption);

  return `
<!-- wp:embed {"url":"${url}","type":"video","providerNameSlug":"youtube","responsive":true,"align":"center","className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} -->
<figure class="wp-block-embed aligncenter is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio">
  <div class="wp-block-embed__wrapper">${url}</div>
  ${figcaptionHTML}
</figure>
<!-- /wp:embed -->
  `.trim();
}

// ✅ Image Detection and Conversion Functions
function extractImageCaptionFromParagraph(p) {
  const html = p.innerHTML.trim();
  const style = p.getAttribute("style") || '';

  const isItalic =
    /<(em|i)(\s|>)/i.test(html) ||
    /font-style\s*:\s*italic/i.test(style) ||
    p.querySelector("em") ||
    p.querySelector("i");

  if (!isItalic) return null;
  return html.replace(/<\/?p[^>]*>/g, '').trim();
}

function extractImageMetaFromTag(img, captionHTML = '') {
  const src = img.getAttribute("src") || '';
  const alt = img.getAttribute("alt") || captionHTML || '';

  // extract ID from filename 45767.jpg
  let id = Date.now();
  const match = src.match(/(\d+)\.(jpg|jpeg|png|webp|gif)$/i);
  if (match) id = match[1];

  return { src, alt, id, captionHTML };
}

function createFullImageBlock(meta) {
  return `
<!-- wp:image {"id":${meta.id},"sizeSlug":"full","linkDestination":"none"} -->
<figure class="wp-block-image size-full">
  <img src="${meta.src}" alt="${meta.alt}" class="wp-image-${meta.id}"/>
  ${meta.captionHTML ? `<figcaption class="wp-element-caption"><em>${meta.captionHTML}</em></figcaption>` : ''}
</figure>
<!-- /wp:image -->
`.trim();
}

function Home() {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const dropdownButtonRef = useRef(null);

  // Memoized websites list
  const websites = useMemo(() => [
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
  ], []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Memoized callback for website selection
  const handleWebsiteSelect = useCallback((website) => {
    setSelectedWebsite(website);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    dropdownButtonRef.current?.focus();
  }, []);

  // Toggle dropdown with keyboard support
  const handleToggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
    if (!isDropdownOpen) {
      // Set highlighted index to selected item or first item
      const currentIndex = websites.indexOf(selectedWebsite);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isDropdownOpen, selectedWebsite, websites]);

  // Keyboard navigation
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleKeyDown = (event) => {
      // Only handle these keys when dropdown is open
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }

      switch (event.key) {
        case 'ArrowDown':
          setHighlightedIndex((prev) => {
            const nextIndex = prev < websites.length - 1 ? prev + 1 : 0;
            // Auto-scroll to highlighted item
            setTimeout(() => {
              const element = document.querySelector(`[data-website-index="${nextIndex}"]`);
              element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 0);
            return nextIndex;
          });
          break;
        case 'ArrowUp':
          setHighlightedIndex((prev) => {
            const nextIndex = prev > 0 ? prev - 1 : websites.length - 1;
            // Auto-scroll to highlighted item
            setTimeout(() => {
              const element = document.querySelector(`[data-website-index="${nextIndex}"]`);
              element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 0);
            return nextIndex;
          });
          break;
        case 'Enter':
        case ' ': // Space key
          if (highlightedIndex >= 0 && highlightedIndex < websites.length) {
            handleWebsiteSelect(websites[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsDropdownOpen(false);
          setHighlightedIndex(-1);
          dropdownButtonRef.current?.focus();
          break;
        case 'Tab':
          setIsDropdownOpen(false);
          setHighlightedIndex(-1);
          break;
        default:
          break;
      }
    };

    // Use capture phase to prevent other handlers from interfering
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isDropdownOpen, highlightedIndex, websites, handleWebsiteSelect]);

  const handleFileChange = (event) => {
    const fileTarget = event.target.files[0];
    const fileLabel = document.querySelector('.upload-file-label');
    if (fileTarget) {
      setFile(fileTarget);
      fileLabel.innerHTML = `${fileTarget.name}`;
    } else {
      setFile(null);
      fileLabel.innerHTML = `<strong>Click to upload</strong> or drag and drop<br />DOCX are Allowed.`;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(htmlContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = htmlContent;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const processLinks = (htmlString, selectedDomain) => {
    // ใช้ regex เพื่อหา <a> tags ทั้งหมดและแก้ไข
    const aTagRegex = /<a\s+([^>]*?)>/gi;
    
    return htmlString.replace(aTagRegex, (match, attributes) => {
      // ดึง href attribute
      const hrefMatch = attributes.match(/href\s*=\s*["']([^"']+)["']/i);
      if (!hrefMatch) return match; // ไม่มี href
      
      const href = hrefMatch[1];
      
      // ถ้าเป็น internal link (เริ่มด้วย /, # หรือไม่มี protocol)
      if (href.startsWith('/') || href.startsWith('#') || !href.includes('://')) {
        return match; // ไม่ต้องแก้ไข
      }
      
      try {
        const url = new URL(href);
        const linkDomain = url.hostname.replace('www.', '');
        const selectedDomainClean = selectedDomain.replace('www.', '');
        
        // ถ้าเป็นโดเมนเดียวกัน ไม่ต้องแก้ไข
        if (linkDomain === selectedDomainClean) {
          return match;
        }
        
        // ถ้าไม่ใช่โดเมนเดียวกัน ให้เพิ่ม target="_blank" และ rel="noreferrer noopener"
        let newAttributes = attributes;
        
        // ลบ target และ rel เดิม (ถ้ามี)
        newAttributes = newAttributes.replace(/\s*target\s*=\s*["'][^"']*["']/gi, '');
        newAttributes = newAttributes.replace(/\s*rel\s*=\s*["'][^"']*["']/gi, '');
        
        // เพิ่ม target="_blank" และ rel="noreferrer noopener"
        newAttributes += ' target="_blank" rel="noreferrer noopener"';
        
        return `<a ${newAttributes}>`;
      } catch (e) {
        // ถ้า URL ไม่ valid ก็คืนค่าเดิม
        return match;
      }
    });
  };

  // ล้างฟอร์แมตแปลกๆ อัตโนมัติ เช่น span, font, style ที่มาจาก Word หรือ Docs
  const cleanHTML = (html) => {
    // ลบ <span> tags ทั้งหมด (เก็บเฉพาะเนื้อหาภายใน)
    html = html.replace(/<span[^>]*>/gi, '');
    html = html.replace(/<\/span>/gi, '');
    
    // ลบ <font> tags ทั้งหมด (เก็บเฉพาะเนื้อหาภายใน)
    html = html.replace(/<font[^>]*>/gi, '');
    html = html.replace(/<\/font>/gi, '');
    
    // ลบ inline style attributes ที่มาจาก Word/Docs
    // ลบ style ที่มี mso- prefix (Microsoft Office styles)
    html = html.replace(/\s*style="[^"]*mso-[^"]*"/gi, '');
    
    // ลบ style attributes ที่มีคุณสมบัติที่ไม่ต้องการจาก Word/Docs
    html = html.replace(/\s*style="[^"]*font-family:\s*['"]?Times New Roman['"]?[^"]*"/gi, '');
    html = html.replace(/\s*style="[^"]*font-family:\s*['"]?Calibri['"]?[^"]*"/gi, '');
    html = html.replace(/\s*style="[^"]*font-family:\s*['"]?Arial['"]?[^"]*"/gi, '');
    
    // ลบ style ที่มี background-color: white หรือ background: white
    html = html.replace(/\s*style="[^"]*background(?:-color)?:\s*(?:white|#ffffff|rgb\(255,\s*255,\s*255\))[^"]*"/gi, '');
    
    // ลบ style ที่มี font-size จาก Word
    html = html.replace(/\s*style="[^"]*font-size:\s*\d+(?:\.\d+)?(?:pt|px)[^"]*"/gi, '');
    
    // ลบ empty attributes และ whitespace ที่ไม่จำเป็น
    html = html.replace(/\s+class=""/gi, '');
    html = html.replace(/\s+id=""/gi, '');
    html = html.replace(/\s+style=""/gi, '');
    
    // ลบ attributes ที่ไม่จำเป็นจาก Word/Docs
    html = html.replace(/\s+lang="[^"]*"/gi, '');
    html = html.replace(/\s+xml:lang="[^"]*"/gi, '');
    
    // ลบ <p> tags ที่ wrap Gutenberg block comments
    html = html.replace(/<p>\s*(<!--[^>]*-->)\s*<\/p>/gi, '$1');
    
    // ลบ empty tags ที่อาจเกิดจากการลบ span/font
    html = html.replace(/<p>\s*<\/p>/gi, '');
    html = html.replace(/<li>\s*<\/li>/gi, '');
    
    return html;
  };

  const handleConvert = async () => {
    // ตรวจสอบว่าเลือกเว็บไซต์แล้วหรือยัง
    if (!selectedWebsite) {
      alert('กรุณาเลือกเว็บไซต์ก่อนประมวลผล');
      return;
    }
    
    // Flags
    const WP_EXPORT_MODE = true; // Prevents base64 image data -> avoids Gutenberg freeze
    const DEBUG = false; // Set to true to log stages in console
    const _stages = [];
    const _logStage = (name, payload) => {
      if (!DEBUG) return;
      try {
        const info = typeof payload === 'string' ? payload.slice(0, 300) : JSON.stringify(payload).slice(0, 300);
        _stages.push(`✔ ${name}: ${info.length} chars`);
        if (window && window.console && process.env.NODE_ENV === 'development') console.log(`[CONVERT] ${name}`, payload);
      } catch (e) {
        _stages.push(`(log failed at ${name}: ${e && e.message})`);
      }
    };
    
    if (!file) return;
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target.result;
      try {
        const options = {
  styleMap: [
    "u => u",
    "r[style-name*='Underline'] => u",
    // Alignment styles
    "p[style-name='Center'] => p.has-text-align-center",
    "p[style-name='Centered'] => p.has-text-align-center",
    "p[style-name='center'] => p.has-text-align-center",
    "p[style-name='centered'] => p.has-text-align-center"
  ],
  includeEmbeddedStyleMap: true,
  convertImage: mammoth.images.imgElement(function(image) {
    if (WP_EXPORT_MODE) return { src: "" };
    return image.read("base64").then(function(buffer) {
      var contentType = image.contentType || "image/png";
      return { src: "data:" + contentType + ";base64," + buffer };
    });
  })
        }
_logStage('read file', arrayBuffer && ('ArrayBuffer ' + arrayBuffer.byteLength));
const result = await mammoth.convertToHtml({ arrayBuffer }, options);
_logStage('mammoth.convertToHtml()', (result && result.value) || '(no value)');
        let htmlString = result.value;
        _logStage('start postprocess', htmlString);

        // Post-processing: Create Row Layout with 2 sections from consecutive content
        // eslint-disable-next-line no-unused-vars
        function createRowLayoutFromContent(htmlString) {
          // Mock WordPress Blocks API functions
          const createBlock = (name, attributes = {}, innerBlocks = []) => ({
            name,
            attributes,
            innerBlocks,
            clientId: Math.random().toString(36).substr(2, 9)
          });

          const parseBlocks = (content) => {
            const blocks = [];
            // Simple regex to match Gutenberg blocks
            const blockRegex = /<!-- wp:([^\s/]+)(?:\s+([^>]*))?\s*(?:\/)?-->([\s\S]*?)(?:<!-- \/wp:-->|$)/g;
            let match;
            
            while ((match = blockRegex.exec(content)) !== null) {
              const blockName = match[1];
              let attributes = {};
              
              try {
                if (match[2] && match[2].trim().startsWith('{')) {
                  attributes = JSON.parse(match[2]);
                }
              } catch (e) {
                // Ignore invalid JSON attributes
              }
              
              const blockContent = match[3] || '';
              
              // Extract text content for paragraphs
              let textContent = '';
              if (blockName === 'paragraph') {
                const pMatch = blockContent.match(/<p[^>]*>(.*?)<\/p>/);
                if (pMatch) {
                  textContent = pMatch[1];
                }
              }
              
              const innerBlocks = parseBlocks(blockContent);
              
              const block = createBlock(blockName, attributes, innerBlocks);
              if (textContent) {
                block.content = textContent;
              }
              
              blocks.push(block);
            }
            
            return blocks;
          };

          const serializeBlocks = (blocks) => {
            return blocks.map(block => {
              const attributesString = Object.keys(block.attributes).length > 0 
                ? ' ' + JSON.stringify(block.attributes) 
                : '';
              
              if (block.innerBlocks && block.innerBlocks.length > 0) {
                const innerContent = serializeBlocks(block.innerBlocks);
                return `<!-- wp:${block.name}${attributesString} -->${innerContent}<!-- /wp:${block.name} -->`;
              } else {
                // Handle different block types
                if (block.name === 'image') {
                  return `<!-- wp:image -->\n<figure class="wp-block-image"></figure>\n<!-- /wp:image -->`;
                } else if (block.name === 'paragraph') {
                  return `<!-- wp:paragraph${attributesString} --><p>${block.content || ''}</p><!-- /wp:paragraph -->`;
                } else if (block.name === 'kadence/column') {
                  const columnUniqueID = block.attributes.uniqueID || `70684_${Math.random().toString(36).substr(2, 9)}`;
                  const innerContent = block.innerBlocks ? serializeBlocks(block.innerBlocks) : '';
                  return `<!-- wp:kadence/column {"borderWidth":["","","",""],"uniqueID":"${columnUniqueID}","borderStyle":[{"top":["","",""],"right":["","",""],"bottom":["","",""],"left":["","",""],"unit":"px"}]} -->
<div class="wp-block-kadence-column kadence-column${columnUniqueID}"><div class="kt-inside-inner-col">${innerContent}</div></div>
<!-- /wp:kadence/column -->`;
                } else if (block.name === 'kadence/rowlayout') {
                  const rowUniqueID = block.attributes.uniqueID || `70684_${Math.random().toString(36).substr(2, 9)}`;
                  const innerContent = block.innerBlocks ? serializeBlocks(block.innerBlocks) : '';
                  return `<!-- wp:kadence/rowlayout {"uniqueID":"${rowUniqueID}","colLayout":"equal","kbVersion":2} -->\n${innerContent}\n<!-- /wp:kadence/rowlayout -->`;
                }
                return `<!-- wp:${block.name}${attributesString} /-->`;
              }
            }).join('\n');
          };

          // Parse HTML string to blocks
          const parsedBlocks = parseBlocks(htmlString);
          if (process.env.NODE_ENV === 'development') {
            console.log('Parsed blocks:', parsedBlocks.map(b => ({ name: b.name, content: b.content?.substring(0, 50) })));
          }
          
          // Process blocks to create row layouts from consecutive content patterns
          const processBlocks = (blocks) => {
            const processedBlocks = [];
            let i = 0;
            
            while (i < blocks.length) {
              const currentBlock = blocks[i];
              
              // Look for patterns that should become 2-column layouts
              // Pattern 1: Two consecutive paragraphs that look like they should be side by side
              if (currentBlock.name === 'paragraph' && i + 1 < blocks.length) {
                const nextBlock = blocks[i + 1];
                
                if (nextBlock.name === 'paragraph') {
                  // Check if these paragraphs have similar characteristics (length, structure)
                  const currentText = currentBlock.content || '';
                  const nextText = nextBlock.content || '';
                  
                  // More flexible criteria for creating 2-column layouts
                  // Look for paragraphs that are likely to be side-by-side content
                  const shouldCreateLayout = (
                    // Both have reasonable content
                    currentText.length > 20 && nextText.length > 20 &&
                    // Either similar length OR both are short descriptions
                    (Math.abs(currentText.length - nextText.length) < Math.max(currentText.length, nextText.length) * 0.7 ||
                     (currentText.length < 200 && nextText.length < 200))
                  );
                  
                  if (shouldCreateLayout) {
                    if (process.env.NODE_ENV === 'development') {
                      console.log('Creating 2-column layout for:', currentText.substring(0, 30), '...and...', nextText.substring(0, 30));
                    }
                    
                    // Create 2-column row layout with proper structure
                    const column1UniqueID = `70684_${Math.random().toString(36).substr(2, 9)}`;
                    const column2UniqueID = `70684_${Math.random().toString(36).substr(2, 9)}`;
                    const rowUniqueID = `70684_${Math.random().toString(36).substr(2, 9)}`;
                    
                    const column1 = createBlock('kadence/column', {
                      borderWidth: ["","","",""],
                      uniqueID: column1UniqueID,
                      borderStyle: [{"top":["","",""],"right":["","",""],"bottom":["","",""],"left":["","",""],"unit":"px"}]
                    }, [
                      createBlock('image', {}),
                      currentBlock
                    ]);
                    
                    const column2 = createBlock('kadence/column', {
                      borderWidth: ["","","",""],
                      uniqueID: column2UniqueID,
                      borderStyle: [{"top":["","",""],"right":["","",""],"bottom":["","",""],"left":["","",""],"unit":"px"}]
                    }, [
                      createBlock('image', {}),
                      nextBlock
                    ]);
                    
                    const rowLayout = createBlock('kadence/rowlayout', {
                      uniqueID: rowUniqueID,
                      colLayout: "equal",
                      kbVersion: 2
                    }, [column1, column2]);
                    
                    processedBlocks.push(rowLayout);
                    
                    i += 2; // Skip both blocks as they're now part of the row layout
                    continue;
                  }
                }
              }
              
              // Pattern 2: Existing kadence/rowlayout with 2 sections - add images if missing
              if (currentBlock.name === 'kadence/rowlayout' && currentBlock.innerBlocks) {
                const sections = currentBlock.innerBlocks.filter(innerBlock => 
                  innerBlock.name === 'kadence/column' || innerBlock.name === 'kadence/section'
                );
                
                if (sections.length === 2) {
                  sections.forEach(section => {
                    const hasParagraph = section.innerBlocks && section.innerBlocks.some(innerBlock => 
                      innerBlock.name === 'core/paragraph'
                    );
                    
                    if (hasParagraph && section.innerBlocks) {
                      const firstBlock = section.innerBlocks[0];
                      if (!firstBlock || (firstBlock.name !== 'core/image' && firstBlock.name !== 'core/gallery')) {
                        const imageBlock = createBlock('core/image', {});
                        section.innerBlocks.unshift(imageBlock);
                      }
                    }
                  });
                }
              }
              
              // Process inner blocks recursively
              if (currentBlock.innerBlocks && currentBlock.innerBlocks.length > 0) {
                currentBlock.innerBlocks = processBlocks(currentBlock.innerBlocks);
              }
              
              processedBlocks.push(currentBlock);
              i++;
            }
            
            return processedBlocks;
          };

          // Process all blocks
          const processedBlocks = processBlocks(parsedBlocks);
          
          // Serialize back to HTML string
          return serializeBlocks(processedBlocks);
        }

        // Parse the HTML string to a DOM object
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        
        // === Helper functions สำหรับตรวจจับการจัดกลาง ===
        
        // 1) ตรวจจับ "center" แบบชัดเจนที่ element นั้นเอง (ไม่อิง ancestor)
        // ใช้กับ heading และ paragraph ทั่วไป
        function isExplicitCentered(el) {
          if (!el || el.nodeType !== 1) return false;
          const style = (el.getAttribute('style') || '').toLowerCase();
          const align = (el.getAttribute('align') || '').toLowerCase();
          const cls = (el.getAttribute('class') || '').toLowerCase();
          
          return (
            align === 'center' ||
            /(^|;)\s*text-align\s*:\s*center\b/.test(style) ||
            /(^|;)\s*mso-text-align\s*:\s*center\b/.test(style) ||
            /\bhas-text-align-center\b/.test(cls) ||
            /\btext-center\b/.test(cls) ||
            (el.style && el.style.textAlign === 'center') ||
            (el.dataset && el.dataset.align === 'center')
          );
        }
        
        // 2) ตรวจจับ "center" แบบอนุโลม (ดู parent 1 ชั้น)
        // ใช้เฉพาะกับ caption ใต้รูป
        function isCaptionLikelyCentered(p) {
          if (isExplicitCentered(p)) return true;
          const parent = p && p.parentElement;
          return !!(parent && isExplicitCentered(parent));
        }
        
        // === End helper functions for alignment ===

        // === Normalize all alignment from Word styles and classes ===
        // ตรวจจับและทำให้ alignment เป็นมาตรฐานก่อนประมวลผลต่อ
        // ใช้ isExplicitCentered (ตรวจเฉพาะ element นั้นเอง)
        doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6').forEach(el => {
          const isCentered = isExplicitCentered(el);
          
          // บันทึกข้อมูลการจัดกลางไว้ใน dataset เพื่อใช้ในการประมวลผลต่อไป
          if (isCentered) {
            el.dataset.align = 'center';
            // เพิ่ม style.textAlign เพื่อให้ตรวจจับได้ง่ายในขั้นตอนถัดไป
            el.style.textAlign = 'center';
          }
        });
        // === End normalize alignment ===
        
        // === รวมย่อหน้า (Shift+Enter) ===
        // รวม <p> ที่ต่อกันซึ่งควรเป็นบรรทัดใหม่ในย่อหน้าเดียว (Shift+Enter)
        (function mergeShiftEnterParagraphs() {
          const paragraphs = Array.from(doc.querySelectorAll('p'));
          
          paragraphs.forEach((p, idx) => {
            const nextP = p.nextElementSibling;
            
            // ไม่รวมถ้าไม่มี nextP หรือไม่ใช่ paragraph
            if (!nextP || nextP.tagName !== 'P') return;
            
            // ไม่รวมถ้า alignment ของสอง paragraph ไม่เหมือนกัน
            const currentAlign = p.style.textAlign || p.dataset.align || '';
            const nextAlign = nextP.style.textAlign || nextP.dataset.align || '';
            if (currentAlign !== nextAlign) return;
            
            // ไม่รวมถ้าเป็นส่วนของ table, list
            if (p.closest('table') || nextP.closest('table')) return;
            if (p.closest('ul') || p.closest('ol')) return;
            if (nextP.closest('ul') || nextP.closest('ol')) return;
            
            // ไม่รวมถ้าเป็น special content
            const currentText = p.textContent.trim();
            const nextText = nextP.textContent.trim();
            const specialPatterns = [
              'สารบัญ', 'คลิกอ่านหัวข้อ', 'อ่านบทความเพิ่มเติม', 'อ่านเพิ่มเติม',
              'อ้างอิง', 'เอกสารอ้างอิง', 'บทความเจาะลึก', 'บทความแนะนำ',
              'สรุป', 'Q&A', 'FAQ', 'คำถามที่พบบ่อย', 'NOTE SEO Writer'
            ];
            for (const pattern of specialPatterns) {
              if (currentText.startsWith(pattern) || nextText.startsWith(pattern)) return;
            }
            
            // ไม่รวมถ้ามี image หรือ heading indicator
            if (p.querySelector('img') || nextP.querySelector('img')) return;
            if (/^H\s*:\s*[1-6]/i.test(currentText) || /^H\s*:\s*[1-6]/i.test(nextText)) return;
            
            // ไม่รวมถ้าเป็น quote
            if (/^[""]/.test(currentText) || /^[""]/.test(nextText)) return;
            
            // รวมถ้า p ตัวแรกลงท้ายด้วย <br> หรือทั้งสองข้อความค่อนข้างสั้น
            const currentHTML = p.innerHTML.trim();
            const hasTrailingBr = /<br\s*\/?>$/i.test(currentHTML);
            const isBothShort = currentText.length < 100 && nextText.length < 100;
            
            if (hasTrailingBr || isBothShort) {
              // รวม paragraph ถัดไปเข้ากับ paragraph ปัจจุบัน
              if (hasTrailingBr) {
                // มี <br> อยู่แล้ว เก็บไว้
                p.innerHTML = currentHTML + nextP.innerHTML;
              } else {
                // ไม่มี <br> เพิ่มเข้าไป
                p.innerHTML = currentHTML + '<br>' + nextP.innerHTML;
              }
              
              // คงค่า alignment หลังจากรวม
              if (currentAlign) {
                p.style.textAlign = currentAlign;
                p.dataset.align = currentAlign;
              }
              
              nextP.remove();
            }
          });
        })();
        // === End รวมย่อหน้า (Shift+Enter) ===
        
        // --- Underline normalization (CSS/MSO -> <u> on phrasing) ---
        (function normalizeUnderline(doc){
          const PHRASING = new Set(['A','ABBR','B','BDI','BDO','BR','CITE','CODE','DATA','DFN','EM','I','IMG','KBD','MARK','Q','RB','RP','RT','RTC','RUBY','S','SAMP','SMALL','SPAN','STRONG','SUB','SUP','TIME','U','VAR','WBR']);
          const underlineRe = /\btext-decoration(?:-line)?\s*:\s*underline\b/i;
          const msoRe = /\bmso-(?:text-)?underline\s*:\s*single\b/i;
          const hasUnderline = (style) => underlineRe.test(style) || msoRe.test(style);

          function cleanStyle(style) {
            return style
              .replace(/text-decoration(?:-line)?\s*:\s*underline;?/gi, '')
              .replace(/mso-(?:text-)?underline\s*:\s*single;?/gi, '')
              .trim();
          }
          function wrapNodeWithU(node) {
            const u = doc.createElement('u');
            node.parentNode.insertBefore(u, node);
            u.appendChild(node);
          }
          function wrapTextInElement(el) {
            Array.from(el.childNodes).forEach((n) => {
              if (n.nodeType === Node.TEXT_NODE) {
                if (n.nodeValue && n.nodeValue.trim()) wrapNodeWithU(n);
              } else if (n.nodeType === Node.ELEMENT_NODE) {
                if (n.nodeName === 'U') return;
                if (PHRASING.has(n.nodeName)) wrapNodeWithU(n);
                else wrapTextInElement(n);
              }
            });
          }

          doc.querySelectorAll('[style]').forEach((el) => {
            const style = el.getAttribute('style') || '';
            if (!hasUnderline(style)) return;

            if (PHRASING.has(el.nodeName)) {
              if (!(el.childNodes.length === 1 && el.firstChild.nodeType === 1 && el.firstChild.nodeName === 'U')) {
                el.innerHTML = `<u>${el.innerHTML}</u>`;
              }
            } else {
              wrapTextInElement(el);
            }

            const cleaned = cleanStyle(style);
            if (cleaned) el.setAttribute('style', cleaned); else el.removeAttribute('style');
          });
        })(doc);
        // --- End Underline normalization ---
    

        // console.log(doc);

        // Remove all content before the <h1></h1> tag
        let articleStart = null;
        let articleStartImg = null;
        [...doc.querySelectorAll('h1')].some(h1 => {
          const headImg = h1.querySelectorAll('img');
          articleStart = h1;
          articleStartImg = headImg;
          return true;
        });

        if (articleStart) {
          // ลบเนื้อหาก่อน H1 ทั้งหมดเสมอ
          let previousSibling = articleStart.previousSibling;
          while (previousSibling) {
            const temp = previousSibling.previousSibling;
            previousSibling.remove();
            previousSibling = temp;
          }
          
          const _nextEl = (articleStart && articleStart.nextElementSibling) ? articleStart.nextElementSibling : null;
          const _isNextTable = _nextEl && _nextEl.tagName && _nextEl.tagName.toLowerCase() === 'table';
          if (_isNextTable) {
            // ถ้า H1 ตามด้วย table ให้ลบ H1 แต่เก็บ table ไว้ให้ heading converter จัดการ
            articleStart.remove();
          } else {
            if (articleStartImg.length > 0) {
              if (articleStartImg.length > 1) {
                const headImgItems = Array.from(articleStartImg).map(img => {
                  const columnUniqueID = `70684_${Math.random().toString(36).substr(2, 9)}`;
                  return `<!-- wp:kadence/column {"borderWidth":["","","",""],"uniqueID":"${columnUniqueID}","borderStyle":[{"top":["","",""],"right":["","",""],"bottom":["","",""],"left":["","",""],"unit":"px"}]} -->
<div class="wp-block-kadence-column kadence-column${columnUniqueID}"><div class="kt-inside-inner-col"><!-- wp:image -->
<figure class="wp-block-image"><img alt=""/></figure>
<!-- /wp:image --></div></div>
<!-- /wp:kadence/column -->`;
                }).join('');
                const rowUniqueID = `70684_${Math.random().toString(36).substr(2, 9)}`;
                articleStart.outerHTML = `<!-- wp:kadence/rowlayout {"uniqueID":"${rowUniqueID}","colLayout":"equal","kbVersion":2} -->${headImgItems}<!-- /wp:kadence/rowlayout -->`;
              } else {
                articleStart.outerHTML = `<!-- wp:image --><figure class="wp-block-image"><img alt=""/></figure><!-- /wp:image -->`;
              }
            } else {
              articleStart.remove(); // Remove the <h1></h1> itself
            }
          }
        }

        // Remove all content after the <p><strong>NOTE SEO Writer</strong></p> tag
        let noteSEOStart = null;
        doc.querySelectorAll('p').forEach(p => {
          const text = p.textContent.toLowerCase().trim();
          if (text === 'note seo writer') {
            noteSEOStart = p;
          }
        });

        if (noteSEOStart) {
          let nextSibling = noteSEOStart.nextSibling;
          while (nextSibling) {
            const temp = nextSibling.nextSibling;
            nextSibling.remove();
            nextSibling = temp;
          }
          noteSEOStart.remove(); // Remove the <p><strong>NOTE SEO Writer</strong></p> itself
        }

        // Find all <p> tags and modify them based on their content and child elements
        let checkReferences = false;
        // ⚠️ แปลง NodeList เป็น Array เพื่อหลีกเลี่ยง live collection issue
        Array.from(doc.querySelectorAll('p')).forEach((p) => {
          // 🔒 ตรวจสอบว่า element ยังอยู่ใน DOM หรือไม่
          if (!p.parentNode) return;

          // 🔒 ป้องกันการแปลงซ้ำ - ถ้า paragraph นี้ถูกแปลงไปแล้ว ข้าม
          if (p.dataset && p.dataset.handled === "1") return;
          // 🔒 ป้องกันการแปลง readmore ซ้ำ
          if (p.hasAttribute("data-readmore")) return;

          // --- Guard to avoid duplicate images above RowLayout (table) ---
          try {
            const imgsInP = p.querySelectorAll && p.querySelectorAll('img');
            if (imgsInP && imgsInP.length > 0) {
              let ne = p.nextSibling;
              while (ne && ne.nodeType === 3 && !(ne.textContent || '').trim()) ne = ne.nextSibling;
              const isNextTable = ne && ne.nodeType === 1 && ne.tagName && ne.tagName.toLowerCase() === 'table';
              if (isNextTable) { p.remove(); return; }
            }
          } catch (e) {}
          // --- End guard ---

          // ---- YouTube link -> WP embed <figure> ----
          try {
            // ป้องกันการแปลงซ้ำ (ถ้าเป็น figure หรือ embed อยู่แล้ว)
            if (p.tagName && p.tagName.toLowerCase() === 'figure') return;
            if (p.classList && p.classList.contains('wp-block-embed')) return;

            // ดึง text content จาก paragraph
            const rawText = p.textContent.trim();

            // ตรวจสอบว่ามี YouTube URL หรือไม่
            if (isYouTubeUrl(rawText)) {
              // แยก URL + caption (ถ้ามี)
              const { url, caption } = extractYouTubeCaption(rawText);

              // 🔒 ทำเครื่องหมายว่าแปลงแล้ว (ก่อนแทนที่ outerHTML)
              if (p.dataset) p.dataset.handled = "1";

              // สร้าง YouTube block พร้อม caption (ถ้ามี)
              const ytBlock = createYouTubeGutenbergBlock(url, caption);

              // ⚠️ ตรวจสอบว่ายังมี parent ก่อนแก้ไข
              if (p.parentNode) {
                p.outerHTML = ytBlock;
              }
              return;
            }
          } catch (e) {}
          // ---- end YouTube link -> embed ----

          // Caption detection: ข้อความใต้รูป/ลิงก์คลิปที่เป็นตัวเอียง -> caption-img
          try {
            const prev = p.previousElementSibling;
            const html = (p.innerHTML || '').trim();
            const styleAttr = p.getAttribute('style') || '';
            
            // ตรวจจับ italic
            const isItalicPara = (
              /<(em|i)(\s|>)/i.test(html) || 
              /font-style\s*:\s*italic/i.test(styleAttr)
            );
            
            // ตรวจสอบว่าอยู่ใต้รูปภาพหรือไม่
            const hasImgAbove = prev && (
              (prev.tagName && prev.tagName.toLowerCase() === 'figure' && prev.querySelector('img')) || 
              (prev.querySelector && prev.querySelector('img'))
            );
            
            // ตรวจสอบว่าอยู่ใต้บล็อกคลิป/ลิงก์ YouTube หรือไม่
            const hasVideoAbove = prev && (
              (prev.tagName && prev.tagName.toLowerCase() === 'figure' && prev.querySelector('iframe')) ||
              (prev.querySelector && prev.querySelector('iframe')) ||
              (prev.tagName && prev.tagName.toLowerCase() === 'div' && prev.querySelector('iframe'))
            );
            
            // ตรวจสอบว่ามีลิงก์ youtube/vimeo อยู่ภายในหรือไม่
            const hasVideoLink = (
              /youtube\.com|youtu\.be|vimeo\.com/i.test(html) ||
              p.querySelector('a[href*="youtube"]') ||
              p.querySelector('a[href*="youtu.be"]') ||
              p.querySelector('a[href*="vimeo"]')
            );
            
            // ถ้าเป็น paragraph ที่เป็นตัวเอียง และอยู่ใต้รูป/คลิป หรือมีลิงก์คลิป ให้เป็น caption-img
            if (!p.closest('table') && isItalicPara && (hasImgAbove || hasVideoAbove || hasVideoLink)) {
              // Extract text color from style (if not black)
              const colorMatch = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
              const textColor = colorMatch ? colorMatch[1].trim() : null;
              const isBlackColor = !textColor || ['#000000', '#000', 'black', 'rgb(0, 0, 0)', 'rgb(0,0,0)'].includes(textColor.toLowerCase());
              
              // Build caption-img block with color if available
              let captionAttrs = '"align":"center"';
              let captionClasses = 'has-text-align-center caption-img';
              let captionInlineStyle = '';
              
              if (textColor && !isBlackColor) {
                captionAttrs += `,"style":{"color":{"text":"${textColor}"},"elements":{"link":{"color":{"text":"${textColor}"}}}}`;
                captionClasses += ' has-text-color has-link-color';
                captionInlineStyle = ` style="color:${textColor}"`;
              }
              
              p.outerHTML = `<!-- wp:paragraph {${captionAttrs}} --><p class="${captionClasses}"${captionInlineStyle}>${html}</p><!-- /wp:paragraph -->`;
              return;
            }
          } catch (e) {}
    
          
          
          // Bold+Underline title above image => center it (skip tables). Allow up to 3 blank paragraphs in between.
          try {
            const htmlBU = (p.innerHTML || '').trim();
            const hasBold = /<(strong|b)(\s|>)/i.test(htmlBU) || /font-weight\s*:\s*(bold|[7-9]00)/i.test(p.getAttribute('style') || '') || /font-weight\s*:\s*(bold|[7-9]00)/i.test(htmlBU);
            const hasUnderlineTag = /<u(\s|>)/i.test(htmlBU);
            const hasUnderlineStyle = /text-decoration\s*:\s*underline/i.test(p.getAttribute('style') || '') || /text-decoration\s*:\s*underline/i.test(htmlBU);
            const hasUnderline = hasUnderlineTag || hasUnderlineStyle;

            // look ahead to next non-empty sibling (allow a few blanks)
            let hops2 = 0;
            let nextEl = p.nextElementSibling;
            const isBlankPara2 = (el) => {
              if (!el || !(el.tagName && el.tagName.toLowerCase() === 'p')) return false;
              const inner = (el.innerHTML || '').replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, ' ').trim();
              return inner === '';
            };
            while (nextEl && hops2 < 3 && isBlankPara2(nextEl)) {
              nextEl = nextEl.nextElementSibling;
              hops2++;
            }
            const hasImgBelow = nextEl && nextEl.querySelector && nextEl.querySelector('img');

            if (!p.closest('table') && hasBold && hasUnderline && hasImgBelow) {
              const html = (p.innerHTML || '').trim();
              p.outerHTML = `<!-- wp:paragraph {"align":"center"} --><p class="has-text-align-center">${html}</p><!-- /wp:paragraph -->`;
              return;
            }
          } catch (e) {}
// Skip paragraphs inside tables to avoid duplicate images
          if (p.closest && p.closest('table')) { return; }
const tagImg = p.querySelectorAll('img');
          let textContent = p.textContent.trim();
          const startsWithQuote = textContent.startsWith('"') || textContent.startsWith('"');
          const endsWithQuote = textContent.endsWith('"') || textContent.endsWith('"');
          let textHtml = p.innerHTML.replace(/(?:h[1-6]|h [1-6]|header tag [1-6]|header tag[1-6]|header[1-6]|header [1-6]) ?/gi, '').trim();
          if (textHtml.startsWith(':')) {
            textHtml = textHtml.replace(':', '').trim();
          }

          if (textContent.startsWith('สารบัญ') || textContent.startsWith('คลิกอ่านหัวข้อ')) {
            // Ensure "สารบัญ" has proper format with <strong> tag
            const hasStrongTag = /<strong>.*?สารบัญ.*?<\/strong>/i.test(textHtml);
            let finalHtml = textHtml;
            
            // If "สารบัญ" doesn't have <strong> tag, add it
            if (textContent.trim() === 'สารบัญ' && !hasStrongTag) {
              finalHtml = '<strong>สารบัญ</strong>';
            } else if (textContent.trim() === 'สารบัญ' && hasStrongTag) {
              // Already has strong tag, keep as is
              finalHtml = textHtml;
            }
            
            p.outerHTML = `<!-- wp:paragraph {"className":"subtext-gtb"} --><p class="subtext-gtb">${finalHtml}</p><!-- /wp:paragraph -->`;
          } else if ((!textContent && tagImg.length === 0) ||
                     /^(Alt|alt|ALT)\s*:\s*/i.test(textContent) ||
                     /\b(Alt|alt|ALT)\s*:\s*/i.test(textContent) ||
                     /^(Alt|alt|ALT):/i.test(textContent) ||
                     textContent.match(/(^|\s)(alt\s*:\s*|alt\s*:)/i) ||
                     textContent.startsWith('(alt') ||
                     textContent.startsWith('(Alt') ||
                     textContent.startsWith('(ALT')) {
            p.remove();
          } else if (
            textContent.startsWith('อ่านบทความเพิ่มเติม') ||
            textContent.startsWith('อ่านเพิ่มเติม') ||
            textContent.startsWith('คลิกอ่านเพิ่มเติม') ||
            textContent.startsWith('คลิกอ่านบทความ') ||
            textContent.startsWith('หมอได้สรุปข้อมูล') ||
            textContent.startsWith('อ่านบทความแนะนำ') ||
            textContent.includes('อ่านบทความเพิ่มเติม') ||
            textContent.includes('อ่านบทความแนะนำ')
          ) {
            // ถ้าเคยแปลงแล้วให้ข้าม
            if (p.hasAttribute('data-readmore')) return;

            // กันไม่ให้ block นี้โดนประมวลผลซ้ำ
            p.setAttribute('data-readmore', '1');
            if (p.dataset) p.dataset.handled = '1';

            const linkElement = p.querySelector('a');

            if (linkElement) {
              const href = linkElement.getAttribute('href') || '#';
              const linkText =
                linkElement.textContent || linkElement.innerText || '';

              p.outerHTML =
                `<!-- wp:paragraph {"className":"vsq-readmore"} -->` +
                `<p class="vsq-readmore">อ่านบทความเพิ่มเติม : ` +
                `<a href="${href}" target="_blank" rel="noreferrer noopener">${linkText}</a>` +
                `</p>` +
                `<!-- /wp:paragraph -->`;
            } else {
              p.outerHTML =
                `<!-- wp:paragraph {"className":"vsq-readmore"} -->` +
                `<p class="vsq-readmore">อ่านบทความเพิ่มเติม :</p>` +
                `<!-- /wp:paragraph -->`;
            }
            return;
          } else if (textContent.replace(/(?:h[1-6]|h [1-6]|header tag [1-6]|header tag[1-6]|header[1-6]|header [1-6]) ?/gi, '').replace(':', '').trim().startsWith('สรุป')) {
            // This is for paragraphs that are "สรุป" - should be converted to heading instead
            textHtml = textHtml.replace(/<\/?[^>]+(>|$)/g, '').replace(':', '').trim();
            // Don't add subtext-gtb here - it will be added in heading conversion
            p.outerHTML = `<!-- wp:paragraph --><p>${textHtml}</p><!-- /wp:paragraph -->`;
          } else if (textContent.startsWith('อ้างอิง') || textContent.startsWith('เอกสารอ้างอิง') || textContent.startsWith('เอกสาร อ้างอิง') || textContent.startsWith('แหล่งข้อมูลอ้างอิง')) {
            p.outerHTML = `<!-- wp:separator --><hr class="wp-block-separator has-alpha-channel-opacity"/><!-- /wp:separator --><!-- wp:paragraph {"className":"references"} --><p class="references">${textHtml}</p><!-- /wp:paragraph -->`;
            checkReferences = true;
          } else if (textContent === 'บทความเจาะลึก' || textContent === 'บทความแนะนำ') {
            p.outerHTML = `<!-- wp:paragraph {"align":"center","className":"headline"} --><p class="has-text-align-center headline">${textHtml}</p><!-- /wp:paragraph -->`;

          // ❌ DISABLED: YouTube logic เก่า - ใช้ logic ใหม่ที่ด้านบนแทน (บรรทัด 849-872)
          /*
          else if (textContent.match(/^\s*(https?:\/\/(www\.|m\.)?youtube\.com\/|https?:\/\/youtu\.be\/)/i)) {
            // ตรวจจับและจัดการลิงก์ YouTube ตามกฎใหม่
            let youtubeUrl = textContent.trim();

            // ตรวจสอบว่ามี <img> อยู่ใกล้หรือในแท็ก <a> เดียวกันหรือไม่
            const hasImgNearby = p.querySelector('img') !== null ||
                                 p.querySelector('a img') !== null ||
                                 (p.previousElementSibling && p.previousElementSibling.querySelector('img')) ||
                                 (p.nextElementSibling && p.nextElementSibling.querySelector('img'));

            // หากมี <img> อยู่ใกล้ ให้ข้ามการแปลง
            if (hasImgNearby) {
              // คงรูปแบบเดิมไว้
              return;
            }

            // ตรวจสอบว่ามีข้อความในบรรทัดถัดไปหรือไม่
            let captionText = '';
            const nextP = p.nextElementSibling;
            if (nextP && nextP.tagName && nextP.tagName.toLowerCase() === 'p') {
              const nextText = nextP.textContent.trim();
              const nextHtml = nextP.innerHTML.trim();

              // ตรวจสอบว่าเป็นแคปชั่นหรือไม่ (ข้อความสั้นๆ และไม่ใช่ special content)
              const isCaption = (
                nextText.length > 0 &&
                nextText.length < 200 &&
                !nextText.startsWith('สารบัญ') &&
                !nextText.startsWith('อ้างอิง') &&
                !nextText.startsWith('สรุป') &&
                !nextText.startsWith('Q&A') &&
                !nextText.startsWith('FAQ') &&
                !nextText.startsWith('อ่านเพิ่มเติม') &&
                !nextText.startsWith('บทความ') &&
                !nextText.match(/^H\s*:\s*[1-6]/i) && // ไม่ใช่ heading indicator
                (nextHtml.includes('<em>') || nextHtml.includes('<i>') ||
                 nextText.includes('แคปชั่น') || nextText.includes('caption') ||
                 nextText.includes('เครดิต') || nextText.includes('credit'))
              );

              if (isCaption) {
                captionText = nextHtml;
                // ลบ paragraph ที่เป็นแคปชั่น
                nextP.remove();
              }
            }

            // สร้าง Gutenberg YouTube Embed Block พร้อมบรรทัดว่าง
            let embedBlock = `

<!-- wp:embed {"url":"${youtubeUrl}","type":"video","providerNameSlug":"youtube","responsive":true,"className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} -->
<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio">
  <div class="wp-block-embed__wrapper">
    ${youtubeUrl}
  </div>`;

            // เพิ่ม figcaption ถ้ามีแคปชั่น
            if (captionText) {
              embedBlock += `
  <figcaption class="wp-element-caption">${captionText}</figcaption>`;
            }

            embedBlock += `
</figure>
<!-- /wp:embed -->

`;

            p.outerHTML = embedBlock;
          else if (p.querySelector('a[href*="youtube.com"], a[href*="youtu.be"]')) {
            // ตรวจจับลิงก์ YouTube ที่อยู่ใน <a> tag
            const youtubeLink = p.querySelector('a[href*="youtube.com"], a[href*="youtu.be"]');
            const youtubeUrl = youtubeLink.getAttribute('href');

            // ตรวจสอบว่าลิงก์ YouTube อยู่ในแท็ก <a> ที่ครอบ <img> หรือไม่
            const hasImgInLink = youtubeLink.querySelector('img') !== null;

            // หากลิงก์ YouTube อยู่ในแท็ก <a> ที่ครอบ <img> ให้คงรูปแบบเดิมไว้
            if (hasImgInLink) {
              // คงรูปแบบเดิมไว้
              return;
            }

            // ตรวจสอบว่ามี <img> อยู่ใกล้หรือไม่
            const hasImgNearby = p.querySelector('img') !== null ||
                                 (p.previousElementSibling && p.previousElementSibling.querySelector('img')) ||
                                 (p.nextElementSibling && p.nextElementSibling.querySelector('img'));

            // หากมี <img> อยู่ใกล้ ให้ข้ามการแปลง
            if (hasImgNearby) {
              // คงรูปแบบเดิมไว้
              return;
            }

            // ตรวจสอบว่ามีข้อความในบรรทัดถัดไปหรือไม่
            let captionText = '';
            const nextP = p.nextElementSibling;
            if (nextP && nextP.tagName && nextP.tagName.toLowerCase() === 'p') {
              const nextText = nextP.textContent.trim();
              const nextHtml = nextP.innerHTML.trim();

              // ตรวจสอบว่าเป็นแคปชั่นหรือไม่ (ข้อความสั้นๆ และไม่ใช่ special content)
              const isCaption = (
                nextText.length > 0 &&
                nextText.length < 200 &&
                !nextText.startsWith('สารบัญ') &&
                !nextText.startsWith('อ้างอิง') &&
                !nextText.startsWith('สรุป') &&
                !nextText.startsWith('Q&A') &&
                !nextText.startsWith('FAQ') &&
                !nextText.startsWith('อ่านเพิ่มเติม') &&
                !nextText.startsWith('บทความ') &&
                !nextText.match(/^H\s*:\s*[1-6]/i) && // ไม่ใช่ heading indicator
                (nextHtml.includes('<em>') || nextHtml.includes('<i>') ||
                 nextText.includes('แคปชั่น') || nextText.includes('caption') ||
                 nextText.includes('เครดิต') || nextText.includes('credit'))
              );

              if (isCaption) {
                captionText = nextHtml;
                // ลบ paragraph ที่เป็นแคปชั่น
                nextP.remove();
              }
            }

            // สร้าง Gutenberg YouTube Embed Block พร้อมบรรทัดว่าง
            let embedBlock = `

<!-- wp:embed {"url":"${youtubeUrl}","type":"video","providerNameSlug":"youtube","responsive":true,"className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} -->
<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio">
  <div class="wp-block-embed__wrapper">
    ${youtubeUrl}
  </div>`;

            // เพิ่ม figcaption ถ้ามีแคปชั่น
            if (captionText) {
              embedBlock += `
  <figcaption class="wp-element-caption">${captionText}</figcaption>`;
            }

            embedBlock += `
</figure>
<!-- /wp:embed -->

`;

            p.outerHTML = embedBlock;
          */
          } else if (tagImg.length > 0) {
            // 1) ตรวจจับว่า paragraph ถัดไปเป็นตัวเอียง = caption
            const nextP = p.nextElementSibling;
            let captionHTML = '';
            if (nextP && nextP.tagName === 'P') {
              const extracted = extractImageCaptionFromParagraph(nextP);
              if (extracted) {
                captionHTML = extracted;
                nextP.remove();
              }
            }

            // 2) หากเป็นรูปหลายรูป ให้ใช้ logic เดิม
            if (tagImg.length > 1) {
              // Check for Alt: text in the paragraph
              let altText = '';
              let captionText = '';
              const paragraphText = textContent.trim();

              // Enhanced Alt detection for "Alt:" and "Alt :" patterns in paragraphs
              const altMatch = paragraphText.match(/(^|\s)(alt\s*:\s*|alt\s+:\s*)([^\n\r]*)/i);
              if (altMatch) {
                altText = altMatch[3].trim();
                // Remove Alt: text from main content for caption detection
                const textWithoutAlt = paragraphText.replace(/(^|\s)(alt\s*:\s*|alt\s+:\s*)([^\n\r]*)/i, '').trim();

                // Check if remaining text should be treated as caption
                if (textWithoutAlt) {
                  const isTextCentered = isCaptionLikelyCentered(p);
                  const isTextItalic = textHtml.includes('<em>') ||
                                      textHtml.includes('<i>') ||
                                      textHtml.includes('font-style: italic') ||
                                      textHtml.includes('font-style:italic') ||
                                      textHtml.includes('font-style : italic') ||
                                      p.querySelector('em') !== null ||
                                      p.querySelector('i') !== null;

                  if (isTextCentered && isTextItalic) {
                    captionText = textWithoutAlt;
                  }
                }
              } else if (paragraphText) {
                // Check if the text should be treated as a caption (centered and italic)
                const isTextCentered = isCaptionLikelyCentered(p);
                const isTextItalic = textHtml.includes('<em>') ||
                                    textHtml.includes('<i>') ||
                                    textHtml.includes('font-style: italic') ||
                                    textHtml.includes('font-style:italic') ||
                                    textHtml.includes('font-style : italic') ||
                                    p.querySelector('em') !== null ||
                                    p.querySelector('i') !== null;

                if (isTextCentered && isTextItalic) {
                  captionText = paragraphText;
                }
              }

              // ⭐ เก็บสำเนารูปก่อนลบทิ้ง เพื่อไม่ให้ข้อมูลหาย
              const imgs = Array.from(tagImg);

              // ลบ <img> ออกจาก <p>
              imgs.forEach(img => img.remove());

              // ใช้ imgs ที่สำรองไว้เพื่อสร้าง block
              const newImgItems = imgs.map((img, imgIndex) => {
                const columnUniqueID = `70684_${Math.random().toString(36).substr(2, 9)}`;
                let columnContent = `<!-- wp:image -->
<figure class="wp-block-image"><img alt="${altText}"/></figure>
<!-- /wp:image -->`;

                // Add caption only to the first image if there's caption text
                if (imgIndex === 0 && captionText) {
                  columnContent += `
<!-- wp:paragraph {"align":"center"} -->
<p class="has-text-align-center">${captionText}</p>
<!-- /wp:paragraph -->`;
                }

                return `<!-- wp:kadence/column {"borderWidth":["","","",""],"uniqueID":"${columnUniqueID}","borderStyle":[{"top":["","",""],"right":["","",""],"bottom":["","",""],"left":["","",""],"unit":"px"}]} -->
<div class="wp-block-kadence-column kadence-column${columnUniqueID}"><div class="kt-inside-inner-col">${columnContent}</div></div>
<!-- /wp:kadence/column -->`;
              }).join('');

              const rowUniqueID = `70684_${Math.random().toString(36).substr(2, 9)}`;

              // 🔒 ทำเครื่องหมายว่าแปลงแล้ว (ก่อนแทนที่ outerHTML)
              if (p.dataset) p.dataset.handled = "1";

              // ⚠️ ตรวจสอบว่ายังมี parent ก่อนแก้ไข
              if (p.parentNode) {
                p.outerHTML = `<!-- wp:kadence/rowlayout {"uniqueID":"${rowUniqueID}","colLayout":"equal","kbVersion":2} -->${newImgItems}<!-- /wp:kadence/rowlayout -->`;
              }
              return;
            }

            // 3) รูปเดี่ยว — ใช้ Gutenberg block แบบเต็ม
            const img = tagImg[0];
            const meta = extractImageMetaFromTag(img, captionHTML);
            const block = createFullImageBlock(meta);

            // 🔒 ทำเครื่องหมายว่าแปลงแล้ว (ก่อนแทนที่ outerHTML)
            if (p.dataset) p.dataset.handled = "1";

            // ⚠️ ตรวจสอบว่ายังมี parent ก่อนแก้ไข
            if (p.parentNode) {
              p.outerHTML = block;
            }
            return;
          } else if (startsWithQuote && endsWithQuote) {
            textContent = textContent.slice(1, -1).trim();
            p.outerHTML = `<!-- wp:quote --><blockquote class="wp-block-quote"><!-- wp:paragraph --><p>${textContent}</p><!-- /wp:paragraph --></blockquote><!-- /wp:quote -->`;
          } else if (textContent.startsWith('ข้อควรรู้')) {
            p.outerHTML = `<!-- wp:quote --><blockquote class="wp-block-quote"><!-- wp:paragraph --><p>${textContent}</p><!-- /wp:paragraph --></blockquote><!-- /wp:quote -->`;
          } else if (textContent === 'แอด Line@ เพื่อรับโปรโมชั่น' || textContent === 'แอด Line@ เพื่อรับโปรโมชัน') {
            const hasLink = p.querySelector('a') !== null;
            if (hasLink) {
              const Link = p.querySelector('a').getAttribute('href');
              p.outerHTML = `<!-- wp:paragraph {"align":"center","className":"headline"} --><p class="has-text-align-center headline">${textContent}</p><!-- /wp:paragraph --><!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} --><div class="wp-block-buttons"><!-- wp:button {"className":"btn-addline"} --><div class="wp-block-button btn-addline"><a class="wp-block-button__link wp-element-button" href="${Link}">Add LINE</a></div><!-- /wp:button --></div><!-- /wp:buttons -->`;
            } else {
              p.outerHTML = `<!-- wp:paragraph {"align":"center","className":"headline"} --><p class="has-text-align-center headline">${textContent}</p><!-- /wp:paragraph --><!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} --><div class="wp-block-buttons"><!-- wp:button {"className":"btn-addline"} --><div class="wp-block-button btn-addline"><a class="wp-block-button__link wp-element-button">Add LINE</a></div><!-- /wp:button --></div><!-- /wp:buttons -->`;
            }
          } else {
            // ตรวจจับการจัดกลางโดยใช้ isExplicitCentered (ตรวจเฉพาะ element นั้นเอง)
            const isCentered = isExplicitCentered(p);
            
            if (checkReferences) {
                // Check if paragraph is centered
                if (isCentered) {
                  p.outerHTML = `<!-- wp:paragraph {"align":"center","className":"references"} --><p class="has-text-align-center references">${textHtml}</p><!-- /wp:paragraph -->`;
                } else {
                  p.outerHTML = `<!-- wp:paragraph {"className":"references"} --><p class="references">${textHtml}</p><!-- /wp:paragraph -->`;
              }
              } else {
                // Check if paragraph is centered
                if (isCentered) {
                  p.outerHTML = `<!-- wp:paragraph {"align":"center"} --><p class="has-text-align-center">${textHtml}</p><!-- /wp:paragraph -->`;
                } else {
                  p.outerHTML = `<!-- wp:paragraph --><p>${textHtml}</p><!-- /wp:paragraph -->`;
              }
            }
          }
        });

        // Helper function to generate ID from text (used for both headings and menu links)
        const generateHashId = (text) => {
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
        };

        // Process paragraphs that might contain H:1, H:2, H:3 indicators
        doc.querySelectorAll('p').forEach(p => {
          const text = p.textContent.trim();
          // eslint-disable-next-line no-unused-vars
          const htmlContent = p.innerHTML.trim();
          
          // Check if paragraph starts with H:1, H:2, H:3, H:4, H:5, or H:6
          const headingMatch = text.match(/^H\s*:\s*([1-6])\s+(.+)$/i);
          if (headingMatch) {
            const level = headingMatch[1];
            const headingText = headingMatch[2].trim();
            
            // Create a heading element
            const newHeading = doc.createElement(`h${level}`);
            newHeading.textContent = headingText;
            
            // Replace paragraph with heading
            p.replaceWith(newHeading);
          }
        });

        // Remove <a> tags within headings
        doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
          heading.querySelectorAll('a').forEach(a => {
            const parent = a.parentNode;
            while (a.firstChild) parent.insertBefore(a.firstChild, a);
            parent.removeChild(a);
          });
        });

        // Convert heading tags to Gutenberg format
        doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading, index) => {
          const level = heading.tagName.toLowerCase();
          const levelNumber = level.match(/\d+/)[0];
          const headingContent = heading.innerHTML.trim();
          let headingText = headingContent.replace(/1st/gi, '').replace(/(?:h[1-6]|h [1-6]|header tag [1-6]|header tag[1-6]|header[1-6]|header [1-6]) ?/gi, '').trim();
          if (headingText.startsWith(':')) {
            headingText = headingText.replace(':', '').trim();
          }
          const hashTagId = generateHashId(headingText); 
          const tagImg = heading.querySelectorAll('img');
          const textOnly = headingText.replace(/<\/?[^>]+(>|$)/g, '');
          
          // ตรวจจับการจัดกลางของ heading โดยใช้ isExplicitCentered (ตรวจเฉพาะ element นั้นเอง)
          const isHeadingCentered = isExplicitCentered(heading);
          
          let blockSeparator = `<!-- wp:separator --><hr class="wp-block-separator has-alpha-channel-opacity"/><!-- /wp:separator -->`;
          let blockTarget = `<!-- wp:ps2id-block/target --><div class="wp-block-ps2id-block-target" id="${hashTagId}"></div><!-- /wp:ps2id-block/target -->`;
          let classBlock = `class="wp-block-heading"`;
          let attrLevel = ` {"level":${levelNumber}}`;
          
          // เพิ่ม textAlign center ถ้า heading เป็นการจัดกลาง
          if (isHeadingCentered) {
            classBlock = `class="wp-block-heading has-text-align-center"`;
            if (level === 'h2') {
              attrLevel = ` {"textAlign":"center"}`;
            } else {
              attrLevel = ` {"textAlign":"center","level":${levelNumber}}`;
            }
          } else {
            if (level === 'h2') {
              attrLevel = '';
            }
          }
          if (index === 0) {
            blockSeparator = '';
            blockTarget = '';
          }
          // console.log('TEXT: ' + textOnly + ' | IMG: ' + tagImg.length);
          // console.log('number: ' + index + ' | TEXT: ' + textOnly);

          let gutenbergHeading = '';
          // If the next element after this heading is a TABLE, skip creating image blocks from the heading
          const _nextElHeading = heading.nextElementSibling;
          const _isNextTableHeading = _nextElHeading && _nextElHeading.tagName && _nextElHeading.tagName.toLowerCase() === 'table';


          if (!textOnly && tagImg.length === 0) {
            heading.remove();
          } else {
            if (textOnly && tagImg.length > 0 && !_isNextTableHeading) {
              // Remove all img tags from this heading first to prevent duplicate processing
              tagImg.forEach(img => img.remove());
              
              if (tagImg.length > 1) {
                const newImgItems = Array.from(tagImg).map(img => {
                  const columnUniqueID = `70684_${Math.random().toString(36).substr(2, 9)}`;
                  return `<!-- wp:kadence/column {"borderWidth":["","","",""],"uniqueID":"${columnUniqueID}","borderStyle":[{"top":["","",""],"right":["","",""],"bottom":["","",""],"left":["","",""],"unit":"px"}]} -->
<div class="wp-block-kadence-column kadence-column${columnUniqueID}"><div class="kt-inside-inner-col"><!-- wp:image -->
<figure class="wp-block-image"><img alt=""/></figure>
<!-- /wp:image --></div></div>
<!-- /wp:kadence/column -->`;
                }).join('');
                const rowUniqueID = `70684_${Math.random().toString(36).substr(2, 9)}`;
                gutenbergHeading = `${blockSeparator}${blockTarget}<!-- wp:heading${attrLevel} --><${level} ${classBlock}>${textOnly}</${level}><!-- /wp:heading --><!-- wp:kadence/rowlayout {"uniqueID":"${rowUniqueID}","colLayout":"equal","kbVersion":2} -->${newImgItems}<!-- /wp:kadence/rowlayout -->`;
              } else {
                gutenbergHeading = `${blockSeparator}${blockTarget}<!-- wp:heading${attrLevel} --><${level} ${classBlock}>${textOnly}</${level}><!-- /wp:heading --><!-- wp:image --><figure class="wp-block-image"><img alt=""/></figure><!-- /wp:image -->`;
              }
            } else if (!textOnly && tagImg.length > 0 && !_isNextTableHeading) {
              // Remove all img tags from this heading first to prevent duplicate processing
              tagImg.forEach(img => img.remove());
              
              if (tagImg.length > 1) {
                const newImgItems = Array.from(tagImg).map(img => {
                  const columnUniqueID = `70684_${Math.random().toString(36).substr(2, 9)}`;
                  return `<!-- wp:kadence/column {"borderWidth":["","","",""],"uniqueID":"${columnUniqueID}","borderStyle":[{"top":["","",""],"right":["","",""],"bottom":["","",""],"left":["","",""],"unit":"px"}]} -->
<div class="wp-block-kadence-column kadence-column${columnUniqueID}"><div class="kt-inside-inner-col"><!-- wp:image -->
<figure class="wp-block-image"><img alt=""/></figure>
<!-- /wp:image --></div></div>
<!-- /wp:kadence/column -->`;
                }).join('');
                const rowUniqueID = `70684_${Math.random().toString(36).substr(2, 9)}`;
                gutenbergHeading = `<!-- wp:kadence/rowlayout {"uniqueID":"${rowUniqueID}","colLayout":"equal","kbVersion":2} -->${newImgItems}<!-- /wp:kadence/rowlayout -->`;
              } else {
                gutenbergHeading = `<!-- wp:image --><figure class="wp-block-image"><img alt=""/></figure><!-- /wp:image -->`;
              }
            } else {
              // Special heading patterns
              if (textOnly.startsWith('Q&A') || textOnly.startsWith('Q&amp;A') || textOnly.startsWith('คำถามที่พบบ่อย') || textOnly.includes('FAQ') || (textOnly.includes('คำถาม') && textOnly.includes('คำตอบ')) || (textOnly.startsWith('คำถาม') && textOnly.includes('ที่พบบ่อย'))) {
                // Q&A/FAQ headings are always centered with label-heading class
                if (level === 'h2') {
                  attrLevel = ` {"textAlign":"center","className":"label-heading"}`;
                } else {
                  attrLevel = ` {"textAlign":"center","level":${levelNumber},"className":"label-heading"}`;
                }
                classBlock = `class="wp-block-heading has-text-align-center label-heading"`;
              } else if (textOnly === 'สรุป' || textOnly.startsWith('สรุป')) {
                // "สรุป" heading with subtext-gtb class
                // เช็คว่าเป็น centered หรือไม่
                  if (isHeadingCentered) {
                  if (level === 'h2') {
                    attrLevel = ` {"textAlign":"center","className":"subtext-gtb"}`;
                    classBlock = `class="wp-block-heading has-text-align-center subtext-gtb"`;
                  } else if (level === 'h3') {
                    attrLevel = ` {"textAlign":"center","level":3,"className":"subtext-gtb"}`;
                    classBlock = `class="wp-block-heading has-text-align-center subtext-gtb"`;
                  }
                  } else {
                  if (level === 'h2') {
                    attrLevel = ` {"className":"subtext-gtb"}`;
                    classBlock = `class="wp-block-heading subtext-gtb"`;
                } else if (level === 'h3') {
                    attrLevel = ` {"level":3,"className":"subtext-gtb"}`;
                    classBlock = `class="wp-block-heading subtext-gtb"`;
                  }
                }
                // Always add separator before "สรุป" heading
                blockSeparator = `<!-- wp:separator --><hr class="wp-block-separator has-alpha-channel-opacity"/><!-- /wp:separator -->`;
              }


              if (level === 'h2') {
                gutenbergHeading = `${blockSeparator}${blockTarget}<!-- wp:heading${attrLevel} --><${level} ${classBlock}>${textOnly}</${level}><!-- /wp:heading -->`;
              } else if (level === 'h4' || level === 'h5' || level === 'h6') {
                gutenbergHeading = `<!-- wp:heading${attrLevel} --><${level} ${classBlock}>${textOnly}</${level}><!-- /wp:heading -->`;
              } else {
                // For h3 - always include target (unlike h2)
                if (textOnly === 'สรุป' || textOnly.startsWith('สรุป')) {
                  // "สรุป" h3 gets separator + target
                    gutenbergHeading = `${blockSeparator}${blockTarget}<!-- wp:heading${attrLevel} --><${level} ${classBlock}>${textOnly}</${level}><!-- /wp:heading -->`;
                } else {
                  gutenbergHeading = `${blockTarget}<!-- wp:heading${attrLevel} --><${level} ${classBlock}>${textOnly}</${level}><!-- /wp:heading -->`;
                }
              }
            }

            heading.outerHTML = gutenbergHeading;
          }
        });



        // (Function createRowLayoutFromContent moved above to be called before DOM parsing)
        

        // Cleanup: remove images accidentally embedded inside headings (keep other images)
        doc.querySelectorAll('h1 img, h2 img, h3 img, h4 img, h5 img, h6 img').forEach(img => { img.remove(); });

        // === แปลงย่อหน้าที่ขึ้นต้นด้วย ✓ เป็น list ===
        (function convertCheckmarkToList() {
          // หา paragraphs ทั้งหมดที่อยู่ใน body
          const allParagraphs = Array.from(doc.querySelectorAll('p'));
          
          let i = 0;
          while (i < allParagraphs.length) {
            const paragraph = allParagraphs[i];
            
            // ข้าม paragraphs ที่ถูกลบหรือไม่มี parent
            if (!paragraph.parentNode) {
              i++;
              continue;
            }
            
            const text = paragraph.textContent.trim();
            
            // ตรวจสอบว่าขึ้นต้นด้วย ✓ หรือไม่
            if (text.startsWith('✓')) {
              // เก็บรวม paragraphs ที่มี ✓ ต่อเนื่องกัน
              const checkmarkParagraphs = [paragraph];
              let currentIndex = i + 1;
              
              // หาย่อหน้าถัดไปที่มี ✓ ต่อเนื่องกัน
              while (currentIndex < allParagraphs.length) {
                const nextP = allParagraphs[currentIndex];
                
                // ข้าม paragraphs ที่ถูกลบหรือไม่มี parent
                if (!nextP.parentNode) {
                  currentIndex++;
                  continue;
                }
                
                const nextText = nextP.textContent.trim();
                
                if (nextText.startsWith('✓')) {
                  // ตรวจสอบว่า nextP อยู่ใกล้กับ paragraph ก่อนหน้าหรือไม่
                  // (อนุญาตให้มี comment nodes หรือ whitespace ระหว่างทาง)
                  const lastP = checkmarkParagraphs[checkmarkParagraphs.length - 1];
                  let sibling = lastP.nextSibling;
                  let foundNext = false;
                  let hasBlockingElement = false;
                  
                  while (sibling) {
                    if (sibling === nextP) {
                      foundNext = true;
                      break;
                    }
                    // ถ้าพบ element อื่นที่ไม่ใช่ paragraph หรือ comment node ให้หยุด
                    if (sibling.nodeType === 1 && sibling !== nextP) {
                      hasBlockingElement = true;
                      break;
                    }
                    sibling = sibling.nextSibling;
                  }
                  
                  if (foundNext && !hasBlockingElement) {
                    checkmarkParagraphs.push(nextP);
                    currentIndex++;
                  } else {
                    break; // พบ element กั้นหรือไม่พบ nextP
                  }
                } else {
                  break; // พบ paragraph ที่ไม่มี ✓ หยุด
                }
              }
              
              // สร้าง <ul class="correctlist">
              if (checkmarkParagraphs.length > 0) {
                const ul = doc.createElement('ul');
                ul.setAttribute('class', 'correctlist');
                
                checkmarkParagraphs.forEach(p => {
                  const li = doc.createElement('li');
                  // ลบเครื่องหมาย ✓ ออกจาก innerHTML
                  let content = p.innerHTML.trim();
                  content = content.replace(/^✓\s*/, '').trim();
                  li.innerHTML = content;
                  ul.appendChild(li);
                });
                
                // แทนที่ paragraph แรกด้วย <ul>
                checkmarkParagraphs[0].replaceWith(ul);
                
                // ลบ paragraphs ที่เหลือ
                for (let j = 1; j < checkmarkParagraphs.length; j++) {
                  if (checkmarkParagraphs[j].parentNode) {
                    checkmarkParagraphs[j].remove();
                  }
                }
                
                // ข้ามไปยัง paragraph ถัดไปที่ยังไม่ได้ประมวลผล
                i = currentIndex;
                continue;
              }
            }
            
            i++;
          }
        })();
        // === End แปลงย่อหน้าที่ขึ้นต้นด้วย ✓ เป็น list ===

        function convertSubListToGutenberg(ul, tag, classPrev, isDashed = false, hasCorrectlist = false) {
          let tagComment = '<!-- wp:list -->';
          let classNames = [];
          
          if (classPrev === 'references') {
            classNames.push('references');
          }
          if (isDashed) {
            classNames.push('list-dashed');
          }
          if (hasCorrectlist) {
            classNames.push('correctlist');
          }
          
          if (classNames.length > 0) {
            tagComment = `<!-- wp:list {"className":"${classNames.join(' ')}"} -->`;
          }
          
          if(tag === 'ol') {
            tagComment = '<!-- wp:list {"ordered":true} -->';
            if (classNames.length > 0) {
              tagComment = `<!-- wp:list {"ordered":true,"className":"${classNames.join(' ')}"} -->`;
            }
          }
          
          // Clean link text to match heading text format (for href replacement)
          const cleanLinkText = (text) => {
            if (!text) return '';
            let cleaned = text
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
          
          const newListItems = Array.from(ul.querySelectorAll('li')).map(li => {
            let liContent = li.innerHTML;
            const aTag = li.querySelector('a');
            
            // Replace Google Docs style href with hash ID from link text
            if (aTag && aTag.textContent && aTag.textContent.trim()) {
              const rawLinkText = aTag.textContent.trim();
              const cleanedLinkText = cleanLinkText(rawLinkText);
              const newHref = generateHashId(cleanedLinkText);
              // Replace any href (Google Docs style or other)
              liContent = liContent.replace(/href="[^"]*"/, `href="#${newHref}"`);
            }
            
            return `<!-- wp:list-item --><li>${liContent}</li><!-- /wp:list-item -->`;
          }).join('');
          
          const classAttr = classNames.length > 0 ? ` class="${classNames.join(' ')}"` : '';
          return `${tagComment}<${tag}${classAttr}>${newListItems}</${tag}><!-- /wp:list -->`;
        }

        function convertListToGutenberg(ul, tag, classPrev) {
          // Count total list items
          const countItems = (el) => {
            let count = 0;
            Array.from(el.children).forEach(li => {
              count++;
              const nested = li.querySelector('ul, ol');
              if (nested) count += countItems(nested);
            });
            return count;
          };
          const totalItems = countItems(ul);
          
          // Check if this is a dashed list (items starting with "- ")
          const isDashed = Array.from(ul.children).some(li => {
            const text = li.textContent.trim();
            return text.startsWith('- ');
          });
          
          // ตรวจสอบว่ามี class="correctlist" อยู่แล้วหรือไม่
          const hasCorrectlist = ul.classList.contains('correctlist');
          
          let classNames = [];
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
          
          let tagComment = '<!-- wp:list -->';
          if (classNames.length > 0) {
            tagComment = `<!-- wp:list {"className":"${classNames.join(' ')}"} -->`;
          }
          
          if(tag === 'ol') {
            tagComment = '<!-- wp:list {"ordered":true} -->';
            if (classNames.length > 0) {
              tagComment = `<!-- wp:list {"ordered":true,"className":"${classNames.join(' ')}"} -->`;
            }
          }
          
          // Clean link text to match heading text format (for href replacement)
          const cleanLinkText = (text) => {
            if (!text) return '';
            let cleaned = text
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
          
          const listItems = Array.from(ul.children).map(li => {
            const nestedUl = li.querySelector('ul');
            const aTag = li.querySelector('a');
            
            if (nestedUl) {
              const listSubItems = convertSubListToGutenberg(nestedUl, tag, classPrev, isDashed, hasCorrectlist);
              nestedUl.remove();
              // Remove "- " prefix if it's a dashed list
              let liContent = li.innerHTML;
              if (isDashed) {
                liContent = liContent.replace(/^-\s*/, '');
              }
              
              // Replace Google Docs style href with hash ID from link text
              if (aTag && aTag.textContent && aTag.textContent.trim()) {
                const rawLinkText = aTag.textContent.trim();
                const cleanedLinkText = cleanLinkText(rawLinkText);
                const newHref = generateHashId(cleanedLinkText);
                // Replace any href (Google Docs style or other)
                liContent = liContent.replace(/href="[^"]*"/, `href="#${newHref}"`);
              }
              
              return `<!-- wp:list-item --><li>${liContent}${listSubItems}</li><!-- /wp:list-item -->`;
            }
            // Remove "- " prefix if it's a dashed list
            let liContent = li.innerHTML;
            if (isDashed) {
              liContent = liContent.replace(/^-\s*/, '');
            }
            
            // Replace Google Docs style href with hash ID from link text
            if (aTag && aTag.textContent && aTag.textContent.trim()) {
              const rawLinkText = aTag.textContent.trim();
              const cleanedLinkText = cleanLinkText(rawLinkText);
              const newHref = generateHashId(cleanedLinkText);
              // Replace any href (Google Docs style or other)
              liContent = liContent.replace(/href="[^"]*"/, `href="#${newHref}"`);
            }
            
            return `<!-- wp:list-item --><li>${liContent}</li><!-- /wp:list-item -->`;
          }).join('');
          
          const classAttr = classNames.length > 0 ? ` class="${classNames.join(' ')}"` : '';
          return `${tagComment}<${tag}${classAttr}>${listItems}</${tag}><!-- /wp:list -->`;
        }

        function convertSubListToMenu(ul, tag, listItemCount) {
          let tagComment = '<!-- wp:list -->';
          if(tag === 'ol') {
            tagComment = '<!-- wp:list {"ordered":true} -->';
          }
          
          // Clean link text to match heading text format (for href replacement)
          const cleanLinkText = (text) => {
            if (!text) return '';
            let cleaned = text
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
          
          const newListItems = Array.from(ul.children).map(li => {
            let liContent = li.innerHTML;
            const aTag = li.querySelector('a');
            if (aTag && aTag.textContent && aTag.textContent.trim()) {
              const rawLinkText = aTag.textContent.trim();
              const cleanedLinkText = cleanLinkText(rawLinkText);
              const newHref = generateHashId(cleanedLinkText);
              liContent = liContent.replace(/href="[^"]*"/, `href="#${newHref}"`);
            }
            return `<!-- wp:list-item --><li>${liContent}</li><!-- /wp:list-item -->`;
          }).join('');
          return `${tagComment}<${tag}>${newListItems}</${tag}><!-- /wp:list -->`;
        }

        function convertListToMenu(ul, tag) {
          // Count total list items (including nested)
          const countItems = (el) => {
            let count = 0;
            Array.from(el.children).forEach(li => {
              count++;
              const nested = li.querySelector('ul, ol');
              if (nested) count += countItems(nested);
            });
            return count;
          };
          const totalItems = countItems(ul);
          
          // Determine if should add two-column class (only if > 5 items)
          let tagComment = '<!-- wp:list -->';
          if (totalItems > 5) {
            tagComment = '<!-- wp:list {"className":"listmenu two-column"} -->';
          } else {
            tagComment = '<!-- wp:list {"className":"listmenu"} -->';
          }
          
          if(tag === 'ol') {
            if (totalItems > 5) {
              tagComment = '<!-- wp:list {"ordered":true,"className":"listmenu two-column"} -->';
            } else {
              tagComment = '<!-- wp:list {"ordered":true,"className":"listmenu"} -->';
            }
          }
          
          // Clean link text to match heading text format (for href replacement)
          const cleanLinkText = (text) => {
            if (!text) return '';
            let cleaned = text
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
          
          const listItems = Array.from(ul.children).map(li => {
            const nestedUl = li.querySelector('ul');
            const aTag = li.querySelector('a');
            
            if (nestedUl) {
              // Process nested list first
              const listSubItems = convertSubListToMenu(nestedUl, tag, totalItems);
              // Remove nested ul from li temporarily
              nestedUl.remove();
              // Now get content and fix link
              let liContent = li.innerHTML;
              if (aTag && aTag.textContent && aTag.textContent.trim()) {
                const rawLinkText = aTag.textContent.trim();
                const cleanedLinkText = cleanLinkText(rawLinkText);
                const newHref = generateHashId(cleanedLinkText);
                liContent = liContent.replace(/href="[^"]*"/, `href="#${newHref}"`);
              }
              return `<!-- wp:list-item --><li>${liContent}${listSubItems}</li><!-- /wp:list-item -->`;
            } else {
              // No nested list, just process link
              let liContent = li.innerHTML;
              if (aTag && aTag.textContent && aTag.textContent.trim()) {
                const rawLinkText = aTag.textContent.trim();
                const cleanedLinkText = cleanLinkText(rawLinkText);
                const newHref = generateHashId(cleanedLinkText);
                liContent = liContent.replace(/href="[^"]*"/, `href="#${newHref}"`);
              }
              return `<!-- wp:list-item --><li>${liContent}</li><!-- /wp:list-item -->`;
            }
          }).join('');
          
          // Apply class to opening tag
          const openingTag = totalItems > 5 ? 
            `<${tag} class="listmenu two-column">` : 
            `<${tag} class="listmenu">`;
          
          return `${tagComment}${openingTag}${listItems}</${tag}><!-- /wp:list -->`;
        }

        // Convert all <ul> and <ol> elements with a combined counter to add class to the first found
        // let firstListProcessed = false;
        doc.querySelectorAll('ul, ol').forEach((list, index) => {
          let listHTML = '';
          const tag = list.tagName.toLowerCase();
          const previousElement = list.previousElementSibling;
          // if (!firstListProcessed) {
          if (index === 0) {
            listHTML = convertListToMenu(list, tag);
            // firstListProcessed = true;
          } else {
            if (previousElement && previousElement.classList.contains('references')) {
              const className = previousElement.className;
              // console.log('Class name:', className);
              listHTML = convertListToGutenberg(list, tag, className);
              listHTML = listHTML.replace(`<${tag}>`, `<${tag} class="references">`);
            } else {
              listHTML = convertListToGutenberg(list, tag, null);
            }
          }
          list.innerHTML = listHTML;
          const parentList = list.closest(tag);
          if (parentList) {
            parentList.replaceWith(...parentList.childNodes);
          }
        });

        // Convert all <table> elements to Kadence RowLayout (supports 2-3 columns per row based on images)
        doc.querySelectorAll('table').forEach((table) => {
          // Collect all cells that contain content (images or text)
          const allCells = Array.from(table.querySelectorAll('th,td'));
          const cellsWithContent = allCells.filter(cell => {
            const hasImage = cell.querySelector('img');
            const hasText = (cell.textContent || '').trim().length > 0;
            return hasImage || hasText;
          });
          
          // First, check if any cell contains special "click" text that should become buttons
          const hasClickText = cellsWithContent.some(cell => {
            const fullText = (cell.textContent || '').trim();
            return /^(คลิก|คลิกดู|คลิกดูข้อมูล|คลิกดูข้อมูลคลินิกเพิ่มเติม|คลิกเพื่อดูข้อมูล)/i.test(fullText);
          });
          
          // If table contains "click" text, convert it to buttons regardless of images
          if (hasClickText) {
            const buttonBlocks = cellsWithContent.map(cell => {
              const fullText = (cell.textContent || '').trim();
              const isClickText = /^(คลิก|คลิกดู|คลิกดูข้อมูล|คลิกดูข้อมูลคลินิกเพิ่มเติม|คลิกเพื่อดูข้อมูล)/i.test(fullText);
              
              if (isClickText) {
                const aTag = cell.querySelector('a');
                const buttonUrl = aTag ? (aTag.getAttribute('href') || '') : '';
                const buttonText = fullText;
                
                return `<!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${buttonUrl}">${buttonText}</a></div>
<!-- /wp:button -->`;
              }
              return '';
            }).filter(block => block !== '').join('\n');
            
            if (buttonBlocks) {
              table.outerHTML = `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons">
${buttonBlocks}
</div>
<!-- /wp:buttons -->`;
              return;
            }
          }
          
          // --- Guard: only convert tables that actually contain images ---
          const ROWLAYOUT_MIN_IMAGES = 2; // expect at least two image sections
          const imgCountInTable = table.querySelectorAll('img').length;

          // If this is a text-only table (or has < 2 images), convert to Gutenberg Table Block
          if (imgCountInTable < ROWLAYOUT_MIN_IMAGES) {
            // แปลง table ธรรมดาให้เป็น Gutenberg Table Block
            // เพิ่ม class has-fixed-layout ให้กับ table
            table.classList.add('has-fixed-layout');
            
            // ครอบ table ด้วย figure และ Gutenberg comments
            const tableHTML = table.outerHTML;
            table.outerHTML = `<!-- wp:table -->\n<figure class="wp-block-table">${tableHTML}</figure>\n<!-- /wp:table -->`;
            return;
          }
          // --- end guard ---
          
          if (cellsWithContent.length < 2) { 
            table.remove(); 
            return; 
          }

            const makeCol = (cell) => {
            const columnUniqueID = `70684_${Math.random().toString(36).slice(2, 11)}`;
            const imgEl = cell.querySelector('img');
            const innerHTML = cell.innerHTML || '';
            
            // ดึงข้อความทั้งหมดจาก cell
            const fullText = (cell.textContent || '').trim();
            
            // แยกข้อมูลออกเป็นส่วนๆ
            let altText = '';
            let landingUrl = '';
            let captionText = '';
            
            // หา Alt: และดึงค่าออกมา
            const altRegex = /alt\s*:\s*(.+?)(?=(?:landing|link)\s*:|$)/is;
            const altMatch = fullText.match(altRegex);
            if (altMatch) {
              altText = altMatch[1].trim();
            }
            
            // หา Landing: หรือ Link: และดึง URL ออกมา
            const landingRegex = /(?:landing|link)\s*:\s*(.+?)$/is;
            const landingMatch = fullText.match(landingRegex);
            if (landingMatch) {
              landingUrl = landingMatch[1].trim();
            }
            
            // หาข้อความที่เป็น caption (ข้อความที่ไม่ใช่ Alt: และไม่ใช่ Landing:)
            let remainingText = fullText;
            // ลบ Alt: ... ออก
            remainingText = remainingText.replace(/alt\s*:.+?(?=(?:landing|link)\s*:|$)/is, '').trim();
            // ลบ Landing: ... หรือ Link: ... ออก
            remainingText = remainingText.replace(/(?:landing|link)\s*:.+$/is, '').trim();
            
            captionText = remainingText;
            
            // ตรวจจับลิงก์จาก <a> tag (สำรอง)
            const aTag = cell.querySelector('a');
            if (aTag && !landingUrl) {
              landingUrl = aTag.getAttribute('href') || '';
            }

            // ตรวจจับการจัดกลางโดยใช้ isExplicitCentered (ตรวจเฉพาะ element นั้นเอง)
            const isCentered = isExplicitCentered(cell);
            const isItalic = /<em|<i|font-style\s*:\s*italic/i.test(innerHTML);

            const src = (imgEl && imgEl.getAttribute('src') && !WP_EXPORT_MODE)
              ? ` src="${imgEl.getAttribute('src')}"` : '';

            // สร้าง imageHTML - ถ้ามีลิงก์ให้ wrap รูปด้วย <a>
            let imageHTML = '';
            if (imgEl || altText) {
              if (landingUrl) {
                // มีลิงก์ - wrap รูปด้วย <a> tag
                imageHTML = `<!-- wp:image -->
<figure class="wp-block-image"><a href="${landingUrl}"><img${src} alt="${altText}"/></a></figure>
<!-- /wp:image -->
`;
              } else {
                // ไม่มีลิงก์ - รูปอย่างเดียว
                imageHTML = `<!-- wp:image -->
<figure class="wp-block-image"><img${src} alt="${altText}"/></figure>
<!-- /wp:image -->
`;
              }
            }

            // สร้าง paraHTML เฉพาะเมื่อมีข้อความ caption (ไม่ใช่ลิงก์)
            let paraHTML = '';
            if (captionText) {
              const forceCenter = isItalic || isCentered;
              const alignAttr = forceCenter ? ' {"align":"center"}' : '';
              const classAttr = forceCenter ? ' class="has-text-align-center caption-img"' : '';
              
              const paraBody = isItalic ? `<em>${captionText}</em>` : captionText;
              
              paraHTML = `<!-- wp:paragraph${alignAttr} -->
<p${classAttr}>${paraBody}</p>
<!-- /wp:paragraph -->`;
            }

            return `<!-- wp:kadence/column {"borderWidth":["","","",""],"uniqueID":"${columnUniqueID}","borderStyle":[{"top":["","",""],"right":["","",""],"bottom":["","",""],"left":["","",""],"unit":"px"}]} -->
<div class="wp-block-kadence-column kadence-column${columnUniqueID}"><div class="kt-inside-inner-col">
${imageHTML}${paraHTML}
</div></div>
<!-- /wp:kadence/column -->`;
          };

          // Determine columns per row based on cell count
          let columnsPerRow = 2; // default to 2 columns
          
          // If we have more than 2 cells, check if we should use 3 columns per row
          if (cellsWithContent.length > 2) {
            // Use 3 columns per row for tables with 3+ cells
            columnsPerRow = 3;
          }

          // Split cells into rows of 'columnsPerRow' sections each
          const rowsOfCells = [];
          for (let i = 0; i < cellsWithContent.length; i += columnsPerRow) {
            rowsOfCells.push(cellsWithContent.slice(i, i + columnsPerRow));
          }

          // Generate multiple rowlayouts if needed (one per row of cells)
          const allRowLayouts = rowsOfCells.map(rowCells => {
            const rowUniqueID = `70684_${Math.random().toString(36).slice(2, 11)}`;
            const columnsHTML = rowCells.map(makeCol).join('\n\n');
            const numColumns = rowCells.length;
            
            return `<!-- wp:kadence/rowlayout {"uniqueID":"${rowUniqueID}","columns":${numColumns},"colLayout":"equal","kbVersion":2} -->
${columnsHTML}
<!-- /wp:kadence/rowlayout -->`;
          }).join('\n\n');

          table.outerHTML = allRowLayouts;
        });

        // For WP export: strip any remaining base64 data URIs
        if (typeof WP_EXPORT_MODE !== 'undefined' && WP_EXPORT_MODE) {
          htmlString = htmlString.replace(/src="data:[^"]*"/g, 'src=""');
        }
// Serialize the DOM back to a string
        htmlString = new XMLSerializer().serializeToString(doc);

        // Remove the <html>, <head>, and <body> tags from the string
        htmlString = htmlString.replace(/<html[^>]*>/, '').replace('</html>', '');
        htmlString = htmlString.replace('<head></head>', '');
        htmlString = htmlString.replace(/<body[^>]*>/, '').replace('</body>', '');

        // Remove extra spaces or tabs to ensure only one space between words
        // htmlString = htmlString.replace(/\s+/g, ' ');

        // Add new lines after closing tags for readability
        htmlString = htmlString.replace(/<!--/g, '\n<!--');
        htmlString = htmlString.replace(/-->/g, '-->\n');
        htmlString = htmlString.replace(/𝗖𝗼𝗼𝗹 𝗬𝗮𝗴 𝟭𝟬𝟲𝟰/g, 'Cool Yag 1064');

        // Apply post-processing to create row layouts (DISABLED temporarily)
        // htmlString = createRowLayoutFromContent(htmlString);

        // เพิ่มการจัดการ line breaks ใน Gutenberg format
        // รวม paragraph ที่มีเนื้อหาสั้นๆ และติดกันอย่างระมัดระวัง
        // ซึ่งน่าจะเป็นผลมาจาก Shift+Enter ใน Word
        htmlString = (function mergeConsecutiveParagraphs(html) {
          // Pattern 1: รวม paragraph ที่มีข้อความสั้นมากๆ (น้อยกว่า 80 ตัวอักษร) และติดกัน
          // ซึ่งน่าจะเป็นผลมาจาก Shift+Enter
          const shortParaPattern = /<!-- wp:paragraph -->\s*<p>([^<]{1,80})<\/p>\s*<!-- \/wp:paragraph -->\s*<!-- wp:paragraph -->\s*<p>/g;
          html = html.replace(shortParaPattern, (match, text) => {
            // ตรวจสอบว่าข้อความเป็น special content หรือไม่
            const specialKeywords = ['สารบัญ', 'อ้างอิง', 'สรุป', 'Q&A', 'FAQ', 'อ่านเพิ่มเติม', 'คำถาม', 'บทความ'];
            const hasSpecialKeyword = specialKeywords.some(keyword => text.includes(keyword));
            
            if (hasSpecialKeyword) {
              return match; // ไม่รวม ให้คงเป็น paragraph แยก
            }
            
            // รวม paragraph โดยใช้ <br>
            return `<!-- wp:paragraph -->\n<p>${text}<br>`;
          });
          
          // Pattern 2: รวม paragraph ปกติที่ติดกันและไม่มี attributes พิเศษ
          // เฉพาะกรณีที่ไม่มี class, align หรือ attributes อื่นๆ
          // ใช้ความระมัดระวังสูง - รวมเฉพาะกรณีที่แน่ใจว่าควรรวม
          
          return html;
        })(htmlString);
        
        // === Force inline underline style on <u> and .underline (final safety) ===
        (function forceUnderlineStyle(){
          const parser3 = new DOMParser();
          const doc3 = parser3.parseFromString(htmlString, 'text/html');
          doc3.querySelectorAll('u').forEach((uEl) => {
            const existing = (uEl.getAttribute('style') || '').trim();
            const base = 'text-decoration: underline;';
            uEl.setAttribute('style', existing ? (existing.endsWith(';') ? existing : existing + '; ') + base : base);
          });
          doc3.querySelectorAll('.underline').forEach((el) => {
            const existing = (el.getAttribute('style') || '').trim();
            const base = 'text-decoration: underline;';
            el.setAttribute('style', existing ? (existing.endsWith(';') ? existing : existing + '; ') + base : base);
            el.classList.remove('underline');
            if (!el.getAttribute('class')) el.removeAttribute('class');
          });
          htmlString = new XMLSerializer().serializeToString(doc3)
            .replace(/<html[^>]*>/, '').replace('</html>', '')
            .replace('<head></head>', '')
            .replace(/<body[^>]*>/, '').replace('</body>', '');
        })();
        // === End force underline style ===

        // === Post-processing: แปลง Table ที่ยังไม่ได้ wrap ด้วย Gutenberg blocks ===
        // จับ table ทั้งหมดที่ยังไม่ได้อยู่ใน Gutenberg Table Block
        (function convertRemainingTables() {
          // แยกเนื้อหาออกเป็นส่วนๆ เพื่อตรวจสอบว่า table ใดอยู่ใน wp:table block แล้ว
          const tablePattern = /<table([^>]*)>([\s\S]*?)<\/table>/g;
          let match;
          const tablesToConvert = [];
          
          // หา table ทั้งหมด
          while ((match = tablePattern.exec(htmlString)) !== null) {
            const fullMatch = match[0];
            const attributes = match[1];
            const content = match[2];
            const startPos = match.index;
            
            // ตรวจสอบ 500 ตัวอักษรก่อนหน้า table เพื่อดูว่ามี <!-- wp:table --> หรือไม่
            const before = htmlString.substring(Math.max(0, startPos - 500), startPos);
            const hasTableBlock = /<!-- wp:table[^>]*-->\s*(?:<figure[^>]*>)?\s*$/i.test(before);
            
            // ตรวจสอบว่ามี wp-block-table class หรือไม่
            const hasWpBlockClass = /class="[^"]*wp-block-table[^"]*"/.test(attributes);
            
            // ถ้ายังไม่ได้อยู่ใน Gutenberg Table Block ให้บันทึกไว้เพื่อแปลง
            if (!hasTableBlock && !hasWpBlockClass) {
              tablesToConvert.push({
                match: fullMatch,
                attributes: attributes,
                content: content
              });
            }
          }
          
          // แปลง table ที่ยังไม่ได้ wrap
          tablesToConvert.forEach(table => {
            let newAttributes = table.attributes;
            let newContent = table.content;
            
            // Helper function to clean cell content: remove p, span, div, inline styles, keep only strong and text
            const cleanCellContent = (element) => {
              const temp = element.cloneNode(true);
              
              // Remove all inline styles
              temp.removeAttribute('style');
              temp.querySelectorAll('*').forEach(el => el.removeAttribute('style'));
              
              // Unwrap p, span, div elements but preserve their content
              const unwrapElements = ['p', 'span', 'div'];
              unwrapElements.forEach(tag => {
                const elements = temp.querySelectorAll(tag);
                elements.forEach(el => {
                  const parent = el.parentNode;
                  while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                  }
                  parent.removeChild(el);
                });
              });
              
              // Build cleaned content: text nodes and strong/b elements only
              const frag = document.createDocumentFragment();
              
              // Process nodes recursively
              const processNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                  const text = node.textContent.trim();
                  if (text) {
                    // Check if this text is inside a strong tag
                    let parent = node.parentNode;
                    let isInStrong = false;
                    while (parent && parent !== temp) {
                      const tag = parent.tagName ? parent.tagName.toLowerCase() : '';
                      if (tag === 'strong' || tag === 'b') {
                        isInStrong = true;
                        break;
                      }
                      parent = parent.parentNode;
                    }
                    
                    if (!isInStrong) {
                      frag.appendChild(document.createTextNode(text + ' '));
                    }
                  }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                  const tag = node.tagName ? node.tagName.toLowerCase() : '';
                  if (tag === 'strong' || tag === 'b') {
                    const newStrong = document.createElement('strong');
                    newStrong.textContent = node.textContent.trim();
                    if (newStrong.textContent) {
                      frag.appendChild(newStrong);
                    }
                  } else {
                    // For other elements, process their children
                    Array.from(node.childNodes).forEach(child => processNode(child));
                  }
                }
              };
              
              Array.from(temp.childNodes).forEach(node => processNode(node));
              
              // If no content extracted, return plain text
              if (frag.childNodes.length === 0) {
                const allText = temp.textContent.trim();
                return allText ? document.createTextNode(allText) : null;
              }
              
              return frag;
            };
            
            // Helper function to sanitize cell: clean content and preserve attributes
            const sanitizeCell = (cell, isHeader = false) => {
              const newCell = document.createElement(isHeader ? 'th' : 'td');
              
              // Copy all attributes (class, data-align, etc.) but skip style
              Array.from(cell.attributes).forEach(attr => {
                if (attr.name !== 'style') {
                  newCell.setAttribute(attr.name, attr.value);
                }
              });
              
              // Clean the content
              const cleanedContent = cleanCellContent(cell);
              
              if (cleanedContent.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                Array.from(cleanedContent.childNodes).forEach(child => {
                  newCell.appendChild(child.cloneNode(true));
                });
              } else if (cleanedContent.nodeType === Node.TEXT_NODE) {
                if (cleanedContent.textContent.trim()) {
                  newCell.appendChild(cleanedContent);
                }
              }
              
              // Set alignment
              const existingClass = newCell.getAttribute('class') || '';
              const classList = existingClass.split(' ').filter(c => c && !c.includes('has-text-align'));
              classList.push(isHeader ? 'has-text-align-center' : 'has-text-align-left');
              newCell.setAttribute('class', classList.join(' ').trim());
              newCell.setAttribute('data-align', isHeader ? 'center' : 'left');
              
              return newCell;
            };
            
            // Helper function to remove whitespace between tags in HTML string
            const removeWhitespace = (html) => {
              return html
                .replace(/>\s+</g, '><') // Remove whitespace between tags
                .replace(/\n\s*/g, '') // Remove newlines and surrounding spaces
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
            };
            
            // Parse and clean table structure
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = '<table>' + newContent + '</table>';
            const tempTable = tempDiv.querySelector('table');
            
            if (tempTable) {
              // Check if thead/tbody exists
              let thead = tempTable.querySelector('thead');
              let tbody = tempTable.querySelector('tbody');
              
              // If no tbody exists, create one
              if (!tbody) {
                tbody = document.createElement('tbody');
                // Move all tr that are not in thead to tbody
                const allRows = Array.from(tempTable.querySelectorAll('tr'));
                allRows.forEach(row => {
                  if (!row.closest('thead')) {
                    tbody.appendChild(row);
                  }
                });
                if (tbody.children.length > 0) {
                  tempTable.appendChild(tbody);
                }
              }
              
              // Process thead: keep only first row, move others to tbody
              if (thead) {
                const theadRows = Array.from(thead.querySelectorAll('tr'));
                
                if (theadRows.length > 0) {
                  // Clean and sanitize first row header cells
                  const firstRow = theadRows[0];
                  const thCells = Array.from(firstRow.querySelectorAll('th, td'));
                  const cleanedHeaderCells = thCells.map(cell => sanitizeCell(cell, true));
                  
                  // Clear thead and add only cleaned first row
                  thead.innerHTML = '';
                  const newFirstRow = document.createElement('tr');
                  cleanedHeaderCells.forEach(cell => {
                    newFirstRow.appendChild(cell);
                  });
                  thead.appendChild(newFirstRow);
                  
                  // Move remaining rows from thead to tbody
                  for (let i = 1; i < theadRows.length; i++) {
                    const row = theadRows[i];
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    const newRow = document.createElement('tr');
                    
                    cells.forEach(cell => {
                      const newCell = sanitizeCell(cell, false); // Convert to td
                      newRow.appendChild(newCell);
                    });
                    
                    tbody.appendChild(newRow);
                  }
                }
              } else {
                // No thead exists, check if we should create one from first row
                const allRows = Array.from(tempTable.querySelectorAll('tr'));
                
                if (allRows.length > 0) {
                  const firstRow = allRows[0];
                  const firstRowCells = Array.from(firstRow.querySelectorAll('th, td'));
                  
                  // If first row has th, create thead
                  if (firstRowCells.some(cell => cell.tagName === 'TH')) {
                    thead = document.createElement('thead');
                    const newFirstRow = document.createElement('tr');
                    
                    firstRowCells.forEach(cell => {
                      const newCell = sanitizeCell(cell, true);
                      newFirstRow.appendChild(newCell);
                    });
                    
                    thead.appendChild(newFirstRow);
                    tempTable.insertBefore(thead, tbody || tempTable.firstChild);
                    
                    // Remove first row from current location
                    firstRow.remove();
                  }
                }
              }
              
              // Process tbody: convert all th to td and sanitize all cells
              if (tbody) {
                const tbodyRows = Array.from(tbody.querySelectorAll('tr'));
                tbodyRows.forEach(row => {
                  const cells = Array.from(row.querySelectorAll('th, td'));
                  cells.forEach(cell => {
                    const newCell = sanitizeCell(cell, false); // Always td in tbody
                    cell.replaceWith(newCell);
                  });
                });
              }
              
              // Get cleaned HTML and remove whitespace
              let cleanedHTML = tempTable.innerHTML;
              cleanedHTML = removeWhitespace(cleanedHTML);
              
              newContent = cleanedHTML;
            }
            
            // Legacy code removed - using new cleaning logic above
              
            // เพิ่ม class has-fixed-layout
            if (!newAttributes.includes('has-fixed-layout')) {
              if (newAttributes.includes('class=')) {
                // มี class อยู่แล้ว เพิ่มเข้าไป
                newAttributes = newAttributes.replace(
                  /class="([^"]*)"/,
                  'class="$1 has-fixed-layout"'
                );
              } else {
                // ไม่มี class เลย เพิ่มใหม่
                newAttributes += ' class="has-fixed-layout"';
              }
            }
            
            // สร้าง Gutenberg Table Block
            const newTable = `<!-- wp:table -->
<figure class="wp-block-table"><table${newAttributes}>${newContent}</table></figure>
<!-- /wp:table -->`;
            
            // แทนที่ table เดิม
            htmlString = htmlString.replace(table.match, newTable);
          });
        })();
        // === End table post-processing ===

        // ★ เพิ่มขั้นตอน: ทำความสะอาดตาราง Gutenberg ให้พร้อมใช้งาน
        htmlString = cleanGutenbergTables(htmlString);

        // ★ เพิ่มขั้นตอน: แปลง "อ่านเพิ่มเติม" ให้เป็น Gutenberg Block พิเศษ
        // htmlString = convertReadMoreToBlock(htmlString); // ❌ ปิดใช้งานเพื่อป้องกันการแปลง readmore ซ้ำ

        // ★ เพิ่มขั้นตอน: เพิ่ม class="headtext" ให้กับหัวข้อคำถามใน Q&A section
        htmlString = addQAHeadingClass(htmlString);
        
        // ★ เพิ่มขั้นตอน: ลบข้อความ Alt ที่อยู่ใต้รูปภาพ
        htmlString = removeAltText(htmlString);
        
        // ★ ปิดการใช้งานฟังก์ชัน convertReadMoreLinks เพื่อป้องกันการซ้อน blocks
        // เนื่องจาก readmore ถูกแปลงไปแล้วใน DOM processing loop แล้ว
        htmlString = convertTableToButton(htmlString);

        // ประมวลผลลิงก์ตามเว็บไซต์ที่เลือก
        htmlString = processLinks(htmlString, selectedWebsite);
        
        // ลบ underline ที่ซ้อนกันใน link สำหรับ bestbrandclinic.com
        // เพราะ link มี underline อยู่แล้วจาก CSS ไม่ต้องมี <u> tag ซ้อน
        if (selectedWebsite === 'bestbrandclinic.com') {
          // ลบ <u> tag (รวมถึงที่มี style attribute) ที่อยู่ภายใน <a> tag (เก็บเนื้อหาไว้)
          // รองรับ: <u>, <u style="...">, <u class="..."> ฯลฯ
          htmlString = htmlString.replace(/<a\s+([^>]*)>(\s*)<u[^>]*>([\s\S]*?)<\/u>(\s*)<\/a>/gi, '<a $1>$2$3$4</a>');
          
          // จับประโยคจัดกลางที่อยู่เหนือ Alt : และย้ายไปเป็น caption ของ image block
          // Pattern: <!-- wp:image --> ... <!-- /wp:image --> ตามด้วย paragraph จัดกลาง ตามด้วย paragraph ที่มี Alt :
          // แปลงเป็น: <!-- wp:image --> พร้อม figcaption
          htmlString = htmlString.replace(
            /(<!-- wp:image[^>]*-->)\s*<figure([^>]*)>\s*(<img[^>]*>)\s*<\/figure>\s*(<!-- \/wp:image -->)\s*<!-- wp:paragraph[^>]*-->\s*<p[^>]*class="[^"]*has-text-align-center[^"]*"[^>]*>([^<]+)<\/p>\s*<!-- \/wp:paragraph -->/gi,
            (match, openComment, figureAttrs, imgTag, closeComment, captionText) => {
              // ตรวจสอบว่า captionText ไม่ใช่ Alt text
              if (/^(alt|Alt|ALT)\s*:/i.test(captionText.trim())) {
                return match; // ไม่แปลง ถ้าเป็น Alt text
              }
              const cleanCaption = captionText.trim();
              return `${openComment}
<figure${figureAttrs}>
  ${imgTag}
  <figcaption class="wp-element-caption">${cleanCaption}</figcaption>
</figure>
${closeComment}`;
            }
          );
          
          // Pattern 2: จับ paragraph จัดกลางที่อยู่หลัง image block และก่อน Alt paragraph
          // <!-- wp:image --> ... <!-- /wp:image --> + centered paragraph + Alt paragraph
          htmlString = htmlString.replace(
            /(<!-- wp:image[^>]*-->)\s*<figure([^>]*)>\s*(<img[^>]*>)\s*<\/figure>\s*(<!-- \/wp:image -->)\s*(<!-- wp:paragraph[^>]*-->\s*<p[^>]*>([^<]*)<\/p>\s*<!-- \/wp:paragraph -->)\s*(?=<!-- wp:paragraph[^>]*-->\s*<p[^>]*>(?:alt|Alt|ALT)\s*:)/gi,
            (match, openComment, figureAttrs, imgTag, closeComment, captionBlock, captionText) => {
              const cleanCaption = captionText.trim();
              if (!cleanCaption || /^(alt|Alt|ALT)\s*:/i.test(cleanCaption)) {
                return match; // ไม่แปลง ถ้าไม่มี caption หรือเป็น Alt text
              }
              return `${openComment}
<figure${figureAttrs}>
  ${imgTag}
  <figcaption class="wp-element-caption">${cleanCaption}</figcaption>
</figure>
${closeComment}`;
            }
          );
        }
        
        // เพิ่ม footer ถ้าเลือก vsquareclinic.com
        if (selectedWebsite === 'vsquareclinic.com') {
          htmlString = htmlString.trim() + '\n<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity"/>\n<!-- /wp:separator -->\n\n<!-- wp:block {"ref":66914} /-->';
        }
        
        // เพิ่ม footer ถ้าเลือก vsqclinic.com
        if (selectedWebsite === 'vsqclinic.com') {
          htmlString = htmlString.trim() + '\n<!-- wp:block {"ref":16702} /-->';
        }
        
        // เพิ่ม footer ถ้าเลือก vsquareconsult.com
        if (selectedWebsite === 'vsquareconsult.com') {
          htmlString = htmlString.trim() + '\n<!-- wp:block {"ref":34903} /-->';
        }
        
        // เพิ่ม footer ถ้าเลือก vsquare-under-eye.com
        if (selectedWebsite === 'vsquare-under-eye.com') {
          htmlString = htmlString.trim() + '\n<!-- wp:block {"ref":8916} /-->';
        }
        
        // เพิ่ม footer ถ้าเลือก vsquareclinic.co (ไม่มี separator)
        if (selectedWebsite === 'vsquareclinic.co') {
          htmlString = htmlString.trim() + '\n<!-- wp:block {"ref":148} /-->';
        }
        
        // เพิ่ม footer ถ้าเลือก vsq-injector.com (ไม่มี separator)
        if (selectedWebsite === 'vsq-injector.com') {
          htmlString = htmlString.trim() + '\n<!-- wp:block {"ref":170} /-->';
        }
        
        // เพิ่ม footer ถ้าเลือก en.vsquareclinic.com
        if (selectedWebsite === 'en.vsquareclinic.com') {
          htmlString = htmlString.trim() + '\n<!-- wp:block {"ref":66914} /-->';
        }
        
        // เพิ่ม footer ถ้าเลือก cn.vsquareclinic.com
        if (selectedWebsite === 'cn.vsquareclinic.com') {
          htmlString = htmlString.trim() + '\n<!-- wp:block {"ref":16702} /-->';
        }
        
        // ลบ separator ท้ายสุดสำหรับเว็บไซต์ที่ไม่ต้องการ separator
        const websitesWithoutSeparator = ['vsquareclinic.co', 'vsq-injector.com', 'vsquare.clinic', 'drvsquare.com', 'doctorvsquareclinic.com', 'bestbrandclinic.com', 'monghaclinic.com'];
        if (websitesWithoutSeparator.includes(selectedWebsite)) {
          htmlString = htmlString.replace(/<!-- wp:separator -->\s*<hr class="wp-block-separator[^"]*"\/?>\s*<!-- \/wp:separator -->\s*$/gi, '');
        }

        // ล้างฟอร์แมตแปลกๆ อัตโนมัติก่อนแสดงผล (Clear Unknown Formatting)
        htmlString = cleanHTML(htmlString);

        // ลบ <p> tags ที่ wrap Gutenberg block comments (<!-- ... -->)
        htmlString = htmlString.replace(/<p>\s*(<!--[^>]*-->)\s*<\/p>/gi, '$1');
        
        // ลบ <p> tags ว่างที่อาจเกิดขึ้นจากการลบ comments
        htmlString = htmlString.replace(/<p>\s*<\/p>/gi, '');

        setHtmlContent(htmlString.trim());
      } catch (error) {
        console.error('Conversion error:', error);
      } finally {
        setIsLoading(false);
// ... (rest of the code remains the same)
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <HelmetProvider>
      <Helmet>
        <title>Docx to Gutenberg Code App</title>
        <meta name="description" content="Docx to Gutenberg Code App" />
      </Helmet>
      <div className="container">
        <div className="site-content">
          <div className="col-left">
            <div className="space-left">
              <h1>Docx to <span>Gutenberg</span> Converter</h1>
              
              <div className="website-selector" style={{ marginBottom: '24px' }} ref={dropdownRef}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '12px',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#fff',
                  letterSpacing: '0.5px'
                }}>
                  🌐 เลือกเว็บไซต์
                </label>
                <div style={{ position: 'relative' }}>
                  {/* Custom Dropdown Button */}
                  <div
                    ref={dropdownButtonRef}
                    onClick={handleToggleDropdown}
                    tabIndex={0}
                    role="combobox"
                    aria-expanded={isDropdownOpen}
                    aria-haspopup="listbox"
                    aria-controls="website-listbox"
                    aria-label="เลือกเว็บไซต์"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleDropdown();
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '14px 40px 14px 16px',
                      fontSize: '16px',
                      fontWeight: '500',
                      border: isDropdownOpen ? '2px solid #3d83f2' : '2px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      color: selectedWebsite ? '#2c3e50' : '#999',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isDropdownOpen 
                        ? '0 4px 16px rgba(61, 131, 242, 0.3), 0 0 0 3px rgba(61, 131, 242, 0.1)' 
                        : '0 2px 8px rgba(0, 0, 0, 0.1)',
                      userSelect: 'none',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isDropdownOpen) {
                        e.target.style.borderColor = 'rgba(61, 131, 242, 0.5)';
                        e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isDropdownOpen) {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                      }
                    }}
                  >
                    {selectedWebsite || '-- กรุณาเลือกเว็บไซต์ --'}
                  </div>
                  
                  {/* Custom Dropdown Arrow */}
                  <div style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: isDropdownOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%) rotate(0deg)',
                    pointerEvents: 'none',
                    color: '#3d83f2',
                    fontSize: '20px',
                    transition: 'transform 0.3s ease'
                  }}>
                    ▼
                  </div>

                  {/* Custom Dropdown List */}
                  {isDropdownOpen && (
                    <div 
                      id="website-listbox"
                      role="listbox"
                      aria-label="รายการเว็บไซต์"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        backgroundColor: '#fff',
                        border: '2px solid #3d83f2',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                        zIndex: 1000,
                        overflow: 'hidden',
                        animation: 'dropdownSlide 0.15s ease-out'
                      }}
                    >
                      {/* Keyboard hints */}
                      <div style={{
                        padding: '8px 12px',
                        fontSize: '11px',
                        color: '#64748b',
                        backgroundColor: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <kbd style={{ 
                            padding: '2px 6px', 
                            backgroundColor: '#fff', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontFamily: 'monospace'
                          }}>↑↓</kbd>
                          เลือก
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <kbd style={{ 
                            padding: '2px 6px', 
                            backgroundColor: '#fff', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontFamily: 'monospace'
                          }}>Enter</kbd>
                          ยืนยัน
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <kbd style={{ 
                            padding: '2px 6px', 
                            backgroundColor: '#fff', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontFamily: 'monospace'
                          }}>Esc</kbd>
                          ปิด
                        </span>
                      </div>
                      <div style={{
                        padding: '8px 0',
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}>
                        {websites.map((website, index) => {
                          const isSelected = selectedWebsite === website;
                          const isHighlighted = highlightedIndex === index;
                          
                          return (
                            <div
                              key={website}
                              role="option"
                              aria-selected={isSelected}
                              data-website-index={index}
                              onClick={() => handleWebsiteSelect(website)}
                              onMouseEnter={() => setHighlightedIndex(index)}
                              onMouseDown={(e) => e.preventDefault()}
                              style={{
                                padding: '12px 16px',
                                fontSize: '16px',
                                color: isSelected ? '#3d83f2' : '#2c3e50',
                                backgroundColor: isHighlighted 
                                  ? (isSelected ? 'rgba(61, 131, 242, 0.2)' : 'rgba(61, 131, 242, 0.08)')
                                  : (isSelected ? 'rgba(61, 131, 242, 0.1)' : 'transparent'),
                                cursor: 'pointer',
                                transition: 'all 0.12s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontWeight: isSelected ? '600' : '500',
                                borderLeft: isSelected 
                                  ? '4px solid #3d83f2' 
                                  : isHighlighted 
                                    ? '4px solid rgba(61, 131, 242, 0.5)' 
                                    : '4px solid transparent',
                                animation: `listItemSlide 0.3s ease-out ${index * 0.05}s backwards`,
                                paddingLeft: isHighlighted ? '20px' : '16px',
                                boxShadow: isHighlighted ? 'inset 0 0 0 2px rgba(61, 131, 242, 0.2)' : 'none'
                              }}
                            >
                              <span style={{ 
                                fontSize: '18px',
                                opacity: isSelected ? 1 : 0,
                                transition: 'opacity 0.2s ease'
                              }}>
                                ✓
                              </span>
                              <span>{website}</span>
                              {isHighlighted && !isSelected && (
                                <span style={{
                                  marginLeft: 'auto',
                                  fontSize: '14px',
                                  color: '#3d83f2',
                                  opacity: 0.6
                                }}>
                                  ↵
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                
                {selectedWebsite && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(61, 131, 242, 0.1)',
                    border: '1px solid rgba(61, 131, 242, 0.3)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    animation: 'slideDown 0.2s ease-out',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '16px' }}>✓</span>
                    <span>เลือก: <strong>{selectedWebsite}</strong></span>
                  </div>
                )}
              </div>
              <style>{`
                @keyframes slideDown {
                  from {
                    opacity: 0;
                    transform: translateY(-8px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                
                @keyframes dropdownSlide {
                  from {
                    opacity: 0;
                    transform: translateY(-5px) scale(0.98);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                }
                
                @keyframes listItemSlide {
                  from {
                    opacity: 0;
                    transform: translateX(-10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateX(0);
                  }
                }
              `}</style>

              <div className="upload-file">
                <input type="file" accept=".docx" onChange={handleFileChange} />
                <div className={`upload-file-btn ${file ? 'active' : ''}`}>
                  <div className="upload-file-icon">
                    <FontAwesomeIcon icon={faFileArrowUp} />
                  </div>
                  <div className="upload-file-detail">
                    <span className="upload-file-label"><strong>Click to upload</strong> or drag and drop<br />DOCX are Allowed.</span>
                  </div>
                </div>
              </div>
              {isLoading ? (
                <button className="submit-btn loading" onClick={handleConvert}>
                  LOADING...
                  <FontAwesomeIcon icon={faCircleNotch} spin />
                </button>
              ) : (
                <button className={`submit-btn ${file ? '' : 'disable'}`} onClick={handleConvert}>
                  CONVERT
                  <FontAwesomeIcon icon={faFileImport} />
                </button>
              )}
            </div>
          </div>
          <div className="col-right">
            <div className="space-right">
              <div className="code-content">
                {/* Header Bar */}
                <div className="code-header">
                  <div className="code-header-left">
                    <div className="code-dots">
                      <span className="dot dot-red"></span>
                      <span className="dot dot-yellow"></span>
                      <span className="dot dot-green"></span>
                    </div>
                    <span className="code-title">Output Code</span>
                  </div>
                  <div className="code-header-right">
                    <span className="code-language">HTML</span>
                    <span className="code-lines">{htmlContent ? htmlContent.split('\n').length : 0} lines</span>
                    <button 
                      onClick={handleCopy} 
                      className={`copy-btn-header ${isCopied ? 'copied' : ''}`}
                      disabled={!htmlContent}
                      title={!htmlContent ? 'No content to copy' : 'Copy to clipboard'}
                    >
                      <FontAwesomeIcon icon={isCopied ? faCheck : faCopy} />
                      <span className="copy-btn-text">
                        {isCopied ? 'Copied!' : 'Copy'}
                      </span>
                    </button>
                  </div>
                </div>
                
                {/* Code Content */}
                <div className="code-wrapper">
                  {htmlContent ? (
                    <SyntaxHighlighter 
                      language="html" 
                      style={vscDarkPlus} 
                      className="syntax-highlighter" 
                      showLineNumbers
                      wrapLines={false}
                      wrapLongLines={false}
                    >
                      {htmlContent}
                    </SyntaxHighlighter>
                  ) : (
                    <pre className="syntax-highlighter" style={{ padding: '16px', color: '#d4d4d4', backgroundColor: '#1e1e1e', margin: 0, minHeight: '200px' }}>
                      {/* Empty state */}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </HelmetProvider>
  );
}

export default Home;