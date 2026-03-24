/**
 * Code Generator — Produces standalone HTML/CSS/JS animation
 * Supports: all shapes, paths, groups, images (bitmap + vector), canvas bg, color animation, outlines, AUDIO with trim region
 */

import { normalizeKeyframeRotations, findSurroundingKeyframes } from './interpolation';
import { SVG_SHAPE_KEYS } from './shapeDefinitions';
import { parseSVGDimensions } from './imageTracer';
import { getAudioExtension, arrayBufferToBlob } from './audioUtils';

const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 800;

const fabricPathToSVGPath = (pathArray) => {
  if (!pathArray || !Array.isArray(pathArray)) return '';
  let s = '';
  pathArray.forEach(seg => { if (Array.isArray(seg)) s += seg[0] + ' ' + seg.slice(1).join(' ') + ' '; });
  return s.trim();
};

const findGlobalZSwapForSegment = (allNormalizedKfs, prevTime, currTime) => {
  const midTime = (prevTime + currTime) / 2; let globalSwap = null;
  for (const objId of Object.keys(allNormalizedKfs)) {
    const objKfs = allNormalizedKfs[objId]; if (!objKfs || objKfs.length < 2) continue;
    const { before, after } = findSurroundingKeyframes(objKfs, midTime);
    if (!before || !after || before === after) continue;
    if ((before.properties.zIndex ?? 0) === (after.properties.zIndex ?? 0)) continue;
    if (after.zSwapPoint !== undefined && after.zSwapPoint !== null) {
      if (globalSwap === null) globalSwap = after.zSwapPoint; else globalSwap = Math.min(globalSwap, after.zSwapPoint);
    }
  }
  return globalSwap ?? 0.5;
};

const generateZSwapCode = (selector, prev, curr, globalSwapPoint) => {
  const prevZ = prev.properties.zIndex ?? 0, currZ = curr.properties.zIndex ?? 0;
  if (prevZ === currZ) return '';
  const swapTime = prev.time + (curr.time - prev.time) * globalSwapPoint;
  return `    tl.set('${selector}', { zIndex: ${currZ} }, ${swapTime.toFixed(2)});\n`;
};

const generateFillAnimCode = (objId, objType, prev, curr) => {
  const prevFill = prev.properties.fill, currFill = curr.properties.fill;
  if (!prevFill || !currFill || prevFill === currFill) return '';
  const dur = (curr.time - prev.time).toFixed(2), ease = mapEasingToGSAP(curr.easing || 'linear'), time = prev.time.toFixed(2);
  if (objType === 'text') return `    tl.to('#${objId}', { duration: ${dur}, color: '${currFill}', ease: '${ease}' }, ${time});\n`;
  else if (SVG_SHAPE_KEYS.has(objType)) return `    tl.to('#${objId} path', { duration: ${dur}, attr: { fill: '${currFill}' }, ease: '${ease}' }, ${time});\n`;
  else return `    tl.to('#${objId}', { duration: ${dur}, backgroundColor: '${currFill}', ease: '${ease}' }, ${time});\n`;
};

const mapEasingToGSAP = (easing) => {
  const map = { 'linear':'none','easeInQuad':'power1.in','easeOutQuad':'power1.out','easeInOutQuad':'power1.inOut',
    'easeInCubic':'power2.in','easeOutCubic':'power2.out','easeInOutCubic':'power2.inOut',
    'easeInQuart':'power3.in','easeOutQuart':'power3.out','easeInOutQuart':'power3.inOut',
    'bounce':'bounce.out','elastic':'elastic.out' };
  return map[easing] || 'none';
};

const getDefaultFillColor = (type) => {
  switch (type) { case 'rectangle': case 'roundedRect': return '#3b82f6'; case 'circle': return '#ef4444'; case 'ellipse': return '#a855f7'; case 'text': return '#000000'; default: return '#000000'; }
};

const escapeJSString = (str) => str.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n').replace(/\r/g,'\\r');

/**
 * Generate the CSS outline/stroke declaration for a shape object.
 * Returns empty string if no outline is set.
 */
const getOutlineCSS = (obj) => {
  const ow = obj.outlineWidth || 0;
  const oc = obj.outlineColor || '#000000';
  if (ow <= 0) return '';
  if (obj.type === 'text') return `    -webkit-text-stroke: ${ow}px ${oc};\n    paint-order: stroke fill;\n`;
  return `    outline: ${ow}px solid ${oc};\n`;
};

/**
 * Generate SVG stroke attributes string for an SVG shape.
 * Returns empty string if no outline is set.
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

export const generateAnimationCode = (canvasObjects, keyframes, duration, loopPlayback = false, fabricCanvas = null, canvasBgColor = '#f0f0f0', audioFile = null, audioRegion = null) => {
  const html = generateHTML();
  const css = generateCSS(canvasObjects, keyframes, fabricCanvas, canvasBgColor);
  const javascript = generateJavaScript(canvasObjects, keyframes, duration, loopPlayback, fabricCanvas, audioFile, audioRegion);
  return { html, css, javascript };
};

// ===================================================================
// HTML
// ===================================================================
const generateHTML = () => `<!DOCTYPE html>
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

// ===================================================================
// CSS
// ===================================================================
const generateCSS = (canvasObjects, keyframes, fabricCanvas, canvasBgColor) => {
  let css = `/* Generated Animation Styles */\n\nbody {\n    margin: 0; padding: 0; overflow: hidden;\n    font-family: Arial, sans-serif;\n}\n\n#animation-container {\n    position: relative;\n    width: ${CANVAS_WIDTH}px; height: ${CANVAS_HEIGHT}px;\n    background-color: ${canvasBgColor};\n    margin: 20px auto; border: 1px solid #ccc; overflow: hidden;\n}\n\n`;
  const groupChildren = new Set();
  canvasObjects.forEach(obj => { if (obj.type === 'group' && obj.children) obj.children.forEach(c => groupChildren.add(c)); });
  canvasObjects.forEach(obj => {
    if (groupChildren.has(obj.id)) return;
    const rawKfs = keyframes[obj.id] || []; if (rawKfs.length === 0) return;
    if (obj.type === 'path' || obj.type === 'group' || obj.type === 'image' || SVG_SHAPE_KEYS.has(obj.type)) return;
    const objKfs = normalizeKeyframeRotations(rawKfs); const firstKf = objKfs[0]; const p = firstKf.properties;
    const ax=obj.anchorX??0.5,ay=obj.anchorY??0.5; let ew=100,eh=100; if(obj.type==='ellipse')eh=76;
    const fillColor = p.fill||obj.fill||getDefaultFillColor(obj.type);
    css += `#${obj.id} {\n    position: absolute;\n    left: ${(p.x-ax*ew).toFixed(2)}px;\n    top: ${(p.y-ay*eh).toFixed(2)}px;\n    transform-origin: ${(ax*100).toFixed(0)}% ${(ay*100).toFixed(0)}%;\n    opacity: ${p.opacity};\n    z-index: ${p.zIndex??0};\n`;
    if(obj.type==='rectangle') css+=`    width: 100px; height: 100px; background-color: ${fillColor};\n`;
    else if(obj.type==='circle') css+=`    width: 100px; height: 100px; border-radius: 50%; background-color: ${fillColor};\n`;
    else if(obj.type==='roundedRect') css+=`    width: 100px; height: 100px; border-radius: 16px; background-color: ${fillColor};\n`;
    else if(obj.type==='ellipse') css+=`    width: 100px; height: 76px; border-radius: 50%; background-color: ${fillColor};\n`;
    else if(obj.type==='text') css+=`    font-size: 24px; color: ${fillColor}; white-space: nowrap;\n`;
    // Add outline CSS if present
    css += getOutlineCSS(obj);
    css += `}\n\n`;
  });
  return css;
};

// ===================================================================
// JavaScript
// ===================================================================
const generateJavaScript = (canvasObjects, keyframes, duration, loopPlayback, fabricCanvas, audioFile, audioRegion) => {
  const repeatValue = loopPlayback ? -1 : 0;
  const hasAudio = !!audioFile;
  const audioFileName = hasAudio ? `audio.${getAudioExtension(audioFile.fileName, audioFile.mimeType)}` : null;

  const regionStart = audioRegion ? audioRegion.start : 0;
  const regionEnd = audioRegion ? audioRegion.end : (audioFile?.duration || duration);
  const regionDur = regionEnd - regionStart;

  let js = `// Generated Animation Code\n\ndocument.addEventListener('DOMContentLoaded', () => {\n    const container = document.getElementById('animation-container');\n    const tl = gsap.timeline({ repeat: ${repeatValue}, defaults: { duration: 1, ease: "power1.inOut" }${hasAudio ? ', paused: true' : ''} });\n    \n`;

  if (hasAudio) {
    js += `    // ===== AUDIO SETUP =====
    // Audio file: '${audioFileName}' — original quality, no transcoding.
    // Trim region: ${regionStart.toFixed(2)}s to ${regionEnd.toFixed(2)}s (${regionDur.toFixed(2)}s segment)
    const audio = new Audio('${audioFileName}');
    audio.preload = 'auto';
    audio.volume = 1;
    const AUDIO_REGION_START = ${regionStart.toFixed(3)};
    const AUDIO_REGION_END = ${regionEnd.toFixed(3)};
    const AUDIO_REGION_DUR = ${regionDur.toFixed(3)};
    const ANIM_DURATION = ${duration.toFixed(3)};
    
    // Map animation time to audio time (within the trim region)
    function animToAudioTime(t) {
        if (AUDIO_REGION_DUR <= 0 || ANIM_DURATION <= 0) return AUDIO_REGION_START;
        return AUDIO_REGION_START + (t / ANIM_DURATION) * AUDIO_REGION_DUR;
    }
    
    // Click-to-start overlay (browser autoplay policy)
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);cursor:pointer;z-index:9999;transition:opacity 0.3s;';
    overlay.innerHTML = '<div style="background:white;padding:16px 36px;border-radius:12px;font-family:Arial,sans-serif;font-size:18px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.15);user-select:none;">▶ Click to Play</div>';
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
  }

  const groupChildren = new Set();
  canvasObjects.forEach(obj => { if (obj.type==='group'&&obj.children) obj.children.forEach(c => groupChildren.add(c)); });
  const allNormalizedKfs = {};
  canvasObjects.forEach(obj => { if (groupChildren.has(obj.id)) return; const rawKfs = keyframes[obj.id]||[]; if (rawKfs.length===0) return; allNormalizedKfs[obj.id] = normalizeKeyframeRotations(rawKfs); });

  // Creation
  canvasObjects.forEach(obj => {
    const objKfs = allNormalizedKfs[obj.id]; if (!objKfs || objKfs.length===0 || groupChildren.has(obj.id)) return;
    const firstKf = objKfs[0];
    if(obj.type==='group') js += generateGroupCreation(obj,firstKf,canvasObjects,fabricCanvas);
    else if(obj.type==='path') js += generatePathCreation(obj,firstKf,fabricCanvas);
    else if(obj.type==='image') js += generateImageCreation(obj,firstKf);
    else if(SVG_SHAPE_KEYS.has(obj.type)) js += generateSvgShapeCreation(obj,firstKf);
    else js += generateRegularCreation(obj,firstKf);
  });

  // Animation
  canvasObjects.forEach(obj => {
    const objKfs = allNormalizedKfs[obj.id]; if (!objKfs || objKfs.length<2 || groupChildren.has(obj.id)) return;
    js += `    // Animate ${obj.name}\n`;
    if(obj.type==='path') js += generatePathAnimation(obj,objKfs,allNormalizedKfs);
    else if(obj.type==='group') js += generateGroupAnimation(obj,objKfs,allNormalizedKfs);
    else if(obj.type==='image') js += generateStandardAnimation(obj,objKfs,allNormalizedKfs,obj.imageWidth||100,obj.imageHeight||100);
    else if(SVG_SHAPE_KEYS.has(obj.type)) js += generateStandardAnimation(obj,objKfs,allNormalizedKfs,100,100);
    else { const eh = obj.type==='ellipse'?76:100; js += generateStandardAnimation(obj,objKfs,allNormalizedKfs,100,eh); }
  });

  if (!hasAudio) js += `    tl.play();\n`;
  js += `});\n`;
  return js;
};

// ===================================================================
// Creation helpers
// ===================================================================
const generateSvgShapeCreation = (obj,firstKf) => {
  const ax=obj.anchorX??0.5,ay=obj.anchorY??0.5,ew=100,eh=100,z=firstKf.properties.zIndex??0;
  const fillColor = firstKf.properties.fill||obj.fill||'#000000';
  const strokeAttr = getSvgStrokeAttr(obj);
  return `    // Create ${obj.name} (SVG Shape)\n    const ${obj.id} = document.createElement('div');\n    ${obj.id}.id = '${obj.id}';\n    ${obj.id}.style.position = 'absolute';\n    ${obj.id}.style.width = '${ew}px'; ${obj.id}.style.height = '${eh}px';\n    ${obj.id}.style.transformOrigin = '${(ax*100).toFixed(0)}% ${(ay*100).toFixed(0)}%';\n    ${obj.id}.style.left = '${(firstKf.properties.x-ax*ew).toFixed(2)}px';\n    ${obj.id}.style.top = '${(firstKf.properties.y-ay*eh).toFixed(2)}px';\n    ${obj.id}.style.zIndex = '${z}';\n    ${obj.id}.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%" style="display:block"><path d="${obj.svgPath}" fill="${fillColor}"${strokeAttr}/></svg>';\n    container.appendChild(${obj.id});\n    gsap.set(${obj.id}, { scaleX: ${firstKf.properties.scaleX.toFixed(2)}, scaleY: ${firstKf.properties.scaleY.toFixed(2)}, rotation: ${firstKf.properties.rotation.toFixed(2)}, opacity: ${firstKf.properties.opacity.toFixed(2)} });\n    \n`;
};

const generateImageCreation = (obj,firstKf) => { const ax=obj.anchorX??0.5,ay=obj.anchorY??0.5,ew=obj.imageWidth||100,eh=obj.imageHeight||100,z=firstKf.properties.zIndex??0; const useVector=obj.svgExportMode==='vector'&&obj.svgTracedData; if(useVector){const{width:traceW,height:traceH,innerSVG}=parseSVGDimensions(obj.svgTracedData);const escapedInner=escapeJSString(innerSVG);return `    // Create ${obj.name} (Vector SVG)\n    const ${obj.id} = document.createElement('div');\n    ${obj.id}.id = '${obj.id}';\n    ${obj.id}.style.position = 'absolute';\n    ${obj.id}.style.width = '${ew}px'; ${obj.id}.style.height = '${eh}px';\n    ${obj.id}.style.transformOrigin = '${(ax*100).toFixed(0)}% ${(ay*100).toFixed(0)}%';\n    ${obj.id}.style.left = '${(firstKf.properties.x-ax*ew).toFixed(2)}px';\n    ${obj.id}.style.top = '${(firstKf.properties.y-ay*eh).toFixed(2)}px';\n    ${obj.id}.style.zIndex = '${z}'; ${obj.id}.style.pointerEvents = 'none';\n    ${obj.id}.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${traceW} ${traceH}" width="${ew}" height="${eh}" preserveAspectRatio="none" style="display:block">${escapedInner}</svg>';\n    container.appendChild(${obj.id});\n    gsap.set(${obj.id}, { scaleX: ${firstKf.properties.scaleX.toFixed(2)}, scaleY: ${firstKf.properties.scaleY.toFixed(2)}, rotation: ${firstKf.properties.rotation.toFixed(2)}, opacity: ${firstKf.properties.opacity.toFixed(2)} });\n    \n`;} return `    // Create ${obj.name} (Bitmap Image)\n    const ${obj.id} = document.createElement('img');\n    ${obj.id}.id = '${obj.id}'; ${obj.id}.src = '${obj.imageDataURL}';\n    ${obj.id}.style.position = 'absolute'; ${obj.id}.style.width = '${ew}px'; ${obj.id}.style.height = '${eh}px';\n    ${obj.id}.style.transformOrigin = '${(ax*100).toFixed(0)}% ${(ay*100).toFixed(0)}%';\n    ${obj.id}.style.left = '${(firstKf.properties.x-ax*ew).toFixed(2)}px';\n    ${obj.id}.style.top = '${(firstKf.properties.y-ay*eh).toFixed(2)}px';\n    ${obj.id}.style.zIndex = '${z}'; ${obj.id}.style.pointerEvents = 'none';\n    container.appendChild(${obj.id});\n    gsap.set(${obj.id}, { scaleX: ${firstKf.properties.scaleX.toFixed(2)}, scaleY: ${firstKf.properties.scaleY.toFixed(2)}, rotation: ${firstKf.properties.rotation.toFixed(2)}, opacity: ${firstKf.properties.opacity.toFixed(2)} });\n    \n`; };

const generateRegularCreation = (obj,firstKf) => {
  const ax=obj.anchorX??0.5,ay=obj.anchorY??0.5;let ew=100,eh=100;if(obj.type==='ellipse')eh=76;
  const fillColor = firstKf.properties.fill||obj.fill||getDefaultFillColor(obj.type);
  const z=firstKf.properties.zIndex??0;
  const ow = obj.outlineWidth || 0;
  const oc = obj.outlineColor || '#000000';
  let js=`    // Create ${obj.name}\n    const ${obj.id} = document.createElement('div');\n    ${obj.id}.id = '${obj.id}'; ${obj.id}.style.position = 'absolute';\n    ${obj.id}.style.transformOrigin = '${(ax*100).toFixed(0)}% ${(ay*100).toFixed(0)}%';\n    ${obj.id}.style.left = '${(firstKf.properties.x-ax*ew).toFixed(2)}px';\n    ${obj.id}.style.top = '${(firstKf.properties.y-ay*eh).toFixed(2)}px';\n    ${obj.id}.style.zIndex = '${z}';\n`;
  if(obj.type==='rectangle') js+=`    ${obj.id}.style.width = '100px'; ${obj.id}.style.height = '100px'; ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
  else if(obj.type==='circle') js+=`    ${obj.id}.style.width = '100px'; ${obj.id}.style.height = '100px'; ${obj.id}.style.borderRadius = '50%'; ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
  else if(obj.type==='roundedRect') js+=`    ${obj.id}.style.width = '100px'; ${obj.id}.style.height = '100px'; ${obj.id}.style.borderRadius = '16px'; ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
  else if(obj.type==='ellipse') js+=`    ${obj.id}.style.width = '100px'; ${obj.id}.style.height = '76px'; ${obj.id}.style.borderRadius = '50%'; ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
  else if(obj.type==='text') js+=`    ${obj.id}.textContent = '${(obj.textContent||'Text').replace(/'/g,"\\'")}';\n    ${obj.id}.style.fontSize = '24px'; ${obj.id}.style.color = '${fillColor}'; ${obj.id}.style.whiteSpace = 'nowrap';\n`;
  // Add outline styles if present
  if (ow > 0) {
    if (obj.type === 'text') {
      js += `    ${obj.id}.style.webkitTextStroke = '${ow}px ${oc}'; ${obj.id}.style.paintOrder = 'stroke fill';\n`;
    } else {
      js += `    ${obj.id}.style.outline = '${ow}px solid ${oc}';\n`;
    }
  }
  js+=`    container.appendChild(${obj.id});\n    gsap.set(${obj.id}, { scaleX: ${firstKf.properties.scaleX.toFixed(2)}, scaleY: ${firstKf.properties.scaleY.toFixed(2)}, rotation: ${firstKf.properties.rotation.toFixed(2)}, opacity: ${firstKf.properties.opacity.toFixed(2)} });\n    \n`;
  return js;
};

// Animation helpers
const generateStandardAnimation = (obj,objKfs,allNormalizedKfs,ew,eh) => { const ax=obj.anchorX??0.5,ay=obj.anchorY??0.5;let js=''; for(let i=1;i<objKfs.length;i++){const prev=objKfs[i-1],curr=objKfs[i];const gs=findGlobalZSwapForSegment(allNormalizedKfs,prev.time,curr.time); js+=`    tl.to('#${obj.id}', { duration: ${(curr.time-prev.time).toFixed(2)}, left: '${(curr.properties.x-ax*ew).toFixed(2)}px', top: '${(curr.properties.y-ay*eh).toFixed(2)}px', scaleX: ${curr.properties.scaleX.toFixed(2)}, scaleY: ${curr.properties.scaleY.toFixed(2)}, rotation: ${curr.properties.rotation.toFixed(2)}, opacity: ${curr.properties.opacity.toFixed(2)}, ease: '${mapEasingToGSAP(curr.easing||'linear')}' }, ${prev.time.toFixed(2)});\n`; js+=generateZSwapCode(`#${obj.id}`,prev,curr,gs); js+=generateFillAnimCode(obj.id,obj.type,prev,curr);} return js+'    \n'; };
const generatePathCreation = (obj,firstKf,fabricCanvas) => { const pathString=fabricPathToSVGPath(obj.pathData);const fo=fabricCanvas?.getObjects().find(o=>o.id===obj.id);const poX=fo?.pathOffset?.x||firstKf.properties.pathOffsetX||0,poY=fo?.pathOffset?.y||firstKf.properties.pathOffsetY||0;const w=fo?.width||obj.width||0,h=fo?.height||obj.height||0;const ax=obj.anchorX??0.5,ay=obj.anchorY??0.5;const tx=poX+(ax-0.5)*w,ty=poY+(ay-0.5)*h;const z=firstKf.properties.zIndex??0,wid=obj.id;let js=`    // Create ${obj.name} (SVG Path with wrapper)\n    const ${wid} = document.createElement('div');\n    ${wid}.id = '${wid}';\n    ${wid}.style.position = 'absolute';\n    ${wid}.style.left = '${firstKf.properties.x.toFixed(2)}px';\n    ${wid}.style.top = '${firstKf.properties.y.toFixed(2)}px';\n    ${wid}.style.width = '0px'; ${wid}.style.height = '0px'; ${wid}.style.overflow = 'visible';\n    ${wid}.style.transformOrigin = '0px 0px';\n    ${wid}.style.zIndex = '${z}';\n`;if(obj.fills?.length>0){obj.fills.forEach((fill,idx)=>{const al=fill.relLeft-(ax-0.5)*w,at=fill.relTop-(ay-0.5)*h;js+=`    var fi${idx} = document.createElement('img'); fi${idx}.src = '${fill.dataURL}';\n    fi${idx}.style.position = 'absolute'; fi${idx}.style.left = '${al.toFixed(2)}px'; fi${idx}.style.top = '${at.toFixed(2)}px';\n    fi${idx}.style.width = '${fill.width}px'; fi${idx}.style.height = '${fill.height}px'; fi${idx}.style.pointerEvents = 'none'; fi${idx}.style.imageRendering = 'pixelated';\n    ${wid}.appendChild(fi${idx});\n`;});}js+=`    var svg_${wid} = document.createElementNS('http://www.w3.org/2000/svg', 'svg');\n    svg_${wid}.style.position = 'absolute'; svg_${wid}.style.left = '0px'; svg_${wid}.style.top = '0px'; svg_${wid}.style.overflow = 'visible'; svg_${wid}.style.pointerEvents = 'none';\n    svg_${wid}.setAttribute('width', '1'); svg_${wid}.setAttribute('height', '1');\n    var g_${wid} = document.createElementNS('http://www.w3.org/2000/svg', 'g');\n    g_${wid}.setAttribute('transform', 'translate(${(-tx).toFixed(2)}, ${(-ty).toFixed(2)})');\n    var p_${wid} = document.createElementNS('http://www.w3.org/2000/svg', 'path');\n    p_${wid}.setAttribute('d', '${pathString}'); p_${wid}.setAttribute('stroke', '${obj.strokeColor||'#000'}'); p_${wid}.setAttribute('stroke-width', '${obj.strokeWidth||3}');\n    p_${wid}.setAttribute('fill', 'none'); p_${wid}.setAttribute('stroke-linecap', 'round'); p_${wid}.setAttribute('stroke-linejoin', 'round');\n    g_${wid}.appendChild(p_${wid}); svg_${wid}.appendChild(g_${wid}); ${wid}.appendChild(svg_${wid});\n    container.appendChild(${wid});\n    gsap.set(${wid}, { scaleX: ${firstKf.properties.scaleX.toFixed(2)}, scaleY: ${firstKf.properties.scaleY.toFixed(2)}, rotation: ${firstKf.properties.rotation.toFixed(2)}, opacity: ${firstKf.properties.opacity.toFixed(2)} });\n    \n`;return js; };
const generatePathAnimation = (obj,objKfs,allNormalizedKfs) => { let js='';for(let i=1;i<objKfs.length;i++){const prev=objKfs[i-1],curr=objKfs[i];const gs=findGlobalZSwapForSegment(allNormalizedKfs,prev.time,curr.time);js+=`    tl.to('#${obj.id}', { duration: ${(curr.time-prev.time).toFixed(2)}, left: '${curr.properties.x.toFixed(2)}px', top: '${curr.properties.y.toFixed(2)}px', scaleX: ${curr.properties.scaleX.toFixed(2)}, scaleY: ${curr.properties.scaleY.toFixed(2)}, rotation: ${curr.properties.rotation.toFixed(2)}, opacity: ${curr.properties.opacity.toFixed(2)}, ease: '${mapEasingToGSAP(curr.easing||'linear')}' }, ${prev.time.toFixed(2)});\n`;js+=generateZSwapCode(`#${obj.id}`,prev,curr,gs);}return js+'    \n'; };
const generateGroupCreation = (obj,firstKf,canvasObjects,fabricCanvas) => { const z=firstKf.properties.zIndex??0;let js=`    // Create ${obj.name} (Group)\n    const ${obj.id} = document.createElement('div');\n    ${obj.id}.id = '${obj.id}'; ${obj.id}.style.position = 'absolute';\n    ${obj.id}.style.left = '${firstKf.properties.x.toFixed(2)}px'; ${obj.id}.style.top = '${firstKf.properties.y.toFixed(2)}px';\n    ${obj.id}.style.width = '0px'; ${obj.id}.style.height = '0px'; ${obj.id}.style.overflow = 'visible'; ${obj.id}.style.transformOrigin = '0px 0px';\n    ${obj.id}.style.zIndex = '${z}';\n    container.appendChild(${obj.id});\n    gsap.set(${obj.id}, { scaleX: ${firstKf.properties.scaleX.toFixed(2)}, scaleY: ${firstKf.properties.scaleY.toFixed(2)}, rotation: ${firstKf.properties.rotation.toFixed(2)}, opacity: ${firstKf.properties.opacity.toFixed(2)} });\n    \n`;if(obj.children&&fabricCanvas){const fg=fabricCanvas.getObjects().find(o=>o.id===obj.id);if(fg?._objects){fg._objects.forEach(fc=>{const co=canvasObjects.find(o=>o.id===fc.id);if(!co)return;const rl=fc.left||0,rt=fc.top||0,sx=fc.scaleX||1,sy=fc.scaleY||1,an=fc.angle||0;if(fc.type==='path'){const ps=fabricPathToSVGPath(fc.path);const poX=fc.pathOffset?.x||0,poY=fc.pathOffset?.y||0;js+=`    (function(){ var s = document.createElementNS('http://www.w3.org/2000/svg','svg'); s.style.position='absolute'; s.style.left='0'; s.style.top='0'; s.style.overflow='visible'; s.style.pointerEvents='none'; s.setAttribute('width','1'); s.setAttribute('height','1'); var g = document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('transform','translate(${(rl-poX*sx).toFixed(2)},${(rt-poY*sy).toFixed(2)}) scale(${sx},${sy})'); var p = document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d','${ps}'); p.setAttribute('stroke','${fc.stroke||'#000'}'); p.setAttribute('stroke-width','${fc.strokeWidth||3}'); p.setAttribute('fill','none'); p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round'); g.appendChild(p); s.appendChild(g); ${obj.id}.appendChild(s); })();\n    \n`;}else{const fill=co.fill||fc.fill;let cw=100,ch=100;js+=`    const ${fc.id} = document.createElement('div'); ${fc.id}.id = '${fc.id}'; ${fc.id}.style.position = 'absolute'; ${fc.id}.style.transformOrigin = 'center center';\n`;if(fc.type==='rect'||fc.type==='rectangle'){cw=(fc.width||100)*sx;ch=(fc.height||100)*sy;js+=`    ${fc.id}.style.width = '${cw.toFixed(2)}px'; ${fc.id}.style.height = '${ch.toFixed(2)}px'; ${fc.id}.style.backgroundColor = '${fill||'#3b82f6'}';\n`;}else if(fc.type==='circle'){const r=fc.radius||50;cw=r*2*sx;ch=r*2*sy;js+=`    ${fc.id}.style.width = '${cw.toFixed(2)}px'; ${fc.id}.style.height = '${ch.toFixed(2)}px'; ${fc.id}.style.borderRadius = '50%'; ${fc.id}.style.backgroundColor = '${fill||'#ef4444'}';\n`;}else if(fc.type==='text'){cw=(fc.width||50)*sx;ch=(fc.height||24)*sy;js+=`    ${fc.id}.textContent = '${(fc.text||'Text').replace(/'/g,"\\'")}'; ${fc.id}.style.fontSize = '${((fc.fontSize||24)*sy).toFixed(2)}px'; ${fc.id}.style.color = '${fill||'#000'}'; ${fc.id}.style.whiteSpace = 'nowrap';\n`;}js+=`    ${fc.id}.style.left = '${(rl-cw/2).toFixed(2)}px'; ${fc.id}.style.top = '${(rt-ch/2).toFixed(2)}px';\n`;if(an)js+=`    ${fc.id}.style.transform = 'rotate(${an}deg)';\n`;js+=`    ${obj.id}.appendChild(${fc.id});\n    \n`;}});}}return js; };
const generateGroupAnimation = (obj,objKfs,allNormalizedKfs) => { let js='';for(let i=1;i<objKfs.length;i++){const prev=objKfs[i-1],curr=objKfs[i];const gs=findGlobalZSwapForSegment(allNormalizedKfs,prev.time,curr.time);js+=`    tl.to('#${obj.id}', { duration: ${(curr.time-prev.time).toFixed(2)}, left: '${curr.properties.x.toFixed(2)}px', top: '${curr.properties.y.toFixed(2)}px', scaleX: ${curr.properties.scaleX.toFixed(2)}, scaleY: ${curr.properties.scaleY.toFixed(2)}, rotation: ${curr.properties.rotation.toFixed(2)}, opacity: ${curr.properties.opacity.toFixed(2)}, ease: '${mapEasingToGSAP(curr.easing||'linear')}' }, ${prev.time.toFixed(2)});\n`;js+=generateZSwapCode(`#${obj.id}`,prev,curr,gs);}return js+'    \n'; };

// ===================================================================
// File download utilities
// ===================================================================
export const downloadFile = (filename, content) => { const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); };
const downloadAudioFile = (audioFile) => { if (!audioFile?.arrayBuffer) return; const ext = getAudioExtension(audioFile.fileName, audioFile.mimeType); const blob = arrayBufferToBlob(audioFile.arrayBuffer, audioFile.mimeType || 'audio/mpeg'); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `audio.${ext}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); };
export const downloadAllFiles = (html, css, javascript, audioFile = null) => { downloadFile('index.html', html); setTimeout(() => downloadFile('style.css', css), 100); setTimeout(() => downloadFile('animation.js', javascript), 200); if (audioFile?.arrayBuffer) { setTimeout(() => downloadAudioFile(audioFile), 300); } };
export const copyToClipboard = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch (err) { console.error('Failed to copy:', err); return false; } };