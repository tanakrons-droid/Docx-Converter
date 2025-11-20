// ⚡️ Rebuilt logic – ป้องกัน nested <figure> 100%
export function convertYouTubeLinksToEmbed(html) {
  if (!html || typeof html !== "string") return html;

  const container = document.createElement("div");
  container.innerHTML = html;

  // 🧹 STEP 1: เอา figure.wp-block-embed เดิมออกทั้งหมด (ปล่อย contents แทน)
  container.querySelectorAll("figure.wp-block-embed").forEach((oldFig) => {
    const children = Array.from(oldFig.childNodes);
    oldFig.replaceWith(...children);
  });

  // 🧠 STEP 2: regex สำหรับ YouTube ทุกแบบ
  const YT_REGEX =
    /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=[\w-]+(?:[&?][^\s<"]*)?|shorts\/[\w-]+(?:[&?][^\s<"]*)?)|youtu\.be\/[\w-]+(?:[?&][^\s<"]*)?))/i;

  const escapeHtml = (str) => {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  };

  const nextElement = (node) => {
    let n = node?.nextSibling;
    while (n && n.nodeType === 3 && !n.textContent.trim()) n = n.nextSibling;
    return n && n.nodeType === 1 ? n : null;
  };

  // Extract URL + Caption
  const extractUrl = (el) => {
    if (!el) return null;
    const a = el.querySelector('a[href*="youtu"]');
    if (a && YT_REGEX.test(a.href)) return a.href.trim();
    const text = (el.textContent || "").trim();
    const m = text.match(YT_REGEX);
    return m ? m[1] : null;
  };

  const extractCaptionAndConsume = (el) => {
    // caption ในบรรทัดเดียว
    const brCap = el.innerHTML.match(/<br\s*\/?>\s*(?:<em>|<i>)([\s\S]*?)(?:<\/em>|<\/i>)/i);
    if (brCap && brCap[1]?.trim()) {
      el.innerHTML = el.innerHTML.replace(/<br\s*\/?>\s*(?:<em>|<i>)[\s\S]*?(?:<\/em>|<\/i>)/i, "");
      return brCap[1].trim();
    }
    // caption element ถัดไป
    const nx = nextElement(el);
    if (nx) {
      const em = nx.querySelector("em, i");
      if (em && em.textContent.trim()) {
        const cap = em.textContent.trim();
        nx.remove();
        return cap;
      }
      const txt = (nx.textContent || "").trim();
      const looksUrl = /(https?:\/\/|youtu\.be|youtube\.com)/i.test(txt);
      if (txt && !looksUrl && txt.length >= 3 && txt.length <= 180) {
        nx.remove();
        return txt;
      }
    }
    return "";
  };

  // 🔍 STEP 3: หา candidates ที่มี YouTube
  const candidates = Array.from(container.querySelectorAll("p, div, li"));

  candidates.forEach((el) => {
    const url = extractUrl(el);
    if (!url) return;

    const caption = extractCaptionAndConsume(el);

    // ✅ STEP 4: สร้าง block ใหม่ (ไม่มี nested figure)
    const blockStart = `<!-- wp:embed {"url":"${url}","type":"video","providerNameSlug":"youtube","responsive":true,"className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} -->`;
    const blockEnd = `<!-- /wp:embed -->`;

    const figureHTML = `<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio">
  <div class="wp-block-embed__wrapper">${escapeHtml(url)}</div>${caption
      ? `
  <figcaption class="wp-element-caption"><em>${escapeHtml(caption)}</em></figcaption>`
      : ""}
</figure>`;

    el.outerHTML = `${blockStart}\n${figureHTML}\n${blockEnd}`;
  });

  // 🧹 STEP 5: เคลียร์ figure ซ้อนที่อาจเหลือ (backup)
  container.querySelectorAll("figure.wp-block-embed figure.wp-block-embed").forEach((inner) => {
    const outer = inner.parentElement.closest("figure.wp-block-embed");
    if (!outer || outer === inner) return;
    const kids = Array.from(inner.childNodes);
    kids.forEach((n) => outer.appendChild(n));
    inner.remove();
  });

  // 🧹 STEP 6: ลบ figure เปล่าที่ไม่มี wrapper
  container.querySelectorAll("figure.wp-block-embed").forEach((fig) => {
    if (!fig.querySelector(".wp-block-embed__wrapper")) fig.remove();
  });

  return container.innerHTML;
}

export const convertYouTubeLinksToWPEmbedWithCaption = convertYouTubeLinksToEmbed;
