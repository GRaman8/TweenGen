import React, { useEffect } from 'react';
import { Box, Drawer, Typography, TextField, Slider, Divider, Paper, Button } from '@mui/material';
import DrawingSettings from '../Toolbar/DrawingSettings';
import { 
  useSelectedObject, useSelectedObjectProperties, useSelectedObjectDetails,
  useCurrentTime, useKeyframes, useFabricCanvas, useDrawingMode,
  useAnchorEditMode, useCanvasObjects, useCanvasBgColor,
  useFillToolActive, useFillToolColor,
} from '../../store/hooks';
import { findFabricObjectById, extractPropertiesFromFabricObject } from '../../utils/fabricHelpers';

// All types that have a fill/color property (not paths, groups, or images)
const FILL_TYPES = new Set([
  'rectangle', 'circle', 'roundedRect', 'ellipse',
  'triangle', 'diamond', 'pentagon', 'hexagon',
  'star', 'arrow', 'heart', 'cross', 'text',
]);

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
  const pathFills = objectData?.fills || [];

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