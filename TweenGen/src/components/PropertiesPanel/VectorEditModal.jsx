/**
 * VectorEditModal — Zoom-in editor for vector images.
 *
 * HOW IT WORKS:
 *   1. Opens a dialog showing the vector image at configurable zoom (2x-6x).
 *   2. The user can draw freehand strokes or place shapes on top of the zoomed vector.
 *   3. On "Save", every addition is converted to SVG markup and injected into
 *      the traced SVG data. The main canvas preview is re-rasterized.
 *   4. Because additions are drawn at high zoom, their coordinates in SVG space
 *      are very small. At normal 1x view the details are nearly invisible —
 *      they only appear when the image is scaled up or inspected closely.
 *
 * TOOLS:
 *   Freehand, Rectangle, Circle, Triangle, Diamond, Star, Arrow, Pentagon, Hexagon
 *
 * All additions are non-destructive — they add new SVG elements
 * without modifying the original traced paths.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, IconButton, Tooltip, TextField, Slider,
  ToggleButton, ToggleButtonGroup, Divider, Paper,
} from '@mui/material';
import {
  Brush as DrawIcon,
  CropSquare as RectIcon,
  RadioButtonUnchecked as CircleIcon,
  ChangeHistory as TriangleIcon,
  Diamond as DiamondIcon,
  Star as StarIcon,
  ArrowForward as ArrowIcon,
  Pentagon as PentagonIcon,
  Hexagon as HexagonIcon,
  Undo as UndoIcon,
  DeleteSweep as ClearIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  ZoomIn as ZoomIcon,
} from '@mui/icons-material';

import { createSizedSVG, parseSVGDimensions, rasterizeSVG } from '../../utils/imageTracer';

// ===================================================================
// Constants
// ===================================================================
const MIN_ZOOM = 2;
const MAX_ZOOM = 6;
const DEFAULT_ZOOM = 3;

// ===================================================================
// Shape polygon generators (normalized 0-1 coordinate space)
// ===================================================================

const polygonPoints = {
  triangle: [
    { x: 0.5, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  diamond: [
    { x: 0.5, y: 0 },
    { x: 1, y: 0.5 },
    { x: 0.5, y: 1 },
    { x: 0, y: 0.5 },
  ],
  pentagon: (() => {
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pts.push({ x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) });
    }
    return pts;
  })(),
  hexagon: (() => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
      pts.push({ x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) });
    }
    return pts;
  })(),
  star: (() => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 0.5 : 0.2;
      pts.push({ x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) });
    }
    return pts;
  })(),
  arrow: [
    { x: 0, y: 0.3 },
    { x: 0.6, y: 0.3 },
    { x: 0.6, y: 0.05 },
    { x: 1, y: 0.5 },
    { x: 0.6, y: 0.95 },
    { x: 0.6, y: 0.7 },
    { x: 0, y: 0.7 },
  ],
};

/**
 * Draw a polygon on a canvas context given normalized points and a bounding box.
 */
const drawPolygonOnCanvas = (ctx, points, x, y, w, h, color, lineWidth, filled) => {
  if (!ctx || !points || points.length === 0) return;
  ctx.beginPath();
  points.forEach((pt, i) => {
    const px = x + pt.x * w;
    const py = y + pt.y * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.fillStyle = color;
  if (filled) ctx.fill();
  ctx.stroke();
};

/**
 * Generate SVG polygon path string from normalized points scaled to a bounding box.
 */
const polygonToSVGPath = (points, x, y, w, h) => {
  let d = '';
  points.forEach((pt, i) => {
    const px = (x + pt.x * w).toFixed(2);
    const py = (y + pt.y * h).toFixed(2);
    d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
  });
  d += ' Z';
  return d;
};

// All shape tools
const SHAPE_TOOLS = [
  { key: 'rect', label: 'Rect', icon: RectIcon },
  { key: 'circle', label: 'Circle', icon: CircleIcon },
  { key: 'triangle', label: 'Triangle', icon: TriangleIcon },
  { key: 'diamond', label: 'Diamond', icon: DiamondIcon },
  { key: 'star', label: 'Star', icon: StarIcon },
  { key: 'arrow', label: 'Arrow', icon: ArrowIcon },
  { key: 'pentagon', label: 'Pentagon', icon: PentagonIcon },
  { key: 'hexagon', label: 'Hexagon', icon: HexagonIcon },
];

const isShapeTool = (tool) => SHAPE_TOOLS.some(s => s.key === tool);

// ===================================================================
// Component
// ===================================================================

const VectorEditModal = ({ open, onClose, objectData, onSave }) => {
  const bgCanvasRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const containerRef = useRef(null);

  // Tools
  const [tool, setTool] = useState('draw');
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillShape, setFillShape] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Additions
  const [strokes, setStrokes] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [history, setHistory] = useState([]);

  // Drawing state
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef([]);
  const shapeStartRef = useRef(null);
  const [currentShapePreview, setCurrentShapePreview] = useState(null);

  // Background loaded flag
  const [bgLoaded, setBgLoaded] = useState(false);

  // Computed dimensions — zoom applied directly, canvas scrolls if larger than viewport
  const imgW = objectData?.imageWidth || 100;
  const imgH = objectData?.imageHeight || 100;
  const canvasW = Math.round(imgW * zoom);
  const canvasH = Math.round(imgH * zoom);

  // SVG dimensions for coordinate mapping
  const svgDims = objectData?.svgTracedData ? parseSVGDimensions(objectData.svgTracedData) : null;
  const svgW = svgDims?.width || imgW;
  const svgH = svgDims?.height || imgH;

  // ===== RENDER BACKGROUND =====
  const renderBackground = useCallback(() => {
    if (!bgCanvasRef.current || !objectData?.svgTracedData) return;
    const canvas = bgCanvasRef.current;
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const svgStr = createSizedSVG(objectData.svgTracedData, canvasW, canvasH);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
      URL.revokeObjectURL(url);
      setBgLoaded(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [objectData?.svgTracedData, canvasW, canvasH]);

  // Render background when dialog opens or zoom changes
  // The 80ms delay ensures the dialog DOM is fully mounted before we draw
  useEffect(() => {
    if (!open) return;
    setBgLoaded(false);
    const timer = setTimeout(() => renderBackground(), 80);
    return () => clearTimeout(timer);
  }, [open, zoom, renderBackground]);

  // ===== RENDER OVERLAY =====
  const drawShapeOnCanvas = useCallback((ctx, shape) => {
    if (!ctx || !shape) return;
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.fillStyle = shape.color;

    if (shape.type === 'rect') {
      if (shape.filled) ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
      else ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
    } else if (shape.type === 'circle') {
      const cx = shape.x + shape.w / 2;
      const cy = shape.y + shape.h / 2;
      const rx = Math.abs(shape.w) / 2;
      const ry = Math.abs(shape.h) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (shape.filled) ctx.fill();
      else ctx.stroke();
    } else if (polygonPoints[shape.type]) {
      drawPolygonOnCanvas(ctx, polygonPoints[shape.type],
        shape.x, shape.y, shape.w, shape.h,
        shape.color, shape.width, shape.filled);
    }
  }, []);

  const redrawOverlay = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Completed freehand strokes
    strokes.forEach(stroke => {
      if (!stroke || !stroke.points || stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    // Completed shapes
    shapes.forEach(shape => drawShapeOnCanvas(ctx, shape));

    // In-progress shape preview
    if (currentShapePreview) {
      ctx.setLineDash([4, 4]);
      drawShapeOnCanvas(ctx, {
        ...currentShapePreview,
        color: strokeColor,
        width: strokeWidth,
        filled: fillShape,
      });
      ctx.setLineDash([]);
    }
  }, [strokes, shapes, currentShapePreview, canvasW, canvasH, strokeColor, strokeWidth, fillShape, drawShapeOnCanvas]);

  useEffect(() => { redrawOverlay(); }, [redrawOverlay]);

  // ===== MOUSE HANDLERS =====
  const getCanvasPos = (e) => {
    const rect = drawCanvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e) => {
    const pos = getCanvasPos(e);
    if (tool === 'draw') {
      isDrawingRef.current = true;
      currentPointsRef.current = [pos];
    } else if (isShapeTool(tool)) {
      shapeStartRef.current = pos;
    }
  };

  const handleMouseMove = (e) => {
    const pos = getCanvasPos(e);
    if (tool === 'draw' && isDrawingRef.current) {
      currentPointsRef.current.push(pos);
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const pts = currentPointsRef.current;
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
    } else if (isShapeTool(tool) && shapeStartRef.current) {
      setCurrentShapePreview({
        type: tool,
        x: Math.min(shapeStartRef.current.x, pos.x),
        y: Math.min(shapeStartRef.current.y, pos.y),
        w: Math.abs(pos.x - shapeStartRef.current.x),
        h: Math.abs(pos.y - shapeStartRef.current.y),
      });
    }
  };

  const handleMouseUp = (e) => {
    if (tool === 'draw' && isDrawingRef.current) {
      isDrawingRef.current = false;
      if (currentPointsRef.current.length >= 2) {
        // Capture points before clearing the ref
        const capturedPoints = [...currentPointsRef.current];
        setStrokes(prev => [...prev, {
          points: capturedPoints,
          color: strokeColor,
          width: strokeWidth,
        }]);
        setHistory(prev => [...prev, 'stroke']);
      }
      currentPointsRef.current = [];
    } else if (isShapeTool(tool) && shapeStartRef.current) {
      const pos = getCanvasPos(e);
      // Capture ref values into locals BEFORE any state setters —
      // React 18 batching delays updater execution, and shapeStartRef.current
      // gets set to null (below) before the updater runs.
      const startX = shapeStartRef.current.x;
      const startY = shapeStartRef.current.y;
      const w = Math.abs(pos.x - startX);
      const h = Math.abs(pos.y - startY);
      // Clear ref immediately (safe — we captured values above)
      shapeStartRef.current = null;
      setCurrentShapePreview(null);
      if (w > 3 && h > 3) {
        setShapes(prev => [...prev, {
          type: tool,
          x: Math.min(startX, pos.x),
          y: Math.min(startY, pos.y),
          w, h,
          color: strokeColor,
          width: strokeWidth,
          filled: fillShape,
        }]);
        setHistory(prev => [...prev, 'shape']);
      }
    }
  };

  const handleMouseLeave = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      if (currentPointsRef.current.length >= 2) {
        // Capture before clearing
        const capturedPoints = [...currentPointsRef.current];
        setStrokes(prev => [...prev, {
          points: capturedPoints,
          color: strokeColor,
          width: strokeWidth,
        }]);
        setHistory(prev => [...prev, 'stroke']);
      }
      currentPointsRef.current = [];
    }
    if (shapeStartRef.current) {
      shapeStartRef.current = null;
      setCurrentShapePreview(null);
    }
  };

  // ===== UNDO =====
  const handleUndo = () => {
    if (history.length === 0) return;
    const lastType = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    if (lastType === 'stroke') setStrokes(prev => prev.slice(0, -1));
    else if (lastType === 'shape') setShapes(prev => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    setStrokes([]);
    setShapes([]);
    setHistory([]);
    setCurrentShapePreview(null);
  };

  // ===== SAVE — Inject additions into SVG =====
  const handleSave = async () => {
    if (!objectData?.svgTracedData) return;
    if (strokes.length === 0 && shapes.length === 0) {
      onClose();
      return;
    }

    const scaleX = svgW / canvasW;
    const scaleY = svgH / canvasH;

    let newElements = '';

    // Freehand strokes -> <path>
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      let d = `M ${(stroke.points[0].x * scaleX).toFixed(2)} ${(stroke.points[0].y * scaleY).toFixed(2)}`;
      for (let i = 1; i < stroke.points.length; i++) {
        d += ` L ${(stroke.points[i].x * scaleX).toFixed(2)} ${(stroke.points[i].y * scaleY).toFixed(2)}`;
      }
      newElements += `<path d="${d}" stroke="${stroke.color}" stroke-width="${(stroke.width * scaleX).toFixed(2)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    });

    // Shapes -> <rect>, <ellipse>, or <path> for polygons
    shapes.forEach(shape => {
      const sx = shape.x * scaleX;
      const sy = shape.y * scaleY;
      const sw = shape.w * scaleX;
      const sh = shape.h * scaleY;
      const lineW = (shape.width * scaleX).toFixed(2);
      const fillAttr = shape.filled ? `fill="${shape.color}"` : `fill="none" stroke="${shape.color}" stroke-width="${lineW}"`;

      if (shape.type === 'rect') {
        newElements += `<rect x="${sx.toFixed(2)}" y="${sy.toFixed(2)}" width="${sw.toFixed(2)}" height="${sh.toFixed(2)}" ${fillAttr}/>`;
      } else if (shape.type === 'circle') {
        const cx = (sx + sw / 2).toFixed(2);
        const cy = (sy + sh / 2).toFixed(2);
        const rx = (sw / 2).toFixed(2);
        const ry = (sh / 2).toFixed(2);
        newElements += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${fillAttr}/>`;
      } else if (polygonPoints[shape.type]) {
        const d = polygonToSVGPath(polygonPoints[shape.type], sx, sy, sw, sh);
        newElements += `<path d="${d}" ${fillAttr}/>`;
      }
    });

    const updatedSVG = objectData.svgTracedData.replace('</svg>', `${newElements}</svg>`);

    let vectorPreviewURL = null;
    try {
      vectorPreviewURL = await rasterizeSVG(updatedSVG, imgW, imgH);
    } catch (err) {
      console.error('Failed to rasterize updated SVG:', err);
    }

    onSave({ svgTracedData: updatedSVG, vectorPreviewURL });
    handleClearAll();
    onClose();
  };

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      handleClearAll();
      setZoom(DEFAULT_ZOOM);
      setBgLoaded(false);
    }
  }, [open]);

  if (!objectData?.svgTracedData) return null;

  const hasAdditions = strokes.length > 0 || shapes.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: { width: '95vw', height: '90vh', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ZoomIcon color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              Edit Vector — Zoom Detail View
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Draw or place shapes at {zoom.toFixed(1)}× zoom — additions are baked into the SVG on save
              {' '}({imgW}×{imgH} → {canvasW}×{canvasH}px)
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', gap: 2, p: 2, overflow: 'hidden', flex: 1 }}>
        {/* Left toolbar */}
        <Paper variant="outlined" sx={{
          p: 1.5, display: 'flex', flexDirection: 'column', gap: 1,
          minWidth: 170, maxWidth: 170, alignSelf: 'flex-start',
          overflow: 'auto', maxHeight: '100%',
        }}>
          {/* Freehand tool */}
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
            Draw
          </Typography>
          <ToggleButtonGroup value={tool} exclusive onChange={(_, v) => { if (v) setTool(v); }} size="small" fullWidth>
            <ToggleButton value="draw" sx={{ textTransform: 'none', gap: 0.5, fontSize: '0.7rem' }}>
              <DrawIcon sx={{ fontSize: 16 }} /> Freehand
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Shape tools in a 2-col grid */}
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.65rem', mt: 0.5 }}>
            Shapes
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
            {SHAPE_TOOLS.map(({ key, label, icon: Icon }) => (
              <ToggleButton
                key={key}
                value={key}
                selected={tool === key}
                onChange={() => setTool(key)}
                size="small"
                sx={{
                  textTransform: 'none', display: 'flex', flexDirection: 'column',
                  gap: 0, py: 0.5, px: 0.5, fontSize: '0.6rem', lineHeight: 1.2,
                }}
              >
                <Icon sx={{ fontSize: 16 }} />
                {label}
              </ToggleButton>
            ))}
          </Box>

          {/* Fill toggle for shapes */}
          {isShapeTool(tool) && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Mode</Typography>
              <ToggleButtonGroup value={fillShape ? 'filled' : 'outline'} exclusive
                onChange={(_, v) => { if (v) setFillShape(v === 'filled'); }} size="small" fullWidth>
                <ToggleButton value="outline" sx={{ textTransform: 'none', fontSize: '0.7rem' }}>Outline</ToggleButton>
                <ToggleButton value="filled" sx={{ textTransform: 'none', fontSize: '0.7rem' }}>Filled</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          <Divider />

          {/* Color */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Color</Typography>
            <TextField type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)}
              size="small" fullWidth sx={{ '& input': { cursor: 'pointer', p: 0.5, height: 32 } }} />
          </Box>

          {/* Stroke width */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Stroke: {strokeWidth}px
            </Typography>
            <Slider value={strokeWidth} onChange={(_, v) => setStrokeWidth(v)}
              min={1} max={10} step={1} size="small" />
          </Box>

          {/* Zoom — consistent 2x-6x regardless of image size */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Zoom: {zoom.toFixed(1)}×
            </Typography>
            <Slider value={zoom} onChange={(_, v) => setZoom(v)}
              min={MIN_ZOOM} max={MAX_ZOOM} step={0.5} size="small"
              marks={[{ value: 2, label: '2×' }, { value: 4, label: '4×' }, { value: 6, label: '6×' }]} />
          </Box>

          <Divider />

          <Tooltip title="Undo last addition">
            <span>
              <Button size="small" startIcon={<UndoIcon />} onClick={handleUndo}
                disabled={history.length === 0} fullWidth variant="outlined" sx={{ textTransform: 'none' }}>
                Undo
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Clear all additions">
            <span>
              <Button size="small" startIcon={<ClearIcon />} onClick={handleClearAll}
                disabled={!hasAdditions} fullWidth color="warning" variant="outlined" sx={{ textTransform: 'none' }}>
                Clear All
              </Button>
            </span>
          </Tooltip>

          {hasAdditions && (
            <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1.4 }}>
                {strokes.length > 0 && `${strokes.length} stroke${strokes.length !== 1 ? 's' : ''}`}
                {strokes.length > 0 && shapes.length > 0 && ', '}
                {shapes.length > 0 && `${shapes.length} shape${shapes.length !== 1 ? 's' : ''}`}
              </Typography>
            </Paper>
          )}
        </Paper>

        {/* Canvas area — scrollable when zoomed canvas exceeds viewport */}
        <Box
          ref={containerRef}
          sx={{
            flex: 1, bgcolor: '#e5e5e5', borderRadius: 1,
            overflow: 'auto', p: 2,
          }}
        >
          <Box sx={{
            position: 'relative', flexShrink: 0,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            borderRadius: 0.5, overflow: 'hidden',
            width: canvasW, height: canvasH,
            // Center small canvases, let large ones scroll naturally
            mx: 'auto',
          }}>
            {/* Background canvas — vector image */}
            <canvas ref={bgCanvasRef} width={canvasW} height={canvasH}
              style={{ display: 'block', width: canvasW, height: canvasH }} />
            {/* Loading indicator */}
            {!bgLoaded && (
              <Box sx={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.8)',
              }}>
                <Typography variant="body2" color="text.secondary">Loading vector preview...</Typography>
              </Box>
            )}
            {/* Drawing overlay canvas */}
            <canvas ref={drawCanvasRef} width={canvasW} height={canvasH}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: canvasW, height: canvasH,
                cursor: 'crosshair',
              }}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between', flexShrink: 0 }}>
        <Typography variant="caption" color="text.secondary">
          {hasAdditions
            ? `${history.length} addition${history.length !== 1 ? 's' : ''} will be baked into the SVG`
            : 'No additions yet — draw or place shapes on the zoomed vector'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={!hasAdditions}>
            Save to SVG
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default VectorEditModal;