import { applyEasing } from './easing';
import { interpolatePathStrings } from './pathUtils';

/**
 * Linear interpolation between two values.
 */
export const lerp = (start, end, t) => {
  return start + (end - start) * t;
};

// ===================================================================
// Color interpolation
// ===================================================================

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
};

const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b]
    .map(c => Math.round(Math.max(0, Math.min(255, c)))
      .toString(16)
      .padStart(2, '0'))
    .join('');
};

/**
 * Interpolate between two hex color strings.
 * Returns hex string or undefined if either input is invalid.
 */
export const lerpColor = (color1, color2, t) => {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color2 || color1 || undefined;
  return rgbToHex(
    lerp(c1.r, c2.r, t),
    lerp(c1.g, c2.g, t),
    lerp(c1.b, c2.b, t),
  );
};

// ===================================================================
// Rotation normalization
// ===================================================================

/**
 * Normalize an angle delta to [-180, 180] so animations take the shortest path.
 */
const normalizeAngle = (prevAngle, nextAngle) => {
  let delta = nextAngle - prevAngle;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return prevAngle + delta;
};

// ===================================================================
// Keyframe lookup
// ===================================================================

/**
 * Find keyframes surrounding a given time.
 */
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

/**
 * Scan ALL objects' keyframes to find a unified z-swap point for the current time.
 * 
 * If ANY object whose z-index changes in its current time segment has a custom
 * zSwapPoint, that value is used for ALL objects. This ensures synchronized
 * layer changes.
 */
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
      if (globalSwapPoint === null) {
        globalSwapPoint = after.zSwapPoint;
      } else {
        globalSwapPoint = Math.min(globalSwapPoint, after.zSwapPoint);
      }
    }
  }

  return globalSwapPoint;
};

// ===================================================================
// Property interpolation
// ===================================================================

/**
 * Interpolate properties between two keyframes at a given time with easing.
 * 
 * - Position, scale, opacity: standard linear interpolation with easing
 * - Rotation: shortest-path normalization
 * - Z-index: step interpolation at configurable swap point
 * - Fill color: RGB channel interpolation
 * - Deformed path: SVG path segment interpolation (enables shape morphing)
 *
 * @param {Object} beforeKf        - The keyframe before (or at) the current time
 * @param {Object} afterKf         - The keyframe after (or at) the current time
 * @param {number} time            - Current time
 * @param {string} easingType      - Easing function name
 * @param {number|null} globalZSwapPoint - Overrides per-keyframe zSwapPoint
 */
export const interpolateProperties = (
  beforeKf,
  afterKf,
  time,
  easingType = 'linear',
  globalZSwapPoint = null
) => {
  if (!beforeKf || !afterKf) return null;
  
  if (beforeKf.time === afterKf.time) {
    return beforeKf.properties;
  }

  const rawT = (time - beforeKf.time) / (afterKf.time - beforeKf.time);
  const t = applyEasing(rawT, easingType);

  // Rotation: shortest-path normalization
  const normalizedRotation = normalizeAngle(
    beforeKf.properties.rotation, 
    afterKf.properties.rotation
  );

  // Z-index: step interpolation at swap point
  const beforeZ = beforeKf.properties.zIndex ?? 0;
  const afterZ = afterKf.properties.zIndex ?? 0;
  const swapPoint = globalZSwapPoint ?? afterKf.zSwapPoint ?? 0.5;
  const interpolatedZ = rawT < swapPoint ? beforeZ : afterZ;

  // Fill color: RGB channel interpolation
  const beforeFill = beforeKf.properties.fill;
  const afterFill = afterKf.properties.fill;
  const interpolatedFill = (beforeFill && afterFill)
    ? lerpColor(beforeFill, afterFill, t)
    : (afterFill || beforeFill);

  // Deformed path: SVG path segment interpolation
  // This enables morphing between shapes (e.g., triangle → cone)
  const beforePath = beforeKf.properties.deformedPath;
  const afterPath = afterKf.properties.deformedPath;
  let interpolatedDeformedPath = undefined;
  if (beforePath && afterPath && beforePath !== afterPath) {
    interpolatedDeformedPath = interpolatePathStrings(beforePath, afterPath, t);
  } else if (afterPath) {
    interpolatedDeformedPath = afterPath;
  } else if (beforePath) {
    interpolatedDeformedPath = beforePath;
  }

  return {
    x: lerp(beforeKf.properties.x, afterKf.properties.x, t),
    y: lerp(beforeKf.properties.y, afterKf.properties.y, t),
    scaleX: lerp(beforeKf.properties.scaleX, afterKf.properties.scaleX, t),
    scaleY: lerp(beforeKf.properties.scaleY, afterKf.properties.scaleY, t),
    rotation: lerp(beforeKf.properties.rotation, normalizedRotation, t),
    opacity: lerp(beforeKf.properties.opacity, afterKf.properties.opacity, t),
    zIndex: interpolatedZ,
    fill: interpolatedFill,
    deformedPath: interpolatedDeformedPath,
  };
};

/**
 * Apply interpolated properties to a Fabric.js object.
 * 
 * Sets position, scale, rotation, opacity directly.
 * Applies fill color if present.
 * Applies deformed path by updating the fabric.Path's path data.
 * Stores target zIndex for batch reordering.
 */
export const applyPropertiesToFabricObject = (fabricObject, properties) => {
  if (!fabricObject || !properties) return;

  fabricObject.set({
    left: properties.x,
    top: properties.y,
    scaleX: properties.scaleX,
    scaleY: properties.scaleY,
    angle: properties.rotation,
    opacity: properties.opacity,
  });

  // Apply fill color animation (shapes and text)
  if (properties.fill) {
    fabricObject.set('fill', properties.fill);
  }

  // NOTE: deformedPath is NOT applied here because updating a fabric.Path's
  // internal path array requires fabric-specific parsing that doesn't belong
  // in this pure utility. Instead, Canvas.jsx handles path updates in its
  // playback loop after calling this function.

  // Store target zIndex for batch reordering
  if (properties.zIndex !== undefined) {
    fabricObject._targetZIndex = properties.zIndex;
  }
};

// ===================================================================
// Canvas z-order management
// ===================================================================

/**
 * Reorder canvas objects based on their _targetZIndex values.
 * Call this once per frame after applying all interpolated properties.
 */
export const applyZIndexOrdering = (fabricCanvas) => {
  if (!fabricCanvas) return;
  
  const objects = fabricCanvas.getObjects();
  const objectsWithZIndex = objects.filter(
    obj => obj._targetZIndex !== undefined
  );
  
  if (objectsWithZIndex.length === 0) return;
  
  objectsWithZIndex.sort(
    (a, b) => (a._targetZIndex || 0) - (b._targetZIndex || 0)
  );
  
  objectsWithZIndex.forEach((obj) => {
    try {
      if (typeof fabricCanvas.bringObjectToFront === 'function') {
        fabricCanvas.bringObjectToFront(obj);
      }
    } catch (e) {
      // Silently ignore
    }
  });
};

// ===================================================================
// Keyframe snapping
// ===================================================================

/**
 * Snap time to nearest keyframe.
 */
export const snapToNearestKeyframe = (time, keyframes, threshold = 0.1) => {
  if (keyframes.length === 0) return time;
  
  let nearest = time;
  let minDistance = threshold;
  
  for (const kf of keyframes) {
    const distance = Math.abs(kf.time - time);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = kf.time;
    }
  }
  
  return nearest;
};

// ===================================================================
// Rotation normalization for animation export
// ===================================================================

/**
 * Pre-process keyframes to normalize rotation values for animation.
 * Used by LivePreview and codeGenerator before building GSAP timelines.
 * Preserves all keyframe-level properties (easing, zSwapPoint, fill, deformedPath, etc).
 */
export const normalizeKeyframeRotations = (keyframes) => {
  if (!keyframes || keyframes.length < 2) return keyframes;
  
  const normalized = [keyframes[0]];
  
  for (let i = 1; i < keyframes.length; i++) {
    const prevRotation = normalized[i - 1].properties.rotation;
    const currRotation = keyframes[i].properties.rotation;
    const normalizedRotation = normalizeAngle(prevRotation, currRotation);
    
    if (normalizedRotation === currRotation) {
      normalized.push(keyframes[i]);
    } else {
      normalized.push({
        ...keyframes[i],
        properties: {
          ...keyframes[i].properties,
          rotation: normalizedRotation,
        },
      });
    }
  }
  
  return normalized;
};