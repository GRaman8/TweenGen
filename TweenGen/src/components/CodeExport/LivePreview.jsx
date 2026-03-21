import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import gsap from 'gsap';
import { useCanvasObjects, useKeyframes, useDuration, useFabricCanvas, useCanvasBgColor } from '../../store/hooks';
import { normalizeKeyframeRotations, findSurroundingKeyframes } from '../../utils/interpolation';
import { SVG_SHAPE_KEYS } from '../../utils/shapeDefinitions';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../Canvas/Canvas';

const fabricPathToSVGPath = (pathArray) => {
  if (!pathArray || !Array.isArray(pathArray)) return '';
  let s = '';
  pathArray.forEach(seg => { if (Array.isArray(seg)) s += seg[0] + ' ' + seg.slice(1).join(' ') + ' '; });
  return s.trim();
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

const findGlobalZSwapForSegment = (allNormalizedKfs, prevTime, currTime) => {
  const midTime = (prevTime + currTime) / 2;
  let globalSwap = null;
  for (const [objId, objKfs] of Object.entries(allNormalizedKfs)) {
    if (!objKfs || objKfs.length < 2) continue;
    const { before, after } = findSurroundingKeyframes(objKfs, midTime);
    if (!before || !after || before === after) continue;
    const beforeZ = before.properties.zIndex ?? 0;
    const afterZ = after.properties.zIndex ?? 0;
    if (beforeZ === afterZ) continue;
    if (after.zSwapPoint !== undefined && after.zSwapPoint !== null) {
      if (globalSwap === null) globalSwap = after.zSwapPoint;
      else globalSwap = Math.min(globalSwap, after.zSwapPoint);
    }
  }
  return globalSwap ?? 0.5;
};

const addZSwapTween = (timeline, element, prev, curr, globalSwapPoint) => {
  const prevZ = prev.properties.zIndex ?? 0;
  const currZ = curr.properties.zIndex ?? 0;
  if (prevZ !== currZ) {
    const swapTime = prev.time + (curr.time - prev.time) * globalSwapPoint;
    timeline.set(element, { zIndex: currZ }, swapTime);
  }
};

const LivePreview = () => {
  const [canvasObjects] = useCanvasObjects();
  const [keyframes] = useKeyframes();
  const [duration] = useDuration();
  const [fabricCanvas] = useFabricCanvas();
  const [canvasBgColor] = useCanvasBgColor();
  const containerRef = useRef(null);
  const timelineRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    if (timelineRef.current) timelineRef.current.kill();
    timelineRef.current = gsap.timeline({ repeat: -1 });

    const groupChildren = new Set();
    canvasObjects.forEach(obj => {
      if (obj.type === 'group' && obj.children) obj.children.forEach(childId => groupChildren.add(childId));
    });

    const allNormalizedKfs = {};
    canvasObjects.forEach(obj => {
      if (groupChildren.has(obj.id)) return;
      const rawKfs = keyframes[obj.id] || [];
      if (rawKfs.length === 0) return;
      allNormalizedKfs[obj.id] = normalizeKeyframeRotations(rawKfs);
    });

    canvasObjects.forEach(obj => {
      if (groupChildren.has(obj.id)) return;
      const objKfs = allNormalizedKfs[obj.id];
      if (!objKfs || objKfs.length === 0) return;

      if (obj.type === 'group') renderGroup(obj, objKfs, allNormalizedKfs);
      else if (obj.type === 'path') renderPath(obj, objKfs, allNormalizedKfs);
      else if (obj.type === 'image') renderImage(obj, objKfs, allNormalizedKfs);
      else if (SVG_SHAPE_KEYS.has(obj.type)) renderSvgShape(obj, objKfs, allNormalizedKfs);
      else renderRegular(obj, objKfs, allNormalizedKfs);
    });

    return () => { if (timelineRef.current) timelineRef.current.kill(); };
  }, [canvasObjects, keyframes, duration, fabricCanvas, canvasBgColor]);

  /**
   * Core animation helper — animates position, scale, rotation, opacity, z-index.
   * Optionally animates fill color if fillTarget and fillProp are provided.
   * 
   * @param {HTMLElement} el - The element to animate position/scale/rotation/opacity on
   * @param {Array} objKfs - Normalized keyframes for this object
   * @param {Object} allNormalizedKfs - All objects' keyframes (for global z-swap)
   * @param {number} anchorX - Anchor X (0-1)
   * @param {number} anchorY - Anchor Y (0-1)
   * @param {number} ew - Element width
   * @param {number} eh - Element height
   * @param {HTMLElement|SVGElement|null} fillTarget - Element to animate fill on (null to skip)
   * @param {string|null} fillProp - CSS prop ('backgroundColor', 'color') or 'fill' for SVG attr
   */
  const animateElement = (el, objKfs, allNormalizedKfs, anchorX, anchorY, ew, eh, fillTarget = null, fillProp = null) => {
    const timeline = timelineRef.current;
    for (let i = 1; i < objKfs.length; i++) {
      const prev = objKfs[i - 1], curr = objKfs[i];
      const globalSwap = findGlobalZSwapForSegment(allNormalizedKfs, prev.time, curr.time);
      timeline.to(el, {
        duration: curr.time - prev.time,
        left: (curr.properties.x - anchorX * ew) + 'px',
        top: (curr.properties.y - anchorY * eh) + 'px',
        scaleX: curr.properties.scaleX, scaleY: curr.properties.scaleY,
        rotation: curr.properties.rotation, opacity: curr.properties.opacity,
        ease: curr.easing || 'none',
      }, prev.time);
      addZSwapTween(timeline, el, prev, curr, globalSwap);

      // Fill color animation between keyframes
      if (fillTarget && fillProp) {
        const prevFill = prev.properties.fill;
        const currFill = curr.properties.fill;
        if (prevFill && currFill && prevFill !== currFill) {
          const dur = curr.time - prev.time;
          const ease = curr.easing || 'none';
          if (fillProp === 'fill') {
            // SVG attribute animation
            timeline.to(fillTarget, { duration: dur, attr: { fill: currFill }, ease }, prev.time);
          } else {
            // CSS property animation (backgroundColor, color)
            timeline.to(fillTarget, { duration: dur, [fillProp]: currFill, ease }, prev.time);
          }
        }
      }
    }
  };

  // ===== SVG SHAPES (triangle, diamond, pentagon, hexagon, star, arrow, heart, cross) =====
  const renderSvgShape = (obj, objKfs, allNormalizedKfs) => {
    const container = containerRef.current;
    if (objKfs.length === 0) return;
    const firstKf = objKfs[0];
    const anchorX = obj.anchorX ?? 0.5, anchorY = obj.anchorY ?? 0.5;
    const ew = 100, eh = 100;
    // Prefer keyframe fill, then obj.fill, then default
    const fillColor = firstKf.properties.fill || obj.fill || '#000000';

    const wrapper = document.createElement('div');
    wrapper.id = obj.id;
    wrapper.style.position = 'absolute';
    wrapper.style.width = ew + 'px';
    wrapper.style.height = eh + 'px';
    wrapper.style.transformOrigin = `${anchorX * 100}% ${anchorY * 100}%`;
    wrapper.style.zIndex = (firstKf.properties.zIndex ?? 0).toString();
    wrapper.style.left = (firstKf.properties.x - anchorX * ew) + 'px';
    wrapper.style.top = (firstKf.properties.y - anchorY * eh) + 'px';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.display = 'block';
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', obj.svgPath || '');
    pathEl.setAttribute('fill', fillColor);
    svg.appendChild(pathEl);
    wrapper.appendChild(svg);
    container.appendChild(wrapper);

    gsap.set(wrapper, {
      scaleX: firstKf.properties.scaleX, scaleY: firstKf.properties.scaleY,
      rotation: firstKf.properties.rotation, opacity: firstKf.properties.opacity,
    });

    // Animate with SVG fill color support (targets the <path> element)
    animateElement(wrapper, objKfs, allNormalizedKfs, anchorX, anchorY, ew, eh, pathEl, 'fill');
  };

  // ===== CSS SHAPES (rectangle, circle, ellipse, roundedRect, text) =====
  const renderRegular = (obj, objKfs, allNormalizedKfs) => {
    const container = containerRef.current;
    if (objKfs.length === 0) return;
    const firstKf = objKfs[0];
    const anchorX = obj.anchorX ?? 0.5, anchorY = obj.anchorY ?? 0.5;
    // Prefer keyframe fill, then obj.fill, then default
    const fillColor = firstKf.properties.fill || obj.fill || getDefaultFillColor(obj.type);

    let ew = 100, eh = 100;
    const el = document.createElement('div');
    el.id = obj.id; el.style.position = 'absolute';

    if (obj.type === 'rectangle') {
      el.style.width = ew + 'px'; el.style.height = eh + 'px'; el.style.backgroundColor = fillColor;
    } else if (obj.type === 'circle') {
      el.style.width = ew + 'px'; el.style.height = eh + 'px'; el.style.borderRadius = '50%'; el.style.backgroundColor = fillColor;
    } else if (obj.type === 'roundedRect') {
      el.style.width = ew + 'px'; el.style.height = eh + 'px'; el.style.borderRadius = '16px'; el.style.backgroundColor = fillColor;
    } else if (obj.type === 'ellipse') {
      eh = 76; // rx=50, ry=38 → 100x76
      el.style.width = ew + 'px'; el.style.height = eh + 'px'; el.style.borderRadius = '50%'; el.style.backgroundColor = fillColor;
    } else if (obj.type === 'text') {
      const fo = fabricCanvas?.getObjects().find(o => o.id === obj.id);
      el.textContent = fo?.text || obj.textContent || 'Text'; el.style.fontSize = '24px'; el.style.color = fillColor; el.style.whiteSpace = 'nowrap';
    }

    el.style.transformOrigin = `${anchorX * 100}% ${anchorY * 100}%`;
    el.style.zIndex = (firstKf.properties.zIndex ?? 0).toString();
    el.style.left = (firstKf.properties.x - anchorX * ew) + 'px';
    el.style.top = (firstKf.properties.y - anchorY * eh) + 'px';
    container.appendChild(el);

    gsap.set(el, {
      scaleX: firstKf.properties.scaleX, scaleY: firstKf.properties.scaleY,
      rotation: firstKf.properties.rotation, opacity: firstKf.properties.opacity,
    });

    // Animate with CSS fill color support (backgroundColor for shapes, color for text)
    const fillProp = obj.type === 'text' ? 'color' : 'backgroundColor';
    animateElement(el, objKfs, allNormalizedKfs, anchorX, anchorY, ew, eh, el, fillProp);
  };

  // ===== IMAGE =====
  const renderImage = (obj, objKfs, allNormalizedKfs) => {
    const container = containerRef.current;
    if (objKfs.length === 0) return;
    const firstKf = objKfs[0];
    const anchorX = obj.anchorX ?? 0.5, anchorY = obj.anchorY ?? 0.5;
    const ew = obj.imageWidth || 100, eh = obj.imageHeight || 100;

    const el = document.createElement('img');
    el.id = obj.id; el.src = obj.imageDataURL;
    el.style.position = 'absolute'; el.style.width = ew + 'px'; el.style.height = eh + 'px';
    el.style.transformOrigin = `${anchorX * 100}% ${anchorY * 100}%`;
    el.style.zIndex = (firstKf.properties.zIndex ?? 0).toString();
    el.style.pointerEvents = 'none';
    el.style.left = (firstKf.properties.x - anchorX * ew) + 'px';
    el.style.top = (firstKf.properties.y - anchorY * eh) + 'px';
    container.appendChild(el);

    gsap.set(el, {
      scaleX: firstKf.properties.scaleX, scaleY: firstKf.properties.scaleY,
      rotation: firstKf.properties.rotation, opacity: firstKf.properties.opacity,
    });

    // Images don't have fill color animation
    animateElement(el, objKfs, allNormalizedKfs, anchorX, anchorY, ew, eh);
  };

  // ===== GROUP =====
  const renderGroup = (obj, objKfs, allNormalizedKfs) => {
    const container = containerRef.current;
    const timeline = timelineRef.current;
    const fabricGroup = fabricCanvas?.getObjects().find(o => o.id === obj.id);
    if (!fabricGroup) return;
    const firstKf = objKfs[0];
    const groupEl = document.createElement('div');
    groupEl.id = obj.id; groupEl.style.position = 'absolute';
    groupEl.style.left = firstKf.properties.x + 'px'; groupEl.style.top = firstKf.properties.y + 'px';
    groupEl.style.width = '0px'; groupEl.style.height = '0px'; groupEl.style.overflow = 'visible';
    groupEl.style.zIndex = (firstKf.properties.zIndex ?? 0).toString();
    groupEl.style.transformOrigin = '0px 0px';
    container.appendChild(groupEl);
    gsap.set(groupEl, { scaleX: firstKf.properties.scaleX, scaleY: firstKf.properties.scaleY,
      rotation: firstKf.properties.rotation, opacity: firstKf.properties.opacity });
    if (fabricGroup._objects) {
      fabricGroup._objects.forEach((fc) => {
        const childObj = canvasObjects.find(o => o.id === fc.id);
        if (!childObj) return;
        if (fc.type === 'path') renderPathChild(fc, fc.left || 0, fc.top || 0, fc.scaleX || 1, fc.scaleY || 1, groupEl);
        else renderSolidChild(fc, childObj, fc.left || 0, fc.top || 0, fc.scaleX || 1, fc.scaleY || 1, fc.angle || 0, groupEl);
      });
    }
    for (let i = 1; i < objKfs.length; i++) {
      const prev = objKfs[i - 1], curr = objKfs[i];
      const globalSwap = findGlobalZSwapForSegment(allNormalizedKfs, prev.time, curr.time);
      timeline.to(groupEl, {
        duration: curr.time - prev.time, left: curr.properties.x + 'px', top: curr.properties.y + 'px',
        scaleX: curr.properties.scaleX, scaleY: curr.properties.scaleY,
        rotation: curr.properties.rotation, opacity: curr.properties.opacity, ease: curr.easing || 'none',
      }, prev.time);
      addZSwapTween(timeline, groupEl, prev, curr, globalSwap);
    }
  };

  const renderPathChild = (fc, relLeft, relTop, scaleX, scaleY, parentEl) => {
    const pathString = fabricPathToSVGPath(fc.path);
    if (!pathString) return;
    const poX = fc.pathOffset?.x || 0, poY = fc.pathOffset?.y || 0;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute'; svg.style.left = '0'; svg.style.top = '0';
    svg.style.overflow = 'visible'; svg.style.pointerEvents = 'none';
    svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${relLeft - poX * scaleX}, ${relTop - poY * scaleY}) scale(${scaleX}, ${scaleY})`);
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', pathString); pathEl.setAttribute('stroke', fc.stroke || '#000000');
    pathEl.setAttribute('stroke-width', fc.strokeWidth || 3); pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke-linecap', 'round'); pathEl.setAttribute('stroke-linejoin', 'round');
    g.appendChild(pathEl); svg.appendChild(g); parentEl.appendChild(svg);
  };

  const renderSolidChild = (fc, childObj, relLeft, relTop, scaleX, scaleY, angle, parentEl) => {
    const el = document.createElement('div');
    el.id = fc.id; el.style.position = 'absolute'; el.style.transformOrigin = 'center center';
    let cw = 0, ch = 0;
    const fillColor = childObj.fill || fc.fill;
    if (fc.type === 'rect' || fc.type === 'rectangle') {
      cw = (fc.width || 100) * scaleX; ch = (fc.height || 100) * scaleY;
      el.style.width = cw + 'px'; el.style.height = ch + 'px'; el.style.backgroundColor = fillColor || '#3b82f6';
    } else if (fc.type === 'circle') {
      const r = fc.radius || 50; cw = r * 2 * scaleX; ch = r * 2 * scaleY;
      el.style.width = cw + 'px'; el.style.height = ch + 'px'; el.style.borderRadius = '50%'; el.style.backgroundColor = fillColor || '#ef4444';
    } else if (fc.type === 'text') {
      el.textContent = fc.text || 'Text'; el.style.fontSize = ((fc.fontSize || 24) * scaleY) + 'px';
      el.style.color = fillColor || '#000000'; el.style.whiteSpace = 'nowrap';
      cw = (fc.width || 50) * scaleX; ch = (fc.height || 24) * scaleY;
    }
    el.style.left = (relLeft - cw / 2) + 'px'; el.style.top = (relTop - ch / 2) + 'px';
    if (angle) el.style.transform = `rotate(${angle}deg)`;
    parentEl.appendChild(el);
  };

  // ===== PATH (freehand drawings with embedded fills) =====
  const renderPath = (obj, objKfs, allNormalizedKfs) => {
    const container = containerRef.current;
    const timeline = timelineRef.current;
    if (objKfs.length === 0) return;
    const fo = fabricCanvas?.getObjects().find(o => o.id === obj.id);
    const firstKf = objKfs[0];
    const pathOffsetX = fo?.pathOffset?.x || firstKf.properties.pathOffsetX || 0;
    const pathOffsetY = fo?.pathOffset?.y || firstKf.properties.pathOffsetY || 0;
    const width = fo?.width || firstKf.properties.width || obj.width || 0;
    const height = fo?.height || firstKf.properties.height || obj.height || 0;
    const anchorX = obj.anchorX ?? 0.5, anchorY = obj.anchorY ?? 0.5;
    const transX = pathOffsetX + (anchorX - 0.5) * width;
    const transY = pathOffsetY + (anchorY - 0.5) * height;

    const wrapper = document.createElement('div');
    wrapper.id = obj.id; wrapper.style.position = 'absolute';
    wrapper.style.left = firstKf.properties.x + 'px'; wrapper.style.top = firstKf.properties.y + 'px';
    wrapper.style.width = '0px'; wrapper.style.height = '0px'; wrapper.style.overflow = 'visible';
    wrapper.style.transformOrigin = '0px 0px';
    wrapper.style.zIndex = (firstKf.properties.zIndex ?? 0).toString();

    if (obj.fills?.length > 0) {
      obj.fills.forEach(fill => {
        const adjustedLeft = fill.relLeft - (anchorX - 0.5) * width;
        const adjustedTop = fill.relTop - (anchorY - 0.5) * height;
        const img = document.createElement('img'); img.src = fill.dataURL;
        img.style.position = 'absolute'; img.style.left = adjustedLeft + 'px'; img.style.top = adjustedTop + 'px';
        img.style.width = fill.width + 'px'; img.style.height = fill.height + 'px';
        img.style.pointerEvents = 'none'; img.style.imageRendering = 'pixelated';
        wrapper.appendChild(img);
      });
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute'; svg.style.left = '0px'; svg.style.top = '0px';
    svg.style.overflow = 'visible'; svg.style.pointerEvents = 'none';
    svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${-transX}, ${-transY})`);
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', fabricPathToSVGPath(obj.pathData));
    pathEl.setAttribute('stroke', obj.strokeColor || '#000000');
    pathEl.setAttribute('stroke-width', obj.strokeWidth || 3); pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke-linecap', 'round'); pathEl.setAttribute('stroke-linejoin', 'round');
    g.appendChild(pathEl); svg.appendChild(g); wrapper.appendChild(svg); container.appendChild(wrapper);

    gsap.set(wrapper, { scaleX: firstKf.properties.scaleX, scaleY: firstKf.properties.scaleY,
      rotation: firstKf.properties.rotation, opacity: firstKf.properties.opacity });
    for (let i = 1; i < objKfs.length; i++) {
      const prev = objKfs[i - 1], curr = objKfs[i];
      const globalSwap = findGlobalZSwapForSegment(allNormalizedKfs, prev.time, curr.time);
      timeline.to(wrapper, {
        duration: curr.time - prev.time, left: curr.properties.x + 'px', top: curr.properties.y + 'px',
        scaleX: curr.properties.scaleX, scaleY: curr.properties.scaleY,
        rotation: curr.properties.rotation, opacity: curr.properties.opacity, ease: curr.easing || 'none',
      }, prev.time);
      addZSwapTween(timeline, wrapper, prev, curr, globalSwap);
    }
  };

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>Live Preview (GSAP)</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        This preview always loops to help you review your animation • Loop: ENABLED ♾️
      </Typography>
      <Box ref={containerRef} sx={{ position: 'relative', width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px`,
        bgcolor: canvasBgColor, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }} />
    </Paper>
  );
};

export default LivePreview;