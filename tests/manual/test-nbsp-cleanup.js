const cheerio = require('cheerio');

// Test HTML with multiple &nbsp; in TOC links
const testHtml = `
<ul class="listmenu two-column">
  <li><a href="#test-1">Link 1&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</a></li>
  <li><a href="#test-2">Link 2&nbsp;&nbsp;&nbsp;&nbsp;</a></li>
  <li><a href="#test-3">Link 3 with&nbsp;&nbsp;&nbsp;spaces</a></li>
  <li><a href="#test-4">Link 4</a></li>
</ul>
`;

const $ = cheerio.load(testHtml);

// Simulate the cleanup logic
$('a[href^="#"]').each((_, link) => {
    const $link = $(link);

    // Clean up multiple consecutive &nbsp; entities in link text
    let linkHtml = $link.html();
    if (linkHtml) {
        console.log('Before:', JSON.stringify(linkHtml));

        // Remove all trailing &nbsp; entities
        linkHtml = linkHtml.replace(/(&nbsp;|\u00a0)+$/g, '');
        // Replace multiple consecutive &nbsp; with single space
        linkHtml = linkHtml.replace(/(&nbsp;|\u00a0){2,}/g, ' ');

        console.log('After:', JSON.stringify(linkHtml));
        console.log('---');

        $link.html(linkHtml);
    }
});

console.log('\nFinal HTML:');
console.log($('ul').html());
