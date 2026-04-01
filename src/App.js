import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, NavLink } from 'react-router-dom';
import './App.css';
import './assets/styles/style.css';
import Html from './components/Html';
import HtmlToGutenberg from './components/HtmlToGutenberg';

import BBCodeV1 from './components/Bbcodev1';
import Content from './components/Content';
import Scss from './components/Scss';
import ErrorBoundary from './components/ErrorBoundary';
import FbReelsModal from './components/reels/FbReelsModal';
import ImageResizeCanvas from './components/ImageResizeCanvas';
import ToolsModal from './components/ui/ToolsModal';
import ChangelogModal from './components/ui/ChangelogModal';

const App = () => {
  const [isActive, setIsActive] = useState(false);
  const [openTools, setOpenTools] = useState(false);
  const [openFbReels, setOpenFbReels] = useState(false);
  const [openImageResize, setOpenImageResize] = useState(false);
  const [openChangelog, setOpenChangelog] = useState(false);

  useEffect(() => {
    // Popup shows on every refresh for verification
    const timer = setTimeout(() => {
      setOpenChangelog(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    setIsActive(!isActive);
  };

  // Define available tools
  const tools = [
    {
      id: 'fb-reels',
      title: 'FB Reels Generator',
      description: 'สร้างโค้ด embed สำหรับ Facebook Reels ให้ WordPress Gutenberg',
      icon: '📱',
      color: '#3b82f6',
      onClick: () => setOpenFbReels(true)
    },
    {
      id: 'image-resize',
      title: 'Image Resize Tool',
      description: 'ลดขนาดรูปภาพ รองรับทั้งรูปเดี่ยวและ batch resize โฟลเดอร์',
      icon: '🖼️',
      color: '#8b5cf6',
      onClick: () => setOpenImageResize(true)
    }
    // Add more tools here in the future
    // {
    //   id: 'new-tool',
    //   title: 'New Tool',
    //   description: 'Description of new tool',
    //   icon: '🚀',
    //   color: '#10b981',
    //   onClick: () => setOpenNewTool(true)
    // }
  ];

  return (
    <ErrorBoundary>
      <Router>
        <header className="header">
          <div className="header-logo">
          </div>
          <div className="header-toggle">
            <button className={`btn-nav-toggle ${isActive ? 'active' : ''}`} onClick={handleClick}>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
          <nav className={`header-nav ${isActive ? 'active' : ''}`}>
            <ul className="nav-list">

              <li>
                <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsActive(!isActive)}>
                  <span className="nav-icon">🔄</span>
                  <span className="nav-text">HTML to GB</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/html" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsActive(!isActive)}>
                  <span className="nav-icon">🌐</span>
                  <span className="nav-text">HTML</span>
                </NavLink>
              </li>

              <li>
                <NavLink to="/bbcode-v1" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsActive(!isActive)}>
                  <span className="nav-icon">📝</span>
                  <span className="nav-text">BBCode v1</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/content" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsActive(!isActive)}>
                  <span className="nav-icon">📋</span>
                  <span className="nav-text">Content</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/scss" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsActive(!isActive)}>
                  <span className="nav-icon">🎨</span>
                  <span className="nav-text">SCSS</span>
                </NavLink>
              </li>
              <li>
                <button
                  onClick={() => { setOpenTools(true); setIsActive(false); }}
                  className={`nav-link-btn ${openTools ? 'active' : ''}`}
                  style={{
                    background: 'transparent',
                    color: 'inherit',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontWeight: 'inherit',
                    fontSize: 'inherit',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span className="nav-icon">🛠️</span>
                  <span className="nav-text">Tools</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setOpenChangelog(true); setIsActive(false); }}
                  className={`nav-link-btn ${openChangelog ? 'active' : ''}`}
                  style={{
                    background: 'transparent',
                    color: 'inherit',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontWeight: 'inherit',
                    fontSize: 'inherit',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span className="nav-icon">📢</span>
                  <span className="nav-text">Updates</span>
                </button>
              </li>
            </ul>
          </nav>
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<HtmlToGutenberg />} />
            <Route path="/html" element={<Html />} />


            <Route path="/bbcode-v1" element={<BBCodeV1 />} />
            <Route path="/content" element={<Content />} />
            <Route path="/scss" element={<Scss />} />
          </Routes>
        </main>

        {/* FB Reels Modal */}
        <FbReelsModal
          open={openFbReels}
          onClose={() => setOpenFbReels(false)}
        />

        {/* Image Resize Modal */}
        {openImageResize && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 9998,
            overflowY: 'auto'
          }}>
            <div style={{
              position: 'relative',
              backgroundColor: '#1e293b',
              borderRadius: 16,
              padding: 24,
              margin: '40px auto',
              maxWidth: '95vw',
              width: 1200,
              color: '#e2e8f0'
            }}>
              <button
                onClick={() => setOpenImageResize(false)}
                style={{
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  background: 'transparent',
                  border: 'none',
                  fontSize: 32,
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  zIndex: 10
                }}
              >×</button>
              <ImageResizeCanvas />
            </div>
          </div>
        )}

        {/* Tools Modal */}
        <ToolsModal
          isOpen={openTools}
          onClose={() => setOpenTools(false)}
          tools={tools}
        />

        {/* Changelog Modal */}
        <ChangelogModal
          isOpen={openChangelog}
          onClose={() => setOpenChangelog(false)}
        />
      </Router>
    </ErrorBoundary>
  );
};

export default App;
