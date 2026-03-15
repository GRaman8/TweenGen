import React, { useState, useRef, useEffect } from 'react';
import { TrashIcon, LockClosedIcon, LockOpenIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Bars2Icon } from '@heroicons/react/24/solid';
import Tooltip from '../ui/Tooltip';
import { 
  useSelectedObject, useDuration, useKeyframes, useCurrentTime, useSelectedKeyframe,
  useLockedTracks, useCanvasObjects, useFabricCanvas, useHiddenTracks,
} from '../../store/hooks';
import { EASING_OPTIONS } from '../../utils/easing';
import { findFabricObjectById } from '../../utils/fabricHelpers';

const Z_SWAP_OPTIONS = [
  { value: 0, label: 'At Start (0%)' }, { value: 0.25, label: 'At 25%' },
  { value: 0.5, label: 'At Middle (50%) — default' }, { value: 0.75, label: 'At 75%' },
  { value: 1, label: 'At End (100%)' },
];

const TimelineTrack = ({ 
  object, keyframes: objectKeyframes, isDragged, isDragOver, dragOverPosition,
  onDragStart, onDragOver, onDrop, onDragEnd,
}) => {
  const [selectedObject, setSelectedObject] = useSelectedObject();
  const [duration] = useDuration();
  const [keyframes, setKeyframes] = useKeyframes();
  const [currentTime, setCurrentTime] = useCurrentTime();
  const [selectedKeyframe, setSelectedKeyframe] = useSelectedKeyframe();
  const [lockedTracks, setLockedTracks] = useLockedTracks();
  const [, setCanvasObjects] = useCanvasObjects();
  const [fabricCanvas] = useFabricCanvas();
  const [, setHiddenTracks] = useHiddenTracks();
  const [contextMenu, setContextMenu] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(object?.name || '');
  const renameInputRef = useRef(null);

  if (!object) return null;
  const isSelected = selectedObject === object.id;
  const isLocked = !!lockedTracks[object.id];

  useEffect(() => { if (isRenaming && renameInputRef.current) { renameInputRef.current.focus(); renameInputRef.current.select(); } }, [isRenaming]);
  useEffect(() => { if (!contextMenu) return; const h = () => setContextMenu(null); window.addEventListener('click', h); return () => window.removeEventListener('click', h); }, [contextMenu]);

  const isKfSelected = (idx) => selectedKeyframe?.objectId === object.id && selectedKeyframe?.index === idx;
  const ctxKfSwap = contextMenu?.kfIndex != null ? (objectKeyframes[contextMenu.kfIndex]?.zSwapPoint ?? 0.5) : 0.5;

  const handleKfClick = (idx, e) => {
    e.stopPropagation(); if (isLocked) return;
    const kf = objectKeyframes[idx]; setSelectedObject(object.id); setCurrentTime(kf.time);
    setSelectedKeyframe({ objectId: object.id, index: idx });
    if (fabricCanvas) {
      const fo = findFabricObjectById(fabricCanvas, object.id);
      if (fo && kf.properties) { fo.set({ left: kf.properties.x, top: kf.properties.y, scaleX: kf.properties.scaleX, scaleY: kf.properties.scaleY, angle: kf.properties.rotation, opacity: kf.properties.opacity }); fo.setCoords(); fabricCanvas.setActiveObject(fo); fabricCanvas.renderAll(); }
    }
  };
  const handleKfContext = (idx, e) => { e.preventDefault(); e.stopPropagation(); if (!isLocked) setContextMenu({ x: e.clientX, y: e.clientY, kfIndex: idx }); };
  const handleDeleteKf = () => { if (contextMenu?.kfIndex == null) return; setKeyframes(prev => { const u = { ...prev }; u[object.id] = u[object.id].filter((_, i) => i !== contextMenu.kfIndex); return u; }); if (selectedKeyframe?.objectId === object.id && selectedKeyframe?.index === contextMenu.kfIndex) setSelectedKeyframe(null); setContextMenu(null); };
  const handleEasing = (v) => { if (contextMenu?.kfIndex == null) return; setKeyframes(prev => { const u = { ...prev }; u[object.id] = [...u[object.id]]; u[object.id][contextMenu.kfIndex] = { ...u[object.id][contextMenu.kfIndex], easing: v }; return u; }); setContextMenu(null); };
  const handleZSwap = (v) => { if (contextMenu?.kfIndex == null) return; setKeyframes(prev => { const u = { ...prev }; u[object.id] = [...u[object.id]]; u[object.id][contextMenu.kfIndex] = { ...u[object.id][contextMenu.kfIndex], zSwapPoint: v }; return u; }); setContextMenu(null); };
  const handleTrackClick = () => { if (!isLocked) { setSelectedObject(object.id); setSelectedKeyframe(null); } };
  const handleToggleLock = (e) => { e.stopPropagation(); setLockedTracks(prev => { const n = { ...prev }; if (n[object.id]) delete n[object.id]; else n[object.id] = true; return n; }); };
  const handleHide = (e) => { e.stopPropagation(); setHiddenTracks(prev => ({ ...prev, [object.id]: true })); };
  const handleDblClickName = (e) => { e.stopPropagation(); if (!isLocked) { setRenameValue(object.name); setIsRenaming(true); } };
  const handleRenameSubmit = () => { const t = renameValue.trim(); if (t && t !== object.name) setCanvasObjects(prev => prev.map(obj => obj.id === object.id ? { ...obj, name: t } : obj)); setIsRenaming(false); };
  const handleRenameKey = (e) => { if (e.key === 'Enter') handleRenameSubmit(); else if (e.key === 'Escape') setIsRenaming(false); };

  const dragBorder = !isDragOver ? '' : dragOverPosition === 'above' ? 'border-t-[3px] border-t-[#1976d2]' : 'border-b-[3px] border-b-[#1976d2]';
  const typeIcons = { rectangle: '▬', circle: '●', roundedRect: '▢', ellipse: '⬮', triangle: '△', diamond: '◇', pentagon: '⬠', hexagon: '⬡', star: '★', arrow: '➤', heart: '♥', cross: '✚', text: 'T', path: '✎', group: '⊞', image: '🖼', fill: '🪣' };

  return (
    <>
      <div
        draggable={!isLocked}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', object.id); onDragStart?.(); }}
        onDragOver={(e) => onDragOver?.(e)} onDrop={(e) => onDrop?.(e)} onDragEnd={onDragEnd}
        className={`px-2 py-2 mb-1 rounded-md border transition-all select-none
          ${isLocked ? 'bg-gray-100 opacity-50' : isSelected ? 'bg-blue-50 border-[#1976d2]' : 'bg-white border-gray-300 hover:border-gray-400 cursor-pointer'}
          ${isDragged ? 'opacity-40' : ''} ${dragBorder}`}
        onClick={handleTrackClick}
        role="row" aria-selected={isSelected}
      >
        <div className="flex items-center gap-1.5">
          <Tooltip title="Drag to reorder">
            <div className={`flex items-center ${isLocked ? 'text-gray-300' : 'cursor-grab text-gray-400 hover:text-gray-600'}`} aria-hidden="true">
              <Bars2Icon className="w-5 h-5" />
            </div>
          </Tooltip>

          <Tooltip title={isLocked ? 'Unlock track' : 'Lock track'}>
            <button onClick={handleToggleLock} className="p-1 rounded hover:bg-gray-200 transition-colors" aria-label={isLocked ? 'Unlock track' : 'Lock track'}>
              {isLocked ? <LockClosedIcon className="w-[18px] h-[18px] text-gray-400" /> : <LockOpenIcon className="w-[18px] h-[18px] text-gray-600" />}
            </button>
          </Tooltip>

          <Tooltip title="Hide track">
            <button onClick={handleHide} className="p-1 rounded hover:bg-gray-200 transition-colors" aria-label="Hide track">
              <EyeSlashIcon className="w-[18px] h-[18px] text-gray-400" />
            </button>
          </Tooltip>

          <div className="flex items-center gap-1.5 min-w-[110px] max-w-[130px]">
            <span className="text-[12px] opacity-60 leading-none" aria-hidden="true">{typeIcons[object.type] || '•'}</span>
            {isRenaming ? (
              <input ref={renameInputRef} value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit} onKeyDown={handleRenameKey}
                className="text-[13px] font-semibold max-w-[100px] px-1 border-b-2 border-[#1976d2] outline-none bg-transparent"
                onClick={(e) => e.stopPropagation()} aria-label="Rename track" />
            ) : (
              <Tooltip title="Double-click to rename">
                <span onDoubleClick={handleDblClickName}
                  className={`text-[13px] truncate ${isSelected ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {object.name}
                </span>
              </Tooltip>
            )}
          </div>

          {/* Keyframe bar */}
          <div className={`flex-1 relative h-8 rounded ${isLocked ? 'bg-gray-200' : 'bg-gray-100'} border ${isSelected ? 'border-[#1976d2]' : 'border-gray-300'}`}
            role="group" aria-label={`Keyframes for ${object.name}`}>
            {objectKeyframes.map((kf, idx) => {
              const sel = isKfSelected(idx);
              const atScrub = Math.abs(currentTime - kf.time) < 0.05;
              const hasEasing = kf.easing && kf.easing !== 'linear';
              const hasZSwap = kf.zSwapPoint !== undefined && kf.zSwapPoint !== 0.5;
              let bg = 'bg-[#1976d2]';
              if (sel) bg = 'bg-[#ff9800]';
              else if (atScrub) bg = 'bg-[#4caf50]';
              else if (hasEasing) bg = 'bg-[#9c27b0]';

              return (
                <Tooltip key={idx} title={`${kf.time.toFixed(2)}s${hasEasing ? ` (${kf.easing})` : ''}${hasZSwap ? ` • z-swap ${(kf.zSwapPoint * 100).toFixed(0)}%` : ''}`} placement="top">
                  <button
                    onClick={(e) => handleKfClick(idx, e)}
                    onContextMenu={(e) => handleKfContext(idx, e)}
                    aria-label={`Keyframe at ${kf.time.toFixed(2)}s`}
                    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 transition-all
                      ${sel ? 'w-3.5 h-3.5 border-2 border-orange-800 rounded-sm shadow-[0_0_0_3px_rgba(255,152,0,0.4)]' : 'w-3 h-3 border-2 border-white rounded-[2px]'}
                      ${hasZSwap && !sel ? 'border-orange-400' : ''} ${bg}
                      ${atScrub && !sel ? 'shadow-[0_0_0_2px_rgba(76,175,80,0.4)]' : ''}
                      ${isLocked ? 'pointer-events-none' : 'cursor-pointer hover:w-4 hover:h-4 hover:brightness-110'}
                      ${sel ? 'z-10' : atScrub ? 'z-[5]' : 'z-[1]'}`}
                    style={{ left: `${(kf.time / duration) * 100}%` }}
                  />
                </Tooltip>
              );
            })}
          </div>

          <span className="min-w-[55px] text-right text-[12px] font-medium text-gray-500">
            {objectKeyframes.length} kf
          </span>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div className="fixed z-[9999] bg-white rounded-lg shadow-2xl border border-gray-300 py-1.5 min-w-[220px] max-h-[420px] overflow-y-auto"
          style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()} role="menu">
          <div className="px-4 py-1.5 text-[12px] font-medium text-gray-400 border-b border-gray-200 mb-1">
            Keyframe at {objectKeyframes[contextMenu.kfIndex]?.time.toFixed(2)}s
          </div>
          <button onClick={handleDeleteKf} className="flex items-center gap-2.5 w-full px-4 py-2 text-[14px] text-left text-red-600 hover:bg-red-50" role="menuitem">
            <TrashIcon className="w-[18px] h-[18px]" /> Delete Keyframe
          </button>
          <div className="border-t border-gray-200 my-1" />
          <div className="px-4 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Easing</div>
          {EASING_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => handleEasing(opt.value)} role="menuitem"
              className={`w-full px-4 py-2 text-[14px] text-left hover:bg-gray-50 ${objectKeyframes[contextMenu.kfIndex]?.easing === opt.value ? 'bg-blue-50 text-[#1976d2] font-semibold' : 'text-gray-800'}`}>
              {opt.label}
            </button>
          ))}
          {contextMenu.kfIndex > 0 && (
            <>
              <div className="border-t border-gray-200 my-1" />
              <div className="px-4 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Z-Order Swap Point</div>
              {Z_SWAP_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => handleZSwap(opt.value)} role="menuitem"
                  className={`w-full px-4 py-2 text-[14px] text-left hover:bg-gray-50 ${Math.abs(ctxKfSwap - opt.value) < 0.01 ? 'bg-blue-50 text-[#1976d2] font-semibold' : 'text-gray-800'}`}>
                  {opt.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
};

export default TimelineTrack;