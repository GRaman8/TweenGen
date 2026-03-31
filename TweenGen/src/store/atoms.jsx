import { atom } from 'recoil';

// Canvas objects state - NOW SUPPORTS GROUPS
export const canvasObjectsState = atom({
  key: 'canvasObjectsState',
  default: [],
  // Structure: [{ 
  //   id, 
  //   type, // 'rectangle', 'circle', 'text', 'path', 'group'
  //   name, 
  //   children: [], // Only for groups - array of child object IDs
  //   anchorX: 0.5, // 0-1, where 0.5 is center
  //   anchorY: 0.5, // 0-1, where 0.5 is center
  //   fill: '#color', // Fill color for shapes and paths
  //   fillColor: '', // Fill color for closed path strokes
  // }]
});

// Keyframes state
export const keyframesState = atom({
  key: 'keyframesState',
  default: {},
  // Structure: { [objectId]: [{ 
  //   time, 
  //   properties: {
  //     x, y, scaleX, scaleY, rotation, opacity,
  //     anchorX, anchorY // NEW - anchor point can be animated
  //   }
  // }] }
});

// Selected object state
export const selectedObjectState = atom({
  key: 'selectedObjectState',
  default: null,
});

// Timeline state
export const currentTimeState = atom({
  key: 'currentTimeState',
  default: 0,
});

export const durationState = atom({
  key: 'durationState',
  default: 10,
});

export const isPlayingState = atom({
  key: 'isPlayingState',
  default: false,
});

// Canvas reference
export const fabricCanvasState = atom({
  key: 'fabricCanvasState',
  default: null,
  dangerouslyAllowMutability: true,
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

// Easing function state for keyframes
export const keyframeEasingState = atom({
  key: 'keyframeEasingState',
  default: {},
});

// Loop playback state
export const loopPlaybackState = atom({
  key: 'loopPlaybackState',
  default: false,
});

// Timeline zoom level
export const timelineZoomState = atom({
  key: 'timelineZoomState',
  default: 1,
});

// Selected keyframe for editing — stores {objectId, index} or null
export const selectedKeyframeState = atom({
  key: 'selectedKeyframeState',
  default: null,
  // Structure: { objectId: string, index: number } | null
});

// Snap to keyframes setting
export const snapToKeyframesState = atom({
  key: 'snapToKeyframesState',
  default: false,
});

// Track if any objects are selected
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

// Anchor point editing mode
export const anchorEditModeState = atom({
  key: 'anchorEditModeState',
  default: false,
});

// ===== NEW ATOMS =====

// Locked/disabled tracks — plain object { [objectId]: true }
// IMPORTANT: Must be a plain serializable object, NOT a Set.
// Recoil's change detection relies on immutable value comparison.
// Set mutations bypass this and cause silent reactivity failures.
export const lockedTracksState = atom({
  key: 'lockedTracksState',
  default: {},
});

// Explicit track order — array of object IDs defining display order
// First = front (highest z-index), last = back (lowest z-index)
export const trackOrderState = atom({
  key: 'trackOrderState',
  default: [],
});

// Canvas background color
export const canvasBgColorState = atom({
  key: 'canvasBgColorState',
  default: '#f0f0f0',
});

// Canvas background image (data URL or null)
export const canvasBgImageState = atom({
  key: 'canvasBgImageState',
  default: null,
  // Shape: { dataURL: string, width: number, height: number, fileName: string } | null
});

// Paint bucket tool active
export const fillToolActiveState = atom({
  key: 'fillToolActiveState',
  default: false,
});

// Paint bucket fill color
export const fillToolColorState = atom({
  key: 'fillToolColorState',
  default: '#ff0000',
});

// Hidden tracks — plain object { [objectId]: true }
// Tracks marked as hidden are collapsed into a dropdown menu in the timeline.
// The selected track is always auto-shown regardless of this state.
export const hiddenTracksState = atom({
  key: 'hiddenTracksState',
  default: {},
});