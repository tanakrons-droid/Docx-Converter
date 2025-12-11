# HTML to Gutenberg Converter

ระบบแปลงบทความจาก HTML (Google Docs / Word Export) เป็น WordPress Gutenberg Block Markup พร้อม Policy Engine สำหรับตรวจสอบและปรับแต่งเนื้อหาตามกฎของบริษัท

## ✨ Features

- **HTML Parsing & Cleaning**: ทำความสะอาด HTML จาก Google Docs / Word
- **Style Extraction & Inlining**: ดึง CSS classes และแปลงเป็น inline styles
- **Policy Engine**: ระบบตรวจสอบและปรับแต่งเนื้อหาตามกฎที่กำหนด
- **Gutenberg Conversion**: แปลง HTML เป็น WordPress Gutenberg blocks
- **Extensible**: เพิ่ม policy ใหม่ได้ง่าย ผ่าน config หรือ code

## 📦 Installation

```bash
# Clone หรือ copy โปรเจกต์
cd html-to-gutenberg

# ติดตั้ง dependencies
npm install

# Build โปรเจกต์
npm run build
```

## 🚀 Quick Start

### Basic Usage

```bash
# แปลงไฟล์ HTML
npm run convert -- samples/sample-google-docs.html -o output/result.html

# แปลงพร้อมแสดง report
npm run convert -- samples/sample-google-docs.html -o output/result.html --report

# ใช้ config file
npm run convert -- input.html -o output.html -c config/policies.yaml
```

### CLI Options

```
Usage: html-to-gutenberg [options] <input>

Arguments:
  input                    Input HTML file path

Options:
  -o, --output <path>      Output file path (default: stdout)
  -c, --config <path>      Path to config file (YAML or JSON)
  -m, --mode <mode>        Conversion mode: strict or relaxed (default: "relaxed")
  -f, --format <format>    Output format: html or json (default: "html")
  --keep-classes           Keep CSS classes in output
  --no-inline-styles       Do not inline CSS styles
  --report                 Show conversion report
  --report-file <path>     Save report to file
  -v, --verbose            Verbose output
  --dry-run                Run without writing output
  -h, --help               Display help
```

### Additional Commands

```bash
# List available policies
npm run convert -- list-policies

# Create default config file
npm run convert -- init
```

## 📁 Project Structure

```
html-to-gutenberg/
├── src/
│   ├── config/           # Configuration loading
│   ├── importer/         # HTML file loading
│   ├── style/            # CSS extraction & inlining
│   ├── html/             # HTML cleaning
│   ├── policy/           # Policy engine
│   │   └── policies/     # Individual policies
│   ├── gutenberg/        # Gutenberg conversion
│   ├── output/           # Output writing
│   ├── cli/              # CLI interface
│   └── index.ts          # Main pipeline
├── config/               # Configuration files
├── samples/              # Sample input files
├── tests/                # Test files
└── README.md
```

## 🔧 Configuration

### Config File (YAML)

```yaml
mode: relaxed              # strict | relaxed
keepClasses: false         # Keep CSS classes
inlineStyles: true         # Inline CSS styles
outputFormat: html         # html | json

policies:
  forbiddenTags:
    enabled: true
    options:
      tags: [script, iframe, object, embed]
      autoRemove: true

  requireH2:
    enabled: true
    options:
      minCount: 1
      autoGenerate: false

  minImageCount:
    enabled: false
    options:
      minCount: 1

  addDisclaimer:
    enabled: true
    options:
      keywords: [โปรโมชั่น, ส่วนลด]
      position: end
```

## 📋 Available Policies

| Policy | Description | Options |
|--------|-------------|---------|
| `forbiddenTags` | ลบแท็ก HTML ที่ไม่อนุญาต | `tags`, `autoRemove`, `keepContent` |
| `requireH2` | ตรวจสอบจำนวน H2 headings | `minCount`, `autoGenerate` |
| `minImageCount` | ตรวจสอบจำนวนรูปภาพ | `minCount`, `autoInsertPlaceholder` |
| `addDisclaimer` | เพิ่ม Disclaimer อัตโนมัติ | `keywords`, `position`, `disclaimerHtml` |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/htmlCleaner.test.ts
```

## 📝 Adding Custom Policies

1. สร้างไฟล์ policy ใหม่ใน `src/policy/policies/`:

```typescript
// src/policy/policies/myCustomPolicy.ts
import type { CheerioAPI } from 'cheerio';
import type { Policy, PolicyOptions, PolicyResult } from '../types.js';
import { createSuccessResult, createWarningResult } from '../types.js';

export const myCustomPolicy: Policy = {
  name: 'myCustomPolicy',
  description: 'คำอธิบาย policy',
  priority: 100,

  apply(html: string, $: CheerioAPI, options: PolicyOptions = {}): PolicyResult {
    // ตรวจสอบและแก้ไข HTML ตามต้องการ
    
    return createSuccessResult(html);
  }
};

export default myCustomPolicy;
```

2. Register policy ใน `src/policy/policies/index.ts`:

```typescript
import { myCustomPolicy } from './myCustomPolicy.js';

export const policies: Policy[] = [
  // ... existing policies
  myCustomPolicy
];
```

3. เพิ่ม config ใน `config/policies.yaml`:

```yaml
policies:
  myCustomPolicy:
    enabled: true
    options:
      # custom options
```

## 🔄 Conversion Pipeline

```
Input HTML
    │
    ▼
┌─────────────────┐
│  HTML Loader    │  ← Load from file/string
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Style Extractor │  ← Extract <style> tags
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  HTML Cleaner   │  ← Remove unwanted tags
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Style Inliner   │  ← Convert classes to inline
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Policy Engine   │  ← Apply all policies
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Gutenberg     │  ← Convert to blocks
│   Converter     │
└────────┬────────┘
         │
         ▼
    Output HTML
```

## 📄 Output Example

**Input HTML:**
```html
<h2>หัวข้อบทความ</h2>
<p>เนื้อหาบทความ...</p>
<ul>
  <li>รายการที่ 1</li>
  <li>รายการที่ 2</li>
</ul>
```

**Output Gutenberg:**
```html
<!-- wp:heading {"level":2} -->
<h2>หัวข้อบทความ</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>เนื้อหาบทความ...</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul>
<li>รายการที่ 1</li>
<li>รายการที่ 2</li>
</ul>
<!-- /wp:list -->
```

## 🛠️ Development

```bash
# Run in development mode
npm run dev

# Build
npm run build

# Lint
npm run lint
```

## 📜 License

MIT License

## 👥 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
