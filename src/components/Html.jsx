import React, { useState } from 'react';
import mammoth from 'mammoth';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileArrowUp, faFileImport, faCopy, faCircleNotch, faCheck } from '@fortawesome/free-solid-svg-icons';


function Html() {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleFileChange = (event) => {
    const fileTarget = event.target.files[0];
    const fileLabel = document.querySelector('.upload-file-label');
    if (fileTarget) {
      setFile(fileTarget);
      fileLabel.textContent = fileTarget.name;
    } else {
      setFile(null);
      fileLabel.textContent = 'Please select .docx file';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(htmlContent).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1000);
    });
  };

  // ล้างฟอร์แมตแปลกๆ อัตโนมัติ เช่น span, font, style ที่มาจาก Word หรือ Docs
  const cleanHTML = (html) => {
    // ลบ <span> tags ทั้งหมด (เก็บเฉพาะเนื้อหาภายใน)
    html = html.replace(/<span[^>]*>/gi, '');
    html = html.replace(/<\/span>/gi, '');
    
    // ลบ <font> tags ทั้งหมด (เก็บเฉพาะเนื้อหาภายใน)
    html = html.replace(/<font[^>]*>/gi, '');
    html = html.replace(/<\/font>/gi, '');
    
    // ลบ inline style attributes ที่มาจาก Word/Docs
    // ลบ style ที่มี mso- prefix (Microsoft Office styles)
    html = html.replace(/\s*style="[^"]*mso-[^"]*"/gi, '');
    
    // ลบ style attributes ที่มีคุณสมบัติที่ไม่ต้องการจาก Word/Docs
    html = html.replace(/\s*style="[^"]*font-family:\s*['"]?Times New Roman['"]?[^"]*"/gi, '');
    html = html.replace(/\s*style="[^"]*font-family:\s*['"]?Calibri['"]?[^"]*"/gi, '');
    html = html.replace(/\s*style="[^"]*font-family:\s*['"]?Arial['"]?[^"]*"/gi, '');
    
    // ลบ style ที่มี background-color: white หรือ background: white
    html = html.replace(/\s*style="[^"]*background(?:-color)?:\s*(?:white|#ffffff|rgb\(255,\s*255,\s*255\))[^"]*"/gi, '');
    
    // ลบ style ที่มี font-size จาก Word
    html = html.replace(/\s*style="[^"]*font-size:\s*\d+(?:\.\d+)?(?:pt|px)[^"]*"/gi, '');
    
    // ลบ empty attributes และ whitespace ที่ไม่จำเป็น
    html = html.replace(/\s+class=""/gi, '');
    html = html.replace(/\s+id=""/gi, '');
    html = html.replace(/\s+style=""/gi, '');
    
    // ลบ attributes ที่ไม่จำเป็นจาก Word/Docs
    html = html.replace(/\s+lang="[^"]*"/gi, '');
    html = html.replace(/\s+xml:lang="[^"]*"/gi, '');
    
    // ลบ <p> tags ที่ wrap HTML comments
    html = html.replace(/<p>\s*(<!--[^>]*-->)\s*<\/p>/gi, '$1');
    
    // ลบ empty tags ที่อาจเกิดจากการลบ span/font
    html = html.replace(/<p>\s*<\/p>/gi, '');
    html = html.replace(/<li>\s*<\/li>/gi, '');
    
    return html;
  };

  const handleConvert = async () => {
    // ตรวจสอบว่าไฟล์ถูกเลือกแล้วหรือยัง
    if (!file) {
      alert('กรุณาเลือกไฟล์ DOCX ก่อนประมวลผล');
      return;
    }
    
    // ตรวจสอบประเภทไฟล์
    if (!file.name.toLowerCase().endsWith('.docx')) {
      alert('กรุณาเลือกไฟล์ประเภท DOCX เท่านั้น');
      return;
    }
    
    // ตรวจสอบขนาดไฟล์ (จำกัดที่ 100MB)
    if (file.size > 100 * 1024 * 1024) {
      alert('ขนาดไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 100MB');
      return;
    }
    
    // แสดงคำเตือนสำหรับไฟล์ขนาดใหญ่
    if (file.size > 50 * 1024 * 1024) {
      const confirmLargeFile = window.confirm(`ไฟล์ที่เลือกมีขนาด ${(file.size / (1024 * 1024)).toFixed(1)}MB ซึ่งค่อนข้างใหญ่ การประมวลผลอาจใช้เวลานาน คุณต้องการดำเนินการต่อหรือไม่?`);
      if (!confirmLargeFile) {
        return;
      }
    }
    
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target.result;
      try {
        const result = await mammoth.convertToHtml({ arrayBuffer });
        let htmlString = result.value;

        // Parse the HTML string to a DOM object
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        console.log(doc);

        // Remove all content before the <p><strong>THE ARTICLE</strong></p> tag
        let articleStart = null;
        // doc.querySelectorAll('p').forEach(p => {
        //   if (p.innerHTML === '<strong>THE ARTICLE</strong>') {
        //     articleStart = p;
        //   }
        // });
        // Remove all content before the <h1></h1> tag
        [...doc.querySelectorAll('h1')].some(h1 => {
          articleStart = h1;
          return true;
        });

        if (articleStart) {
          let previousSibling = articleStart.previousSibling;
          while (previousSibling) {
            const temp = previousSibling.previousSibling;
            previousSibling.remove();
            previousSibling = temp;
          }
          articleStart.remove(); // Remove the <h1></h1> itself
        }

        // Remove all content after the <p><strong>NOTE SEO Writer</strong></p> tag
        let noteSEOStart = null;
        doc.querySelectorAll('p').forEach(p => {
          const text = p.textContent.toLowerCase().trim();
          if (text === 'note seo writer') {
            noteSEOStart = p;
          }
        });

        if (noteSEOStart) {
          let nextSibling = noteSEOStart.nextSibling;
          while (nextSibling) {
            const temp = nextSibling.nextSibling;
            nextSibling.remove();
            nextSibling = temp;
          }
          noteSEOStart.remove(); // Remove the <p><strong>NOTE SEO Writer</strong></p> itself
        }

        // Find all <p> tags and modify them based on their content and child elements
        doc.querySelectorAll('p').forEach(p => {
          const tagImg = p.querySelectorAll('img');
          let textContent = p.textContent.trim();

          if ((!textContent && tagImg.length === 0) || textContent.startsWith('alt') || textContent.startsWith('Alt') || textContent.startsWith('ALT')) {
            p.remove();
          } else if (tagImg.length > 0) {
            if (tagImg.length > 1) {
              const newImgItems = Array.from(tagImg).map(img => {
                return `<p style="text-align: center;"><img src="#" alt="" style="width: 100%; height: auto;" /></p>`;
              }).join('');
              p.outerHTML = newImgItems;
            } else {
              p.outerHTML = `<p style="text-align: center;"><img src="#" alt="" style="width: 100%; height: auto;" /></p>`;
            }
          } else {
            p.outerHTML = `<p>${p.innerHTML}</p>`;
          }
        });

        // Remove <a> tags within headings
        doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
          heading.querySelectorAll('a').forEach(a => {
            const parent = a.parentNode;
            while (a.firstChild) parent.insertBefore(a.firstChild, a);
            parent.removeChild(a);
          });
        });

        // Convert heading tags to Gutenberg format
        doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
          const level = heading.tagName.toLowerCase();
          const levelNumber = level.match(/\d+/)[0];
          const headingContent = heading.innerHTML;
          const headingText = headingContent.replace(new RegExp(level, 'g'), '').replace('header tag ' + levelNumber, '').replace('header tag' + levelNumber, '').replace('Header Tag ' + levelNumber, '').replace('Header Tag' + levelNumber, '').replace('header ' + levelNumber, '').replace('header' + levelNumber, '').replace('Header ' + levelNumber, '').replace('Header' + levelNumber, '').replace('H' + levelNumber, '').replace('1st', '').replace(':', '').trim();
          const tagImg = heading.querySelector('img');
          const textOnly = headingText.replace(/<\/?[^>]+(>|$)/g, '');

          let gutenbergHeading = '';

          if (textOnly && tagImg) {
            gutenbergHeading = `<${level} style="color: #5ba2ff;">${textOnly}</${level}><p style="text-align: center;"><img src="#" alt="" style="width: 100%; height: auto;" /></p>`;
          } else if (tagImg ) {
            gutenbergHeading = `<p style="text-align: center;"><img src="#" alt="" style="width: 100%; height: auto;" /></p>`;
          } else {
            gutenbergHeading = `<${level} style="color: #5ba2ff;">${headingText}</${level}>`;
          }

          if (!tagImg && (heading.textContent.startsWith('สรุป') || level === 'h2')) {
            gutenbergHeading = '<hr />' + gutenbergHeading;
          }

          heading.outerHTML = gutenbergHeading;
        });

        function convertSubListToGutenberg(ul, tag) {
          const newListItems = Array.from(ul.querySelectorAll('li')).map(li => {
            return `<li>${li.innerHTML}</li>`;
          }).join('');
          return `<${tag}>${newListItems}</${tag}>`;
        }

        function convertListToGutenberg(ul, tag) {
          const listItems = Array.from(ul.children).map(li => {
            const nestedUl = li.querySelector('ul');
            if (nestedUl) {
              const listSubItems = convertSubListToGutenberg(nestedUl, tag);
              nestedUl.remove();
              return `<li>${li.innerHTML}${listSubItems}</li>`;
            }
            return `<li>${li.innerHTML}</li>`;
          }).join('');
          return `<${tag}>${listItems}</${tag}>`;
        }

        function convertSubListToMenu(ul, tag) {
          const newListItems = Array.from(ul.querySelectorAll('li')).map(li => {
            const liText = li.textContent.replace(/H2|H3|h2|h3|Header Tag 2|Header Tag 3|Header Tag2|Header Tag3|header tag 2|header tag 3|header tag2|header tag3|:/g, '').trim();
            return `<li>${liText}</li>`;
          }).join('');
          return `<${tag}>${newListItems}</${tag}>`;
        }

        function convertListToMenu(ul, tag) {
          const listItems = Array.from(ul.children).map(li => {
            const liText = li.textContent.replace(/H2|H3|h2|h3|Header Tag 2|Header Tag 3|Header Tag2|Header Tag3|header tag 2|header tag 3|header tag2|header tag3|:/g, '').trim();
            const nestedUl = li.querySelector('ul');
            if (nestedUl) {
              const listSubItems = convertSubListToMenu(nestedUl, tag);
              nestedUl.remove();
              const liSubText = li.textContent.replace(/H2|H3|h2|h3|Header Tag 2|Header Tag 3|Header Tag2|Header Tag3|header tag 2|header tag 3|header tag2|header tag3|:/g, '').trim();
              return `<li>${liSubText}${listSubItems}</li>`;
            }
            return `<li>${liText}</li>`;
          }).join('');
          return `<${tag}>${listItems}</${tag}>`;
        }

        // Convert all <ul> and <ol> elements with a combined counter to add class to the first found
        let firstListProcessed = false;
        doc.querySelectorAll('ul, ol').forEach((list, index) => {
          let listHTML = '';
          const tag = list.tagName.toLowerCase();
          if (!firstListProcessed) {
            listHTML = convertListToMenu(list, tag);
            firstListProcessed = true;
          } else {
            listHTML = convertListToGutenberg(list, tag);
          }
          list.innerHTML = listHTML;
          const parentList = list.closest(tag);
          if (parentList) {
            parentList.replaceWith(...parentList.childNodes);
          }
        });

        function convertTableToGutenberg(table) {
          const rows = Array.from(table.querySelectorAll('tr'));
          
          // สร้าง header cells พร้อม class และ data-align สำหรับจัดกลาง
          const headerCells = Array.from(rows.shift().querySelectorAll('th')).map(cell => {
            const cellContent = cell.innerHTML.trim(); // ใช้ innerHTML แทน textContent เพื่อคงการ format
            const existingClass = cell.getAttribute('class') || '';
            const classList = existingClass.split(' ').filter(c => c && !c.includes('has-text-align'));
            classList.push('has-text-align-center');
            const classAttr = classList.join(' ').trim() ? ` class="${classList.join(' ').trim()}"` : '';
            
            return `<th${classAttr} data-align="center">${cellContent}</th>`;
          }).join('');
          
          const thead = `<thead><tr>${headerCells}</tr></thead>`;
        
          // สร้าง body rows พร้อม class และ data-align สำหรับจัดซ้าย
          const bodyRows = rows.map(tr => {
            const cells = Array.from(tr.querySelectorAll('th, td')).map(cell => {
              const cellTag = 'td';
              const cellContent = cell.innerHTML.trim(); // ใช้ innerHTML แทน textContent เพื่อคงการ format
              const existingClass = cell.getAttribute('class') || '';
              const classList = existingClass.split(' ').filter(c => c && !c.includes('has-text-align'));
              classList.push('has-text-align-left');
              const classAttr = classList.join(' ').trim() ? ` class="${classList.join(' ').trim()}"` : '';
              
              return `<${cellTag}${classAttr} data-align="left">${cellContent}</${cellTag}>`;
            }).join('');
            return `<tr>${cells}</tr>`;
          }).join('');
          
          let tbody = '';
          if(bodyRows) {
            tbody = `<tbody>${bodyRows}</tbody>`;
          }
        
          return `<table>${thead}${tbody}</table>`;
        }

        // Convert all <table> elements
        doc.querySelectorAll('table').forEach(table => {
          const tableHTML = convertTableToGutenberg(table);
          table.outerHTML = tableHTML;
        });

        // Serialize the DOM back to a string
        htmlString = new XMLSerializer().serializeToString(doc);

        // Remove the <html>, <head>, and <body> tags from the string
        htmlString = htmlString.replace(/<html[^>]*>/, '').replace('</html>', '');
        htmlString = htmlString.replace('<head></head>', '');
        htmlString = htmlString.replace(/<body[^>]*>/, '').replace('</body>', '');

        // Remove extra spaces or tabs to ensure only one space between words
        htmlString = htmlString.replace(/\s+/g, ' ');

        htmlString = htmlString.replace(/\/>/g, '/>\n');
        htmlString = htmlString.replace(/<p/g, '\n<p');
        htmlString = htmlString.replace(/<\/p>/g, '</p>\n');
        htmlString = htmlString.replace(/<h1/g, '\n<h1');
        htmlString = htmlString.replace(/<\/h1>/g, '</h1>\n');
        htmlString = htmlString.replace(/<h2/g, '\n<h2');
        htmlString = htmlString.replace(/<\/h2>/g, '</h2>\n');
        htmlString = htmlString.replace(/<h3/g, '\n<h3');
        htmlString = htmlString.replace(/<\/h3>/g, '</h3>\n');
        htmlString = htmlString.replace(/<h4/g, '\n<h4');
        htmlString = htmlString.replace(/<\/h4>/g, '</h4>\n');
        htmlString = htmlString.replace(/<h5/g, '\n<h5');
        htmlString = htmlString.replace(/<\/h5>/g, '</h5>\n');
        htmlString = htmlString.replace(/<h6/g, '\n<h6');
        htmlString = htmlString.replace(/<\/h6>/g, '</h6>\n');
        htmlString = htmlString.replace(/<ul>/g, '\n<ul>\n');
        htmlString = htmlString.replace(/<\/ul>/g, '</ul>\n');
        htmlString = htmlString.replace(/<\/li>/g, '</li>\n');
        htmlString = htmlString.replace(/<hr \/>/g, '\n<hr />');
        htmlString = htmlString.replace(/𝗖𝗼𝗼𝗹 𝗬𝗮𝗴 𝟭𝟬𝟲𝟰/g, 'Cool Yag 1064');

        // ล้างฟอร์แมตแปลกๆ อัตโนมัติก่อนแสดงผล (Clear Unknown Formatting)
        htmlString = cleanHTML(htmlString);

        setHtmlContent(htmlString.trim());
      } catch (error) {
        console.error('Conversion error:', error);
        
        // แสดงข้อความข้อผิดพลาดที่เข้าใจง่าย
        let errorMessage = 'เกิดข้อผิดพลาดในการแปลงไฟล์';
        
        if (error.message.includes('Invalid file format')) {
          errorMessage = 'รูปแบบไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ DOCX ที่ถูกต้อง';
        } else if (error.message.includes('File too large')) {
          errorMessage = 'ไฟล์มีขนาดใหญ่เกินไป กรุณาเลือกไฟล์ที่มีขนาดเล็กกว่า';
        } else if (error.message.includes('Corrupted file')) {
          errorMessage = 'ไฟล์เสียหาย กรุณาเลือกไฟล์ที่สมบูรณ์';
        } else if (error.message.includes('Unsupported format')) {
          errorMessage = 'รูปแบบไฟล์ไม่รองรับ กรุณาเลือกไฟล์ DOCX ที่สร้างจาก Microsoft Word';
        }
        
        alert(errorMessage);
        setHtmlContent('');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <HelmetProvider>
      <Helmet>
        <title>Docx to HTML Code App</title>
        <meta name="description" content="Docx to HTML Code App" />
      </Helmet>
      <div className="container">
        <div className="site-content">
          <div className="col-left">
            <div className="space-left">
              <h1>Docx to <span>HTML</span> Converter</h1>
              <div className="upload-file">
                <input type="file" accept=".docx" onChange={handleFileChange} />
                <div className={`upload-file-btn ${file ? 'active' : ''}`}>
                  <div className="upload-file-icon">
                    <FontAwesomeIcon icon={faFileArrowUp} />
                  </div>
                  <div className="upload-file-detail">
                    <span className="upload-file-label"><strong>Click to upload</strong> or drag and drop<br />DOCX are Allowed.</span>
                  </div>
                </div>
              </div>
              {isLoading ? (
                <button className="submit-btn loading" onClick={handleConvert}>
                  LOADING...
                  <FontAwesomeIcon icon={faCircleNotch} spin />
                </button>
              ) : (
                <button className={`submit-btn ${file ? '' : 'disable'}`} onClick={handleConvert}>
                  CONVERT
                  <FontAwesomeIcon icon={faFileImport} />
                </button>
              )}
              <div className="upload-desc">
                <p>for websites :</p>
                <ul>
                  <li>bloggang.com</li>
                  <li>keedkean.com</li>
                  <li>board.postjung.com</li>
                  <li>vanilla.in.th</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="col-right">
            <div className="space-right">
              <div className="code-content">
                {/* Header Bar */}
                <div className="code-header">
                  <div className="code-header-left">
                    <div className="code-dots">
                      <span className="dot dot-red"></span>
                      <span className="dot dot-yellow"></span>
                      <span className="dot dot-green"></span>
                    </div>
                    <span className="code-title">Output Code</span>
                  </div>
                  <div className="code-header-right">
                    <span className="code-language">HTML</span>
                    <span className="code-lines">{htmlContent ? htmlContent.split('\n').length : 0} lines</span>
                    <button 
                      onClick={handleCopy} 
                      className={`copy-btn-header ${isCopied ? 'copied' : ''}`}
                      disabled={!htmlContent}
                      title={!htmlContent ? 'No content to copy' : 'Copy to clipboard'}
                    >
                      <FontAwesomeIcon icon={isCopied ? faCheck : faCopy} />
                      <span className="copy-btn-text">
                        {isCopied ? 'Copied!' : 'Copy'}
                      </span>
                    </button>
                  </div>
                </div>
                
                {/* Code Content */}
                <div className="code-wrapper">
                  <SyntaxHighlighter language="javascript" style={vscDarkPlus} className="syntax-highlighter" showLineNumbers>
                    {htmlContent}
                  </SyntaxHighlighter>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </HelmetProvider>
  );
}

export default Html;