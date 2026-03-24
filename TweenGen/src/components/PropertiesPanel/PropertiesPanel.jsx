import React, { useEffect, useState, useCallback } from 'react';
import { Box, Drawer, Typography, TextField, Slider, Divider, Paper, Button, ButtonBase,
  ToggleButton, ToggleButtonGroup, CircularProgress, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import DrawingSettings from '../Toolbar/DrawingSettings';
import { 
  useSelectedObject, useSelectedObjectProperties, useSelectedObjectDetails,
  useCurrentTime, useKeyframes, useFabricCanvas, useDrawingMode,
  useAnchorEditMode, useCanvasObjects, useCanvasBgColor,
  useFillToolActive, useFillToolColor,
} from '../../store/hooks';
import { findFabricObjectById, extractPropertiesFromFabricObject } from '../../utils/fabricHelpers';
import { traceImageToSVG, TRACE_PRESETS, createSizedSVG, rasterizeSVG } from '../../utils/imageTracer';

// All types that have a fill/color property (not paths, groups, or images)
const FILL_TYPES = new Set([
  'rectangle', 'circle', 'roundedRect', 'ellipse',
  'triangle', 'diamond', 'pentagon', 'hexagon',
  'star', 'arrow', 'heart', 'cross', 'text',
]);

// Outline width options matching MS Paint style
const OUTLINE_WIDTH_OPTIONS = [
  { value: 0, label: 'None', height: 0 },
  { value: 1, label: '1px', height: 1 },
  { value: 3, label: '3px', height: 3 },
  { value: 5, label: '5px', height: 5 },
  { value: 8, label: '8px', height: 8 },
];

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

  // SVG tracing state
  const [isTracing, setIsTracing] = useState(false);
  const [traceError, setTraceError] = useState(null);

  const drawerWidth = 300;

  useEffect(() => {
    if (!selectedObject || !fabricCanvas) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    const props = extractPropertiesFromFabricObject(fo);
    if (props) setProperties(props);
  }, [currentTime, selectedObject, fabricCanvas, keyframes, setProperties]);

  const handleOpacityChange = (event, newValue) => {
    if (!selectedObject || !fabricCanvas) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    fo.set('opacity', newValue); fabricCanvas.renderAll();
    setProperties(prev => ({ ...prev, opacity: newValue }));
  };

  const handlePositionChange = (axis, value) => {
    if (!selectedObject || !fabricCanvas) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    const v = parseFloat(value); if (isNaN(v)) return;
    fo.set(axis === 'x' ? 'left' : 'top', v); fo.setCoords(); fabricCanvas.renderAll();
    const props = extractPropertiesFromFabricObject(fo);
    if (props) setProperties(props);
  };

  const handleRotationChange = (value) => {
    if (!selectedObject || !fabricCanvas) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    const v = parseFloat(value); if (isNaN(v)) return;
    fo.set('angle', v); fo.setCoords(); fabricCanvas.renderAll();
    const props = extractPropertiesFromFabricObject(fo);
    if (props) setProperties(props);
  };

  const handleScaleChange = (axis, value) => {
    if (!selectedObject || !fabricCanvas) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    const v = parseFloat(value); if (isNaN(v) || v <= 0) return;
    fo.set(axis === 'x' ? 'scaleX' : 'scaleY', v); fo.setCoords(); fabricCanvas.renderAll();
    const props = extractPropertiesFromFabricObject(fo);
    if (props) setProperties(props);
  };

  const handleFillColorChange = (e) => {
    if (!selectedObject || !fabricCanvas) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    fo.set('fill', e.target.value); fabricCanvas.renderAll();
    setCanvasObjects(prev => prev.map(obj => obj.id === selectedObject ? { ...obj, fill: e.target.value } : obj));
  };

  const handleStrokeColorChange = (e) => {
    if (!selectedObject || !fabricCanvas) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    fo.set('stroke', e.target.value); fabricCanvas.renderAll();
    setCanvasObjects(prev => prev.map(obj => obj.id === selectedObject ? { ...obj, strokeColor: e.target.value } : obj));
  };

  const handleClearFills = () => {
    if (!selectedObject || !fabricCanvas) return;
    const objData = canvasObjects.find(obj => obj.id === selectedObject);
    if (!objData?.fills?.length) return;
    const fillIds = new Set(objData.fills.map(f => f.id));
    fabricCanvas.getObjects().filter(o => o._isFill && fillIds.has(o.id))
      .forEach(fillImg => fabricCanvas.remove(fillImg));
    fabricCanvas.renderAll();
    setCanvasObjects(prev => prev.map(obj =>
      obj.id === selectedObject ? { ...obj, fills: [] } : obj
    ));
  };

  // ==================== OUTLINE HANDLERS ====================

  const getCurrentOutlineWidth = () => {
    if (!selectedObject || !fabricCanvas) return 0;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (fo?.strokeWidth && fo?.stroke) return fo.strokeWidth;
    return objectData?.outlineWidth || 0;
  };

  const getCurrentOutlineColor = () => {
    if (!selectedObject || !fabricCanvas) return '#000000';
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (fo?.stroke && typeof fo.stroke === 'string' && fo.stroke.length > 0) return fo.stroke;
    return objectData?.outlineColor || '#000000';
  };

  const handleOutlineWidthChange = (width) => {
    if (!selectedObject || !fabricCanvas) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    const color = width > 0 ? getCurrentOutlineColor() : null;
    fo.set({ strokeWidth: width, stroke: color });
    fabricCanvas.renderAll();
    setCanvasObjects(prev => prev.map(obj =>
      obj.id === selectedObject
        ? { ...obj, outlineWidth: width, outlineColor: color }
        : obj
    ));
  };

  const handleOutlineColorChange = (e) => {
    if (!selectedObject || !fabricCanvas) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    const newColor = e.target.value;
    fo.set('stroke', newColor);
    fabricCanvas.renderAll();
    setCanvasObjects(prev => prev.map(obj =>
      obj.id === selectedObject ? { ...obj, outlineColor: newColor } : obj
    ));
  };

  // ==================== SVG TRACING HANDLERS ====================

  /**
   * Swap the fabric canvas image between bitmap (original) and vector (traced) preview.
   */
  const swapCanvasImageToVector = useCallback(async (svgString, objData) => {
    if (!fabricCanvas || !selectedObject || !objData) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    try {
      const vectorPreviewURL = await rasterizeSVG(svgString, objData.imageWidth || 100, objData.imageHeight || 100);
      // Store the vector preview URL on the object for later restoration
      setCanvasObjects(prev => prev.map(obj =>
        obj.id === selectedObject ? { ...obj, vectorPreviewURL } : obj
      ));
      // Swap the fabric image element
      const newImg = new Image();
      newImg.onload = () => {
        fo.setElement(newImg);
        fo.setCoords();
        fabricCanvas.renderAll();
      };
      newImg.src = vectorPreviewURL;
    } catch (err) {
      console.error('Failed to rasterize SVG for canvas preview:', err);
    }
  }, [fabricCanvas, selectedObject, setCanvasObjects]);

  const swapCanvasImageToBitmap = useCallback((objData) => {
    if (!fabricCanvas || !selectedObject || !objData?.imageDataURL) return;
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    if (!fo) return;
    const origImg = new Image();
    origImg.onload = () => {
      fo.setElement(origImg);
      fo.setCoords();
      fabricCanvas.renderAll();
    };
    origImg.src = objData.imageDataURL;
  }, [fabricCanvas, selectedObject]);

  const handleExportModeChange = (event, newMode) => {
    if (!newMode || !selectedObject) return;
    setTraceError(null);

    const objData = canvasObjects.find(obj => obj.id === selectedObject);

    setCanvasObjects(prev => prev.map(obj =>
      obj.id === selectedObject ? { ...obj, svgExportMode: newMode } : obj
    ));

    if (newMode === 'vector') {
      // If switching to vector and no trace data exists yet, trigger a trace
      if (objData && !objData.svgTracedData) {
        runTrace(objData.imageDataURL, objData.svgTracePreset || 'detailed');
      } else if (objData?.svgTracedData) {
        // Trace data already exists — swap canvas image to vector preview
        swapCanvasImageToVector(objData.svgTracedData, objData);
      }
    } else if (newMode === 'bitmap') {
      // Switching back to bitmap — restore original image on canvas
      if (objData) swapCanvasImageToBitmap(objData);
    }
  };

  const handlePresetChange = (event) => {
    const presetKey = event.target.value;
    if (!selectedObject) return;
    setCanvasObjects(prev => prev.map(obj =>
      obj.id === selectedObject ? { ...obj, svgTracePreset: presetKey, svgTracedData: null } : obj
    ));
    // Re-trace with new preset
    const objData = canvasObjects.find(obj => obj.id === selectedObject);
    if (objData?.svgExportMode === 'vector') {
      runTrace(objData.imageDataURL, presetKey);
    }
  };

  const runTrace = useCallback(async (dataURL, presetKey) => {
    if (!dataURL || !selectedObject) return;
    setIsTracing(true);
    setTraceError(null);
    try {
      const svgString = await traceImageToSVG(dataURL, presetKey);

      const objData = canvasObjects.find(obj => obj.id === selectedObject);

      // Update the canvas object with the traced SVG data
      setCanvasObjects(prev => prev.map(obj =>
        obj.id === selectedObject 
          ? { ...obj, svgTracedData: svgString, svgTracePreset: presetKey } 
          : obj
      ));

      // Swap canvas image to show vector preview
      if (objData) {
        await swapCanvasImageToVector(svgString, objData);
      }
    } catch (err) {
      console.error('SVG tracing failed:', err);
      setTraceError(err.message || 'Tracing failed');
    } finally {
      setIsTracing(false);
    }
  }, [selectedObject, setCanvasObjects, canvasObjects, swapCanvasImageToVector]);

  const handleRetrace = () => {
    const objData = canvasObjects.find(obj => obj.id === selectedObject);
    if (objData?.imageDataURL) {
      runTrace(objData.imageDataURL, objData.svgTracePreset || 'detailed');
    }
  };

  // ==================== COMPUTED VALUES ====================

  const objectData = canvasObjects.find(obj => obj.id === selectedObject);
  const anchorX = objectData?.anchorX ?? 0.5;
  const anchorY = objectData?.anchorY ?? 0.5;
  const hasCustomAnchor = Math.abs(anchorX - 0.5) > 0.01 || Math.abs(anchorY - 0.5) > 0.01;

  const getCurrentFillColor = () => {
    if (!selectedObject || !fabricCanvas) return '#000000';
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    return fo?.fill || objectData?.fill || '#000000';
  };
  const getCurrentStrokeColor = () => {
    if (!selectedObject || !fabricCanvas) return '#000000';
    const fo = findFabricObjectById(fabricCanvas, selectedObject);
    return fo?.stroke || objectData?.strokeColor || '#000000';
  };

  const isSolidShape = objectData && FILL_TYPES.has(objectData.type);
  const isPath = objectData?.type === 'path';
  const isImage = objectData?.type === 'image';
  const pathFills = objectData?.fills || [];

  // Image SVG conversion state
  const svgExportMode = objectData?.svgExportMode || 'bitmap';
  const svgTracePreset = objectData?.svgTracePreset || 'detailed';
  const svgTracedData = objectData?.svgTracedData || null;

  // Current outline values
  const currentOutlineWidth = isSolidShape ? getCurrentOutlineWidth() : 0;
  const currentOutlineColor = isSolidShape ? getCurrentOutlineColor() : '#000000';

  return (
    <Drawer variant="permanent" anchor="right"
      sx={{ width: drawerWidth, flexShrink: 0,
        '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', position: 'relative', height: '100%' } }}>
      <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
        <Typography variant="h6" gutterBottom>
          {fillToolActive ? 'Paint Bucket' : drawingMode ? 'Drawing Tool' : anchorEditMode ? 'Anchor Point' : 'Properties'}
        </Typography>

        {fillToolActive ? (
          <Box>
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
              <Typography variant="body2" fontWeight={600}>🪣 Paint Bucket Tool</Typography>
              <Typography variant="caption">Click on any enclosed region to fill it with color — just like MS Paint!</Typography>
            </Paper>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>Fill Color</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField type="color" value={fillToolColor} onChange={(e) => setFillToolColor(e.target.value)}
                  size="small" sx={{ width: 60, '& input': { cursor: 'pointer', p: 0.5, height: 36 } }} />
                <Typography variant="caption" color="text.secondary">{fillToolColor}</Typography>
              </Box>
            </Box>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                💡 <strong>How to use:</strong>
                <br />• Select a fill color above or from the toolbar swatch
                <br />• Click inside any enclosed area on the canvas
                <br />• Fills are embedded in the parent drawing
                <br />• Fills move with the drawing when animated
                <br />• Press <strong>ESC</strong> to exit paint bucket mode
              </Typography>
            </Paper>
          </Box>
        ) : drawingMode ? (
          <DrawingSettings />
        ) : anchorEditMode ? (
          <>
            {selectedObject ? (
              <Box>
                <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                  <Typography variant="body2" fontWeight={600}>🎯 Anchor Point Mode</Typography>
                  <Typography variant="caption">Drag the red crosshair to move the rotation pivot</Typography>
                </Paper>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
                  <Typography variant="body2"><strong>Pivot X:</strong> {(anchorX * 100).toFixed(0)}%</Typography>
                  <Typography variant="body2"><strong>Pivot Y:</strong> {(anchorY * 100).toFixed(0)}%</Typography>
                  <Typography variant="caption" color="text.secondary">0% = left/top edge, 50% = center, 100% = right/bottom edge</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    💡 <strong>How to use:</strong>
                    <br />• Drag the red crosshair on the canvas to set the pivot
                    <br />• The rotation handle moves to the new pivot
                    <br />• Double-click the crosshair to reset to center
                    <br />• Set the anchor BEFORE adding rotation keyframes
                  </Typography>
                </Paper>
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                <Typography variant="body2" color="text.secondary">Select an object to edit its anchor point</Typography>
              </Paper>
            )}
          </>
        ) : selectedObject && selectedDetails ? (
          <>
            <Box>
              <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <Typography variant="body2" fontWeight={600}>{selectedDetails.name}</Typography>
                <Typography variant="caption">
                  {selectedDetails.type}
                  {hasCustomAnchor && ` • Pivot: ${(anchorX*100).toFixed(0)}%, ${(anchorY*100).toFixed(0)}%`}
                </Typography>
              </Paper>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label={hasCustomAnchor ? "X Position (pivot)" : "X Position (center)"} type="number"
                  value={Math.round(properties.x)} size="small" fullWidth
                  onChange={(e) => handlePositionChange('x', e.target.value)} />
                <TextField label={hasCustomAnchor ? "Y Position (pivot)" : "Y Position (center)"} type="number"
                  value={Math.round(properties.y)} size="small" fullWidth
                  onChange={(e) => handlePositionChange('y', e.target.value)} />
                <TextField label="Scale X" type="number" value={properties.scaleX.toFixed(2)} size="small" fullWidth
                  onChange={(e) => handleScaleChange('x', e.target.value)} inputProps={{ step: 0.1, min: 0.1 }} />
                <TextField label="Scale Y" type="number" value={properties.scaleY.toFixed(2)} size="small" fullWidth
                  onChange={(e) => handleScaleChange('y', e.target.value)} inputProps={{ step: 0.1, min: 0.1 }} />
                <TextField label="Rotation" type="number" value={Math.round(properties.rotation)} size="small" fullWidth
                  onChange={(e) => handleRotationChange(e.target.value)} inputProps={{ step: 1 }} />
                <Box>
                  <Typography variant="body2" gutterBottom>Opacity: {(properties.opacity * 100).toFixed(0)}%</Typography>
                  <Slider value={properties.opacity} min={0} max={1} step={0.01}
                    onChange={handleOpacityChange} valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${(v * 100).toFixed(0)}%`} />
                </Box>

                {isSolidShape && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="body2" gutterBottom fontWeight={600}>🎨 Fill Color</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField type="color" value={getCurrentFillColor()} onChange={handleFillColorChange}
                          size="small" sx={{ width: 60, '& input': { cursor: 'pointer', p: 0.5, height: 36 } }} />
                        <Typography variant="caption" color="text.secondary">{getCurrentFillColor()}</Typography>
                      </Box>
                    </Box>
                  </>
                )}

                {/* ==================== OUTLINE (MS PAINT STYLE) ==================== */}
                {isSolidShape && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="body2" gutterBottom fontWeight={600}>✏️ Outline</Typography>

                      {/* Width selector — visual line thickness options like MS Paint */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, mb: 1.5,
                        border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                        {OUTLINE_WIDTH_OPTIONS.map((opt, idx) => {
                          const isSelected = currentOutlineWidth === opt.value;
                          return (
                            <ButtonBase
                              key={opt.value}
                              onClick={() => handleOutlineWidthChange(opt.value)}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: 1.5,
                                px: 1.5, py: 1,
                                bgcolor: isSelected ? 'primary.main' : 'background.paper',
                                borderBottom: idx < OUTLINE_WIDTH_OPTIONS.length - 1 ? '1px solid' : 'none',
                                borderColor: 'divider',
                                transition: 'background-color 0.15s',
                                '&:hover': { bgcolor: isSelected ? 'primary.main' : 'action.hover' },
                              }}
                            >
                              <Typography variant="caption" sx={{
                                minWidth: 32, fontWeight: 600, fontSize: '0.75rem',
                                color: isSelected ? 'primary.contrastText' : 'text.primary',
                              }}>
                                {opt.label}
                              </Typography>
                              {opt.value > 0 ? (
                                <Box sx={{
                                  flex: 1,
                                  height: Math.max(opt.height, 1),
                                  bgcolor: isSelected ? 'primary.contrastText' : currentOutlineColor,
                                  borderRadius: opt.height >= 5 ? '1px' : 0,
                                }} />
                              ) : (
                                <Typography variant="caption" sx={{
                                  flex: 1, textAlign: 'center', fontStyle: 'italic',
                                  color: isSelected ? 'primary.contrastText' : 'text.disabled',
                                  fontSize: '0.7rem',
                                }}>
                                  No outline
                                </Typography>
                              )}
                            </ButtonBase>
                          );
                        })}
                      </Box>

                      {/* Outline color picker — only shown when width > 0 */}
                      {currentOutlineWidth > 0 && (
                        <Box>
                          <Typography variant="body2" gutterBottom sx={{ fontSize: '0.8rem' }}>
                            Outline Color
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField type="color" value={currentOutlineColor} onChange={handleOutlineColorChange}
                              size="small" sx={{ width: 60, '& input': { cursor: 'pointer', p: 0.5, height: 36 } }} />
                            <Typography variant="caption" color="text.secondary">{currentOutlineColor}</Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </>
                )}

                {isPath && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="body2" gutterBottom fontWeight={600}>🖊️ Stroke Color</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField type="color" value={getCurrentStrokeColor()} onChange={handleStrokeColorChange}
                          size="small" sx={{ width: 60, '& input': { cursor: 'pointer', p: 0.5, height: 36 } }} />
                        <Typography variant="caption" color="text.secondary">{getCurrentStrokeColor()}</Typography>
                      </Box>
                    </Box>
                    {pathFills.length > 0 && (
                      <Box>
                        <Typography variant="body2" gutterBottom fontWeight={600}>🪣 Fills ({pathFills.length})</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                          {pathFills.map((fill, i) => (
                            <Box key={fill.id || i} sx={{ width: 28, height: 28, bgcolor: fill.color,
                              border: '2px solid', borderColor: 'grey.400', borderRadius: 0.5 }}
                              title={`${fill.color} — ${fill.width}×${fill.height}px`} />
                          ))}
                        </Box>
                        <Button size="small" color="warning" variant="outlined" onClick={handleClearFills}>Clear All Fills</Button>
                      </Box>
                    )}
                    {pathFills.length === 0 && (
                      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'info.light' }}>
                        <Typography variant="caption" color="info.contrastText">
                          💡 To fill an enclosed area (like a head), use the <strong>🪣 Paint Bucket</strong> tool in the toolbar
                        </Typography>
                      </Paper>
                    )}
                  </>
                )}

                {/* ==================== IMAGE SVG CONVERSION ==================== */}
                {isImage && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="body2" gutterBottom fontWeight={600}>📐 Export Image Format</Typography>

                      <ToggleButtonGroup
                        value={svgExportMode}
                        exclusive
                        onChange={handleExportModeChange}
                        size="small"
                        fullWidth
                        sx={{ mb: 1.5 }}
                      >
                        <ToggleButton value="bitmap" sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                          🖼️ Bitmap
                        </ToggleButton>
                        <ToggleButton value="vector" sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                          📐 Vector (SVG)
                        </ToggleButton>
                      </ToggleButtonGroup>

                      {svgExportMode === 'bitmap' && (
                        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                            Exports the original image as a base64 <code>&lt;img&gt;</code> tag. 
                            Pixel-perfect but raster — will pixelate if scaled up.
                          </Typography>
                        </Paper>
                      )}

                      {svgExportMode === 'vector' && (
                        <Box>
                          {/* Preset selector */}
                          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                            <InputLabel>Trace Style</InputLabel>
                            <Select
                              value={svgTracePreset}
                              label="Trace Style"
                              onChange={handlePresetChange}
                              disabled={isTracing}
                            >
                              {TRACE_PRESETS.map(preset => (
                                <MenuItem key={preset.key} value={preset.key}>
                                  <Box>
                                    <Typography variant="body2">{preset.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {preset.description}
                                    </Typography>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          {/* Trace / Retrace button */}
                          <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            onClick={handleRetrace}
                            disabled={isTracing}
                            startIcon={isTracing ? <CircularProgress size={16} /> : null}
                            sx={{ mb: 1.5 }}
                          >
                            {isTracing ? 'Tracing...' : svgTracedData ? 'Re-trace' : 'Trace to SVG'}
                          </Button>

                          {traceError && (
                            <Paper variant="outlined" sx={{ p: 1, mb: 1.5, bgcolor: 'error.light' }}>
                              <Typography variant="caption" color="error.contrastText">
                                ⚠️ {traceError}
                              </Typography>
                            </Paper>
                          )}

                          {/* Side-by-side comparison */}
                          {svgTracedData && !isTracing && (
                            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#fafafa' }}>
                              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Comparison Preview
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                {/* Original bitmap */}
                                <Box sx={{ flex: 1, textAlign: 'center' }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.65rem' }}>
                                    Bitmap (Original)
                                  </Typography>
                                  <Box sx={{ 
                                    width: '100%', aspectRatio: `${objectData.imageWidth || 1}/${objectData.imageHeight || 1}`,
                                    border: '1px solid', borderColor: 'divider', borderRadius: 0.5, overflow: 'hidden',
                                    bgcolor: '#fff',
                                  }}>
                                    <img 
                                      src={objectData.imageDataURL} 
                                      alt="Original"
                                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} 
                                    />
                                  </Box>
                                </Box>
                                {/* Traced SVG */}
                                <Box sx={{ flex: 1, textAlign: 'center' }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.65rem' }}>
                                    Vector (SVG Traced)
                                  </Typography>
                                  <Box sx={{ 
                                    width: '100%', aspectRatio: `${objectData.imageWidth || 1}/${objectData.imageHeight || 1}`,
                                    border: '1px solid', borderColor: 'divider', borderRadius: 0.5, overflow: 'hidden',
                                    bgcolor: '#fff',
                                    '& svg': { width: '100%', height: '100%', display: 'block' },
                                  }}
                                    dangerouslySetInnerHTML={{ __html: createSizedSVG(svgTracedData, objectData.imageWidth || 100, objectData.imageHeight || 100) }}
                                  />
                                </Box>
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, lineHeight: 1.4 }}>
                                The vector version uses SVG <code>&lt;path&gt;</code> elements — 
                                no pixels, no base64. It stays sharp at any zoom level.
                              </Typography>
                            </Paper>
                          )}

                          <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, bgcolor: 'info.light' }}>
                            <Typography variant="caption" color="info.contrastText" sx={{ lineHeight: 1.5 }}>
                              💡 <strong>How it works:</strong> The bitmap is traced into 
                              mathematical vector paths using color quantization and contour detection.
                              The exported code uses <code>&lt;svg&gt;&lt;path&gt;</code> elements 
                              instead of <code>&lt;img src="base64..."&gt;</code>.
                              <br /><br />
                              <strong>Evidence:</strong> Inspect the exported HTML source to see 
                              actual <code>&lt;path d="M..."&gt;</code> data — not embedded bitmaps.
                              Zoom into the exported page to see smooth vector edges.
                            </Typography>
                          </Paper>
                        </Box>
                      )}
                    </Box>
                  </>
                )}
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  💡 <strong>Tip:</strong> {hasCustomAnchor 
                    ? 'X/Y show the pivot point position. The object rotates around this point.' 
                    : 'X/Y show the center position. Drag objects or type values, then click "Add Keyframe" to record.'}
                  {hasCustomAnchor && (<><br /><br />🎯 Pivot at ({(anchorX*100).toFixed(0)}%, {(anchorY*100).toFixed(0)}%).</>)}
                </Typography>
              </Paper>
            </Box>
          </>
        ) : (
          <Box>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>🖼️ Canvas Background</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField type="color" value={canvasBgColor} onChange={(e) => setCanvasBgColor(e.target.value)}
                  size="small" sx={{ width: 60, '& input': { cursor: 'pointer', p: 0.5, height: 36 } }} />
                <Typography variant="caption" color="text.secondary">{canvasBgColor}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Changes apply to editor, preview, and exported code
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
              <Typography variant="body2" color="text.secondary">
                Select an object on the stage to view and edit its properties
              </Typography>
            </Paper>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default PropertiesPanel;