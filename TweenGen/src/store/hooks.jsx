import { useRecoilState, useRecoilValue } from 'recoil';

import {
  canvasObjectsState,
  keyframesState,
  selectedObjectState,
  currentTimeState,
  durationState,
  isPlayingState,
  fabricCanvasState,
  selectedObjectPropertiesState,
  keyframeEasingState,
  loopPlaybackState,
  timelineZoomState,
  selectedKeyframeState,
  snapToKeyframesState,
  hasActiveSelectionState,
  drawingModeState,
  currentDrawingPathState,
  drawingToolSettingsState,
  anchorEditModeState,
  lockedTracksState,
  trackOrderState,
  canvasBgColorState,
  canvasBgImageState,
  fillToolActiveState,
  fillToolColorState,
  hiddenTracksState,
} from './atoms';

import {
  selectedObjectDetailsSelector,
  selectedObjectKeyframesSelector,
} from './selectors';

// Custom hooks for easier state access
export const useCanvasObjects = () => {
  return useRecoilState(canvasObjectsState);
};

export const useKeyframes = () => {
  return useRecoilState(keyframesState);
};

export const useSelectedObject = () => {
  return useRecoilState(selectedObjectState);
};

export const useCurrentTime = () => {
  return useRecoilState(currentTimeState);
};

export const useDuration = () => {
  return useRecoilState(durationState);
};

export const useIsPlaying = () => {
  return useRecoilState(isPlayingState);
};

export const useFabricCanvas = () => {
  return useRecoilState(fabricCanvasState);
};

export const useSelectedObjectProperties = () => {
  return useRecoilState(selectedObjectPropertiesState);
};

// Read-only hooks
export const useSelectedObjectDetails = () => {
  return useRecoilValue(selectedObjectDetailsSelector);
};

export const useSelectedObjectKeyframes = () => {
  return useRecoilValue(selectedObjectKeyframesSelector);
};

export const useKeyframeEasing = () => {
  return useRecoilState(keyframeEasingState);
};

export const useLoopPlayback = () => {
  return useRecoilState(loopPlaybackState);
};

export const useTimelineZoom = () => {
  return useRecoilState(timelineZoomState);
};

export const useSelectedKeyframe = () => {
  return useRecoilState(selectedKeyframeState);
};

export const useSnapToKeyframes = () => {
  return useRecoilState(snapToKeyframesState);
};

export const useHasActiveSelection = () => {
  return useRecoilState(hasActiveSelectionState);
};

export const useDrawingMode = () => {
  return useRecoilState(drawingModeState);
};

export const useCurrentDrawingPath = () => {
  return useRecoilState(currentDrawingPathState);
};

export const useDrawingToolSettings = () => {
  return useRecoilState(drawingToolSettingsState);
};

export const useAnchorEditMode = () => {
  return useRecoilState(anchorEditModeState);
};

// ===== NEW HOOKS =====

export const useLockedTracks = () => {
  return useRecoilState(lockedTracksState);
};

export const useTrackOrder = () => {
  return useRecoilState(trackOrderState);
};

export const useCanvasBgColor = () => {
  return useRecoilState(canvasBgColorState);
};

export const useCanvasBgImage = () => {
  return useRecoilState(canvasBgImageState);
};

export const useFillToolActive = () => {
  return useRecoilState(fillToolActiveState);
};

export const useFillToolColor = () => {
  return useRecoilState(fillToolColorState);
};

export const useHiddenTracks = () => {
  return useRecoilState(hiddenTracksState);
};