import React, { useEffect, useRef, useState } from 'react';
import { Paper, Box, Typography, Chip } from '@mui/material';
import * as fabric from 'fabric';

import { 
  useSelectedObject, useFabricCanvas, useSelectedObjectProperties,
  useCurrentTime, useKeyframes, useCanvasObjects, useIsPlaying,
  useHasActiveSelection, useDrawingMode, useCurrentDrawingPath,
  useDrawingToolSettings, useCanvasBgColor, useSelectedKeyframe,
  useFillToolActive, useFillToolColor,
} from '../../store/hooks';

import { 
  extractPropertiesFromFabricObject, findFabricObjectById,
  createPathFromPoints, createCompoundPathFromStrokes, ungroupFabricGroup,
} from '../../utils/fabricHelpers';

import { 
  findSurroundingKeyframes, interpolateProperties, 
  applyPropertiesToFabricObject, applyZIndexOrdering,
} from '../../utils/interpolation';

import { performFloodFill } from '../../utils/floodFill';
import AnchorPointOverlay from './AnchorPointOverlay';

export const CANVAS_WIDTH = 1400;
export const CANVAS_HEIGHT = 800;

const getCanvasPointer = (canvas, nativeEvent) => {
  if (typeof canvas.getScenePoint === 'function') return canvas.getScenePoint(nativeEvent);
  if (typeof canvas.getPointer === 'function') return canvas.getPointer(nativeEvent);
  const rect = canvas.getElement().getBoundingClientRect();
  return { x: nativeEvent.clientX - rect.left, y: nativeEvent.clientY - rect.top };
};

const findParentPath = (fillResult, fabricCanvas, canvasObjects) => {
  const fillCX = fillResult.left + fillResult.width / 2;
  const fillCY = fillResult.top + fillResult.height / 2;
  let bestId = null;
  let bestArea = Infinity;

  for (const obj of canvasObjects) {
    if (obj.type !== 'path') continue;
    const fo = fabricCanvas.getObjects().find(o => o.id === obj.id);
    if (!fo) continue;
    const bounds = fo.getBoundingRect();
    const pad = 30;
    if (fillCX >= bounds.left - pad && fillCX <= bounds.left + bounds.width + pad &&
        fillCY >= bounds.top - pad && fillCY <= bounds.top + bounds.height + pad) {
      const area = bounds.width * bounds.height;
      if (area < bestArea) { bestArea = area; bestId = obj.id; }
    }
  }
  return bestId;
};

const Canvas = () => {
  const canvasRef = useRef(null);
  const [selectedObject, setSelectedObject] = useSelectedObject();
  const [fabricCanvas, setFabricCanvas] = useFabricCanvas();
  const [, setSelectedObjectProperties] = useSelectedObjectProperties();
  const [currentTime] = useCurrentTime();
  const [keyframes, setKeyframes] = useKeyframes();
  const [canvasObjects, setCanvasObjects] = useCanvasObjects();
  const [isPlaying] = useIsPlaying();
  const [, setHasActiveSelection] = useHasActiveSelection();
  const [drawingMode, setDrawingMode] = useDrawingMode();
  const [, setCurrentDrawingPath] = useCurrentDrawingPath();
  const [drawingSettings] = useDrawingToolSettings();
  const [canvasBgColor] = useCanvasBgColor();
  const [selectedKeyframe] = useSelectedKeyframe();
  const [fillToolActive, setFillToolActive] = useFillToolActive();
  const [fillToolColor] = useFillToolColor();
  
  const [isInteracting, setIsInteracting] = useState(false);
  const interactingObjectRef = useRef(null);

  const isDrawingRef = useRef(false);
  const drawingPointsRef = useRef([]);
  const tempPathRef = useRef(null);
  const committedStrokesRef = useRef([]);
  const committedStrokePathsRef = useRef([]);
  const [strokeCount, setStrokeCount] = useState(0);

  const canvasObjectsRef = useRef(canvasObjects);
  useEffect(() => { canvasObjectsRef.current = canvasObjects; }, [canvasObjects]);

  // FIX: Fills correctly inherit parent path transforms via trigonometry locking
  // Calculates absolute positioning if the object is inside an ActiveSelection (e.g., editing)
  const syncFillsForPath = (pathId) => {
    if (!fabricCanvas) return;
    
    // Find parent object (also search inside ActiveSelection if dragging)
    let parentFo = fabricCanvas.getObjects().find(o => o.id === pathId);
    if (!parentFo) {
      const activeObj = fabricCanvas.getActiveObject();
      if (activeObj && activeObj.type === 'activeSelection') {
        parentFo = activeObj._objects?.find(o => o.id === pathId);
      }
    }
    if (!parentFo) return;

    // Default to parent's direct transforms
    let absLeft = parentFo.left || 0;
    let absTop = parentFo.top || 0;
    let absScaleX = parentFo.scaleX || 1;
    let absScaleY = parentFo.scaleY || 1;
    let absAngle = parentFo.angle || 0;

    // If grouped temporarily (ActiveSelection edit mode), extract absolute canvas coordinates
    if (parentFo.group && parentFo.group.type === 'activeSelection') {
      const matrix = parentFo.calcTransformMatrix();
      const options = fabric.util.qrDecompose(matrix);
      absLeft = options.translateX;
      absTop = options.translateY;
      absScaleX = options.scaleX;
      absScaleY = options.scaleY;
      absAngle = options.angle;
    }

    fabricCanvas.getObjects().forEach(o => {
      if (o._isFill && o._parentId === pathId) {
        const rad = (absAngle || 0) * Math.PI / 180;
        const sx = absScaleX || 1;
        const sy = absScaleY || 1;
        const rx = (o._relLeft || 0) * sx;
        const ry = (o._relTop || 0) * sy;
        
        // Rotate the embedded fill offset by the absolute angle
        const tx = rx * Math.cos(rad) - ry * Math.sin(rad);
        const ty = rx * Math.sin(rad) + ry * Math.cos(rad);
        
        o.set({ 
          left: absLeft + tx, 
          top: absTop + ty,
          angle: absAngle,
          scaleX: sx,
          scaleY: sy
        });
        o.setCoords();
      }
    });
  };

  const syncAllFills = () => {
    if (!fabricCanvas) return;
    const pathIds = new Set();
    fabricCanvas.getObjects().forEach(o => { if (o._isFill && o._parentId) pathIds.add(o._parentId); });
    pathIds.forEach(pid => syncFillsForPath(pid));
  };

  // ==================== INIT ====================
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
      backgroundColor: canvasBgColor, selection: true,
      selectionColor: 'rgba(100, 100, 255, 0.3)',
      selectionBorderColor: 'rgba(50, 50, 200, 0.8)',
      selectionLineWidth: 2,
    });
    setFabricCanvas(canvas);

    canvas.on('selection:created', (e) => {
      setHasActiveSelection(true);
      if (e.selected?.length === 1) { setSelectedObject(e.selected[0].id); updateProps(e.selected[0]); }
      else if (e.selected?.length > 1) { setSelectedObject(null); updateProps(e.selected[0]); }
    });
    canvas.on('selection:updated', (e) => {
      setHasActiveSelection(true);
      if (e.selected?.length === 1) { setSelectedObject(e.selected[0].id); updateProps(e.selected[0]); }
      else if (e.selected?.length > 1) { setSelectedObject(null); updateProps(e.selected[0]); }
    });
    canvas.on('selection:cleared', () => { setHasActiveSelection(false); setSelectedObject(null); });
    
    // FIX: Bind all transformations directly to syncAllFills so they never detach
    canvas.on('object:moving', (e) => {
      if (e.target) {
        updateProps(e.target);
        syncAllFills();
        canvas.renderAll();
      }
    });
    canvas.on('object:scaling', (e) => { 
      if (e.target) {
        updateProps(e.target);
        syncAllFills();
        canvas.renderAll();
      }
    });
    canvas.on('object:rotating', (e) => { 
      if (e.target) {
        updateProps(e.target);
        syncAllFills();
        canvas.renderAll();
      }
    });
    canvas.on('object:modified', (e) => {
      if (e.target) {
        updateProps(e.target);
        if (e.target.type === 'path') {
          setCanvasObjects(prev => prev.map(obj => 
            obj.id === e.target.id ? { ...obj, pathData: e.target.path, strokeColor: e.target.stroke,
              strokeWidth: e.target.strokeWidth, boundingBox: { width: e.target.width, height: e.target.height },
              pathOffsetX: e.target.pathOffset?.x || 0, pathOffsetY: e.target.pathOffset?.y || 0,
            } : obj));
        }
        syncAllFills();
        canvas.renderAll();
      }
    });
    canvas.on('mouse:down', (e) => { if (e.target) { setIsInteracting(true); interactingObjectRef.current = e.target.id; } });
    canvas.on('mouse:up', () => { setIsInteracting(false); interactingObjectRef.current = null; });
    
    canvas.on('mouse:dblclick', (e) => {
      if (e.target && e.target.type === 'text') {
        const newText = prompt('Enter new text:', e.target.text);
        if (newText !== null && newText !== '') {
          e.target.set('text', newText); canvas.renderAll();
          setCanvasObjects(prev => prev.map(obj => obj.id === e.target.id ? { ...obj, textContent: newText } : obj));
        }
      }
    });
    return () => { canvas.dispose(); };
  }, []);

  const updateProps = (fabricObject) => {
    const props = extractPropertiesFromFabricObject(fabricObject);
    if (props) setSelectedObjectProperties(props);
  };

  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.backgroundColor = canvasBgColor;
    fabricCanvas.renderAll();
  }, [canvasBgColor, fabricCanvas]);

  useEffect(() => {
    if (!fabricCanvas || !selectedKeyframe || isPlaying || isInteracting || drawingMode || fillToolActive) return;
    
    // FIX: Clear ActiveSelection safely so keyframe scrubbing doesn't corrupt object positions
    if (fabricCanvas.getActiveObject()?.type === 'activeSelection') {
        fabricCanvas.discardActiveObject();
    }
    
    const { objectId, index } = selectedKeyframe;
    const objKfs = keyframes[objectId] || [];
    if (index < 0 || index >= objKfs.length) return;
    const kf = objKfs[index];
    const targetTime = kf.time;
    
    const fo = findFabricObjectById(fabricCanvas, objectId);
    if (fo && kf.properties) {
      fo.set({ left: kf.properties.x, top: kf.properties.y, scaleX: kf.properties.scaleX,
        scaleY: kf.properties.scaleY, angle: kf.properties.rotation, opacity: kf.properties.opacity });
      fo.setCoords();
      fabricCanvas.setActiveObject(fo);
    }
    
    canvasObjects.forEach(obj => {
      if (obj.id === objectId) return; 
      const otherKfs = keyframes[obj.id] || [];
      if (otherKfs.length === 0) return;
      const otherFo = findFabricObjectById(fabricCanvas, obj.id);
      if (!otherFo) return;
      
      const { before, after } = findSurroundingKeyframes(otherKfs, targetTime);
      if (before && after) {
        let easingType = 'linear';
        if (before !== after) easingType = after.easing || 'linear';
        const interpolated = interpolateProperties(before, after, targetTime, easingType);
        if (interpolated) {
          applyPropertiesToFabricObject(otherFo, interpolated);
          otherFo.setCoords();
        }
      }
    });
    
    syncAllFills();
    fabricCanvas.renderAll();
    const props = extractPropertiesFromFabricObject(fo);
    if (props) setSelectedObjectProperties(props);
  }, [selectedKeyframe, fabricCanvas, keyframes, isPlaying, drawingMode, fillToolActive, canvasObjects]);

  // ==================== PAINT BUCKET (FLOOD FILL) TOOL ====================
  useEffect(() => {
    if (!fabricCanvas || !fillToolActive) return;

    fabricCanvas.selection = false;
    fabricCanvas.forEachObject(obj => { obj.selectable = false; obj.evented = false; });
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();

    const handleFillClick = (e) => {
      const pointer = getCanvasPointer(fabricCanvas, e.e);
      const result = performFloodFill(fabricCanvas, CANVAS_WIDTH, CANVAS_HEIGHT, pointer.x, pointer.y, fillToolColor, 40);
      if (!result) return;

      const parentId = findParentPath(result, fabricCanvas, canvasObjectsRef.current);

      const imgEl = new Image();
      imgEl.onload = () => {
        let relLeft = 0, relTop = 0;
        if (parentId) {
          const parentFo = fabricCanvas.getObjects().find(o => o.id === parentId);
          if (parentFo) {
            relLeft = result.left - parentFo.left;
            relTop = result.top - parentFo.top;
          }
        }

        const fillImgId = `_fill_${Date.now()}`;
        const fabricImg = new fabric.Image(imgEl, {
          left: result.left, top: result.top, width: result.width, height: result.height,
          originX: 'left', originY: 'top', selectable: false, evented: false, id: fillImgId,
        });
        fabricImg._isFill = true; fabricImg._parentId = parentId;
        fabricImg._relLeft = relLeft; fabricImg._relTop = relTop;

        fabricCanvas.add(fabricImg);
        try {
          if (typeof fabricCanvas.sendObjectToBack === 'function') fabricCanvas.sendObjectToBack(fabricImg);
          else if (typeof fabricCanvas.sendToBack === 'function') fabricCanvas.sendToBack(fabricImg);
        } catch(err) {}
        fabricCanvas.renderAll();

        if (parentId) {
          setCanvasObjects(prev => prev.map(obj =>
            obj.id === parentId
              ? { ...obj, fills: [...(obj.fills || []), {
                  id: fillImgId, dataURL: result.dataURL, left: result.left, top: result.top,
                  width: result.width, height: result.height, color: fillToolColor, relLeft, relTop,
                }]}
              : obj
          ));
        } else {
          console.warn('Paint bucket: no parent path found near click.');
        }
      };
      imgEl.src = result.dataURL;
    };

    const handleKeyDown = (e) => { if (e.key === 'Escape') setFillToolActive(false); };

    fabricCanvas.on('mouse:down', handleFillClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      fabricCanvas.off('mouse:down', handleFillClick);
      window.removeEventListener('keydown', handleKeyDown);
      if (fabricCanvas) {
        fabricCanvas.selection = true;
        fabricCanvas.forEachObject(obj => { if (!obj._isFill) { obj.selectable = true; obj.evented = true; } });
        fabricCanvas.renderAll();
      }
    };
  }, [fabricCanvas, fillToolActive, fillToolColor, setCanvasObjects, setFillToolActive]);

  const commitDrawing = () => {
    if (!fabricCanvas) return;
    const strokes = committedStrokesRef.current;
    if (strokes.length === 0) return;
    committedStrokePathsRef.current.forEach(p => { try { fabricCanvas.remove(p); } catch(e) {} });
    committedStrokePathsRef.current = [];
    const id = `path_${Date.now()}`;
    const count = canvasObjects.filter(obj => obj.type === 'path').length + 1;
    const name = `Drawing_${count}`;
    let pathObject;
    if (strokes.length === 1) pathObject = createPathFromPoints(strokes[0], id, drawingSettings);
    else pathObject = createCompoundPathFromStrokes(strokes, id, drawingSettings);
    if (pathObject) {
      fabricCanvas.add(pathObject); fabricCanvas.setActiveObject(pathObject); fabricCanvas.renderAll();
      const pathOffsetX = pathObject.pathOffset?.x || 0;
      const pathOffsetY = pathObject.pathOffset?.y || 0;
      
      setCanvasObjects(prev => [...prev, { 
        id, type: 'path', name, pathData: pathObject.path,
        strokeColor: drawingSettings.color, strokeWidth: drawingSettings.strokeWidth, fillColor: '',
        boundingBox: { width: pathObject.width, height: pathObject.height },
        pathOffsetX, pathOffsetY,
      }]);
      setKeyframes(prev => ({ ...prev, [id]: [] }));
    }
    committedStrokesRef.current = []; setStrokeCount(0);
  };

  const cancelDrawing = () => {
    if (!fabricCanvas) return;
    committedStrokePathsRef.current.forEach(p => { try { fabricCanvas.remove(p); } catch(e) {} });
    committedStrokePathsRef.current = []; committedStrokesRef.current = [];
    if (tempPathRef.current) { fabricCanvas.remove(tempPathRef.current); tempPathRef.current = null; }
    isDrawingRef.current = false; drawingPointsRef.current = []; setStrokeCount(0);
    fabricCanvas.renderAll();
  };

  useEffect(() => {
    if (fabricCanvas) {
      fabricCanvas._commitDrawing = commitDrawing;
      fabricCanvas._cancelDrawing = cancelDrawing;
      fabricCanvas._getStrokeCount = () => committedStrokesRef.current.length;
    }
  }, [fabricCanvas, canvasObjects, drawingSettings]);

  useEffect(() => {
    if (!fabricCanvas) return;

    const handleMouseDown = (e) => {
      if (!drawingMode) return;
      const pointer = getCanvasPointer(fabricCanvas, e.e);
      isDrawingRef.current = true;
      drawingPointsRef.current = [{ x: pointer.x, y: pointer.y }];
      tempPathRef.current = new fabric.Path(`M ${pointer.x} ${pointer.y}`, {
        stroke: drawingSettings.color, strokeWidth: drawingSettings.strokeWidth,
        fill: '', strokeLineCap: 'round', strokeLineJoin: 'round', selectable: false, evented: false,
      });
      fabricCanvas.add(tempPathRef.current);
    };

    const handleMouseMove = (e) => {
      if (!drawingMode || !isDrawingRef.current) return;
      const pointer = getCanvasPointer(fabricCanvas, e.e);
      drawingPointsRef.current.push({ x: pointer.x, y: pointer.y });
      if (tempPathRef.current) {
        fabricCanvas.remove(tempPathRef.current);
        let pathString = `M ${drawingPointsRef.current[0].x} ${drawingPointsRef.current[0].y}`;
        for (let i = 1; i < drawingPointsRef.current.length; i++) {
          pathString += ` L ${drawingPointsRef.current[i].x} ${drawingPointsRef.current[i].y}`;
        }
        tempPathRef.current = new fabric.Path(pathString, {
          stroke: drawingSettings.color, strokeWidth: drawingSettings.strokeWidth,
          fill: '', strokeLineCap: 'round', strokeLineJoin: 'round', selectable: false, evented: false,
        });
        fabricCanvas.add(tempPathRef.current); fabricCanvas.renderAll();
      }
    };

    const handleMouseUp = () => {
      if (!drawingMode || !isDrawingRef.current) return;
      isDrawingRef.current = false;
      if (tempPathRef.current) { fabricCanvas.remove(tempPathRef.current); tempPathRef.current = null; }
      if (drawingPointsRef.current.length > 2) {
        const points = [...drawingPointsRef.current];
        committedStrokesRef.current.push(points);
        setStrokeCount(committedStrokesRef.current.length);
        const previewPath = createPathFromPoints(points, `preview_${Date.now()}`, { ...drawingSettings, color: drawingSettings.color });
        if (previewPath) {
          previewPath.set({ selectable: false, evented: false, opacity: 0.6 });
          fabricCanvas.add(previewPath); committedStrokePathsRef.current.push(previewPath); fabricCanvas.renderAll();
        }
      }
      drawingPointsRef.current = [];
    };

    const handleKeyDown = (e) => {
      if (!drawingMode) return;
      if (e.key === 'Enter') { e.preventDefault(); commitDrawing(); return; }
      if (e.key === 'Escape') { cancelDrawing(); setDrawingMode(false); return; }
    };

    if (drawingMode) {
      fabricCanvas.selection = false;
      fabricCanvas.forEachObject(obj => { if (!obj.id?.startsWith('preview_')) { obj.selectable = false; obj.evented = false; } });
      fabricCanvas.on('mouse:down', handleMouseDown);
      fabricCanvas.on('mouse:move', handleMouseMove);
      fabricCanvas.on('mouse:up', handleMouseUp);
      window.addEventListener('keydown', handleKeyDown);
    } else {
      if (committedStrokesRef.current.length > 0) commitDrawing();
      fabricCanvas.selection = true;
      fabricCanvas.forEachObject(obj => { if (!obj._isFill) { obj.selectable = true; obj.evented = true; } });
      fabricCanvas.off('mouse:down', handleMouseDown);
      fabricCanvas.off('mouse:move', handleMouseMove);
      fabricCanvas.off('mouse:up', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      fabricCanvas.renderAll();
    }

    return () => {
      fabricCanvas.off('mouse:down', handleMouseDown);
      fabricCanvas.off('mouse:move', handleMouseMove);
      fabricCanvas.off('mouse:up', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      if (fabricCanvas) {
        fabricCanvas.selection = true;
        fabricCanvas.forEachObject(obj => { if (!obj._isFill) { obj.selectable = true; obj.evented = true; } });
      }
    };
  }, [fabricCanvas, drawingMode, drawingSettings, canvasObjects, setCanvasObjects, setKeyframes, setDrawingMode]);

  useEffect(() => {
    if (!fabricCanvas || isInteracting) return;
    fabricCanvas.forEachObject(obj => {
      if (!obj._isFill) { obj.visible = true; obj.opacity = obj.opacity || 1; }
    });
    if (selectedObject && !isPlaying && !drawingMode && !fillToolActive) {
      const fo = findFabricObjectById(fabricCanvas, selectedObject);
      if (fo && fabricCanvas.getActiveObject() !== fo) fabricCanvas.setActiveObject(fo);
    }
    if (isPlaying) {
      if (fabricCanvas.getActiveObject()) {
          fabricCanvas.discardActiveObject();
      }

      canvasObjects.forEach(obj => {
        const objKfs = keyframes[obj.id] || [];
        if (objKfs.length === 0) return;
        const fo = findFabricObjectById(fabricCanvas, obj.id);
        if (!fo) return;
        const { before, after } = findSurroundingKeyframes(objKfs, currentTime);
        let easingType = 'linear';
        if (before && after && before !== after) easingType = after.easing || 'linear';
        const interpolated = interpolateProperties(before, after, currentTime, easingType);
        if (interpolated) {
            applyPropertiesToFabricObject(fo, interpolated);
            fo.setCoords();
        }
      });
      applyZIndexOrdering(fabricCanvas);
    }
    // FIX: Always sync fills so they follow parent paths during scrubbing/editing,
    // not just during playback. This ensures painted fills (e.g., red stickman head)
    // stay attached when moving objects to set up new keyframes.
    syncAllFills();
    fabricCanvas.renderAll();
  }, [currentTime, keyframes, canvasObjects, fabricCanvas, isInteracting, selectedObject, isPlaying, drawingMode, fillToolActive]);

  useEffect(() => {
    if (!fabricCanvas || isInteracting) return;
    if (selectedObject && !isPlaying && !drawingMode && !fillToolActive) {
      const fo = findFabricObjectById(fabricCanvas, selectedObject);
      if (fo && fabricCanvas.getActiveObject() !== fo) { fabricCanvas.setActiveObject(fo); fabricCanvas.renderAll(); }
    }
    const handleKeyDown = (e) => {
      if (drawingMode || fillToolActive) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        const activeObjects = fabricCanvas.getActiveObjects();
        if (activeObjects.length > 1) {
          const objectsList = [...activeObjects];
          const childIds = objectsList.map(obj => obj.id);
          fabricCanvas.discardActiveObject();
          objectsList.forEach(obj => fabricCanvas.remove(obj));
          const group = new fabric.Group(objectsList, { id: `group_${Date.now()}`, originX: 'center', originY: 'center' });
          fabricCanvas.add(group); fabricCanvas.setActiveObject(group); fabricCanvas.renderAll();
          const groupCount = canvasObjects.filter(obj => obj.type === 'group').length + 1;
          setKeyframes(prev => { const u = { ...prev }; childIds.forEach(c => { delete u[c]; }); u[group.id] = []; return u; });
          setCanvasObjects(prev => [...prev, { id: group.id, type: 'group', name: `Group_${groupCount}`, children: childIds }]);
          setSelectedObject(group.id);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        if (!selectedObject) return;
        const group = fabricCanvas.getObjects().find(obj => obj.id === selectedObject);
        if (!group || group.type !== 'group') return;
        const restoredItems = ungroupFabricGroup(fabricCanvas, group);
        if (restoredItems.length > 0) {
          setCanvasObjects(prev => prev.filter(obj => obj.id !== selectedObject));
          setKeyframes(prev => { const u = { ...prev }; delete u[selectedObject]; restoredItems.forEach(item => { if (item.id && u[item.id] === undefined) u[item.id] = []; }); return u; });
          setSelectedObject(null);
          setTimeout(() => { fabricCanvas.forEachObject(obj => { if (!obj._isFill) { obj.visible = true; obj.selectable = true; obj.evented = true; obj.dirty = true; } }); fabricCanvas.requestRenderAll(); }, 0);
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObjects = fabricCanvas.getActiveObjects();
        if (activeObjects.length > 0) {
          e.preventDefault();
          activeObjects.forEach(fo => {
            if (fo?.id) {
              const objData = canvasObjects.find(obj => obj.id === fo.id);
              fabricCanvas.remove(fo);
              if (objData?.fills?.length > 0) {
                const fillIds = new Set(objData.fills.map(f => f.id));
                fabricCanvas.getObjects().filter(o => o._isFill && fillIds.has(o.id))
                  .forEach(fillImg => fabricCanvas.remove(fillImg));
              }
              setCanvasObjects(prev => {
                if (objData?.type === 'group' && objData.children) return prev.filter(obj => obj.id !== fo.id && !objData.children.includes(obj.id));
                return prev.filter(obj => obj.id !== fo.id);
              });
              setKeyframes(prev => { const u = { ...prev }; delete u[fo.id]; if (objData?.type === 'group' && objData.children) objData.children.forEach(c => { delete u[c]; }); return u; });
            }
          });
          fabricCanvas.discardActiveObject(); fabricCanvas.renderAll(); setSelectedObject(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fabricCanvas, drawingMode, fillToolActive, canvasObjects, setCanvasObjects, setKeyframes, setSelectedObject, selectedObject]);

  const activeToolLabel = fillToolActive ? '🪣 Paint Bucket Mode' : drawingMode ? '🎨 Drawing Mode' : null;

  return (
    <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {activeToolLabel && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1,
          bgcolor: fillToolActive ? 'info.light' : 'warning.light', borderRadius: 1, width: '100%', maxWidth: CANVAS_WIDTH }}>
          <Typography variant="body2" fontWeight={600}>{activeToolLabel}</Typography>
          {drawingMode && strokeCount > 0 && <Chip label={`${strokeCount} stroke${strokeCount !== 1 ? 's' : ''}`} size="small" color="primary" />}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {fillToolActive
              ? 'Click on an enclosed region to fill it • Press ESC to exit'
              : 'Draw strokes • Press Enter to finish • Esc to cancel'}
          </Typography>
        </Box>
      )}
      <Paper elevation={3} sx={{ display: 'inline-block', position: 'relative' }}>
        <canvas ref={canvasRef} />
        <AnchorPointOverlay />
      </Paper>
    </Box>
  );
};

export default Canvas;