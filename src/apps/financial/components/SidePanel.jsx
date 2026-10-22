import { useEffect } from 'react';

// Right-hand detail panel (~320px). Escape closes it unless a modal is open on top.
export default function SidePanel({ title, subtitle, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('.fin-overlay')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside className="fin-panel" role="dialog" aria-label={title}>
      <div className="fin-panel-head">
        <div style={{ minWidth: 0 }}>
          <div className="fin-panel-title">{title}</div>
          {subtitle && <div className="fin-panel-subtitle">{subtitle}</div>}
        </div>
        <button className="fin-modal-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="fin-panel-body">{children}</div>
      {footer && <div className="fin-panel-foot">{footer}</div>}
    </aside>
  );
}

export function PanelSection({ label, children }) {
  return (
    <div className="fin-panel-section">
      {label && <div className="fin-panel-label">{label}</div>}
      {children}
    </div>
  );
}

export function PanelRow({ label, children }) {
  return (
    <div className="fin-panel-row">
      <span className="fin-muted">{label}</span>
      <span>{children}</span>
    </div>
  );
}
