import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, Typography, Paper, IconButton, Menu, MenuItem, TextField, Tooltip, Divider,
} from '@mui/material';
import { 
  Delete, Lock, LockOpen, DragIndicator, VisibilityOff,
} from '@mui/icons-material';
import { 
  useSelectedObject, 
  useDuration, 
  useKeyframes, 
  useCurrentTime, 
  useSelectedKeyframe,
  useLockedTracks,
  useCanvasObjects,
  useFabricCanvas,
  useHiddenTracks,
} from '../../store/hooks';
import { EASING_OPTIONS } from '../../utils/easing';
import { findFabricObjectById } from '../../utils/fabricHelpers';

const Z_SWAP_OPTIONS = [
  { value: 0,    label: 'At Start (0%)' },
  { value: 0.25, label: 'At 25%' },
  { value: 0.5,  label: 'At Middle (50%) — default' },
  { value: 0.75, label: 'At 75%' },
  { value: 1,    label: 'At End (100%)' },
];

const TimelineTrack = ({ 
  object, 
  keyframes: objectKeyframes,
  isDragged,
  isDragOver,
  dragOverPosition,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  trackIndex,
}) => {
  const [selectedObject, setSelectedObject] = useSelectedObject();
  const [duration] = useDuration();
  const [keyframes, setKeyframes] = useKeyframes();
  const [currentTime, setCurrentTime] = useCurrentTime();
  const [selectedKeyframe, setSelectedKeyframe] = useSelectedKeyframe();
  const [lockedTracks, setLockedTracks] = useLockedTracks();
  const [canvasObjects, setCanvasObjects] = useCanvasObjects();
  const [fabricCanvas] = useFabricCanvas();
  const [, setHiddenTracks] = useHiddenTracks();
  
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [contextKfIndex, setContextKfIndex] = React.useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(object?.name || '');
  const renameInputRef = useRef(null);

  if (!object) return null;
  
  const isSelected = selectedObject === object.id;
  const isLocked = !!lockedTracks[object.id];

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const isKeyframeSelected = (idx) => {
    return selectedKeyframe && 
           selectedKeyframe.objectId === object.id && 
           selectedKeyframe.index === idx;
  };

  const currentZSwapPoint = contextKfIndex !== null 
    ? (objectKeyframes[contextKfIndex]?.zSwapPoint ?? 0.5) 
    : 0.5;

  const handleKeyframeClick = (index, event) => {
    event.stopPropagation();
    if (isLocked) return;
    const kf = objectKeyframes[index];
    setSelectedObject(object.id);
    setCurrentTime(kf.time);
    setSelectedKeyframe({ objectId: object.id, index });
    if (fabricCanvas) {
      const fabricObject = findFabricObjectById(fabricCanvas, object.id);
      if (fabricObject && kf.properties) {
        fabricObject.set({ left: kf.properties.x, top: kf.properties.y,
          scaleX: kf.properties.scaleX, scaleY: kf.properties.scaleY,
          angle: kf.properties.rotation, opacity: kf.properties.opacity });
        fabricObject.setCoords(); fabricCanvas.setActiveObject(fabricObject); fabricCanvas.renderAll();
      }
    }
  };

  const handleKeyframeRightClick = (index, event) => {
    event.preventDefault(); event.stopPropagation();
    if (isLocked) return;
    setContextKfIndex(index); setAnchorEl(event.currentTarget);
  };
  const handleCloseMenu = () => { setAnchorEl(null); setContextKfIndex(null); };

  const handleDeleteKeyframe = () => {
    if (contextKfIndex === null) return;
    setKeyframes(prev => { const u = { ...prev }; u[object.id] = u[object.id].filter((_, idx) => idx !== contextKfIndex); return u; });
    if (selectedKeyframe?.objectId === object.id && selectedKeyframe?.index === contextKfIndex) setSelectedKeyframe(null);
    handleCloseMenu();
  };
  const handleChangeEasing = (easingType) => {
    if (contextKfIndex === null) return;
    setKeyframes(prev => { const u = { ...prev }; u[object.id] = [...u[object.id]]; u[object.id][contextKfIndex] = { ...u[object.id][contextKfIndex], easing: easingType }; return u; });
    handleCloseMenu();
  };
  const handleChangeZSwapPoint = (value) => {
    if (contextKfIndex === null) return;
    setKeyframes(prev => { const u = { ...prev }; u[object.id] = [...u[object.id]]; u[object.id][contextKfIndex] = { ...u[object.id][contextKfIndex], zSwapPoint: value }; return u; });
    handleCloseMenu();
  };

  const handleTrackClick = () => { if (!isLocked) { setSelectedObject(object.id); setSelectedKeyframe(null); } };
  const handleToggleLock = (e) => { e.stopPropagation(); setLockedTracks(prev => { const n = { ...prev }; if (n[object.id]) delete n[object.id]; else n[object.id] = true; return n; }); };
  const handleHideTrack = (e) => { e.stopPropagation(); setHiddenTracks(prev => ({ ...prev, [object.id]: true })); };

  const handleDoubleClickName = (e) => { e.stopPropagation(); if (isLocked) return; setRenameValue(object.name); setIsRenaming(true); };
  const handleRenameSubmit = () => { const t = renameValue.trim(); if (t && t !== object.name) setCanvasObjects(prev => prev.map(obj => obj.id === object.id ? { ...obj, name: t } : obj)); setIsRenaming(false); };
  const handleRenameKeyDown = (e) => { if (e.key === 'Enter') handleRenameSubmit(); else if (e.key === 'Escape') setIsRenaming(false); };

  const getDragIndicatorStyle = () => {
    if (!isDragOver) return {};
    return dragOverPosition === 'above' ? { borderTop: '3px solid #1976d2' } : { borderBottom: '3px solid #1976d2' };
  };

  const getTypeIcon = () => {
    switch (object.type) {
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
      case 'fill':        return '🪣';
      default:            return '•';
    }
  };

  return (
    <Paper variant="outlined" draggable={!isLocked}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', object.id); onDragStart?.(); }}
      onDragOver={(e) => onDragOver?.(e)} onDrop={(e) => onDrop?.(e)} onDragEnd={onDragEnd}
      sx={{ p: 0.75, mb: 0.5, bgcolor: isLocked ? 'grey.200' : isSelected ? 'action.selected' : 'background.paper',
        opacity: isLocked ? 0.5 : isDragged ? 0.4 : 1, transition: 'all 0.2s',
        cursor: isLocked ? 'default' : 'pointer', userSelect: 'none', ...getDragIndicatorStyle() }}
      onClick={handleTrackClick}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title="Drag to reorder">
          <Box sx={{ cursor: isLocked ? 'default' : 'grab', display: 'flex', alignItems: 'center', color: 'text.disabled', '&:hover': { color: isLocked ? 'text.disabled' : 'text.primary' } }}>
            <DragIndicator fontSize="small" />
          </Box>
        </Tooltip>
        <Tooltip title={isLocked ? "Unlock track" : "Lock track"}>
          <IconButton size="small" onClick={handleToggleLock} sx={{ p: 0.25 }}>
            {isLocked ? <Lock fontSize="small" color="disabled" /> : <LockOpen fontSize="small" color="action" />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Hide track">
          <IconButton size="small" onClick={handleHideTrack} sx={{ p: 0.25 }}>
            <VisibilityOff fontSize="small" sx={{ color: 'text.disabled', fontSize: '16px' }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 100, maxWidth: 120 }}>
          <Typography variant="caption" sx={{ fontSize: '10px', opacity: 0.6 }}>{getTypeIcon()}</Typography>
          {isRenaming ? (
            <TextField inputRef={renameInputRef} value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit} onKeyDown={handleRenameKeyDown} size="small" variant="standard"
              sx={{ '& input': { fontSize: '0.75rem', p: 0, fontWeight: 600 }, maxWidth: 100 }}
              onClick={(e) => e.stopPropagation()} />
          ) : (
            <Tooltip title="Double-click to rename">
              <Typography variant="body2" onDoubleClick={handleDoubleClickName}
                sx={{ fontWeight: isSelected ? 600 : 400, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: isLocked ? 'default' : 'text' }}>
                {object.name}
              </Typography>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ flex: 1, position: 'relative', height: 28, bgcolor: isLocked ? '#e8e8e8' : '#f5f5f5', borderRadius: 1, border: '1px solid', borderColor: isSelected ? 'primary.main' : '#e0e0e0' }}>
          {objectKeyframes.map((kf, idx) => {
            const isKfSelected = isKeyframeSelected(idx);
            const isAtScrubber = Math.abs(currentTime - kf.time) < 0.05;
            const hasEasing = kf.easing && kf.easing !== 'linear';
            const hasCustomZSwap = kf.zSwapPoint !== undefined && kf.zSwapPoint !== 0.5;
            let kfColor = 'primary.main';
            if (isKfSelected) kfColor = '#ff9800';
            else if (isAtScrubber) kfColor = '#4caf50';
            else if (hasEasing) kfColor = 'secondary.main';
            return (
              <Tooltip key={idx} title={`${kf.time.toFixed(2)}s${hasEasing ? ` (${kf.easing})` : ''}${hasCustomZSwap ? ` • z-swap ${(kf.zSwapPoint * 100).toFixed(0)}%` : ''}`} placement="top">
                <Box onClick={(e) => handleKeyframeClick(idx, e)} onContextMenu={(e) => handleKeyframeRightClick(idx, e)}
                  sx={{ position: 'absolute', left: `${(kf.time / duration) * 100}%`, top: '50%',
                    transform: 'translate(-50%, -50%) rotate(45deg)', width: isKfSelected ? 12 : 9, height: isKfSelected ? 12 : 9,
                    bgcolor: kfColor, border: isKfSelected ? '2px solid #e65100' : hasCustomZSwap ? '2px solid #ff6b00' : '2px solid white',
                    borderRadius: isKfSelected ? '2px' : '1px', cursor: isLocked ? 'default' : 'pointer', transition: 'all 0.15s',
                    boxShadow: isKfSelected ? '0 0 0 3px rgba(255,152,0,0.4)' : isAtScrubber ? '0 0 0 2px rgba(76,175,80,0.4)' : 'none',
                    '&:hover': isLocked ? {} : { width: 13, height: 13, bgcolor: isKfSelected ? '#e65100' : 'primary.dark' },
                    zIndex: isKfSelected ? 10 : isAtScrubber ? 5 : 1, pointerEvents: isLocked ? 'none' : 'auto' }} />
              </Tooltip>
            );
          })}
        </Box>

        <Typography variant="caption" sx={{ minWidth: 50, textAlign: 'right', color: 'text.secondary', fontSize: '0.7rem' }}>
          {objectKeyframes.length} kf
        </Typography>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
        <MenuItem disabled><Typography variant="caption" color="text.secondary">Keyframe at {contextKfIndex !== null ? objectKeyframes[contextKfIndex]?.time.toFixed(2) : 0}s</Typography></MenuItem>
        <MenuItem onClick={handleDeleteKeyframe}><Delete fontSize="small" sx={{ mr: 1 }} />Delete Keyframe</MenuItem>
        <Divider />
        <MenuItem disabled sx={{ opacity: '1 !important' }}><Typography variant="caption" fontWeight={700} color="text.secondary">Easing</Typography></MenuItem>
        {EASING_OPTIONS.map(option => (
          <MenuItem key={option.value} onClick={() => handleChangeEasing(option.value)} selected={contextKfIndex !== null && objectKeyframes[contextKfIndex]?.easing === option.value}>{option.label}</MenuItem>
        ))}
        {contextKfIndex !== null && contextKfIndex > 0 && (
          <>
            <Divider />
            <MenuItem disabled sx={{ opacity: '1 !important' }}><Typography variant="caption" fontWeight={700} color="text.secondary">Z-Order Swap Point</Typography></MenuItem>
            {Z_SWAP_OPTIONS.map(option => (
              <MenuItem key={option.value} onClick={() => handleChangeZSwapPoint(option.value)} selected={Math.abs(currentZSwapPoint - option.value) < 0.01} sx={{ fontSize: '0.85rem' }}>{option.label}</MenuItem>
            ))}
          </>
        )}
      </Menu>
    </Paper>
  );
};

export default TimelineTrack;