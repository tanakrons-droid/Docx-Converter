// Clean "Alt:" or "Alt :" text from image blocks and captions

export function cleanImageAltText(html) {
  if (!html || typeof html !== 'string') return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  // 🧹 STEP 1: Remove "Alt:" paragraphs after image figures
  const imageFigures = container.querySelectorAll('figure.wp-block-image, figure[class*="image"]');
  
  imageFigures.forEach((figure) => {
    const next = figure.nextElementSibling;
    if (!next) return;
    
    // Check if next element is a paragraph containing "Alt:" text
    const text = (next.textContent || '').trim();
    const hasAltPrefix = /^Alt\s*:/i.test(text);
    
    if (hasAltPrefix && next.tagName === 'P') {
      next.remove();
    }
  });

  // 🧹 STEP 2: Clean "Alt:" text from figcaptions and paragraphs
  const figcaptions = container.querySelectorAll('figcaption');
  
  figcaptions.forEach((figcaption) => {
    let html = figcaption.innerHTML;
    
    // Remove "Alt:" after <br> tags: <br>Alt: ...
    html = html.replace(/<br\s*\/?>[\s\n]*Alt\s*:[^<]*/gi, '');
    
    // Remove "Alt:" prefix and following text until end of line or sentence
    html = html.replace(/Alt\s*:\s*[^<\n]*/gi, '');
    
    // Clean up empty emphasis tags that might remain
    html = html.replace(/<(em|i)>\s*<\/(em|i)>/gi, '');
    
    // If figcaption becomes empty after cleanup, remove it entirely
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const cleanText = tempDiv.textContent.trim();
    
    if (cleanText) {
      figcaption.innerHTML = html;
    } else {
      figcaption.remove();
    }
  });

  // 🧹 STEP 2B: Clean "Alt:" from all paragraphs (including caption-img)
  const allParagraphs = container.querySelectorAll('p');
  
  allParagraphs.forEach((p) => {
    let html = p.innerHTML;
    
    // Remove "Alt:" after <br> tags: <br>Alt: ...
    html = html.replace(/<br\s*\/?>[\s\n]*Alt\s*:[^<]*/gi, '');
    
    // Remove standalone "Alt:" text
    html = html.replace(/Alt\s*:\s*[^<\n]*/gi, '');
    
    // Clean up trailing <br> tags
    html = html.replace(/<br\s*\/?>\s*$/gi, '');
    
    // Clean up empty emphasis tags
    html = html.replace(/<(em|i)>\s*<\/(em|i)>/gi, '');
    
    // Update or remove paragraph
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const cleanText = tempDiv.textContent.trim();
    
    if (cleanText) {
      p.innerHTML = html;
    } else {
      p.remove();
    }
  });

  // 🧹 STEP 3: Remove standalone paragraphs containing only "Alt:" text
  const paragraphs = container.querySelectorAll('p');
  
  paragraphs.forEach((p) => {
    const text = (p.textContent || '').trim();
    const isOnlyAlt = /^Alt\s*:/i.test(text);
    
    if (isOnlyAlt) {
      p.remove();
    }
  });

  // 🧹 POST-PROCESS: Clean up result
  let result = container.innerHTML;
  
  // Remove Gutenberg paragraph blocks that only contain "Alt:" text
  result = result.replace(
    /<!-- wp:paragraph[^>]*-->\s*<p[^>]*>Alt\s*:[^<]*<\/p>\s*<!-- \/wp:paragraph -->/gi,
    ''
  );
  
  // Remove empty paragraph blocks
  result = result.replace(
    /<!-- wp:paragraph[^>]*-->\s*<p[^>]*>\s*<\/p>\s*<!-- \/wp:paragraph -->/gi,
    ''
  );

  return result;
}
