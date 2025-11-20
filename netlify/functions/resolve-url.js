// ========================================
// Netlify Serverless Function
// ชื่อ: resolve-url
// จุดประสงค์: แก้ปัญหา Facebook Short Link → Full Reel URL
// ========================================
//
// Facebook short link (/share/r/ หรือ /share/v/) ไม่สามารถใช้งานใน iframe embed ได้
// Function นี้จะ:
// 1. รับ short link จาก frontend
// 2. ทำ HTTP request ไปยัง Facebook (server-side เพื่อ bypass CORS)
// 3. Follow redirects เพื่อหา real reel URL
// 4. ส่ง real URL กลับไปให้ frontend
//
// Endpoint: /.netlify/functions/resolve-url?url=<facebook-url>
// ========================================

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // ========================================
  // 1. CORS Headers - อนุญาตให้ทุกโดเมนเรียกใช้ได้
  // ========================================
  const headers = {
    'Access-Control-Allow-Origin': '*', // อนุญาตทุกโดเมน (GitHub Pages, localhost, ฯลฯ)
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // ========================================
  // 2. Handle Preflight Request (OPTIONS)
  // ========================================
  // เบราว์เซอร์จะส่ง OPTIONS request ก่อน GET/POST (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // ========================================
  // 3. ดึง URL จาก Query Parameter
  // ========================================
  const url = event.queryStringParameters?.url;

  if (!url) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Missing url parameter',
        message: 'กรุณาระบุ URL ที่ต้องการ resolve',
        usage: '/.netlify/functions/resolve-url?url=<facebook-url>',
        success: false
      }),
    };
  }

  // ========================================
  // 4. Validate URL - ตรวจสอบว่าเป็น Facebook URL
  // ========================================
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace(/^m\./, 'www.');

    if (!hostname.includes('facebook.com')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid URL',
          message: 'URL ต้องเป็น Facebook เท่านั้น',
          originalUrl: url,
          success: false
        }),
      };
    }
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Invalid URL format',
        message: 'รูปแบบ URL ไม่ถูกต้อง',
        originalUrl: url,
        success: false
      }),
    };
  }

  // ========================================
  // 5. ทำการ Resolve URL
  // ========================================
  try {
    console.log('🔍 [Netlify Function] Resolving URL:', url);
    console.log('📅 [Netlify Function] Timestamp:', new Date().toISOString());

    let finalUrl = null;
    let method = null;

    // ========================================
    // Method 1: Direct Fetch with Redirect Following
    // ========================================
    // ใช้ fetch ติดตาม redirect อัตโนมัติ แล้วดู final URL
    try {
      console.log('🚀 [Method 1] Attempting direct fetch with redirects...');

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow', // ติดตาม redirect อัตโนมัติ
        headers: {
          // Headers เลียนแบบเบราว์เซอร์จริง เพื่อให้ Facebook ยอมตอบกลับ
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,th;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
        },
        timeout: 10000, // 10 seconds timeout
      });

      finalUrl = response.url; // URL หลัง redirect

      console.log('📍 [Method 1] Response received:');
      console.log('  - Original URL:', url);
      console.log('  - Final URL:', finalUrl);
      console.log('  - Status:', response.status);
      console.log('  - URL Changed?:', finalUrl !== url);
      console.log('  - Contains /reel/?:', finalUrl.includes('/reel/'));

      // ถ้า URL เปลี่ยนและมี /reel/ แสดงว่าสำเร็จ
      if (finalUrl !== url && finalUrl.includes('/reel/')) {
        method = 'direct-fetch';
        console.log('✅ [Method 1] Success! Found reel URL');
      } else {
        console.log('⚠️  [Method 1] URL did not change or no /reel/ found, trying fallback methods...');

        // ========================================
        // Method 2: Parse HTML Content
        // ========================================
        // ถ้า Method 1 ไม่ได้ผล ให้ลอง parse HTML
        const html = await response.text();
        console.log('🔍 [Method 2] Parsing HTML content...');
        console.log('  - HTML Length:', html.length, 'characters');

        // 2.1: หา og:url meta tag
        const ogUrlMatch = html.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);
        if (ogUrlMatch && ogUrlMatch[1] && ogUrlMatch[1].includes('/reel/')) {
          finalUrl = ogUrlMatch[1];
          method = 'og-url-meta';
          console.log('✅ [Method 2.1] Found via og:url:', finalUrl);
        }

        // 2.2: หา canonical link
        if (!finalUrl || finalUrl === url || !finalUrl.includes('/reel/')) {
          const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
          if (canonicalMatch && canonicalMatch[1] && canonicalMatch[1].includes('/reel/')) {
            finalUrl = canonicalMatch[1];
            method = 'canonical-link';
            console.log('✅ [Method 2.2] Found via canonical:', finalUrl);
          }
        }

        // 2.3: ค้นหา reel URL ใน HTML โดยตรง (regex)
        if (!finalUrl || finalUrl === url || !finalUrl.includes('/reel/')) {
          const reelMatch = html.match(/https:\/\/(?:www\.)?facebook\.com\/reel\/(\d+)/i);
          if (reelMatch && reelMatch[0]) {
            finalUrl = reelMatch[0].replace(/^https:\/\/facebook\.com/, 'https://www.facebook.com');
            method = 'html-regex-search';
            console.log('✅ [Method 2.3] Found via HTML search:', finalUrl);
          }
        }

        // 2.4: ค้นหาใน JavaScript code blocks
        if (!finalUrl || finalUrl === url || !finalUrl.includes('/reel/')) {
          const scriptMatches = html.matchAll(/"url":"(https:\\\/\\\/(?:www\.)?facebook\.com\\\/reel\\\/[^"]+)"/gi);
          for (const match of scriptMatches) {
            if (match[1]) {
              // แปลง escaped slashes กลับมาเป็น URL ปกติ
              const unescaped = match[1].replace(/\\\//g, '/');
              if (unescaped.includes('/reel/')) {
                finalUrl = unescaped;
                method = 'javascript-data';
                console.log('✅ [Method 2.4] Found via JavaScript data:', finalUrl);
                break;
              }
            }
          }
        }
      }

    } catch (fetchError) {
      console.error('❌ [Method 1-2] All primary methods failed:', fetchError.message);
      // ไม่ throw error ยัง เพราะจะลอง Method 3
    }

    // ========================================
    // Method 3: Fallback - Extract from URL Pattern
    // ========================================
    // ถ้าทุก method ล้มเหลว ลองดูว่า URL มี pattern ที่สามารถแปลงได้หรือไม่
    if (!finalUrl || finalUrl === url || !finalUrl.includes('/reel/')) {
      console.log('🔍 [Method 3] Attempting pattern extraction from original URL...');

      // ดูว่า URL เดิมมี reel ID หรือไม่
      const urlMatch = url.match(/\/(?:reel|share\/[rv])\/([A-Za-z0-9._-]+)/);
      if (urlMatch && urlMatch[1]) {
        // สร้าง URL ใหม่จาก ID ที่เจอ
        finalUrl = `https://www.facebook.com/reel/${urlMatch[1]}/`;
        method = 'pattern-extraction';
        console.log('✅ [Method 3] Extracted from pattern:', finalUrl);
      }
    }

    // ========================================
    // 6. Clean & Normalize URL
    // ========================================
    if (finalUrl && finalUrl.includes('/reel/')) {
      console.log('🧹 [Cleanup] Normalizing URL...');

      try {
        const urlObj = new URL(finalUrl);

        // เปลี่ยน m.facebook.com → www.facebook.com
        urlObj.hostname = urlObj.hostname.replace(/^m\./, 'www.');

        // ดึง reel ID แล้วสร้าง clean URL
        const reelIdMatch = urlObj.pathname.match(/\/reel\/([A-Za-z0-9._-]+)/);
        if (reelIdMatch && reelIdMatch[1]) {
          finalUrl = `https://www.facebook.com/reel/${reelIdMatch[1]}/`;
          console.log('✅ [Cleanup] Clean URL:', finalUrl);
        }
      } catch (e) {
        console.log('⚠️  [Cleanup] Could not normalize, using as-is');
      }
    }

    // ========================================
    // 7. ตรวจสอบผลลัพธ์และส่งกลับ
    // ========================================
    const resolved = finalUrl && finalUrl !== url && finalUrl.includes('/reel/');

    if (resolved) {
      console.log('🎉 [Success] Resolution complete!');
      console.log('  - Method:', method);
      console.log('  - Original:', url);
      console.log('  - Resolved:', finalUrl);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          originalUrl: url,
          finalUrl: finalUrl,
          method: method,
          message: 'Successfully resolved URL',
          timestamp: new Date().toISOString()
        }),
      };
    } else {
      console.log('⚠️  [Partial Success] URL processed but may not have changed');
      console.log('  - Original:', url);
      console.log('  - Final:', finalUrl || url);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          originalUrl: url,
          finalUrl: finalUrl || url,
          method: method || 'none',
          message: 'URL processed but could not find different reel URL',
          hint: 'URL may already be in final form, or the short link may be invalid',
          timestamp: new Date().toISOString()
        }),
      };
    }

  } catch (error) {
    // ========================================
    // 8. Error Handling
    // ========================================
    console.error('💥 [Fatal Error] Unexpected error:', error);
    console.error('  - Error Name:', error.name);
    console.error('  - Error Message:', error.message);
    console.error('  - Stack:', error.stack);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        errorType: error.name,
        originalUrl: url,
        message: 'เกิดข้อผิดพลาดในการ resolve URL',
        hint: 'ลองใช้ manual resolve หรือตรวจสอบว่า URL ถูกต้อง',
        timestamp: new Date().toISOString()
      }),
    };
  }
};
