// ✅ Enhanced version of convertYouTubeLinksToWPEmbedWithCaption
// Removes wrapping Gutenberg paragraph blocks and detects captions intelligently

export function convertYouTubeLinksToWPEmbedWithCaption(html) {
  if (!html || typeof html !== 'string') return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  // 🧹 Remove Gutenberg paragraph wrappers that only contain YouTube URLs
  container.innerHTML = container.innerHTML.replace(
    /<!-- wp:paragraph[^>]*-->\s*(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^<]+)\s*<!-- \/wp:paragraph -->/gi,
    '$1'
  );

  const youtubeRegex =
    /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=[\w-]+(?:[&?][^\s&]*)?|shorts\/[\w-]+(?:[&?][^\s&]*)?)|youtu\.be\/[\w-]+(?:[?&][^\s&]*)?))/i;

  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // Helper: Check if text is a valid caption (3-200 chars, no links)
  const isValidCaption = (text) => {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    const length = trimmed.length;
    
    if (length < 3 || length > 200) return false;
    if (/<a\s+/i.test(trimmed) || /https?:\/\//i.test(trimmed)) return false;
    
    return true;
  };

  const paragraphs = Array.from(container.querySelectorAll('p, div, li'));

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const m = (p.textContent || '').trim().match(youtubeRegex);
    if (!m) continue;

    const url = m[1];

    // 🔎 Enhanced caption detection with validation
    let caption = '';
    let captionSource = null; // Track which element provided the caption

    // 1) Check for <br><em> or <br><i> in same element
    const brCap = p.innerHTML.match(/<br\s*\/?>\s*(?:<em>|<i>)([\s\S]*?)(?:<\/em>|<\/i>)/i);
    if (brCap && brCap[1]?.trim()) {
      const captionText = brCap[1].trim();
      if (isValidCaption(captionText)) {
        p.innerHTML = p.innerHTML.replace(/<br\s*\/?>\s*(?:<em>|<i>)[\s\S]*?(?:<\/em>|<\/i>)/i, '');
        caption = captionText;
      }
    }

    // 2) Check next element if no caption found yet
    if (!caption) {
      const nextEl = (() => {
        let n = p.nextSibling;
        while (n && n.nodeType === 3 && !n.textContent.trim()) n = n.nextSibling;
        return n && n.nodeType === 1 ? n : null;
      })();
      if (nextEl) {
        // Check for <em> or <i> tags first
        const em = nextEl.querySelector('em, i');
        if (em && em.textContent.trim()) {
          const captionText = em.textContent.trim();
          if (isValidCaption(captionText)) {
            caption = captionText;
            captionSource = nextEl;
          }
        } 
        // Otherwise check plain text
        else {
          const txt = (nextEl.textContent || '').trim();
          if (isValidCaption(txt)) {
            caption = txt;
            captionSource = nextEl;
          }
        }
      }
    }

    const blockStart = `<!-- wp:embed {"url":"${url}","type":"video","providerNameSlug":"youtube","responsive":true,"align":"center","className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} -->`;
    const blockEnd = `<!-- /wp:embed -->`;

    const figure = document.createElement('figure');
    figure.className = 'wp-block-embed aligncenter is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio';

    const wrapper = document.createElement('div');
    wrapper.className = 'wp-block-embed__wrapper';
    wrapper.innerHTML = escapeHtml(url);
    figure.appendChild(wrapper);

    // Only add figcaption if caption was detected
    if (caption) {
      const figcaption = document.createElement('figcaption');
      figcaption.className = 'wp-element-caption';
      figcaption.innerHTML = `<em>${escapeHtml(caption)}</em>`;
      figure.appendChild(figcaption);
      
      // Remove the source element that provided the caption
      if (captionSource) {
        captionSource.remove();
      }
    }

    // 🧩 Replace <p> or parent Gutenberg paragraph wrapper if exists
    const parent = p.closest('p') || p.closest('div.has-text-align-center');
    if (parent && parent !== container) {
      parent.outerHTML = `${blockStart}${figure.outerHTML}${blockEnd}`;
    } else {
      p.outerHTML = `${blockStart}${figure.outerHTML}${blockEnd}`;
    }
  }

  // 🧹 CLEANUP: Remove duplicate captions after YouTube embeds
  container.querySelectorAll('figure.wp-block-embed').forEach((fig) => {
    const next = fig.nextElementSibling;
    if (!next) return;
    
    // Get caption text from figcaption if exists
    const figcaption = fig.querySelector('figcaption');
    const captionText = figcaption ? figcaption.textContent.trim().toLowerCase() : '';
    
    // Get text from next element
    const nextText = (next.textContent || '').trim().toLowerCase();
    
    // Remove if next element contains "caption video" or duplicate caption
    if (nextText === 'caption video' || (captionText && nextText === captionText)) {
      next.remove();
    }
  });

  // 🧹 POST-PROCESS: Remove any remaining paragraph wrappers around embed blocks
  let result = container.innerHTML;
  
  // Remove paragraph wrappers that contain embed blocks
  result = result.replace(
    /<!-- wp:paragraph[^>]*-->\s*(<!-- wp:embed[\s\S]*?<!-- \/wp:embed -->)\s*<!-- \/wp:paragraph -->/gi,
    '$1'
  );
  
  // Remove empty paragraph blocks
  result = result.replace(
    /<!-- wp:paragraph[^>]*-->\s*<!-- \/wp:paragraph -->/gi,
    ''
  );

  return result;
}
