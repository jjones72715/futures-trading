export default function SectionHeader({ title, count, onAdd, addLabel = '+ Add', collapsed, onToggle, right }) {
  const collapsible = typeof onToggle === 'function';
  return (
    <div className="fin-sh">
      <button
        type="button"
        className={`fin-sh-left${collapsible ? ' collapsible' : ''}`}
        onClick={collapsible ? onToggle : undefined}
      >
        {collapsible && <span className={`fin-sh-caret${collapsed ? ' closed' : ''}`}>▼</span>}
        <span className="fin-sh-title">{title}</span>
        {count != null && <span className="fin-sh-count">{count}</span>}
      </button>
      <div className="fin-sh-right">
        {right}
        {onAdd && <button className="fin-btn primary sm" onClick={onAdd}>{addLabel}</button>}
      </div>
    </div>
  );
}
