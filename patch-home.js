const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/Home.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add isFirstH2 variable before the heading forEach loop
content = content.replace(
  /(\s+\/\/ Convert heading tags to Gutenberg format\r?\n\s+)(doc\.querySelectorAll\('h1, h2, h3, h4, h5, h6'\)\.forEach)/,
  '$1let isFirstH2 = true;\n        $2'
);

// 2. Replace the index === 0 condition with H2-specific logic
content = content.replace(
  /if \(index === 0\) \{\r?\n\s+blockSeparator = '';\r?\n\s+blockTarget = '';\r?\n\s+\}/,
  `// H2 แรกไม่ใส่ separator/target, H2 ที่ 2+ ใส่ทั้งคู่, H1 ไม่ใส่เลย
          if (level === 'h2') {
            if (isFirstH2) {
              blockSeparator = '';
              blockTarget = '';
              isFirstH2 = false;
            }
          } else if (level === 'h1') {
            blockSeparator = '';
            blockTarget = '';
          }`
);

// 3. Fix newline formatting regex - simpler pattern that matches space between blocks
content = content.replace(
  /htmlString = htmlString\.replace\(\/\(<!-- \\\/wp:\[a-z0-9\\\/\-\]\+ -->\)\\s\+\(<!-- wp:\[a-z0-9\\\/\-\]\+\)\/gi, '\$1\\n\$2'\);/,
  `htmlString = htmlString.replace(/(<!-- \\/wp:[a-z0-9\\/_-]+ -->) +(<!-- wp:)/gi, '$1\\n$2');`
);

// 4. Add vsquareconsult.com to websitesWithoutSeparator
content = content.replace(
  /const websitesWithoutSeparator = \['vsquareclinic\.co', 'vsq-injector\.com', 'vsquare\.clinic', 'drvsquare\.com', 'doctorvsquareclinic\.com', 'bestbrandclinic\.com', 'monghaclinic\.com'\];/,
  `const websitesWithoutSeparator = ['vsquareclinic.co', 'vsq-injector.com', 'vsquare.clinic', 'drvsquare.com', 'doctorvsquareclinic.com', 'bestbrandclinic.com', 'monghaclinic.com', 'vsquareconsult.com'];`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patch applied successfully!');
