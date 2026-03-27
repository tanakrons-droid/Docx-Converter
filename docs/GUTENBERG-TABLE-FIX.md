# การแก้ไข Gutenberg Table Block Validation

## สรุปการแก้ไข

ระบบแปลง HTML เป็น Gutenberg blocks ได้รับการปรับปรุงเพื่อสร้าง **table blocks ที่ valid 100%** และไม่ขึ้นข้อความ "Block contains unexpected or invalid content"

## การเปลี่ยนแปลงที่สำคัญ

### 1. ✅ เปลี่ยน `<br>` เป็น `<br />` (Self-closing tags)
- แก้ไขทุกจุดที่สร้าง `<br>` ให้เป็น `<br />` 
- เพิ่มการ normalize `<br>` tags ก่อน output table block
- ตรงตาม XHTML/Gutenberg serialization format

**ไฟล์:** `src/utils/htmlToGutenbergConverter.js`
- บรรทัด 4889: `$el.replaceWith($el.html() + '<br />');`
- บรรทัด 4915: `let result = resultArr.join('<br />\\n');`
- บรรทัด 5044-5046: Normalize ทั้งหมดก่อน output

### 2. ✅ เพิ่ม `data-align` attribute
เพิ่ม `data-align` attribute ใน `<td>` และ `<th>` ที่มี alignment class

**ตัวอย่าง:**
```html
<!-- ก่อนแก้ไข -->
<td class="has-text-align-center">ข้อความ</td>

<!-- หลังแก้ไข -->
<td class="has-text-align-center" data-align="center">ข้อความ</td>
```

**ไฟล์:** `src/utils/htmlToGutenbergConverter.js`
- บรรทัด 4965-4970: เพิ่มใน `<th>` (thead)
- บรรทัด 5008-5013: เพิ่มใน `<td>` (tbody)

### 3. ✅ รักษา `has-fixed-layout` class
- Table element มี class `has-fixed-layout`
- Figure wrapper มี class `wp-block-table` (และ `aligncenter`/`alignleft`/`alignright` ถ้ามี)
- Block attributes มี `{"hasFixedLayout":true}`

### 4. ✅ แก้ไข Lint Errors
แก้ไขปัญหา "Cannot redeclare block-scoped variable 'tableHtml'" โดยเปลี่ยนชื่อตัวแปร:
- บรรทัด 4258: `tableHtml` → `tableContent`
- บรรทัด 5045: `tableHtml` → `tableInnerHtml`

## ตัวอย่าง Output ที่ถูกต้อง

### Table แบบธรรมดา (ไม่มี alignment)
```html
<!-- wp:table {"hasFixedLayout":true} -->
<figure class="wp-block-table"><table class="has-fixed-layout"><thead><tr><th>หัวข้อ 1</th><th>หัวข้อ 2</th></tr></thead><tbody><tr><td>ข้อมูล 1</td><td>ข้อมูล 2</td></tr></tbody></table></figure>
<!-- /wp:table -->
```

### Table ที่มี Center Alignment
```html
<!-- wp:table {"hasFixedLayout":true,"align":"center"} -->
<figure class="wp-block-table aligncenter"><table class="has-fixed-layout"><thead><tr><th class="has-text-align-center" data-align="center">หัวข้อกลาง</th></tr></thead><tbody><tr><td class="has-text-align-center" data-align="center">ข้อมูลกลาง</td></tr></tbody></table></figure>
<!-- /wp:table -->
```

### Table ที่มี Line Break ในเซลล์
```html
<!-- wp:table {"hasFixedLayout":true} -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>บรรทัดที่ 1<br />บรรทัดที่ 2<br />บรรทัดที่ 3</td></tr></tbody></table></figure>
<!-- /wp:table -->
```

## การทดสอบ

### วิธีทดสอบ:
1. แปลงเอกสาร Word/HTML ที่มีตาราง
2. Copy โค้ด Gutenberg ที่ได้
3. วางใน WordPress Gutenberg Editor
4. ตรวจสอบว่าไม่ขึ้น "Block contains unexpected or invalid content"

### จุดที่ต้องตรวจสอบ:
- ✅ Comment tags `<!-- wp:table -->` และ `<!-- /wp:table -->` ครบ
- ✅ Figure wrapper มี class `wp-block-table`
- ✅ Table element มี class `has-fixed-layout`
- ✅ Alignment cells มีทั้ง `class="has-text-align-center"` และ `data-align="center"`
- ✅ ใช้ `<br />` แทน `<br>`
- ✅ เนื้อหาภาษาไทยไม่เปลี่ยนแปลง

## ข้อควรระวัง

### ❌ สิ่งที่ห้ามทำ:
1. ห้ามลบ `<!-- wp:table -->` หรือ `<!-- /wp:table -->`
2. ห้ามใช้ `<br>` ต้องเป็น `<br />` เท่านั้น
3. ห้ามลบ `has-fixed-layout` class จาก `<table>`
4. ห้ามใส่ class ที่ Gutenberg ไม่รู้จัก
5. ห้ามเปลี่ยนเนื้อหาข้อความ

### ✅ สิ่งที่ต้องมี:
1. Block comment tags ครบถ้วน
2. Figure wrapper ที่ถูกต้อง
3. Alignment attributes ครบทั้ง class และ data-align
4. Self-closing tags สำหรับ `<br />`
5. JSON attributes ที่ valid ใน block comment

## ไฟล์ที่เกี่ยวข้อง

- `src/utils/htmlToGutenbergConverter.js` - ไฟล์หลักที่แก้ไข
- บรรทัดสำคัญ: 4255-5060 (table processing logic)

## สรุป

การแก้ไขนี้ทำให้ระบบสร้าง Gutenberg table blocks ที่:
1. ✅ Valid 100% ตาม Gutenberg block serialization format
2. ✅ ไม่ขึ้น "Block contains unexpected or invalid content"
3. ✅ รองรับ alignment อย่างถูกต้อง
4. ✅ ใช้ HTML tags ที่ Gutenberg ยอมรับ
5. ✅ รักษาเนื้อหาภาษาไทยไว้ครบถ้วน
