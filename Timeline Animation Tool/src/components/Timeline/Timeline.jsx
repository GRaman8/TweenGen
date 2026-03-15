import React, { useEffect, useCallback, useState } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ArrowPathIcon, EllipsisVerticalIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import Tooltip from '../ui/Tooltip';
import { useCanvasObjects, useKeyframes, useTrackOrder, useFabricCanvas, useHiddenTracks, useSelectedObject } from '../../store/hooks';
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

  useEffect(() => {
    setTrackOrder(prev => {
      const ids = new Set(canvasObjects.map(o => o.id));
      const filtered = prev.filter(id => ids.has(id)); const inOrder = new Set(filtered);
      const newIds = canvasObjects.filter(o => !inOrder.has(o.id)).map(o => o.id);
      if (newIds.length === 0 && filtered.length === prev.length) return prev;
      return [...newIds, ...filtered];
    });
  }, [canvasObjects, setTrackOrder]);

  useEffect(() => {
    const ids = new Set(canvasObjects.map(o => o.id));
    setHiddenTracks(prev => { if (!Object.keys(prev).some(id => !ids.has(id))) return prev; const n = {}; Object.keys(prev).forEach(id => { if (ids.has(id)) n[id] = true; }); return n; });
  }, [canvasObjects, setHiddenTracks]);

  useEffect(() => { if (selectedObject && hiddenTracks[selectedObject]) setHiddenTracks(prev => { const n = { ...prev }; delete n[selectedObject]; return n; }); }, [selectedObject, hiddenTracks, setHiddenTracks]);

  const orderedObjects = React.useMemo(() => {
    if (trackOrder.length === 0) return canvasObjects;
    const map = {}; canvasObjects.forEach(o => { map[o.id] = o; });
    const ordered = trackOrder.map(id => map[id]).filter(Boolean);
    const inOrder = new Set(trackOrder); canvasObjects.forEach(o => { if (!inOrder.has(o.id)) ordered.push(o); });
    return ordered;
  }, [canvasObjects, trackOrder]);

  const visible = orderedObjects.filter(o => !hiddenTracks[o.id]);
  const hidden = orderedObjects.filter(o => hiddenTracks[o.id]);

  const handleDragStart = useCallback((id) => setDraggedId(id), []);
  const handleDragOver = useCallback((e, id) => { e.preventDefault(); if (!draggedId || draggedId === id) { setDragOverId(null); return; } setDragOverId(id); setDragOverPosition(e.clientY < e.currentTarget.getBoundingClientRect().top + e.currentTarget.getBoundingClientRect().height / 2 ? 'above' : 'below'); }, [draggedId]);
  const handleDrop = useCallback((e, targetId) => { e.preventDefault(); if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; } setTrackOrder(prev => { const order = [...prev]; const from = order.indexOf(draggedId); if (from < 0) return prev; order.splice(from, 1); let to = order.indexOf(targetId); if (to < 0) return prev; if (dragOverPosition === 'below') to += 1; order.splice(to, 0, draggedId); return order; }); if (fabricCanvas) setTimeout(() => syncCanvasZ(), 0); setDraggedId(null); setDragOverId(null); }, [draggedId, dragOverPosition, fabricCanvas, setTrackOrder]);
  const handleDragEnd = useCallback(() => { setDraggedId(null); setDragOverId(null); setDragOverPosition(null); }, []);

  const syncCanvasZ = useCallback(() => { if (!fabricCanvas) return; [...trackOrder].reverse().forEach(id => { const o = fabricCanvas.getObjects().find(o => o.id === id); if (o) try { fabricCanvas.bringObjectToFront?.(o); } catch(e) {} }); fabricCanvas.renderAll(); }, [fabricCanvas, trackOrder]);
  const syncFromCanvas = useCallback(() => { if (!fabricCanvas) return; setTrackOrder([...fabricCanvas.getObjects()].filter(o => o.id).reverse().map(o => o.id)); }, [fabricCanvas, setTrackOrder]);

  const typeIcons = { rectangle: '▬', circle: '●', roundedRect: '▢', ellipse: '⬮', triangle: '△', diamond: '◇', pentagon: '⬠', hexagon: '⬡', star: '★', arrow: '➤', heart: '♥', cross: '✚', text: 'T', path: '✎', group: '⊞', image: '🖼' };

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-300 p-4" aria-label="Timeline">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-[16px] font-semibold text-gray-900">Timeline</h2>
        <Tooltip title="Sync track order from canvas">
          <button onClick={syncFromCanvas} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" aria-label="Sync track order">
            <ArrowPathIcon className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>

        {hidden.length > 0 && (
          <Menu as="div" className="relative ml-auto">
            <Tooltip title={`${hidden.length} hidden track${hidden.length !== 1 ? 's' : ''}`}>
              <MenuButton className="relative p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" aria-label="Manage hidden tracks">
                <EllipsisVerticalIcon className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold text-white bg-[#1976d2] rounded-full">
                  {hidden.length}
                </span>
              </MenuButton>
            </Tooltip>
            <MenuItems className="absolute right-0 mt-1.5 w-64 bg-white rounded-lg shadow-2xl border border-gray-300 py-1.5 z-50 max-h-[400px] overflow-y-auto">
              <div className="px-4 py-2 text-[12px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">Hidden Tracks ({hidden.length})</div>
              {hidden.map(obj => (
                <MenuItem key={obj.id}>
                  <button onClick={() => setHiddenTracks(prev => { const n = { ...prev }; delete n[obj.id]; return n; })}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[14px] hover:bg-gray-50 text-gray-800">
                    <EyeSlashIcon className="w-[18px] h-[18px] text-gray-400 shrink-0" />
                    <span className="text-[12px] opacity-50">{typeIcons[obj.type] || '•'}</span>
                    <span className="flex-1 text-left truncate">{obj.name}</span>
                    <span className="text-[12px] text-gray-400">{(keyframes[obj.id] || []).length} kf</span>
                  </button>
                </MenuItem>
              ))}
              {hidden.length > 1 && (<>
                <div className="border-t border-gray-200 my-1" />
                <MenuItem>
                  <button onClick={() => setHiddenTracks({})} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[14px] font-semibold text-[#1976d2] hover:bg-blue-50">
                    <EyeIcon className="w-[18px] h-[18px]" /> Show All Tracks
                  </button>
                </MenuItem>
              </>)}
            </MenuItems>
          </Menu>
        )}
      </div>
      
      <PlaybackControls />
      <TimelineScrubber />
      
      <div className="max-h-[300px] overflow-y-auto" role="table" aria-label="Track list">
        {visible.length === 0 && hidden.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-[14px]">Add elements to the stage to see timeline tracks</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-[14px]">All tracks are hidden.</p>
            <p className="text-[13px] text-gray-400 mt-1">Click the ⋮ button above to show them.</p>
          </div>
        ) : visible.map((obj, i) => (
          <TimelineTrack key={obj.id} object={obj} keyframes={keyframes[obj.id] || []}
            isDragged={draggedId === obj.id} isDragOver={dragOverId === obj.id} dragOverPosition={dragOverPosition}
            onDragStart={() => handleDragStart(obj.id)} onDragOver={(e) => handleDragOver(e, obj.id)}
            onDrop={(e) => handleDrop(e, obj.id)} onDragEnd={handleDragEnd} trackIndex={i} />
        ))}
      </div>
    </section>
  );
};

export default Timeline;