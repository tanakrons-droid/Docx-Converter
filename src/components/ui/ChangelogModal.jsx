import React from 'react';

export default function ChangelogModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div 
      className="tools-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
        animation: 'modalFadeIn 0.3s ease-out'
      }}
    >
      <div 
        className="tools-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(30, 64, 175, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          animation: 'modalPopUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          color: '#e2e8f0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ animation: 'bounceIcon 2s infinite' }}>📢</span>
              รายงานการอัพเดต
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#94a3b8' }}>
              สรุปประวัติข่าวสารและการอัพเดตระบบล่าสุด
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '20px',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(239, 68, 68, 0.2)';
              e.target.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              e.target.style.color = '#94a3b8';
            }}
          >
            ✕
          </button>
        </div>

        <div className="changelog-timeline" style={{ position: 'relative', paddingLeft: '20px', borderLeft: '2px solid rgba(255, 255, 255, 0.1)' }}>
          {/* Item 1 */}
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <div style={{
              position: 'absolute',
              left: '-26px',
              top: '4px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.2)'
            }} />
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#f8fafc' }}>อัพเดตแก้ไขการสร้างบล็อค Kadence 🛠️</h3>
            <div style={{ fontSize: '13px', color: '#10b981', marginBottom: '12px', fontWeight: '500' }}>
              🕒 20 มีนาคม 2026 เวลา 10:34 น.
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', lineHeight: '1.6', fontSize: '15px' }}>
              <li style={{ marginBottom: '6px' }}><strong>ยกเลิกการสุ่มรหัส uniqueID:</strong> ปล่อยค่าให้ <code>uniqueID</code> ว่างเปล่า เพื่อให้ระบบ WordPress คอยจัดการเติมให้อัตโนมัติ ป้องกันการทับซ้อน</li>
              <li><strong>ปรับรูปแบบ class CSS:</strong> เอา class สุ่ม <code>kadence-column...</code> ที่ต่อท้าย HTML ออกไป เหลือแค่ <code>wp-block-kadence-column</code> ตามรูปแบบปกติของ WordPress</li>
            </ul>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(4px); }
        }
        @keyframes modalPopUp {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes bounceIcon {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
          60% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
