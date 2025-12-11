/**
 * Output Writer
 * Writes conversion results to files or stdout
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
const defaultOptions = {
    format: 'html',
    includeReport: false,
    prettyPrint: true
};
/**
 * Write conversion result to file
 */
export function writeToFile(result, outputPath, options = {}) {
    const opts = { ...defaultOptions, ...options };
    // Ensure directory exists
    const dir = dirname(outputPath);
    mkdirSync(dir, { recursive: true });
    let content;
    if (opts.format === 'json') {
        const output = opts.includeReport
            ? result
            : { html: result.html };
        content = opts.prettyPrint
            ? JSON.stringify(output, null, 2)
            : JSON.stringify(output);
    }
    else {
        content = result.html;
    }
    writeFileSync(outputPath, content, 'utf-8');
}
/**
 * Format result for console output
 */
export function formatForConsole(result, options = {}) {
    const opts = { ...defaultOptions, ...options };
    if (opts.format === 'json') {
        const output = opts.includeReport
            ? result
            : { html: result.html };
        return opts.prettyPrint
            ? JSON.stringify(output, null, 2)
            : JSON.stringify(output);
    }
    return result.html;
}
/**
 * Format report for console output
 */
export function formatReport(report) {
    const lines = [
        '═══════════════════════════════════════════════════════════',
        '                    CONVERSION REPORT                       ',
        '═══════════════════════════════════════════════════════════',
        '',
        `📄 Input:  ${report.inputFile}`,
        `📁 Output: ${report.outputFile || '(stdout)'}`,
        `🕐 Time:   ${report.timestamp}`,
        `⏱️  Duration: ${report.executionTimeMs}ms`,
        `${report.success ? '✅' : '❌'} Status: ${report.success ? 'SUCCESS' : 'FAILED'}`,
        ''
    ];
    if (report.policiesTriggered.length > 0) {
        lines.push('📋 Policies Triggered:');
        for (const policy of report.policiesTriggered) {
            lines.push(`   • ${policy}`);
        }
        lines.push('');
    }
    if (report.actions.length > 0) {
        lines.push('🔧 Actions Taken:');
        for (const action of report.actions) {
            lines.push(`   • ${action}`);
        }
        lines.push('');
    }
    if (report.warnings.length > 0) {
        lines.push('⚠️  Warnings:');
        for (const warning of report.warnings) {
            lines.push(`   • ${warning}`);
        }
        lines.push('');
    }
    if (report.errors.length > 0) {
        lines.push('❌ Errors:');
        for (const error of report.errors) {
            lines.push(`   • ${error}`);
        }
        lines.push('');
    }
    lines.push('═══════════════════════════════════════════════════════════');
    return lines.join('\n');
}
/**
 * Write report to separate file
 */
export function writeReportToFile(report, outputPath) {
    const dir = dirname(outputPath);
    mkdirSync(dir, { recursive: true });
    const content = JSON.stringify(report, null, 2);
    writeFileSync(outputPath, content, 'utf-8');
}
//# sourceMappingURL=outputWriter.js.map