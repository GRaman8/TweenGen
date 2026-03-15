import { selector } from 'recoil';
import { canvasObjectsState, keyframesState, selectedObjectState, currentTimeState } from './atoms';

export const selectedObjectDetailsSelector = selector({
  key: 'selectedObjectDetailsSelector',
  get: ({ get }) => {
    const selectedId = get(selectedObjectState);
    const objects = get(canvasObjectsState);
    if (!selectedId) return null;
    return objects.find(obj => obj.id === selectedId) || null;
  },
});

export const selectedObjectKeyframesSelector = selector({
  key: 'selectedObjectKeyframesSelector',
  get: ({ get }) => {
    const selectedId = get(selectedObjectState);
    const keyframes = get(keyframesState);
    if (!selectedId) return [];
    return keyframes[selectedId] || [];
  },
});

export const totalKeyframesSelector = selector({
  key: 'totalKeyframesSelector',
  get: ({ get }) => {
    const keyframes = get(keyframesState);
    return Object.values(keyframes).reduce((sum, kfs) => sum + kfs.length, 0);
  },
});

export const keyframeExistsAtCurrentTimeSelector = selector({
  key: 'keyframeExistsAtCurrentTimeSelector',
  get: ({ get }) => {
    const selectedId = get(selectedObjectState);
    const keyframes = get(keyframesState);
    const currentTime = get(currentTimeState);
    if (!selectedId) return false;
    const objectKeyframes = keyframes[selectedId] || [];
    return objectKeyframes.some(kf => Math.abs(kf.time - currentTime) < 0.05);
  },
});