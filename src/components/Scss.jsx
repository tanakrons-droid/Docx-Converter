import React, { useState } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport, faCopy, faLaptop, faMobileScreenButton, faCheck } from '@fortawesome/free-solid-svg-icons';

function Scss() {
  const [inputCSSNotebook, setInputCSSNotebook] = useState('');
  const [inputCSSMobile, setInputCSSMobile] = useState('');
  const [outputCSSNotebook, setOutputCSSNotebook] = useState('');
  const [outputCSSMobile, setOutputCSSMobile] = useState('');
  const [isNotebookCopied, setIsNotebookCopied] = useState(false);
  const [isMobileCopied, setIsMobileCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('notebook');

  const handleInputNotebookChange = (e) => {
    setInputCSSNotebook(e.target.value);
  };

  const handleInputMobileChange = (e) => {
    setInputCSSMobile(e.target.value);
  };

  const filterCSSNotebookProperties = (css) => {
    // Unminify CSS
    const unminifiedCSS = css
        .replace(/,\s*\n\s*/g, ',[br]')
        .replace(/::\s*/g, ':')
        .replace(/:(?!active)(?!checked)(?!disabled)(?!empty)(?!enabled)(?!first-child)(?!first-of-type)(?!focus)(?!hover)(?!in-range)(?!invalid)(?!last-child)(?!last-of-type)(?!link)(?!not)(?!nth-child)(?!nth-last-child)(?!nth-last-of-type)(?!nth-of-type)(?!only-of-type)(?!only-child)(?!optional)(?!out-of-range)(?!read-only)(?!read-write)(?!required)(?!root)(?!target)(?!valid)(?!visited)(?!after)(?!before)(?!marker)(?!placeholder)(?!selection)(?!slotted)(?!backdrop)\s*/g, ': ')
        .replace(/;\s*/g, ';\n    ')
        .replace(/{\s*/g, ' {\n    ')
        .replace(/\s*}\s*/g, '\n}\n')
        .replace(/  {/g, ' {')
        .replace(/^\s*[^:]+:\s*0px;\n/gm, '');

    let lines = unminifiedCSS.split('\n');
    const filteredLines = [];
    let insideBlock = false;
    let currentBlock = [];
    let selectors = [];

    lines.forEach(line => {
        const trimmedLine = line.trim();

        if (trimmedLine.endsWith('{')) {
            insideBlock = true;
            selectors.push(line);
        } else if (insideBlock && trimmedLine.endsWith('}')) {
            insideBlock = false;

            // const processedProperties = currentBlock.filter(l => l.includes('px')).map(l =>
            //     l.replace(/(-?\d+(\.\d+)?px)/g, 'get-vw-nb($1)')
            // );
            const processedProperties = currentBlock
              .filter(l => l.includes('px') && (!l.includes(' 1px') || !l.includes(':1px')))
              .map(l => l.replace(/(-?\d+(\.\d+)?px)/g, 'get-vw-nb($1)'));

            if (processedProperties.length > 0) {
                filteredLines.push(selectors.join(' ').replace(/\s*{\s*$/, ' {'));
                filteredLines.push(...processedProperties);
                filteredLines.push(line);
            }

            currentBlock = [];
            selectors = [];
        } else if (insideBlock) {
            currentBlock.push(line);
        } else {
            if (line.includes('px')) {
                filteredLines.push(line.replace(/(-?\d+(\.\d+)?px)/g, 'get-vw-nb($1)'));
            }
        }
    });

    return filteredLines.join('\n')
      .replace(/,\[br\]/g, ',\n')
      .replace(/get-vw-nb\(1px\)/g, '1px');
  };

  const filterCSSMobileProperties = (css) => {
    // Unminify CSS
    const unminifiedCSS = css
        .replace(/,\s*\n\s*/g, ',[br]')
        .replace(/::\s*/g, ':')
        .replace(/:(?!active)(?!checked)(?!disabled)(?!empty)(?!enabled)(?!first-child)(?!first-of-type)(?!focus)(?!hover)(?!in-range)(?!invalid)(?!last-child)(?!last-of-type)(?!link)(?!not)(?!nth-child)(?!nth-last-child)(?!nth-last-of-type)(?!nth-of-type)(?!only-of-type)(?!only-child)(?!optional)(?!out-of-range)(?!read-only)(?!read-write)(?!required)(?!root)(?!target)(?!valid)(?!visited)(?!after)(?!before)(?!marker)(?!placeholder)(?!selection)(?!slotted)(?!backdrop)\s*/g, ': ')
        .replace(/;\s*/g, ';\n    ')
        .replace(/{\s*/g, ' {\n    ')
        .replace(/\s*}\s*/g, '\n}\n')
        .replace(/  {/g, ' {')
        .replace(/\b0px\b/g, '0');

    let lines = unminifiedCSS.split('\n');
    const filteredLines = [];

    lines.forEach(line => {
      if (line.includes('px')) {
        const value = line.replace(/(-?\d+(\.\d+)?px)/g, 'get-vw-mb($1)');
        filteredLines.push(value);
      } else {
        filteredLines.push(line);
      }
    });

    return filteredLines.join('\n')
      .replace(/,\[br\]/g, ',\n')
      .replace(/get-vw-mb\(1px\)/g, '1px');
  };

  const handleFilterCSSNotebook = () => {
    const filteredCSS = filterCSSNotebookProperties(inputCSSNotebook);
    setOutputCSSNotebook(filteredCSS);
  };

  const handleFilterCSSMobile = () => {
    const filteredCSS = filterCSSMobileProperties(inputCSSMobile);
    setOutputCSSMobile(filteredCSS);
  };

  const handleCopyNotebook = () => {
    navigator.clipboard.writeText(outputCSSNotebook).then(() => {
      setIsNotebookCopied(true);
      setTimeout(() => setIsNotebookCopied(false), 1000);
    });
  };

  const handleCopyMobile = () => {
    navigator.clipboard.writeText(outputCSSMobile).then(() => {
      setIsMobileCopied(true);
      setTimeout(() => setIsMobileCopied(false), 1000);
    });
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  return (
    <HelmetProvider>
      <Helmet>
        <title>CSS to SCSS App</title>
        <meta name="description" content="Docx to Content App" />
      </Helmet>
      <div className="container">
        <div className="site-content">
          <div className="col-left">
            <div className="space-left">
              <h1>CSS to <span>SCSS</span> Function Pixel Responsive Converter</h1>
              <div className="tab-nav">
                <button className={`tab-nav-item ${activeTab === 'notebook' ? 'active' : ''}`} onClick={() => handleTabClick('notebook')}>
                  <FontAwesomeIcon icon={faLaptop} />
                  <p>NOTEBOOK</p>
                </button>
                <button className={`tab-nav-item ${activeTab === 'mobile' ? 'active' : ''}`} onClick={() => handleTabClick('mobile')}>
                  <FontAwesomeIcon icon={faMobileScreenButton} />
                  <p>MOBILE</p>
                </button>
              </div>
              <div className="tab-content">
                <div className={`tab-content-item ${activeTab === 'notebook' ? 'active' : ''}`}>
                  <div className="input-css">
                    <textarea
                      rows="8"
                      cols="50"
                      value={inputCSSNotebook}
                      onChange={handleInputNotebookChange}
                      placeholder="Paste Your CSS Code Here"
                    ></textarea>
                  </div>
                  <button className={`submit-btn ${inputCSSNotebook ? '' : 'disable'}`} onClick={handleFilterCSSNotebook}>
                    CONVERT
                    <FontAwesomeIcon icon={faFileImport} />
                  </button>
                </div>
                <div className={`tab-content-item ${activeTab === 'mobile' ? 'active' : ''}`}>
                  <div className="input-css">
                    <textarea
                      rows="8"
                      cols="50"
                      value={inputCSSMobile}
                      onChange={handleInputMobileChange}
                      placeholder="Paste Your CSS Code Here"
                    ></textarea>
                  </div>
                  <button className={`submit-btn ${inputCSSMobile ? '' : 'disable'}`} onClick={handleFilterCSSMobile}>
                    CONVERT
                    <FontAwesomeIcon icon={faFileImport} />
                  </button>
                </div>
              </div>
              <div className="upload-desc">
                <p>add function SCSS for responsive</p>
              </div>
            </div>
          </div>
          <div className="col-right">
            <div className="space-right">
              <div className="tab-content">
                <div className={`tab-content-item ${activeTab === 'notebook' ? 'active' : ''}`}>
                  <div className="code-content">
                    {/* Header Bar */}
                    <div className="code-header">
                      <div className="code-header-left">
                        <div className="code-dots">
                          <span className="dot dot-red"></span>
                          <span className="dot dot-yellow"></span>
                          <span className="dot dot-green"></span>
                        </div>
                        <span className="code-title">Notebook CSS</span>
                      </div>
                      <div className="code-header-right">
                        <span className="code-language">CSS</span>
                        <span className="code-lines">{outputCSSNotebook ? outputCSSNotebook.split('\n').length : 0} lines</span>
                        <button 
                          onClick={handleCopyNotebook} 
                          className={`copy-btn-header ${isNotebookCopied ? 'copied' : ''}`}
                          disabled={!outputCSSNotebook}
                          title={!outputCSSNotebook ? 'No content to copy' : 'Copy to clipboard'}
                        >
                          <FontAwesomeIcon icon={isNotebookCopied ? faCheck : faCopy} />
                          <span className="copy-btn-text">
                            {isNotebookCopied ? 'Copied!' : 'Copy'}
                          </span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Code Content */}
                    <div className="code-wrapper">
                      <SyntaxHighlighter language="javascript" style={vscDarkPlus} className="syntax-highlighter" showLineNumbers>
                        {outputCSSNotebook}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                </div>
                <div className={`tab-content-item ${activeTab === 'mobile' ? 'active' : ''}`}>
                  <div className="code-content">
                    {/* Header Bar */}
                    <div className="code-header">
                      <div className="code-header-left">
                        <div className="code-dots">
                          <span className="dot dot-red"></span>
                          <span className="dot dot-yellow"></span>
                          <span className="dot dot-green"></span>
                        </div>
                        <span className="code-title">Mobile CSS</span>
                      </div>
                      <div className="code-header-right">
                        <span className="code-language">CSS</span>
                        <span className="code-lines">{outputCSSMobile ? outputCSSMobile.split('\n').length : 0} lines</span>
                        <button 
                          onClick={handleCopyMobile} 
                          className={`copy-btn-header ${isMobileCopied ? 'copied' : ''}`}
                          disabled={!outputCSSMobile}
                          title={!outputCSSMobile ? 'No content to copy' : 'Copy to clipboard'}
                        >
                          <FontAwesomeIcon icon={isMobileCopied ? faCheck : faCopy} />
                          <span className="copy-btn-text">
                            {isMobileCopied ? 'Copied!' : 'Copy'}
                          </span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Code Content */}
                    <div className="code-wrapper">
                      <SyntaxHighlighter language="javascript" style={vscDarkPlus} className="syntax-highlighter" showLineNumbers>
                        {outputCSSMobile}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </HelmetProvider>
  );
}

export default Scss;