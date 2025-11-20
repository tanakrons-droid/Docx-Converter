# 🚀 วิธี Deploy Facebook Reels Auto-Resolver

โปรเจคนี้ใช้ **Serverless Function** เพื่อแปลง Facebook short link อัตโนมัติ

---

## 🟢 Option 1: Deploy บน Netlify (แนะนำ ⭐)

### ขั้นตอน:

1. **Push code ไปยัง GitHub**
   ```bash
   git add .
   git commit -m "Add Netlify serverless function for URL resolver"
   git push
   ```

2. **ไปที่ Netlify Dashboard**
   - เข้า [https://app.netlify.com](https://app.netlify.com)
   - คลิก "Add new site" → "Import an existing project"
   - เลือก GitHub repository ของคุณ

3. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `build`
   - Functions directory: `netlify/functions`
   - (Netlify จะตรวจจาก netlify.toml อัตโนมัติ)

4. **Deploy!**
   - คลิก "Deploy site"
   - รอประมาณ 2-3 นาที
   - เสร็จแล้ว! 🎉

### ✅ ผลลัพธ์:
- Auto-resolve ทำงานได้เต็มรูปแบบ
- URL: `https://your-site.netlify.app`
- Serverless Function: `https://your-site.netlify.app/.netlify/functions/resolve-url`

---

## 🟣 Option 2: Deploy บน Vercel

### ขั้นตอน:

1. **สร้าง Vercel Function**
   
   สร้างไฟล์ `api/resolve-url.js`:
   ```javascript
   const fetch = require('node-fetch');

   module.exports = async (req, res) => {
     res.setHeader('Access-Control-Allow-Origin', '*');
     res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
     res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

     if (req.method === 'OPTIONS') {
       return res.status(200).end();
     }

     const { url } = req.query;

     if (!url) {
       return res.status(400).json({ error: 'Missing url parameter' });
     }

     try {
       const response = await fetch(url, {
         method: 'GET',
         redirect: 'follow',
         headers: {
           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
         },
       });

       const finalUrl = response.url;
       let reelUrl = finalUrl;

       if (finalUrl.includes('facebook.com/reel/')) {
         const match = finalUrl.match(/\/reel\/([A-Za-z0-9._-]+)/);
         if (match) {
           reelUrl = `https://www.facebook.com/reel/${match[1]}/`;
         }
       }

       return res.status(200).json({
         originalUrl: url,
         finalUrl: reelUrl,
         success: true,
       });
     } catch (error) {
       return res.status(500).json({
         error: error.message,
         success: false,
       });
     }
   };
   ```

2. **Deploy ไปยัง Vercel**
   ```bash
   npm install -g vercel
   vercel
   ```
   - ตอบคำถามตามขั้นตอน
   - Deploy เสร็จแล้ว! 🎉

3. **อัปเดต Frontend Code** (ถ้าใช้ Vercel)
   
   แก้ไข `src/components/reels/FbReelsGenerator.jsx` บรรทัด 271:
   ```javascript
   const apiEndpoint = process.env.NODE_ENV === 'production' 
     ? '/api/resolve-url'  // ✅ Vercel API Route
     : '/api/resolve-url';
   ```

---

## 🔧 Local Development (ทดสอบในเครื่อง)

### สำหรับ Netlify:

1. **ติดตั้ง Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **รัน Local Dev Server**
   ```bash
   netlify dev
   ```
   - จะรันที่ `http://localhost:8888`
   - Serverless Function จะทำงานที่ `http://localhost:8888/.netlify/functions/resolve-url`

### สำหรับ Vercel:

1. **ติดตั้ง Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **รัน Local Dev Server**
   ```bash
   vercel dev
   ```
   - จะรันที่ `http://localhost:3000`

---

## 🧪 ทดสอบ Serverless Function

### ทดสอบด้วย cURL:

```bash
# Netlify
curl "https://your-site.netlify.app/.netlify/functions/resolve-url?url=https://www.facebook.com/share/r/1aBoAEXoPs/"

# Vercel
curl "https://your-site.vercel.app/api/resolve-url?url=https://www.facebook.com/share/r/1aBoAEXoPs/"
```

### ผลลัพธ์ที่ต้องการ:
```json
{
  "originalUrl": "https://www.facebook.com/share/r/1aBoAEXoPs/",
  "finalUrl": "https://www.facebook.com/reel/941158044851298/",
  "success": true
}
```

---

## 📝 หมายเหตุ:

- ✅ **ฟรี!** Netlify และ Vercel มี free tier ที่เพียงพอ
- ✅ **ไม่มี CORS error** เพราะทำงานฝั่ง server
- ✅ **Auto-resolve อัตโนมัติ** ไม่ต้องให้ผู้ใช้คัดลอกเอง
- ✅ **Fallback mechanism** ถ้า serverless function ไม่พร้อม จะเปิดลิงก์ให้คัดลอกเองแทน

---

## 🆘 Troubleshooting:

### 1. "404 Function not found"
- ตรวจสอบว่า deploy ไฟล์ `netlify/functions/resolve-url.js` แล้ว
- ตรวจสอบ `netlify.toml` มี `functions = "netlify/functions"`

### 2. "Module not found: node-fetch"
- รัน `npm install node-fetch@2.7.0`
- หรือใช้ built-in `fetch` ถ้าใช้ Node.js 18+

### 3. Local dev ไม่ทำงาน
- ตรวจสอบว่าติดตั้ง netlify-cli หรือ vercel แล้ว
- ลองรัน `npm install` อีกครั้ง

---

## 🎉 เมื่อ Deploy สำเร็จ:

1. วางลิงก์ short link: `https://www.facebook.com/share/r/xxxxx/`
2. กดปุ่ม "ดึงลิงก์จริง"
3. **ระบบแปลงอัตโนมัติทันที!** 🚀
4. ไม่ต้องเปิด tab ใหม่ ไม่ต้องคัดลอกเอง

---

Made with ❤️ for V Square Clinic

