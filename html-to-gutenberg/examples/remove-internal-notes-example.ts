#!/usr/bin/env node

/**
 * Example: Remove Internal Notes from HTML
 * 
 * Usage:
 *   npx ts-node examples/remove-internal-notes-example.ts
 *   node examples/remove-internal-notes-example.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { PolicyEngine } from '../src/policy/policyEngine.js';
import { removeInternalNotesPolicy } from '../src/policy/policies/removeInternalNotesPolicy.js';

// Read sample HTML file
const samplePath = path.join(import.meta.url.replace('file://', ''), '..', '..', 'samples', 'sample-internal-notes.html');
const sampleHtml = fs.readFileSync(samplePath, 'utf-8');

console.log('='.repeat(80));
console.log('🧹 Remove Internal Notes Policy Example');
console.log('='.repeat(80));

// Strategy 1: Direct policy usage
console.log('\n📋 Strategy 1: Direct Policy Usage');
console.log('-'.repeat(80));

import * as cheerio from 'cheerio';

const $ = cheerio.load(sampleHtml, { decodeEntities: false });

const directResult = removeInternalNotesPolicy.apply(sampleHtml, $, {
  autoRemove: true,
  removeEmptyContainers: true,
});

console.log(`\n✅ Policy Name: ${removeInternalNotesPolicy.name}`);
console.log(`📝 Description: ${removeInternalNotesPolicy.description}`);
console.log(`⚡ Priority: ${removeInternalNotesPolicy.priority}`);
console.log(`\n📊 Results:`);
console.log(`   - Passed: ${directResult.passed ? '✅ Yes' : '❌ No'}`);
console.log(`   - Warnings: ${directResult.warnings.length}`);
console.log(`   - Actions: ${directResult.actions.length}`);

if (directResult.warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  directResult.warnings.forEach((w, i) => {
    console.log(`   ${i + 1}. ${w}`);
  });
}

if (directResult.actions.length > 0) {
  console.log('\n🔧 Actions Taken:');
  directResult.actions.forEach((a, i) => {
    console.log(`   ${i + 1}. ${a}`);
  });
}

// Strategy 2: Using Policy Engine
console.log('\n\n📋 Strategy 2: Using Policy Engine');
console.log('-'.repeat(80));

const policyConfig = {
  removeInternalNotes: {
    enabled: true,
    options: {
      autoRemove: true,
      removeEmptyContainers: true,
    },
  },
};

const engine = new PolicyEngine(policyConfig);
const engineResult = engine.run(sampleHtml);

console.log(`\n📊 Policy Engine Results:`);
console.log(`   - Policies Triggered: ${engineResult.policiesTriggered.join(', ')}`);
console.log(`   - Warnings: ${engineResult.warnings.length}`);
console.log(`   - Errors: ${engineResult.errors.length}`);
console.log(`   - Total Actions: ${engineResult.actions.length}`);

if (engineResult.warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  engineResult.warnings.forEach((w, i) => {
    console.log(`   ${i + 1}. ${w}`);
  });
}

if (engineResult.actions.length > 0) {
  console.log('\n🔧 Actions Taken:');
  engineResult.actions.forEach((a, i) => {
    console.log(`   ${i + 1}. ${a}`);
  });
}

// Output comparison
console.log('\n\n📄 Content Comparison');
console.log('='.repeat(80));

// Count elements before and after
const beforeDoc = cheerio.load(sampleHtml, { decodeEntities: false });
const afterDoc = cheerio.load(directResult.html, { decodeEntities: false });

const beforePara = beforeDoc('p').length;
const afterPara = afterDoc('p').length;
const beforeText = beforeDoc('body').text().length;
const afterText = afterDoc('body').text().length;

console.log(`\n📊 Statistics:`);
console.log(`   Before:`);
console.log(`     - Paragraphs: ${beforePara}`);
console.log(`     - Text length: ${beforeText} characters`);
console.log(`   After:`);
console.log(`     - Paragraphs: ${afterPara}`);
console.log(`     - Text length: ${afterText} characters`);
console.log(`   Reduction:`);
console.log(`     - Paragraphs removed: ${beforePara - afterPara}`);
console.log(`     - Characters removed: ${beforeText - afterText}`);

// Show sample of cleaned content
console.log(`\n📝 Sample of Cleaned HTML (first 500 chars):`);
console.log('-'.repeat(80));
const cleanedPreview = directResult.html
  .replace(/^<p>.*?\[a\].*?<\/p>/i, '')
  .replace(/^<p>.*?To Team.*?<\/p>/i, '')
  .substring(0, 500);
console.log(cleanedPreview + '...');

// Save cleaned output
const outputPath = path.join(path.dirname(samplePath), 'sample-internal-notes-cleaned.html');
fs.writeFileSync(outputPath, directResult.html, 'utf-8');

console.log(`\n✅ Cleaned HTML saved to: ${outputPath}`);
console.log('='.repeat(80));

// Summary
console.log(`\n✨ Summary:`);
console.log(`   - Removed ${beforePara - afterPara} internal note paragraphs`);
console.log(`   - Reduced content size by ${beforeText - afterText} characters`);
console.log(`   - Policy is ready for production use`);
console.log('\n');
