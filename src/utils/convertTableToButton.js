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

  // Helper to clean Google Redirect URLs
  const cleanGoogleUrl = (href) => {
    if (!href) return '';
    const match = href.match(/[?&]q=([^&]+)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch (e) {
        return match[1];
      }
    }
    return href;
  };

  // Map links to objects with cleaned properties
  const processedLinks = links.map(link => ({
    el: link,
    href: cleanGoogleUrl(link.getAttribute('href') || ''),
    text: extractTextContent(link)
  }));

  // Determine main href (use first link)
  let buttonHref = processedLinks[0].href;
  let rel = determineRelAttribute(buttonHref);

  // Combine text from all links
  let buttonText = processedLinks[0].text;

  for (let i = 1; i < processedLinks.length; i++) {
    const prev = processedLinks[i - 1];
    const curr = processedLinks[i];

    // Check if they are in different blocks paragraphs/divs/lists
    const prevBlock = prev.el.closest('p, div, li');
    const currBlock = curr.el.closest('p, div, li');

    // Check for intermediate <br> between links
    let hasBreak = false;
    let sibling = prev.el.nextSibling;
    while (sibling && sibling !== curr.el) {
      if (sibling.nodeType === 1 && sibling.tagName === 'BR') {
        hasBreak = true;
        break;
      }
      sibling = sibling.nextSibling;
    }

    // If different blocks OR (same block but distinct p element instances) OR has <br>, add break
    if (hasBreak || (prevBlock !== currBlock && prevBlock && currBlock)) {
      buttonText += '<br>' + curr.text;
    } else {
      // Same block - join directly (handles split links)
      buttonText += curr.text;
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

  // Check if we should add metadata (BestBrandClinic pattern)
  const isBestBrand = buttonText.includes('คลิกดูข้อมูลคลินิก');
  const metadata = isBestBrand
    ? ', "metadata":{"categories":[],"patternName":"core/block/3229","name":"คลิกดูข้อมูลคลินิก"}'
    : '';

  // Add remove-arrow class to wp-block-buttons if button has multiple lines
  const buttonsClass = hasMultipleLines ? 'wp-block-buttons remove-arrow' : 'wp-block-buttons';
  const buttonsAttr = hasMultipleLines
    ? `{"className":"remove-arrow","layout":{"type":"flex","justifyContent":"center"}${metadata}}`
    : `{"layout":{"type":"flex","justifyContent":"center"}${metadata}}`;

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

    // Check for Vsquare domains
    const vsquareDomains = [
      'vsquareclinic.com', 'vsqclinic.com', 'vsquareconsult.com',
      'vsquare.clinic', 'vsquare-under-eye.com', 'vsquareclinic.co',
      'vsq-injector.com', 'en.vsquareclinic.com', 'cn.vsquareclinic.com',
      'doctorvsquareclinic.com', 'drvsquare.com', 'monghaclinic.com',
      'bestbrandclinic.com'
    ];

    const isVsquare = vsquareDomains.some(d => domain.includes(d));

    if (isVsquare) {
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