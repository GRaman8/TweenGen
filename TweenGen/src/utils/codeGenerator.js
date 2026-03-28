/**
 * Code Generator — Produces standalone HTML/CSS/JS animation
 *
 * Supports: all shapes, deformed shapes (path morphing), paths, groups,
 * images (bitmap + vector), canvas bg, color animation, outlines,
 * audio with trim region.
 */

import { normalizeKeyframeRotations, findSurroundingKeyframes } from './interpolation';
import { SVG_SHAPE_KEYS } from './shapeDefinitions';
import { parseSVGDimensions } from './imageTracer';
import { getAudioExtension, arrayBufferToBlob } from './audioUtils';
import { PATH_INTERP_CODE } from './pathUtils';

const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 800;

// ===================================================================
// Utility helpers
// ===================================================================

/**
 * Convert a Fabric.js path array to an SVG path string.
 */
const fabricPathToSVGPath = (pathArray) => {
  if (!pathArray || !Array.isArray(pathArray)) return '';
  return pathArray
    .filter(seg => Array.isArray(seg))
    .map(seg => seg[0] + ' ' + seg.slice(1).join(' '))
    .join(' ')
    .trim();
};

/**
 * Find the global z-swap point for a time segment across all objects.
 */
const findGlobalZSwapForSegment = (allNormalizedKfs, prevTime, currTime) => {
  const midTime = (prevTime + currTime) / 2;
  let globalSwap = null;

  for (const objId of Object.keys(allNormalizedKfs)) {
    const objKfs = allNormalizedKfs[objId];
    if (!objKfs || objKfs.length < 2) continue;

    const { before, after } = findSurroundingKeyframes(objKfs, midTime);
    if (!before || !after || before === after) continue;
    if ((before.properties.zIndex ?? 0) === (after.properties.zIndex ?? 0)) continue;

    if (after.zSwapPoint !== undefined && after.zSwapPoint !== null) {
      globalSwap = globalSwap === null
        ? after.zSwapPoint
        : Math.min(globalSwap, after.zSwapPoint);
    }
  }

  return globalSwap ?? 0.5;
};

/**
 * Generate a gsap.set() call for z-index swap if needed.
 */
const generateZSwapCode = (selector, prev, curr, globalSwapPoint) => {
  const prevZ = prev.properties.zIndex ?? 0;
  const currZ = curr.properties.zIndex ?? 0;
  if (prevZ === currZ) return '';

  const swapTime = prev.time + (curr.time - prev.time) * globalSwapPoint;
  return `    tl.set('${selector}', { zIndex: ${currZ} }, ${swapTime.toFixed(2)});\n`;
};

/**
 * Generate fill color animation code between two keyframes.
 */
const generateFillAnimCode = (objId, objType, prev, curr) => {
  const prevFill = prev.properties.fill;
  const currFill = curr.properties.fill;
  if (!prevFill || !currFill || prevFill === currFill) return '';

  const dur = (curr.time - prev.time).toFixed(2);
  const ease = mapEasingToGSAP(curr.easing || 'linear');
  const time = prev.time.toFixed(2);

  if (objType === 'text') {
    return `    tl.to('#${objId}', {\n      duration: ${dur}, color: '${currFill}', ease: '${ease}'\n    }, ${time});\n`;
  }

  if (SVG_SHAPE_KEYS.has(objType)) {
    return `    tl.to('#${objId} path', {\n      duration: ${dur}, attr: { fill: '${currFill}' }, ease: '${ease}'\n    }, ${time});\n`;
  }

  return `    tl.to('#${objId}', {\n      duration: ${dur}, backgroundColor: '${currFill}', ease: '${ease}'\n    }, ${time});\n`;
};

/**
 * Map internal easing names to GSAP equivalents.
 */
const mapEasingToGSAP = (easing) => {
  const map = {
    linear: 'none',
    easeInQuad: 'power1.in',
    easeOutQuad: 'power1.out',
    easeInOutQuad: 'power1.inOut',
    easeInCubic: 'power2.in',
    easeOutCubic: 'power2.out',
    easeInOutCubic: 'power2.inOut',
    easeInQuart: 'power3.in',
    easeOutQuart: 'power3.out',
    easeInOutQuart: 'power3.inOut',
    bounce: 'bounce.out',
    elastic: 'elastic.out',
  };
  return map[easing] || 'none';
};

/**
 * Get a default fill color for a shape type.
 */
const getDefaultFillColor = (type) => {
  switch (type) {
    case 'rectangle':
    case 'roundedRect':
      return '#3b82f6';
    case 'circle':
      return '#ef4444';
    case 'ellipse':
      return '#a855f7';
    case 'text':
      return '#000000';
    default:
      return '#000000';
  }
};

/**
 * Escape a string for use inside a JS single-quoted string.
 */
const escapeJSString = (str) => {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
};

/**
 * Generate CSS outline declaration for a shape.
 */
const getOutlineCSS = (obj) => {
  const ow = obj.outlineWidth || 0;
  const oc = obj.outlineColor || '#000000';
  if (ow <= 0) return '';

  if (obj.type === 'text') {
    return `    -webkit-text-stroke: ${ow}px ${oc};\n    paint-order: stroke fill;\n`;
  }
  return `    outline: ${ow}px solid ${oc};\n`;
};

/**
 * Generate SVG stroke attributes for an SVG shape.
 */
const getSvgStrokeAttr = (obj) => {
  const ow = obj.outlineWidth || 0;
  const oc = obj.outlineColor || '#000000';
  if (ow <= 0) return '';
  return ` stroke="${oc}" stroke-width="${ow}"`;
};

// ===================================================================
// Public API
// ===================================================================

export const generateAnimationCode = (
  canvasObjects, keyframes, duration,
  loopPlayback = false, fabricCanvas = null,
  canvasBgColor = '#f0f0f0',
  audioFile = null, audioRegion = null
) => {
  const html = generateHTML();
  const css = generateCSS(canvasObjects, keyframes, fabricCanvas, canvasBgColor);
  const javascript = generateJavaScript(
    canvasObjects, keyframes, duration,
    loopPlayback, fabricCanvas, audioFile, audioRegion
  );
  return { html, css, javascript };
};

// ===================================================================
// HTML generation
// ===================================================================

const generateHTML = () => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Animation</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="animation-container"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="animation.js"></script>
</body>
</html>`;
};

// ===================================================================
// CSS generation
// ===================================================================

const generateCSS = (canvasObjects, keyframes, fabricCanvas, canvasBgColor) => {
  let css = `/* Generated Animation Styles */

body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: Arial, sans-serif;
}

#animation-container {
    position: relative;
    width: ${CANVAS_WIDTH}px;
    height: ${CANVAS_HEIGHT}px;
    background-color: ${canvasBgColor};
    margin: 20px auto;
    border: 1px solid #ccc;
    overflow: hidden;
}

`;

  // Identify group children (they don't get individual CSS)
  const groupChildren = new Set();
  canvasObjects.forEach(obj => {
    if (obj.type === 'group' && obj.children) {
      obj.children.forEach(c => groupChildren.add(c));
    }
  });

  // Generate CSS for CSS-rendered shapes only
  // (Paths, groups, images, SVG shapes, and deformed shapes are all JS-created)
  canvasObjects.forEach(obj => {
    if (groupChildren.has(obj.id)) return;

    const rawKfs = keyframes[obj.id] || [];
    if (rawKfs.length === 0) return;

    // Skip types that are created entirely in JS
    if (
      obj.type === 'path' ||
      obj.type === 'group' ||
      obj.type === 'image' ||
      obj.deformedPath ||
      SVG_SHAPE_KEYS.has(obj.type)
    ) {
      return;
    }

    const objKfs = normalizeKeyframeRotations(rawKfs);
    const firstKf = objKfs[0];
    const p = firstKf.properties;
    const ax = obj.anchorX ?? 0.5;
    const ay = obj.anchorY ?? 0.5;
    let ew = 100;
    let eh = 100;
    if (obj.type === 'ellipse') eh = 76;

    const fillColor = p.fill || obj.fill || getDefaultFillColor(obj.type);

    css += `#${obj.id} {\n`;
    css += `    position: absolute;\n`;
    css += `    left: ${(p.x - ax * ew).toFixed(2)}px;\n`;
    css += `    top: ${(p.y - ay * eh).toFixed(2)}px;\n`;
    css += `    transform-origin: ${(ax * 100).toFixed(0)}% ${(ay * 100).toFixed(0)}%;\n`;
    css += `    opacity: ${p.opacity};\n`;
    css += `    z-index: ${p.zIndex ?? 0};\n`;

    if (obj.type === 'rectangle') {
      css += `    width: 100px;\n    height: 100px;\n    background-color: ${fillColor};\n`;
    } else if (obj.type === 'circle') {
      css += `    width: 100px;\n    height: 100px;\n    border-radius: 50%;\n    background-color: ${fillColor};\n`;
    } else if (obj.type === 'roundedRect') {
      css += `    width: 100px;\n    height: 100px;\n    border-radius: 16px;\n    background-color: ${fillColor};\n`;
    } else if (obj.type === 'ellipse') {
      css += `    width: 100px;\n    height: 76px;\n    border-radius: 50%;\n    background-color: ${fillColor};\n`;
    } else if (obj.type === 'text') {
      css += `    font-size: 24px;\n    color: ${fillColor};\n    white-space: nowrap;\n`;
    }

    css += getOutlineCSS(obj);
    css += `}\n\n`;
  });

  return css;
};

// ===================================================================
// JavaScript generation
// ===================================================================

const generateJavaScript = (
  canvasObjects, keyframes, duration,
  loopPlayback, fabricCanvas, audioFile, audioRegion
) => {
  const repeatValue = loopPlayback ? -1 : 0;
  const hasAudio = !!audioFile;
  const audioFileName = hasAudio
    ? `audio.${getAudioExtension(audioFile.fileName, audioFile.mimeType)}`
    : null;

  // Audio region
  const regionStart = audioRegion ? audioRegion.start : 0;
  const regionEnd = audioRegion ? audioRegion.end : (audioFile?.duration || duration);
  const regionDur = regionEnd - regionStart;

  // Check if any deformed shapes need path morphing
  const hasPathMorphing = canvasObjects.some(obj => {
    if (!obj.deformedPath) return false;
    const kfs = keyframes[obj.id] || [];
    for (let i = 1; i < kfs.length; i++) {
      const prevPath = kfs[i - 1].properties?.deformedPath;
      const currPath = kfs[i].properties?.deformedPath;
      if (prevPath && currPath && prevPath !== currPath) return true;
    }
    return false;
  });

  let js = `// Generated Animation Code\n\n`;
  js += `document.addEventListener('DOMContentLoaded', () => {\n`;
  js += `    const container = document.getElementById('animation-container');\n`;
  js += `    const tl = gsap.timeline({\n`;
  js += `        repeat: ${repeatValue},\n`;
  js += `        defaults: { duration: 1, ease: "power1.inOut" }`;
  js += hasAudio ? `,\n        paused: true\n` : `\n`;
  js += `    });\n\n`;

  // Include path interpolation function if morphing is used
  if (hasPathMorphing) {
    js += `    // ===== PATH MORPHING UTILITY =====\n`;
    js += PATH_INTERP_CODE;
    js += `\n`;
  }

  // Audio setup
  if (hasAudio) {
    js += generateAudioSetup(audioFileName, regionStart, regionEnd, regionDur, duration);
  }

  // Identify group children and pre-normalize keyframes
  const groupChildren = new Set();
  canvasObjects.forEach(obj => {
    if (obj.type === 'group' && obj.children) {
      obj.children.forEach(c => groupChildren.add(c));
    }
  });

  const allNormalizedKfs = {};
  canvasObjects.forEach(obj => {
    if (groupChildren.has(obj.id)) return;
    const rawKfs = keyframes[obj.id] || [];
    if (rawKfs.length === 0) return;
    allNormalizedKfs[obj.id] = normalizeKeyframeRotations(rawKfs);
  });

  // ===== Element creation =====
  canvasObjects.forEach(obj => {
    const objKfs = allNormalizedKfs[obj.id];
    if (!objKfs || objKfs.length === 0 || groupChildren.has(obj.id)) return;
    const firstKf = objKfs[0];

    if (obj.type === 'group') {
      js += generateGroupCreation(obj, firstKf, canvasObjects, fabricCanvas);
    } else if (obj.type === 'path') {
      js += generatePathCreation(obj, firstKf, fabricCanvas);
    } else if (obj.type === 'image') {
      js += generateImageCreation(obj, firstKf);
    } else if (obj.deformedPath) {
      js += generateDeformedShapeCreation(obj, firstKf, fabricCanvas);
    } else if (SVG_SHAPE_KEYS.has(obj.type)) {
      js += generateSvgShapeCreation(obj, firstKf);
    } else {
      js += generateRegularCreation(obj, firstKf);
    }
  });

  // ===== Animation tweens =====
  canvasObjects.forEach(obj => {
    const objKfs = allNormalizedKfs[obj.id];
    if (!objKfs || objKfs.length < 2 || groupChildren.has(obj.id)) return;

    js += `    // Animate ${obj.name}\n`;

    if (obj.type === 'path' || obj.deformedPath) {
      js += generatePathStyleAnimation(obj, objKfs, allNormalizedKfs);
    } else if (obj.type === 'group') {
      js += generatePathStyleAnimation(obj, objKfs, allNormalizedKfs);
    } else if (obj.type === 'image') {
      const ew = obj.imageWidth || 100;
      const eh = obj.imageHeight || 100;
      js += generateStandardAnimation(obj, objKfs, allNormalizedKfs, ew, eh);
    } else if (SVG_SHAPE_KEYS.has(obj.type)) {
      js += generateStandardAnimation(obj, objKfs, allNormalizedKfs, 100, 100);
    } else {
      const eh = obj.type === 'ellipse' ? 76 : 100;
      js += generateStandardAnimation(obj, objKfs, allNormalizedKfs, 100, eh);
    }
  });

  if (!hasAudio) {
    js += `    tl.play();\n`;
  }

  js += `});\n`;
  return js;
};

// ===================================================================
// Audio setup code
// ===================================================================

const generateAudioSetup = (fileName, regionStart, regionEnd, regionDur, duration) => {
  return `    // ===== AUDIO SETUP =====
    const audio = new Audio('${fileName}');
    audio.preload = 'auto';
    audio.volume = 1;

    const AUDIO_REGION_START = ${regionStart.toFixed(3)};
    const AUDIO_REGION_END = ${regionEnd.toFixed(3)};
    const AUDIO_REGION_DUR = ${regionDur.toFixed(3)};
    const ANIM_DURATION = ${duration.toFixed(3)};

    function animToAudioTime(t) {
        if (AUDIO_REGION_DUR <= 0 || ANIM_DURATION <= 0) return AUDIO_REGION_START;
        return AUDIO_REGION_START + (t / ANIM_DURATION) * AUDIO_REGION_DUR;
    }

    // Click-to-start overlay (browser autoplay policy)
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;' +
        'display:flex;align-items:center;justify-content:center;' +
        'background:rgba(0,0,0,0.35);cursor:pointer;z-index:9999;transition:opacity 0.3s;';
    overlay.innerHTML = '<div style="background:white;padding:16px 36px;border-radius:12px;' +
        'font-family:Arial,sans-serif;font-size:18px;font-weight:600;' +
        'box-shadow:0 4px 20px rgba(0,0,0,0.15);user-select:none;">▶ Click to Play</div>';
    container.appendChild(overlay);

    overlay.addEventListener('click', () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
        audio.currentTime = AUDIO_REGION_START;
        audio.play().catch(() => {});
        tl.play(0);
    });

    tl.eventCallback('onUpdate', () => {
        const expected = animToAudioTime(tl.time());
        if (Math.abs(audio.currentTime - expected) > 0.1) {
            audio.currentTime = Math.min(expected, audio.duration || Infinity);
        }
    });

    tl.eventCallback('onRepeat', () => {
        audio.currentTime = AUDIO_REGION_START;
        audio.play().catch(() => {});
    });

    tl.eventCallback('onComplete', () => { audio.pause(); });

`;
};

// ===================================================================
// Element creation functions
// ===================================================================

/**
 * Create an SVG shape (triangle, star, etc.) — uses viewBox 0 0 100 100.
 */
const generateSvgShapeCreation = (obj, firstKf) => {
  const ax = obj.anchorX ?? 0.5;
  const ay = obj.anchorY ?? 0.5;
  const ew = 100;
  const eh = 100;
  const z = firstKf.properties.zIndex ?? 0;
  const fillColor = firstKf.properties.fill || obj.fill || '#000000';
  const strokeAttr = getSvgStrokeAttr(obj);

  let js = `    // Create ${obj.name} (SVG Shape)\n`;
  js += `    const ${obj.id} = document.createElement('div');\n`;
  js += `    ${obj.id}.id = '${obj.id}';\n`;
  js += `    ${obj.id}.style.position = 'absolute';\n`;
  js += `    ${obj.id}.style.width = '${ew}px';\n`;
  js += `    ${obj.id}.style.height = '${eh}px';\n`;
  js += `    ${obj.id}.style.transformOrigin = '${(ax * 100).toFixed(0)}% ${(ay * 100).toFixed(0)}%';\n`;
  js += `    ${obj.id}.style.left = '${(firstKf.properties.x - ax * ew).toFixed(2)}px';\n`;
  js += `    ${obj.id}.style.top = '${(firstKf.properties.y - ay * eh).toFixed(2)}px';\n`;
  js += `    ${obj.id}.style.zIndex = '${z}';\n`;
  js += `    ${obj.id}.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%"`;
  js += ` style="display:block"><path d="${obj.svgPath}" fill="${fillColor}"${strokeAttr}/></svg>';\n`;
  js += `    container.appendChild(${obj.id});\n`;
  js += `    gsap.set(${obj.id}, {\n`;
  js += `        scaleX: ${firstKf.properties.scaleX.toFixed(2)},\n`;
  js += `        scaleY: ${firstKf.properties.scaleY.toFixed(2)},\n`;
  js += `        rotation: ${firstKf.properties.rotation.toFixed(2)},\n`;
  js += `        opacity: ${firstKf.properties.opacity.toFixed(2)}\n`;
  js += `    });\n\n`;
  return js;
};

/**
 * Create a deformed shape using the wrapper approach (0×0 div + SVG with translate).
 */
const generateDeformedShapeCreation = (obj, firstKf, fabricCanvas) => {
  const fo = fabricCanvas?.getObjects().find(o => o.id === obj.id);
  const pathOffsetX = fo?.pathOffset?.x || obj.deformedPathOffsetX || 50;
  const pathOffsetY = fo?.pathOffset?.y || obj.deformedPathOffsetY || 50;
  const width = fo?.width || obj.deformedPathWidth || 100;
  const height = fo?.height || obj.deformedPathHeight || 100;
  const anchorX = obj.anchorX ?? 0.5;
  const anchorY = obj.anchorY ?? 0.5;
  const transX = pathOffsetX + (anchorX - 0.5) * width;
  const transY = pathOffsetY + (anchorY - 0.5) * height;
  const z = firstKf.properties.zIndex ?? 0;
  const fillColor = firstKf.properties.fill || obj.fill || '#000000';
  const ow = obj.outlineWidth || 0;
  const oc = obj.outlineColor || '#000000';

  // Use the keyframe's path if available, otherwise the object's deformed path
  const pathD = firstKf.properties.deformedPath || obj.deformedPath;

  let js = `    // Create ${obj.name} (Deformed Shape)\n`;
  js += `    const ${obj.id} = document.createElement('div');\n`;
  js += `    ${obj.id}.id = '${obj.id}';\n`;
  js += `    ${obj.id}.style.position = 'absolute';\n`;
  js += `    ${obj.id}.style.left = '${firstKf.properties.x.toFixed(2)}px';\n`;
  js += `    ${obj.id}.style.top = '${firstKf.properties.y.toFixed(2)}px';\n`;
  js += `    ${obj.id}.style.width = '0px';\n`;
  js += `    ${obj.id}.style.height = '0px';\n`;
  js += `    ${obj.id}.style.overflow = 'visible';\n`;
  js += `    ${obj.id}.style.transformOrigin = '0px 0px';\n`;
  js += `    ${obj.id}.style.zIndex = '${z}';\n\n`;

  js += `    var svg_${obj.id} = document.createElementNS('http://www.w3.org/2000/svg', 'svg');\n`;
  js += `    svg_${obj.id}.style.position = 'absolute';\n`;
  js += `    svg_${obj.id}.style.overflow = 'visible';\n`;
  js += `    svg_${obj.id}.setAttribute('width', '1');\n`;
  js += `    svg_${obj.id}.setAttribute('height', '1');\n\n`;

  js += `    var g_${obj.id} = document.createElementNS('http://www.w3.org/2000/svg', 'g');\n`;
  js += `    g_${obj.id}.setAttribute('transform', 'translate(${(-transX).toFixed(2)}, ${(-transY).toFixed(2)})');\n\n`;

  js += `    var p_${obj.id} = document.createElementNS('http://www.w3.org/2000/svg', 'path');\n`;
  js += `    p_${obj.id}.setAttribute('d', '${pathD}');\n`;
  js += `    p_${obj.id}.setAttribute('fill', '${fillColor}');\n`;
  if (ow > 0) {
    js += `    p_${obj.id}.setAttribute('stroke', '${oc}');\n`;
    js += `    p_${obj.id}.setAttribute('stroke-width', '${ow}');\n`;
  }
  js += `\n`;

  js += `    g_${obj.id}.appendChild(p_${obj.id});\n`;
  js += `    svg_${obj.id}.appendChild(g_${obj.id});\n`;
  js += `    ${obj.id}.appendChild(svg_${obj.id});\n`;
  js += `    container.appendChild(${obj.id});\n`;
  js += `    gsap.set(${obj.id}, {\n`;
  js += `        scaleX: ${firstKf.properties.scaleX.toFixed(2)},\n`;
  js += `        scaleY: ${firstKf.properties.scaleY.toFixed(2)},\n`;
  js += `        rotation: ${firstKf.properties.rotation.toFixed(2)},\n`;
  js += `        opacity: ${firstKf.properties.opacity.toFixed(2)}\n`;
  js += `    });\n\n`;
  return js;
};

/**
 * Create a bitmap or vector image.
 */
const generateImageCreation = (obj, firstKf) => {
  const ax = obj.anchorX ?? 0.5;
  const ay = obj.anchorY ?? 0.5;
  const ew = obj.imageWidth || 100;
  const eh = obj.imageHeight || 100;
  const z = firstKf.properties.zIndex ?? 0;
  const useVector = obj.svgExportMode === 'vector' && obj.svgTracedData;

  let js = '';

  if (useVector) {
    const { width: traceW, height: traceH, innerSVG } = parseSVGDimensions(obj.svgTracedData);
    const escapedInner = escapeJSString(innerSVG);

    js += `    // Create ${obj.name} (Vector SVG)\n`;
    js += `    const ${obj.id} = document.createElement('div');\n`;
    js += `    ${obj.id}.id = '${obj.id}';\n`;
    js += `    ${obj.id}.style.position = 'absolute';\n`;
    js += `    ${obj.id}.style.width = '${ew}px';\n`;
    js += `    ${obj.id}.style.height = '${eh}px';\n`;
    js += `    ${obj.id}.style.transformOrigin = '${(ax * 100).toFixed(0)}% ${(ay * 100).toFixed(0)}%';\n`;
    js += `    ${obj.id}.style.left = '${(firstKf.properties.x - ax * ew).toFixed(2)}px';\n`;
    js += `    ${obj.id}.style.top = '${(firstKf.properties.y - ay * eh).toFixed(2)}px';\n`;
    js += `    ${obj.id}.style.zIndex = '${z}';\n`;
    js += `    ${obj.id}.style.pointerEvents = 'none';\n`;
    js += `    ${obj.id}.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"`;
    js += ` viewBox="0 0 ${traceW} ${traceH}" width="${ew}" height="${eh}"`;
    js += ` preserveAspectRatio="none" style="display:block">${escapedInner}</svg>';\n`;
  } else {
    js += `    // Create ${obj.name} (Bitmap Image)\n`;
    js += `    const ${obj.id} = document.createElement('img');\n`;
    js += `    ${obj.id}.id = '${obj.id}';\n`;
    js += `    ${obj.id}.src = '${obj.imageDataURL}';\n`;
    js += `    ${obj.id}.style.position = 'absolute';\n`;
    js += `    ${obj.id}.style.width = '${ew}px';\n`;
    js += `    ${obj.id}.style.height = '${eh}px';\n`;
    js += `    ${obj.id}.style.transformOrigin = '${(ax * 100).toFixed(0)}% ${(ay * 100).toFixed(0)}%';\n`;
    js += `    ${obj.id}.style.left = '${(firstKf.properties.x - ax * ew).toFixed(2)}px';\n`;
    js += `    ${obj.id}.style.top = '${(firstKf.properties.y - ay * eh).toFixed(2)}px';\n`;
    js += `    ${obj.id}.style.zIndex = '${z}';\n`;
    js += `    ${obj.id}.style.pointerEvents = 'none';\n`;
  }

  js += `    container.appendChild(${obj.id});\n`;
  js += `    gsap.set(${obj.id}, {\n`;
  js += `        scaleX: ${firstKf.properties.scaleX.toFixed(2)},\n`;
  js += `        scaleY: ${firstKf.properties.scaleY.toFixed(2)},\n`;
  js += `        rotation: ${firstKf.properties.rotation.toFixed(2)},\n`;
  js += `        opacity: ${firstKf.properties.opacity.toFixed(2)}\n`;
  js += `    });\n\n`;
  return js;
};

/**
 * Create a CSS-rendered shape (rectangle, circle, text, etc.).
 */
const generateRegularCreation = (obj, firstKf) => {
  const ax = obj.anchorX ?? 0.5;
  const ay = obj.anchorY ?? 0.5;
  let ew = 100;
  let eh = 100;
  if (obj.type === 'ellipse') eh = 76;
  const fillColor = firstKf.properties.fill || obj.fill || getDefaultFillColor(obj.type);
  const z = firstKf.properties.zIndex ?? 0;
  const ow = obj.outlineWidth || 0;
  const oc = obj.outlineColor || '#000000';

  let js = `    // Create ${obj.name}\n`;
  js += `    const ${obj.id} = document.createElement('div');\n`;
  js += `    ${obj.id}.id = '${obj.id}';\n`;
  js += `    ${obj.id}.style.position = 'absolute';\n`;
  js += `    ${obj.id}.style.transformOrigin = '${(ax * 100).toFixed(0)}% ${(ay * 100).toFixed(0)}%';\n`;
  js += `    ${obj.id}.style.left = '${(firstKf.properties.x - ax * ew).toFixed(2)}px';\n`;
  js += `    ${obj.id}.style.top = '${(firstKf.properties.y - ay * eh).toFixed(2)}px';\n`;
  js += `    ${obj.id}.style.zIndex = '${z}';\n`;

  switch (obj.type) {
    case 'rectangle':
      js += `    ${obj.id}.style.width = '100px';\n    ${obj.id}.style.height = '100px';\n`;
      js += `    ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
      break;
    case 'circle':
      js += `    ${obj.id}.style.width = '100px';\n    ${obj.id}.style.height = '100px';\n`;
      js += `    ${obj.id}.style.borderRadius = '50%';\n    ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
      break;
    case 'roundedRect':
      js += `    ${obj.id}.style.width = '100px';\n    ${obj.id}.style.height = '100px';\n`;
      js += `    ${obj.id}.style.borderRadius = '16px';\n    ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
      break;
    case 'ellipse':
      js += `    ${obj.id}.style.width = '100px';\n    ${obj.id}.style.height = '76px';\n`;
      js += `    ${obj.id}.style.borderRadius = '50%';\n    ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
      break;
    case 'text':
      js += `    ${obj.id}.textContent = '${(obj.textContent || 'Text').replace(/'/g, "\\'")}';\n`;
      js += `    ${obj.id}.style.fontSize = '24px';\n    ${obj.id}.style.color = '${fillColor}';\n`;
      js += `    ${obj.id}.style.whiteSpace = 'nowrap';\n`;
      break;
    default:
      break;
  }

  if (ow > 0) {
    if (obj.type === 'text') {
      js += `    ${obj.id}.style.webkitTextStroke = '${ow}px ${oc}';\n`;
      js += `    ${obj.id}.style.paintOrder = 'stroke fill';\n`;
    } else {
      js += `    ${obj.id}.style.outline = '${ow}px solid ${oc}';\n`;
    }
  }

  js += `    container.appendChild(${obj.id});\n`;
  js += `    gsap.set(${obj.id}, {\n`;
  js += `        scaleX: ${firstKf.properties.scaleX.toFixed(2)},\n`;
  js += `        scaleY: ${firstKf.properties.scaleY.toFixed(2)},\n`;
  js += `        rotation: ${firstKf.properties.rotation.toFixed(2)},\n`;
  js += `        opacity: ${firstKf.properties.opacity.toFixed(2)}\n`;
  js += `    });\n\n`;
  return js;
};

/**
 * Create a freehand path with wrapper div + SVG.
 */
const generatePathCreation = (obj, firstKf, fabricCanvas) => {
  const pathString = fabricPathToSVGPath(obj.pathData);
  const fo = fabricCanvas?.getObjects().find(o => o.id === obj.id);
  const poX = fo?.pathOffset?.x || firstKf.properties.pathOffsetX || 0;
  const poY = fo?.pathOffset?.y || firstKf.properties.pathOffsetY || 0;
  const w = fo?.width || obj.width || 0;
  const h = fo?.height || obj.height || 0;
  const ax = obj.anchorX ?? 0.5;
  const ay = obj.anchorY ?? 0.5;
  const tx = poX + (ax - 0.5) * w;
  const ty = poY + (ay - 0.5) * h;
  const z = firstKf.properties.zIndex ?? 0;
  const wid = obj.id;

  let js = `    // Create ${obj.name} (SVG Path)\n`;
  js += `    const ${wid} = document.createElement('div');\n`;
  js += `    ${wid}.id = '${wid}';\n`;
  js += `    ${wid}.style.position = 'absolute';\n`;
  js += `    ${wid}.style.left = '${firstKf.properties.x.toFixed(2)}px';\n`;
  js += `    ${wid}.style.top = '${firstKf.properties.y.toFixed(2)}px';\n`;
  js += `    ${wid}.style.width = '0px';\n`;
  js += `    ${wid}.style.height = '0px';\n`;
  js += `    ${wid}.style.overflow = 'visible';\n`;
  js += `    ${wid}.style.transformOrigin = '0px 0px';\n`;
  js += `    ${wid}.style.zIndex = '${z}';\n\n`;

  // Paint bucket fills
  if (obj.fills?.length > 0) {
    obj.fills.forEach((fill, idx) => {
      const al = fill.relLeft - (ax - 0.5) * w;
      const at = fill.relTop - (ay - 0.5) * h;
      js += `    var fi${idx} = document.createElement('img');\n`;
      js += `    fi${idx}.src = '${fill.dataURL}';\n`;
      js += `    fi${idx}.style.position = 'absolute';\n`;
      js += `    fi${idx}.style.left = '${al.toFixed(2)}px';\n`;
      js += `    fi${idx}.style.top = '${at.toFixed(2)}px';\n`;
      js += `    fi${idx}.style.width = '${fill.width}px';\n`;
      js += `    fi${idx}.style.height = '${fill.height}px';\n`;
      js += `    fi${idx}.style.pointerEvents = 'none';\n`;
      js += `    fi${idx}.style.imageRendering = 'pixelated';\n`;
      js += `    ${wid}.appendChild(fi${idx});\n\n`;
    });
  }

  js += `    var svg_${wid} = document.createElementNS('http://www.w3.org/2000/svg', 'svg');\n`;
  js += `    svg_${wid}.style.position = 'absolute';\n`;
  js += `    svg_${wid}.style.overflow = 'visible';\n`;
  js += `    svg_${wid}.style.pointerEvents = 'none';\n`;
  js += `    svg_${wid}.setAttribute('width', '1');\n`;
  js += `    svg_${wid}.setAttribute('height', '1');\n\n`;

  js += `    var g_${wid} = document.createElementNS('http://www.w3.org/2000/svg', 'g');\n`;
  js += `    g_${wid}.setAttribute('transform', 'translate(${(-tx).toFixed(2)}, ${(-ty).toFixed(2)})');\n\n`;

  js += `    var p_${wid} = document.createElementNS('http://www.w3.org/2000/svg', 'path');\n`;
  js += `    p_${wid}.setAttribute('d', '${pathString}');\n`;
  js += `    p_${wid}.setAttribute('stroke', '${obj.strokeColor || '#000'}');\n`;
  js += `    p_${wid}.setAttribute('stroke-width', '${obj.strokeWidth || 3}');\n`;
  js += `    p_${wid}.setAttribute('fill', 'none');\n`;
  js += `    p_${wid}.setAttribute('stroke-linecap', 'round');\n`;
  js += `    p_${wid}.setAttribute('stroke-linejoin', 'round');\n\n`;

  js += `    g_${wid}.appendChild(p_${wid});\n`;
  js += `    svg_${wid}.appendChild(g_${wid});\n`;
  js += `    ${wid}.appendChild(svg_${wid});\n`;
  js += `    container.appendChild(${wid});\n`;
  js += `    gsap.set(${wid}, {\n`;
  js += `        scaleX: ${firstKf.properties.scaleX.toFixed(2)},\n`;
  js += `        scaleY: ${firstKf.properties.scaleY.toFixed(2)},\n`;
  js += `        rotation: ${firstKf.properties.rotation.toFixed(2)},\n`;
  js += `        opacity: ${firstKf.properties.opacity.toFixed(2)}\n`;
  js += `    });\n\n`;
  return js;
};

/**
 * Create a group with child elements.
 */
const generateGroupCreation = (obj, firstKf, canvasObjects, fabricCanvas) => {
  const z = firstKf.properties.zIndex ?? 0;
  let js = `    // Create ${obj.name} (Group)\n`;
  js += `    const ${obj.id} = document.createElement('div');\n`;
  js += `    ${obj.id}.id = '${obj.id}';\n`;
  js += `    ${obj.id}.style.position = 'absolute';\n`;
  js += `    ${obj.id}.style.left = '${firstKf.properties.x.toFixed(2)}px';\n`;
  js += `    ${obj.id}.style.top = '${firstKf.properties.y.toFixed(2)}px';\n`;
  js += `    ${obj.id}.style.width = '0px';\n`;
  js += `    ${obj.id}.style.height = '0px';\n`;
  js += `    ${obj.id}.style.overflow = 'visible';\n`;
  js += `    ${obj.id}.style.transformOrigin = '0px 0px';\n`;
  js += `    ${obj.id}.style.zIndex = '${z}';\n`;
  js += `    container.appendChild(${obj.id});\n`;
  js += `    gsap.set(${obj.id}, {\n`;
  js += `        scaleX: ${firstKf.properties.scaleX.toFixed(2)},\n`;
  js += `        scaleY: ${firstKf.properties.scaleY.toFixed(2)},\n`;
  js += `        rotation: ${firstKf.properties.rotation.toFixed(2)},\n`;
  js += `        opacity: ${firstKf.properties.opacity.toFixed(2)}\n`;
  js += `    });\n\n`;

  // Generate child elements
  if (obj.children && fabricCanvas) {
    const fg = fabricCanvas.getObjects().find(o => o.id === obj.id);
    if (fg?._objects) {
      fg._objects.forEach(fc => {
        const co = canvasObjects.find(o => o.id === fc.id);
        if (!co) return;
        js += generateGroupChildCreation(fc, co, obj.id);
      });
    }
  }

  return js;
};

/**
 * Generate a single child element inside a group.
 */
const generateGroupChildCreation = (fc, childObj, parentId) => {
  const rl = fc.left || 0;
  const rt = fc.top || 0;
  const sx = fc.scaleX || 1;
  const sy = fc.scaleY || 1;
  const an = fc.angle || 0;
  let js = '';

  if (fc.type === 'path') {
    const ps = fabricPathToSVGPath(fc.path);
    const poX = fc.pathOffset?.x || 0;
    const poY = fc.pathOffset?.y || 0;
    js += `    (function() {\n`;
    js += `        var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');\n`;
    js += `        s.style.position = 'absolute';\n`;
    js += `        s.style.overflow = 'visible';\n`;
    js += `        s.style.pointerEvents = 'none';\n`;
    js += `        s.setAttribute('width', '1');\n`;
    js += `        s.setAttribute('height', '1');\n`;
    js += `        var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');\n`;
    js += `        g.setAttribute('transform', 'translate(${(rl - poX * sx).toFixed(2)}, ${(rt - poY * sy).toFixed(2)}) scale(${sx}, ${sy})');\n`;
    js += `        var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');\n`;
    js += `        p.setAttribute('d', '${ps}');\n`;
    js += `        p.setAttribute('stroke', '${fc.stroke || '#000'}');\n`;
    js += `        p.setAttribute('stroke-width', '${fc.strokeWidth || 3}');\n`;
    js += `        p.setAttribute('fill', 'none');\n`;
    js += `        p.setAttribute('stroke-linecap', 'round');\n`;
    js += `        p.setAttribute('stroke-linejoin', 'round');\n`;
    js += `        g.appendChild(p);\n`;
    js += `        s.appendChild(g);\n`;
    js += `        ${parentId}.appendChild(s);\n`;
    js += `    })();\n\n`;
  } else {
    const fill = childObj.fill || fc.fill;
    let cw = 100;
    let ch = 100;

    js += `    const ${fc.id} = document.createElement('div');\n`;
    js += `    ${fc.id}.id = '${fc.id}';\n`;
    js += `    ${fc.id}.style.position = 'absolute';\n`;
    js += `    ${fc.id}.style.transformOrigin = 'center center';\n`;

    if (fc.type === 'rect' || fc.type === 'rectangle') {
      cw = (fc.width || 100) * sx;
      ch = (fc.height || 100) * sy;
      js += `    ${fc.id}.style.width = '${cw.toFixed(2)}px';\n`;
      js += `    ${fc.id}.style.height = '${ch.toFixed(2)}px';\n`;
      js += `    ${fc.id}.style.backgroundColor = '${fill || '#3b82f6'}';\n`;
    } else if (fc.type === 'circle') {
      const r = fc.radius || 50;
      cw = r * 2 * sx;
      ch = r * 2 * sy;
      js += `    ${fc.id}.style.width = '${cw.toFixed(2)}px';\n`;
      js += `    ${fc.id}.style.height = '${ch.toFixed(2)}px';\n`;
      js += `    ${fc.id}.style.borderRadius = '50%';\n`;
      js += `    ${fc.id}.style.backgroundColor = '${fill || '#ef4444'}';\n`;
    } else if (fc.type === 'text') {
      cw = (fc.width || 50) * sx;
      ch = (fc.height || 24) * sy;
      js += `    ${fc.id}.textContent = '${(fc.text || 'Text').replace(/'/g, "\\'")}';\n`;
      js += `    ${fc.id}.style.fontSize = '${((fc.fontSize || 24) * sy).toFixed(2)}px';\n`;
      js += `    ${fc.id}.style.color = '${fill || '#000'}';\n`;
      js += `    ${fc.id}.style.whiteSpace = 'nowrap';\n`;
    }

    js += `    ${fc.id}.style.left = '${(rl - cw / 2).toFixed(2)}px';\n`;
    js += `    ${fc.id}.style.top = '${(rt - ch / 2).toFixed(2)}px';\n`;
    if (an) {
      js += `    ${fc.id}.style.transform = 'rotate(${an}deg)';\n`;
    }
    js += `    ${parentId}.appendChild(${fc.id});\n\n`;
  }

  return js;
};

// ===================================================================
// Animation functions
// ===================================================================

/**
 * Standard animation — for shapes positioned with (left - anchor * size).
 * Used by: CSS shapes, SVG shapes, images.
 */
const generateStandardAnimation = (obj, objKfs, allNormalizedKfs, ew, eh) => {
  const ax = obj.anchorX ?? 0.5;
  const ay = obj.anchorY ?? 0.5;
  let js = '';

  for (let i = 1; i < objKfs.length; i++) {
    const prev = objKfs[i - 1];
    const curr = objKfs[i];
    const dur = (curr.time - prev.time).toFixed(2);
    const ease = mapEasingToGSAP(curr.easing || 'linear');
    const gs = findGlobalZSwapForSegment(allNormalizedKfs, prev.time, curr.time);

    js += `    tl.to('#${obj.id}', {\n`;
    js += `        duration: ${dur},\n`;
    js += `        left: '${(curr.properties.x - ax * ew).toFixed(2)}px',\n`;
    js += `        top: '${(curr.properties.y - ay * eh).toFixed(2)}px',\n`;
    js += `        scaleX: ${curr.properties.scaleX.toFixed(2)},\n`;
    js += `        scaleY: ${curr.properties.scaleY.toFixed(2)},\n`;
    js += `        rotation: ${curr.properties.rotation.toFixed(2)},\n`;
    js += `        opacity: ${curr.properties.opacity.toFixed(2)},\n`;
    js += `        ease: '${ease}'\n`;
    js += `    }, ${prev.time.toFixed(2)});\n`;

    js += generateZSwapCode(`#${obj.id}`, prev, curr, gs);
    js += generateFillAnimCode(obj.id, obj.type, prev, curr);
  }

  return js + '\n';
};

/**
 * Path-style animation — for elements positioned at direct (x, y) with wrapper.
 * Used by: freehand paths, deformed shapes, groups.
 * Also handles path morphing for deformed shapes.
 */
const generatePathStyleAnimation = (obj, objKfs, allNormalizedKfs) => {
  let js = '';

  for (let i = 1; i < objKfs.length; i++) {
    const prev = objKfs[i - 1];
    const curr = objKfs[i];
    const dur = (curr.time - prev.time).toFixed(2);
    const ease = mapEasingToGSAP(curr.easing || 'linear');
    const gs = findGlobalZSwapForSegment(allNormalizedKfs, prev.time, curr.time);

    js += `    tl.to('#${obj.id}', {\n`;
    js += `        duration: ${dur},\n`;
    js += `        left: '${curr.properties.x.toFixed(2)}px',\n`;
    js += `        top: '${curr.properties.y.toFixed(2)}px',\n`;
    js += `        scaleX: ${curr.properties.scaleX.toFixed(2)},\n`;
    js += `        scaleY: ${curr.properties.scaleY.toFixed(2)},\n`;
    js += `        rotation: ${curr.properties.rotation.toFixed(2)},\n`;
    js += `        opacity: ${curr.properties.opacity.toFixed(2)},\n`;
    js += `        ease: '${ease}'\n`;
    js += `    }, ${prev.time.toFixed(2)});\n`;

    js += generateZSwapCode(`#${obj.id}`, prev, curr, gs);

    // Fill color animation for deformed shapes
    if (obj.deformedPath) {
      const prevFill = prev.properties.fill;
      const currFill = curr.properties.fill;
      if (prevFill && currFill && prevFill !== currFill) {
        js += `    tl.to('#${obj.id} path', {\n`;
        js += `        duration: ${dur},\n`;
        js += `        attr: { fill: '${currFill}' },\n`;
        js += `        ease: '${ease}'\n`;
        js += `    }, ${prev.time.toFixed(2)});\n`;
      }
    }

    // Path morphing animation
    const prevPath = prev.properties?.deformedPath;
    const currPath = curr.properties?.deformedPath;
    if (prevPath && currPath && prevPath !== currPath) {
      js += `    // Path morphing: ${obj.name}\n`;
      js += `    (function() {\n`;
      js += `        var pathEl = document.querySelector('#${obj.id} path');\n`;
      js += `        var startD = '${escapeJSString(prevPath)}';\n`;
      js += `        var endD = '${escapeJSString(currPath)}';\n`;
      js += `        var progress = { t: 0 };\n`;
      js += `        tl.to(progress, {\n`;
      js += `            t: 1,\n`;
      js += `            duration: ${dur},\n`;
      js += `            ease: '${ease}',\n`;
      js += `            onUpdate: function() {\n`;
      js += `                pathEl.setAttribute('d', interpolatePaths(startD, endD, progress.t));\n`;
      js += `            }\n`;
      js += `        }, ${prev.time.toFixed(2)});\n`;
      js += `    })();\n`;
    }
  }

  return js + '\n';
};

// ===================================================================
// File download utilities
// ===================================================================

export const downloadFile = (filename, content) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const downloadAudioFile = (audioFile) => {
  if (!audioFile?.arrayBuffer) return;
  const ext = getAudioExtension(audioFile.fileName, audioFile.mimeType);
  const blob = arrayBufferToBlob(audioFile.arrayBuffer, audioFile.mimeType || 'audio/mpeg');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audio.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadAllFiles = (html, css, javascript, audioFile = null) => {
  downloadFile('index.html', html);
  setTimeout(() => downloadFile('style.css', css), 100);
  setTimeout(() => downloadFile('animation.js', javascript), 200);
  if (audioFile?.arrayBuffer) {
    setTimeout(() => downloadAudioFile(audioFile), 300);
  }
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};