import React from 'react';
import { PaintBrushIcon } from '@heroicons/react/24/solid';
import { useDrawingToolSettings } from '../../store/hooks';

const DrawingSettings = () => {
  const [settings, setSettings] = useDrawingToolSettings();

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-4 mb-3">
      <div className="flex items-center gap-2 mb-4">
        <PaintBrushIcon className="w-5 h-5 text-[#1976d2]" />
        <h4 className="text-[14px] font-semibold text-gray-900">Drawing Tool Settings</h4>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[13px] font-medium text-gray-700 block mb-1.5">Color</label>
          <input type="color" value={settings.color}
            onChange={(e) => setSettings(prev => ({ ...prev, color: e.target.value }))}
            className="w-full h-10 rounded-lg" aria-label="Drawing color" />
        </div>

        <div>
          <label className="text-[13px] font-medium text-gray-700 block mb-1.5">
            Stroke Width: <strong>{settings.strokeWidth}px</strong>
          </label>
          <input type="range" value={settings.strokeWidth} min={1} max={20} step={1}
            onChange={(e) => setSettings(prev => ({ ...prev, strokeWidth: parseInt(e.target.value) }))}
            aria-label="Stroke width" />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer py-1">
          <input type="checkbox" checked={settings.smoothing}
            onChange={(e) => setSettings(prev => ({ ...prev, smoothing: e.target.checked }))}
            className="w-[18px] h-[18px] rounded border-gray-400 text-[#1976d2] focus:ring-[#1976d2]" />
          <span className="text-[14px] text-gray-800">Smooth curves</span>
        </label>
      </div>

      <hr className="my-4 border-gray-200" />
      <p className="text-[13px] text-gray-600 leading-relaxed">
        💡 Click the brush icon to enter drawing mode. Draw on the canvas, then press <strong>ESC</strong> or click the brush again to exit.
      </p>
    </div>
  );
};

export default DrawingSettings;