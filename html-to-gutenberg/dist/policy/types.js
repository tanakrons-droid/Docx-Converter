/**
 * Policy Engine Types
 */
/**
 * Helper to create a successful policy result
 */
export function createSuccessResult(html, actions = []) {
    return {
        html,
        warnings: [],
        errors: [],
        passed: true,
        actions
    };
}
/**
 * Helper to create a failed policy result
 */
export function createFailedResult(html, errors, warnings = []) {
    return {
        html,
        warnings,
        errors,
        passed: false,
        actions: []
    };
}
/**
 * Helper to create a warning policy result
 */
export function createWarningResult(html, warnings, actions = []) {
    return {
        html,
        warnings,
        errors: [],
        passed: true,
        actions
    };
}
//# sourceMappingURL=types.js.map