# Netlify Functions - Facebook URL Resolver

## 📁 ไฟล์นี้คืออะไร?

`resolve-url.js` เป็น **Serverless Function** ที่ทำงานบน Netlify

### 🎯 หน้าที่:
แปลง Facebook short link (`/share/r/...`) เป็น URL จริง (`/reel/xxxxx/`) โดยอัตโนมัติ

### 🔧 วิธีการทำงาน:
1. รับ `url` parameter จาก query string
2. ใช้ `node-fetch` ดึง URL พร้อม follow redirects
3. ส่ง URL จริงกลับไปให้ frontend

### 🌐 Endpoint:
```
GET /.netlify/functions/resolve-url?url=<encoded_facebook_url>
```

### 📝 ตัวอย่าง Request:
```bash
curl "https://your-site.netlify.app/.netlify/functions/resolve-url?url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fr%2F1aBoAEXoPs%2F"
```

### ✅ ตัวอย่าง Response:
```json
{
  "originalUrl": "https://www.facebook.com/share/r/1aBoAEXoPs/",
  "finalUrl": "https://www.facebook.com/reel/941158044851298/",
  "success": true
}
```

### ❌ Error Response:
```json
{
  "error": "Failed to fetch",
  "success": false
}
```

---

## 🚀 การ Deploy:

### บน Netlify:
1. Push code ไปยัง GitHub
2. Connect repository กับ Netlify
3. Netlify จะตรวจจาก `netlify.toml` และ deploy function อัตโนมัติ

### ทดสอบ Local:
```bash
netlify dev
```

Function จะทำงานที่:
```
http://localhost:8888/.netlify/functions/resolve-url
```

---

## 🛠️ Dependencies:

- `node-fetch@2.7.0` - สำหรับ fetch API ใน Node.js

---

## 💡 ทำไมต้องใช้ Serverless Function?

### ❌ ปัญหาของ Client-side:
- โดน CORS policy block
- ไม่สามารถ fetch Facebook URL ได้โดยตรง
- CORS proxy services ส่วนใหญ่ไม่เสถียร

### ✅ ข้อดีของ Server-side:
- ไม่มี CORS problem
- Facebook ไม่ได้ block server IP
- เสถียรและปลอดภัย
- Auto-resolve ได้อัตโนมัติ 100%

---

## 🔒 Security:

- รับเฉพาะ GET requests
- มี CORS headers ที่ถูกต้อง
- Validate URL parameter
- Error handling ครบถ้วน

---

Made with ❤️ for V Square Clinic

