import { useMemo, useState } from 'react';
import { MARK_TYPES, MARK_SEVERITY, formatStatusLabel, getSeverityColor } from './constants';

export default function BodyDiagramSvg({ marks, onAddMark, onRemoveMark, onClearAll }) {
  const [activeView, setActiveView] = useState('front');
  const [markType, setMarkType] = useState('pain');
  const [markSeverity, setMarkSeverity] = useState('moderate');

  const filteredMarks = useMemo(
    () => (Array.isArray(marks) ? marks.filter((mark) => String(mark?.view || 'front') === activeView) : []),
    [marks, activeView]
  );

  function handleSvgClick(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    onAddMark({
      view: activeView,
      x: Math.max(0, Math.min(100, Number(x.toFixed(2)))),
      y: Math.max(0, Math.min(100, Number(y.toFixed(2)))),
      type: markType,
      severity: markSeverity,
      note: '',
    });
  }

  return (
    <div className="bg-cad-surface border border-cad-border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Body Diagram</h4>
        <div className="flex rounded-lg border border-cad-border overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setActiveView('front')}
            className={`px-3 py-1.5 font-medium transition-colors ${activeView === 'front' ? 'bg-cad-accent text-white' : 'bg-cad-card text-cad-muted hover:text-cad-ink'}`}
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => setActiveView('back')}
            className={`px-3 py-1.5 font-medium transition-colors ${activeView === 'back' ? 'bg-cad-accent text-white' : 'bg-cad-card text-cad-muted hover:text-cad-ink'}`}
          >
            Back
          </button>
        </div>
      </div>

      <svg
        viewBox="0 0 100 180"
        className="w-full max-w-[240px] h-auto mx-auto rounded-lg bg-cad-card border border-cad-border cursor-crosshair"
        onClick={handleSvgClick}
      >
        {/* Head */}
        <ellipse cx="50" cy="16" rx="9" ry="11" fill="#15243b" stroke="#39506e" strokeWidth="1.2" />
        {/* Neck */}
        <rect x="46" y="26" width="8" height="6" rx="2" fill="#15243b" stroke="#39506e" strokeWidth="1" />
        {/* Torso */}
        <path
          d="M36,32 Q36,30 40,30 L60,30 Q64,30 64,32 L66,58 Q66,72 56,74 L44,74 Q34,72 34,58 Z"
          fill="#15243b" stroke="#39506e" strokeWidth="1.2"
        />
        {/* Left arm */}
        <path
          d="M34,33 L26,34 Q22,35 21,40 L18,60 Q17,64 19,66 L22,68 Q24,69 25,66 L30,46 L34,45"
          fill="#15243b" stroke="#39506e" strokeWidth="1.2"
        />
        {/* Right arm */}
        <path
          d="M66,33 L74,34 Q78,35 79,40 L82,60 Q83,64 81,66 L78,68 Q76,69 75,66 L70,46 L66,45"
          fill="#15243b" stroke="#39506e" strokeWidth="1.2"
        />
        {/* Left leg */}
        <path
          d="M44,73 L42,100 L40,130 Q39,140 38,150 L36,164 Q35,168 38,168 L44,168 Q46,168 46,165 L46,150 L48,130 L48,100 L48,74"
          fill="#15243b" stroke="#39506e" strokeWidth="1.2"
        />
        {/* Right leg */}
        <path
          d="M56,73 L58,100 L60,130 Q61,140 62,150 L64,164 Q65,168 62,168 L56,168 Q54,168 54,165 L54,150 L52,130 L52,100 L52,74"
          fill="#15243b" stroke="#39506e" strokeWidth="1.2"
        />

        {/* Injury markers */}
        {filteredMarks.map((mark, index) => {
          const id = String(mark?.id || `${index}`);
          const x = Math.max(0, Math.min(100, Number(mark?.x || 0)));
          const y = Math.max(0, Math.min(100, Number(mark?.y || 0))) * 1.8;
          const color = getSeverityColor(mark?.severity);
          return (
            <g
              key={id}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveMark(id);
              }}
              className="cursor-pointer"
            >
              <circle cx={x} cy={y} r="4.5" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5" />
              <circle cx={x} cy={y} r="2" fill={color} />
            </g>
          );
        })}
      </svg>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Mark Type</label>
          <select
            value={markType}
            onChange={(e) => setMarkType(e.target.value)}
            className="w-full bg-cad-card border border-cad-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
          >
            {MARK_TYPES.map((type) => (
              <option key={type} value={type}>{formatStatusLabel(type)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Severity</label>
          <select
            value={markSeverity}
            onChange={(e) => setMarkSeverity(e.target.value)}
            className="w-full bg-cad-card border border-cad-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
          >
            {MARK_SEVERITY.map((severity) => (
              <option key={severity} value={severity}>{formatStatusLabel(severity)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-cad-muted">
          Click to place a marker. Click a marker to remove it.
        </p>
        <button
          type="button"
          onClick={onClearAll}
          className="px-2.5 py-1 text-xs rounded border border-cad-border text-cad-muted hover:text-cad-ink hover:border-cad-accent/40 transition-colors"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
