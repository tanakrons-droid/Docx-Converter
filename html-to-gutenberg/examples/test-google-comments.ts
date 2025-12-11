#!/usr/bin/env node

/**
 * Test: Remove Google Docs Comments
 * Verifies that internal notes with [a], [b], [c] markers are properly removed
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { removeInternalNotesPolicy } from '../src/policy/policies/removeInternalNotesPolicy.js';

// Test HTML with Google Docs comments
const testHtml = `
<p><a href="#cmnt_ref1" id="cmnt1">[a]</a>ฝากระบุราคาใต้หัวข้อเลยเลยครับ</p>
<p><a href="#cmnt_ref2" id="cmnt2">[b]</a>@thitikron.t@vsqclinic.com แก้ไขแล้วนะคะ</p>
<p><a href="#cmnt_ref3" id="cmnt3">[c]</a>To Team Web : Banner+Internallink</p>
<p>This is real content that should stay.</p>
<p><a href="#cmnt_ref4" id="cmnt4">[d]</a>- Bienox https://www.vsquareclinic.com/tips/botxo-bienox/</p>
<p><a href="#cmnt_ref5" id="cmnt5">[e]</a>To Team Web : ใส่ Banner+Internallink</p>
<p>Another real paragraph with actual content for the website.</p>
`;

console.log('='.repeat(80));
console.log('🧪 TEST: Remove Google Docs Comments');
console.log('='.repeat(80));

console.log('\n📝 Input HTML:');
console.log('-'.repeat(80));
console.log(testHtml);

const $ = cheerio.load(testHtml, { decodeEntities: false });

const result = removeInternalNotesPolicy.apply(testHtml, $, {
  autoRemove: true,
  removeEmptyContainers: true,
});

console.log('\n✅ Output HTML:');
console.log('-'.repeat(80));
console.log(result.html);

console.log('\n📊 Results:');
console.log('-'.repeat(80));
console.log(`Passed: ${result.passed ? '✅ Yes' : '❌ No'}`);
console.log(`Warnings: ${result.warnings.length}`);
console.log(`Actions: ${result.actions.length}`);

if (result.warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  result.warnings.forEach((w, i) => {
    console.log(`  ${i + 1}. ${w}`);
  });
}

if (result.actions.length > 0) {
  console.log('\n🔧 Actions Taken:');
  result.actions.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a}`);
  });
}

// Verify content
const outputDoc = cheerio.load(result.html, { decodeEntities: false });
const remainingParagraphs = outputDoc('p').length;
const hasCommentAnchors = outputDoc('a[id^="cmnt"]').length > 0;
const hasRealContent = result.html.includes('This is real content');

console.log('\n✨ Verification:');
console.log('-'.repeat(80));
console.log(`Remaining paragraphs: ${remainingParagraphs}`);
console.log(`Has comment anchors: ${hasCommentAnchors ? '❌ FAILED' : '✅ PASSED'}`);
console.log(`Has real content: ${hasRealContent ? '✅ PASSED' : '❌ FAILED'}`);

console.log('\n' + '='.repeat(80));
if (!hasCommentAnchors && hasRealContent && remainingParagraphs === 2) {
  console.log('✅ TEST PASSED - All comments removed, real content preserved!');
} else {
  console.log('❌ TEST FAILED - Some comments may not have been removed');
}
console.log('='.repeat(80) + '\n');
