import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AppCard({ label, route, accent, icon, disabled }) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  function handleClick() {
    if (!disabled) navigate(route);
  }

  const cardStyle = {
    position: 'relative',
    background: '#111827',
    borderRadius: '20px',
    border: hovered && !disabled
      ? `1px solid ${accent}88`
      : '1px solid rgba(255,255,255,0.08)',
    width: '100%',
    aspectRatio: '1',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    opacity: disabled ? 0.4 : 1,
    transform: hovered && !disabled ? 'translateY(-6px)' : 'none',
    boxShadow: hovered && !disabled ? `0 0 24px ${accent}55` : 'none',
    transition: 'all 0.2s ease',
    overflow: 'hidden',
  };

  return (
    <div
      style={cardStyle}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: '4rem', color: accent, lineHeight: 1 }}>{icon}</span>
      <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.25rem' }}>{label}</span>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: accent,
        borderRadius: '0 0 20px 20px',
      }} />
    </div>
  );
}
