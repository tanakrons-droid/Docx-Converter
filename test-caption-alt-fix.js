const fs = require('fs');
const path = require('path');

// Import the converter
const { convertToGutenberg } = require('./src/utils/htmlToGutenbergConverter.js');

// Test HTML with mixed caption and Alt text
const testHTML = `
<!DOCTYPE html>
<html>
<head>
    <style>
        .c34 { text-align: center; }
        .c47 { font-style: normal; }
        .c66 { font-style: italic; }
    </style>
</head>
<body>
    <!-- Test Case 1: Image with caption containing BR and Alt text in same paragraph -->
    <p style="text-align: center;">
        <img src="https://example.com/lip-filler.jpg" alt="Lip Filler">
    </p>
    
    <!-- Caption with BR and Alt text mixed -->
    <p class="c34"><span class="c47">Example: Restylane Kysse</span><span class="c66"><br> Alt: Best Lip Filler Brands</span></p>
    
    <hr>
    
    <!-- Test Case 2: Normal caption without Alt text (should still work) -->
    <p style="text-align: center;">
        <img src="https://example.com/botox.jpg" alt="Botox">
    </p>
    
    <p style="text-align: center; font-style: italic;">This is a normal caption</p>
    
    <hr>
    
    <!-- Test Case 3: Caption with Alt text in separate line -->
    <p style="text-align: center;">
        <img src="https://example.com/filler.jpg" alt="Filler">
    </p>
    
    <p style="text-align: center; font-style: italic;">
        Before and After Results
        <br>
        Alt: Filler Before After
    </p>
</body>
</html>
`;

console.log('Testing Image Caption with Mixed Alt Text...\n');
console.log('='.repeat(80));

try {
    const result = convertToGutenberg(testHTML, 'vsquareclinic.com');

    console.log('\nConverted Gutenberg Blocks:\n');
    console.log(result);

    // Check if captions are correctly extracted
    console.log('\n' + '='.repeat(80));
    console.log('Validation Checks:');
    console.log('='.repeat(80));

    // Test 1: Should have "Example: Restylane Kysse" without Alt text
    if (result.includes('Example: Restylane Kysse') && !result.includes('Alt: Best Lip Filler Brands')) {
        console.log('✓ Test 1 PASSED: Caption extracted correctly, Alt text removed');
    } else {
        console.log('✗ Test 1 FAILED: Caption not extracted correctly');
        if (result.includes('Alt: Best Lip Filler Brands')) {
            console.log('  - Alt text was NOT removed from caption');
        }
    }

    // Test 2: Should have normal caption
    if (result.includes('This is a normal caption')) {
        console.log('✓ Test 2 PASSED: Normal caption works correctly');
    } else {
        console.log('✗ Test 2 FAILED: Normal caption not found');
    }

    // Test 3: Should have "Before and After Results" without Alt text
    if (result.includes('Before and After Results') && !result.includes('Alt: Filler Before After')) {
        console.log('✓ Test 3 PASSED: Multi-line caption extracted, Alt text removed');
    } else {
        console.log('✗ Test 3 FAILED: Multi-line caption not extracted correctly');
    }

    // Check for figcaption tags
    const figcaptionCount = (result.match(/<figcaption/g) || []).length;
    console.log(`\nTotal figcaptions found: ${figcaptionCount} (expected: 3)`);

    if (figcaptionCount === 3) {
        console.log('✓ All captions were converted to figcaption blocks');
    } else {
        console.log('✗ Some captions were not converted');
    }

} catch (error) {
    console.error('Error during conversion:', error);
    console.error(error.stack);
}

console.log('\n' + '='.repeat(80));
console.log('Test completed!');
