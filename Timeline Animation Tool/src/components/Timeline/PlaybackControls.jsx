import React, { useRef, useCallback, useEffect } from 'react';
import { 
  PlayIcon, PauseIcon, StopIcon, ForwardIcon, BackwardIcon, ArrowPathIcon,
} from '@heroicons/react/24/solid';
import Tooltip from '../ui/Tooltip';
import Toast from '../ui/Toast';
import { 
  useIsPlaying, useCurrentTime, useDuration, useSelectedObject,
  useFabricCanvas, useKeyframes, useLoopPlayback, useCanvasObjects,
  useLockedTracks, useSelectedKeyframe,
} from '../../store/hooks';
import { extractPropertiesFromFabricObject, findFabricObjectById } from '../../utils/fabricHelpers';

const PlaybackControls = () => {
  const [isPlaying, setIsPlaying] = useIsPlaying();
  const [currentTime, setCurrentTime] = useCurrentTime();
  const [duration, setDuration] = useDuration();
  const [selectedObject] = useSelectedObject();
  const [fabricCanvas] = useFabricCanvas();
  const [keyframes, setKeyframes] = useKeyframes();
  const [loopPlayback, setLoopPlayback] = useLoopPlayback();
  const [canvasObjects] = useCanvasObjects();
  const [lockedTracks] = useLockedTracks();
  const [, setSelectedKeyframe] = useSelectedKeyframe();
  const animationFrameRef = useRef(null);
  const playbackStartTimeRef = useRef(null);
  const [snackMessage, setSnackMessage] = React.useState('');
  const [snackSeverity, setSnackSeverity] = React.useState('warning');
  const loopPlaybackRef = useRef(loopPlayback);
  const durationRef = useRef(duration);
  useEffect(() => { loopPlaybackRef.current = loopPlayback; }, [loopPlayback]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true); setSelectedKeyframe(null);
    playbackStartTimeRef.current = Date.now() - (currentTime * 1000);
    const animate = () => {
      const elapsed = (Date.now() - playbackStartTimeRef.current) / 1000;
      if (elapsed >= durationRef.current) {
        if (loopPlaybackRef.current) { setCurrentTime(0); playbackStartTimeRef.current = Date.now(); animationFrameRef.current = requestAnimationFrame(animate); }
        else { setCurrentTime(durationRef.current); setIsPlaying(false); } return;
      }
      setCurrentTime(elapsed); animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [currentTime, setCurrentTime, setIsPlaying, setSelectedKeyframe]);

  const handlePause = useCallback(() => { setIsPlaying(false); if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); }, [setIsPlaying]);
  const handleStop = useCallback(() => { setIsPlaying(false); if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); setCurrentTime(0); setSelectedKeyframe(null); }, [setCurrentTime, setIsPlaying, setSelectedKeyframe]);

  const handleStepPrevious = () => {
    const times = []; Object.values(keyframes).forEach(kfs => kfs.forEach(kf => { if (!times.includes(kf.time)) times.push(kf.time); }));
    times.sort((a, b) => a - b); const prev = times.filter(t => t < currentTime - 0.01);
    setCurrentTime(prev.length > 0 ? prev[prev.length - 1] : 0);
  };
  const handleStepNext = () => {
    const times = []; Object.values(keyframes).forEach(kfs => kfs.forEach(kf => { if (!times.includes(kf.time)) times.push(kf.time); }));
    times.sort((a, b) => a - b); const next = times.filter(t => t > currentTime + 0.01);
    if (next.length > 0) setCurrentTime(next[0]);
  };

  const buildKeyframeForObject = useCallback((objectId) => {
    if (!fabricCanvas || !objectId || lockedTracks[objectId]) return null;
    const fo = findFabricObjectById(fabricCanvas, objectId); if (!fo) return null;
    const properties = extractPropertiesFromFabricObject(fo); if (!properties) return null;
    if (fo.type === 'path' && fo.pathOffset) { properties.pathOffsetX = fo.pathOffset.x || 0; properties.pathOffsetY = fo.pathOffset.y || 0; }
    return { objectId, keyframe: { time: currentTime, properties, easing: 'linear' } };
  }, [fabricCanvas, currentTime, lockedTracks]);

  const batchAddKeyframes = useCallback((entries) => {
    if (entries.length === 0) return;
    setKeyframes(prev => {
      const next = { ...prev };
      entries.forEach(({ objectId, keyframe }) => {
        const kfs = next[objectId] || [];
        const idx = kfs.findIndex(kf => Math.abs(kf.time - keyframe.time) < 0.05);
        if (idx >= 0) { const u = [...kfs]; u[idx] = keyframe; next[objectId] = u; }
        else next[objectId] = [...kfs, keyframe].sort((a, b) => a.time - b.time);
      });
      return next;
    });
  }, [setKeyframes]);

  const handleAddKeyframe = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length > 1) {
      const entries = []; let locked = 0;
      activeObjects.forEach(fo => { if (fo?.id) { if (lockedTracks[fo.id]) locked++; else { const e = buildKeyframeForObject(fo.id); if (e) entries.push(e); } } });
      if (entries.length > 0) { batchAddKeyframes(entries); setSnackSeverity('success'); setSnackMessage(`Added keyframes for ${entries.length} object${entries.length > 1 ? 's' : ''} at ${currentTime.toFixed(2)}s`); }
      else if (locked > 0) { setSnackSeverity('warning'); setSnackMessage('All selected tracks are locked.'); } return;
    }
    if (!selectedObject) return;
    if (lockedTracks[selectedObject]) { setSnackSeverity('warning'); setSnackMessage('Track is locked.'); return; }
    const entry = buildKeyframeForObject(selectedObject);
    if (entry) { batchAddKeyframes([entry]); setSnackSeverity('success'); setSnackMessage(`Keyframe added at ${currentTime.toFixed(2)}s`); }
  };

  const handleKeyframeAll = () => {
    if (!fabricCanvas) return; const entries = []; let locked = 0;
    canvasObjects.forEach(obj => { if (lockedTracks[obj.id]) locked++; else { const e = buildKeyframeForObject(obj.id); if (e) entries.push(e); } });
    if (entries.length > 0) { batchAddKeyframes(entries); setSnackSeverity('success'); setSnackMessage(`Keyframed ${entries.length} objects at ${currentTime.toFixed(2)}s`); }
    else if (locked > 0) { setSnackSeverity('warning'); setSnackMessage('All tracks locked.'); }
    else { setSnackSeverity('warning'); setSnackMessage('No objects on canvas.'); }
  };

  useEffect(() => { return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); }; }, []);

  const isObjectLocked = selectedObject && !!lockedTracks[selectedObject];
  const activeCount = fabricCanvas?.getActiveObjects()?.length || 0;
  const isMulti = activeCount > 1;
  const canAdd = isMulti || selectedObject;

  // POUR: 36×36px transport buttons with clear icons
  const TransportBtn = ({ tip, onClick, disabled, primary, children }) => (
    <Tooltip title={tip}>
      <button onClick={onClick} disabled={disabled} aria-label={tip}
        className={`p-2 rounded-lg transition-colors disabled:opacity-35 disabled:cursor-not-allowed
          ${primary ? 'text-[#1976d2] hover:bg-blue-50 active:bg-blue-100' : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'}`}>
        {children}
      </button>
    </Tooltip>
  );

  return (
    <div role="group" aria-label="Playback controls">
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <TransportBtn tip="Previous Keyframe" onClick={handleStepPrevious}><BackwardIcon className="w-5 h-5" /></TransportBtn>
        <TransportBtn tip="Play" onClick={handlePlay} disabled={isPlaying} primary><PlayIcon className="w-6 h-6" /></TransportBtn>
        <TransportBtn tip="Pause" onClick={handlePause} disabled={!isPlaying}><PauseIcon className="w-5 h-5" /></TransportBtn>
        <TransportBtn tip="Stop" onClick={handleStop}><StopIcon className="w-5 h-5" /></TransportBtn>
        <TransportBtn tip="Next Keyframe" onClick={handleStepNext}><ForwardIcon className="w-5 h-5" /></TransportBtn>

        {/* Time display — POUR: readable size */}
        <span className="ml-2 min-w-[120px] text-[13px] font-mono text-gray-800 tabular-nums" aria-live="polite" aria-atomic="true">
          {currentTime.toFixed(2)}s / {duration.toFixed(1)}s
        </span>

        {/* Loop toggle */}
        <Tooltip title="Loop animation continuously">
          <label className="flex items-center gap-1.5 ml-2 cursor-pointer select-none px-2 py-1.5 rounded-lg hover:bg-gray-50">
            <ArrowPathIcon className={`w-5 h-5 transition-colors ${loopPlayback ? 'text-[#1976d2]' : 'text-gray-400'}`} />
            <span className="text-[13px] font-medium text-gray-700">Loop</span>
            <input type="checkbox" checked={loopPlayback} onChange={(e) => setLoopPlayback(e.target.checked)}
              className="sr-only" aria-label="Toggle loop playback" />
          </label>
        </Tooltip>

        {/* Duration input */}
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="duration-input" className="text-[13px] font-medium text-gray-600">Duration</label>
          <input id="duration-input" type="number" value={duration}
            onChange={(e) => setDuration(Math.max(1, parseFloat(e.target.value) || 10))}
            step="0.5" min="1"
            className="w-20 px-2 py-1.5 text-[13px] border border-gray-300 rounded-md focus:ring-2 focus:ring-[#1976d2] focus:border-[#1976d2] outline-none" />
        </div>

        {/* Add Keyframe */}
        <Tooltip title={isMulti ? `Keyframe ${activeCount} selected` : isObjectLocked ? 'Track locked' : 'Add keyframe'}>
          <button onClick={handleAddKeyframe} disabled={!canAdd || (!!isObjectLocked && !isMulti)} aria-label="Add keyframe"
            className={`px-4 py-2 text-[13px] font-semibold rounded-md transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
              ${isMulti ? 'bg-[#9c27b0] text-white hover:bg-[#7b1fa2]' : 'bg-[#1976d2] text-white hover:bg-[#1565c0]'}`}>
            {isMulti ? `Add Keyframe (${activeCount})` : 'Add Keyframe'}
          </button>
        </Tooltip>

        {/* Keyframe All */}
        <Tooltip title="Keyframe ALL objects">
          <button onClick={handleKeyframeAll} disabled={canvasObjects.length === 0} aria-label="Keyframe all objects"
            className="px-4 py-2 text-[13px] font-semibold rounded-md border-2 border-[#1976d2] text-[#1976d2] hover:bg-[#e3f2fd] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            ⏺ Keyframe All
          </button>
        </Tooltip>
      </div>
      <Toast message={snackMessage} severity={snackSeverity} onClose={() => setSnackMessage('')} />
    </div>
  );
};

export default PlaybackControls;