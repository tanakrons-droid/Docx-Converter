# Internal Notes Removal Policy

## ภาพรวม

`removeInternalNotesPolicy` เป็น policy ที่ใช้สำหรับตรวจจับและลบข้อความประเภทภายใน (internal notes, comments, team messages) ที่ไม่ควรเผยแพร่สู่สาธารณะ

## รูปแบบ (Patterns) ที่ถูกลบ

### 1. **[a], [b], [c]... - Internal Notes with Prefix**
```html
<p>[a] ฝากระบุราคา (ให้ทีมเดิมกันทำ AI ตอบเฉพาะ)</p>
<!-- ✅ ลบแล้ว -->
```

### 2. **Team-Specific Instructions**
```html
<p>To Team Web: Banner+Internallink</p>
<p>To Team Design: Please update the logo</p>
<!-- ✅ ลบแล้ว -->
```

### 3. **@ Mentions (Comments)**
```html
<p>@thitikron.t@vsqclinic.com แก้ไขแล้วนะครับ</p>
<!-- ✅ ลบแล้ว -->
```

### 4. **Graphic/Image Notes**
```html
<p>กราฟิก Zip</p>
<p>Graphic Notes</p>
<!-- ✅ ลบแล้ว -->
```

### 5. **Parenthetical Notes**
```html
<p>(ฝากอธิบายเพิ่มเติมเกี่ยวกับ AI)</p>
<p>(Note: This needs verification)</p>
<p>(TODO: Update information)</p>
<!-- ✅ ลบแล้ว -->
```

### 6. **Alt Text Notes (from Google Docs)**
```html
<p>Alt: รูปสิตร์ ราคา 7,500</p>
<p>alt: image description</p>
<!-- ✅ ลบแล้ว -->
```

### 7. **SEO Writer Markers**
```html
<p>NOTE SEO Writer</p>
<p>note seo</p>
<!-- ✅ ลบแล้ว -->
```

### 8. **Credit/Landing Information**
```html
<p>กราฟิก Zip</p>
<p>Credit: Designer Name</p>
<p>Landing: https://example.com/special</p>
<p>Link: https://example.com</p>
<!-- ✅ ลบแล้ว -->
```

## Configuration

### YAML Configuration (config/policies.yaml)

```yaml
policies:
  removeInternalNotes:
    enabled: true
    options:
      autoRemove: true
      removeEmptyContainers: true
      patterns:
        - '^\\[([a-z0-9])\\]\\s*'
        - '^(To\\s+Team\\s+\\w+\\s*:)'
        - '^\\s*@\\w+'
        - '^(กราฟิก|Graphic|Image)'
        - '^\\(\\s*(ฝาก|Note:|Internal:|TODO:|FIXME:)'
        - '^(Alt|alt|ALT)\\s*:'
        - '^(NOTE\\s+SEO\\s+Writer|note\\s+seo)'
        - '^(กราฟิก Zip|Credit|เครดิต)'
        - '^(Landing\\s*:|Link\\s*:|URL\\s*:)'
        - '^\\[.*?(ฝาก|Note|Internal|TODO|ทีม|Team)'
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoRemove` | boolean | `true` | ลบข้อความโดยอัตโนมัติ หรือแค่แจ้งเตือน |
| `removeEmptyContainers` | boolean | `true` | ลบ elements ที่กลายเป็นว่างหลังจากลบข้อความภายใน |
| `patterns` | string[] | (built-in) | regex patterns เพิ่มเติมเพื่อตรวจจับข้อความ |

## TypeScript Usage

### Basic Usage

```typescript
import { removeInternalNotesPolicy } from './policy/policies/removeInternalNotesPolicy.js';
import * as cheerio from 'cheerio';

const html = `
  <p>[a] ฝากระบุราคา</p>
  <p>This is real content</p>
  <p>To Team Web: Add links</p>
`;

const $ = cheerio.load(html, { decodeEntities: false });

const result = removeInternalNotesPolicy.apply(html, $, {
  autoRemove: true,
  removeEmptyContainers: true
});

console.log(result.html);
// ✅ Output: <p>This is real content</p>
console.log(result.warnings);
// ✅ Warnings: ["ลบข้อความภายใน 2 รายการ: [a] ฝากระบุราคา | To Team Web: ..."]
```

### Custom Patterns

```typescript
const customPatterns = [
  '^\\[WIP\\]', // Work in Progress
  '^(Draft:|DRAFT:)', // Draft notes
  '^\\(TESTING\\)', // Testing notes
];

const result = removeInternalNotesPolicy.apply(html, $, {
  autoRemove: true,
  patterns: customPatterns
});
```

### With Policy Engine

```typescript
import { PolicyEngine } from './policy/policyEngine.js';

const policyConfig = {
  removeInternalNotes: {
    enabled: true,
    options: {
      autoRemove: true,
      removeEmptyContainers: true
    }
  }
};

const engine = new PolicyEngine(policyConfig);
const result = engine.run(html);

console.log(result.policiesTriggered);
// ✅ ['removeInternalNotes']
console.log(result.actions);
// ✅ ['removed 2 internal note(s)']
```

## Testing

Run tests for the policy:

```bash
npm test -- removeInternalNotesPolicy.test.ts
```

### Test Cases Included

- Pattern matching for all internal note types
- Container cleanup and preservation
- Edge cases (no notes, mixed content, case sensitivity)
- Auto-remove flag behavior
- Policy metadata validation

## Example Workflow

### Before Processing

```html
<h2>บริการฉีด Botox</h2>
<p>[a] ฝากระบุราคา (ให้ทีมเดิมกันทำ AI ตอบเฉพาะ)</p>
<p>บ่อบอตอก์ช่วยลดริ้วรอยเล็กน้อย</p>
<p>To Team Web: Banner+Internallink</p>
<p>- Allergan https://www.vsquareclinic.com/tips/botox-allergan/</p>
<figure>
  <img src="botox-image.jpg" alt=""/>
</figure>
<p>Alt: ภาพแสดงผลบอตอก์</p>
<p>กราฟิก Zip</p>
<p>NOTE SEO Writer</p>
```

### After Processing

```html
<h2>บริการฉีด Botox</h2>
<p>บ่อบอตอก์ช่วยลดริ้วรอยเล็กน้อย</p>
<p>- Allergan https://www.vsquareclinic.com/tips/botox-allergan/</p>
<figure>
  <img src="botox-image.jpg" alt=""/>
</figure>
```

## Implementation Notes

### Priority
- Policy priority: **8** - ทำงานหลังจาก basic cleanup แต่ก่อน content validation

### Strategy
1. **Element-level matching**: ตรวจจับ elements (p, div, td, li) ที่มีเนื้อหาตรงกับ pattern
2. **Text-node cleaning**: ลบ text nodes ภายใน elements ที่ตรงกับ pattern
3. **Container cleanup**: ลบ empty elements หลังจากลบข้อความ

### Performance Considerations
- Pattern matching uses regex with case-insensitive flag
- Multiple passes for container cleanup (while loop)
- Iterates through all matched selectors

## Extending the Policy

### Add Custom Pattern

```typescript
// In config/policies.yaml
patterns:
  - '^\\[WIP\\]\\s*'           # Work in Progress
  - '^(Internal Use Only)'     # Internal use
  - '^\\*\\*DRAFT\\*\\*'       # Draft marker
```

### Add Custom Selector

Modify the `selectors` array in `removeInternalNotesPolicy.ts`:

```typescript
const selectors = [
  'p', 'div', 'td', 'li', 'span',
  'blockquote', // Add custom selector
  '.internal-note', // Add class-based selector
];
```

## Related Policies

- **removeBeforeH1**: ลบเนื้อหาทั้งหมดก่อนหัวข้อ H1 ตัวแรก
- **forbiddenTags**: ลบ tags ที่ห้าม (script, iframe, form, etc.)
- **addDisclaimer**: เพิ่ม disclaimer สำหรับเนื้อหา promotional

## Troubleshooting

### Pattern not matching?

1. ตรวจสอบ regex syntax: ใช้ regex tester (https://regex101.com)
2. ตรวจสอบ case sensitivity: Policy ใช้ case-insensitive flag (`i`)
3. เพิ่ม `console.log` ใน pattern checking function

### Elements not being removed?

1. ตรวจสอบว่า `removeEmptyContainers` เปิดใช้งาน
2. ตรวจสอบว่า element นั้นไม่มี nested elements
3. ตรวจสอบ whitespace และ `&nbsp;` entities

### Performance issues?

1. ลดจำนวน patterns ไม่จำเป็น
2. ใช้ specific selectors แทน universal
3. Disable `removeEmptyContainers` ถ้าไม่จำเป็น
