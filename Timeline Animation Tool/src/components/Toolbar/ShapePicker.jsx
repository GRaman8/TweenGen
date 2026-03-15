import React from 'react';
import { SHAPES } from '../../utils/shapeDefinitions';

const ShapePreview = ({ svgPath, fill }) => (
  <div className="w-12 h-10 flex items-center justify-center shrink-0">
    <svg viewBox="0 0 100 100" width="34" height="34" style={{ overflow: 'visible' }}>
      <path d={svgPath} fill={fill} stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
    </svg>
  </div>
);

const ShapePicker = ({ anchorEl, open, onClose, onSelectShape }) => {
  if (!open || !anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();

  return (
    <div className="fixed inset-0 z-50" onClick={onClose} role="dialog" aria-label="Shape picker">
      <div
        className="absolute bg-white rounded-lg shadow-2xl border border-gray-300 w-56 max-h-[480px] overflow-y-auto py-1.5"
        style={{ top: rect.top, left: rect.right + 6 }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="block px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 mb-1">
          Shapes
        </span>
        {SHAPES.map((shape) => (
          <button
            key={shape.key}
            onClick={() => { onSelectShape(shape.key); onClose(); }}
            className="flex items-center w-full px-4 py-2 gap-3 text-left hover:bg-blue-50 active:bg-blue-100 transition-colors"
            aria-label={`Add ${shape.label}`}
          >
            <span className="flex-1 text-[14px] text-gray-800">{shape.label}</span>
            <ShapePreview svgPath={shape.svgPath} fill={shape.defaultFill} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ShapePicker;