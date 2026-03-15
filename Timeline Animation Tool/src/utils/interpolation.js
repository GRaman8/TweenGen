import { applyEasing } from './easing';

export const lerp = (start, end, t) => {
  return start + (end - start) * t;
};

const normalizeAngle = (prevAngle, nextAngle) => {
  let delta = nextAngle - prevAngle;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return prevAngle + delta;
};

export const findSurroundingKeyframes = (keyframes, time) => {
  if (keyframes.length === 0) return { before: null, after: null };
  let before = null;
  let after = null;
  for (const kf of keyframes) {
    if (kf.time <= time) before = kf;
    if (kf.time >= time && !after) after = kf;
  }
  if (!before && after) before = after;
  if (before && !after) after = before;
  return { before, after };
};

export const findGlobalZSwapPoint = (allKeyframes, time) => {
  let globalSwapPoint = null;
  for (const objId of Object.keys(allKeyframes)) {
    const kfs = allKeyframes[objId];
    if (!kfs || kfs.length < 2) continue;
    const { before, after } = findSurroundingKeyframes(kfs, time);
    if (!before || !after || before === after) continue;
    const beforeZ = before.properties.zIndex ?? 0;
    const afterZ = after.properties.zIndex ?? 0;
    if (beforeZ === afterZ) continue;
    if (after.zSwapPoint !== undefined && after.zSwapPoint !== null) {
      if (globalSwapPoint === null) globalSwapPoint = after.zSwapPoint;
      else globalSwapPoint = Math.min(globalSwapPoint, after.zSwapPoint);
    }
  }
  return globalSwapPoint;
};

export const interpolateProperties = (beforeKf, afterKf, time, easingType = 'linear', globalZSwapPoint = null) => {
  if (!beforeKf || !afterKf) return null;
  if (beforeKf.time === afterKf.time) return beforeKf.properties;

  const rawT = (time - beforeKf.time) / (afterKf.time - beforeKf.time);
  const t = applyEasing(rawT, easingType);

  const normalizedRotation = normalizeAngle(
    beforeKf.properties.rotation, afterKf.properties.rotation
  );

  const beforeZ = beforeKf.properties.zIndex ?? 0;
  const afterZ = afterKf.properties.zIndex ?? 0;
  const swapPoint = globalZSwapPoint ?? afterKf.zSwapPoint ?? 0.5;
  const interpolatedZ = rawT < swapPoint ? beforeZ : afterZ;

  return {
    x: lerp(beforeKf.properties.x, afterKf.properties.x, t),
    y: lerp(beforeKf.properties.y, afterKf.properties.y, t),
    scaleX: lerp(beforeKf.properties.scaleX, afterKf.properties.scaleX, t),
    scaleY: lerp(beforeKf.properties.scaleY, afterKf.properties.scaleY, t),
    rotation: lerp(beforeKf.properties.rotation, normalizedRotation, t),
    opacity: lerp(beforeKf.properties.opacity, afterKf.properties.opacity, t),
    zIndex: interpolatedZ,
  };
};

export const applyPropertiesToFabricObject = (fabricObject, properties) => {
  if (!fabricObject || !properties) return;
  fabricObject.set({
    left: properties.x, top: properties.y,
    scaleX: properties.scaleX, scaleY: properties.scaleY,
    angle: properties.rotation, opacity: properties.opacity,
  });
  if (properties.zIndex !== undefined) fabricObject._targetZIndex = properties.zIndex;
};

export const applyZIndexOrdering = (fabricCanvas) => {
  if (!fabricCanvas) return;
  const objects = fabricCanvas.getObjects();
  const objectsWithZIndex = objects.filter(obj => obj._targetZIndex !== undefined);
  if (objectsWithZIndex.length === 0) return;
  objectsWithZIndex.sort((a, b) => (a._targetZIndex || 0) - (b._targetZIndex || 0));
  objectsWithZIndex.forEach((obj) => {
    try { if (typeof fabricCanvas.bringObjectToFront === 'function') fabricCanvas.bringObjectToFront(obj); } catch (e) {}
  });
};

export const snapToNearestKeyframe = (time, keyframes, threshold = 0.1) => {
  if (keyframes.length === 0) return time;
  let nearest = time;
  let minDistance = threshold;
  for (const kf of keyframes) {
    const distance = Math.abs(kf.time - time);
    if (distance < minDistance) { minDistance = distance; nearest = kf.time; }
  }
  return nearest;
};

export const normalizeKeyframeRotations = (keyframes) => {
  if (!keyframes || keyframes.length < 2) return keyframes;
  const normalized = [keyframes[0]];
  for (let i = 1; i < keyframes.length; i++) {
    const prevRotation = normalized[i - 1].properties.rotation;
    const currRotation = keyframes[i].properties.rotation;
    const normalizedRotation = normalizeAngle(prevRotation, currRotation);
    if (normalizedRotation === currRotation) normalized.push(keyframes[i]);
    else normalized.push({ ...keyframes[i], properties: { ...keyframes[i].properties, rotation: normalizedRotation } });
  }
  return normalized;
};