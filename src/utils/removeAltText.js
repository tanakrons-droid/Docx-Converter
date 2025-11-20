// ลบข้อความ Alt ที่อยู่ใต้รูปภาพทั้งหมด
// รองรับรูปแบบ: Alt :, alt :, alt, ALT :, ALT, Alt:, alt:

export function removeAltText(html) {
  if (!html || typeof html !== 'string') return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  // Find all figure elements that contain images
  const figureElements = Array.from(container.querySelectorAll('figure.wp-block-image'));
  
  figureElements.forEach(figure => {
    // Check for paragraph elements after the figure that might contain Alt text
    let nextElement = figure.nextElementSibling;
    
    // Look for the next paragraph that might contain alt text
    while (nextElement) {
      if (nextElement.tagName === 'P') {
        const text = nextElement.textContent.trim();
        
        // Check if this paragraph contains alt text patterns
        if (isAltTextParagraph(text)) {
          // Remove the paragraph
          nextElement.remove();
          break;
        }
        
        // If we find a paragraph with substantial content that's not alt text, stop looking
        if (text.length > 0 && !isAltTextParagraph(text)) {
          break;
        }
      }
      
      // If we encounter another figure or heading, stop looking
      if (nextElement.tagName === 'FIGURE' || nextElement.tagName.match(/^H[1-6]$/)) {
        break;
      }
      
      nextElement = nextElement.nextElementSibling;
    }
  });

  // Also check for paragraphs with class="caption-img" or similar caption classes
  const captionParagraphs = Array.from(container.querySelectorAll('p.caption-img, p.has-text-align-center'));
  
  captionParagraphs.forEach(p => {
    const text = p.textContent.trim();
    if (isAltTextParagraph(text)) {
      p.remove();
    }
  });

  // Check for standalone alt text paragraphs anywhere in the content
  const allParagraphs = Array.from(container.querySelectorAll('p'));
  
  allParagraphs.forEach(p => {
    const text = p.textContent.trim();
    
    // Check if this is likely an alt text paragraph
    if (isAltTextParagraph(text) && isLikelyStandaloneAltText(p)) {
      p.remove();
    }
  });

  return container.innerHTML;
}

// Helper function to check if text matches alt text patterns
function isAltTextParagraph(text) {
  if (!text || text.length === 0) return false;
  
  // Patterns to match various alt text formats
  const altPatterns = [
    /^Alt\s*:\s*/i,           // "Alt :" or "Alt:"
    /^alt\s*:\s*/i,           // "alt :" or "alt:"
    /^ALT\s*:\s*/i,           // "ALT :" or "ALT:"
    /^Alt\s*$/i,              // Just "Alt"
    /^alt\s*$/i,              // Just "alt"
    /^ALT\s*$/i,              // Just "ALT"
    /Alt\s*:\s*.+/i,          // Contains "Alt : something"
    /alt\s*:\s*.+/i,          // Contains "alt : something"
    /ALT\s*:\s*.+/i           // Contains "ALT : something"
  ];

  return altPatterns.some(pattern => pattern.test(text));
}

// Helper function to determine if a paragraph is likely a standalone alt text
function isLikelyStandaloneAltText(paragraph) {
  const text = paragraph.textContent.trim();
  
  // If it clearly starts with alt patterns, it's likely alt text
  if (/^(Alt|alt|ALT)\s*:?\s*/i.test(text)) {
    return true;
  }
  
  // Check if it's a short paragraph with typical alt text characteristics
  if (text.length < 100 && text.length > 0) {
    // Check for common alt text indicators
    const altIndicators = [
      /^Alt\s*:/i,
      /^alt\s*:/i,
      /^ALT\s*:/i,
      /\balt\b.*:/i,
      /\bAlt\b.*:/i,
      /\bALT\b.*:/i
    ];
    
    return altIndicators.some(pattern => pattern.test(text));
  }
  
  return false;
}