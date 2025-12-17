// แปลง table ที่มีลิงก์เดียวเป็น Gutenberg Button Block
// รองรับการตรวจจับ table 1 แถว 1 เซลล์ที่มีลิงก์

export function convertTableToButton(html) {
  if (!html || typeof html !== 'string') return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  // Find all table blocks
  const tableBlocks = Array.from(container.querySelectorAll('figure.wp-block-table'));
  
  tableBlocks.forEach(tableBlock => {
    const table = tableBlock.querySelector('table');
    if (!table) return;

    // Check if this table qualifies for conversion
    if (shouldConvertTable(table)) {
      const buttonBlock = createButtonBlock(table);
      if (buttonBlock) {
        // Replace the entire table block with button block
        tableBlock.outerHTML = buttonBlock;
      }
    }
  });

  return container.innerHTML;
}

// Helper function to normalize whitespace (including non-breaking spaces)
function normalizeWhitespace(text) {
  if (!text) return '';
  // Replace various whitespace characters with regular space then trim
  // \u00A0 = non-breaking space (from &nbsp;)
  // \u2007 = figure space
  // \u202F = narrow no-break space
  // \u200B = zero-width space
  // \u3000 = ideographic space
  return text
    .replace(/[\u00A0\u2007\u202F\u200B\u3000\t\n\r\f\v]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper function to check if table should be converted
function shouldConvertTable(table) {
  // Count all rows (including thead, tbody, tfoot)
  const allRows = Array.from(table.querySelectorAll('tr'));
  
  if (allRows.length !== 1) {
    return false; // Must have exactly 1 row
  }

  const row = allRows[0];
  const cells = Array.from(row.querySelectorAll('td, th'));
  
  if (cells.length !== 1) {
    return false; // Must have exactly 1 cell
  }

  const cell = cells[0];
  
  // Check for links
  const links = Array.from(cell.querySelectorAll('a'));
  
  if (links.length === 0) {
    return false; // Must have at least one link
  }
  
  // Check if cell contains ONLY link(s) and whitespace (no other significant content)
  // Clone cell and remove all links to see what's left
  const cellClone = cell.cloneNode(true);
  const linksInClone = cellClone.querySelectorAll('a');
  linksInClone.forEach(link => link.remove());
  
  // After removing links, check if there's any meaningful content left
  // Use normalizeWhitespace to handle &nbsp; and other whitespace characters (human error prevention)
  const remainingText = normalizeWhitespace(cellClone.textContent);
  
  // If there's other content besides links, don't convert
  if (remainingText.length > 0) {
    return false;
  }

  return true;
}

// Helper function to create button block
function createButtonBlock(table) {
  const row = table.querySelector('tr');
  const cell = row.querySelector('td, th');
  const links = Array.from(cell.querySelectorAll('a'));
  
  if (links.length === 0) return null;

  // If multiple links, combine them with <br>
  let buttonText = '';
  let buttonHref = '';
  let rel = '';

  if (links.length === 1) {
    const link = links[0];
    buttonHref = link.getAttribute('href') || '';
    buttonText = extractTextContent(link);
    rel = determineRelAttribute(buttonHref);
  } else {
    // Multiple links - check if all have the same URL
    const link = links[0];
    buttonHref = link.getAttribute('href') || '';
    rel = determineRelAttribute(buttonHref);
    
    // Check if all links have the same URL (common in Google Docs where text is split across multiple <p> tags)
    const allSameUrl = links.every(l => {
      const href = l.getAttribute('href') || '';
      return href === buttonHref;
    });
    
    if (allSameUrl) {
      // Same URL - combine text without <br> (they're part of the same button text)
      buttonText = links.map(link => extractTextContent(link)).join('');
    } else {
      // Different URLs - combine text with <br>
      buttonText = links.map(link => extractTextContent(link)).join('<br>');
    }
  }

  // Allow conversion even if href is empty, but text must exist
  if (!buttonText) return null;

  // Check if button text has multiple lines (contains <br>)
  const hasMultipleLines = /<br\s*\/?>/i.test(buttonText);
  
  // Create the Gutenberg Button Block
  // If no href, create button without href attribute
  let linkAttributes = 'class="wp-block-button__link has-text-align-center wp-element-button"';
  
  if (buttonHref) {
    linkAttributes += ` href="${escapeHtml(buttonHref)}" target="_blank" rel="${rel}"`;
  }

  // Add remove-arrow class to wp-block-buttons if button has multiple lines
  const buttonsClass = hasMultipleLines ? 'wp-block-buttons remove-arrow' : 'wp-block-buttons';
  const buttonsAttr = hasMultipleLines 
    ? '{"className":"remove-arrow","layout":{"type":"flex","justifyContent":"center"}}'
    : '{"layout":{"type":"flex","justifyContent":"center"}}';

  const buttonBlock = `<!-- wp:buttons ${buttonsAttr} -->
<div class="${buttonsClass}"><!-- wp:button {"textAlign":"center"} -->
<div class="wp-block-button"><a ${linkAttributes}>${buttonText}</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;

  return buttonBlock;
}

// Helper function to extract text content from link (remove <u>, <strong>, <span> tags)
function extractTextContent(link) {
  let text = link.innerHTML;
  
  // Remove <u> and </u> tags (including attributes)
  text = text.replace(/<\/?u[^>]*>/gi, '');
  
  // Remove <strong> and </strong> tags (including attributes)
  text = text.replace(/<\/?strong[^>]*>/gi, '');
  
  // Remove <span> tags with text-decoration underline
  text = text.replace(/<span[^>]*text-decoration[^>]*>([^<]*)<\/span>/gi, '$1');
  text = text.replace(/<\/?span[^>]*>/gi, '');
  
  // Remove other inline formatting tags but keep <br> and preserve line breaks
  text = text.replace(/<(?!br\s*\/?>)[^>]+>/gi, '');
  
  // Clean up extra whitespace around <br> tags but preserve them
  text = text.replace(/\s*<br\s*\/?>/gi, '<br>');
  
  // Clean up multiple spaces but preserve single spaces and line structure
  text = text.replace(/[ \t]+/g, ' ');
  
  // Trim leading and trailing whitespace (handles human errors like trailing spaces)
  text = text.trim();
  
  return text;
}

// Helper function to determine rel attribute based on domain
function determineRelAttribute(href) {
  if (!href) return 'noreferrer noopener nofollow';
  
  try {
    const url = new URL(href);
    const domain = url.hostname.toLowerCase();
    
    // Check for vsqclinic and vsquareclinic domains
    if (domain.includes('vsqclinic.com') || domain.includes('vsquareclinic.com') || domain.includes('vsquareclinic.co')) {
      return 'noreferrer noopener';
    }
    
    return 'noreferrer noopener nofollow';
  } catch (error) {
    // If URL parsing fails, treat as external link
    return 'noreferrer noopener nofollow';
  }
}

// Helper function to escape HTML attributes
function escapeHtml(text) {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}