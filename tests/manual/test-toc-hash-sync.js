/**
 * Test script for TOC hash ID synchronization
 * This tests the syncTOCLinksWithHeadings function
 */

import { convert } from './src/utils/htmlToGutenbergConverter.js';
import fs from 'fs';

// Read the test HTML file
const testHtml = fs.readFileSync('./test-toc-hash-sync.html', 'utf-8');

console.log('Testing TOC Hash ID Synchronization...\n');
console.log('Input HTML has Google Docs-style hash IDs like #h.bsqkn5dcqt4t\n');

// Convert the HTML
const result = convert(testHtml, 'vsquareclinic.com');

console.log('Conversion completed!');
console.log(`Blocks created: ${result.report.blocksCreated}`);
console.log(`Execution time: ${result.report.executionTimeMs}ms\n`);

// Check if the hash IDs were converted
const hasOldHashIds = result.html.includes('#h.bsqkn5dcqt4t') ||
    result.html.includes('#h.yexbh3qyt0jd') ||
    result.html.includes('#h.ppbahuilra1l');

const hasNewHashIds = result.html.includes('#what-is-radiesse-plus-and-how-is-it-different-from-the-original') ||
    result.html.includes('#can-radiesse-plus-be-combined-with-radiesse') ||
    result.html.includes('#what-are-the-benefits-of-radiesse-plus');

console.log('Test Results:');
console.log(`❌ Old Google Docs hash IDs found: ${hasOldHashIds ? 'YES (FAIL)' : 'NO (PASS)'}`);
console.log(`✅ New text-based hash IDs found: ${hasNewHashIds ? 'YES (PASS)' : 'NO (FAIL)'}`);

// Extract a sample of the TOC list to show the conversion
const tocMatch = result.html.match(/<!-- wp:list.*?class="listmenu.*?<!-- \/wp:list -->/s);
if (tocMatch) {
    console.log('\nSample TOC output (first 500 chars):');
    console.log(tocMatch[0].substring(0, 500) + '...\n');
}

// Save the output for manual inspection
fs.writeFileSync('./test-toc-hash-sync-output.html', result.html, 'utf-8');
console.log('Full output saved to: test-toc-hash-sync-output.html');

if (!hasOldHashIds && hasNewHashIds) {
    console.log('\n✅ TEST PASSED: Hash IDs were successfully converted!');
} else {
    console.log('\n❌ TEST FAILED: Hash IDs were not properly converted.');
}
