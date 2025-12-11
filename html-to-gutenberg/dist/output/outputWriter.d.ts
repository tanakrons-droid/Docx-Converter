/**
 * Output Writer
 * Writes conversion results to files or stdout
 */
import type { ConversionReport, ConversionResult } from '../types/index.js';
export interface OutputOptions {
    /** Output format */
    format: 'html' | 'json';
    /** Include report in output */
    includeReport?: boolean;
    /** Pretty print JSON */
    prettyPrint?: boolean;
}
/**
 * Write conversion result to file
 */
export declare function writeToFile(result: ConversionResult, outputPath: string, options?: Partial<OutputOptions>): void;
/**
 * Format result for console output
 */
export declare function formatForConsole(result: ConversionResult, options?: Partial<OutputOptions>): string;
/**
 * Format report for console output
 */
export declare function formatReport(report: ConversionReport): string;
/**
 * Write report to separate file
 */
export declare function writeReportToFile(report: ConversionReport, outputPath: string): void;
//# sourceMappingURL=outputWriter.d.ts.map