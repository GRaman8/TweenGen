/**
 * PathDeformModal — Vertex and curve editor for deforming shapes.
 *
 * USAGE:
 *   1. Select a solid shape (triangle, star, rectangle, etc.)
 *   2. Click "Deform Shape" in Properties Panel
 *   3. The shape's outline appears with draggable vertex nodes
 *   4. Drag vertices to reshape the geometry
 *   5. Double-click an edge midpoint to convert it to a Bézier curve
 *   6. Drag the orange control handle to adjust the curve arc
 *   7. Click "Save" — the deformed path replaces the original on canvas
 *
 * EXAMPLE — Triangle to pizza slice:
 *   Original triangle: 3 straight edges
 *   Double-click the bottom edge midpoint → it becomes a curve
 *   Drag the control handle downward → the bottom edge arcs into a curved base
 *   Result: a pizza/cone shape
 *
 * NODES:
 *   Blue circles   = vertices (endpoints) — drag to move
 *   Green squares   = edge midpoints on straight segments — double-click to add curve
 *   Orange diamonds = Bézier control points — drag to shape the curve
 *   Right-click a control point to convert the curve back to a line
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, IconButton, Paper, Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  RestartAlt as ResetIcon,
  Timeline as DeformIcon,
} from '@mui/icons-material';

import {
  parsePathString, segmentsToPathString,
  getSegmentStartPoint, lineToQuadratic, quadraticToLine,
  getSegmentsBoundingBox,
} from '../../utils/pathUtils';

// ===================================================================
// Drawing constants
// ===================================================================
const CANVAS_PADDING = 40;
const EDITOR_SIZE = 600;        // Base canvas dimension
const VERTEX_RADIUS = 7;
const MIDPOINT_SIZE = 6;
const CONTROL_RADIUS = 7;
const HIT_TOLERANCE = 12;

const COLORS = {
  shapeFill: 'rgba(59, 130, 246, 0.08)',
  shapeStroke: 'rgba(59, 130, 246, 0.7)',
  vertex: '#3b82f6',
  vertexHover: '#1d4ed8',
  midpoint: '#10b981',
  midpointHover: '#059669',
  control: '#f97316',
  controlHover: '#ea580c',
  guideLine: 'rgba(249, 115, 22, 0.4)',
  grid: 'rgba(0, 0, 0, 0.05)',
};

// ===================================================================
// Component
// ===================================================================

const PathDeformModal = ({ open, onClose, pathString, fillColor, onSave }) => {
  const canvasRef = useRef(null);

  // Editable segments (deep-cloned on open)
  const [segments, setSegments] = useState([]);
  const [historyStack, setHistoryStack] = useState([]);
  const initialPathRef = useRef('');

  // Interaction state
  const [dragging, setDragging] = useState(null);     // { type, segIndex, field? }
  const [hovering, setHovering] = useState(null);     // same shape as dragging
  const dragStartRef = useRef(null);

  // Coordinate transform: path space ↔ canvas space
  const [transform, setTransform] = useState({ scale: 1, offsetX: 0, offsetY: 0 });

  // ===== Initialize on open =====
  useEffect(() => {
    if (!open || !pathString) return;
    const parsed = parsePathString(pathString);
    setSegments(parsed);
    setHistoryStack([]);
    initialPathRef.current = pathString;
  }, [open, pathString]);

  // ===== Compute transform from path bounds to canvas =====
  useEffect(() => {
    if (segments.length === 0) return;
    const bbox = getSegmentsBoundingBox(segments);
    const availW = EDITOR_SIZE - CANVAS_PADDING * 2;
    const availH = EDITOR_SIZE - CANVAS_PADDING * 2;
    const scaleX = availW / Math.max(bbox.width, 1);
    const scaleY = availH / Math.max(bbox.height, 1);
    const scale = Math.min(scaleX, scaleY);
    const offsetX = CANVAS_PADDING + (availW - bbox.width * scale) / 2 - bbox.minX * scale;
    const offsetY = CANVAS_PADDING + (availH - bbox.height * scale) / 2 - bbox.minY * scale;
    setTransform({ scale, offsetX, offsetY });
  }, [segments]);

  const toCanvas = useCallback((px, py) => ({
    x: px * transform.scale + transform.offsetX,
    y: py * transform.scale + transform.offsetY,
  }), [transform]);

  const toPath = useCallback((cx, cy) => ({
    x: (cx - transform.offsetX) / transform.scale,
    y: (cy - transform.offsetY) / transform.scale,
  }), [transform]);

  // ===== Push history before mutation =====
  const pushHistory = useCallback(() => {
    setHistoryStack(prev => [...prev, segmentsToPathString(segments)]);
  }, [segments]);

  // ===== Draw =====
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || segments.length === 0) return;
    canvas.width = EDITOR_SIZE;
    canvas.height = EDITOR_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, EDITOR_SIZE, EDITOR_SIZE);

    // Background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, EDITOR_SIZE, EDITOR_SIZE);

    // Grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= EDITOR_SIZE; i += 50) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, EDITOR_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(EDITOR_SIZE, i); ctx.stroke();
    }

    // Draw the shape fill
    ctx.beginPath();
    segments.forEach(seg => {
      const p = seg.x !== undefined ? toCanvas(seg.x, seg.y) : null;
      switch (seg.cmd) {
        case 'M': if (p) ctx.moveTo(p.x, p.y); break;
        case 'L': if (p) ctx.lineTo(p.x, p.y); break;
        case 'Q': {
          const cp = toCanvas(seg.cx, seg.cy);
          ctx.quadraticCurveTo(cp.x, cp.y, p.x, p.y);
          break;
        }
        case 'C': {
          const cp1 = toCanvas(seg.cx1, seg.cy1);
          const cp2 = toCanvas(seg.cx2, seg.cy2);
          ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
          break;
        }
        case 'Z': ctx.closePath(); break;
        default: break;
      }
    });
    ctx.fillStyle = fillColor || COLORS.shapeFill;
    ctx.fill();
    ctx.strokeStyle = COLORS.shapeStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw control handles and guide lines for curves
    segments.forEach((seg, i) => {
      if (seg.cmd === 'Q') {
        const start = getSegmentStartPoint(segments, i);
        const cp = toCanvas(seg.cx, seg.cy);
        const sp = toCanvas(start.x, start.y);
        const ep = toCanvas(seg.x, seg.y);
        // Guide lines
        ctx.strokeStyle = COLORS.guideLine;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(cp.x, cp.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ep.x, ep.y); ctx.lineTo(cp.x, cp.y); ctx.stroke();
        ctx.setLineDash([]);
        // Control point (diamond)
        const isHovered = hovering?.type === 'control' && hovering.segIndex === i;
        drawDiamond(ctx, cp.x, cp.y, CONTROL_RADIUS, isHovered ? COLORS.controlHover : COLORS.control);
      }
      if (seg.cmd === 'C') {
        const start = getSegmentStartPoint(segments, i);
        const cp1 = toCanvas(seg.cx1, seg.cy1);
        const cp2 = toCanvas(seg.cx2, seg.cy2);
        const sp = toCanvas(start.x, start.y);
        const ep = toCanvas(seg.x, seg.y);
        ctx.strokeStyle = COLORS.guideLine;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(cp1.x, cp1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ep.x, ep.y); ctx.lineTo(cp2.x, cp2.y); ctx.stroke();
        ctx.setLineDash([]);
        const isH1 = hovering?.type === 'control' && hovering.segIndex === i && hovering.field === 'cp1';
        const isH2 = hovering?.type === 'control' && hovering.segIndex === i && hovering.field === 'cp2';
        drawDiamond(ctx, cp1.x, cp1.y, CONTROL_RADIUS, isH1 ? COLORS.controlHover : COLORS.control);
        drawDiamond(ctx, cp2.x, cp2.y, CONTROL_RADIUS, isH2 ? COLORS.controlHover : COLORS.control);
      }
    });

    // Draw edge midpoints (only for line segments — double-click to convert)
    segments.forEach((seg, i) => {
      if (seg.cmd === 'L') {
        const start = getSegmentStartPoint(segments, i);
        const midCanvas = toCanvas((start.x + seg.x) / 2, (start.y + seg.y) / 2);
        const isHovered = hovering?.type === 'midpoint' && hovering.segIndex === i;
        drawSquare(ctx, midCanvas.x, midCanvas.y, MIDPOINT_SIZE, isHovered ? COLORS.midpointHover : COLORS.midpoint);
      }
    });

    // Draw vertices
    segments.forEach((seg, i) => {
      if (seg.cmd === 'Z') return;
      const p = toCanvas(seg.x, seg.y);
      const isHovered = hovering?.type === 'vertex' && hovering.segIndex === i;
      drawCircle(ctx, p.x, p.y, VERTEX_RADIUS, isHovered ? COLORS.vertexHover : COLORS.vertex);
    });

  }, [segments, transform, toCanvas, hovering, fillColor]);

  useEffect(() => { draw(); }, [draw]);

  // ===== Drawing helpers =====
  const drawCircle = (ctx, x, y, r, color) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const drawSquare = (ctx, x, y, size, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - size, y - size, size * 2, size * 2);
  };

  const drawDiamond = (ctx, x, y, r, color) => {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  // ===== Hit testing =====
  const getCanvasPos = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  const hitTest = useCallback((canvasPos) => {
    // Check control points first (on top)
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.cmd === 'Q') {
        const cp = toCanvas(seg.cx, seg.cy);
        if (dist(canvasPos, cp) < HIT_TOLERANCE) return { type: 'control', segIndex: i };
      }
      if (seg.cmd === 'C') {
        const cp1 = toCanvas(seg.cx1, seg.cy1);
        if (dist(canvasPos, cp1) < HIT_TOLERANCE) return { type: 'control', segIndex: i, field: 'cp1' };
        const cp2 = toCanvas(seg.cx2, seg.cy2);
        if (dist(canvasPos, cp2) < HIT_TOLERANCE) return { type: 'control', segIndex: i, field: 'cp2' };
      }
    }
    // Check vertices
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.cmd === 'Z') continue;
      const p = toCanvas(seg.x, seg.y);
      if (dist(canvasPos, p) < HIT_TOLERANCE) return { type: 'vertex', segIndex: i };
    }
    // Check edge midpoints
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.cmd === 'L') {
        const start = getSegmentStartPoint(segments, i);
        const mid = toCanvas((start.x + seg.x) / 2, (start.y + seg.y) / 2);
        if (dist(canvasPos, mid) < HIT_TOLERANCE) return { type: 'midpoint', segIndex: i };
      }
    }
    return null;
  }, [segments, toCanvas]);

  // ===== Mouse handlers =====
  const handleMouseDown = (e) => {
    const pos = getCanvasPos(e);
    const hit = hitTest(pos);
    if (!hit) return;

    if (hit.type === 'vertex' || hit.type === 'control') {
      pushHistory();
      setDragging(hit);
      dragStartRef.current = pos;
      e.preventDefault();
    }
  };

  const handleMouseMove = useCallback((e) => {
    const pos = getCanvasPos(e);

    if (dragging) {
      const pathPos = toPath(pos.x, pos.y);
      setSegments(prev => {
        const next = prev.map(s => ({ ...s }));
        const seg = next[dragging.segIndex];
        if (!seg) return prev;

        if (dragging.type === 'vertex') {
          seg.x = pathPos.x;
          seg.y = pathPos.y;
        } else if (dragging.type === 'control') {
          if (seg.cmd === 'Q') {
            seg.cx = pathPos.x;
            seg.cy = pathPos.y;
          } else if (seg.cmd === 'C') {
            if (dragging.field === 'cp1') { seg.cx1 = pathPos.x; seg.cy1 = pathPos.y; }
            else { seg.cx2 = pathPos.x; seg.cy2 = pathPos.y; }
          }
        }
        return next;
      });
    } else {
      setHovering(hitTest(pos));
    }
  }, [dragging, toPath, hitTest]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    dragStartRef.current = null;
  }, []);

  // Global mouse tracking during drag
  useEffect(() => {
    if (dragging) {
      const onMove = (e) => handleMouseMove(e);
      const onUp = () => handleMouseUp();
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // ===== Double-click edge midpoint → convert to curve =====
  const handleDoubleClick = (e) => {
    const pos = getCanvasPos(e);
    const hit = hitTest(pos);
    if (!hit || hit.type !== 'midpoint') return;

    const seg = segments[hit.segIndex];
    if (seg.cmd !== 'L') return;

    pushHistory();
    const start = getSegmentStartPoint(segments, hit.segIndex);
    const curved = lineToQuadratic(start, seg);

    setSegments(prev => {
      const next = [...prev];
      next[hit.segIndex] = curved;
      return next;
    });
  };

  // ===== Right-click control point → convert curve back to line =====
  const handleContextMenu = (e) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const hit = hitTest(pos);
    if (!hit || hit.type !== 'control') return;

    const seg = segments[hit.segIndex];
    if (seg.cmd !== 'Q') return;

    pushHistory();
    const line = quadraticToLine(seg);
    setSegments(prev => {
      const next = [...prev];
      next[hit.segIndex] = line;
      return next;
    });
  };

  // ===== Undo =====
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const prevPath = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));
    setSegments(parsePathString(prevPath));
  };

  // ===== Reset =====
  const handleReset = () => {
    if (initialPathRef.current) {
      pushHistory();
      setSegments(parsePathString(initialPathRef.current));
    }
  };

  // ===== Save =====
  const handleSave = () => {
    const newPath = segmentsToPathString(segments);
    onSave(newPath);
    onClose();
  };

  // ===== Cursor =====
  const getCursor = () => {
    if (dragging) return 'grabbing';
    if (hovering?.type === 'vertex' || hovering?.type === 'control') return 'grab';
    if (hovering?.type === 'midpoint') return 'pointer';
    return 'default';
  };

  const hasChanges = initialPathRef.current !== segmentsToPathString(segments);

  // Count curves
  const curveCount = segments.filter(s => s.cmd === 'Q' || s.cmd === 'C').length;
  const vertexCount = segments.filter(s => s.cmd !== 'Z').length;

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { width: 'auto', maxWidth: '95vw', maxHeight: '95vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DeformIcon color="secondary" />
          <Box>
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              Deform Shape — Path Editor
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Drag vertices to reshape — Double-click an edge to add a curve — Right-click a curve to straighten
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', gap: 2, p: 2, overflow: 'hidden' }}>
        {/* Left panel — info and controls */}
        <Paper variant="outlined" sx={{ p: 2, minWidth: 200, maxWidth: 200, alignSelf: 'flex-start' }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.65rem', display: 'block', mb: 1.5 }}>
            Instructions
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: COLORS.vertex, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ lineHeight: 1.3 }}>Drag blue circles to move vertices</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: COLORS.midpoint, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ lineHeight: 1.3 }}>Double-click green squares to add curves</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 14, height: 14, bgcolor: COLORS.control, flexShrink: 0, transform: 'rotate(45deg)' }} />
              <Typography variant="caption" sx={{ lineHeight: 1.3 }}>Drag orange diamonds to adjust curve arc</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, mt: 0.5 }}>
              Right-click an orange control point to convert a curve back to a straight line.
            </Typography>
          </Box>

          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50', mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1.4 }}>
              {vertexCount} vertices • {curveCount} curve{curveCount !== 1 ? 's' : ''}
              {hasChanges && ' • Modified'}
            </Typography>
          </Paper>

          <Tooltip title="Undo last change">
            <span>
              <Button size="small" startIcon={<UndoIcon />} onClick={handleUndo}
                disabled={historyStack.length === 0} fullWidth variant="outlined" sx={{ textTransform: 'none', mb: 1 }}>
                Undo
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Reset to original shape">
            <span>
              <Button size="small" startIcon={<ResetIcon />} onClick={handleReset}
                disabled={!hasChanges} fullWidth color="warning" variant="outlined" sx={{ textTransform: 'none' }}>
                Reset
              </Button>
            </span>
          </Tooltip>
        </Paper>

        {/* Canvas */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#e5e5e5', borderRadius: 1, p: 2 }}>
          <canvas
            ref={canvasRef}
            width={EDITOR_SIZE}
            height={EDITOR_SIZE}
            onMouseDown={handleMouseDown}
            onMouseMove={!dragging ? (e) => { const pos = getCanvasPos(e); setHovering(hitTest(pos)); } : undefined}
            onMouseLeave={() => { if (!dragging) setHovering(null); }}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            style={{
              display: 'block',
              width: EDITOR_SIZE,
              height: EDITOR_SIZE,
              cursor: getCursor(),
              borderRadius: 4,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {hasChanges ? 'Shape has been modified — save to apply changes' : 'No changes yet'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={!hasChanges}>
            Save Deformation
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default PathDeformModal;