/**
 * Zod schemas for configuration validation
 */
import { z } from 'zod';
/**
 * Policy configuration schema
 */
export declare const PolicyConfigSchema: z.ZodUnion<[z.ZodBoolean, z.ZodObject<{
    enabled: z.ZodBoolean;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    options?: Record<string, unknown> | undefined;
}, {
    enabled: boolean;
    options?: Record<string, unknown> | undefined;
}>]>;
/**
 * Policies configuration schema
 */
export declare const PoliciesConfigSchema: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodBoolean, z.ZodObject<{
    enabled: z.ZodBoolean;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    options?: Record<string, unknown> | undefined;
}, {
    enabled: boolean;
    options?: Record<string, unknown> | undefined;
}>]>>;
/**
 * Conversion mode schema
 */
export declare const ConversionModeSchema: z.ZodEnum<["strict", "relaxed"]>;
/**
 * Output format schema
 */
export declare const OutputFormatSchema: z.ZodEnum<["html", "json"]>;
/**
 * Main converter configuration schema
 */
export declare const ConverterConfigSchema: z.ZodObject<{
    mode: z.ZodDefault<z.ZodEnum<["strict", "relaxed"]>>;
    keepClasses: z.ZodDefault<z.ZodBoolean>;
    inlineStyles: z.ZodDefault<z.ZodBoolean>;
    outputFormat: z.ZodDefault<z.ZodEnum<["html", "json"]>>;
    policies: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodBoolean, z.ZodObject<{
        enabled: z.ZodBoolean;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        options?: Record<string, unknown> | undefined;
    }, {
        enabled: boolean;
        options?: Record<string, unknown> | undefined;
    }>]>>>;
}, "strip", z.ZodTypeAny, {
    mode: "strict" | "relaxed";
    keepClasses: boolean;
    inlineStyles: boolean;
    outputFormat: "html" | "json";
    policies: Record<string, boolean | {
        enabled: boolean;
        options?: Record<string, unknown> | undefined;
    }>;
}, {
    mode?: "strict" | "relaxed" | undefined;
    keepClasses?: boolean | undefined;
    inlineStyles?: boolean | undefined;
    outputFormat?: "html" | "json" | undefined;
    policies?: Record<string, boolean | {
        enabled: boolean;
        options?: Record<string, unknown> | undefined;
    }> | undefined;
}>;
/**
 * CLI options schema
 */
export declare const CLIOptionsSchema: z.ZodObject<{
    input: z.ZodString;
    output: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodEnum<["strict", "relaxed"]>>;
    verbose: z.ZodDefault<z.ZodBoolean>;
    dryRun: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    input: string;
    verbose: boolean;
    dryRun: boolean;
    mode?: "strict" | "relaxed" | undefined;
    output?: string | undefined;
    config?: string | undefined;
}, {
    input: string;
    mode?: "strict" | "relaxed" | undefined;
    output?: string | undefined;
    config?: string | undefined;
    verbose?: boolean | undefined;
    dryRun?: boolean | undefined;
}>;
export type CLIOptions = z.infer<typeof CLIOptionsSchema>;
//# sourceMappingURL=schemas.d.ts.map