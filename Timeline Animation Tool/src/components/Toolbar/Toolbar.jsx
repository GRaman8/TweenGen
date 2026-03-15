import React, { useState, useRef } from 'react';
import { 
  TrashIcon, ChevronUpIcon, ChevronDownIcon,
  PaintBrushIcon, UserGroupIcon, CheckIcon, PhotoIcon, SwatchIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/24/outline';
import { Squares2X2Icon } from '@heroicons/react/24/solid';
import Tooltip from '../ui/Tooltip';
import { 
  useSelectedObject, useFabricCanvas, useCanvasObjects, useKeyframes,
  useHasActiveSelection, useDrawingMode, useAnchorEditMode, useTrackOrder,
  useFillToolActive, useFillToolColor,
} from '../../store/hooks';
import { ungroupFabricGroup } from '../../utils/fabricHelpers';
import { getShapeDef } from '../../utils/shapeDefinitions';
import ShapePicker from './ShapePicker';
import * as fabric from 'fabric';

const Toolbar = () => {
  const [selectedObject, setSelectedObject] = useSelectedObject();
  const [fabricCanvas] = useFabricCanvas();
  const [canvasObjects, setCanvasObjects] = useCanvasObjects();
  const [keyframes, setKeyframes] = useKeyframes();
  const [hasActiveSelection] = useHasActiveSelection();
  const [drawingMode, setDrawingMode] = useDrawingMode();
  const [anchorEditMode, setAnchorEditMode] = useAnchorEditMode();
  const [trackOrder, setTrackOrder] = useTrackOrder();
  const [fillToolActive, setFillToolActive] = useFillToolActive();
  const [fillToolColor, setFillToolColor] = useFillToolColor();
  const [strokeCount, setStrokeCount] = useState(0);
  const [shapePickerAnchor, setShapePickerAnchor] = useState(null);
  const shapeButtonRef = useRef(null);
  const fileInputRef = useRef(null);

  const canGroup = fabricCanvas?.getActiveObjects().length > 1;
  const canUngroup = React.useMemo(() => {
    if (!fabricCanvas || !selectedObject) return false;
    return fabricCanvas.getObjects().find(o => o.id === selectedObject)?.type === 'group';
  }, [fabricCanvas, selectedObject]);

  React.useEffect(() => {
    if (!drawingMode || !fabricCanvas) { setStrokeCount(0); return; }
    const interval = setInterval(() => { setStrokeCount(fabricCanvas._getStrokeCount?.() || 0); }, 200);
    return () => clearInterval(interval);
  }, [drawingMode, fabricCanvas]);

  const addShape = (shapeKey) => {
    if (!fabricCanvas) return;
    const shapeDef = getShapeDef(shapeKey); if (!shapeDef) return;
    const id = `element_${Date.now()}`; const count = canvasObjects.filter(obj => obj.type === shapeKey).length + 1;
    const name = `${shapeDef.label}_${count}`; const fill = shapeDef.defaultFill;
    const fabricObject = shapeDef.fabricCreate(id, fill); if (!fabricObject) return;
    fabricCanvas.add(fabricObject); fabricCanvas.setActiveObject(fabricObject); fabricCanvas.renderAll();
    const objData = { id, type: shapeKey, name, fill };
    if (shapeDef.renderMode === 'svg') objData.svgPath = shapeDef.svgPath;
    setCanvasObjects(prev => [...prev, objData]); setKeyframes(prev => ({ ...prev, [id]: [] }));
  };

  const addText = () => {
    if (!fabricCanvas) return;
    const id = `element_${Date.now()}`; const count = canvasObjects.filter(obj => obj.type === 'text').length + 1;
    const fo = new fabric.Text('Text', { id, left: 100, top: 100, originX: 'center', originY: 'center', fontSize: 24, fill: '#000000' });
    fabricCanvas.add(fo); fabricCanvas.setActiveObject(fo); fabricCanvas.renderAll();
    setCanvasObjects(prev => [...prev, { id, type: 'text', name: `text_${count}`, textContent: 'Text', fill: '#000000' }]);
    setKeyframes(prev => ({ ...prev, [id]: [] }));
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0]; if (!file || !fabricCanvas) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataURL = loadEvent.target.result; const imgEl = document.createElement('img');
      imgEl.onload = () => {
        const id = `element_${Date.now()}`; const count = canvasObjects.filter(obj => obj.type === 'image').length + 1;
        let initScale = 1; if (imgEl.naturalWidth > 300 || imgEl.naturalHeight > 300) initScale = 300 / Math.max(imgEl.naturalWidth, imgEl.naturalHeight);
        const fabricImg = new fabric.Image(imgEl, { id, left: 350, top: 250, originX: 'center', originY: 'center', scaleX: initScale, scaleY: initScale });
        fabricCanvas.add(fabricImg); fabricCanvas.setActiveObject(fabricImg); fabricCanvas.renderAll();
        setCanvasObjects(prev => [...prev, { id, type: 'image', name: `Image_${count}`, imageDataURL: dataURL, imageWidth: imgEl.naturalWidth, imageHeight: imgEl.naturalHeight }]);
        setKeyframes(prev => ({ ...prev, [id]: [] }));
      };
      imgEl.src = dataURL;
    };
    reader.readAsDataURL(file); event.target.value = '';
  };

  const groupObjects = () => {
    if (!fabricCanvas) return; const activeObjects = fabricCanvas.getActiveObjects(); if (activeObjects.length < 2) return;
    const objectsList = [...activeObjects]; const childIds = objectsList.map(obj => obj.id);
    fabricCanvas.discardActiveObject(); objectsList.forEach(obj => fabricCanvas.remove(obj));
    const group = new fabric.Group(objectsList, { id: `group_${Date.now()}`, originX: 'center', originY: 'center' });
    fabricCanvas.add(group); fabricCanvas.setActiveObject(group); fabricCanvas.renderAll();
    setKeyframes(prev => { const u = { ...prev }; childIds.forEach(c => { delete u[c]; }); u[group.id] = []; return u; });
    setCanvasObjects(prev => [...prev, { id: group.id, type: 'group', name: `Group_${canvasObjects.filter(obj => obj.type === 'group').length + 1}`, children: childIds }]);
    setSelectedObject(group.id);
  };

  const ungroupObjects = () => {
    if (!fabricCanvas || !selectedObject) return;
    const group = fabricCanvas.getObjects().find(obj => obj.id === selectedObject); if (!group || group.type !== 'group') return;
    const restoredItems = ungroupFabricGroup(fabricCanvas, group);
    if (restoredItems.length > 0) {
      setCanvasObjects(prev => prev.filter(obj => obj.id !== selectedObject));
      setKeyframes(prev => { const u = { ...prev }; delete u[selectedObject]; restoredItems.forEach(item => { if (item.id && u[item.id] === undefined) u[item.id] = []; }); return u; });
      setSelectedObject(null);
      setTimeout(() => { fabricCanvas.forEachObject(obj => { obj.visible = true; obj.selectable = true; obj.evented = true; obj.dirty = true; }); fabricCanvas.requestRenderAll(); }, 0);
    }
  };

  const deleteObject = () => {
    if (!fabricCanvas) return; const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length === 0 && selectedObject) { const fo = fabricCanvas.getObjects().find(obj => obj.id === selectedObject); if (fo) activeObjects.push(fo); }
    if (activeObjects.length === 0) return;
    activeObjects.forEach(fo => { if (fo?.id) {
      const objData = canvasObjects.find(obj => obj.id === fo.id); fabricCanvas.remove(fo);
      if (objData?.fills?.length > 0) { const fillIds = new Set(objData.fills.map(f => f.id)); fabricCanvas.getObjects().filter(o => o._isFill && fillIds.has(o.id)).forEach(fillImg => fabricCanvas.remove(fillImg)); }
      setCanvasObjects(prev => { if (objData?.type === 'group' && objData.children) return prev.filter(obj => obj.id !== fo.id && !objData.children.includes(obj.id)); return prev.filter(obj => obj.id !== fo.id); });
      setKeyframes(prev => { const u = { ...prev }; delete u[fo.id]; if (objData?.type === 'group' && objData.children) objData.children.forEach(c => { delete u[c]; }); return u; });
    } });
    fabricCanvas.discardActiveObject(); fabricCanvas.renderAll(); setSelectedObject(null);
  };

  const moveLayer = (direction) => {
    if (!fabricCanvas) return; let targetObject = null;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj?.id) targetObject = activeObj; else if (selectedObject) targetObject = fabricCanvas.getObjects().find(obj => obj.id === selectedObject);
    if (!targetObject) return;
    try { if (direction === 'up') { fabricCanvas.bringObjectForward?.(targetObject) || fabricCanvas.bringForward?.(targetObject); }
    else { fabricCanvas.sendObjectBackwards?.(targetObject) || fabricCanvas.sendBackwards?.(targetObject); } } catch (e) {}
    fabricCanvas.renderAll(); setTrackOrder([...fabricCanvas.getObjects()].filter(obj => obj.id).reverse().map(obj => obj.id));
  };

  const toggleDrawingMode = () => {
    if (!fabricCanvas) return; if (fillToolActive) setFillToolActive(false);
    if (drawingMode && fabricCanvas._commitDrawing) fabricCanvas._commitDrawing();
    setDrawingMode(!drawingMode);
    if (!drawingMode) { fabricCanvas.discardActiveObject(); fabricCanvas.renderAll(); setSelectedObject(null); }
  };

  const toggleFillTool = () => {
    if (drawingMode) { fabricCanvas?._commitDrawing?.(); setDrawingMode(false); }
    setFillToolActive(!fillToolActive);
  };

  // POUR: 44×44px min touch target, visible focus ring, high contrast icons
  const ToolBtn = ({ tip, onClick, disabled, active, danger, children, badge }) => (
    <Tooltip title={tip} placement="right">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={tip}
        aria-pressed={active || undefined}
        className={`
          relative flex items-center justify-center w-11 h-11 rounded-lg transition-all
          disabled:opacity-35 disabled:cursor-not-allowed
          ${active 
            ? 'bg-[#e3f2fd] text-[#1976d2] shadow-inner ring-1 ring-[#1976d2]/30' 
            : danger 
              ? 'text-[#d32f2f] hover:bg-red-50 active:bg-red-100' 
              : 'text-[#1976d2] hover:bg-gray-100 active:bg-gray-200'}
        `}
      >
        {children}
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {badge}
          </span>
        )}
      </button>
    </Tooltip>
  );

  return (
    <nav className="w-[72px] flex flex-col items-center py-2 gap-0.5 bg-white border-r border-gray-300 shrink-0 overflow-y-auto" 
      role="toolbar" aria-label="Canvas tools" aria-orientation="vertical">

      <ToolBtn tip="Add Shape" onClick={() => setShapePickerAnchor(shapeButtonRef.current)}>
        <span ref={shapeButtonRef}><Squares2X2Icon className="w-6 h-6" /></span>
      </ToolBtn>
      <ShapePicker anchorEl={shapePickerAnchor} open={Boolean(shapePickerAnchor)} onClose={() => setShapePickerAnchor(null)} onSelectShape={addShape} />

      <ToolBtn tip="Add Text" onClick={addText}>
        <span className="text-lg font-bold leading-none">T</span>
      </ToolBtn>

      <ToolBtn tip="Upload Image" onClick={() => fileInputRef.current?.click()}>
        <PhotoIcon className="w-6 h-6" />
      </ToolBtn>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} aria-hidden="true" />

      <ToolBtn tip={drawingMode ? 'Exit Drawing (ESC)' : 'Drawing Mode'} onClick={toggleDrawingMode} active={drawingMode} badge={strokeCount}>
        <PaintBrushIcon className="w-6 h-6" />
      </ToolBtn>

      {drawingMode && strokeCount > 0 && (
        <ToolBtn tip="Finish Drawing (Enter)" onClick={() => fabricCanvas?._commitDrawing?.()}>
          <CheckIcon className="w-6 h-6 text-green-700" />
        </ToolBtn>
      )}

      <ToolBtn tip={fillToolActive ? 'Exit Paint Bucket (ESC)' : 'Paint Bucket Fill'} onClick={toggleFillTool} active={fillToolActive}>
        <SwatchIcon className="w-6 h-6" />
      </ToolBtn>

      {fillToolActive && (
        <Tooltip title="Fill color" placement="right">
          <input type="color" value={fillToolColor} onChange={(e) => setFillToolColor(e.target.value)}
            className="w-10 h-10 rounded-lg" aria-label="Fill color picker" />
        </Tooltip>
      )}

      <ToolBtn tip={anchorEditMode ? 'Exit Anchor Mode' : 'Edit Anchor Point'} onClick={() => setAnchorEditMode(!anchorEditMode)} active={anchorEditMode} disabled={!selectedObject}>
        <ViewfinderCircleIcon className="w-6 h-6" />
      </ToolBtn>

      {/* Divider */}
      <div className="w-10 border-t border-gray-300 my-1.5" role="separator" />

      <ToolBtn tip="Group (Cmd/Ctrl+G)" onClick={groupObjects} disabled={!canGroup}>
        <UserGroupIcon className="w-6 h-6" />
      </ToolBtn>
      <ToolBtn tip="Ungroup (Cmd/Ctrl+Shift+G)" onClick={ungroupObjects} disabled={!canUngroup}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      </ToolBtn>

      <div className="w-10 border-t border-gray-300 my-1.5" role="separator" />

      <ToolBtn tip="Delete Selected" onClick={deleteObject} disabled={!hasActiveSelection} danger>
        <TrashIcon className="w-6 h-6" />
      </ToolBtn>
      <ToolBtn tip="Bring Forward" onClick={() => moveLayer('up')} disabled={!hasActiveSelection && !selectedObject}>
        <ChevronUpIcon className="w-6 h-6 text-gray-700" />
      </ToolBtn>
      <ToolBtn tip="Send Backward" onClick={() => moveLayer('down')} disabled={!hasActiveSelection && !selectedObject}>
        <ChevronDownIcon className="w-6 h-6 text-gray-700" />
      </ToolBtn>
    </nav>
  );
};

export default Toolbar;