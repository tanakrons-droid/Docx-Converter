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
  const links = Array.from(cell.querySelectorAll('a'));
  
  if (links.length === 0) {
    return false; // Must have at least one link
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
    // Multiple links - combine text with <br>, use first link's href
    const link = links[0];
    buttonHref = link.getAttribute('href') || '';
    rel = determineRelAttribute(buttonHref);
    
    buttonText = links.map(link => extractTextContent(link)).join('<br>');
  }

  // Allow conversion even if href is empty, but text must exist
  if (!buttonText) return null;

  // Create the Gutenberg Button Block
  // If no href, create button without href attribute
  let linkAttributes = 'class="wp-block-button__link wp-element-button remove-arrow"';
  
  if (buttonHref) {
    linkAttributes += ` href="${escapeHtml(buttonHref)}" target="_blank" rel="${rel}"`;
  }

  const buttonBlock = `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons">
<!-- wp:button -->
<div class="wp-block-button">
<a ${linkAttributes}>${buttonText}</a>
</div>
<!-- /wp:button -->
</div>
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
  text = text.replace(/\s*<br\s*\/?>\s*/gi, '<br>');
  
  // Clean up multiple spaces but preserve single spaces and line structure
  text = text.replace(/[ \t]+/g, ' ').trim();
  
  return text;
}

// Helper function to determine rel attribute based on domain
function determineRelAttribute(href) {
  if (!href) return 'noreferrer noopener nofollow';
  
  try {
    const url = new URL(href);
    const domain = url.hostname.toLowerCase();
    
    // Check for vsquareclinic domains
    if (domain.includes('vsquareclinic.com') || domain.includes('vsquareclinic.co')) {
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