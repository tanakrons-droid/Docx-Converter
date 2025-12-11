# 🔧 Google Docs Comments Removal Guide

## ✅ What's Fixed

Policy ได้รับการอัปเดตเพื่อจัดการกับ **Google Docs comments** ที่แปลงเป็น HTML

### 📋 ปัญหาที่พบ

Google Docs comments ถูกแปลงเป็นลิงก์ anchor ในรูปแบบ:

```html
<p><a href="#cmnt_ref1" id="cmnt1">[a]</a>ฝากระบุราคาใต้หัวข้อเลยเลยครับ ...</p>
<p><a href="#cmnt_ref2" id="cmnt2">[b]</a>@thitikron.t@vsqclinic.com ...</p>
<p><a href="#cmnt_ref3" id="cmnt3">[c]</a>To Team Web : ...</p>
```

### ✨ วิธีแก้ไข

อัปเดต `removeInternalNotesPolicy` เพื่อเพิ่ม **Strategy 0** ซึ่ง:

1. ✅ ตรวจจับ anchor tags ที่มี `id` เริ่มต้นด้วย `cmnt`
2. ✅ ตรวจสอบว่า text content เป็น `[a]`, `[b]`, `[c]` เป็นต้น
3. ✅ ลบ anchor tag นั้นโดยสิ้นเชิง

```typescript
// Strategy 0: Remove comment anchors like <a href="#cmnt_ref1" id="cmnt1">[a]</a>
$('a[id^="cmnt"]').each((_: number, el: Element) => {
  const element = $(el);
  const text = element.text().trim();
  
  // Check if this is a comment marker like [a], [b], [c], etc.
  if (/^\[([a-z0-9])\]$/i.test(text)) {
    element.remove(); // ✅ Remove comment anchor
  }
});
```

---

## 🧪 Test Cases

### Test File
`examples/test-google-comments.ts`

### Test Content
```html
<p><a href="#cmnt_ref1" id="cmnt1">[a]</a>ฝากระบุราคา...</p>
<p>This is real content</p>
<p><a href="#cmnt_ref2" id="cmnt2">[b]</a>@thitikron...</p>
```

### Expected Output
```html
<p>This is real content</p>
```

---

## 📊 Before & After

### ❌ Before (Old Policy)
```html
<p><a href="#cmnt_ref1" id="cmnt1">[a]</a>ฝากระบุราคา...</p>  <!-- ⚠️ NOT REMOVED -->
<p>Real content</p>
<p><a href="#cmnt_ref2" id="cmnt2">[b]</a>@thitikron...</p>  <!-- ⚠️ NOT REMOVED -->
```

### ✅ After (New Policy)
```html
<p>Real content</p>
```

---

## 🎯 Patterns Handled

| Pattern | Example | Status |
|---------|---------|--------|
| Comment anchors | `<a id="cmnt1">[a]</a>` | ✅ NEW |
| Direct text markers | `[a] ฝากระบุ` | ✅ Existing |
| Team instructions | `To Team Web: ...` | ✅ Existing |
| @ mentions | `@thitikron...` | ✅ Existing |
| Graphic notes | `กราฟิก` | ✅ Existing |
| Parenthetical notes | `(ฝาก...)` | ✅ Existing |

---

## 🚀 How to Use

### 1. Run Tests
```bash
cd html-to-gutenberg
npm test -- removeInternalNotesPolicy.test.ts
```

### 2. Test Google Docs Comments
```bash
npx ts-node examples/test-google-comments.ts
```

### 3. Use in Conversion
```bash
npx ts-node src/cli.ts input.html output.html
```

Policy will automatically:
- ✅ Remove all `<a id="cmnt*">[a-z]</a>` comment anchors
- ✅ Remove follow-up internal note text
- ✅ Preserve real content
- ✅ Clean up empty paragraphs

---

## 📝 Configuration

Policy is **enabled by default** in `config/policies.yaml`:

```yaml
policies:
  removeInternalNotes:
    enabled: true
    options:
      autoRemove: true
      removeEmptyContainers: true
      patterns: [...]
```

---

## 🔍 Advanced: Custom Testing

### Test with Cheerio
```typescript
import * as cheerio from 'cheerio';
import { removeInternalNotesPolicy } from './src/policy/policies/removeInternalNotesPolicy.js';

const html = `<p><a href="#cmnt_ref1" id="cmnt1">[a]</a>Internal note</p>`;
const $ = cheerio.load(html, { decodeEntities: false });

const result = removeInternalNotesPolicy.apply(html, $, {
  autoRemove: true
});

console.log(result.html); // Clean HTML
```

---

## ✨ Summary

- ✅ **Fixed:** Google Docs comments no longer appear in output
- ✅ **Improved:** Policy now handles comment anchor format
- ✅ **Tested:** Multiple test cases included
- ✅ **Documented:** Full guide provided

**Status:** 🟢 **READY FOR USE**
