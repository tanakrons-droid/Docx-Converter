# 🚀 DEPLOYMENT GUIDE - docx-to-code-converter
## Frontend (GitHub Pages) + Backend (Netlify Functions)

คู่มือนี้จะแนะนำขั้นตอนการ Deploy โปรเจค docx-to-code-converter แบบละเอียด
เพื่อให้ **Auto-resolve Feature** ทำงานได้จากทุกเครื่อง

---

## 📋 สารบัญ

1. [สถาปัตยกรรมระบบ](#สถาปัตยกรรมระบบ)
2. [สิ่งที่ต้องเตรียม](#สิ่งที่ต้องเตรียม)
3. [ขั้นตอนที่ 1: Deploy Backend บน Netlify](#ขั้นตอนที่-1-deploy-backend-บน-netlify)
4. [ขั้นตอนที่ 2: ตั้งค่า Frontend](#ขั้นตอนที่-2-ตั้งค่า-frontend)
5. [ขั้นตอนที่ 3: Deploy Frontend บน GitHub Pages](#ขั้นตอนที่-3-deploy-frontend-บน-github-pages-ถ้าต้องการ)
6. [ขั้นตอนที่ 4: ทดสอบระบบ](#ขั้นตอนที่-4-ทดสอบระบบ)
7. [วิธีทดสอบในเครื่อง (Development)](#วิธีทดสอบในเครื่อง-development)
8. [Troubleshooting](#troubleshooting)

---

## 🏗️ สถาปัตยกรรมระบบ

```
┌─────────────────┐         API Request         ┌──────────────────────┐
│                 │  ──────────────────────────> │  Netlify Serverless  │
│   Frontend      │                              │     Functions        │
│  (React App)    │  <────────────────────────── │   (Backend API)      │
│                 │      Resolved URL            │                      │
└─────────────────┘                              └──────────────────────┘
       │                                                    │
       │                                                    │
       ▼                                                    ▼
 Hosted on:                                         Hosted on:
 • Netlify                                          • Netlify
 • GitHub Pages (optional)                          (Always Netlify)
 • Vercel
 • Local (localhost)
```

**ทำไมต้องแยก?**
- **Frontend**: ส่วนที่ผู้ใช้เห็น (React App) - สามารถ host ที่ไหนก็ได้
- **Backend**: Serverless Function สำหรับ resolve URL - **ต้อง** host บน Netlify เพราะใช้ Netlify Functions

**ข้อดี:**
- ✅ ผู้ใช้ทุกเครื่องสามารถใช้ Auto-resolve ได้ (ไม่ต้องรันในเครื่อง)
- ✅ Bypass CORS restrictions (เพราะ request ทำฝั่ง server)
- ✅ ไม่ต้องจัดการ backend server เอง (Serverless)
- ✅ ฟรี! (Netlify Free Tier รองรับ 125K requests/month)

---

## 📦 สิ่งที่ต้องเตรียม

### 1. บัญชีที่จำเป็น
- ✅ บัญชี GitHub (สำหรับ push code)
- ✅ บัญชี Netlify (สมัครฟรีที่ https://netlify.com)

### 2. Software ที่ต้องติดตั้ง
```bash
# Node.js (version 18 หรือใหม่กว่า)
node --version  # ควรแสดง v18.x.x หรือสูงกว่า

# npm (มาพร้อม Node.js)
npm --version

# Git
git --version

# Netlify CLI (ติดตั้งด้วยคำสั่งนี้)
npm install -g netlify-cli
```

### 3. โครงสร้างไฟล์ที่สำคัญ
```
docx-to-code-converter/
├── src/
│   ├── components/
│   │   └── reels/
│   │       └── FbReelsGenerator.jsx  # Frontend component
│   └── ...
├── netlify/
│   └── functions/
│       └── resolve-url.js            # Backend API
├── netlify.toml                       # Netlify config
├── package.json
└── DEPLOYMENT_GUIDE.md               # คู่มือนี้
```

---

## 🚀 ขั้นตอนที่ 1: Deploy Backend บน Netlify

### Option A: Deploy ผ่าน Netlify Dashboard (แนะนำสำหรับมือใหม่)

#### 1.1 เตรียม Code บน GitHub

```bash
# 1. เข้าไปในโฟลเดอร์โปรเจค
cd "C:\Users\User\OneDrive\เดสก์ท็อป\docx-to-code-converter-app-main-new\docx-to-code-converter-app-main New Version\docx-to-code-converter-app-main New Version"

# 2. Initialize Git (ถ้ายังไม่ได้ทำ)
git init

# 3. Add all files
git add .

# 4. Commit
git commit -m "Initial commit with Netlify Functions support"

# 5. สร้าง repository ใหม่บน GitHub
# ไปที่ https://github.com/new
# ตั้งชื่อ repo เช่น "docx-to-code-converter"
# คัดลอก URL ของ repo

# 6. Add remote และ push
git remote add origin https://github.com/YOUR_USERNAME/docx-to-code-converter.git
git branch -M main
git push -u origin main
```

#### 1.2 Deploy บน Netlify

1. **ไปที่ Netlify Dashboard**
   - เข้า https://app.netlify.com
   - คลิก "Add new site" → "Import an existing project"

2. **เชื่อมต่อ GitHub**
   - เลือก "GitHub"
   - อนุญาตให้ Netlify เข้าถึง GitHub
   - เลือก repository "docx-to-code-converter"

3. **กำหนดการตั้งค่า Build**
   ```
   Build command:     npm run build
   Publish directory: build
   Functions directory: netlify/functions
   ```

4. **คลิก "Deploy site"**
   - รอ 2-3 นาที
   - เมื่อเสร็จจะได้ URL แบบนี้: `https://random-name-123.netlify.app`

5. **เปลี่ยนชื่อ Site (Optional)**
   - ไปที่ Site settings → Site details → Change site name
   - ตั้งชื่อใหม่เช่น `docx-converter-yourname`
   - จะได้ URL: `https://docx-converter-yourname.netlify.app`

#### 1.3 ทดสอบว่า Function ทำงาน

เปิดเบราว์เซอร์และทดสอบ API:

```
https://YOUR-SITE.netlify.app/.netlify/functions/resolve-url?url=https://fb.watch/abc123
```

ถ้าเห็น JSON response แสดงว่าสำเร็จ! ✅

---

### Option B: Deploy ผ่าน Netlify CLI (สำหรับผู้ชำนาญ)

```bash
# 1. Login
netlify login

# 2. Initialize site
netlify init

# เลือก:
# - "Create & configure a new site"
# - Team: เลือก team ของคุณ
# - Site name: ตั้งชื่อเช่น "docx-converter-yourname"
# - Build command: npm run build
# - Publish directory: build
# - Functions directory: netlify/functions

# 3. Deploy
netlify deploy --prod

# จะได้ URL เช่น: https://docx-converter-yourname.netlify.app
```

---

## ⚙️ ขั้นตอนที่ 2: ตั้งค่า Frontend

### 2.1 อัพเดต API Endpoint ใน Code

เปิดไฟล์: `src/components/reels/FbReelsGenerator.jsx`

หาบรรทัดที่ 298:
```javascript
apiBaseUrl = 'https://YOUR-SITE-NAME.netlify.app';
```

**เปลี่ยนเป็น URL ของ Netlify site ที่คุณได้จากขั้นตอนที่ 1:**
```javascript
apiBaseUrl = 'https://docx-converter-yourname.netlify.app';
```

### 2.2 Commit การเปลี่ยนแปลง

```bash
git add src/components/reels/FbReelsGenerator.jsx
git commit -m "Update Netlify API endpoint"
git push origin main
```

Netlify จะ rebuild อัตโนมัติ (ประมาณ 2-3 นาที)

---

## 🌐 ขั้นตอนที่ 3: Deploy Frontend บน GitHub Pages (ถ้าต้องการ)

> **หมายเหตุ:** ขั้นตอนนี้เป็น **Optional**
> คุณสามารถใช้ Netlify hosting ทั้ง frontend และ backend ได้เลย (แนะนำ)
> แต่ถ้าต้องการแยก frontend ไปที่ GitHub Pages ทำตามนี้:

### 3.1 ติดตั้ง gh-pages Package

```bash
npm install --save-dev gh-pages
```

### 3.2 แก้ไข package.json

เพิ่ม 2 บรรทัดนี้:

```json
{
  "name": "docx-to-html-converter",
  "version": "0.1.0",
  "homepage": "https://YOUR_USERNAME.github.io/docx-to-code-converter",
  "scripts": {
    "start": "react-app-rewired start",
    "build": "react-app-rewired build",
    "test": "react-app-rewired test",
    "eject": "react-scripts eject",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  },
  ...
}
```

**เปลี่ยน `YOUR_USERNAME` เป็น GitHub username ของคุณ**

### 3.3 Deploy ไป GitHub Pages

```bash
npm run deploy
```

รอ 1-2 นาที แล้วเข้า: `https://YOUR_USERNAME.github.io/docx-to-code-converter`

### 3.4 Enable GitHub Pages

1. ไปที่ GitHub repo → Settings → Pages
2. Source: เลือก `gh-pages` branch
3. คลิก Save

---

## ✅ ขั้นตอนที่ 4: ทดสอบระบบ

### 4.1 ทดสอบ Backend API โดยตรง

เปิดเบราว์เซอร์และเข้า:

```
https://YOUR-SITE.netlify.app/.netlify/functions/resolve-url?url=https://www.facebook.com/share/r/abc123
```

**ผลลัพธ์ที่คาดหวัง:**
```json
{
  "success": true,
  "originalUrl": "https://www.facebook.com/share/r/abc123",
  "finalUrl": "https://www.facebook.com/reel/1234567890/",
  "method": "direct-fetch",
  "message": "Successfully resolved URL",
  "timestamp": "2025-01-14T10:30:00.000Z"
}
```

### 4.2 ทดสอบ Auto-resolve ใน Frontend

1. เปิด app ของคุณ (Netlify URL หรือ GitHub Pages)
2. ไปที่หน้า "Facebook Reels Generator"
3. วาง short link เช่น:
   ```
   https://www.facebook.com/share/r/abc123/
   ```
4. คลิกปุ่ม **"🤖 แปลงอัตโนมัติ"**
5. ถ้าสำเร็จจะเห็นข้อความ: ✅ แปลงลิงก์สำเร็จ!

### 4.3 ทดสอบจากเครื่องอื่น

- ส่ง URL ให้เพื่อนทดสอบ
- เปิดบนมือถือ
- ลอง incognito mode

**ถ้าทำงานได้ทุกที่ = สำเร็จ! 🎉**

---

## 💻 วิธีทดสอบในเครื่อง (Development)

### Option A: ทดสอบ Functions ใน Local (แนะนำ)

```bash
# 1. ติดตั้ง Netlify CLI (ถ้ายังไม่ได้ติดตั้ง)
npm install -g netlify-cli

# 2. รัน Netlify Dev (จะรัน React + Functions พร้อมกัน)
netlify dev

# จะเปิดที่ http://localhost:8888
# Auto-resolve จะใช้ local function ที่ http://localhost:8888/.netlify/functions/resolve-url
```

**ข้อดี:**
- ✅ ทดสอบ function ได้แบบเต็มรูปแบบ
- ✅ ไม่ต้อง deploy ทุกครั้งที่แก้โค้ด
- ✅ เห็น console.log จาก function

### Option B: ทดสอบแค่ Frontend (ใช้ Production API)

```bash
npm start

# จะเปิดที่ http://localhost:3000
# Auto-resolve จะเรียก production API ที่ https://YOUR-SITE.netlify.app/.netlify/functions/resolve-url
```

**ข้อแม้:**
- ⚠️ ต้อง deploy function บน Netlify ก่อน
- ⚠️ ต้องแก้ไข API URL ใน code (บรรทัด 298)

---

## 🐛 Troubleshooting

### ปัญหา 1: Auto-resolve ขึ้น Error "Failed to fetch"

**สาเหตุ:**
- Function ยังไม่ถูก deploy
- API URL ผิด
- ไม่มีอินเทอร์เน็ต

**วิธีแก้:**
```bash
# 1. ตรวจสอบว่า function deploy แล้วหรือยัง
curl https://YOUR-SITE.netlify.app/.netlify/functions/resolve-url?url=test

# 2. ดู Netlify build logs
# ไปที่ Netlify Dashboard → Site → Deploys → คลิกล่าสุด → ดู logs

# 3. ตรวจสอบว่ามีโฟลเดอร์ netlify/functions/
ls netlify/functions/

# 4. ตรวจสอบว่า netlify.toml ตั้งค่าถูกต้อง
cat netlify.toml
```

### ปัญหา 2: Function ขึ้น Error 404

**สาเหตุ:**
- โฟลเดอร์ `netlify/functions/` ไม่มี
- ไฟล์ `resolve-url.js` ชื่อไม่ถูกต้อง
- netlify.toml ไม่ได้ commit

**วิธีแก้:**
```bash
# 1. ตรวจสอบโครงสร้างไฟล์
tree netlify/

# Output ควรเป็น:
# netlify/
# └── functions/
#     └── resolve-url.js

# 2. Commit และ push อีกครั้ง
git add netlify/
git add netlify.toml
git commit -m "Add Netlify functions"
git push origin main
```

### ปัญหา 3: CORS Error

**สาเหตุ:**
- Headers ไม่ถูกต้อง
- ไม่ได้ handle OPTIONS request

**วิธีแก้:**
ตรวจสอบไฟล์ `netlify/functions/resolve-url.js` มีโค้ดนี้หรือไม่:

```javascript
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Handle OPTIONS
if (event.httpMethod === 'OPTIONS') {
  return { statusCode: 200, headers, body: '' };
}
```

### ปัญหา 4: Function ช้ามาก

**สาเหตุ:**
- Cold start (function ไม่ได้ใช้งานนาน)
- Facebook server ช้า

**วิธีแก้:**
- รอ 5-10 วินาที
- ลองอีกครั้ง (ครั้งที่ 2 จะเร็วขึ้น)
- ถ้ายังช้า ให้ใช้ "แปลงด้วยตนเอง" แทน

### ปัญหา 5: npm install ล้มเหลว

**วิธีแก้:**
```bash
# ลบ node_modules และ lock file
rm -rf node_modules package-lock.json

# ติดตั้งใหม่
npm install
```

### ปัญหา 6: Build ล้มเหลวบน Netlify

**ดู Build Logs:**
1. ไปที่ Netlify Dashboard
2. คลิก Site → Deploys
3. คลิกล่าสุด → ดู logs

**ข้อผิดพลาดที่พบบ่อย:**
- `node-fetch not found` → ติดตั้ง: `npm install node-fetch`
- `eslint errors` → แก้ไข code ตาม warnings
- `out of memory` → ลด dependencies ที่ไม่ใช้

---

## 📊 สรุป Checklist

ก่อน Deploy ตรวจสอบว่าทำครบแล้ว:

### Backend (Netlify Functions)
- [ ] มีโฟลเดอร์ `netlify/functions/`
- [ ] มีไฟล์ `resolve-url.js` ข้างใน
- [ ] มีไฟล์ `netlify.toml` ที่ root
- [ ] `netlify.toml` ตั้งค่า `functions = "netlify/functions"`
- [ ] ติดตั้ง `node-fetch` แล้ว (`npm install node-fetch`)
- [ ] Push code ขึ้น GitHub แล้ว
- [ ] Deploy บน Netlify แล้ว
- [ ] ทดสอบ API endpoint แล้วได้ JSON response

### Frontend
- [ ] แก้ไข API URL ใน `FbReelsGenerator.jsx` (บรรทัด 298)
- [ ] Commit และ push การเปลี่ยนแปลง
- [ ] Build สำเร็จ (ไม่มี errors)
- [ ] ทดสอบ Auto-resolve ทำงานได้

### Testing
- [ ] ทดสอบบนเครื่องตัวเอง
- [ ] ทดสอบบนมือถือ
- [ ] ทดสอบจากเครื่องอื่น
- [ ] ทดสอบ incognito mode

---

## 🎯 Best Practices

1. **ใช้ Environment Variables**
   ```bash
   # ตั้งใน Netlify Dashboard → Site Settings → Environment Variables
   REACT_APP_API_URL=https://your-site.netlify.app
   ```

2. **Monitor Usage**
   - Netlify Dashboard → Site → Functions → Usage
   - Free tier: 125,000 requests/month
   - แต่ละ request ใช้เวลา ~2-3 วินาที

3. **Enable Caching**
   - เพิ่ม caching headers ใน netlify.toml
   - ลด function calls

4. **Error Logging**
   - ดู logs ที่ Netlify Dashboard → Functions → Logs
   - ใช้ `console.log()` ใน function code

---

## 📞 ช่องทางติดต่อ

ถ้ามีปัญหาติดต่อได้ที่:
- GitHub Issues: https://github.com/YOUR_USERNAME/docx-to-code-converter/issues
- Netlify Community: https://answers.netlify.com/

---

## 📚 เอกสารเพิ่มเติม

- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [React Deployment Guide](https://create-react-app.dev/docs/deployment/)
- [CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**สำเร็จแล้ว! 🎉**

ตอนนี้ Auto-resolve feature ของคุณทำงานได้จากทุกเครื่องแล้ว!
