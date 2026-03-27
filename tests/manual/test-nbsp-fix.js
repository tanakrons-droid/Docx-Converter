// Test generateHashId function with &nbsp; handling

// Simulate the generateHashId function
function generateHashId(text) {
    return text
        .replace(/\<\/?[^\>]+(\>|$)/g, '')  // Remove HTML tags first
        .replace(/\[.*?\]/g, '')       // Remove shortcodes like [current_year]
        .replace(/&nbsp;/gi, ' ')      // Convert &nbsp; to regular space (IMPORTANT: do this before &amp; normalization)
        .replace(/\u00A0/g, ' ')       // Convert Unicode non-breaking space to regular space
        .replace(/\&amp;/g, '&')      // Normalize &amp; to & first (IMPORTANT: do this before toLowerCase)
        .toLowerCase()
        // Remove common punctuation and special characters
        .replace(/['"""`]/g, '')  // Remove quotes and apostrophes
        .replace(/[,;!]/g, '')     // Remove commas, semicolons, exclamation marks
        .replace(/\?/g, '')
        .replace(/\./g, '')
        .replace(/:/g, '')
        .replace(/—/g, '-')
        .replace(/–/g, '-')
        .replace(/\&/g, '-and-')      // Convert & to -and- (after normalization)
        .replace(/\+/g, '-plus-')     // Convert + to -plus-
        .replace(/\//g, '-')          // Convert / to -
        .replace(/\\/g, '-')          // Convert \ to -
        .replace(/\(/g, '')           // Remove opening parenthesis
        .replace(/\)/g, '')           // Remove closing parenthesis
        .replace(/\[/g, '')           // Remove opening bracket
        .replace(/\]/g, '')           // Remove closing bracket
        .trim()
        .replace(/\s+/g, '-')         // Replace spaces with dashes
        .replace(/-+/g, '-')          // Replace multiple dashes with single dash
        .replace(/^-+/, '')           // Remove leading dashes
        .replace(/-+$/, '')           // Remove trailing dashes
        // Keep only Thai, Chinese, English letters, numbers, and dashes
        .replace(/[^\u0E00-\u0E7F\u4E00-\u9FFFA-Za-z0-9-]/g, '');
}

console.log('Testing generateHashId with &nbsp; handling\n');
console.log('='.repeat(80));

// Test cases
const testCases = [
    {
        name: 'Test 1: Text with &nbsp; entity',
        input: 'Is Beard Laser Hair Removal&nbsp;Safe?',
        expected: 'is-beard-laser-hair-removal-safe'
    },
    {
        name: 'Test 2: Text with Unicode non-breaking space',
        input: 'Is Beard Laser Hair Removal\u00A0Safe?',
        expected: 'is-beard-laser-hair-removal-safe'
    },
    {
        name: 'Test 3: Text without &nbsp;',
        input: 'Is Beard Laser Hair Removal Safe?',
        expected: 'is-beard-laser-hair-removal-safe'
    },
    {
        name: 'Test 4: Text with multiple &nbsp;',
        input: 'Best&nbsp;Lip&nbsp;Filler&nbsp;Brands',
        expected: 'best-lip-filler-brands'
    },
    {
        name: 'Test 5: Text with &amp; (should become -and-)',
        input: 'Q&amp;A About Botox',
        expected: 'q-and-a-about-botox'
    },
    {
        name: 'Test 6: Mixed &nbsp; and &amp;',
        input: 'Q&amp;A&nbsp;About&nbsp;Botox',
        expected: 'q-and-a-about-botox'
    }
];

let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
    const result = generateHashId(testCase.input);
    const passed = result === testCase.expected;

    console.log(`\n${testCase.name}`);
    console.log(`Input:    "${testCase.input}"`);
    console.log(`Expected: "${testCase.expected}"`);
    console.log(`Result:   "${result}"`);
    console.log(`Status:   ${passed ? '✓ PASSED' : '✗ FAILED'}`);

    if (passed) {
        passedTests++;
    } else {
        failedTests++;
    }
});

console.log('\n' + '='.repeat(80));
console.log(`\nTest Summary: ${passedTests} passed, ${failedTests} failed out of ${testCases.length} tests`);

if (failedTests === 0) {
    console.log('✓ All tests passed!');
} else {
    console.log('✗ Some tests failed. Please review the results above.');
}
