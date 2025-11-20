import React, { useState } from 'react';

/**
 * ToolItem - A reusable tool card component
 * @param {object} tool - Tool object with { id, title, description, icon, color }
 * @param {function} onClick - Callback when tool is clicked
 */
export default function ToolItem({ tool, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  const { title, description, icon, color = '#3b82f6' } = tool;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: isHovered 
          ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)'
          : 'rgba(255, 255, 255, 0.05)',
        border: `1px solid ${isHovered ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered 
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        width: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Glow Effect */}
      {isHovered && (
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-50%',
          width: '200%',
          height: '200%',
          background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
          pointerEvents: 'none',
          animation: 'pulse 2s ease-in-out infinite'
        }} />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Icon */}
        <div style={{
          fontSize: '42px',
          marginBottom: '16px',
          display: 'inline-block',
          transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {icon}
        </div>

        {/* Title */}
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#e2e8f0',
          transition: 'color 0.2s'
        }}>
          {title}
        </h3>

        {/* Description */}
        <p style={{
          margin: 0,
          fontSize: '14px',
          color: '#94a3b8',
          lineHeight: '1.5'
        }}>
          {description}
        </p>

        {/* Arrow Indicator */}
        <div style={{
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: color,
          fontSize: '14px',
          fontWeight: '500',
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? 'translateX(0)' : 'translateX(-10px)',
          transition: 'all 0.3s'
        }}>
          เปิดเครื่องมือ
          <span style={{
            transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
            transition: 'transform 0.3s'
          }}>
            →
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }
      `}</style>
    </button>
  );
}










