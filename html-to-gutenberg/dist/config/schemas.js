/**
 * Zod schemas for configuration validation
 */
import { z } from 'zod';
/**
 * Policy configuration schema
 */
export const PolicyConfigSchema = z.union([
    z.boolean(),
    z.object({
        enabled: z.boolean(),
        options: z.record(z.unknown()).optional()
    })
]);
/**
 * Policies configuration schema
 */
export const PoliciesConfigSchema = z.record(PolicyConfigSchema);
/**
 * Conversion mode schema
 */
export const ConversionModeSchema = z.enum(['strict', 'relaxed']);
/**
 * Output format schema
 */
export const OutputFormatSchema = z.enum(['html', 'json']);
/**
 * Main converter configuration schema
 */
export const ConverterConfigSchema = z.object({
    mode: ConversionModeSchema.default('relaxed'),
    keepClasses: z.boolean().default(false),
    inlineStyles: z.boolean().default(true),
    outputFormat: OutputFormatSchema.default('html'),
    policies: PoliciesConfigSchema.default({})
});
/**
 * CLI options schema
 */
export const CLIOptionsSchema = z.object({
    input: z.string(),
    output: z.string().optional(),
    config: z.string().optional(),
    mode: ConversionModeSchema.optional(),
    verbose: z.boolean().default(false),
    dryRun: z.boolean().default(false)
});
//# sourceMappingURL=schemas.js.map