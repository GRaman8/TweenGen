import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Paper, Typography, Box, Tooltip, IconButton, Menu, MenuItem, Badge, Divider } from '@mui/material';
import { 
  Sync as SyncIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { 
  useCanvasObjects, 
  useKeyframes, 
  useTrackOrder, 
  useFabricCanvas,
  useHiddenTracks,
  useSelectedObject,
} from '../../store/hooks';
import PlaybackControls from './PlaybackControls';
import TimelineScrubber from './TimelineScrubber';
import TimelineTrack from './TimelineTrack';

const Timeline = () => {
  const [canvasObjects] = useCanvasObjects();
  const [keyframes] = useKeyframes();
  const [trackOrder, setTrackOrder] = useTrackOrder();
  const [fabricCanvas] = useFabricCanvas();
  const [hiddenTracks, setHiddenTracks] = useHiddenTracks();
  const [selectedObject] = useSelectedObject();
  
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null);
  const [hiddenMenuAnchor, setHiddenMenuAnchor] = useState(null);

  useEffect(() => {
    setTrackOrder(prev => {
      const existingIds = new Set(canvasObjects.map(o => o.id));
      const filtered = prev.filter(id => existingIds.has(id));
      const inOrder = new Set(filtered);
      const newIds = canvasObjects.filter(o => !inOrder.has(o.id)).map(o => o.id);
      if (newIds.length === 0 && filtered.length === prev.length) return prev;
      return [...newIds, ...filtered];
    });
  }, [canvasObjects, setTrackOrder]);

  useEffect(() => {
    const existingIds = new Set(canvasObjects.map(o => o.id));
    setHiddenTracks(prev => {
      const hasStale = Object.keys(prev).some(id => !existingIds.has(id));
      if (!hasStale) return prev;
      const next = {};
      Object.keys(prev).forEach(id => { if (existingIds.has(id)) next[id] = true; });
      return next;
    });
  }, [canvasObjects, setHiddenTracks]);

  useEffect(() => {
    if (selectedObject && hiddenTracks[selectedObject]) {
      setHiddenTracks(prev => { const next = { ...prev }; delete next[selectedObject]; return next; });
    }
  }, [selectedObject, hiddenTracks, setHiddenTracks]);

  const orderedObjects = React.useMemo(() => {
    if (trackOrder.length === 0) return canvasObjects;
    const objMap = {};
    canvasObjects.forEach(obj => { objMap[obj.id] = obj; });
    const ordered = trackOrder.map(id => objMap[id]).filter(Boolean);
    const inOrder = new Set(trackOrder);
    canvasObjects.forEach(obj => { if (!inOrder.has(obj.id)) ordered.push(obj); });
    return ordered;
  }, [canvasObjects, trackOrder]);

  const visibleObjects = orderedObjects.filter(obj => !hiddenTracks[obj.id]);
  const hiddenObjects = orderedObjects.filter(obj => hiddenTracks[obj.id]);

  const handleDragStart = useCallback((objectId) => { setDraggedId(objectId); }, []);
  const handleDragOver = useCallback((e, objectId) => {
    e.preventDefault();
    if (!draggedId || draggedId === objectId) { setDragOverId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOverId(objectId);
    setDragOverPosition(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below');
  }, [draggedId]);
  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    setTrackOrder(prev => {
      const order = [...prev]; const from = order.indexOf(draggedId);
      if (from < 0) return prev; order.splice(from, 1);
      let to = order.indexOf(targetId); if (to < 0) return prev;
      if (dragOverPosition === 'below') to += 1; order.splice(to, 0, draggedId); return order;
    });
    if (fabricCanvas) setTimeout(() => syncCanvasZOrderToTrackOrder(), 0);
    setDraggedId(null); setDragOverId(null); setDragOverPosition(null);
  }, [draggedId, dragOverPosition, fabricCanvas, setTrackOrder]);
  const handleDragEnd = useCallback(() => { setDraggedId(null); setDragOverId(null); setDragOverPosition(null); }, []);

  const syncCanvasZOrderToTrackOrder = useCallback(() => {
    if (!fabricCanvas) return;
    [...trackOrder].reverse().forEach(id => {
      const obj = fabricCanvas.getObjects().find(o => o.id === id);
      if (obj) try { if (typeof fabricCanvas.bringObjectToFront === 'function') fabricCanvas.bringObjectToFront(obj); } catch(e) {}
    });
    fabricCanvas.renderAll();
  }, [fabricCanvas, trackOrder]);

  const syncTrackOrderFromCanvas = useCallback(() => {
    if (!fabricCanvas) return;
    const newOrder = [...fabricCanvas.getObjects()].filter(obj => obj.id).reverse().map(obj => obj.id);
    setTrackOrder(newOrder);
  }, [fabricCanvas, setTrackOrder]);

  const handleShowTrack = (objectId) => { setHiddenTracks(prev => { const n = { ...prev }; delete n[objectId]; return n; }); setHiddenMenuAnchor(null); };
  const handleShowAllTracks = () => { setHiddenTracks({}); setHiddenMenuAnchor(null); };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'rectangle':   return '▬';
      case 'circle':      return '●';
      case 'roundedRect': return '▢';
      case 'ellipse':     return '⬮';
      case 'triangle':    return '△';
      case 'diamond':     return '◇';
      case 'pentagon':    return '⬠';
      case 'hexagon':     return '⬡';
      case 'star':        return '★';
      case 'arrow':       return '➤';
      case 'heart':       return '♥';
      case 'cross':       return '✚';
      case 'text':        return 'T';
      case 'path':        return '✎';
      case 'group':       return '⊞';
      case 'image':       return '🖼';
      default:            return '•';
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6">Timeline</Typography>
        <Tooltip title="Sync track order from canvas layer order">
          <IconButton size="small" onClick={syncTrackOrderFromCanvas}><SyncIcon fontSize="small" /></IconButton>
        </Tooltip>
        {hiddenObjects.length > 0 && (
          <Tooltip title={`${hiddenObjects.length} hidden track${hiddenObjects.length !== 1 ? 's' : ''} — click to manage`}>
            <IconButton size="small" onClick={(e) => setHiddenMenuAnchor(e.currentTarget)} sx={{ ml: 'auto' }}>
              <Badge badgeContent={hiddenObjects.length} color="primary" max={99}><MoreVertIcon fontSize="small" /></Badge>
            </IconButton>
          </Tooltip>
        )}
      </Box>
      
      <PlaybackControls />
      <TimelineScrubber />
      
      <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
        {visibleObjects.length === 0 && hiddenObjects.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography variant="body2">Add elements to the stage to see timeline tracks</Typography>
          </Box>
        ) : visibleObjects.length === 0 && hiddenObjects.length > 0 ? (
          <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
            <Typography variant="body2">All tracks are hidden.</Typography>
            <Typography variant="caption" color="text.secondary">
              Click the <MoreVertIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} /> button above to show them.
            </Typography>
          </Box>
        ) : (
          visibleObjects.map((obj, index) => (
            <TimelineTrack key={obj.id} object={obj} keyframes={keyframes[obj.id] || []}
              isDragged={draggedId === obj.id} isDragOver={dragOverId === obj.id} dragOverPosition={dragOverPosition}
              onDragStart={() => handleDragStart(obj.id)} onDragOver={(e) => handleDragOver(e, obj.id)}
              onDrop={(e) => handleDrop(e, obj.id)} onDragEnd={handleDragEnd} trackIndex={index} />
          ))
        )}
      </Box>

      <Menu anchorEl={hiddenMenuAnchor} open={Boolean(hiddenMenuAnchor)} onClose={() => setHiddenMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 220, maxHeight: 400 } } }}>
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">Hidden Tracks ({hiddenObjects.length})</Typography>
        </MenuItem>
        <Divider />
        {hiddenObjects.map(obj => (
          <MenuItem key={obj.id} onClick={() => handleShowTrack(obj.id)} sx={{ py: 0.75 }}>
            <VisibilityOffIcon fontSize="small" sx={{ mr: 1.5, color: 'text.disabled' }} />
            <Typography variant="caption" sx={{ mr: 0.75, opacity: 0.5, fontSize: '10px' }}>{getTypeIcon(obj.type)}</Typography>
            <Typography variant="body2" sx={{ flex: 1 }}>{obj.name}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{(keyframes[obj.id] || []).length} kf</Typography>
          </MenuItem>
        ))}
        {hiddenObjects.length > 1 && (
          <>
            <Divider />
            <MenuItem onClick={handleShowAllTracks}>
              <VisibilityIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
              <Typography variant="body2" color="primary.main" fontWeight={600}>Show All Tracks</Typography>
            </MenuItem>
          </>
        )}
      </Menu>
    </Paper>
  );
};

export default Timeline;