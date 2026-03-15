import React, { useEffect } from 'react';
import DrawingSettings from '../Toolbar/DrawingSettings';
import { 
  useSelectedObject, useSelectedObjectProperties, useSelectedObjectDetails,
  useCurrentTime, useKeyframes, useFabricCanvas, useDrawingMode,
  useAnchorEditMode, useCanvasObjects, useCanvasBgColor,
  useFillToolActive, useFillToolColor,
} from '../../store/hooks';
import { findFabricObjectById, extractPropertiesFromFabricObject } from '../../utils/fabricHelpers';

const FILL_TYPES = new Set(['rectangle','circle','roundedRect','ellipse','triangle','diamond','pentagon','hexagon','star','arrow','heart','cross','text']);

const PropertiesPanel = () => {
  const [selectedObject] = useSelectedObject();
  const [properties, setProperties] = useSelectedObjectProperties();
  const selectedDetails = useSelectedObjectDetails();
  const [currentTime] = useCurrentTime();
  const [keyframes] = useKeyframes();
  const [fabricCanvas] = useFabricCanvas();
  const [drawingMode] = useDrawingMode();
  const [anchorEditMode] = useAnchorEditMode();
  const [canvasObjects, setCanvasObjects] = useCanvasObjects();
  const [canvasBgColor, setCanvasBgColor] = useCanvasBgColor();
  const [fillToolActive] = useFillToolActive();
  const [fillToolColor, setFillToolColor] = useFillToolColor();

  useEffect(() => { if (!selectedObject || !fabricCanvas) return; const fo = findFabricObjectById(fabricCanvas, selectedObject); if (!fo) return; const p = extractPropertiesFromFabricObject(fo); if (p) setProperties(p); }, [currentTime, selectedObject, fabricCanvas, keyframes, setProperties]);

  const handleOpacity = (e) => { if (!selectedObject || !fabricCanvas) return; const fo = findFabricObjectById(fabricCanvas, selectedObject); if (!fo) return; const v = parseFloat(e.target.value); fo.set('opacity', v); fabricCanvas.renderAll(); setProperties(prev => ({ ...prev, opacity: v })); };
  const handlePos = (axis, val) => { if (!selectedObject || !fabricCanvas) return; const fo = findFabricObjectById(fabricCanvas, selectedObject); if (!fo) return; const v = parseFloat(val); if (isNaN(v)) return; fo.set(axis === 'x' ? 'left' : 'top', v); fo.setCoords(); fabricCanvas.renderAll(); const p = extractPropertiesFromFabricObject(fo); if (p) setProperties(p); };
  const handleRot = (val) => { if (!selectedObject || !fabricCanvas) return; const fo = findFabricObjectById(fabricCanvas, selectedObject); if (!fo) return; const v = parseFloat(val); if (isNaN(v)) return; fo.set('angle', v); fo.setCoords(); fabricCanvas.renderAll(); const p = extractPropertiesFromFabricObject(fo); if (p) setProperties(p); };
  const handleScale = (axis, val) => { if (!selectedObject || !fabricCanvas) return; const fo = findFabricObjectById(fabricCanvas, selectedObject); if (!fo) return; const v = parseFloat(val); if (isNaN(v) || v <= 0) return; fo.set(axis === 'x' ? 'scaleX' : 'scaleY', v); fo.setCoords(); fabricCanvas.renderAll(); const p = extractPropertiesFromFabricObject(fo); if (p) setProperties(p); };
  const handleFillColor = (e) => { if (!selectedObject || !fabricCanvas) return; const fo = findFabricObjectById(fabricCanvas, selectedObject); if (!fo) return; fo.set('fill', e.target.value); fabricCanvas.renderAll(); setCanvasObjects(prev => prev.map(obj => obj.id === selectedObject ? { ...obj, fill: e.target.value } : obj)); };
  const handleStrokeColor = (e) => { if (!selectedObject || !fabricCanvas) return; const fo = findFabricObjectById(fabricCanvas, selectedObject); if (!fo) return; fo.set('stroke', e.target.value); fabricCanvas.renderAll(); setCanvasObjects(prev => prev.map(obj => obj.id === selectedObject ? { ...obj, strokeColor: e.target.value } : obj)); };
  const handleClearFills = () => { if (!selectedObject || !fabricCanvas) return; const d = canvasObjects.find(o => o.id === selectedObject); if (!d?.fills?.length) return; const ids = new Set(d.fills.map(f => f.id)); fabricCanvas.getObjects().filter(o => o._isFill && ids.has(o.id)).forEach(f => fabricCanvas.remove(f)); fabricCanvas.renderAll(); setCanvasObjects(prev => prev.map(o => o.id === selectedObject ? { ...o, fills: [] } : o)); };

  const objData = canvasObjects.find(o => o.id === selectedObject);
  const ax = objData?.anchorX ?? 0.5, ay = objData?.anchorY ?? 0.5;
  const hasCustomAnchor = Math.abs(ax - 0.5) > 0.01 || Math.abs(ay - 0.5) > 0.01;
  const getFill = () => { if (!selectedObject || !fabricCanvas) return '#000'; const fo = findFabricObjectById(fabricCanvas, selectedObject); return fo?.fill || objData?.fill || '#000'; };
  const getStroke = () => { if (!selectedObject || !fabricCanvas) return '#000'; const fo = findFabricObjectById(fabricCanvas, selectedObject); return fo?.stroke || objData?.strokeColor || '#000'; };
  const isSolid = objData && FILL_TYPES.has(objData.type);
  const isPath = objData?.type === 'path';
  const pathFills = objData?.fills || [];

  const Field = ({ label, id, value, onChange, step, min }) => (
    <div>
      <label htmlFor={id} className="text-[13px] font-medium text-gray-600 block mb-1">{label}</label>
      <input id={id} type="number" value={value} onChange={onChange} step={step} min={min}
        className="w-full px-3 py-2 text-[14px] border border-gray-300 rounded-md focus:ring-2 focus:ring-[#1976d2] focus:border-[#1976d2] outline-none transition-colors" />
    </div>
  );

  const InfoBox = ({ color, children }) => (
    <div className={`p-3 rounded-lg border text-[13px] leading-relaxed ${color === 'blue' ? 'bg-[#e3f2fd] border-[#90caf9] text-[#1565c0]' : color === 'green' ? 'bg-[#e8f5e9] border-[#a5d6a7] text-[#2e7d32]' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
      {children}
    </div>
  );

  return (
    <aside className="w-[300px] shrink-0 bg-white border-l border-gray-300 overflow-y-auto" role="complementary" aria-label="Properties panel">
      <div className="p-4 h-full">
        <h2 className="text-[16px] font-semibold text-gray-900 mb-4">
          {fillToolActive ? 'Paint Bucket' : drawingMode ? 'Drawing Tool' : anchorEditMode ? 'Anchor Point' : 'Properties'}
        </h2>

        {fillToolActive ? (
          <div className="space-y-4">
            <InfoBox color="blue">
              <p className="font-semibold text-[14px]">🪣 Paint Bucket Tool</p>
              <p className="mt-1">Click on any enclosed region to fill it with color — just like MS Paint!</p>
            </InfoBox>
            <div>
              <label className="text-[13px] font-semibold text-gray-800 block mb-1.5">Fill Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={fillToolColor} onChange={(e) => setFillToolColor(e.target.value)} className="w-16 h-10 rounded-lg" aria-label="Fill color" />
                <span className="text-[14px] font-mono text-gray-600">{fillToolColor}</span>
              </div>
            </div>
            <InfoBox>
              💡 <strong>How to use:</strong><br/>• Select a fill color above<br/>• Click inside any enclosed area<br/>• Fills move with the drawing<br/>• Press <strong>ESC</strong> to exit
            </InfoBox>
          </div>
        ) : drawingMode ? (
          <DrawingSettings />
        ) : anchorEditMode ? (
          selectedObject ? (
            <div className="space-y-4">
              <InfoBox color="green">
                <p className="font-semibold text-[14px]">🎯 Anchor Point Mode</p>
                <p className="mt-1">Drag the crosshair to move the rotation pivot</p>
              </InfoBox>
              <div className="space-y-2">
                <p className="text-[14px] text-gray-800"><strong>Pivot X:</strong> {(ax * 100).toFixed(0)}%</p>
                <p className="text-[14px] text-gray-800"><strong>Pivot Y:</strong> {(ay * 100).toFixed(0)}%</p>
                <p className="text-[13px] text-gray-500">0% = left/top, 50% = center, 100% = right/bottom</p>
              </div>
              <hr className="border-gray-200" />
              <InfoBox color="blue">
                💡 <strong>How to use:</strong><br/>• Drag the crosshair on canvas<br/>• Double-click to reset to center<br/>• Set anchor BEFORE adding rotation keyframes
              </InfoBox>
            </div>
          ) : (
            <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-[14px] text-gray-500">Select an object to edit its anchor point</p>
            </div>
          )
        ) : selectedObject && selectedDetails ? (
          <div className="space-y-4">
            <div className="p-3 bg-[#e3f2fd] border border-[#90caf9] rounded-lg">
              <p className="text-[14px] font-semibold text-[#1565c0]">{selectedDetails.name}</p>
              <p className="text-[12px] text-[#1976d2] mt-0.5">
                {selectedDetails.type}
                {hasCustomAnchor && ` • Pivot: ${(ax*100).toFixed(0)}%, ${(ay*100).toFixed(0)}%`}
              </p>
            </div>

            <div className="space-y-3">
              <Field id="prop-x" label={hasCustomAnchor ? 'X Position (pivot)' : 'X Position (center)'} value={Math.round(properties.x)} onChange={(e) => handlePos('x', e.target.value)} />
              <Field id="prop-y" label={hasCustomAnchor ? 'Y Position (pivot)' : 'Y Position (center)'} value={Math.round(properties.y)} onChange={(e) => handlePos('y', e.target.value)} />
              <Field id="prop-sx" label="Scale X" value={properties.scaleX.toFixed(2)} onChange={(e) => handleScale('x', e.target.value)} step={0.1} min={0.1} />
              <Field id="prop-sy" label="Scale Y" value={properties.scaleY.toFixed(2)} onChange={(e) => handleScale('y', e.target.value)} step={0.1} min={0.1} />
              <Field id="prop-rot" label="Rotation" value={Math.round(properties.rotation)} onChange={(e) => handleRot(e.target.value)} step={1} />
              <div>
                <label htmlFor="prop-opacity" className="text-[13px] font-medium text-gray-600 block mb-1">
                  Opacity: <strong>{(properties.opacity * 100).toFixed(0)}%</strong>
                </label>
                <input id="prop-opacity" type="range" value={properties.opacity} min={0} max={1} step={0.01} onChange={handleOpacity} className="w-full" />
              </div>

              {isSolid && (<>
                <hr className="border-gray-200" />
                <div>
                  <label className="text-[13px] font-semibold text-gray-800 block mb-1.5">🎨 Fill Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={getFill()} onChange={handleFillColor} className="w-16 h-10 rounded-lg" aria-label="Shape fill color" />
                    <span className="text-[14px] font-mono text-gray-600">{getFill()}</span>
                  </div>
                </div>
              </>)}

              {isPath && (<>
                <hr className="border-gray-200" />
                <div>
                  <label className="text-[13px] font-semibold text-gray-800 block mb-1.5">🖊️ Stroke Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={getStroke()} onChange={handleStrokeColor} className="w-16 h-10 rounded-lg" aria-label="Stroke color" />
                    <span className="text-[14px] font-mono text-gray-600">{getStroke()}</span>
                  </div>
                </div>
                {pathFills.length > 0 && (
                  <div>
                    <label className="text-[13px] font-semibold text-gray-800 block mb-1.5">🪣 Fills ({pathFills.length})</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {pathFills.map((f, i) => <div key={f.id || i} className="w-8 h-8 rounded border-2 border-gray-400" style={{ backgroundColor: f.color }} title={`${f.color} — ${f.width}×${f.height}px`} />)}
                    </div>
                    <button onClick={handleClearFills} className="text-[13px] px-3 py-1.5 border-2 border-amber-500 text-amber-700 font-medium rounded-md hover:bg-amber-50 transition-colors">Clear All Fills</button>
                  </div>
                )}
                {pathFills.length === 0 && <InfoBox color="blue">💡 To fill an enclosed area, use the <strong>🪣 Paint Bucket</strong> tool in the toolbar</InfoBox>}
              </>)}
            </div>

            <hr className="border-gray-200" />
            <InfoBox color="blue">
              💡 <strong>Tip:</strong> {hasCustomAnchor ? 'X/Y show pivot position. Object rotates around this point.' : 'X/Y show center position. Drag objects or type values, then click "Add Keyframe".'}
              {hasCustomAnchor && (<><br/><br/>🎯 Pivot at ({(ax*100).toFixed(0)}%, {(ay*100).toFixed(0)}%).</>)}
            </InfoBox>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 border border-gray-300 rounded-lg">
              <label className="text-[13px] font-semibold text-gray-800 block mb-2">🖼️ Canvas Background</label>
              <div className="flex items-center gap-3">
                <input type="color" value={canvasBgColor} onChange={(e) => setCanvasBgColor(e.target.value)} className="w-16 h-10 rounded-lg" aria-label="Canvas background color" />
                <span className="text-[14px] font-mono text-gray-600">{canvasBgColor}</span>
              </div>
              <p className="text-[13px] text-gray-500 mt-2">Changes apply to editor, preview, and exported code</p>
            </div>
            <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-[14px] text-gray-500">Select an object on the stage to view and edit its properties</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default PropertiesPanel;