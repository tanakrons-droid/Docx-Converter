import React, { useMemo, useState } from "react";
import FbReelsGenerator from "./FbReelsGenerator";

export default function FbReelsModal({ open, onClose }) {
  if (!open) return null;

  return (
    <>
      <div 
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          zIndex: 9998,
          animation: "fadeIn 0.2s ease-out"
        }}
      />
      
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "#1e293b",
          borderRadius: 16,
          padding: 18,
          maxWidth: "90vw",
          maxHeight: "90vh",
          width: 900,
          overflowY: "auto",
          zIndex: 9999,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          color: "#e2e8f0",
          animation: "slideUp 0.3s ease-out"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" }}>
            Facebook Reels Generator
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 28,
              color: "#94a3b8",
              cursor: "pointer",
              padding: 0,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#334155";
              e.target.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "transparent";
              e.target.style.color = "#94a3b8";
            }}
          >
            ×
          </button>
        </div>

        <FbReelsGenerator variant="modal" />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translate(-50%, -48%);
          }
          to { 
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
}

// eslint-disable-next-line no-unused-vars
function FbReelsGeneratorOld() {
  const [input, setInput] = useState("");
  const [autoClean, setAutoClean] = useState(true);
  const [width, setWidth] = useState(267);
  const [height, setHeight] = useState(476);

  const cleanedUrl = useMemo(() => {
    const url = extractUrl(input.trim());
    return autoClean ? cleanFacebookUrl(url) : url;
  }, [input, autoClean]);

  const embedHtml = useMemo(() => {
    if (!isFacebookUrl(cleanedUrl)) return "";
    const w = clampInt(width, 100, 1200);
    const h = clampInt(height, 100, 2000);
    return buildFacebookEmbed(cleanedUrl, { width: w, height: h });
  }, [cleanedUrl, width, height]);

  const onCopy = async () => {
    if (!embedHtml) return;
    const ok = await safeCopyToClipboard(embedHtml);
    if (!ok) {
      try {
        // Fallback to prompt for manual copy
        window.prompt("Copy the code below:", embedHtml);
      } catch {}
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <label style={{ fontWeight: 600 }}>Reel URL หรือโค้ด embed</label>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="วางลิงก์ Reel หรือโค้ด <iframe> ที่ได้จาก Facebook"
        rows={3}
        style={{ width: "100%", padding: 12, borderRadius: 8, background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155" }}
      />

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={autoClean} onChange={(e) => setAutoClean(e.target.checked)} />
          Auto Clean Reel Link
        </label>

        <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          Width
          <input
            type="number"
            min={100}
            max={1200}
            value={width}
            onChange={(e) => setWidth(parseInt(e.target.value || "0", 10))}
            style={{ width: 90, padding: 6, borderRadius: 6, background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155" }}
          />
        </label>

        <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          Height
          <input
            type="number"
            min={100}
            max={2000}
            value={height}
            onChange={(e) => setHeight(parseInt(e.target.value || "0", 10))}
            style={{ width: 90, padding: 6, borderRadius: 6, background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155" }}
          />
        </label>
      </div>

      <Section title="Preview (เรนเดอร์จริง)">
        {!embedHtml ? (
          <div style={{ color: "#94a3b8" }}>วางลิงก์ Reel หรือโค้ด embed เพื่อดูพรีวิว</div>
        ) : (
          // IMPORTANT: raw HTML, no entity encoding here.
          <div dangerouslySetInnerHTML={{ __html: embedHtml }} />
        )}
      </Section>

      <Section title="โค้ดสำหรับคัดลอก (ไม่เรนเดอร์)">
        {!embedHtml ? (
          <div style={{ color: "#94a3b8" }}>ยังไม่มีโค้ด</div>
        ) : (
          <>
            {/* React will escape for display automatically; value remains raw when copied via clipboard */}
            <textarea
              readOnly
              value={embedHtml}
              rows={8}
              style={{ width: "100%", padding: 12, borderRadius: 8, background: "#0b1220", color: "#e2e8f0", border: "1px solid #334155", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onCopy} style={btnStyle}>คัดลอกโค้ด</button>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

const btnStyle = {
  borderRadius: 8,
  padding: "8px 14px",
  background: "#2563eb",
  border: "1px solid #1d4ed8",
  color: "white",
  cursor: "pointer"
};

/* ---------------------------------- utils --------------------------------- */

function clampInt(n, min, max) {
  n = Number.isFinite(n) ? n : parseInt(n || "0", 10);
  if (!Number.isFinite(n)) n = min;
  return Math.max(min, Math.min(max, n));
}

async function safeCopyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      alert("Copied!");
      return true;
    }
  } catch {}
  try {
    // Fallback: create a hidden textarea and execCommand
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) alert("Copied!");
    return ok;
  } catch {
    return false;
  }
}

function extractUrl(text) {
  if (!text) return "";
  // If it's an <iframe> snippet, try to pull src="..."
  const m = text.match(/src\s*=\s*"(.*?)"/i) || text.match(/src\s*=\s*'(.*?)'/i);
  if (m) return m[1];
  // Otherwise try to grab the first http(s) URL
  const u = text.match(/https?:\/\/[^\s"']+/);
  return u ? u[0] : text;
}

function isFacebookUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const protocolOk = u.protocol === "https:" || u.protocol === "http:";
    const hostOk = /(^|\.)facebook\.com$/i.test(u.hostname);
    return protocolOk && hostOk;
  } catch {
    return false;
  }
}

function cleanFacebookUrl(url) {
  if (!isFacebookUrl(url)) return url;
  try {
    const u = new URL(url);
    // Normalize mobile to www
    if (u.hostname.startsWith("m.")) u.hostname = "www." + u.hostname.slice(2);
    if (!u.hostname.startsWith("www.")) u.hostname = "www." + u.hostname;
    // Allow only "t" query param (start time)
    const keep = new URLSearchParams();
    if (u.searchParams.has("t")) keep.set("t", u.searchParams.get("t") || "0");
    const clean = `${u.origin}${u.pathname}${keep.toString() ? "?" + keep.toString() : ""}`;
    return clean;
  } catch {
    return url;
  }
}

function buildFacebookEmbed(reelUrl, { width = 267, height = 476 } = {}) {
  // IMPORTANT: Do NOT HTML-encode the full string.
  const encodedHref = encodeURIComponent(reelUrl);
  const src = `https://www.facebook.com/plugins/video.php?height=${height}&href=${encodedHref}&show_text=false&width=${width}&t=0`;
  return `<iframe src="${src}" width="${width}" height="${height}" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true"></iframe>`;
}

/* ------------------------------- UI helpers ------------------------------- */
function Section({ title, children }) {
  return (
    <div style={{ border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ background: "#0b1220", padding: "10px 12px", fontWeight: 700 }}>{title}</div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}
