import { useRecoilState, useRecoilValue } from 'recoil';

import {
  canvasObjectsState, keyframesState, selectedObjectState, currentTimeState,
  durationState, isPlayingState, fabricCanvasState, selectedObjectPropertiesState,
  keyframeEasingState, loopPlaybackState, timelineZoomState, selectedKeyframeState,
  snapToKeyframesState, hasActiveSelectionState, drawingModeState, currentDrawingPathState,
  drawingToolSettingsState, anchorEditModeState, lockedTracksState, trackOrderState,
  canvasBgColorState, fillToolActiveState, fillToolColorState, hiddenTracksState,
} from './atoms';

import {
  selectedObjectDetailsSelector,
  selectedObjectKeyframesSelector,
} from './selectors';

export const useCanvasObjects = () => useRecoilState(canvasObjectsState);
export const useKeyframes = () => useRecoilState(keyframesState);
export const useSelectedObject = () => useRecoilState(selectedObjectState);
export const useCurrentTime = () => useRecoilState(currentTimeState);
export const useDuration = () => useRecoilState(durationState);
export const useIsPlaying = () => useRecoilState(isPlayingState);
export const useFabricCanvas = () => useRecoilState(fabricCanvasState);
export const useSelectedObjectProperties = () => useRecoilState(selectedObjectPropertiesState);
export const useSelectedObjectDetails = () => useRecoilValue(selectedObjectDetailsSelector);
export const useSelectedObjectKeyframes = () => useRecoilValue(selectedObjectKeyframesSelector);
export const useKeyframeEasing = () => useRecoilState(keyframeEasingState);
export const useLoopPlayback = () => useRecoilState(loopPlaybackState);
export const useTimelineZoom = () => useRecoilState(timelineZoomState);
export const useSelectedKeyframe = () => useRecoilState(selectedKeyframeState);
export const useSnapToKeyframes = () => useRecoilState(snapToKeyframesState);
export const useHasActiveSelection = () => useRecoilState(hasActiveSelectionState);
export const useDrawingMode = () => useRecoilState(drawingModeState);
export const useCurrentDrawingPath = () => useRecoilState(currentDrawingPathState);
export const useDrawingToolSettings = () => useRecoilState(drawingToolSettingsState);
export const useAnchorEditMode = () => useRecoilState(anchorEditModeState);
export const useLockedTracks = () => useRecoilState(lockedTracksState);
export const useTrackOrder = () => useRecoilState(trackOrderState);
export const useCanvasBgColor = () => useRecoilState(canvasBgColorState);
export const useFillToolActive = () => useRecoilState(fillToolActiveState);
export const useFillToolColor = () => useRecoilState(fillToolColorState);
export const useHiddenTracks = () => useRecoilState(hiddenTracksState);