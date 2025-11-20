// เพิ่ม class="headtext" ให้กับส่วนหัวข้อหรือย่อหน้าที่เป็นคำถามในส่วน Q&A
// ตรวจจับช่วงระหว่าง h2 ที่มี "Q&A" จนถึง h2 ที่มี "สรุป" หรือ "Summary"
// รองรับการเพิ่ม class ให้กับ h3, p, และ strong ที่เป็นคำถาม

export function addQAHeadingClass(html) {
  if (!html || typeof html !== 'string') return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  // Find all <h2> elements
  const h2Elements = Array.from(container.querySelectorAll('h2'));
  
  let inQASection = false;
  let currentElement = null;

  // Helper: Check if h2 text contains Q&A patterns (รองรับ "Q&A", "Q & A", "QnA", "คำถามที่พบบ่อย")
  const isQAHeading = (text) => {
    return /Q\s*&?\s*A|QnA|Q\s*และ\s*A|คำถาม.*ที่.*พบ.*บ่อย/i.test(text);
  };

  // Helper: Check if h2 text contains "สรุป" or "Summary"
  const isSummaryHeading = (text) => {
    return /สรุป|Summary/i.test(text);
  };

  // Helper: Check if element contains question patterns
  const isQuestionElement = (element) => {
    const text = element.textContent.trim();
    
    // Check for h3 with question marks
    if (element.tagName === 'H3') {
      return /[?？]/.test(text);
    }
    
    // Check for p or strong with Q patterns and ending with question mark
    if (element.tagName === 'P' || element.tagName === 'STRONG') {
      // รูปแบบ Q. Q: Q – Q (space) และลงท้ายด้วย ?
      const qPattern = /^Q\s*[.:\-–]?\s*.*[?？]\s*$/i;
      return qPattern.test(text);
    }
    
    return false;
  };

  // Helper: Check if element contains strong with question pattern
  const hasQuestionInStrong = (element) => {
    if (element.tagName === 'P') {
      const strongElements = element.querySelectorAll('strong');
      return Array.from(strongElements).some(strong => {
        const text = strong.textContent.trim();
        const qPattern = /^Q\s*[.:\-–]?\s*.*[?？]\s*$/i;
        return qPattern.test(text);
      });
    }
    return false;
  };

  // Helper: Add class to element
  const addHeadtextClass = (element) => {
    const existingClass = element.getAttribute('class');
    if (existingClass) {
      // Append headtext if not already present
      if (!existingClass.includes('headtext')) {
        element.setAttribute('class', existingClass + ' headtext');
      }
    } else {
      element.setAttribute('class', 'headtext');
    }
  };

  // Process each h2 to find Q&A sections
  h2Elements.forEach((h2, index) => {
    const h2Text = h2.textContent.trim();

    // Check if this is the start of a Q&A section
    if (isQAHeading(h2Text)) {
      inQASection = true;
      currentElement = h2.nextElementSibling;

      // Process all elements until next h2 or end of section
      while (currentElement) {
        // Check if we've reached the summary h2 or another h2
        if (currentElement.tagName === 'H2') {
          const nextH2Text = currentElement.textContent.trim();
          if (isSummaryHeading(nextH2Text)) {
            inQASection = false;
            break;
          }
          // If it's another h2 but not summary, stop processing
          break;
        }

        // Process elements in Q&A section
        if (inQASection) {
          // Check h3 elements with question marks
          if (currentElement.tagName === 'H3' && isQuestionElement(currentElement)) {
            addHeadtextClass(currentElement);
          }
          
          // Check p elements that start with Q patterns and end with ?
          else if (currentElement.tagName === 'P') {
            if (isQuestionElement(currentElement) || hasQuestionInStrong(currentElement)) {
              addHeadtextClass(currentElement);
            }
          }
          
          // Check strong elements that start with Q patterns and end with ?
          else if (currentElement.tagName === 'STRONG' && isQuestionElement(currentElement)) {
            addHeadtextClass(currentElement);
          }
        }

        currentElement = currentElement.nextElementSibling;
      }
    }
  });

  return container.innerHTML;
}
