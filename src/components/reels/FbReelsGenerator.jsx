import React, { useEffect, useMemo, useRef, useState } from "react";

// =====================
// Utilities
// =====================
// escapeHtml: Order matters: replace ampersand first to avoid double-escaping.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Tests for escapeHtml (DO NOT modify existing cases; append only)
const ESCAPE_TESTS = [
  { name: "ampersand", input: "A & B", expected: "A &amp; B" },
  { name: "lt/gt", input: "<script>", expected: "&lt;script&gt;" },
  { name: "double quotes", input: '"quote"', expected: '&quot;quote&quot;' },
  { name: "single quotes", input: "'single'", expected: "&#039;single&#039;" },
  { name: "mixed", input: 'A&B "x"<y\'z', expected: 'A&amp;B &quot;x&quot;&lt;y&#039;z' },
  // Additional tests (appended)
  { name: "empty", input: "", expected: "" },
  { name: "thai text", input: "แคปชั่น <ทดสอบ> & \"ยกตัวอย่าง\"", expected: "แคปชั่น &lt;ทดสอบ&gt; &amp; &quot;ยกตัวอย่าง&quot;" },
  { name: "emoji", input: "🙂 & <3", expected: "🙂 &amp; &lt;3" },
  { name: "idempotent", input: "&amp;&lt;&gt;&quot;&#039;", expected: "&amp;&lt;&gt;&quot;&#039;" },
  { name: "surrogate pair", input: "\uD83D\uDE80 & <tag> ' \" ", expected: "🚀 &amp; &lt;tag&gt; &#039; &quot; " },
  // New additional tests (appended without changing existing ones)
  { name: "attr-mixed", input: "title=\"A&B 'x'<y>\"", expected: "title=&quot;A&amp;B &#039;x&#039;&lt;y&gt;&quot;" },
  { name: "angle-only", input: "<><>", expected: "&lt;&gt;&lt;&gt;" },
];

function TestPanel() {
  const results = ESCAPE_TESTS.map((t) => {
    const actual = escapeHtml(t.input);
    const pass = actual === t.expected;
    return { ...t, actual, pass };
  });
  const allPass = results.every((r) => r.pass);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">escapeHtml() Tests</div>
        <div className={`text-xs px-2 py-1 rounded ${allPass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {allPass ? "ALL PASS" : "SOME FAIL"}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left">
            <tr className="text-gray-500">
              <th className="py-1 pr-2">Case</th>
              <th className="py-1 pr-2">Input</th>
              <th className="py-1 pr-2">Expected</th>
              <th className="py-1 pr-2">Actual</th>
              <th className="py-1 pr-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.name} className="border-t">
                <td className="py-1 pr-2 whitespace-nowrap">{r.name}</td>
                <td className="py-1 pr-2">{r.input}</td>
                <td className="py-1 pr-2">{r.expected}</td>
                <td className="py-1 pr-2">{r.actual}</td>
                <td className="py-1 pr-2 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded ${r.pass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {r.pass ? "PASS" : "FAIL"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================
// Smart Input Helpers (URL / <iframe> embed → clean Reel URL)
// =====================
function isFacebookReelUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^m\./, "www.");
    // Accept both /reel/ and /share/r/ or /share/v/ formats
    return host === "www.facebook.com" && (/\/reel\//.test(url.pathname) || /\/share\/[rv]\//.test(url.pathname));
  } catch {
    return false;
  }
}

function cleanReelUrl(u) {
  try {
    const url = new URL(u);
    url.hostname = url.hostname.replace(/^m\./, "www.");
    // keep only /reel/<id>/
    const m = url.pathname.match(/\/reel\/([A-Za-z0-9._-]+)/);
    if (!m) return u;
    return `https://www.facebook.com/reel/${m[1]}/`;
  } catch {
    return u;
  }
}

function extractReelUrl(input) {
  try {
    const trimmed = String(input).trim();
    // If it's already a normal URL
    if (/^https?:\/\//i.test(trimmed)) {
      return cleanReelUrl(trimmed);
    }
    // Try href="..."
    const hrefMatch = trimmed.match(/href="([^"]+)/i);
    if (hrefMatch) return cleanReelUrl(decodeURIComponent(hrefMatch[1]));
    // Try src="..."
    const srcMatch = trimmed.match(/src="([^"]+)/i);
    if (srcMatch) {
      const src = decodeURIComponent(srcMatch[1]);
      // inside src find href param
      const hrefParam = src.match(/[?&]href=([^&]+)/i);
      if (hrefParam) return cleanReelUrl(decodeURIComponent(hrefParam[1]));
      // or direct reel in src
      const direct = src.match(/https?:\/\/www\.facebook\.com\/reel\/[A-Za-z0-9._-]+/i);
      if (direct) return cleanReelUrl(direct[0]);
    }
  } catch (e) {
    console.error(e);
  }
  return input; // fallback to original
}

function analyzeIncoming(input) {
  const raw = String(input || "");
  const cleaned = extractReelUrl(raw);
  if (raw.includes("<iframe") || raw.includes("plugins/video.php")) {
    // came from embed
    if (isFacebookReelUrl(cleaned)) {
      return { url: cleaned, type: "ok", msg: "✅ ตรวจพบโค้ด Embed และดึงลิงก์ Reel ให้แล้ว" };
    }
    return { url: raw, type: "error", msg: "ใส่โค้ด embed แล้ว แต่ดึงลิงก์ Reel ไม่ได้ กรุณาตรวจสอบ" };
  }
  // normal text/URL
  if (!raw) return { url: raw, type: "", msg: "" };
  if (isFacebookReelUrl(cleaned)) {
    const changed = cleaned !== raw;
    // Check if it's a short link
    if (cleaned.includes("/share/r/") || cleaned.includes("/share/v/")) {
      return { url: cleaned, type: "warn", msg: "⚠️ นี่คือ short link - กดปุ่ม 'ดึงลิงก์จริง' เพื่อแปลงเป็น URL จริง" };
    }
    return { url: cleaned, type: changed ? "ok" : "", msg: changed ? "✅ ทำความสะอาดลิงก์ให้แล้ว" : "" };
  }
  return { url: raw, type: "warn", msg: "ลิงก์ต้องเป็น Facebook Reel เท่านั้น (รูปแบบ https://www.facebook.com/reel/... หรือ /share/r/...)" };
}

// =====================
// Main Component
// =====================
export default function FbReelsGenerator({ variant = "modal" }) {
  // Inputs
  const [url, setUrl] = useState("https://www.facebook.com/reel/24466068993061081/");
  const [caption, setCaption] = useState("เลเซอร์แล้วขนหายถาวรไหม ? รู้คำตอบได้ที่คลิปนี้");
  const [italic, setItalic] = useState(true);
  const [width, setWidth] = useState(360);
  const [height, setHeight] = useState(640);
  const [maxWidth100, setMaxWidth100] = useState(true);
  const [livePreview, setLivePreview] = useState(false);

  // Smart Input notice state (bubble under input)
  const [urlNotice, setUrlNotice] = useState({ type: "", msg: "" });

  // URL Resolver state
  const [resolveStatus, setResolveStatus] = useState(""); // "", "loading", "success", "error"
  const [resolveError, setResolveError] = useState("");

  // UX state
  const [copyStatus, setCopyStatus] = useState(""); // "", "success", "manual"
  const [copyShortStatus, setCopyShortStatus] = useState("");
  const outputRef = useRef(null);
  const shortRef = useRef(null);

  // Presets (localStorage)
  const PRESET_KEY = "reels_embed_presets_v1";
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESET_KEY);
      if (raw) setPresets(JSON.parse(raw));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const savePreset = () => {
    const name = presetName.trim() || new Date().toLocaleString();
    const next = [
      {
        name,
        url,
        caption,
        italic,
        width,
        height,
        maxWidth100,
      },
      ...presets,
    ].slice(0, 20);
    setPresets(next);
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
    setPresetName("");
  };

  const loadPreset = (p) => {
    setUrl(p.url);
    setCaption(p.caption);
    setItalic(p.italic);
    setWidth(p.width);
    setHeight(p.height);
    setMaxWidth100(p.maxWidth100);
  };

  // Smart Input handlers
  const handleUrlInput = (value) => {
    const res = analyzeIncoming(value);
    setUrl(res.url);
    setUrlNotice({ type: res.type, msg: res.msg });
    // Reset resolve status when URL changes
    if (resolveStatus) {
      setResolveStatus("");
      setResolveError("");
    }
  };

  const handleUrlPaste = (e) => {
    const text = (e.clipboardData || window.clipboardData).getData("text");
    if (text) {
      e.preventDefault();
      handleUrlInput(text);
    }
  };

  // Auto-resolve ผ่าน Serverless Function
  // รองรับทั้ง Production (Netlify deployed) และ Development (netlify dev)
  const handleAutoResolve = async () => {
    const currentUrl = url.trim();

    if (!currentUrl) {
      alert("กรุณาใส่ลิงก์ก่อนดึงข้อมูล");
      return;
    }

    // Check if it's a short link format
    if (!currentUrl.includes("/share/r/") && !currentUrl.includes("/share/v/")) {
      alert("ลิงก์นี้ไม่ใช่ short link ที่ต้อง resolve\n(ต้องมี /share/r/ หรือ /share/v/)");
      return;
    }

    setResolveStatus("loading");
    setResolveError("");

    try {
      // ========================================
      // กำหนด API Endpoint อัตโนมัติ
      // ========================================
      // รองรับ 3 สถานการณ์:
      // 1. Production บน Netlify (https://your-site.netlify.app)
      // 2. Development ด้วย netlify dev (http://localhost:8888)
      // 3. Development ธรรมดา (http://localhost:3000) - แต่จะใช้ production API

      let apiBaseUrl;
      const currentHost = window.location.hostname;
      const currentProtocol = window.location.protocol;
      const currentPort = window.location.port;

      console.log('🔍 [Auto-Resolve] Detecting environment...');
      console.log('  - Hostname:', currentHost);
      console.log('  - Protocol:', currentProtocol);
      console.log('  - Port:', currentPort);

      // ตรวจสอบว่ารันบน localhost หรือไม่
      if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
        // Development mode
        if (currentPort === '8888') {
          // netlify dev (port 8888 is default for netlify dev)
          apiBaseUrl = `${currentProtocol}//${currentHost}:${currentPort}`;
          console.log('✅ [Auto-Resolve] Detected: netlify dev');
        } else {
          // React dev server (port 3000) - ต้องใช้ production API
          // เปลี่ยน URL นี้เป็น Netlify site ของคุณ
          apiBaseUrl = 'https://YOUR-SITE-NAME.netlify.app';
          console.log('⚠️  [Auto-Resolve] Detected: React dev server');
          console.log('   Using production API:', apiBaseUrl);
          console.log('   💡 Tip: Run "netlify dev" to test functions locally');
        }
      } else {
        // Production mode - ใช้ current URL
        apiBaseUrl = `${currentProtocol}//${currentHost}`;
        console.log('✅ [Auto-Resolve] Detected: Production deployment');
      }

      const apiEndpoint = `${apiBaseUrl}/.netlify/functions/resolve-url`;
      console.log('🚀 [Auto-Resolve] API Endpoint:', apiEndpoint);
      console.log('🚀 [Auto-Resolve] Resolving URL:', currentUrl);

      const response = await fetch(`${apiEndpoint}?url=${encodeURIComponent(currentUrl)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('📡 [Auto-Resolve] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Auto-Resolve] Server error:', errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('📦 [Auto-Resolve] Response data:', data);

      if (data.success && data.finalUrl && data.finalUrl !== currentUrl) {
        // Successfully resolved!
        console.log('✅ [Auto-Resolve] Success!');
        console.log('   Original:', currentUrl);
        console.log('   Resolved:', data.finalUrl);
        console.log('   Method:', data.method);

        setUrl(data.finalUrl);
        setResolveStatus("success");

        // Re-analyze the new URL
        const res = analyzeIncoming(data.finalUrl);
        setUrl(res.url);
        setUrlNotice({
          type: "ok",
          msg: `✅ แปลงลิงก์สำเร็จ! (${data.method || 'auto-resolve'})`
        });

        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setResolveStatus("");
        }, 3000);
      } else {
        console.warn('⚠️  [Auto-Resolve] Could not resolve URL');
        console.warn('   Response:', data);
        throw new Error(data.message || "Could not resolve URL from server");
      }

    } catch (error) {
      console.error("❌ [Auto-Resolve] Failed:", error);
      console.error("   Error details:", error.message);

      setResolveStatus("error");

      // สร้าง error message ที่เหมาะสม
      let errorMessage = "❌ Auto-resolve ล้มเหลว\n\n";

      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage +=
          "🔌 ปัญหา: ไม่สามารถเชื่อมต่อ API ได้\n\n" +
          "สาเหตุที่เป็นไปได้:\n" +
          "• ยังไม่ได้ deploy Function บน Netlify\n" +
          "• กำลังรัน React dev server (port 3000) แต่ยังไม่ได้ตั้งค่า production API\n" +
          "• ไม่มีอินเทอร์เน็ต\n\n" +
          "💡 วิธีแก้:\n" +
          "• รัน 'netlify dev' แทน 'npm start' (สำหรับทดสอบ function ในเครื่อง)\n" +
          "• หรือ deploy โปรเจคบน Netlify แล้วใช้งานผ่าน production URL\n" +
          "• หรือใช้ปุ่ม \"👤 แปลงด้วยตนเอง\" แทน";
      } else if (error.message.includes('404')) {
        errorMessage +=
          "🔍 ปัญหา: ไม่พบ Function (404)\n\n" +
          "สาเหตุ: Netlify Function ยังไม่ถูก deploy\n\n" +
          "💡 วิธีแก้:\n" +
          "• ตรวจสอบว่าโฟลเดอร์ netlify/functions/resolve-url.js มีอยู่จริง\n" +
          "• Deploy โปรเจคใหม่บน Netlify\n" +
          "• ตรวจสอบ Build log บน Netlify Dashboard";
      } else if (error.message.includes('500')) {
        errorMessage +=
          "⚠️  ปัญหา: Server Error (500)\n\n" +
          "สาเหตุ: Function มี error ภายใน\n\n" +
          "💡 วิธีแก้:\n" +
          "• ดู Function logs บน Netlify Dashboard\n" +
          "• ตรวจสอบว่า node-fetch ติดตั้งถูกต้อง\n" +
          "• ทดสอบ function ด้วย netlify dev";
      } else {
        errorMessage +=
          `ข้อผิดพลาด: ${error.message}\n\n` +
          "💡 ลองใช้ปุ่ม \"👤 แปลงด้วยตนเอง\" แทน";
      }

      setResolveError(errorMessage);

      setTimeout(() => {
        setResolveStatus("");
        setResolveError("");
      }, 15000);
    }
  };

  // Manual resolve - เปิด tab ใหม่ให้คัดลอกเอง
  const handleManualResolve = () => {
    const currentUrl = url.trim();
    
    if (!currentUrl) {
      alert("กรุณาใส่ลิงก์ก่อนดึงข้อมูล");
      return;
    }

    // Check if it's a short link format
    if (!currentUrl.includes("/share/r/") && !currentUrl.includes("/share/v/")) {
      alert("ลิงก์นี้ไม่ใช่ short link ที่ต้อง resolve\n(ต้องมี /share/r/ หรือ /share/v/)");
      return;
    }

    // Open in new tab
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
    
    setResolveStatus("manual");
    setResolveError(
      "📝 วิธีแปลงลิงก์ด้วยตนเอง:\n\n" +
      "1️⃣ แท็บใหม่กำลังเปิด... รอให้หน้าเว็บโหลดเสร็จ\n" +
      "2️⃣ Facebook จะ redirect ไปยัง URL จริงของ Reel อัตโนมัติ\n" +
      "3️⃣ คัดลอก URL จาก Address Bar (ด้านบนของเบราว์เซอร์)\n" +
      "    → มันจะเป็น: https://www.facebook.com/reel/xxxxx/\n" +
      "4️⃣ กลับมาวาง URL ที่คัดลอกในช่องด้านบนนี้\n" +
      "5️⃣ เสร็จแล้ว! ระบบจะสร้างโค้ด HTML ให้อัตโนมัติ"
    );
    
    // Keep instruction visible for 30 seconds
    setTimeout(() => {
      setResolveStatus("");
      setResolveError("");
    }, 30000);
  };

  // Derived values
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      height: String(height),
      href: url.trim(),
      show_text: "false",
      width: String(width),
      t: "0",
    });
    return `https://www.facebook.com/plugins/video.php?${params.toString()}`;
  }, [url, width, height]);

  const htmlCode = useMemo(() => {
    const iframeStyle = `border:none;overflow:hidden;display:block;margin:0 auto;${maxWidth100 ? "max-width:100%;" : ""}`;
    
    // iframe with center alignment
    const iframeCode = `<iframe src="${escapeHtml(iframeSrc)}" width="${width}" height="${height}" style="${iframeStyle}" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true"></iframe>`;
    
    // Add caption if provided
    if (!caption.trim()) {
      return iframeCode;
    }
    
    const captionText = italic 
      ? `<p style="text-align:center;margin-top:8px;"><em>${escapeHtml(caption.trim())}</em></p>`
      : `<p style="text-align:center;margin-top:8px;">${escapeHtml(caption.trim())}</p>`;
    
    return [iframeCode, captionText].join("\n");
  }, [iframeSrc, width, height, maxWidth100, caption, italic]);

  const shortcode = useMemo(() => {
    // Simple shortcode representation for WordPress use
    const attrs = [
      `url="${escapeHtml(url.trim())}"`,
      `width="${width}"`,
      `height="${height}"`,
      caption.trim() ? `caption="${escapeHtml(caption.trim())}"` : "",
      `italic="${italic ? 1 : 0}"`,
    ]
      .filter(Boolean)
      .join(" ");
    return `[fb_reel ${attrs}]`;
  }, [url, width, height, caption, italic]);

  // Copy helpers
  const copyWithFallbacks = async (text, targetRef) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return "success";
      }
    } catch (e) {
      console.error(e);
    }

    try {
      if (targetRef?.current) {
        const el = targetRef.current;
        el.focus();
        el.select();
        const ok = document.execCommand && document.execCommand("copy");
        if (ok) return "success";
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand && document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) return "success";
    } catch (e) {
      console.error(e);
    }

    return "manual";
  };

  const handleCopyHtml = async () => {
    const status = await copyWithFallbacks(htmlCode, outputRef);
    setCopyStatus(status);
    setTimeout(() => setCopyStatus(""), 2000);
  };

  const handleCopyShort = async () => {
    const status = await copyWithFallbacks(shortcode, shortRef);
    setCopyShortStatus(status);
    setTimeout(() => setCopyShortStatus(""), 2000);
  };

  // Example URLs for quick usage
  const EXAMPLES = [
    { label: "Reel ตัวอย่าง 1", href: "https://www.facebook.com/reel/24466068993061081/" },
    { label: "Reel ตัวอย่าง 2", href: "https://www.facebook.com/reel/1625570721432931/" },
    { label: "Reel ตัวอย่าง 3", href: "https://www.facebook.com/reel/100889999999999/" },
  ];

  // Inline styles - ปรับตาม variant
  const isDark = variant === "modal";
  
  const inputStyle = {
    width: '100%',
    borderRadius: '8px',
    border: isDark ? '1px solid #475569' : '1px solid #d1d5db',
    padding: '12px',
    outline: 'none',
    fontSize: '14px',
    backgroundColor: isDark ? '#0f172a' : 'white',
    color: isDark ? '#e2e8f0' : '#111827'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: isDark ? '#cbd5e1' : '#374151',
    marginBottom: '6px'
  };

  const cardStyle = {
    backgroundColor: isDark ? '#0f172a' : 'white',
    borderRadius: '16px',
    border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
    boxShadow: isDark ? '0 1px 3px 0 rgba(0, 0, 0, 0.3)' : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    padding: variant === "modal" ? '12px' : '20px'
  };

  const textColor = isDark ? '#e2e8f0' : '#111827';
  const mutedColor = isDark ? '#94a3b8' : '#6b7280';
  const bgColor = isDark ? 'transparent' : 'white';

  return (
    <div style={{ minHeight: variant === "page" ? "100vh" : "auto", backgroundColor: bgColor, color: textColor }}>
      {/* Header (only for page variant) */}
      {variant === "page" && (
        <div style={{
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '-0.025em', margin: 0 }}>
              Facebook Reels → Gutenberg Embed Generator
            </h1>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>โทนสะอาด สไตล์ V Square Clinic</div>
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ maxWidth: variant === "modal" ? '100%' : '1280px', margin: '0 auto', padding: variant === "modal" ? '0' : '24px', display: 'grid', gridTemplateColumns: '1fr', gap: variant === "modal" ? '12px' : '24px' }}>
        <style>{`
          @media (min-width: 1024px) {
            .fb-reels-main-grid:not(.modal-grid) {
              grid-template-columns: 1fr 1fr !important;
            }
          }
          @media (min-width: 640px) {
            .fb-reels-two-col {
              grid-template-columns: 1fr 1fr !important;
            }
          }
          @media (min-width: 768px) {
            .fb-reels-output-cols:not(.modal-output) {
              grid-template-columns: 1fr 1fr !important;
            }
          }
        `}</style>

        <div className={`fb-reels-main-grid ${variant === "modal" ? "modal-grid" : ""}`} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: variant === "modal" ? '12px' : '24px' }}>
          {/* Controls Card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: variant === "modal" ? '10px' : '16px' }}>
              <h2 style={{ fontSize: variant === "modal" ? '15px' : '18px', fontWeight: '600', margin: 0, color: textColor }}>ตั้งค่า</h2>
              {variant === "page" && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: mutedColor }}>
                  <input type="checkbox" checked={livePreview} onChange={(e) => setLivePreview(e.target.checked)} />
                  แสดง Live Preview
                </label>
              )}
            </div>

            <div style={{ marginBottom: variant === "modal" ? '10px' : '16px' }}>
              <label style={labelStyle}>ลิงก์ Facebook Reel</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <input
                  style={{ ...inputStyle, flex: 1, minWidth: '200px' }}
                  placeholder="https://www.facebook.com/reel/... (วาง URL หรือโค้ด embed <iframe> ได้)"
                  value={url}
                  onChange={(e) => handleUrlInput(e.target.value)}
                  onPaste={handleUrlPaste}
                />
                <button
                  onClick={handleAutoResolve}
                  disabled={resolveStatus === "loading"}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 
                      resolveStatus === "loading" ? '#7c3aed' :
                      resolveStatus === "success" ? '#059669' : 
                      resolveStatus === "error" ? '#dc2626' : 
                      '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    cursor: resolveStatus === "loading" ? 'wait' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    opacity: resolveStatus === "loading" ? 0.7 : 1,
                    transition: 'all 0.2s',
                    minWidth: '140px'
                  }}
                  title="แปลงอัตโนมัติ (ต้องรันด้วย netlify dev หรือ deploy บน Netlify)"
                >
                  {resolveStatus === "loading" ? "⏳ กำลังแปลง..." : 
                   resolveStatus === "success" ? "✅ สำเร็จ!" : 
                   resolveStatus === "error" ? "❌ ล้มเหลว" :
                   "🤖 แปลงอัตโนมัติ"}
                </button>
                <button
                  onClick={handleManualResolve}
                  disabled={resolveStatus === "loading"}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: resolveStatus === "manual" ? '#ea580c' : '#f59e0b',
                    color: 'white',
                    border: 'none',
                    cursor: resolveStatus === "loading" ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    opacity: resolveStatus === "loading" ? 0.5 : 1,
                    transition: 'all 0.2s',
                    minWidth: '140px'
                  }}
                  title="เปิด tab ใหม่เพื่อคัดลอก URL เอง"
                >
                  {resolveStatus === "manual" ? "📋 อ่านคำแนะนำ" : "👤 แปลงด้วยตนเอง"}
                </button>
              </div>
              {urlNotice.msg && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: isDark 
                    ? (urlNotice.type === "ok" ? '#064e3b' : urlNotice.type === "warn" ? '#78350f' : urlNotice.type === "error" ? '#7f1d1d' : 'transparent')
                    : (urlNotice.type === "ok" ? '#d1fae5' : urlNotice.type === "warn" ? '#fef3c7' : urlNotice.type === "error" ? '#fee2e2' : 'transparent'),
                  color: isDark
                    ? (urlNotice.type === "ok" ? '#6ee7b7' : urlNotice.type === "warn" ? '#fcd34d' : urlNotice.type === "error" ? '#fca5a5' : mutedColor)
                    : (urlNotice.type === "ok" ? '#065f46' : urlNotice.type === "warn" ? '#92400e' : urlNotice.type === "error" ? '#991b1b' : '#374151')
                }}>
                  <span>{urlNotice.msg}</span>
                </div>
              )}
              {resolveError && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  backgroundColor: 
                    resolveStatus === "manual" ? (isDark ? '#78350f' : '#fef3c7') : 
                    resolveStatus === "error" ? (isDark ? '#7f1d1d' : '#fee2e2') :
                    (isDark ? '#1e3a8a' : '#dbeafe'),
                  color: 
                    resolveStatus === "manual" ? (isDark ? '#fcd34d' : '#92400e') : 
                    resolveStatus === "error" ? (isDark ? '#fca5a5' : '#991b1b') :
                    (isDark ? '#93c5fd' : '#1e40af'),
                  border: 
                    resolveStatus === "manual" ? (isDark ? '1px solid #92400e' : '1px solid #fbbf24') : 
                    resolveStatus === "error" ? (isDark ? '1px solid #991b1b' : '1px solid #fecaca') :
                    (isDark ? '1px solid #3b82f6' : '1px solid #93c5fd'),
                  whiteSpace: 'pre-line',
                  lineHeight: '1.6'
                }}>
                  <div>
                    {resolveStatus === "manual" ? "📝" : resolveStatus === "error" ? "❌" : "💡"} {resolveError}
                  </div>
                  {resolveStatus === "manual" && url.includes("/share/") && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${isDark ? '#92400e' : '#fbbf24'}` }}>
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          color: isDark ? '#fcd34d' : '#92400e',
                          textDecoration: 'underline',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        🔗 คลิกที่นี่เพื่อเปิดลิงก์อีกครั้ง
                      </a>
                    </div>
                  )}
                  {resolveStatus === "error" && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${isDark ? '#991b1b' : '#fecaca'}`, fontSize: '11px' }}>
                      <strong>💡 วิธีแก้:</strong>
                      <ul style={{ marginTop: '4px', marginBottom: 0, paddingLeft: '20px' }}>
                        <li>ลองใช้ปุ่ม <strong>"👤 แปลงด้วยตนเอง"</strong> แทน</li>
                        <li>หรือรันด้วย <code>netlify dev</code> เพื่อใช้ Auto-resolve</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Caption */}
            <div style={{ marginBottom: variant === "modal" ? '10px' : '16px' }}>
              <label style={labelStyle}>Caption (ไม่บังคับ)</label>
              <input
                style={inputStyle}
                placeholder="คำบรรยายใต้คลิป"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>

            <div className="fb-reels-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: variant === "modal" ? '10px' : '16px', marginBottom: variant === "modal" ? '10px' : '16px' }}>
              <div>
                <label style={labelStyle}>ความกว้าง (width)</label>
                <input
                  type="number"
                  min={120}
                  max={1200}
                  style={inputStyle}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value) || 0)}
                />
              </div>

              <div>
                <label style={labelStyle}>ความสูง (height)</label>
                <input
                  type="number"
                  min={120}
                  max={2000}
                  style={inputStyle}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value) || 0)}
                />
              </div>
            </div>


            <div style={{ display: 'flex', flexWrap: 'wrap', gap: variant === "modal" ? '10px' : '16px', marginBottom: variant === "modal" ? '0' : '16px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: mutedColor }}>
                <input type="checkbox" checked={italic} onChange={(e) => setItalic(e.target.checked)} />
                แคปชั่นตัวเอียง (Italic)
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: mutedColor }}>
                <input type="checkbox" checked={maxWidth100} onChange={(e) => setMaxWidth100(e.target.checked)} />
                iframe max-width: 100%
              </label>
            </div>

            {variant === "page" && (
              <>
                {/* Presets */}
                <div style={{ marginTop: '8px', borderTop: isDark ? '1px solid #334155' : '1px solid #e5e7eb', paddingTop: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: mutedColor, marginBottom: '8px' }}>Preset</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="ชื่อ Preset (เช่น Reels 9:16 Center)"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                    />
                    <button onClick={savePreset} style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                      fontSize: '14px'
                    }}>Save</button>
                  </div>
                  {presets.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {presets.map((p, i) => (
                        <button key={i} style={{
                          fontSize: '12px',
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          border: isDark ? '1px solid #475569' : '1px solid #d1d5db',
                          backgroundColor: 'transparent',
                          color: textColor,
                          cursor: 'pointer'
                        }} onClick={() => loadPreset(p)}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Examples */}
                <div style={{ marginTop: '8px', borderTop: isDark ? '1px solid #334155' : '1px solid #e5e7eb', paddingTop: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: mutedColor, marginBottom: '8px' }}>Examples</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex.href}
                        onClick={() => setUrl(ex.href)}
                        style={{
                          fontSize: '12px',
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          border: isDark ? '1px solid #475569' : '1px solid #d1d5db',
                          backgroundColor: 'transparent',
                          color: textColor,
                          cursor: 'pointer'
                        }}
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {variant === "page" && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={cardStyle}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: textColor }}>Preview</div>
                {!livePreview ? (
                  <div style={{
                    borderRadius: '8px',
                    backgroundColor: isDark ? '#1e293b' : '#f9fafb',
                    border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      borderRadius: '6px',
                      backgroundColor: isDark ? '#334155' : '#e5e7eb',
                      width: '100%',
                      maxWidth: '320px',
                      aspectRatio: '9 / 16'
                    }} />
                    {caption?.trim() && (
                      <div style={{
                        marginTop: '8px',
                        textAlign: 'center',
                        fontSize: '14px',
                        fontStyle: italic ? 'italic' : 'normal',
                        color: textColor
                      }}>{caption}</div>
                    )}
                    <div style={{ fontSize: '12px', color: mutedColor, marginTop: '8px' }}>
                      (Preview จำลอง – เปิด Live Preview เพื่อดู iframe จริง)
                    </div>
                  </div>
                ) : (
                  <div style={{
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: isDark ? '1px solid #334155' : '1px solid #e5e7eb'
                  }}>
                    <iframe
                      src={iframeSrc}
                      width={width}
                      height={height}
                      style={{ border: 'none', overflow: 'hidden', maxWidth: maxWidth100 ? '100%' : undefined }}
                      scrolling="no"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      allowFullScreen
                      title="Facebook Reels Preview"
                    />
                    {caption?.trim() && (
                      <div style={{
                        padding: '8px',
                        textAlign: 'center',
                        fontSize: '14px',
                        fontStyle: italic ? 'italic' : 'normal',
                        color: textColor
                      }}>{caption}</div>
                    )}
                  </div>
                )}
              </div>

              <TestPanel />
            </div>
          )}
        </div>

        {/* Output Area */}
        <div style={cardStyle}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            marginBottom: variant === "modal" ? '10px' : '16px'
          }}>
            <h2 style={{ fontSize: variant === "modal" ? '15px' : '18px', fontWeight: '600', margin: 0, color: textColor }}>โค้ดสำหรับ Gutenberg</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleCopyHtml} style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                fontSize: '14px'
              }}>Copy HTML</button>
              {variant === "page" && (
                <button onClick={handleCopyShort} style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#1e293b',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  fontSize: '14px'
                }}>Copy Shortcode</button>
              )}
            </div>
          </div>

          <div className={`fb-reels-output-cols ${variant === "modal" ? "modal-output" : ""}`} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: variant === "modal" ? '8px' : '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: mutedColor, marginBottom: '4px' }}>HTML</div>
              <textarea ref={outputRef} style={{
                width: '100%',
                height: variant === "modal" ? '110px' : '256px',
                fontFamily: 'monospace',
                fontSize: '11px',
                borderRadius: '8px',
                border: isDark ? '1px solid #475569' : '1px solid #d1d5db',
                padding: '8px',
                backgroundColor: isDark ? '#1e293b' : '#f9fafb',
                color: textColor,
                resize: 'vertical'
              }} readOnly value={htmlCode} />
              {copyStatus === "success" && (
                <div style={{ fontSize: '12px', color: isDark ? '#6ee7b7' : '#059669', marginTop: '4px' }}>คัดลอก HTML แล้ว ✓</div>
              )}
              {copyStatus === "manual" && (
                <div style={{ fontSize: '12px', color: isDark ? '#fcd34d' : '#d97706', marginTop: '4px' }}>
                  เบราว์เซอร์บล็อก Clipboard — กด Ctrl/Cmd+A แล้ว Ctrl/Cmd+C เพื่อคัดลอก
                </div>
              )}
            </div>

            {variant === "page" && (
              <div>
                <div style={{ fontSize: '12px', color: mutedColor, marginBottom: '4px' }}>Shortcode</div>
                <textarea ref={shortRef} style={{
                  width: '100%',
                  height: '256px',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #475569' : '1px solid #d1d5db',
                  padding: '12px',
                  backgroundColor: isDark ? '#1e293b' : '#f9fafb',
                  color: textColor,
                  resize: 'vertical'
                }} readOnly value={shortcode} />
                {copyShortStatus === "success" && (
                  <div style={{ fontSize: '12px', color: isDark ? '#6ee7b7' : '#059669', marginTop: '4px' }}>คัดลอก Shortcode แล้ว ✓</div>
                )}
                {copyShortStatus === "manual" && (
                  <div style={{ fontSize: '12px', color: isDark ? '#fcd34d' : '#d97706', marginTop: '4px' }}>
                    เบราว์เซอร์บล็อก Clipboard — กด Ctrl/Cmd+A แล้ว Ctrl/Cmd+C เพื่อคัดลอก
                  </div>
                )}
              </div>
            )}
          </div>

          {variant === "page" ? (
            <>
              <p style={{ fontSize: '14px', color: mutedColor, marginBottom: '8px' }}>
                วิธีใช้ HTML: คัดลอกทั้งหมด → ไปที่ WordPress Gutenberg → เพิ่มบล็อก <b style={{ color: textColor }}>HTML แบบกำหนดเอง</b> → วางโค้ด → บันทึก
              </p>
              <p style={{ fontSize: '14px', color: mutedColor, margin: 0 }}>
                วิธีใช้ Shortcode: วางในบล็อก <b style={{ color: textColor }}>Shortcode</b> หรือในเนื้อหา (ถ้ามีปลั๊กอินรองรับ) → วางโค้ด → บันทึก
              </p>
            </>
          ) : (
            <p style={{ fontSize: '13px', color: mutedColor, margin: 0 }}>
              คัดลอกโค้ด HTML → ไปที่ WordPress Gutenberg → เพิ่มบล็อก <b style={{ color: textColor }}>HTML แบบกำหนดเอง</b> → วางโค้ด → บันทึก
            </p>
          )}
        </div>
      </div>
    </div>
  );
}