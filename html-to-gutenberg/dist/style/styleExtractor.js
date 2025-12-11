/**
 * Style Extractor
 * Extracts <style> tags from HTML and parses CSS rules
 * Enhanced to support multiple selector types and inline styles
 */
import * as cheerio from 'cheerio';
/**
 * Extract all <style> tags from HTML
 * @param html - Input HTML string
 * @returns StyleExtractionResult with CSS map and raw CSS
 */
export function extractStyles(html) {
    const $ = cheerio.load(html);
    const styleContents = [];
    // Find all <style> tags
    $('style').each((_, element) => {
        const content = $(element).html();
        if (content) {
            styleContents.push(content);
        }
    });
    const rawCSS = styleContents.join('\n');
    const cssMap = parseCSS(rawCSS);
    return {
        cssMap,
        rawCSS
    };
}
/**
 * Extract all styles from HTML including:
 * - <style> tags
 * - Inline style attributes
 * - All selector types (class, ID, element, compound)
 * @param html - Input HTML string
 * @returns ExtendedStyleExtractionResult with comprehensive style data
 */
export function extractAllStyles(html) {
    const $ = cheerio.load(html);
    const styleContents = [];
    // Find all <style> tags
    $('style').each((_, element) => {
        const content = $(element).html();
        if (content) {
            styleContents.push(content);
        }
    });
    const rawCSS = styleContents.join('\n');
    // Parse all CSS rules with extended support
    const { cssMap, idMap, elementMap, selectorMap, mediaQueries } = parseCSSExtended(rawCSS);
    // Extract inline styles from elements
    const inlineStyles = extractInlineStyles($);
    return {
        cssMap,
        idMap,
        elementMap,
        selectorMap,
        inlineStyles,
        mediaQueries,
        rawCSS
    };
}
/**
 * Extract inline style attributes from all elements
 * @param $ - Cheerio instance
 * @returns Map of element identifiers to their inline styles
 */
function extractInlineStyles($) {
    const inlineStyles = new Map();
    let elementIndex = 0;
    $('[style]').each((_, element) => {
        const $el = $(element);
        const styleAttr = $el.attr('style');
        if (styleAttr) {
            // Create a unique identifier for this element
            const tagName = element.tagName?.toLowerCase() || 'unknown';
            const id = $el.attr('id');
            const classes = $el.attr('class');
            let identifier = tagName;
            if (id) {
                identifier = `#${id}`;
            }
            else if (classes) {
                identifier = `${tagName}.${classes.split(/\s+/).join('.')}`;
            }
            else {
                identifier = `${tagName}[${elementIndex}]`;
            }
            const styles = parseProperties(styleAttr);
            inlineStyles.set(identifier, styles);
            elementIndex++;
        }
    });
    return inlineStyles;
}
/**
 * Parse CSS string into a class-to-styles map
 * Handles Google Docs exported CSS format (e.g., .c1, .c2, etc.)
 * @param css - Raw CSS string
 * @returns CSSClassMap
 */
export function parseCSS(css) {
    const cssMap = {};
    // Remove comments
    const cleanCSS = css.replace(/\/\*[\s\S]*?\*\//g, '');
    // Match CSS rules: selector { properties }
    // This regex handles multi-line rules
    const ruleRegex = /([^{]+)\{([^}]*)\}/g;
    let match;
    while ((match = ruleRegex.exec(cleanCSS)) !== null) {
        const selector = match[1].trim();
        const properties = match[2].trim();
        // Skip @-rules (media queries, keyframes, etc.) for basic parsing
        if (selector.startsWith('@'))
            continue;
        // Handle multiple selectors separated by comma
        const selectors = selector.split(',').map(s => s.trim());
        for (const sel of selectors) {
            // Extract all class names from selector (handles compound selectors)
            const classMatches = sel.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g);
            for (const classMatch of classMatches) {
                const className = classMatch[1];
                const styleObj = parseProperties(properties);
                // Merge with existing styles if class already exists
                cssMap[className] = {
                    ...cssMap[className],
                    ...styleObj
                };
            }
        }
    }
    return cssMap;
}
/**
 * Extended CSS parser that extracts all selector types
 * @param css - Raw CSS string
 * @returns Object containing maps for different selector types
 */
export function parseCSSExtended(css) {
    const cssMap = {};
    const idMap = {};
    const elementMap = {};
    const selectorMap = {};
    const mediaQueries = [];
    // Remove comments
    let cleanCSS = css.replace(/\/\*[\s\S]*?\*\//g, '');
    // Extract and process media queries
    const mediaRegex = /@media\s*([^{]+)\{([\s\S]*?)\}\s*\}/g;
    let mediaMatch;
    while ((mediaMatch = mediaRegex.exec(css)) !== null) {
        const query = mediaMatch[1].trim();
        const mediaContent = mediaMatch[2];
        const mediaRules = parseRulesFromCSS(mediaContent);
        mediaQueries.push({ query, rules: mediaRules });
    }
    // Remove media queries from main CSS for regular parsing
    cleanCSS = cleanCSS.replace(/@media\s*[^{]+\{[\s\S]*?\}\s*\}/g, '');
    // Match CSS rules: selector { properties }
    const ruleRegex = /([^{@]+)\{([^}]*)\}/g;
    let match;
    while ((match = ruleRegex.exec(cleanCSS)) !== null) {
        const selectorGroup = match[1].trim();
        const properties = match[2].trim();
        // Skip @-rules
        if (selectorGroup.startsWith('@'))
            continue;
        const styleObj = parseProperties(properties);
        if (Object.keys(styleObj).length === 0)
            continue;
        // Store the full selector
        selectorMap[selectorGroup] = { ...selectorMap[selectorGroup], ...styleObj };
        // Handle multiple selectors separated by comma
        const selectors = selectorGroup.split(',').map(s => s.trim());
        for (const sel of selectors) {
            // Extract class names (handles compound selectors like .class1.class2)
            const classMatches = sel.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g);
            for (const classMatch of classMatches) {
                const className = classMatch[1];
                cssMap[className] = { ...cssMap[className], ...styleObj };
            }
            // Extract ID selectors
            const idMatches = sel.matchAll(/#([a-zA-Z_][a-zA-Z0-9_-]*)/g);
            for (const idMatch of idMatches) {
                const idName = idMatch[1];
                idMap[idName] = { ...idMap[idName], ...styleObj };
            }
            // Extract element selectors (at the beginning or after combinators)
            const elementMatches = sel.matchAll(/(?:^|[\s>+~])([a-zA-Z][a-zA-Z0-9]*)/g);
            for (const elemMatch of elementMatches) {
                const elemName = elemMatch[1].toLowerCase();
                // Skip pseudo-elements and pseudo-classes
                if (!elemName.startsWith(':')) {
                    elementMap[elemName] = { ...elementMap[elemName], ...styleObj };
                }
            }
        }
    }
    return { cssMap, idMap, elementMap, selectorMap, mediaQueries };
}
/**
 * Parse CSS rules from a CSS string (helper for media queries)
 */
function parseRulesFromCSS(css) {
    const rules = {};
    const ruleRegex = /([^{]+)\{([^}]*)\}/g;
    let match;
    while ((match = ruleRegex.exec(css)) !== null) {
        const selector = match[1].trim();
        const properties = match[2].trim();
        const styleObj = parseProperties(properties);
        if (Object.keys(styleObj).length > 0) {
            rules[selector] = { ...rules[selector], ...styleObj };
        }
    }
    return rules;
}
/**
 * Parse CSS properties string into an object
 * Enhanced to handle complex values like url(), content, CSS variables, and !important
 * @param properties - CSS properties string (e.g., "color: red; font-size: 12px")
 * @returns Object with property-value pairs
 */
export function parseProperties(properties) {
    const result = {};
    // Handle complex CSS values that may contain semicolons (url, content, etc.)
    // Use a state machine approach for accurate parsing
    const declarations = splitCSSDeclarations(properties);
    for (const declaration of declarations) {
        const trimmed = declaration.trim();
        if (!trimmed)
            continue;
        // Split by first colon only (value might contain colons, e.g., URLs, data URIs)
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1)
            continue;
        let property = trimmed.substring(0, colonIndex).trim().toLowerCase();
        let value = trimmed.substring(colonIndex + 1).trim();
        // Skip empty values
        if (!property || !value)
            continue;
        // Handle vendor prefixes - normalize property names
        // Keep the original property name but also store normalized version
        // Handle !important - preserve it in the value
        // (Gutenberg may need this information)
        result[property] = value;
    }
    return result;
}
/**
 * Split CSS declarations handling complex values with semicolons
 * Properly handles url(), content, calc(), var(), etc.
 */
function splitCSSDeclarations(css) {
    const declarations = [];
    let current = '';
    let depth = 0; // Track parentheses depth
    let inString = false;
    let stringChar = '';
    for (let i = 0; i < css.length; i++) {
        const char = css[i];
        const prevChar = i > 0 ? css[i - 1] : '';
        // Handle string literals
        if ((char === '"' || char === "'") && prevChar !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            }
            else if (char === stringChar) {
                inString = false;
                stringChar = '';
            }
        }
        // Track parentheses depth (for url(), calc(), var(), etc.)
        if (!inString) {
            if (char === '(')
                depth++;
            if (char === ')')
                depth--;
        }
        // Split on semicolon only when not inside parentheses or strings
        if (char === ';' && depth === 0 && !inString) {
            if (current.trim()) {
                declarations.push(current.trim());
            }
            current = '';
        }
        else {
            current += char;
        }
    }
    // Don't forget the last declaration (may not end with semicolon)
    if (current.trim()) {
        declarations.push(current.trim());
    }
    return declarations;
}
/**
 * Convert CSS properties object to inline style string
 * @param properties - Object with CSS property-value pairs
 * @returns Inline style string
 */
export function propertiesToInlineStyle(properties) {
    return Object.entries(properties)
        .map(([prop, value]) => `${prop}: ${value}`)
        .join('; ');
}
/**
 * Get combined styles for multiple classes
 * @param classes - Array of class names
 * @param cssMap - CSS class map
 * @returns Combined properties object
 */
export function getCombinedStyles(classes, cssMap) {
    const combined = {};
    for (const className of classes) {
        if (cssMap[className]) {
            Object.assign(combined, cssMap[className]);
        }
    }
    return combined;
}
//# sourceMappingURL=styleExtractor.js.map