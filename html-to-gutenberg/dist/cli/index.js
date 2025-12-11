#!/usr/bin/env node
/**
 * CLI Entry Point
 * Command-line interface for HTML to Gutenberg converter
 */
import { Command } from 'commander';
import { resolve } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { convertSync } from '../index.js';
import { writeToFile, formatReport, writeReportToFile } from '../output/outputWriter.js';
const program = new Command();
program
    .name('html-to-gutenberg')
    .description('Convert HTML (from Google Docs/Word) to WordPress Gutenberg blocks')
    .version('1.0.0');
program
    .argument('<input>', 'Input HTML file path')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('-c, --config <path>', 'Path to config file (YAML or JSON)')
    .option('-m, --mode <mode>', 'Conversion mode: strict or relaxed', 'relaxed')
    .option('-f, --format <format>', 'Output format: html or json', 'html')
    .option('--keep-classes', 'Keep CSS classes in output', false)
    .option('--no-inline-styles', 'Do not inline CSS styles')
    .option('--report', 'Show conversion report', false)
    .option('--report-file <path>', 'Save report to file')
    .option('-v, --verbose', 'Verbose output', false)
    .option('--dry-run', 'Run without writing output', false)
    .action(async (input, options) => {
    try {
        // Validate input file
        const inputPath = resolve(input);
        if (!existsSync(inputPath)) {
            console.error(chalk.red(`Error: Input file not found: ${inputPath}`));
            process.exit(1);
        }
        // Validate mode
        const mode = options.mode;
        if (mode !== 'strict' && mode !== 'relaxed') {
            console.error(chalk.red(`Error: Invalid mode "${mode}". Use "strict" or "relaxed".`));
            process.exit(1);
        }
        // Validate format
        const format = options.format;
        if (format !== 'html' && format !== 'json') {
            console.error(chalk.red(`Error: Invalid format "${format}". Use "html" or "json".`));
            process.exit(1);
        }
        if (options.verbose) {
            console.log(chalk.blue('🔄 Starting conversion...'));
            console.log(chalk.gray(`   Input: ${inputPath}`));
            if (options.output) {
                console.log(chalk.gray(`   Output: ${resolve(options.output)}`));
            }
            console.log(chalk.gray(`   Mode: ${mode}`));
            console.log(chalk.gray(`   Format: ${format}`));
        }
        // Run conversion
        const result = convertSync(inputPath, {
            configPath: options.config,
            inputPath,
            config: {
                mode,
                keepClasses: options.keepClasses,
                inlineStyles: options.inlineStyles !== false,
                outputFormat: format
            }
        });
        // Handle result
        if (!result.report.success && mode === 'strict') {
            console.error(chalk.red('❌ Conversion failed in strict mode'));
            if (result.report.errors.length > 0) {
                console.error(chalk.red('\nErrors:'));
                result.report.errors.forEach(err => {
                    console.error(chalk.red(`  • ${err}`));
                });
            }
            process.exit(1);
        }
        // Show report if requested
        if (options.report || options.verbose) {
            console.log('\n' + formatReport(result.report));
        }
        // Save report to file if requested
        if (options.reportFile) {
            const reportPath = resolve(options.reportFile);
            writeReportToFile(result.report, reportPath);
            if (options.verbose) {
                console.log(chalk.green(`📋 Report saved to: ${reportPath}`));
            }
        }
        // Output result
        if (options.dryRun) {
            console.log(chalk.yellow('\n🔍 Dry run - no output written'));
            if (options.verbose) {
                console.log(chalk.gray('\nPreview (first 500 chars):'));
                console.log(chalk.gray(result.html.substring(0, 500) + '...'));
            }
        }
        else if (options.output) {
            const outputPath = resolve(options.output);
            result.report.outputFile = outputPath;
            writeToFile(result, outputPath, {
                format,
                includeReport: format === 'json',
                prettyPrint: true
            });
            console.log(chalk.green(`✅ Output saved to: ${outputPath}`));
        }
        else {
            // Output to stdout
            console.log(result.html);
        }
        // Show warnings
        if (result.report.warnings.length > 0 && options.verbose) {
            console.log(chalk.yellow('\n⚠️  Warnings:'));
            result.report.warnings.forEach(warning => {
                console.log(chalk.yellow(`  • ${warning}`));
            });
        }
        // Exit with appropriate code
        process.exit(result.report.success ? 0 : 1);
    }
    catch (error) {
        console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
        if (options.verbose && error instanceof Error) {
            console.error(chalk.gray(error.stack));
        }
        process.exit(1);
    }
});
// Add list-policies command
program
    .command('list-policies')
    .description('List all available policies')
    .action(() => {
    console.log(chalk.blue('\n📋 Available Policies:\n'));
    const policies = [
        { name: 'forbiddenTags', desc: 'ลบแท็ก HTML ที่ไม่อนุญาต (script, iframe, etc.)', priority: 5 },
        { name: 'removeBeforeH1', desc: 'ลบเนื้อหาทั้งหมดที่อยู่ก่อนหัวข้อ H1 แรก', priority: 3 },
        { name: 'requireH2', desc: 'ตรวจสอบว่ามีหัวข้อ H2 ตามจำนวนที่กำหนด', priority: 10 },
        { name: 'minImageCount', desc: 'ตรวจสอบจำนวนรูปภาพขั้นต่ำ', priority: 20 },
        { name: 'addDisclaimer', desc: 'เพิ่ม Disclaimer เมื่อพบคำที่กำหนด', priority: 50 }
    ];
    policies.forEach(p => {
        console.log(chalk.green(`  ${p.name}`));
        console.log(chalk.gray(`    ${p.desc}`));
        console.log(chalk.gray(`    Priority: ${p.priority}\n`));
    });
});
// Add init command to create config file
program
    .command('init')
    .description('Create a default configuration file')
    .option('-o, --output <path>', 'Output path for config file', './html-to-gutenberg.config.yaml')
    .action(async (options) => {
    const configContent = `# HTML to Gutenberg Converter Configuration

# Conversion mode: 'strict' or 'relaxed'
# strict: fails if any policy check fails
# relaxed: auto-fixes issues and continues
mode: relaxed

# Keep original CSS classes in output
keepClasses: false

# Inline CSS styles into elements
inlineStyles: true

# Output format: 'html' or 'json'
outputFormat: html

# Policy configuration
policies:
  # Remove forbidden HTML tags
  forbiddenTags:
    enabled: true
    options:
      tags:
        - script
        - iframe
        - object
        - embed
        - form
      autoRemove: true

  # Remove content before first H1
  removeBeforeH1:
    enabled: true
    options:
      autoRemove: true

  # Require minimum H2 headings
  requireH2:
    enabled: true
    options:
      minCount: 1
      autoGenerate: false

  # Require minimum images
  minImageCount:
    enabled: false
    options:
      minCount: 1
      autoInsertPlaceholder: false

  # Auto-add disclaimer for promotional content
  addDisclaimer:
    enabled: true
    options:
      keywords:
        - โปรโมชั่น
        - ส่วนลด
        - ราคาพิเศษ
        - promotion
        - discount
      position: end
`;
    const outputPath = resolve(options.output);
    if (existsSync(outputPath)) {
        console.log(chalk.yellow(`⚠️  Config file already exists: ${outputPath}`));
        console.log(chalk.gray('   Use a different path with --output option'));
        return;
    }
    const { writeFileSync } = await import('fs');
    writeFileSync(outputPath, configContent, 'utf-8');
    console.log(chalk.green(`✅ Config file created: ${outputPath}`));
});
program.parse();
//# sourceMappingURL=index.js.map