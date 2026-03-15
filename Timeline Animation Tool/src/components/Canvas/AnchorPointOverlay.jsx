import React, { useEffect, useState, useCallback } from 'react';

import { 
  useSelectedObject, useFabricCanvas, useAnchorEditMode,
  useCanvasObjects, useKeyframes,
} from '../../store/hooks';
import { findFabricObjectById, changeAnchorPoint } from '../../utils/fabricHelpers';

const ANCHOR_COLOR = '#00E676';        
const ANCHOR_COLOR_BG = 'rgba(0, 230, 118, 0.9)'; 

const AnchorPointOverlay = () => {
  const [selectedObject] = useSelectedObject();
  const [fabricCanvas] = useFabricCanvas();
  const [anchorEditMode] = useAnchorEditMode();
  const [canvasObjects, setCanvasObjects] = useCanvasObjects();
  const [keyframes, setKeyframes] = useKeyframes();
  
  const [anchorPosition, setAnchorPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartAnchor, setDragStartAnchor] = useState(null);

  const getAnchorValues = useCallback(() => {
    const objectData = canvasObjects.find(obj => obj.id === selectedObject);
    return { anchorX: objectData?.anchorX ?? 0.5, anchorY: objectData?.anchorY ?? 0.5 };
  }, [canvasObjects, selectedObject]);

  const hasCustomAnchor = useCallback(() => {
    const { anchorX, anchorY } = getAnchorValues();
    return Math.abs(anchorX - 0.5) > 0.01 || Math.abs(anchorY - 0.5) > 0.01;
  }, [getAnchorValues]);

  useEffect(() => {
    const shouldTrack = fabricCanvas && selectedObject && (anchorEditMode || hasCustomAnchor());
    if (!shouldTrack) { setAnchorPosition(null); return; }

    const updateAnchorPosition = () => {
      const fabricObject = findFabricObjectById(fabricCanvas, selectedObject);
      if (!fabricObject) { setAnchorPosition(null); return; }
      const bound = fabricObject.getBoundingRect();
      const { anchorX, anchorY } = getAnchorValues();
      setAnchorPosition({
        x: bound.left + (bound.width * anchorX), y: bound.top + (bound.height * anchorY),
        boundLeft: bound.left, boundTop: bound.top, boundWidth: bound.width, boundHeight: bound.height,
      });
    };

    updateAnchorPosition();
    fabricCanvas.on('object:moving', updateAnchorPosition);
    fabricCanvas.on('object:scaling', updateAnchorPosition);
    fabricCanvas.on('object:rotating', updateAnchorPosition);
    fabricCanvas.on('after:render', updateAnchorPosition);

    return () => {
      fabricCanvas.off('object:moving', updateAnchorPosition);
      fabricCanvas.off('object:scaling', updateAnchorPosition);
      fabricCanvas.off('object:rotating', updateAnchorPosition);
      fabricCanvas.off('after:render', updateAnchorPosition);
    };
  }, [fabricCanvas, selectedObject, anchorEditMode, canvasObjects, getAnchorValues, hasCustomAnchor]);

  const updateKeyframesForAnchorChange = useCallback((objId, oldAx, oldAy, newAx, newAy, width, height) => {
    setKeyframes(prev => {
      if (!prev[objId] || prev[objId].length === 0) return prev;
      const updatedObjKfs = prev[objId].map(kf => {
        const { x, y, scaleX, scaleY, rotation } = kf.properties;
        const dx_local = (newAx - oldAx) * width * scaleX;
        const dy_local = (newAy - oldAy) * height * scaleY;
        const rad = rotation * Math.PI / 180;
        const dx_global = dx_local * Math.cos(rad) - dy_local * Math.sin(rad);
        const dy_global = dx_local * Math.sin(rad) + dy_local * Math.cos(rad);
        return { ...kf, properties: { ...kf.properties, x: x + dx_global, y: y + dy_global } };
      });
      return { ...prev, [objId]: updatedObjKfs };
    });
  }, [setKeyframes]);

  const handleMouseDown = (e) => {
    e.stopPropagation(); e.preventDefault();
    setIsDragging(true); setDragStartAnchor(getAnchorValues());
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !anchorPosition || !fabricCanvas || !selectedObject) return;
    const fabricObject = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fabricObject) return;
    const rect = fabricCanvas.getElement().getBoundingClientRect();
    const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
    const newAnchorX = Math.max(0, Math.min(1, (mouseX - anchorPosition.boundLeft) / anchorPosition.boundWidth));
    const newAnchorY = Math.max(0, Math.min(1, (mouseY - anchorPosition.boundTop) / anchorPosition.boundHeight));
    changeAnchorPoint(fabricObject, newAnchorX, newAnchorY);
    fabricCanvas.renderAll();
    setCanvasObjects(prev => prev.map(obj => obj.id === selectedObject ? { ...obj, anchorX: newAnchorX, anchorY: newAnchorY } : obj));
  }, [isDragging, anchorPosition, fabricCanvas, selectedObject, setCanvasObjects]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (dragStartAnchor && selectedObject && fabricCanvas) {
      const currentAnchor = getAnchorValues();
      if (Math.abs(currentAnchor.anchorX - dragStartAnchor.anchorX) > 0.001 || Math.abs(currentAnchor.anchorY - dragStartAnchor.anchorY) > 0.001) {
        const fabricObject = findFabricObjectById(fabricCanvas, selectedObject);
        if (fabricObject) updateKeyframesForAnchorChange(selectedObject, dragStartAnchor.anchorX, dragStartAnchor.anchorY, currentAnchor.anchorX, currentAnchor.anchorY, fabricObject.width, fabricObject.height);
      }
    }
    setDragStartAnchor(null);
  }, [dragStartAnchor, selectedObject, fabricCanvas, getAnchorValues, updateKeyframesForAnchorChange]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleDoubleClick = (e) => {
    e.stopPropagation(); e.preventDefault();
    if (!fabricCanvas || !selectedObject) return;
    const fabricObject = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fabricObject) return;
    const oldAnchor = getAnchorValues();
    changeAnchorPoint(fabricObject, 0.5, 0.5); fabricCanvas.renderAll();
    setCanvasObjects(prev => prev.map(obj => obj.id === selectedObject ? { ...obj, anchorX: 0.5, anchorY: 0.5 } : obj));
    updateKeyframesForAnchorChange(selectedObject, oldAnchor.anchorX, oldAnchor.anchorY, 0.5, 0.5, fabricObject.width, fabricObject.height);
  };

  if (!anchorPosition) return null;
  const { anchorX, anchorY } = getAnchorValues();
  const isCustom = hasCustomAnchor();

  if (!anchorEditMode) {
    if (!isCustom) return null;
    return (
      <>
        <div style={{ position: 'absolute', left: anchorPosition.x, top: anchorPosition.y, width: 18, height: 18, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 999 }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="6" fill="none" stroke="#000" strokeWidth="2.5" />
            <circle cx="9" cy="9" r="6" fill="none" stroke={ANCHOR_COLOR} strokeWidth="1.5" />
            <circle cx="9" cy="9" r="2.5" fill={ANCHOR_COLOR} stroke="#000" strokeWidth="0.8" />
            <line x1="9" y1="1" x2="9" y2="5" stroke="#000" strokeWidth="1.5" /><line x1="9" y1="13" x2="9" y2="17" stroke="#000" strokeWidth="1.5" />
            <line x1="1" y1="9" x2="5" y2="9" stroke="#000" strokeWidth="1.5" /><line x1="13" y1="9" x2="17" y2="9" stroke="#000" strokeWidth="1.5" />
            <line x1="9" y1="1" x2="9" y2="5" stroke={ANCHOR_COLOR} strokeWidth="0.8" /><line x1="9" y1="13" x2="9" y2="17" stroke={ANCHOR_COLOR} strokeWidth="0.8" />
            <line x1="1" y1="9" x2="5" y2="9" stroke={ANCHOR_COLOR} strokeWidth="0.8" /><line x1="13" y1="9" x2="17" y2="9" stroke={ANCHOR_COLOR} strokeWidth="0.8" />
          </svg>
        </div>
        <div style={{ position: 'absolute', left: anchorPosition.x + 12, top: anchorPosition.y - 20, background: ANCHOR_COLOR_BG, color: '#000', padding: '1px 4px', borderRadius: 4, fontSize: 9, fontWeight: 700, pointerEvents: 'none', zIndex: 999, whiteSpace: 'nowrap', border: '1px solid rgba(0,0,0,0.3)' }}>
          ⊕ {(anchorX * 100).toFixed(0)}%,{(anchorY * 100).toFixed(0)}%
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ position: 'absolute', left: anchorPosition.boundLeft - 2, top: anchorPosition.boundTop - 2, width: anchorPosition.boundWidth + 4, height: anchorPosition.boundHeight + 4, border: `2px dashed ${ANCHOR_COLOR}`, borderRadius: 2, pointerEvents: 'none', zIndex: 999, boxShadow: `0 0 6px ${ANCHOR_COLOR}40` }} />
      {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([cx, cy], i) => (
        <div key={i} style={{ position: 'absolute', left: anchorPosition.boundLeft + cx * anchorPosition.boundWidth - 4, top: anchorPosition.boundTop + cy * anchorPosition.boundHeight - 4, width: 8, height: 8, background: ANCHOR_COLOR, border: '1.5px solid #000', borderRadius: 1, pointerEvents: 'none', zIndex: 999 }} />
      ))}
      <div style={{ position: 'absolute', left: anchorPosition.x, top: anchorPosition.y, width: 26, height: 26, transform: 'translate(-50%, -50%)', cursor: isDragging ? 'grabbing' : 'grab', zIndex: 1000, pointerEvents: 'all' }} onMouseDown={handleMouseDown} onDoubleClick={handleDoubleClick}>
        <svg width="26" height="26" viewBox="0 0 26 26">
          <circle cx="13" cy="13" r="9" fill="none" stroke="#000" strokeWidth="3.5" /><circle cx="13" cy="13" r="9" fill="none" stroke={ANCHOR_COLOR} strokeWidth="2" />
          <circle cx="13" cy="13" r="3" fill={ANCHOR_COLOR} stroke="#000" strokeWidth="1" />
          <line x1="13" y1="0" x2="13" y2="26" stroke="#000" strokeWidth="3" /><line x1="0" y1="13" x2="26" y2="13" stroke="#000" strokeWidth="3" />
          <line x1="13" y1="0" x2="13" y2="26" stroke={ANCHOR_COLOR} strokeWidth="1.5" /><line x1="0" y1="13" x2="26" y2="13" stroke={ANCHOR_COLOR} strokeWidth="1.5" />
        </svg>
      </div>
      <div style={{ position: 'absolute', left: anchorPosition.x + 18, top: anchorPosition.y - 30, background: ANCHOR_COLOR_BG, color: '#000', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, pointerEvents: 'none', zIndex: 1001, whiteSpace: 'nowrap', border: '1px solid rgba(0,0,0,0.3)', letterSpacing: 0.3 }}>
        ⊕ Pivot: {(anchorX * 100).toFixed(0)}%, {(anchorY * 100).toFixed(0)}%
      </div>
    </>
  );
};

export default AnchorPointOverlay;