import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileArrowUp, faFileImport, faCopy, faCircleNotch, faCheck } from '@fortawesome/free-solid-svg-icons';
import { convert, SUPPORTED_WEBSITES } from '../utils/htmlToGutenbergConverter';

function HtmlToGutenberg() {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const dropdownButtonRef = useRef(null);

  // Memoized websites list - use from converter
  const websites = useMemo(() => SUPPORTED_WEBSITES, []);
  
  // Conversion report state
  const [conversionReport, setConversionReport] = useState(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Memoized callback for website selection
  const handleWebsiteSelect = useCallback((website) => {
    setSelectedWebsite(website);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    dropdownButtonRef.current?.focus();
  }, []);

  // Toggle dropdown with keyboard support
  const handleToggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
    if (!isDropdownOpen) {
      const currentIndex = websites.indexOf(selectedWebsite);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isDropdownOpen, selectedWebsite, websites]);

  // Keyboard navigation
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleKeyDown = (event) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }

      switch (event.key) {
        case 'ArrowDown':
          setHighlightedIndex((prev) => {
            const nextIndex = prev < websites.length - 1 ? prev + 1 : 0;
            setTimeout(() => {
              const element = document.querySelector(`[data-website-index="${nextIndex}"]`);
              element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 0);
            return nextIndex;
          });
          break;
        case 'ArrowUp':
          setHighlightedIndex((prev) => {
            const nextIndex = prev > 0 ? prev - 1 : websites.length - 1;
            setTimeout(() => {
              const element = document.querySelector(`[data-website-index="${nextIndex}"]`);
              element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 0);
            return nextIndex;
          });
          break;
        case 'Enter':
        case ' ':
          if (highlightedIndex >= 0 && highlightedIndex < websites.length) {
            handleWebsiteSelect(websites[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsDropdownOpen(false);
          setHighlightedIndex(-1);
          dropdownButtonRef.current?.focus();
          break;
        case 'Tab':
          setIsDropdownOpen(false);
          setHighlightedIndex(-1);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isDropdownOpen, highlightedIndex, websites, handleWebsiteSelect]);

  const handleFileChange = (event) => {
    const fileTarget = event.target.files[0];
    const fileLabel = document.querySelector('.upload-file-label');
    if (fileTarget) {
      setFile(fileTarget);
      fileLabel.innerHTML = `${fileTarget.name}`;
    } else {
      setFile(null);
      fileLabel.innerHTML = `<strong>Click to upload</strong> or drag and drop<br />HTML files are Allowed.`;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(htmlContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = htmlContent;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleConvert = useCallback(async () => {
    // ตรวจสอบว่าเลือกเว็บไซต์แล้วหรือยัง
    if (!selectedWebsite) {
      alert('กรุณาเลือกเว็บไซต์ก่อนประมวลผล');
      return;
    }

    if (!file) {
      alert('กรุณาเลือกไฟล์ HTML ก่อนประมวลผล');
      return;
    }

    // ตรวจสอบประเภทไฟล์
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.html') && !fileName.endsWith('.htm')) {
      alert('กรุณาเลือกไฟล์ประเภท HTML เท่านั้น');
      return;
    }

    // ตรวจสอบขนาดไฟล์ (จำกัดที่ 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('ขนาดไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 50MB');
      return;
    }

    setIsLoading(true);

    try {
      // อ่านไฟล์ HTML
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const htmlInput = e.target.result;
          
          // ใช้ html-to-gutenberg converter (เหมือนกับ Home.jsx เป๊ะๆ)
          const result = convert(htmlInput, {
            inlineStyles: true,
            website: selectedWebsite, // ส่ง website เพื่อใช้ในการ process links และ footer
            policies: {
              forbiddenTags: {
                enabled: true,
                tags: ['script', 'iframe', 'object', 'embed', 'form']
              },
              removeBeforeH1: {
                enabled: true
              },
              removeAfterNoteSEO: {
                enabled: true
              },
              requireH2: {
                enabled: true,
                minCount: 1,
                autoGenerate: false
              },
              addDisclaimer: {
                enabled: true,
                keywords: ['โปรโมชั่น', 'ส่วนลด', 'promotion', 'discount']
              }
            }
          });
          
          setHtmlContent(result.html);
          setConversionReport(result.report);
          
          // แสดง warnings ถ้ามี
          if (result.report.warnings.length > 0) {
            console.log('Conversion warnings:', result.report.warnings);
          }
          
          // แสดง errors ถ้ามี
          if (result.report.errors.length > 0) {
            console.error('Conversion errors:', result.report.errors);
            alert('เกิดข้อผิดพลาดบางส่วน: ' + result.report.errors.join(', '));
          }
        } catch (error) {
          console.error('Conversion error:', error);
          alert('เกิดข้อผิดพลาดในการแปลงไฟล์ กรุณาลองใหม่อีกครั้ง');
          setHtmlContent('');
          setConversionReport(null);
        } finally {
          setIsLoading(false);
        }
      };
      
      reader.onerror = () => {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
        setIsLoading(false);
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error('File reading error:', error);
      alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
      setIsLoading(false);
    }
  }, [file, selectedWebsite]);

  return (
    <HelmetProvider>
      <Helmet>
        <title>HTML to Gutenberg Code App</title>
        <meta name="description" content="HTML to Gutenberg Code App" />
      </Helmet>
      <div className="container">
        <div className="site-content">
          <div className="col-left">
            <div className="space-left">
              <h1>HTML to <span>Gutenberg</span> Converter</h1>
              
              <div className="website-selector" style={{ marginBottom: '24px' }} ref={dropdownRef}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '12px',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#fff',
                  letterSpacing: '0.5px'
                }}>
                  🌐 เลือกเว็บไซต์
                </label>
                <div style={{ position: 'relative' }}>
                  {/* Custom Dropdown Button */}
                  <div
                    ref={dropdownButtonRef}
                    onClick={handleToggleDropdown}
                    tabIndex={0}
                    role="combobox"
                    aria-expanded={isDropdownOpen}
                    aria-haspopup="listbox"
                    aria-controls="website-listbox"
                    aria-label="เลือกเว็บไซต์"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleDropdown();
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '14px 40px 14px 16px',
                      fontSize: '16px',
                      fontWeight: '500',
                      border: isDropdownOpen ? '2px solid #3d83f2' : '2px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      color: selectedWebsite ? '#2c3e50' : '#999',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isDropdownOpen 
                        ? '0 4px 16px rgba(61, 131, 242, 0.3), 0 0 0 3px rgba(61, 131, 242, 0.1)' 
                        : '0 2px 8px rgba(0, 0, 0, 0.1)',
                      userSelect: 'none',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isDropdownOpen) {
                        e.target.style.borderColor = 'rgba(61, 131, 242, 0.5)';
                        e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isDropdownOpen) {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                      }
                    }}
                  >
                    {selectedWebsite || '-- กรุณาเลือกเว็บไซต์ --'}
                  </div>
                  
                  {/* Custom Dropdown Arrow */}
                  <div style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: isDropdownOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%) rotate(0deg)',
                    pointerEvents: 'none',
                    color: '#3d83f2',
                    fontSize: '20px',
                    transition: 'transform 0.3s ease'
                  }}>
                    ▼
                  </div>

                  {/* Custom Dropdown List */}
                  {isDropdownOpen && (
                    <div 
                      id="website-listbox"
                      role="listbox"
                      aria-label="รายการเว็บไซต์"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        backgroundColor: '#fff',
                        border: '2px solid #3d83f2',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                        zIndex: 1000,
                        overflow: 'hidden',
                        animation: 'dropdownSlide 0.15s ease-out'
                      }}
                    >
                      {/* Keyboard hints */}
                      <div style={{
                        padding: '8px 12px',
                        fontSize: '11px',
                        color: '#64748b',
                        backgroundColor: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <kbd style={{ 
                            padding: '2px 6px', 
                            backgroundColor: '#fff', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontFamily: 'monospace'
                          }}>↑↓</kbd>
                          เลือก
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <kbd style={{ 
                            padding: '2px 6px', 
                            backgroundColor: '#fff', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontFamily: 'monospace'
                          }}>Enter</kbd>
                          ยืนยัน
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <kbd style={{ 
                            padding: '2px 6px', 
                            backgroundColor: '#fff', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontFamily: 'monospace'
                          }}>Esc</kbd>
                          ปิด
                        </span>
                      </div>
                      <div style={{
                        padding: '8px 0',
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}>
                        {websites.map((website, index) => {
                          const isSelected = selectedWebsite === website;
                          const isHighlighted = highlightedIndex === index;
                          
                          return (
                            <div
                              key={website}
                              role="option"
                              aria-selected={isSelected}
                              data-website-index={index}
                              onClick={() => handleWebsiteSelect(website)}
                              onMouseEnter={() => setHighlightedIndex(index)}
                              onMouseDown={(e) => e.preventDefault()}
                              style={{
                                padding: '12px 16px',
                                fontSize: '16px',
                                color: isSelected ? '#3d83f2' : '#2c3e50',
                                backgroundColor: isHighlighted 
                                  ? (isSelected ? 'rgba(61, 131, 242, 0.2)' : 'rgba(61, 131, 242, 0.08)')
                                  : (isSelected ? 'rgba(61, 131, 242, 0.1)' : 'transparent'),
                                cursor: 'pointer',
                                transition: 'all 0.12s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontWeight: isSelected ? '600' : '500',
                                borderLeft: isSelected 
                                  ? '4px solid #3d83f2' 
                                  : isHighlighted 
                                    ? '4px solid rgba(61, 131, 242, 0.5)' 
                                    : '4px solid transparent',
                                animation: `listItemSlide 0.3s ease-out ${index * 0.05}s backwards`,
                                paddingLeft: isHighlighted ? '20px' : '16px',
                                boxShadow: isHighlighted ? 'inset 0 0 0 2px rgba(61, 131, 242, 0.2)' : 'none'
                              }}
                            >
                              <span style={{ 
                                fontSize: '18px',
                                opacity: isSelected ? 1 : 0,
                                transition: 'opacity 0.2s ease'
                              }}>
                                ✓
                              </span>
                              <span>{website}</span>
                              {isHighlighted && !isSelected && (
                                <span style={{
                                  marginLeft: 'auto',
                                  fontSize: '14px',
                                  color: '#3d83f2',
                                  opacity: 0.6
                                }}>
                                  ↵
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                
                {selectedWebsite && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(61, 131, 242, 0.1)',
                    border: '1px solid rgba(61, 131, 242, 0.3)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    animation: 'slideDown 0.2s ease-out',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '16px' }}>✓</span>
                    <span>เลือก: <strong>{selectedWebsite}</strong></span>
                  </div>
                )}
              </div>
              <style>{`
                @keyframes slideDown {
                  from {
                    opacity: 0;
                    transform: translateY(-8px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                
                @keyframes dropdownSlide {
                  from {
                    opacity: 0;
                    transform: translateY(-5px) scale(0.98);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                }
                
                @keyframes listItemSlide {
                  from {
                    opacity: 0;
                    transform: translateX(-10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateX(0);
                  }
                }
              `}</style>

              <div className="upload-file">
                <input type="file" accept=".html,.htm" onChange={handleFileChange} />
                <div className={`upload-file-btn ${file ? 'active' : ''}`}>
                  <div className="upload-file-icon">
                    <FontAwesomeIcon icon={faFileArrowUp} />
                  </div>
                  <div className="upload-file-detail">
                    <span className="upload-file-label"><strong>Click to upload</strong> or drag and drop<br />HTML files are Allowed.</span>
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
                <p>Convert HTML files to WordPress Gutenberg blocks</p>
                <ul>
                  <li>Google Docs HTML</li>
                  <li>Microsoft Word HTML</li>
                  <li>Standard HTML files</li>
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
                    {conversionReport && (
                      <span className="code-blocks" style={{ marginRight: '8px', color: '#4ade80' }}>
                        {conversionReport.blocksCreated} blocks
                      </span>
                    )}
                    <span className="code-lines">{htmlContent ? htmlContent.split('\n').length : 0} lines</span>
                    {conversionReport && (
                      <span className="code-time" style={{ marginLeft: '8px', color: '#94a3b8' }}>
                        {conversionReport.executionTimeMs}ms
                      </span>
                    )}
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
                  {htmlContent ? (
                    <SyntaxHighlighter 
                      language="html" 
                      style={vscDarkPlus} 
                      className="syntax-highlighter" 
                      showLineNumbers
                      wrapLines={false}
                      wrapLongLines={false}
                    >
                      {htmlContent}
                    </SyntaxHighlighter>
                  ) : (
                    <pre className="syntax-highlighter" style={{ padding: '16px', color: '#d4d4d4', backgroundColor: '#1e1e1e', margin: 0, minHeight: '200px' }}>
                      {/* Empty state */}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </HelmetProvider>
  );
}

export default HtmlToGutenberg;
