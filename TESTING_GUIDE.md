# 🧪 คู่มือการทดสอบ Auto-Resolve Function

คู่มือนี้จะแนะนำวิธีทดสอบ Facebook Reels Auto-Resolve Function ให้ทำงานได้จากทุกเครื่อง

---

## 📋 สารบัญ

1. [การทดสอบด้วย curl (Command Line)](#1-การทดสอบด้วย-curl-command-line)
2. [การทดสอบด้วย Example HTML](#2-การทดสอบด้วย-example-html)
3. [การทดสอบใน Application จริง](#3-การทดสอบใน-application-จริง)
4. [การทดสอบแบบ Local (netlify dev)](#4-การทดสอบแบบ-local-netlify-dev)
5. [Expected Results](#5-expected-results-ผลลัพธ์ที่คาดหวัง)
6. [Common Issues & Solutions](#6-common-issues--solutions)

---

## 1. การทดสอบด้วย curl (Command Line)

### 1.1 ทดสอบ Production API

```bash
# แทนที่ YOUR-SITE-NAME ด้วยชื่อ Netlify site ของคุณ
# แทนที่ FACEBOOK_REEL_URL ด้วย URL ที่ต้องการทดสอบ

curl "https://YOUR-SITE-NAME.netlify.app/.netlify/functions/resolve-url?url=https://www.facebook.com/share/r/ABC123/"
```

### 1.2 ตัวอย่าง URL สำหรับทดสอบ

```bash
# Test 1: Short link /share/r/
curl "https://YOUR-SITE-NAME.netlify.app/.netlify/functions/resolve-url?url=https://www.facebook.com/share/r/1Eid1ioBNc1e9fP9/"

# Test 2: Short link /share/v/
curl "https://YOUR-SITE-NAME.netlify.app/.netlify/functions/resolve-url?url=https://www.facebook.com/share/v/1Eid1ioBNc1e9fP9/"

# Test 3: Mobile link (m.facebook.com)
curl "https://YOUR-SITE-NAME.netlify.app/.netlify/functions/resolve-url?url=https://m.facebook.com/reel/1234567890"

# Test 4: Already full URL (should return as-is or with cleanup)
curl "https://YOUR-SITE-NAME.netlify.app/.netlify/functions/resolve-url?url=https://www.facebook.com/reel/1234567890/"
```

### 1.3 Expected Response (Success)

```json
{
  "success": true,
  "originalUrl": "https://www.facebook.com/share/r/ABC123/",
  "finalUrl": "https://www.facebook.com/reel/1234567890/",
  "method": "direct-fetch",
  "message": "Successfully resolved URL",
  "timestamp": "2025-01-15T10:30:45.123Z"
}
```

### 1.4 Expected Response (Error - Invalid URL)

```json
{
  "error": "Invalid URL",
  "message": "URL ต้องเป็น Facebook เท่านั้น",
  "originalUrl": "https://youtube.com/watch?v=123",
  "success": false
}
```

### 1.5 Expected Response (Error - Missing Parameter)

```json
{
  "error": "Missing url parameter",
  "message": "กรุณาระบุ URL ที่ต้องการ resolve",
  "usage": "/.netlify/functions/resolve-url?url=<facebook-url>",
  "success": false
}
```

---

## 2. การทดสอบด้วย Example HTML

### 2.1 เปิดไฟล์ example-api-call.html

```bash
# วิธีที่ 1: เปิดไฟล์โดยตรง
# - Double-click ไฟล์ example-api-call.html
# - จะเปิดใน Browser

# วิธีที่ 2: ใช้ Python SimpleHTTPServer
cd "path/to/project"
python -m http.server 8000
# แล้วเปิด http://localhost:8000/example-api-call.html

# วิธีที่ 3: ใช้ VS Code Live Server
# - ติดตั้ง Live Server extension
# - Right-click example-api-call.html → "Open with Live Server"
```

### 2.2 ขั้นตอนการทดสอบ

1. **แก้ไข API Endpoint URL**
   - ในช่อง "API Endpoint URL"
   - เปลี่ยน `YOUR-SITE-NAME` เป็นชื่อ Netlify site ของคุณ
   - ตัวอย่าง: `https://my-converter.netlify.app/.netlify/functions/resolve-url`

2. **กรอก Facebook Reel URL**
   - คลิกตัวอย่าง URL ที่ให้ไว้ หรือ
   - Paste URL ของคุณเอง

3. **กดปุ่ม "Resolve URL"**
   - รอ loading (ประมาณ 3-10 วินาที)
   - ดูผลลัพธ์ด้านล่าง

4. **ตรวจสอบผลลัพธ์**
   - ✅ กรอบเขียว = สำเร็จ
   - ❌ กรอบแดง = มีปัญหา

### 2.3 ตรวจสอบ Console Log

เปิด Browser Developer Tools (F12) → Console Tab

ดู log ที่แสดง:
```
🔍 [API Call] Starting...
  - API URL: https://...
  - FB URL: https://...
  - Timestamp: ...
📥 [API Response] Received
  - Status: 200
  - Status Text: OK
📦 [Response Data]: {...}
✅ [Success] Resolution complete
```

---

## 3. การทดสอบใน Application จริง

### 3.1 ทดสอบบน Netlify (Production)

1. **Deploy โปรเจคบน Netlify**
   ```bash
   netlify deploy --prod
   ```

2. **เปิด Application**
   - เปิด URL ที่ Netlify ให้มา
   - ตัวอย่าง: `https://your-site.netlify.app`

3. **ไปที่หน้า Facebook Reels**
   - คลิกเมนู "🎬 Facebook Reels"

4. **ทดสอบ Auto-Resolve**
   - Paste Facebook short link (เช่น `/share/r/...`)
   - กดปุ่ม "🤖 Auto Resolve"
   - รอประมาณ 3-10 วินาที
   - ดูว่า URL เปลี่ยนเป็น full reel URL หรือไม่

5. **ตรวจสอบ Console Log**
   - เปิด F12 → Console
   - ควรเห็น:
     ```
     ✅ [Auto-Resolve] Detected: Production deployment
     🌐 [Auto-Resolve] API Endpoint: https://your-site.netlify.app/.netlify/functions/resolve-url
     🔍 [Auto-Resolve] Resolving URL: https://...
     ✅ [Auto-Resolve] Success!
     ```

### 3.2 ทดสอบจากเครื่องอื่น

**สิ่งที่ต้องทำ:**
1. หา URL ของ Netlify site (เช่น `https://your-site.netlify.app`)
2. ส่ง URL ให้เพื่อนหรือเปิดจากคอมอื่น
3. ให้ทดสอบ Auto-Resolve
4. ถ้าทำงานได้ = **สำเร็จ!** 🎉

**Expected Result:**
- Auto-Resolve ต้องทำงานได้จากทุกเครื่อง
- ไม่ว่าจะเป็น Desktop, Mobile, WiFi อื่น

---

## 4. การทดสอบแบบ Local (netlify dev)

### 4.1 รัน netlify dev

```bash
# ใน project root
cd "path/to/docx-to-code-converter"

# รัน netlify dev (จะเปิดที่ port 8888)
netlify dev
```

### 4.2 ทดสอบ Function โดยตรง

```bash
# Test function ผ่าน curl
curl "http://localhost:8888/.netlify/functions/resolve-url?url=https://www.facebook.com/share/r/ABC123/"
```

### 4.3 ทดสอบใน Application

1. เปิด `http://localhost:8888` (ไม่ใช่ :3000)
2. ไปที่หน้า Facebook Reels
3. ทดสอบ Auto-Resolve
4. ตรวจสอบ Console ควรเห็น:
   ```
   ✅ [Auto-Resolve] Detected: netlify dev
   🌐 [Auto-Resolve] API Endpoint: http://localhost:8888/.netlify/functions/resolve-url
   ```

### 4.4 ดู Function Logs

เมื่อรัน `netlify dev` จะเห็น logs แบบ real-time:

```
◈ Starting Netlify Dev...
◈ Functions server is listening on 58473

Request from ::1: GET /.netlify/functions/resolve-url?url=...
🔍 [Netlify Function] Resolving URL: https://...
🚀 [Method 1] Attempting direct fetch with redirects...
✅ [Method 1] Success! Found reel URL
🎉 [Success] Resolution complete!
Response with status 200 in 3420 ms.
```

---

## 5. Expected Results (ผลลัพธ์ที่คาดหวัง)

### ✅ ผลลัพธ์ที่ถูกต้อง

#### Test Case 1: Short Link → Full URL
**Input:**
```
https://www.facebook.com/share/r/1Eid1ioBNc1e9fP9/
```

**Expected Output:**
```json
{
  "success": true,
  "originalUrl": "https://www.facebook.com/share/r/1Eid1ioBNc1e9fP9/",
  "finalUrl": "https://www.facebook.com/reel/1234567890/",
  "method": "direct-fetch"
}
```

#### Test Case 2: Mobile Link → Desktop Link
**Input:**
```
https://m.facebook.com/reel/1234567890
```

**Expected Output:**
```json
{
  "success": true,
  "originalUrl": "https://m.facebook.com/reel/1234567890",
  "finalUrl": "https://www.facebook.com/reel/1234567890/",
  "method": "direct-fetch"
}
```

#### Test Case 3: Invalid URL
**Input:**
```
https://youtube.com/watch?v=123
```

**Expected Output:**
```json
{
  "error": "Invalid URL",
  "message": "URL ต้องเป็น Facebook เท่านั้น",
  "success": false
}
```

---

## 6. Common Issues & Solutions

### 🔴 Issue 1: Failed to fetch / Network Error

**Error Message:**
```
🔌 ปัญหา: ไม่สามารถเชื่อมต่อ API ได้
```

**สาเหตุ:**
- API Endpoint URL ไม่ถูกต้อง
- Netlify Functions ยังไม่ได้ deploy
- CORS ตั้งค่าผิด

**วิธีแก้:**
1. ตรวจสอบ URL ของ API (แทนที่ YOUR-SITE-NAME)
2. ลองเปิด API URL ในเบราว์เซอร์:
   ```
   https://your-site.netlify.app/.netlify/functions/resolve-url?url=https://www.facebook.com/reel/123/
   ```
   - ควรเห็น JSON response ไม่ใช่ 404
3. ตรวจสอบใน Netlify Dashboard → Functions → ดูว่า `resolve-url` มีหรือไม่
4. ตรวจสอบ `netlify.toml` มี `functions = "netlify/functions"`

---

### 🔴 Issue 2: Function ไม่ทำงาน (404 Not Found)

**Error Message:**
```
404 Not Found
```

**สาเหตุ:**
- `netlify/functions/resolve-url.js` ไม่ได้ deploy
- Path ในโปรเจคผิด

**วิธีแก้:**
1. ตรวจสอบโครงสร้างโปรเจค:
   ```
   your-project/
   ├── netlify/
   │   └── functions/
   │       └── resolve-url.js
   └── netlify.toml
   ```

2. ตรวจสอบ `netlify.toml`:
   ```toml
   [functions]
     directory = "netlify/functions"
   ```

3. Re-deploy:
   ```bash
   netlify deploy --prod
   ```

4. ตรวจสอบใน Netlify Dashboard:
   - Site Settings → Functions
   - ควรเห็น `resolve-url` listed

---

### 🔴 Issue 3: CORS Error

**Error Message:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**สาเหตุ:**
- CORS headers ไม่ถูกต้อง

**วิธีแก้:**
1. ตรวจสอบ `netlify/functions/resolve-url.js` มี headers:
   ```javascript
   const headers = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Headers': 'Content-Type, Accept',
     'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
     'Content-Type': 'application/json',
   };
   ```

2. ตรวจสอบ `netlify.toml` มี headers:
   ```toml
   [[headers]]
     for = "/.netlify/functions/*"
     [headers.values]
       Access-Control-Allow-Origin = "*"
   ```

3. Re-deploy:
   ```bash
   netlify deploy --prod
   ```

---

### 🔴 Issue 4: URL ไม่เปลี่ยน (success: false)

**Response:**
```json
{
  "success": false,
  "message": "URL processed but could not find different reel URL"
}
```

**สาเหตุ:**
- Facebook short link หมดอายุ
- URL ไม่ถูกต้อง
- Facebook blocking requests

**วิธีแก้:**
1. ลอง URL อื่น (ใช้ short link ที่เพิ่งสร้าง)
2. ลองเปิด URL ในเบราว์เซอร์ดูว่า redirect ไปไหน
3. ตรวจสอบ Function logs ใน Netlify Dashboard → Functions → resolve-url → Logs

---

### 🔴 Issue 5: ใช้งานได้บนเครื่องตัวเองแต่เครื่องอื่นไม่ได้

**สาเหตุ:**
- ใช้ localhost URL ใน production code
- Frontend ยัง hardcode localhost

**วิธีแก้:**
1. ตรวจสอบ `FbReelsGenerator.jsx` ใช้ environment detection:
   ```javascript
   if (currentHost === 'localhost') {
     if (currentPort === '8888') {
       apiBaseUrl = 'http://localhost:8888';
     } else {
       apiBaseUrl = 'https://YOUR-SITE-NAME.netlify.app'; // ❌ แก้ตรงนี้!
     }
   }
   ```

2. **วิธีแก้ที่ดีกว่า** - ใช้ environment variable:
   ```javascript
   const PRODUCTION_API = process.env.REACT_APP_API_URL ||
                          'https://your-site.netlify.app';
   ```

3. Re-build และ re-deploy:
   ```bash
   npm run build
   netlify deploy --prod
   ```

---

## 7. ✅ Checklist ทดสอบสมบูรณ์

หลังจาก deploy แล้ว ให้ทดสอบทั้งหมดนี้:

- [ ] **Test 1:** curl command ใน terminal (ต้องได้ JSON response)
- [ ] **Test 2:** เปิด `example-api-call.html` (ต้อง resolve ได้)
- [ ] **Test 3:** ทดสอบใน Application บนเครื่องตัวเอง (ต้องทำงาน)
- [ ] **Test 4:** ส่ง URL ให้เพื่อนทดสอบ (ต้องทำงานจากเครื่องอื่น)
- [ ] **Test 5:** ทดสอบจาก Mobile Phone (ต้องทำงานบน Mobile)
- [ ] **Test 6:** เปิด F12 Console ดู logs (ต้องไม่มี error สีแดง)
- [ ] **Test 7:** ทดสอบ 3-5 Facebook URLs ต่างกัน (ต้อง resolve ได้)
- [ ] **Test 8:** ทดสอบ Invalid URL (ต้อง error message ชัดเจน)

ถ้าทุกอย่างผ่าน = **Deploy สำเร็จ!** 🎉🎊

---

## 8. 📞 Support & Resources

**หากยังมีปัญหา:**

1. ตรวจสอบ Netlify Function Logs:
   - Netlify Dashboard → Functions → resolve-url → Logs

2. ดู Browser Console (F12):
   - ดู error messages และ network requests

3. ทดสอบด้วย curl ก่อน:
   - ถ้า curl ไม่ได้ = ปัญหาที่ Function
   - ถ้า curl ได้แต่ Browser ไม่ได้ = ปัญหา CORS/Frontend

4. อ่าน DEPLOYMENT_GUIDE.md:
   - มีขั้นตอนละเอียดและ troubleshooting เพิ่มเติม

**Useful Links:**
- [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)
- [Netlify CLI Docs](https://docs.netlify.com/cli/get-started/)
- [CORS Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**สร้างโดย:** Claude Code
**เวอร์ชัน:** 1.0
**อัปเดตล่าสุด:** 2025-01-15
