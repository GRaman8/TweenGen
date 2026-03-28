import React, { useRef, useCallback, useEffect } from 'react';
import { 
  Box, IconButton, Typography, Button, Checkbox,
  FormControlLabel, TextField, Tooltip, Snackbar, Alert,
} from '@mui/material';
import { 
  PlayArrow, Pause, Stop, SkipNext, SkipPrevious, Replay,
} from '@mui/icons-material';
import { 
  useIsPlaying, useCurrentTime, useDuration,
  useSelectedObject, useFabricCanvas, useKeyframes,
  useLoopPlayback, useCanvasObjects, useLockedTracks,
  useSelectedKeyframe,
} from '../../store/hooks';
import { useAudioFile, useAudioVolume, useAudioMuted, useAudioRegion } from '../../store/audioHooks';
import { extractPropertiesFromFabricObject, findFabricObjectById } from '../../utils/fabricHelpers';

/**
 * Convert a Fabric.js path array back to an SVG path string.
 * Used to capture the current deformed path for keyframe storage.
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

  // Audio state
  const [audioFile] = useAudioFile();
  const [audioVolume] = useAudioVolume();
  const [audioMuted] = useAudioMuted();
  const [audioRegion] = useAudioRegion();

  const animationFrameRef = useRef(null);
  const playbackStartTimeRef = useRef(null);
  const audioRef = useRef(null);
  const [snackMessage, setSnackMessage] = React.useState('');
  const [snackSeverity, setSnackSeverity] = React.useState('warning');
  
  const loopPlaybackRef = useRef(loopPlayback);
  const durationRef = useRef(duration);
  
  useEffect(() => { loopPlaybackRef.current = loopPlayback; }, [loopPlayback]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  // ==================== AUDIO ELEMENT LIFECYCLE ====================
  useEffect(() => {
    if (audioFile?.dataURL) {
      const audio = new Audio(audioFile.dataURL);
      audio.preload = 'auto';
      audio.loop = false;
      audioRef.current = audio;
      return () => {
        audio.pause();
        audio.src = '';
        audioRef.current = null;
      };
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      audioRef.current = null;
    }
  }, [audioFile?.dataURL]);

  // Sync volume and mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioMuted ? 0 : audioVolume;
    }
  }, [audioVolume, audioMuted]);

  /**
   * Map animation time (0 → duration) to audio time (region.start → region.end).
   */
  const animTimeToAudioTime = useCallback((animTime) => {
    const audioDur = audioFile?.duration || 0;
    if (!audioRegion) {
      return Math.min(animTime, audioDur);
    }
    const regionDur = audioRegion.end - audioRegion.start;
    if (regionDur <= 0 || duration <= 0) return audioRegion.start;
    const ratio = animTime / duration;
    return audioRegion.start + ratio * regionDur;
  }, [audioFile?.duration, audioRegion, duration]);

  // Sync audio position when scrubbing (not playing)
  useEffect(() => {
    if (!isPlaying && audioRef.current && audioRef.current.readyState >= 1) {
      const targetTime = animTimeToAudioTime(currentTime);
      audioRef.current.currentTime = Math.min(
        targetTime,
        audioRef.current.duration || Infinity
      );
    }
  }, [currentTime, isPlaying, animTimeToAudioTime]);

  // ==================== PLAYBACK ====================
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setSelectedKeyframe(null);
    playbackStartTimeRef.current = Date.now() - (currentTime * 1000);

    // Start audio from the correct region position
    if (audioRef.current) {
      const audioTime = animTimeToAudioTime(currentTime);
      audioRef.current.currentTime = Math.min(
        audioTime,
        audioRef.current.duration || Infinity
      );
      audioRef.current.play().catch(() => {});
    }

    const animate = () => {
      const elapsed = (Date.now() - playbackStartTimeRef.current) / 1000;
      const dur = durationRef.current;

      if (elapsed >= dur) {
        if (loopPlaybackRef.current) {
          setCurrentTime(0);
          playbackStartTimeRef.current = Date.now();
          if (audioRef.current) {
            const startTime = animTimeToAudioTime(0);
            audioRef.current.currentTime = Math.min(
              startTime,
              audioRef.current.duration || Infinity
            );
            audioRef.current.play().catch(() => {});
          }
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setCurrentTime(dur);
          setIsPlaying(false);
          if (audioRef.current) audioRef.current.pause();
        }
        return;
      }

      setCurrentTime(elapsed);

      // Audio drift correction
      if (audioRef.current && !audioRef.current.paused) {
        const expectedAudioTime = animTimeToAudioTime(elapsed);
        const drift = Math.abs(audioRef.current.currentTime - expectedAudioTime);
        if (drift > 0.15) {
          audioRef.current.currentTime = Math.min(
            expectedAudioTime,
            audioRef.current.duration || Infinity
          );
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [currentTime, setCurrentTime, setIsPlaying, setSelectedKeyframe, animTimeToAudioTime]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioRef.current) audioRef.current.pause();
  }, [setIsPlaying]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setCurrentTime(0);
    setSelectedKeyframe(null);
    if (audioRef.current) {
      audioRef.current.pause();
      const startTime = animTimeToAudioTime(0);
      audioRef.current.currentTime = Math.min(
        startTime,
        audioRef.current.duration || Infinity
      );
    }
  }, [setCurrentTime, setIsPlaying, setSelectedKeyframe, animTimeToAudioTime]);

  const handleStepPrevious = () => {
    const allKeyframeTimes = [];
    Object.values(keyframes).forEach(objKeyframes => {
      objKeyframes.forEach(kf => {
        if (!allKeyframeTimes.includes(kf.time)) {
          allKeyframeTimes.push(kf.time);
        }
      });
    });
    allKeyframeTimes.sort((a, b) => a - b);
    const previousTimes = allKeyframeTimes.filter(t => t < currentTime - 0.01);
    if (previousTimes.length > 0) {
      setCurrentTime(previousTimes[previousTimes.length - 1]);
    } else {
      setCurrentTime(0);
    }
  };

  const handleStepNext = () => {
    const allKeyframeTimes = [];
    Object.values(keyframes).forEach(objKeyframes => {
      objKeyframes.forEach(kf => {
        if (!allKeyframeTimes.includes(kf.time)) {
          allKeyframeTimes.push(kf.time);
        }
      });
    });
    allKeyframeTimes.sort((a, b) => a - b);
    const nextTimes = allKeyframeTimes.filter(t => t > currentTime + 0.01);
    if (nextTimes.length > 0) {
      setCurrentTime(nextTimes[0]);
    }
  };

  /**
   * Build a keyframe entry for one object at the current time.
   * 
   * For deformed shapes (convertedToPath === true), this also captures
   * the current SVG path string so it can be interpolated between keyframes
   * during playback — enabling triangle-to-cone morphing.
   */
  const buildKeyframeForObject = useCallback((objectId) => {
    if (!fabricCanvas || !objectId) return null;
    if (lockedTracks[objectId]) return null;

    const fabricObject = findFabricObjectById(fabricCanvas, objectId);
    if (!fabricObject) return null;

    const properties = extractPropertiesFromFabricObject(fabricObject);
    if (!properties) return null;

    // Capture pathOffset for freehand paths
    if (fabricObject.type === 'path' && fabricObject.pathOffset) {
      properties.pathOffsetX = fabricObject.pathOffset.x || 0;
      properties.pathOffsetY = fabricObject.pathOffset.y || 0;
    }

    // Capture deformed path string for shape morphing between keyframes.
    // Only applies to shapes that have been through the deformation process
    // (convertedToPath === true in canvasObjects).
    const objData = canvasObjects.find(o => o.id === objectId);
    if (objData?.convertedToPath && fabricObject.type === 'path' && fabricObject.path) {
      properties.deformedPath = fabricPathToSVGPathString(fabricObject.path);
    }

    return {
      objectId,
      keyframe: {
        time: currentTime,
        properties,
        easing: 'linear',
      },
    };
  }, [fabricCanvas, currentTime, lockedTracks, canvasObjects]);

  const batchAddKeyframes = useCallback((entries) => {
    if (entries.length === 0) return;
    setKeyframes(prev => {
      const next = { ...prev };
      entries.forEach(({ objectId, keyframe }) => {
        const objectKeyframes = next[objectId] || [];
        const existingIndex = objectKeyframes.findIndex(
          kf => Math.abs(kf.time - keyframe.time) < 0.05
        );
        if (existingIndex >= 0) {
          const updated = [...objectKeyframes];
          updated[existingIndex] = keyframe;
          next[objectId] = updated;
        } else {
          next[objectId] = [...objectKeyframes, keyframe].sort((a, b) => a.time - b.time);
        }
      });
      return next;
    });
  }, [setKeyframes]);

  const handleAddKeyframe = () => {
    if (!fabricCanvas) return;

    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length > 1) {
      const entries = [];
      let lockedCount = 0;
      activeObjects.forEach(fo => {
        if (fo?.id) {
          if (lockedTracks[fo.id]) {
            lockedCount++;
          } else {
            const entry = buildKeyframeForObject(fo.id);
            if (entry) entries.push(entry);
          }
        }
      });
      if (entries.length > 0) {
        batchAddKeyframes(entries);
        setSnackSeverity('success');
        setSnackMessage(
          `Added keyframes for ${entries.length} object${entries.length > 1 ? 's' : ''} at ${currentTime.toFixed(2)}s` +
          (lockedCount > 0 ? ` (${lockedCount} locked, skipped)` : '')
        );
      } else if (lockedCount > 0) {
        setSnackSeverity('warning');
        setSnackMessage('All selected tracks are locked. Unlock them to add keyframes.');
      }
      return;
    }

    if (!selectedObject) return;
    if (lockedTracks[selectedObject]) {
      setSnackSeverity('warning');
      setSnackMessage('This track is locked. Unlock it to add keyframes.');
      return;
    }

    const entry = buildKeyframeForObject(selectedObject);
    if (entry) {
      batchAddKeyframes([entry]);
      setSnackSeverity('success');
      setSnackMessage(`Keyframe added at ${currentTime.toFixed(2)}s`);
    }
  };

  const handleKeyframeAll = () => {
    if (!fabricCanvas) return;
    const entries = [];
    let lockedCount = 0;
    canvasObjects.forEach(obj => {
      if (lockedTracks[obj.id]) {
        lockedCount++;
      } else {
        const entry = buildKeyframeForObject(obj.id);
        if (entry) entries.push(entry);
      }
    });
    if (entries.length > 0) {
      batchAddKeyframes(entries);
      setSnackSeverity('success');
      setSnackMessage(
        `Keyframed all: ${entries.length} object${entries.length > 1 ? 's' : ''} at ${currentTime.toFixed(2)}s` +
        (lockedCount > 0 ? ` (${lockedCount} locked, skipped)` : '')
      );
    } else if (lockedCount > 0) {
      setSnackSeverity('warning');
      setSnackMessage('All tracks are locked.');
    } else {
      setSnackSeverity('warning');
      setSnackMessage('No objects on canvas to keyframe.');
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const isObjectLocked = selectedObject && !!lockedTracks[selectedObject];
  const activeObjectCount = fabricCanvas?.getActiveObjects()?.length || 0;
  const isMultiSelect = activeObjectCount > 1;
  const hasAnyObjects = canvasObjects.length > 0;
  const canAddKeyframe = isMultiSelect || selectedObject;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Tooltip title="Previous Keyframe">
          <IconButton onClick={handleStepPrevious} size="small">
            <SkipPrevious />
          </IconButton>
        </Tooltip>
        <IconButton onClick={handlePlay} disabled={isPlaying} color="primary">
          <PlayArrow />
        </IconButton>
        <IconButton onClick={handlePause} disabled={!isPlaying}>
          <Pause />
        </IconButton>
        <IconButton onClick={handleStop}>
          <Stop />
        </IconButton>
        <Tooltip title="Next Keyframe">
          <IconButton onClick={handleStepNext} size="small">
            <SkipNext />
          </IconButton>
        </Tooltip>
        
        <Typography variant="body2" sx={{ ml: 1, minWidth: 110, fontSize: '0.8rem' }}>
          {currentTime.toFixed(2)}s / {duration.toFixed(1)}s
        </Typography>

        <Tooltip title="Loop animation continuously. Can toggle during playback.">
          <FormControlLabel
            control={
              <Checkbox
                checked={loopPlayback}
                onChange={(e) => setLoopPlayback(e.target.checked)}
                icon={<Replay />}
                checkedIcon={<Replay color="primary" />}
                size="small"
              />
            }
            label="Loop"
            sx={{ ml: 1 }}
          />
        </Tooltip>

        <TextField
          label="Duration (s)"
          type="number"
          value={duration}
          onChange={(e) => setDuration(Math.max(1, parseFloat(e.target.value) || 10))}
          size="small"
          sx={{ width: 100, ml: 'auto' }}
          inputProps={{ step: 0.5, min: 1 }}
        />
        
        <Tooltip title={
          isMultiSelect
            ? `Add keyframe for all ${activeObjectCount} selected objects at current time`
            : isObjectLocked
              ? "Track is locked — unlock to add keyframes"
              : "Add keyframe at current time (select multiple objects to keyframe them all)"
        }>
          <span>
            <Button
              variant="contained"
              size="small"
              onClick={handleAddKeyframe}
              disabled={!canAddKeyframe || (!!isObjectLocked && !isMultiSelect)}
              color={isMultiSelect ? "secondary" : isObjectLocked ? "inherit" : "primary"}
            >
              {isMultiSelect ? `Add Keyframe (${activeObjectCount})` : 'Add Keyframe'}
            </Button>
          </span>
        </Tooltip>

        <Tooltip title="Add keyframe for EVERY object on canvas at current time — ideal for character animation">
          <span>
            <Button
              variant="outlined"
              size="small"
              onClick={handleKeyframeAll}
              disabled={!hasAnyObjects}
              color="primary"
            >
              ⏺ Keyframe All
            </Button>
          </span>
        </Tooltip>
      </Box>

      <Snackbar
        open={!!snackMessage}
        autoHideDuration={3000}
        onClose={() => setSnackMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackSeverity} onClose={() => setSnackMessage('')}>
          {snackMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PlaybackControls;