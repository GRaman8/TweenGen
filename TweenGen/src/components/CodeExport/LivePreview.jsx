import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import gsap from 'gsap';
import { useCanvasObjects, useKeyframes, useDuration, useFabricCanvas, useCanvasBgColor, useCanvasBgImage } from '../../store/hooks';
import { useAudioFile, useAudioVolume, useAudioMuted, useAudioRegion } from '../../store/audioHooks';
import { normalizeKeyframeRotations, findSurroundingKeyframes } from '../../utils/interpolation';
import { SVG_SHAPE_KEYS } from '../../utils/shapeDefinitions';
import { createSizedSVG } from '../../utils/imageTracer';
import { interpolatePathStrings } from '../../utils/pathUtils';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../Canvas/Canvas';

const fabricPathToSVGPath = (pathArray) => {
  if (!pathArray || !Array.isArray(pathArray)) return '';
  let s = '';
  pathArray.forEach(seg => { if (Array.isArray(seg)) s += seg[0] + ' ' + seg.slice(1).join(' ') + ' '; });
  return s.trim();
};

const getDefaultFillColor = (type) => {
  switch (type) { case 'rectangle': case 'roundedRect': return '#3b82f6'; case 'circle': return '#ef4444'; case 'ellipse': return '#a855f7'; case 'text': return '#000000'; default: return '#000000'; }
};

const findGlobalZSwapForSegment = (allNormalizedKfs, prevTime, currTime) => {
  const midTime = (prevTime + currTime) / 2; let globalSwap = null;
  for (const [objId, objKfs] of Object.entries(allNormalizedKfs)) {
    if (!objKfs || objKfs.length < 2) continue;
    const { before, after } = findSurroundingKeyframes(objKfs, midTime);
    if (!before || !after || before === after) continue;
    if ((before.properties.zIndex ?? 0) === (after.properties.zIndex ?? 0)) continue;
    if (after.zSwapPoint !== undefined && after.zSwapPoint !== null) {
      if (globalSwap === null) globalSwap = after.zSwapPoint; else globalSwap = Math.min(globalSwap, after.zSwapPoint);
    }
  }
  return globalSwap ?? 0.5;
};

const addZSwapTween = (timeline, element, prev, curr, globalSwapPoint) => {
  const prevZ = prev.properties.zIndex ?? 0, currZ = curr.properties.zIndex ?? 0;
  if (prevZ !== currZ) { const swapTime = prev.time + (curr.time - prev.time) * globalSwapPoint; timeline.set(element, { zIndex: currZ }, swapTime); }
};

const LivePreview = ({ isPreviewVisible = false }) => {
  const [canvasObjects] = useCanvasObjects();
  const [keyframes] = useKeyframes();
  const [duration] = useDuration();
  const [fabricCanvas] = useFabricCanvas();
  const [canvasBgColor] = useCanvasBgColor();
  const [canvasBgImage] = useCanvasBgImage();
  const [audioFile] = useAudioFile();
  const [audioVolume] = useAudioVolume();
  const [audioMuted] = useAudioMuted();
  const [audioRegion] = useAudioRegion();
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioFile?.dataURL) {
      const audio = new Audio(audioFile.dataURL);
      audio.preload = 'auto'; audio.loop = false;
      audioRef.current = audio;
      return () => { audio.pause(); audio.src = ''; audioRef.current = null; };
    } else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
      audioRef.current = null;
    }
  }, [audioFile?.dataURL]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = audioMuted ? 0 : audioVolume;
  }, [audioVolume, audioMuted]);

  // Map animation time to audio time using region
  const mapAnimTimeToAudioTime = (animTime) => {
    const audioDur = audioFile?.duration || 0;
    if (!audioRegion) return Math.min(animTime, audioDur);
    const regionDur = audioRegion.end - audioRegion.start;
    if (regionDur <= 0 || duration <= 0) return audioRegion.start;
    const ratio = animTime / duration;
    return audioRegion.start + ratio * regionDur;
  };

  useEffect(() => {
    if (!isPreviewVisible) {
      if (audioRef.current) audioRef.current.pause();
      if (timelineRef.current) timelineRef.current.pause();
    } else {
      if (timelineRef.current) {
        timelineRef.current.play();
        if (audioRef.current) {
          const t = timelineRef.current.time();
          const audioTime = mapAnimTimeToAudioTime(t);
          audioRef.current.currentTime = Math.min(audioTime, audioRef.current.duration || Infinity);
          audioRef.current.play().catch(() => {});
        }
      }
    }
  }, [isPreviewVisible]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    if (timelineRef.current) timelineRef.current.kill();

    // Add background image if present
    if (canvasBgImage?.dataURL) {
      const bgImg = document.createElement('img');
      bgImg.src = canvasBgImage.dataURL;
      bgImg.style.position = 'absolute';
      bgImg.style.top = '0';
      bgImg.style.left = '0';
      bgImg.style.width = '100%';
      bgImg.style.height = '100%';
      bgImg.style.objectFit = 'cover';
      bgImg.style.pointerEvents = 'none';
      bgImg.style.zIndex = '-1';
      containerRef.current.appendChild(bgImg);
    }

    timelineRef.current = gsap.timeline({ repeat: -1, paused: true });

    const groupChildren = new Set();
    canvasObjects.forEach(obj => { if (obj.type === 'group' && obj.children) obj.children.forEach(childId => groupChildren.add(childId)); });
    const allNormalizedKfs = {};
    canvasObjects.forEach(obj => {
      if (groupChildren.has(obj.id)) return;
      const rawKfs = keyframes[obj.id] || [];
      if (rawKfs.length === 0) return;
      allNormalizedKfs[obj.id] = normalizeKeyframeRotations(rawKfs);
    });

    canvasObjects.forEach(obj => {
      if (groupChildren.has(obj.id)) return;
      const objKfs = allNormalizedKfs[obj.id]; if (!objKfs || objKfs.length === 0) return;
      if (obj.type === 'group') renderGroup(obj, objKfs, allNormalizedKfs);
      else if (obj.type === 'path') renderPath(obj, objKfs, allNormalizedKfs);
      else if (obj.type === 'image') renderImage(obj, objKfs, allNormalizedKfs);
      else if (obj.deformedPath) renderDeformedShape(obj, objKfs, allNormalizedKfs);
      else if (SVG_SHAPE_KEYS.has(obj.type)) renderSvgShape(obj, objKfs, allNormalizedKfs);
      else renderRegular(obj, objKfs, allNormalizedKfs);
    });

    const tl = timelineRef.current;
    if (audioRef.current) {
      const audio = audioRef.current;
      tl.eventCallback('onStart', () => {
        if (!isPreviewVisible) return;
        audio.currentTime = mapAnimTimeToAudioTime(0);
        audio.play().catch(() => {});
      });
      tl.eventCallback('onUpdate', () => {
        if (!isPreviewVisible) return;
        const t = tl.time();
        const expectedAudioTime = mapAnimTimeToAudioTime(t);
        if (Math.abs(audio.currentTime - expectedAudioTime) > 0.15) {
          audio.currentTime = Math.min(expectedAudioTime, audio.duration || Infinity);
        }
      });
      tl.eventCallback('onRepeat', () => {
        if (!isPreviewVisible) return;
        audio.currentTime = mapAnimTimeToAudioTime(0);
        audio.play().catch(() => {});
      });
      tl.eventCallback('onComplete', () => { audio.pause(); });
    }

    if (isPreviewVisible) tl.play();

    return () => {
      if (timelineRef.current) timelineRef.current.kill();
      if (audioRef.current) audioRef.current.pause();
    };
  }, [canvasObjects, keyframes, duration, fabricCanvas, canvasBgColor, canvasBgImage, audioFile, audioRegion]);

  const animateElement = (el, objKfs, allNormalizedKfs, anchorX, anchorY, ew, eh, fillTarget = null, fillProp = null) => {
    const timeline = timelineRef.current;
    for (let i = 1; i < objKfs.length; i++) {
      const prev = objKfs[i-1], curr = objKfs[i];
      const globalSwap = findGlobalZSwapForSegment(allNormalizedKfs, prev.time, curr.time);
      timeline.to(el, { duration: curr.time-prev.time, left: (curr.properties.x-anchorX*ew)+'px', top: (curr.properties.y-anchorY*eh)+'px',
        scaleX: curr.properties.scaleX, scaleY: curr.properties.scaleY, rotation: curr.properties.rotation, opacity: curr.properties.opacity, ease: curr.easing||'none' }, prev.time);
      addZSwapTween(timeline, el, prev, curr, globalSwap);
      if (fillTarget && fillProp) {
        const pf = prev.properties.fill, cf = curr.properties.fill;
        if (pf && cf && pf !== cf) {
          const dur = curr.time-prev.time, ease = curr.easing||'none';
          if (fillProp === 'fill') timeline.to(fillTarget, { duration: dur, attr: { fill: cf }, ease }, prev.time);
          else timeline.to(fillTarget, { duration: dur, [fillProp]: cf, ease }, prev.time);
        }
      }
    }
  };

  const applyOutline = (el, obj, pathEl = null) => {
    const outlineWidth = obj.outlineWidth || 0;
    const outlineColor = obj.outlineColor || '#000000';
    if (outlineWidth <= 0) return;
    if (pathEl) {
      pathEl.setAttribute('stroke', outlineColor);
      pathEl.setAttribute('stroke-width', outlineWidth.toString());
    } else if (obj.type === 'text') {
      el.style.webkitTextStroke = `${outlineWidth}px ${outlineColor}`;
    } else {
      el.style.outline = `${outlineWidth}px solid ${outlineColor}`;
    }
  };

  const renderSvgShape = (obj, objKfs, allNormalizedKfs) => {
    const container = containerRef.current; const firstKf = objKfs[0];
    const anchorX=obj.anchorX??0.5,anchorY=obj.anchorY??0.5,ew=100,eh=100;
    const fillColor = firstKf.properties.fill||obj.fill||'#000000';
    const wrapper = document.createElement('div'); wrapper.id = obj.id; wrapper.style.position='absolute';
    wrapper.style.width=ew+'px'; wrapper.style.height=eh+'px';
    wrapper.style.transformOrigin=`${anchorX*100}% ${anchorY*100}%`;
    wrapper.style.zIndex=(firstKf.properties.zIndex??0).toString();
    wrapper.style.left=(firstKf.properties.x-anchorX*ew)+'px'; wrapper.style.top=(firstKf.properties.y-anchorY*eh)+'px';
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 100 100'); svg.setAttribute('width','100%'); svg.setAttribute('height','100%'); svg.style.display='block';
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg','path');
    pathEl.setAttribute('d',obj.svgPath||''); pathEl.setAttribute('fill',fillColor);
    applyOutline(wrapper, obj, pathEl);
    svg.appendChild(pathEl); wrapper.appendChild(svg); container.appendChild(wrapper);
    gsap.set(wrapper,{scaleX:firstKf.properties.scaleX,scaleY:firstKf.properties.scaleY,rotation:firstKf.properties.rotation,opacity:firstKf.properties.opacity});
    animateElement(wrapper,objKfs,allNormalizedKfs,anchorX,anchorY,ew,eh,pathEl,'fill');
  };

  const renderRegular = (obj, objKfs, allNormalizedKfs) => {
    const container = containerRef.current; const firstKf = objKfs[0];
    const anchorX=obj.anchorX??0.5,anchorY=obj.anchorY??0.5;
    const fillColor = firstKf.properties.fill||obj.fill||getDefaultFillColor(obj.type);
    let ew=100,eh=100; const el = document.createElement('div'); el.id=obj.id; el.style.position='absolute';
    if(obj.type==='rectangle'){el.style.width=ew+'px';el.style.height=eh+'px';el.style.backgroundColor=fillColor;}
    else if(obj.type==='circle'){el.style.width=ew+'px';el.style.height=eh+'px';el.style.borderRadius='50%';el.style.backgroundColor=fillColor;}
    else if(obj.type==='roundedRect'){el.style.width=ew+'px';el.style.height=eh+'px';el.style.borderRadius='16px';el.style.backgroundColor=fillColor;}
    else if(obj.type==='ellipse'){eh=76;el.style.width=ew+'px';el.style.height=eh+'px';el.style.borderRadius='50%';el.style.backgroundColor=fillColor;}
    else if(obj.type==='text'){const fo=fabricCanvas?.getObjects().find(o=>o.id===obj.id);el.textContent=fo?.text||obj.textContent||'Text';el.style.fontSize=(fo?.fontSize||24)+'px';el.style.color=fillColor;el.style.whiteSpace='nowrap';}
    applyOutline(el, obj);
    el.style.transformOrigin=`${anchorX*100}% ${anchorY*100}%`;
    el.style.zIndex=(firstKf.properties.zIndex??0).toString();
    el.style.left=(firstKf.properties.x-anchorX*ew)+'px'; el.style.top=(firstKf.properties.y-anchorY*eh)+'px';
    container.appendChild(el);
    gsap.set(el,{scaleX:firstKf.properties.scaleX,scaleY:firstKf.properties.scaleY,rotation:firstKf.properties.rotation,opacity:firstKf.properties.opacity});
    const fillProp = obj.type==='text'?'color':'backgroundColor';
    animateElement(el,objKfs,allNormalizedKfs,anchorX,anchorY,ew,eh,el,fillProp);
  };

  const renderImage = (obj, objKfs, allNormalizedKfs) => {
    const container = containerRef.current; const firstKf = objKfs[0];
    const anchorX=obj.anchorX??0.5,anchorY=obj.anchorY??0.5;
    const ew=obj.imageWidth||100,eh=obj.imageHeight||100;
    const useVector = obj.svgExportMode==='vector'&&obj.svgTracedData;
    let el;
    if(useVector){el=document.createElement('div');el.id=obj.id;el.style.position='absolute';el.style.width=ew+'px';el.style.height=eh+'px';el.innerHTML=createSizedSVG(obj.svgTracedData,ew,eh);}
    else{el=document.createElement('img');el.id=obj.id;el.src=obj.imageDataURL;el.style.position='absolute';el.style.width=ew+'px';el.style.height=eh+'px';}
    el.style.transformOrigin=`${anchorX*100}% ${anchorY*100}%`;
    el.style.zIndex=(firstKf.properties.zIndex??0).toString(); el.style.pointerEvents='none';
    el.style.left=(firstKf.properties.x-anchorX*ew)+'px'; el.style.top=(firstKf.properties.y-anchorY*eh)+'px';
    container.appendChild(el);
    gsap.set(el,{scaleX:firstKf.properties.scaleX,scaleY:firstKf.properties.scaleY,rotation:firstKf.properties.rotation,opacity:firstKf.properties.opacity});
    animateElement(el,objKfs,allNormalizedKfs,anchorX,anchorY,ew,eh);
  };

  const renderGroup = (obj, objKfs, allNormalizedKfs) => {
    const container = containerRef.current; const timeline = timelineRef.current;
    const fabricGroup = fabricCanvas?.getObjects().find(o=>o.id===obj.id); if(!fabricGroup)return;
    const firstKf = objKfs[0]; const groupEl = document.createElement('div');
    groupEl.id=obj.id;groupEl.style.position='absolute';groupEl.style.left=firstKf.properties.x+'px';groupEl.style.top=firstKf.properties.y+'px';
    groupEl.style.width='0px';groupEl.style.height='0px';groupEl.style.overflow='visible';
    groupEl.style.zIndex=(firstKf.properties.zIndex??0).toString();groupEl.style.transformOrigin='0px 0px';
    container.appendChild(groupEl);
    gsap.set(groupEl,{scaleX:firstKf.properties.scaleX,scaleY:firstKf.properties.scaleY,rotation:firstKf.properties.rotation,opacity:firstKf.properties.opacity});
    if(fabricGroup._objects){fabricGroup._objects.forEach(fc=>{const childObj=canvasObjects.find(o=>o.id===fc.id);if(!childObj)return;
    if(fc.type==='path')renderPathChild(fc,fc.left||0,fc.top||0,fc.scaleX||1,fc.scaleY||1,groupEl);
    else renderSolidChild(fc,childObj,fc.left||0,fc.top||0,fc.scaleX||1,fc.scaleY||1,fc.angle||0,groupEl);});}
    for(let i=1;i<objKfs.length;i++){const prev=objKfs[i-1],curr=objKfs[i];const gs=findGlobalZSwapForSegment(allNormalizedKfs,prev.time,curr.time);
    timeline.to(groupEl,{duration:curr.time-prev.time,left:curr.properties.x+'px',top:curr.properties.y+'px',scaleX:curr.properties.scaleX,scaleY:curr.properties.scaleY,rotation:curr.properties.rotation,opacity:curr.properties.opacity,ease:curr.easing||'none'},prev.time);
    addZSwapTween(timeline,groupEl,prev,curr,gs);}
  };
  const renderPathChild = (fc,relLeft,relTop,scaleX,scaleY,parentEl) => {
    const pathString=fabricPathToSVGPath(fc.path);if(!pathString)return;const poX=fc.pathOffset?.x||0,poY=fc.pathOffset?.y||0;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.style.position='absolute';svg.style.left='0';svg.style.top='0';svg.style.overflow='visible';svg.style.pointerEvents='none';svg.setAttribute('width','1');svg.setAttribute('height','1');
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('transform',`translate(${relLeft-poX*scaleX},${relTop-poY*scaleY}) scale(${scaleX},${scaleY})`);
    const pathEl=document.createElementNS('http://www.w3.org/2000/svg','path');pathEl.setAttribute('d',pathString);pathEl.setAttribute('stroke',fc.stroke||'#000');pathEl.setAttribute('stroke-width',fc.strokeWidth||3);pathEl.setAttribute('fill','none');pathEl.setAttribute('stroke-linecap','round');pathEl.setAttribute('stroke-linejoin','round');
    g.appendChild(pathEl);svg.appendChild(g);parentEl.appendChild(svg);
  };
  const renderSolidChild = (fc,childObj,relLeft,relTop,scaleX,scaleY,angle,parentEl) => {
    const el=document.createElement('div');el.id=fc.id;el.style.position='absolute';el.style.transformOrigin='center center';
    let cw=0,ch=0;const fillColor=childObj.fill||fc.fill;
    if(fc.type==='rect'||fc.type==='rectangle'){cw=(fc.width||100)*scaleX;ch=(fc.height||100)*scaleY;el.style.width=cw+'px';el.style.height=ch+'px';el.style.backgroundColor=fillColor||'#3b82f6';}
    else if(fc.type==='circle'){const r=fc.radius||50;cw=r*2*scaleX;ch=r*2*scaleY;el.style.width=cw+'px';el.style.height=ch+'px';el.style.borderRadius='50%';el.style.backgroundColor=fillColor||'#ef4444';}
    else if(fc.type==='text'){el.textContent=fc.text||'Text';el.style.fontSize=((fc.fontSize||24)*scaleY)+'px';el.style.color=fillColor||'#000';el.style.whiteSpace='nowrap';cw=(fc.width||50)*scaleX;ch=(fc.height||24)*scaleY;}
    el.style.left=(relLeft-cw/2)+'px';el.style.top=(relTop-ch/2)+'px';if(angle)el.style.transform=`rotate(${angle}deg)`;parentEl.appendChild(el);
  };

  const renderDeformedShape = (obj, objKfs, allNormalizedKfs) => {
    const container = containerRef.current; const timeline = timelineRef.current;
    const fo = fabricCanvas?.getObjects().find(o => o.id === obj.id);
    const firstKf = objKfs[0];
    const fillColor = firstKf.properties.fill || obj.fill || '#000000';
    const pathOffsetX = fo?.pathOffset?.x || obj.deformedPathOffsetX || 50;
    const pathOffsetY = fo?.pathOffset?.y || obj.deformedPathOffsetY || 50;
    const width = fo?.width || obj.deformedPathWidth || 100;
    const height = fo?.height || obj.deformedPathHeight || 100;
    const anchorX = obj.anchorX ?? 0.5;
    const anchorY = obj.anchorY ?? 0.5;
    const transX = pathOffsetX + (anchorX - 0.5) * width;
    const transY = pathOffsetY + (anchorY - 0.5) * height;
    const wrapper = document.createElement('div');
    wrapper.id = obj.id; wrapper.style.position = 'absolute';
    wrapper.style.left = firstKf.properties.x + 'px'; wrapper.style.top = firstKf.properties.y + 'px';
    wrapper.style.width = '0px'; wrapper.style.height = '0px'; wrapper.style.overflow = 'visible';
    wrapper.style.transformOrigin = '0px 0px';
    wrapper.style.zIndex = (firstKf.properties.zIndex ?? 0).toString();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute'; svg.style.left = '0px'; svg.style.top = '0px';
    svg.style.overflow = 'visible'; svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${-transX},${-transY})`);
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', obj.deformedPath); pathEl.setAttribute('fill', fillColor);
    const outlineWidth = obj.outlineWidth || 0;
    const outlineColor = obj.outlineColor || '#000000';
    if (outlineWidth > 0) {
      pathEl.setAttribute('stroke', outlineColor);
      pathEl.setAttribute('stroke-width', outlineWidth.toString());
    }
    g.appendChild(pathEl); svg.appendChild(g); wrapper.appendChild(svg); container.appendChild(wrapper);
    gsap.set(wrapper, { scaleX: firstKf.properties.scaleX, scaleY: firstKf.properties.scaleY, rotation: firstKf.properties.rotation, opacity: firstKf.properties.opacity });
    for (let i = 1; i < objKfs.length; i++) {
      const prev = objKfs[i - 1]; const curr = objKfs[i];
      const dur = curr.time - prev.time; const ease = curr.easing || 'none';
      const gs = findGlobalZSwapForSegment(allNormalizedKfs, prev.time, curr.time);
      timeline.to(wrapper, { duration: dur, left: curr.properties.x + 'px', top: curr.properties.y + 'px',
        scaleX: curr.properties.scaleX, scaleY: curr.properties.scaleY, rotation: curr.properties.rotation,
        opacity: curr.properties.opacity, ease: ease }, prev.time);
      addZSwapTween(timeline, wrapper, prev, curr, gs);
      const prevFill = prev.properties.fill; const currFill = curr.properties.fill;
      if (prevFill && currFill && prevFill !== currFill) {
        timeline.to(pathEl, { duration: dur, attr: { fill: currFill }, ease: ease }, prev.time);
      }
      const prevPath = prev.properties.deformedPath; const currPath = curr.properties.deformedPath;
      if (prevPath && currPath && prevPath !== currPath) {
        const morphProgress = { t: 0 };
        timeline.to(morphProgress, { t: 1, duration: dur, ease: ease,
          onUpdate: () => { const interpolatedD = interpolatePathStrings(prevPath, currPath, morphProgress.t); pathEl.setAttribute('d', interpolatedD); },
        }, prev.time);
      }
    }
  };

  const renderPath = (obj, objKfs, allNormalizedKfs) => {
    const container = containerRef.current; const timeline = timelineRef.current;
    const fo=fabricCanvas?.getObjects().find(o=>o.id===obj.id);const firstKf=objKfs[0];
    const pathOffsetX=fo?.pathOffset?.x||firstKf.properties.pathOffsetX||0,pathOffsetY=fo?.pathOffset?.y||firstKf.properties.pathOffsetY||0;
    const width=fo?.width||obj.width||0,height=fo?.height||obj.height||0;
    const anchorX=obj.anchorX??0.5,anchorY=obj.anchorY??0.5;
    const transX=pathOffsetX+(anchorX-0.5)*width,transY=pathOffsetY+(anchorY-0.5)*height;
    const wrapper=document.createElement('div');wrapper.id=obj.id;wrapper.style.position='absolute';
    wrapper.style.left=firstKf.properties.x+'px';wrapper.style.top=firstKf.properties.y+'px';
    wrapper.style.width='0px';wrapper.style.height='0px';wrapper.style.overflow='visible';wrapper.style.transformOrigin='0px 0px';
    wrapper.style.zIndex=(firstKf.properties.zIndex??0).toString();
    if(obj.fills?.length>0){obj.fills.forEach(fill=>{const aL=fill.relLeft-(anchorX-0.5)*width,aT=fill.relTop-(anchorY-0.5)*height;
    const img=document.createElement('img');img.src=fill.dataURL;img.style.position='absolute';img.style.left=aL+'px';img.style.top=aT+'px';
    img.style.width=fill.width+'px';img.style.height=fill.height+'px';img.style.pointerEvents='none';img.style.imageRendering='pixelated';wrapper.appendChild(img);});}
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.style.position='absolute';svg.style.left='0px';svg.style.top='0px';svg.style.overflow='visible';svg.style.pointerEvents='none';
    svg.setAttribute('width','1');svg.setAttribute('height','1');
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('transform',`translate(${-transX},${-transY})`);
    const pathEl=document.createElementNS('http://www.w3.org/2000/svg','path');pathEl.setAttribute('d',fabricPathToSVGPath(obj.pathData));
    pathEl.setAttribute('stroke',obj.strokeColor||'#000');pathEl.setAttribute('stroke-width',obj.strokeWidth||3);pathEl.setAttribute('fill','none');pathEl.setAttribute('stroke-linecap','round');pathEl.setAttribute('stroke-linejoin','round');
    g.appendChild(pathEl);svg.appendChild(g);wrapper.appendChild(svg);container.appendChild(wrapper);
    gsap.set(wrapper,{scaleX:firstKf.properties.scaleX,scaleY:firstKf.properties.scaleY,rotation:firstKf.properties.rotation,opacity:firstKf.properties.opacity});
    for(let i=1;i<objKfs.length;i++){const prev=objKfs[i-1],curr=objKfs[i];const gs=findGlobalZSwapForSegment(allNormalizedKfs,prev.time,curr.time);
    timeline.to(wrapper,{duration:curr.time-prev.time,left:curr.properties.x+'px',top:curr.properties.y+'px',scaleX:curr.properties.scaleX,scaleY:curr.properties.scaleY,rotation:curr.properties.rotation,opacity:curr.properties.opacity,ease:curr.easing||'none'},prev.time);
    addZSwapTween(timeline,wrapper,prev,curr,gs);}
  };

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>Live Preview (GSAP)</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        This preview always loops to help you review your animation • Loop: ENABLED ♾️
        {audioFile && ` • 🔊 Audio: ${audioFile.fileName || 'Loaded'}`}
      </Typography>
      <Box ref={containerRef} sx={{ position:'relative', width:`${CANVAS_WIDTH}px`, height:`${CANVAS_HEIGHT}px`,
        bgcolor: canvasBgColor, overflow:'hidden', border:'1px solid', borderColor:'divider' }} />
    </Paper>
  );
};

export default LivePreview;