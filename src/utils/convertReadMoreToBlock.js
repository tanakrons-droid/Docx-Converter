// Convert "อ่านเพิ่มเติม" or "Read more" sections to Gutenberg paragraph blocks with vsq-readmore class
// ตรวจจับย่อหน้าที่ขึ้นต้นด้วย "อ่านเพิ่มเติม :", "อ่านบทความเพิ่มเติม :" หรือ "Read more :"
// และมีลิงก์ตามหลัง แล้วแปลงเป็น Gutenberg block ที่มี nested <p> structure

export function convertReadMoreToBlock(html) {
  if (!html || typeof html !== 'string') return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  // Internal domains for rel attribute logic
  const internalDomains = ['vsquareclinic.com', 'vsquareclinic.co'];

  // Check if URL is internal
  const isInternalLink = (url) => {
    try {
      const urlObj = new URL(url);
      return internalDomains.some(domain => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  };

  // Get appropriate rel attribute
  const getRelAttribute = (url) => {
    return isInternalLink(url) 
      ? 'noreferrer noopener' 
      : 'noreferrer noopener nofollow';
  };

  // Find all paragraphs and text nodes that might contain read more patterns
  const allElements = Array.from(container.querySelectorAll('*')).concat(Array.from(container.childNodes));
  
  // Process each element to find read more patterns
  allElements.forEach((element) => {
    if (!element || !element.textContent) return;
    
    const text = element.textContent.trim();
    
    // Check if it starts with read more phrases (exact match for patterns)
    const readMorePattern = /^(อ่านเพิ่มเติม\s*:\s*|อ่านบทความเพิ่มเติม\s*:\s*|Read\s*more\s*:\s*)/i;
    const isReadMore = readMorePattern.test(text);
    
    if (isReadMore) {
      // Look for a link in the same element or adjacent elements
      let link = null;
      let linkContainer = element;
      
      // Check if the element itself contains a link
      if (element.querySelector && element.querySelector('a[href]')) {
        link = element.querySelector('a[href]');
      }
      // Check if it's a text node followed by a link element
      else if (element.nextSibling && element.nextSibling.tagName === 'A') {
        link = element.nextSibling;
        linkContainer = element.parentNode;
      }
      // Check if the element is a paragraph containing both text and link
      else if (element.tagName === 'P') {
        link = element.querySelector('a[href]');
        linkContainer = element;
      }
      
      if (link && link.getAttribute('href')) {
        const href = link.getAttribute('href');
        const linkText = link.textContent.trim();
        const rel = getRelAttribute(href);
        
        // ป้องกันการสร้าง empty blocks
        if (!href || !linkText) {
          return;
        }
        
        // Extract the read more prefix text (รักษารูปแบบการเว้นวรรคและเครื่องหมายวรรคตอน)
        const match = text.match(readMorePattern);
        const prefixText = match ? match[0].trim() : '';
        
        // สร้างโครงสร้าง Gutenberg block ตามข้อกำหนดใหม่ (nested <p> structure)
        const readMoreBlock = `<!-- wp:paragraph {"className":"vsq-readmore"} -->
<p class="vsq-readmore">
  <p class="vsq-readmore" style="text-align:left;">
    ${prefixText} <a href="${href}" target="_blank" rel="${rel}">${linkText}</a>
  </p>
</p>
<!-- /wp:paragraph -->`;
        
        // Replace the element with the Gutenberg block
        const tempWrapper = document.createElement('div');
        tempWrapper.innerHTML = readMoreBlock;
        
        const parent = linkContainer.parentNode;
        if (parent) {
          // Insert the new block structure
          const blockElements = Array.from(tempWrapper.childNodes);
          blockElements.forEach(blockElement => {
            parent.insertBefore(blockElement, linkContainer);
          });
          
          // Remove the original element
          parent.removeChild(linkContainer);
        }
      }
    }
  });

  return container.innerHTML;
}