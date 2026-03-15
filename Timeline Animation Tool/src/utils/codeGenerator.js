import { normalizeKeyframeRotations, findSurroundingKeyframes } from './interpolation';
import { SVG_SHAPE_KEYS } from './shapeDefinitions';

const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 800;

const fabricPathToSVGPath = (pathArray) => {
  if (!pathArray || !Array.isArray(pathArray)) return '';
  let s = '';
  pathArray.forEach(seg => { if (Array.isArray(seg)) s += seg[0] + ' ' + seg.slice(1).join(' ') + ' '; });
  return s.trim();
};

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
      if (globalSwap === null) globalSwap = after.zSwapPoint;
      else globalSwap = Math.min(globalSwap, after.zSwapPoint);
    }
  }
  return globalSwap ?? 0.5;
};

const generateZSwapCode = (selector, prev, curr, globalSwapPoint) => {
  const prevZ = prev.properties.zIndex ?? 0;
  const currZ = curr.properties.zIndex ?? 0;
  if (prevZ === currZ) return '';
  const swapTime = prev.time + (curr.time - prev.time) * globalSwapPoint;
  return `    tl.set('${selector}', { zIndex: ${currZ} }, ${swapTime.toFixed(2)});\n`;
};

const mapEasingToGSAP = (easing) => {
  const map = { 'linear': 'none', 'easeInQuad': 'power1.in', 'easeOutQuad': 'power1.out', 'easeInOutQuad': 'power1.inOut', 'easeInCubic': 'power2.in', 'easeOutCubic': 'power2.out', 'easeInOutCubic': 'power2.inOut', 'easeInQuart': 'power3.in', 'easeOutQuart': 'power3.out', 'easeInOutQuart': 'power3.inOut', 'bounce': 'bounce.out', 'elastic': 'elastic.out' };
  return map[easing] || 'none';
};

const getDefaultFillColor = (type) => {
  switch (type) {
    case 'rectangle': case 'roundedRect': return '#3b82f6';
    case 'circle': return '#ef4444';
    case 'ellipse': return '#a855f7';
    case 'text': return '#000000';
    default: return '#000000';
  }
};

export const generateAnimationCode = (canvasObjects, keyframes, duration, loopPlayback = false, fabricCanvas = null, canvasBgColor = '#f0f0f0') => {
  const html = generateHTML();
  const css = generateCSS(canvasObjects, keyframes, fabricCanvas, canvasBgColor);
  const javascript = generateJavaScript(canvasObjects, keyframes, duration, loopPlayback, fabricCanvas);
  return { html, css, javascript };
};

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

const generateCSS = (canvasObjects, keyframes, fabricCanvas, canvasBgColor) => {
  let css = `/* Generated Animation Styles */\n\nbody {\n    margin: 0; padding: 0; overflow: hidden;\n    font-family: Arial, sans-serif;\n}\n\n#animation-container {\n    position: relative;\n    width: ${CANVAS_WIDTH}px; height: ${CANVAS_HEIGHT}px;\n    background-color: ${canvasBgColor};\n    margin: 20px auto; border: 1px solid #ccc; overflow: hidden;\n}\n\n`;
  const groupChildren = new Set();
  canvasObjects.forEach(obj => { if (obj.type === 'group' && obj.children) obj.children.forEach(c => groupChildren.add(c)); });
  canvasObjects.forEach(obj => {
    if (groupChildren.has(obj.id)) return;
    const rawKfs = keyframes[obj.id] || [];
    if (rawKfs.length === 0) return;
    if (obj.type === 'path' || obj.type === 'group' || obj.type === 'image' || SVG_SHAPE_KEYS.has(obj.type)) return;
    const objKfs = normalizeKeyframeRotations(rawKfs);
    const firstKf = objKfs[0]; const p = firstKf.properties;
    const ax = obj.anchorX ?? 0.5, ay = obj.anchorY ?? 0.5;
    let ew = 100, eh = 100; if (obj.type === 'ellipse') eh = 76;
    const fillColor = obj.fill || getDefaultFillColor(obj.type);
    css += `#${obj.id} {\n    position: absolute;\n    left: ${(p.x - ax * ew).toFixed(2)}px;\n    top: ${(p.y - ay * eh).toFixed(2)}px;\n    transform-origin: ${(ax * 100).toFixed(0)}% ${(ay * 100).toFixed(0)}%;\n    opacity: ${p.opacity};\n    z-index: ${p.zIndex ?? 0};\n`;
    if (obj.type === 'rectangle') css += `    width: 100px; height: 100px; background-color: ${fillColor};\n`;
    else if (obj.type === 'circle') css += `    width: 100px; height: 100px; border-radius: 50%; background-color: ${fillColor};\n`;
    else if (obj.type === 'roundedRect') css += `    width: 100px; height: 100px; border-radius: 16px; background-color: ${fillColor};\n`;
    else if (obj.type === 'ellipse') css += `    width: 100px; height: 76px; border-radius: 50%; background-color: ${fillColor};\n`;
    else if (obj.type === 'text') css += `    font-size: 24px; color: ${fillColor}; white-space: nowrap;\n`;
    css += `}\n\n`;
  });
  return css;
};

const generateJavaScript = (canvasObjects, keyframes, duration, loopPlayback, fabricCanvas) => {
  const repeatValue = loopPlayback ? -1 : 0;
  let js = `// Generated Animation Code\n\ndocument.addEventListener('DOMContentLoaded', () => {\n    const container = document.getElementById('animation-container');\n    const tl = gsap.timeline({ repeat: ${repeatValue}, defaults: { duration: 1, ease: "power1.inOut" } });\n    \n`;
  const groupChildren = new Set();
  canvasObjects.forEach(obj => { if (obj.type === 'group' && obj.children) obj.children.forEach(c => groupChildren.add(c)); });
  const allNormalizedKfs = {};
  canvasObjects.forEach(obj => { if (groupChildren.has(obj.id)) return; const rawKfs = keyframes[obj.id] || []; if (rawKfs.length === 0) return; allNormalizedKfs[obj.id] = normalizeKeyframeRotations(rawKfs); });
  canvasObjects.forEach(obj => {
    const objKfs = allNormalizedKfs[obj.id];
    if (!objKfs || objKfs.length === 0 || groupChildren.has(obj.id)) return;
    const firstKf = objKfs[0];
    if (obj.type === 'group') js += generateGroupCreation(obj, firstKf, canvasObjects, fabricCanvas);
    else if (obj.type === 'path') js += generatePathCreation(obj, firstKf, fabricCanvas);
    else if (obj.type === 'image') js += generateImageCreation(obj, firstKf);
    else if (SVG_SHAPE_KEYS.has(obj.type)) js += generateSvgShapeCreation(obj, firstKf);
    else js += generateRegularCreation(obj, firstKf);
  });
  canvasObjects.forEach(obj => {
    const objKfs = allNormalizedKfs[obj.id];
    if (!objKfs || objKfs.length < 2 || groupChildren.has(obj.id)) return;
    js += `    // Animate ${obj.name}\n`;
    if (obj.type === 'path') js += generatePathAnimation(obj, objKfs, allNormalizedKfs);
    else if (obj.type === 'group') js += generateGroupAnimation(obj, objKfs, allNormalizedKfs);
    else if (obj.type === 'image') js += generateStandardAnimation(obj, objKfs, allNormalizedKfs, obj.imageWidth || 100, obj.imageHeight || 100);
    else if (SVG_SHAPE_KEYS.has(obj.type)) js += generateStandardAnimation(obj, objKfs, allNormalizedKfs, 100, 100);
    else { const eh = obj.type === 'ellipse' ? 76 : 100; js += generateStandardAnimation(obj, objKfs, allNormalizedKfs, 100, eh); }
  });
  js += `    tl.play();\n});\n`;
  return js;
};

const generateSvgShapeCreation = (obj, firstKf) => {
  const ax = obj.anchorX ?? 0.5, ay = obj.anchorY ?? 0.5, ew = 100, eh = 100, z = firstKf.properties.zIndex ?? 0;
  const fillColor = obj.fill || '#000000';
  return `    const ${obj.id} = document.createElement('div');\n    ${obj.id}.id = '${obj.id}';\n    ${obj.id}.style.position = 'absolute'; ${obj.id}.style.width = '${ew}px'; ${obj.id}.style.height = '${eh}px';\n    ${obj.id}.style.transformOrigin = '${(ax*100).toFixed(0)}% ${(ay*100).toFixed(0)}%';\n    ${obj.id}.style.left = '${(firstKf.properties.x - ax*ew).toFixed(2)}px'; ${obj.id}.style.top = '${(firstKf.properties.y - ay*eh).toFixed(2)}px';\n    ${obj.id}.style.zIndex = '${z}';\n    ${obj.id}.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%" style="display:block"><path d="${obj.svgPath}" fill="${fillColor}"/></svg>';\n    container.appendChild(${obj.id});\n    gsap.set(${obj.id}, { scaleX: ${firstKf.properties.scaleX.toFixed(2)}, scaleY: ${firstKf.properties.scaleY.toFixed(2)}, rotation: ${firstKf.properties.rotation.toFixed(2)}, opacity: ${firstKf.properties.opacity.toFixed(2)} });\n    \n`;
};

const generateImageCreation = (obj, firstKf) => {
  const ax = obj.anchorX ?? 0.5, ay = obj.anchorY ?? 0.5, ew = obj.imageWidth || 100, eh = obj.imageHeight || 100, z = firstKf.properties.zIndex ?? 0;
  return `    const ${obj.id} = document.createElement('img');\n    ${obj.id}.id = '${obj.id}'; ${obj.id}.src = '${obj.imageDataURL}';\n    ${obj.id}.style.position = 'absolute'; ${obj.id}.style.width = '${ew}px'; ${obj.id}.style.height = '${eh}px';\n    ${obj.id}.style.transformOrigin = '${(ax*100).toFixed(0)}% ${(ay*100).toFixed(0)}%';\n    ${obj.id}.style.left = '${(firstKf.properties.x - ax*ew).toFixed(2)}px'; ${obj.id}.style.top = '${(firstKf.properties.y - ay*eh).toFixed(2)}px';\n    ${obj.id}.style.zIndex = '${z}'; ${obj.id}.style.pointerEvents = 'none';\n    container.appendChild(${obj.id});\n    gsap.set(${obj.id}, { scaleX: ${firstKf.properties.scaleX.toFixed(2)}, scaleY: ${firstKf.properties.scaleY.toFixed(2)}, rotation: ${firstKf.properties.rotation.toFixed(2)}, opacity: ${firstKf.properties.opacity.toFixed(2)} });\n    \n`;
};

const generateRegularCreation = (obj, firstKf) => {
  const ax = obj.anchorX ?? 0.5, ay = obj.anchorY ?? 0.5;
  let ew = 100, eh = 100; if (obj.type === 'ellipse') eh = 76;
  const fillColor = obj.fill || getDefaultFillColor(obj.type); const z = firstKf.properties.zIndex ?? 0;
  let js = `    const ${obj.id} = document.createElement('div');\n    ${obj.id}.id = '${obj.id}'; ${obj.id}.style.position = 'absolute';\n    ${obj.id}.style.transformOrigin = '${(ax*100).toFixed(0)}% ${(ay*100).toFixed(0)}%';\n    ${obj.id}.style.left = '${(firstKf.properties.x - ax*ew).toFixed(2)}px'; ${obj.id}.style.top = '${(firstKf.properties.y - ay*eh).toFixed(2)}px';\n    ${obj.id}.style.zIndex = '${z}';\n`;
  if (obj.type === 'rectangle') js += `    ${obj.id}.style.width = '100px'; ${obj.id}.style.height = '100px'; ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
  else if (obj.type === 'circle') js += `    ${obj.id}.style.width = '100px'; ${obj.id}.style.height = '100px'; ${obj.id}.style.borderRadius = '50%'; ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
  else if (obj.type === 'roundedRect') js += `    ${obj.id}.style.width = '100px'; ${obj.id}.style.height = '100px'; ${obj.id}.style.borderRadius = '16px'; ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
  else if (obj.type === 'ellipse') js += `    ${obj.id}.style.width = '100px'; ${obj.id}.style.height = '76px'; ${obj.id}.style.borderRadius = '50%'; ${obj.id}.style.backgroundColor = '${fillColor}';\n`;
  else if (obj.type === 'text') js += `    ${obj.id}.textContent = '${(obj.textContent || 'Text').replace(/'/g, "\\'")}';\n    ${obj.id}.style.fontSize = '24px'; ${obj.id}.style.color = '${fillColor}'; ${obj.id}.style.whiteSpace = 'nowrap';\n`;
  js += `    container.appendChild(${obj.id});\n    gsap.set(${obj.id}, { scaleX: ${firstKf.properties.scaleX.toFixed(2)}, scaleY: ${firstKf.properties.scaleY.toFixed(2)}, rotation: ${firstKf.properties.rotation.toFixed(2)}, opacity: ${firstKf.properties.opacity.toFixed(2)} });\n    \n`;
  return js;
};

const generateStandardAnimation = (obj, objKfs, allNormalizedKfs, ew, eh) => {
  const ax = obj.anchorX ?? 0.5, ay = obj.anchorY ?? 0.5;
  let js = '';
  for (let i = 1; i < objKfs.length; i++) {
    const prev = objKfs[i - 1], curr = objKfs[i];
    const gs = findGlobalZSwapForSegment(allNormalizedKfs, prev.time, curr.time);
    js += `    tl.to('#${obj.id}', { duration: ${(curr.time - prev.time).toFixed(2)}, left: '${(curr.properties.x - ax * ew).toFixed(2)}px', top: '${(curr.properties.y - ay * eh).toFixed(2)}px', scaleX: ${curr.properties.scaleX.toFixed(2)}, scaleY: ${curr.properties.scaleY.toFixed(2)}, rotation: ${curr.properties.rotation.toFixed(2)}, opacity: ${curr.properties.opacity.toFixed(2)}, ease: '${mapEasingToGSAP(curr.easing || 'linear')}' }, ${prev.time.toFixed(2)});\n`;
    js += generateZSwapCode(`#${obj.id}`, prev, curr, gs);
  }
  return js + '    \n';
};

const generatePathCreation = (obj, firstKf, fabricCanvas) => {
  const pathString = fabricPathToSVGPath(obj.pathData);
  const fo = fabricCanvas?.getObjects().find(o => o.id === obj.id);
  const poX = fo?.pathOffset?.x || firstKf.properties.pathOffsetX || 0;
  const poY = fo?.pathOffset?.y || firstKf.properties.pathOffsetY || 0;
  const w = fo?.width || firstKf.properties.width || obj.width || 0;
  const h = fo?.height || firstKf.properties.height || obj.height || 0;
  const ax = obj.anchorX ?? 0.5, ay = obj.anchorY ?? 0.5;
  const tx = poX + (ax - 0.5) * w, ty = poY + (ay - 0.5) * h;
  const z = firstKf.properties.zIndex ?? 0; const wid = obj.id;
  let js = `    const ${wid} = document.createElement('div');\n    ${wid}.id = '${wid}'; ${wid}.style.position = 'absolute';\n    ${wid}.style.left = '${firstKf.properties.x.toFixed(2)}px'; ${wid}.style.top = '${firstKf.properties.y.toFixed(2)}px';\n    ${wid}.style.width = '0px'; ${wid}.style.height = '0px'; ${wid}.style.overflow = 'visible';\n    ${wid}.style.transformOrigin = '0px 0px'; ${wid}.style.zIndex = '${z}';\n`;
  if (obj.fills?.length > 0) {
    obj.fills.forEach((fill, idx) => {
      const al = fill.relLeft - (ax - 0.5) * w, at = fill.relTop - (ay - 0.5) * h;
      js += `    var fi${idx} = document.createElement('img'); fi${idx}.src = '${fill.dataURL}';\n    fi${idx}.style.position = 'absolute'; fi${idx}.style.left = '${al.toFixed(2)}px'; fi${idx}.style.top = '${at.toFixed(2)}px';\n    fi${idx}.style.width = '${fill.width}px'; fi${idx}.style.height = '${fill.height}px'; fi${idx}.style.pointerEvents = 'none'; fi${idx}.style.imageRendering = 'pixelated';\n    ${wid}.appendChild(fi${idx});\n`;
    });
  }
  js += `    var svg_${wid} = document.createElementNS('http://www.w3.org/2000/svg', 'svg');\n    svg_${wid}.style.position = 'absolute'; svg_${wid}.style.left = '0px'; svg_${wid}.style.top = '0px'; svg_${wid}.style.overflow = 'visible'; svg_${wid}.style.pointerEvents = 'none';\n    svg_${wid}.setAttribute('width', '1'); svg_${wid}.setAttribute('height', '1');\n    var g_${wid} = document.createElementNS('http://www.w3.org/2000/svg', 'g');\n    g_${wid}.setAttribute('transform', 'translate(${(-tx).toFixed(2)}, ${(-ty).toFixed(2)})');\n    var p_${wid} = document.createElementNS('http://www.w3.org/2000/svg', 'path');\n    p_${wid}.setAttribute('d', '${pathString}'); p_${wid}.setAttribute('stroke', '${obj.strokeColor || '#000000'}'); p_${wid}.setAttribute('stroke-width', '${obj.strokeWidth || 3}');\n    p_${wid}.setAttribute('fill', 'none'); p_${wid}.setAttribute('stroke-linecap', 'round'); p_${wid}.setAttribute('stroke-linejoin', 'round');\n    g_${wid}.appendChild(p_${wid}); svg_${wid}.appendChild(g_${wid}); ${wid}.appendChild(svg_${wid});\n    container.appendChild(${wid});\n    gsap.set(${wid}, { scaleX: ${firstKf.properties.scaleX.toFixed(2)}, scaleY: ${firstKf.properties.scaleY.toFixed(2)}, rotation: ${firstKf.properties.rotation.toFixed(2)}, opacity: ${firstKf.properties.opacity.toFixed(2)} });\n    \n`;
  return js;
};

const generatePathAnimation = (obj, objKfs, allNormalizedKfs) => {
  let js = '';
  for (let i = 1; i < objKfs.length; i++) {
    const prev = objKfs[i - 1], curr = objKfs[i];
    const gs = findGlobalZSwapForSegment(allNormalizedKfs, prev.time, curr.time);
    js += `    tl.to('#${obj.id}', { duration: ${(curr.time - prev.time).toFixed(2)}, left: '${curr.properties.x.toFixed(2)}px', top: '${curr.properties.y.toFixed(2)}px', scaleX: ${curr.properties.scaleX.toFixed(2)}, scaleY: ${curr.properties.scaleY.toFixed(2)}, rotation: ${curr.properties.rotation.toFixed(2)}, opacity: ${curr.properties.opacity.toFixed(2)}, ease: '${mapEasingToGSAP(curr.easing || 'linear')}' }, ${prev.time.toFixed(2)});\n`;
    js += generateZSwapCode(`#${obj.id}`, prev, curr, gs);
  }
  return js + '    \n';
};

const generateGroupCreation = (obj, firstKf, canvasObjects, fabricCanvas) => {
  const z = firstKf.properties.zIndex ?? 0;
  let js = `    const ${obj.id} = document.createElement('div');\n    ${obj.id}.id = '${obj.id}'; ${obj.id}.style.position = 'absolute';\n    ${obj.id}.style.left = '${firstKf.properties.x.toFixed(2)}px'; ${obj.id}.style.top = '${firstKf.properties.y.toFixed(2)}px';\n    ${obj.id}.style.width = '0px'; ${obj.id}.style.height = '0px'; ${obj.id}.style.overflow = 'visible'; ${obj.id}.style.transformOrigin = '0px 0px';\n    ${obj.id}.style.zIndex = '${z}';\n    container.appendChild(${obj.id});\n    gsap.set(${obj.id}, { scaleX: ${firstKf.properties.scaleX.toFixed(2)}, scaleY: ${firstKf.properties.scaleY.toFixed(2)}, rotation: ${firstKf.properties.rotation.toFixed(2)}, opacity: ${firstKf.properties.opacity.toFixed(2)} });\n    \n`;
  if (obj.children && fabricCanvas) {
    const fg = fabricCanvas.getObjects().find(o => o.id === obj.id);
    if (fg?._objects) {
      fg._objects.forEach(fc => {
        const co = canvasObjects.find(o => o.id === fc.id); if (!co) return;
        const rl = fc.left || 0, rt = fc.top || 0, sx = fc.scaleX || 1, sy = fc.scaleY || 1, an = fc.angle || 0;
        if (fc.type === 'path') {
          const ps = fabricPathToSVGPath(fc.path); const poX = fc.pathOffset?.x || 0, poY = fc.pathOffset?.y || 0;
          js += `    (function(){ var s = document.createElementNS('http://www.w3.org/2000/svg','svg'); s.style.position='absolute'; s.style.left='0'; s.style.top='0'; s.style.overflow='visible'; s.style.pointerEvents='none'; s.setAttribute('width','1'); s.setAttribute('height','1'); var g = document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('transform','translate(${(rl - poX*sx).toFixed(2)},${(rt - poY*sy).toFixed(2)}) scale(${sx},${sy})'); var p = document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d','${ps}'); p.setAttribute('stroke','${fc.stroke||'#000'}'); p.setAttribute('stroke-width','${fc.strokeWidth||3}'); p.setAttribute('fill','none'); p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round'); g.appendChild(p); s.appendChild(g); ${obj.id}.appendChild(s); })();\n    \n`;
        } else {
          const fill = co.fill || fc.fill; let cw = 100, ch = 100;
          js += `    const ${fc.id} = document.createElement('div'); ${fc.id}.id = '${fc.id}'; ${fc.id}.style.position = 'absolute'; ${fc.id}.style.transformOrigin = 'center center';\n`;
          if (fc.type === 'rect' || fc.type === 'rectangle') { cw = (fc.width||100)*sx; ch = (fc.height||100)*sy; js += `    ${fc.id}.style.width = '${cw.toFixed(2)}px'; ${fc.id}.style.height = '${ch.toFixed(2)}px'; ${fc.id}.style.backgroundColor = '${fill||'#3b82f6'}';\n`; }
          else if (fc.type === 'circle') { const r = fc.radius||50; cw = r*2*sx; ch = r*2*sy; js += `    ${fc.id}.style.width = '${cw.toFixed(2)}px'; ${fc.id}.style.height = '${ch.toFixed(2)}px'; ${fc.id}.style.borderRadius = '50%'; ${fc.id}.style.backgroundColor = '${fill||'#ef4444'}';\n`; }
          else if (fc.type === 'text') { cw = (fc.width||50)*sx; ch = (fc.height||24)*sy; js += `    ${fc.id}.textContent = '${(fc.text||'Text').replace(/'/g,"\\'")}'; ${fc.id}.style.fontSize = '${((fc.fontSize||24)*sy).toFixed(2)}px'; ${fc.id}.style.color = '${fill||'#000'}'; ${fc.id}.style.whiteSpace = 'nowrap';\n`; }
          js += `    ${fc.id}.style.left = '${(rl - cw/2).toFixed(2)}px'; ${fc.id}.style.top = '${(rt - ch/2).toFixed(2)}px';\n`;
          if (an) js += `    ${fc.id}.style.transform = 'rotate(${an}deg)';\n`;
          js += `    ${obj.id}.appendChild(${fc.id});\n    \n`;
        }
      });
    }
  }
  return js;
};

const generateGroupAnimation = (obj, objKfs, allNormalizedKfs) => {
  let js = '';
  for (let i = 1; i < objKfs.length; i++) {
    const prev = objKfs[i-1], curr = objKfs[i];
    const gs = findGlobalZSwapForSegment(allNormalizedKfs, prev.time, curr.time);
    js += `    tl.to('#${obj.id}', { duration: ${(curr.time-prev.time).toFixed(2)}, left: '${curr.properties.x.toFixed(2)}px', top: '${curr.properties.y.toFixed(2)}px', scaleX: ${curr.properties.scaleX.toFixed(2)}, scaleY: ${curr.properties.scaleY.toFixed(2)}, rotation: ${curr.properties.rotation.toFixed(2)}, opacity: ${curr.properties.opacity.toFixed(2)}, ease: '${mapEasingToGSAP(curr.easing||'linear')}' }, ${prev.time.toFixed(2)});\n`;
    js += generateZSwapCode(`#${obj.id}`, prev, curr, gs);
  }
  return js + '    \n';
};

export const downloadFile = (filename, content) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadAllFiles = (html, css, javascript) => {
  downloadFile('index.html', html);
  setTimeout(() => downloadFile('style.css', css), 100);
  setTimeout(() => downloadFile('animation.js', javascript), 200);
};

export const copyToClipboard = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (err) { console.error('Failed to copy:', err); return false; }
};