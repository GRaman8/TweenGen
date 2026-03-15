import { atom } from 'recoil';

// Canvas objects state
export const canvasObjectsState = atom({
  key: 'canvasObjectsState',
  default: [],
  // Structure: [{ id, type, name, fabricObject }]
});

// Keyframes state
export const keyframesState = atom({
  key: 'keyframesState',
  default: {},
  // Structure: { [objectId]: [{ time, properties }] }
});

// Selected object state
export const selectedObjectState = atom({
  key: 'selectedObjectState',
  default: null, // object id});
});

// Timeline state
export const currentTimeState = atom({
  key: 'currentTimeState',
  default: 0, // in seconds
});

export const durationState = atom({
  key: 'durationState',
  default: 5, // in seconds
});

export const isPlayingState = atom({
  key: 'isPlayingState',
  default: false,
});

// Canvas reference (special case - stores fabric canvas instance)
export const fabricCanvasState = atom({
  key: 'fabricCanvasState',
  default: null,
  dangerouslyAllowMutability: true, // Fabric.js objects are mutable
});

// Property values for selected object
export const selectedObjectPropertiesState = atom({
  key: 'selectedObjectPropertiesState',
  default: {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    anchorX: 0.5, 
    anchorY: 0.5,
  },
});

// Phase-3 code:

// Easing function state for keyframes
export const keyframeEasingState = atom({
  key: 'keyframeEasingState',
  default: {},
  // Structure: { [objectId]: { [keyframeIndex]: 'easingType' } }
});

// Loop playback state
export const loopPlaybackState = atom({
  key: 'loopPlaybackState',
  default: false,
});

// Timeline zoom level
export const timelineZoomState = atom({
  key: 'timelineZoomState',
  default: 1, // 1 = normal, 2 = 2x zoom, 0.5 = 0.5x zoom
});

// Selected keyframe for editing
export const selectedKeyframeState = atom({
  key: 'selectedKeyframeState',
  default: null,
  // Structure: { objectId: string, keyframeIndex: number }
});

// Snap to keyframes setting
export const snapToKeyframesState = atom({
  key: 'snapToKeyframesState',
  default: false,
});

// Track if any objects are selected (for toolbar button states)
export const hasActiveSelectionState = atom({
  key: 'hasActiveSelectionState',
  default: false,
});

// Drawing mode state
export const drawingModeState = atom({
  key: 'drawingModeState',
  default: false,
});

// Current drawing path
export const currentDrawingPathState = atom({
  key: 'currentDrawingPathState',
  default: null,
  dangerouslyAllowMutability: true,
});

// Drawing tool settings
export const drawingToolSettingsState = atom({
  key: 'drawingToolSettingsState',
  default: {
    color: '#000000',
    strokeWidth: 3,
    smoothing: true,
  },
});

export const anchorEditModeState = atom({
  key: 'anchorEditModeState',
  default: false,
});
 
export const lockedTracksState = atom({
  key: 'lockedTracksState',
  default: {},
});
 
export const trackOrderState = atom({
  key: 'trackOrderState',
  default: [],
});
 
export const canvasBgColorState = atom({
  key: 'canvasBgColorState',
  default: '#f0f0f0',
});
 
export const fillToolActiveState = atom({
  key: 'fillToolActiveState',
  default: false,
});
 
export const fillToolColorState = atom({
  key: 'fillToolColorState',
  default: '#ff0000',
});
 
export const hiddenTracksState = atom({
  key: 'hiddenTracksState',
  default: {},
});