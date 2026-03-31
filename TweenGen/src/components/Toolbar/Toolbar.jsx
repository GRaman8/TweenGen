import React, { useState, useRef } from 'react';

import { 
  Box, IconButton, Divider, Tooltip, Paper, Button, Badge,
} from '@mui/material';

import {
  TextFields as TextIcon,
  Delete as DeleteIcon, KeyboardArrowUp as ArrowUpIcon, KeyboardArrowDown as ArrowDownIcon,
  Brush as BrushIcon, GroupAdd as GroupIcon, GroupRemove as UngroupIcon,
  GpsFixed as AnchorIcon, Check as CheckIcon, FormatColorFill as FillIcon,
  AddPhotoAlternate as ImageIcon,
  Category as ShapesIcon,
  ContentCopy as DuplicateIcon,
  AudioFile as AudioIcon,
} from '@mui/icons-material';

import { 
  useSelectedObject, useFabricCanvas, useCanvasObjects, useKeyframes,
  useHasActiveSelection, useDrawingMode, useAnchorEditMode, useTrackOrder,
  useFillToolActive, useFillToolColor,
} from '../../store/hooks';
import { useAudioFile, useAudioWaveform } from '../../store/audioHooks';

import { ungroupFabricGroup, findFabricObjectById } from '../../utils/fabricHelpers';
import { generateWaveformPeaks } from '../../utils/audioUtils';
import { getShapeDef } from '../../utils/shapeDefinitions';
import ShapePicker from './ShapePicker';
import TextInputDialog from './TextInputDialog';
import * as fabric from 'fabric';

/**
 * Convert a Fabric.js path array back to an SVG path string.
 */
const fabricPathToSVGPathString = (pathArray) => {
  if (!pathArray || !Array.isArray(pathArray)) return '';
  let s = '';
  pathArray.forEach(seg => {
    if (Array.isArray(seg)) {
      s += seg[0] + ' ' + seg.slice(1).join(' ') + ' ';
    }
  });
  return s.trim();
};

/**
 * Clone a single fabric child object with a new ID, preserving all
 * type-specific properties and relative position within the group.
 */
const cloneFabricChild = (fc, newChildId) => {
  const common = {
    id: newChildId,
    left: fc.left || 0,
    top: fc.top || 0,
    scaleX: fc.scaleX || 1,
    scaleY: fc.scaleY || 1,
    angle: fc.angle || 0,
    opacity: fc.opacity ?? 1,
    originX: fc.originX || 'center',
    originY: fc.originY || 'center',
  };

  const fabricType = fc.type;

  if (fabricType === 'rect') {
    return new fabric.Rect({
      ...common,
      width: fc.width || 100, height: fc.height || 100,
      rx: fc.rx || 0, ry: fc.ry || 0,
      fill: fc.fill || '#3b82f6',
      stroke: fc.stroke || null, strokeWidth: fc.strokeWidth || 0,
    });
  }
  if (fabricType === 'circle') {
    return new fabric.Circle({
      ...common,
      radius: fc.radius || 50,
      fill: fc.fill || '#ef4444',
      stroke: fc.stroke || null, strokeWidth: fc.strokeWidth || 0,
    });
  }
  if (fabricType === 'ellipse') {
    return new fabric.Ellipse({
      ...common,
      rx: fc.rx || 50, ry: fc.ry || 38,
      fill: fc.fill || '#a855f7',
      stroke: fc.stroke || null, strokeWidth: fc.strokeWidth || 0,
    });
  }
  if (fabricType === 'polygon') {
    const points = (fc.points || []).map(p => ({ x: p.x, y: p.y }));
    return new fabric.Polygon(points, {
      ...common,
      fill: fc.fill || '#000000',
      stroke: fc.stroke || null, strokeWidth: fc.strokeWidth || 0,
    });
  }
  if (fabricType === 'path') {
    const pathString = fabricPathToSVGPathString(fc.path);
    if (!pathString) return null;
    return new fabric.Path(pathString, {
      ...common,
      fill: fc.fill || '',
      stroke: fc.stroke || '#000000',
      strokeWidth: fc.strokeWidth || 3,
      strokeLineCap: 'round', strokeLineJoin: 'round',
    });
  }
  if (fabricType === 'text' || fabricType === 'i-text' || fabricType === 'textbox') {
    return new fabric.Text(fc.text || 'Text', {
      ...common,
      fontSize: fc.fontSize || 24,
      fill: fc.fill || '#000000',
      stroke: fc.stroke || null, strokeWidth: fc.strokeWidth || 0,
    });
  }
  // image — handled separately (async)
  return null;
};

/**
 * Build the canvasObjects entry for a cloned child.
 */
const buildChildObjData = (srcChildData, newChildId) => {
  if (!srcChildData) return null;

  const base = {
    id: newChildId,
    type: srcChildData.type,
    name: `${srcChildData.name || srcChildData.type}_copy`,
    fill: srcChildData.fill,
  };

  if (srcChildData.outlineWidth) {
    base.outlineWidth = srcChildData.outlineWidth;
    base.outlineColor = srcChildData.outlineColor || '#000000';
  }
  if (srcChildData.svgPath) base.svgPath = srcChildData.svgPath;
  if (srcChildData.textContent) base.textContent = srcChildData.textContent;

  if (srcChildData.type === 'path') {
    base.pathData = srcChildData.pathData;
    base.strokeColor = srcChildData.strokeColor;
    base.strokeWidth = srcChildData.strokeWidth;
    base.fillColor = srcChildData.fillColor || '';
    base.boundingBox = srcChildData.boundingBox ? { ...srcChildData.boundingBox } : undefined;
    base.pathOffsetX = srcChildData.pathOffsetX;
    base.pathOffsetY = srcChildData.pathOffsetY;
    base.fills = []; // Filled by caller
  }
  if (srcChildData.type === 'image') {
    base.imageDataURL = srcChildData.imageDataURL;
    base.imageWidth = srcChildData.imageWidth;
    base.imageHeight = srcChildData.imageHeight;
    base.svgExportMode = srcChildData.svgExportMode;
    base.svgTracedData = srcChildData.svgTracedData;
    base.svgTracePreset = srcChildData.svgTracePreset;
    base.vectorPreviewURL = srcChildData.vectorPreviewURL;
  }

  return base;
};


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

  const [audioFile, setAudioFile] = useAudioFile();
  const [, setAudioWaveform] = useAudioWaveform();

  const [shapePickerAnchor, setShapePickerAnchor] = useState(null);
  const shapeButtonRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);

  // Text input dialog state
  const [textDialogOpen, setTextDialogOpen] = useState(false);

  const canGroup = fabricCanvas?.getActiveObjects().length > 1;
  
  const canUngroup = React.useMemo(() => {
    if (!fabricCanvas || !selectedObject) return false;
    const obj = fabricCanvas.getObjects().find(o => o.id === selectedObject);
    return obj?.type === 'group';
  }, [fabricCanvas, selectedObject]);

  React.useEffect(() => {
    if (!drawingMode || !fabricCanvas) { setStrokeCount(0); return; }
    const interval = setInterval(() => { setStrokeCount(fabricCanvas._getStrokeCount?.() || 0); }, 200);
    return () => clearInterval(interval);
  }, [drawingMode, fabricCanvas]);

  // ===== ADD SHAPE =====
  const addShape = (shapeKey) => {
    if (!fabricCanvas) return;
    const shapeDef = getShapeDef(shapeKey);
    if (!shapeDef) return;
    const id = `element_${Date.now()}`;
    const count = canvasObjects.filter(obj => obj.type === shapeKey).length + 1;
    const name = `${shapeDef.label}_${count}`;
    const fill = shapeDef.defaultFill;
    const fabricObject = shapeDef.fabricCreate(id, fill);
    if (!fabricObject) return;
    fabricCanvas.add(fabricObject); fabricCanvas.setActiveObject(fabricObject); fabricCanvas.renderAll();
    const objData = { id, type: shapeKey, name, fill };
    if (shapeDef.renderMode === 'svg') objData.svgPath = shapeDef.svgPath;
    setCanvasObjects(prev => [...prev, objData]);
    setKeyframes(prev => ({ ...prev, [id]: [] }));
  };

  // ===== ADD TEXT (via dialog) =====
  const handleAddTextSubmit = ({ text, fontSize, color }) => {
    if (!fabricCanvas) return;
    const id = `element_${Date.now()}`;
    const count = canvasObjects.filter(obj => obj.type === 'text').length + 1;
    const name = `text_${count}`;
    const fabricObject = new fabric.Text(text, {
      id, left: 350, top: 250, originX: 'center', originY: 'center',
      fontSize: fontSize, fill: color,
    });
    fabricCanvas.add(fabricObject); fabricCanvas.setActiveObject(fabricObject); fabricCanvas.renderAll();
    setCanvasObjects(prev => [...prev, { id, type: 'text', name, textContent: text, fill: color }]);
    setKeyframes(prev => ({ ...prev, [id]: [] }));
  };

  // ===== IMAGE UPLOAD =====
  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !fabricCanvas) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataURL = loadEvent.target.result;
      const imgEl = document.createElement('img');
      imgEl.onload = () => {
        const id = `element_${Date.now()}`;
        const count = canvasObjects.filter(obj => obj.type === 'image').length + 1;
        const name = `Image_${count}`;
        let initScale = 1;
        const maxDim = 300;
        if (imgEl.naturalWidth > maxDim || imgEl.naturalHeight > maxDim) {
          initScale = maxDim / Math.max(imgEl.naturalWidth, imgEl.naturalHeight);
        }
        const fabricImg = new fabric.Image(imgEl, {
          id, left: 350, top: 250, originX: 'center', originY: 'center', scaleX: initScale, scaleY: initScale,
        });
        fabricCanvas.add(fabricImg); fabricCanvas.setActiveObject(fabricImg); fabricCanvas.renderAll();
        setCanvasObjects(prev => [...prev, {
          id, type: 'image', name, imageDataURL: dataURL,
          imageWidth: imgEl.naturalWidth, imageHeight: imgEl.naturalHeight,
        }]);
        setKeyframes(prev => ({ ...prev, [id]: [] }));
      };
      imgEl.src = dataURL;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  // ===== AUDIO UPLOAD =====
  const handleAudioUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { peaks, duration: audioDuration } = await generateWaveformPeaks(arrayBuffer, 300);
      setAudioFile({ dataURL, fileName: file.name, mimeType: file.type || 'audio/mpeg', arrayBuffer, duration: audioDuration });
      setAudioWaveform(peaks);
    } catch (err) {
      console.error('Audio upload failed:', err);
      alert('Failed to load audio file. Please try an MP3, WAV, or OGG file.');
    }
    event.target.value = '';
  };

  // ===== DUPLICATE OBJECT =====
  const duplicateObject = () => {
    if (!fabricCanvas || !selectedObject) return;
    const objData = canvasObjects.find(obj => obj.id === selectedObject);
    if (!objData) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    const newId = `element_${Date.now()}`;
    const count = canvasObjects.filter(obj => obj.type === objData.type).length + 1;
    const offset = 30;

    // Read outline from the source
    const srcStroke = fo.stroke || null;
    const srcStrokeWidth = fo.strokeWidth || 0;
    const srcOutlineWidth = objData.outlineWidth || 0;
    const srcOutlineColor = objData.outlineColor || '#000000';

    if (objData.type === 'image') {
      const imgEl = document.createElement('img');
      imgEl.onload = () => {
        const newImg = new fabric.Image(imgEl, {
          id: newId, left: (fo.left || 350) + offset, top: (fo.top || 250) + offset,
          originX: 'center', originY: 'center', scaleX: fo.scaleX || 1, scaleY: fo.scaleY || 1,
          angle: fo.angle || 0, opacity: fo.opacity ?? 1,
        });
        fabricCanvas.add(newImg); fabricCanvas.setActiveObject(newImg); fabricCanvas.renderAll();
        setCanvasObjects(prev => [...prev, {
          id: newId, type: 'image', name: `Image_${count}`,
          imageDataURL: objData.imageDataURL, imageWidth: objData.imageWidth, imageHeight: objData.imageHeight,
          svgExportMode: objData.svgExportMode, svgTracedData: objData.svgTracedData,
          svgTracePreset: objData.svgTracePreset, vectorPreviewURL: objData.vectorPreviewURL,
        }]);
        setKeyframes(prev => ({ ...prev, [newId]: [] }));
        setSelectedObject(newId);
      };
      imgEl.src = (objData.svgExportMode === 'vector' && objData.vectorPreviewURL)
        ? objData.vectorPreviewURL : objData.imageDataURL;

    } else if (objData.type === 'text') {
      const textContent = fo.text || objData.textContent || 'Text';
      const fillColor = fo.fill || objData.fill || '#000000';
      const newText = new fabric.Text(textContent, {
        id: newId, left: (fo.left || 100) + offset, top: (fo.top || 100) + offset,
        originX: 'center', originY: 'center', fontSize: fo.fontSize || 24,
        fill: fillColor, angle: fo.angle || 0, opacity: fo.opacity ?? 1,
        scaleX: fo.scaleX || 1, scaleY: fo.scaleY || 1,
        stroke: srcStroke, strokeWidth: srcStrokeWidth,
      });
      fabricCanvas.add(newText); fabricCanvas.setActiveObject(newText); fabricCanvas.renderAll();
      setCanvasObjects(prev => [...prev, {
        id: newId, type: 'text', name: `text_${count}`, textContent, fill: fillColor,
        outlineWidth: srcOutlineWidth, outlineColor: srcOutlineColor,
      }]);
      setKeyframes(prev => ({ ...prev, [newId]: [] }));
      setSelectedObject(newId);

    } else if (objData.type === 'path') {
      const pathString = fabricPathToSVGPathString(fo.path);
      if (!pathString) return;
      const newPath = new fabric.Path(pathString, {
        id: newId, left: (fo.left || 350) + offset, top: (fo.top || 250) + offset,
        originX: 'center', originY: 'center',
        scaleX: fo.scaleX || 1, scaleY: fo.scaleY || 1,
        angle: fo.angle || 0, opacity: fo.opacity ?? 1,
        stroke: fo.stroke || objData.strokeColor || '#000000',
        strokeWidth: fo.strokeWidth || objData.strokeWidth || 3,
        fill: fo.fill || '', strokeLineCap: 'round', strokeLineJoin: 'round', selectable: true,
      });
      fabricCanvas.add(newPath);

      const newFills = [];
      if (objData.fills && objData.fills.length > 0) {
        objData.fills.forEach((fillData, idx) => {
          const fillImgEl = new Image();
          const newFillId = `_fill_${Date.now()}_${idx}`;
          fillImgEl.onload = () => {
            const fillFabricImg = new fabric.Image(fillImgEl, {
              left: (fillData.left || 0) + offset, top: (fillData.top || 0) + offset,
              width: fillData.width, height: fillData.height,
              originX: 'left', originY: 'top', selectable: false, evented: false, id: newFillId,
            });
            fillFabricImg._isFill = true; fillFabricImg._parentId = newId;
            fillFabricImg._relLeft = fillData.relLeft; fillFabricImg._relTop = fillData.relTop;
            fabricCanvas.add(fillFabricImg);
            try { if (typeof fabricCanvas.sendObjectToBack === 'function') fabricCanvas.sendObjectToBack(fillFabricImg); else if (typeof fabricCanvas.sendToBack === 'function') fabricCanvas.sendToBack(fillFabricImg); } catch (e) {}
            fabricCanvas.renderAll();
          };
          fillImgEl.src = fillData.dataURL;
          newFills.push({ id: newFillId, dataURL: fillData.dataURL, left: (fillData.left || 0) + offset, top: (fillData.top || 0) + offset, width: fillData.width, height: fillData.height, color: fillData.color, relLeft: fillData.relLeft, relTop: fillData.relTop });
        });
      }
      fabricCanvas.setActiveObject(newPath); fabricCanvas.renderAll();
      setCanvasObjects(prev => [...prev, {
        id: newId, type: 'path', name: `Drawing_${count}`, pathData: newPath.path,
        strokeColor: fo.stroke || objData.strokeColor || '#000000',
        strokeWidth: fo.strokeWidth || objData.strokeWidth || 3, fillColor: '',
        boundingBox: { width: newPath.width, height: newPath.height },
        pathOffsetX: newPath.pathOffset?.x || 0, pathOffsetY: newPath.pathOffset?.y || 0, fills: newFills,
      }]);
      setKeyframes(prev => ({ ...prev, [newId]: [] }));
      setSelectedObject(newId);

    } else if (objData.type === 'group') {
      duplicateGroup(objData, fo, newId, offset).catch(err => console.error('Group duplication failed:', err));

    } else if (objData.convertedToPath && objData.deformedPath) {
      const pathString = fabricPathToSVGPathString(fo.path) || objData.deformedPath;
      const fillColor = fo.fill || objData.fill || '#000000';
      const newPath = new fabric.Path(pathString, {
        id: newId,
        left: (fo.left || 350) + offset,
        top: (fo.top || 250) + offset,
        originX: 'center', originY: 'center',
        scaleX: fo.scaleX || 1, scaleY: fo.scaleY || 1,
        angle: fo.angle || 0, opacity: fo.opacity ?? 1,
        fill: fillColor,
        stroke: srcStroke, strokeWidth: srcStrokeWidth,
      });
      fabricCanvas.add(newPath);
      fabricCanvas.setActiveObject(newPath);
      fabricCanvas.renderAll();

      const shapeDef = getShapeDef(objData.type);
      const newObjData = {
        id: newId, type: objData.type,
        name: `${shapeDef?.label || objData.type}_${count}`,
        fill: fillColor,
        outlineWidth: srcOutlineWidth, outlineColor: srcOutlineColor,
        deformedPath: objData.deformedPath,
        convertedToPath: true,
        deformedPathOffsetX: newPath.pathOffset?.x || objData.deformedPathOffsetX,
        deformedPathOffsetY: newPath.pathOffset?.y || objData.deformedPathOffsetY,
        deformedPathWidth: newPath.width || objData.deformedPathWidth,
        deformedPathHeight: newPath.height || objData.deformedPathHeight,
      };
      if (objData.svgPath) newObjData.svgPath = objData.svgPath;
      setCanvasObjects(prev => [...prev, newObjData]);
      setKeyframes(prev => ({ ...prev, [newId]: [] }));
      setSelectedObject(newId);

    } else {
      const shapeDef = getShapeDef(objData.type);
      if (!shapeDef) return;
      const fillColor = fo.fill || objData.fill || shapeDef.defaultFill;
      const newShape = shapeDef.fabricCreate(newId, fillColor);
      if (!newShape) return;
      newShape.set({
        left: (fo.left || 350) + offset, top: (fo.top || 250) + offset,
        scaleX: fo.scaleX || 1, scaleY: fo.scaleY || 1,
        angle: fo.angle || 0, opacity: fo.opacity ?? 1,
        stroke: srcStroke, strokeWidth: srcStrokeWidth,
      });
      fabricCanvas.add(newShape); fabricCanvas.setActiveObject(newShape); fabricCanvas.renderAll();
      const newObjData = {
        id: newId, type: objData.type, name: `${shapeDef.label}_${count}`, fill: fillColor,
        outlineWidth: srcOutlineWidth, outlineColor: srcOutlineColor,
      };
      if (shapeDef.renderMode === 'svg') newObjData.svgPath = shapeDef.svgPath;
      setCanvasObjects(prev => [...prev, newObjData]);
      setKeyframes(prev => ({ ...prev, [newId]: [] }));
      setSelectedObject(newId);
    }
  };

  // ===== GROUP DUPLICATION =====
  const duplicateGroup = async (groupObjData, fabricGroup, newGroupId, offset) => {
    if (!fabricGroup._objects || fabricGroup._objects.length === 0) return;

    const newChildObjDataEntries = [];
    const fillsToCreate = [];

    const childPromises = fabricGroup._objects.map((fc, idx) => {
      const childObjData = canvasObjects.find(o => o.id === fc.id);
      const newChildId = `element_${Date.now()}_${idx}`;

      if (fc.type === 'image') {
        return new Promise((resolve) => {
          const dataURL = childObjData?.imageDataURL || fc.getSrc?.() || '';
          if (!dataURL) { resolve(null); return; }
          const imgEl = new Image();
          imgEl.onload = () => {
            const newImg = new fabric.Image(imgEl, {
              id: newChildId,
              left: fc.left || 0,
              top: fc.top || 0,
              scaleX: fc.scaleX || 1,
              scaleY: fc.scaleY || 1,
              angle: fc.angle || 0,
              opacity: fc.opacity ?? 1,
              originX: fc.originX || 'center',
              originY: fc.originY || 'center',
            });
            const childData = buildChildObjData(childObjData, newChildId);
            if (childData) newChildObjDataEntries.push(childData);
            resolve({ fabricObj: newImg, childId: newChildId });
          };
          imgEl.onerror = () => { resolve(null); };
          imgEl.src = dataURL;
        });
      }

      const clonedFabric = cloneFabricChild(fc, newChildId);
      if (!clonedFabric) return Promise.resolve(null);

      const childData = buildChildObjData(childObjData, newChildId);
      if (childData) {
        if (childObjData?.type === 'path' && childObjData.fills && childObjData.fills.length > 0) {
          const clonedFills = [];
          childObjData.fills.forEach((fillData, fIdx) => {
            const newFillId = `_fill_${Date.now()}_${idx}_${fIdx}`;
            clonedFills.push({
              id: newFillId, dataURL: fillData.dataURL,
              left: fillData.left, top: fillData.top,
              width: fillData.width, height: fillData.height,
              color: fillData.color, relLeft: fillData.relLeft, relTop: fillData.relTop,
            });
            fillsToCreate.push({
              fillId: newFillId, parentId: newChildId, dataURL: fillData.dataURL,
              left: fillData.left, top: fillData.top,
              width: fillData.width, height: fillData.height,
              relLeft: fillData.relLeft, relTop: fillData.relTop,
            });
          });
          childData.fills = clonedFills;
        }
        newChildObjDataEntries.push(childData);
      }

      return Promise.resolve({ fabricObj: clonedFabric, childId: newChildId });
    });

    const results = await Promise.all(childPromises);
    const validResults = results.filter(Boolean);
    if (validResults.length === 0) return;

    const newChildFabricObjs = validResults.map(r => r.fabricObj);
    const newChildIds = validResults.map(r => r.childId);

    const newGroup = new fabric.Group(newChildFabricObjs, {
      id: newGroupId,
      left: (fabricGroup.left || 350) + offset,
      top: (fabricGroup.top || 250) + offset,
      originX: 'center', originY: 'center',
      scaleX: fabricGroup.scaleX || 1, scaleY: fabricGroup.scaleY || 1,
      angle: fabricGroup.angle || 0, opacity: fabricGroup.opacity ?? 1,
    });

    fabricCanvas.add(newGroup);
    fabricCanvas.setActiveObject(newGroup);
    fabricCanvas.renderAll();

    if (fillsToCreate.length > 0) {
      fillsToCreate.forEach(fillInfo => {
        const fillImgEl = new Image();
        fillImgEl.onload = () => {
          const fillFabricImg = new fabric.Image(fillImgEl, {
            left: fillInfo.left + offset, top: fillInfo.top + offset,
            width: fillInfo.width, height: fillInfo.height,
            originX: 'left', originY: 'top', selectable: false, evented: false, id: fillInfo.fillId,
          });
          fillFabricImg._isFill = true; fillFabricImg._parentId = fillInfo.parentId;
          fillFabricImg._relLeft = fillInfo.relLeft; fillFabricImg._relTop = fillInfo.relTop;
          fabricCanvas.add(fillFabricImg);
          try { if (typeof fabricCanvas.sendObjectToBack === 'function') fabricCanvas.sendObjectToBack(fillFabricImg); else if (typeof fabricCanvas.sendToBack === 'function') fabricCanvas.sendToBack(fillFabricImg); } catch (e) {}
          fabricCanvas.renderAll();
        };
        fillImgEl.src = fillInfo.dataURL;
      });
    }

    const groupCount = canvasObjects.filter(obj => obj.type === 'group').length + 1;
    setCanvasObjects(prev => [
      ...prev,
      ...newChildObjDataEntries,
      { id: newGroupId, type: 'group', name: `Group_${groupCount}`, children: newChildIds },
    ]);
    setKeyframes(prev => ({ ...prev, [newGroupId]: [] }));
    setSelectedObject(newGroupId);
  };

  const canDuplicate = React.useMemo(() => {
    if (!selectedObject) return false;
    return !!canvasObjects.find(obj => obj.id === selectedObject);
  }, [selectedObject, canvasObjects]);

  const groupObjects = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length < 2) return;
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
  };

  const ungroupObjects = () => {
    if (!fabricCanvas || !selectedObject) return;
    const group = fabricCanvas.getObjects().find(obj => obj.id === selectedObject);
    if (!group || group.type !== 'group') return;
    const restoredItems = ungroupFabricGroup(fabricCanvas, group);
    if (restoredItems.length > 0) {
      setCanvasObjects(prev => prev.filter(obj => obj.id !== selectedObject));
      setKeyframes(prev => { const u = { ...prev }; delete u[selectedObject]; restoredItems.forEach(item => { if (item.id && u[item.id] === undefined) u[item.id] = []; }); return u; });
      setSelectedObject(null);
      setTimeout(() => { fabricCanvas.forEachObject(obj => { obj.visible = true; obj.selectable = true; obj.evented = true; obj.dirty = true; }); fabricCanvas.requestRenderAll(); }, 0);
    }
  };

  const deleteObject = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length === 0 && selectedObject) {
      const fo = fabricCanvas.getObjects().find(obj => obj.id === selectedObject);
      if (fo) activeObjects.push(fo);
    }
    if (activeObjects.length === 0) return;
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
  };

  const moveLayer = (direction) => {
    if (!fabricCanvas) return;
    let targetObject = null;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj?.id) targetObject = activeObj;
    else if (selectedObject) targetObject = fabricCanvas.getObjects().find(obj => obj.id === selectedObject);
    if (!targetObject) return;
    try {
      if (direction === 'up') {
        if (typeof fabricCanvas.bringObjectForward === 'function') fabricCanvas.bringObjectForward(targetObject);
        else if (typeof fabricCanvas.bringForward === 'function') fabricCanvas.bringForward(targetObject);
      } else {
        if (typeof fabricCanvas.sendObjectBackwards === 'function') fabricCanvas.sendObjectBackwards(targetObject);
        else if (typeof fabricCanvas.sendBackwards === 'function') fabricCanvas.sendBackwards(targetObject);
      }
    } catch (e) {}
    fabricCanvas.renderAll();
    const objects = fabricCanvas.getObjects();
    setTrackOrder([...objects].filter(obj => obj.id).reverse().map(obj => obj.id));
  };

  const toggleDrawingMode = () => {
    if (!fabricCanvas) return;
    if (fillToolActive) setFillToolActive(false);
    if (drawingMode && fabricCanvas._commitDrawing) fabricCanvas._commitDrawing();
    setDrawingMode(!drawingMode);
    if (!drawingMode) { fabricCanvas.discardActiveObject(); fabricCanvas.renderAll(); setSelectedObject(null); }
  };

  const finishDrawing = () => { if (fabricCanvas?._commitDrawing) fabricCanvas._commitDrawing(); };

  const toggleFillTool = () => {
    if (drawingMode) { if (fabricCanvas?._commitDrawing) fabricCanvas._commitDrawing(); setDrawingMode(false); }
    setFillToolActive(!fillToolActive);
  };

  return (
    <Paper sx={{ width: 80, display: 'flex', flexDirection: 'column', p: 1, gap: 1, borderRadius: 0 }}>
      <Tooltip title="Add Shape" placement="right">
        <IconButton ref={shapeButtonRef} onClick={() => setShapePickerAnchor(shapeButtonRef.current)} color="primary"><ShapesIcon /></IconButton>
      </Tooltip>
      <ShapePicker anchorEl={shapePickerAnchor} open={Boolean(shapePickerAnchor)} onClose={() => setShapePickerAnchor(null)} onSelectShape={addShape} />

      <Tooltip title="Add Text" placement="right">
        <IconButton onClick={() => setTextDialogOpen(true)} color="primary"><TextIcon /></IconButton>
      </Tooltip>

      {/* Text Input Dialog */}
      <TextInputDialog
        open={textDialogOpen}
        onClose={() => setTextDialogOpen(false)}
        onSubmit={handleAddTextSubmit}
        mode="add"
      />

      <Tooltip title="Upload Image" placement="right">
        <IconButton onClick={() => fileInputRef.current?.click()} color="primary"><ImageIcon /></IconButton>
      </Tooltip>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />

      <Tooltip title={audioFile ? "Replace Audio" : "Upload Audio (BGM)"} placement="right">
        <IconButton onClick={() => audioInputRef.current?.click()} color={audioFile ? "secondary" : "primary"}
          sx={audioFile ? { bgcolor: 'secondary.light', '&:hover': { bgcolor: 'secondary.main', color: 'white' } } : {}}>
          <AudioIcon />
        </IconButton>
      </Tooltip>
      <input ref={audioInputRef} type="file" accept=".mp3,.wav,.ogg,.aac,.m4a,.webm,audio/*" style={{ display: 'none' }} onChange={handleAudioUpload} />

      <Tooltip title={drawingMode ? "Exit Drawing Mode (ESC)" : "Drawing Mode"} placement="right">
        <IconButton onClick={toggleDrawingMode} color={drawingMode ? "secondary" : "primary"}>
          <Badge badgeContent={strokeCount > 0 ? strokeCount : 0} color="error"><BrushIcon /></Badge>
        </IconButton>
      </Tooltip>

      {drawingMode && strokeCount > 0 && (
        <Tooltip title="Finish Drawing (Enter)" placement="right">
          <IconButton onClick={finishDrawing} color="success"
            sx={{ bgcolor: 'success.light', '&:hover': { bgcolor: 'success.main', color: 'white' } }}><CheckIcon /></IconButton>
        </Tooltip>
      )}

      <Tooltip title={fillToolActive ? "Exit Paint Bucket (ESC)" : "Paint Bucket Fill"} placement="right">
        <IconButton onClick={toggleFillTool} color={fillToolActive ? "secondary" : "primary"}
          sx={fillToolActive ? { bgcolor: 'secondary.light', '&:hover': { bgcolor: 'secondary.main', color: 'white' } } : {}}>
          <FillIcon />
        </IconButton>
      </Tooltip>

      {fillToolActive && (
        <Tooltip title="Fill color" placement="right">
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <input type="color" value={fillToolColor} onChange={(e) => setFillToolColor(e.target.value)}
              style={{ width: 36, height: 36, cursor: 'pointer', border: '2px solid #333', borderRadius: 4, padding: 0 }} />
          </Box>
        </Tooltip>
      )}

      <Tooltip title={anchorEditMode ? "Exit Anchor Mode" : "Edit Anchor Point"} placement="right">
        <IconButton onClick={() => setAnchorEditMode(!anchorEditMode)} color={anchorEditMode ? "secondary" : "primary"} disabled={!selectedObject}><AnchorIcon /></IconButton>
      </Tooltip>

      <Divider sx={{ my: 1 }} />

      <Tooltip title="Duplicate Selected Object" placement="right">
        <span><IconButton onClick={duplicateObject} disabled={!canDuplicate} color="primary"><DuplicateIcon /></IconButton></span>
      </Tooltip>
      <Tooltip title="Group Selected (Cmd/Ctrl+G)" placement="right">
        <span><IconButton onClick={groupObjects} disabled={!canGroup} color="primary"><GroupIcon /></IconButton></span>
      </Tooltip>
      <Tooltip title="Ungroup (Cmd/Ctrl+Shift+G)" placement="right">
        <span><IconButton onClick={ungroupObjects} disabled={!canUngroup} color="primary"><UngroupIcon /></IconButton></span>
      </Tooltip>

      <Divider sx={{ my: 1 }} />

      <Tooltip title="Delete Selected" placement="right">
        <span><IconButton onClick={deleteObject} disabled={!hasActiveSelection} color="error"><DeleteIcon /></IconButton></span>
      </Tooltip>
      <Tooltip title="Bring Forward" placement="right">
        <span><IconButton onClick={() => moveLayer('up')} disabled={!hasActiveSelection && !selectedObject}><ArrowUpIcon /></IconButton></span>
      </Tooltip>
      <Tooltip title="Send Backward" placement="right">
        <span><IconButton onClick={() => moveLayer('down')} disabled={!hasActiveSelection && !selectedObject}><ArrowDownIcon /></IconButton></span>
      </Tooltip>
    </Paper>
  );
};

export default Toolbar;