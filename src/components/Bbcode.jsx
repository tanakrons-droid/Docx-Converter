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
        doc.querySelectorAll('p').forEach(p => {
          if (p.innerHTML === '<strong>THE ARTICLE</strong>') {
            articleStart = p;
          }
        });

        if (articleStart) {
          let previousSibling = articleStart.previousSibling;
          while (previousSibling) {
            const temp = previousSibling.previousSibling;
            previousSibling.remove();
            previousSibling = temp;
          }
          articleStart.remove(); // Remove the <p><strong>THE ARTICLE</strong></p> itself
        }

        // Remove all content after the <p><strong>NOTE SEO Writer</strong></p> tag
        let noteSEOStart = null;
        doc.querySelectorAll('p').forEach(p => {
          if (p.innerHTML === '<strong>NOTE SEO Writer</strong>' || p.innerHTML === '<strong>NOTE SEO Writer </strong>') {
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

        // Find all <p> tags and modify <a> tags them based on their content and child elements
        doc.querySelectorAll('p').forEach(p => {
          let textContent = p.textContent.trim();
          p.querySelectorAll('a').forEach(a => {
            if (textContent.startsWith('สารบัญ') || textContent.startsWith('คลิกอ่านหัวข้อ')) {
              const text = a.textContent;
              const bbcode = text;
              a.outerHTML = bbcode;
            } else {
              const href = a.getAttribute('href');
              const text = a.textContent;
              const bbcode = `[url=${href}]${text}[/url]`;
              a.outerHTML = bbcode;
            }
          });
        });

        // Find all <p> tags and modify them based on their content and child elements
        doc.querySelectorAll('p').forEach(p => {
          const tagImg = p.querySelectorAll('img');
          let textContent = p.textContent.trim();

          if ((!textContent && tagImg.length === 0) || textContent.startsWith('alt') || textContent.startsWith('Alt') || textContent.startsWith('ALT')) {
            p.remove();
          } else if (tagImg.length > 0) {
            if (tagImg.length > 1) {
              const newImgItems = Array.from(tagImg).map(img => {
                return `[center][img][/img][/center]<br /><br />`;
              }).join('');
              p.outerHTML = newImgItems;
            } else {
              p.outerHTML = `[center][img][/img][/center]<br /><br />`;
            }
          } else if (textContent.startsWith('สรุป')) { 
            p.outerHTML = `[hr]<br /><br />[size=3][b][color=navy]${textContent}[/color][/b][/size]<br /><br />`;
          } else {
            p.outerHTML = `${p.innerHTML}<br /><br />`;
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
            gutenbergHeading = `[hr]<br /><br />[size=3][b][color=navy]${textOnly}[/color][/b][/size]<br /><br />[center][img][/img][/center]<br /><br />`;
          } else if (tagImg ) {
            gutenbergHeading = `[center][img][/img][/center]<br /><br />`;
          } else if (headingText.startsWith('สรุป')) { 
            gutenbergHeading = `[hr]<br /><br />[size=3][b][color=navy]${headingText}[/color][/b][/size]<br /><br />`;
          } else {
            gutenbergHeading = `[hr]<br /><br />[size=3][b][color=navy]${headingText}[/color][/b][/size]<br /><br />`;
          }

          heading.outerHTML = gutenbergHeading;
        });

        function convertSubListToGutenberg(ul, tag) {
          let tagComment = '<br />[list]<br />';
          if(tag === 'ol') {
            tagComment = '<br />[list type=decimal]<br />';
          }
          const newListItems = Array.from(ul.querySelectorAll('li')).map(li => {
            return `[li]${li.innerHTML}[/li]<br />`;
          }).join('');
          return `${tagComment}${newListItems}[/list]<br />`;
        }

        function convertListToGutenberg(ul, tag) {
          let tagComment = '[list]<br />';
          if(tag === 'ol') {
            tagComment = '[list type=decimal]<br />';
          }
          const listItems = Array.from(ul.children).map(li => {
            const nestedUl = li.querySelector('ul');
            if (nestedUl) {
              const listSubItems = convertSubListToGutenberg(nestedUl, tag);
              nestedUl.remove();
              return `[li]${li.innerHTML}${listSubItems}[/li]<br />`;
            }
            return `[li]${li.innerHTML}[/li]<br />`;
          }).join('');
          return `${tagComment}${listItems}[/list]<br /><br />`;
        }

        function convertSubListToMenu(ul, tag) {
          let tagComment = '<br />[list]<br />';
          if(tag === 'ol') {
            tagComment = '<br />[list type=decimal]<br />';
          }
          const newListItems = Array.from(ul.querySelectorAll('li')).map(li => {
            const liText = li.textContent.replace(/H2|H3|h2|h3|Header Tag 2|Header Tag 3|Header Tag2|Header Tag3|header tag 2|header tag 3|header tag2|header tag3|:/g, '').trim();
            return `[li]${liText}[/li]<br />`;
          }).join('');
          return `${tagComment}${newListItems}[/list]<br />`;
        }

        function convertListToMenu(ul, tag) {
          let tagComment = '[list]<br />';
          if(tag === 'ol') {
            tagComment = '[list type=decimal]<br />';
          }
          const listItems = Array.from(ul.children).map(li => {
            const liText = li.textContent.replace(/H2|H3|h2|h3|Header Tag 2|Header Tag 3|Header Tag2|Header Tag3|header tag 2|header tag 3|header tag2|header tag3|:/g, '').trim();
            const nestedUl = li.querySelector('ul');
            if (nestedUl) {
              const listSubItems = convertSubListToMenu(nestedUl, tag);
              nestedUl.remove();
              const liSubText = li.textContent.replace(/H2|H3|h2|h3|Header Tag 2|Header Tag 3|Header Tag2|Header Tag3|header tag 2|header tag 3|header tag2|header tag3|:/g, '').trim();
              return `[li]${liSubText}${listSubItems}[/li]<br />`;
            }
            return `[li]${liText}[/li]<br />`;
          }).join('');
          return `${tagComment}${listItems}[/list]<br /><br />`;
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
            list.querySelectorAll('a').forEach(a => {
              const href = a.getAttribute('href');
                const text = a.textContent;
                const bbcode = `[url=${href}]${text}[/url]`;
                a.outerHTML = bbcode;
            });
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
          const headerCells = Array.from(rows.shift().querySelectorAll('th')).map(cell => {
            const cellContent = cell.textContent.trim();
            return `<br />[td]${cellContent}[/td]<br />`;
          }).join('');
          
          const thead = `[tr]${headerCells}[/tr]<br />`;
        
          const bodyRows = rows.map(tr => {
            const cells = Array.from(tr.querySelectorAll('th, td')).map(cell => {
              const cellTag = 'td';
              const cellContent = cell.textContent.trim();
              return `<br />[${cellTag}]${cellContent}[/${cellTag}]<br />`;
            }).join('');
            return `[tr]${cells}[/tr]<br />`;
          }).join('');
          
          let tbody = '';
          if(bodyRows) {
            tbody = `${bodyRows}`;
          }
        
          return `[table]${thead}${tbody}[/table]<br /><br />`;
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

        htmlString = htmlString.replace(/<br \/>/g, ' \n');
        htmlString = htmlString.replace(/<strong>/g, '[b]');
        htmlString = htmlString.replace(/<\/strong>/g, '[/b]');
        htmlString = htmlString.replace(/<em>/g, '[i]');
        htmlString = htmlString.replace(/<\/em>/g, '[/i]');
        htmlString = htmlString.replace(/𝗖𝗼𝗼𝗹 𝗬𝗮𝗴 𝟭𝟬𝟲𝟰/g, 'Cool Yag 1064');
        // htmlString = htmlString.replace(/\[hr]/g, '[hr]\n\n');
        // htmlString = htmlString.replace(/\[\/size\]/g, '[/size]\n\n');
        // htmlString = htmlString.replace(/\[\/img\]/g, '[/img]\n\n');
        // htmlString = htmlString.replace(/\[list]/g, '[list]\n');
        // htmlString = htmlString.replace(/\[\/li]/g, '[/li]\n');
        // htmlString = htmlString.replace(/\[\/list]/g, '[/list]\n\n');


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
        <title>Docx to BBCode Code App</title>
        <meta name="description" content="Docx to BBCode Code App" />
      </Helmet>
      <div className="container">
        <div className="site-content">
          <div className="col-left">
            <div className="space-left">
              <h1>Docx to <span>BBCode</span> Converter</h1>
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
                  <li>talung.gimyong.com</li>
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
                    <span className="code-language">BBCode</span>
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