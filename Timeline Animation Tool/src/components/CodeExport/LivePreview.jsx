import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useCanvasObjects, useKeyframes, useDuration, useFabricCanvas, useCanvasBgColor } from '../../store/hooks';
import { normalizeKeyframeRotations, findSurroundingKeyframes } from '../../utils/interpolation';
import { SVG_SHAPE_KEYS } from '../../utils/shapeDefinitions';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../Canvas/Canvas';

const fabricPathToSVGPath = (pathArray) => {
  if (!pathArray || !Array.isArray(pathArray)) return '';
  let s = ''; pathArray.forEach(seg => { if (Array.isArray(seg)) s += seg[0] + ' ' + seg.slice(1).join(' ') + ' '; }); return s.trim();
};

const getDefaultFillColor = (type) => {
  switch (type) { case 'rectangle': case 'roundedRect': return '#3b82f6'; case 'circle': return '#ef4444'; case 'ellipse': return '#a855f7'; default: return '#000'; }
};

const findGlobalZSwapForSegment = (allKfs, prevTime, currTime) => {
  const mid = (prevTime + currTime) / 2; let gs = null;
  for (const [, kfs] of Object.entries(allKfs)) { if (!kfs || kfs.length < 2) continue; const { before, after } = findSurroundingKeyframes(kfs, mid); if (!before || !after || before === after) continue; if ((before.properties.zIndex ?? 0) === (after.properties.zIndex ?? 0)) continue; if (after.zSwapPoint != null) { gs = gs === null ? after.zSwapPoint : Math.min(gs, after.zSwapPoint); } }
  return gs ?? 0.5;
};

const addZSwapTween = (tl, el, prev, curr, gs) => { const pz = prev.properties.zIndex ?? 0, cz = curr.properties.zIndex ?? 0; if (pz !== cz) tl.set(el, { zIndex: cz }, prev.time + (curr.time - prev.time) * gs); };

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
    containerRef.current.innerHTML = ''; if (timelineRef.current) timelineRef.current.kill();
    timelineRef.current = gsap.timeline({ repeat: -1 });
    const groupChildren = new Set(); canvasObjects.forEach(o => { if (o.type === 'group' && o.children) o.children.forEach(c => groupChildren.add(c)); });
    const allKfs = {}; canvasObjects.forEach(o => { if (groupChildren.has(o.id)) return; const raw = keyframes[o.id] || []; if (raw.length > 0) allKfs[o.id] = normalizeKeyframeRotations(raw); });

    canvasObjects.forEach(o => { if (groupChildren.has(o.id)) return; const kfs = allKfs[o.id]; if (!kfs || kfs.length === 0) return;
      if (o.type === 'group') renderGroup(o, kfs, allKfs);
      else if (o.type === 'path') renderPath(o, kfs, allKfs);
      else if (o.type === 'image') renderImage(o, kfs, allKfs);
      else if (SVG_SHAPE_KEYS.has(o.type)) renderSvgShape(o, kfs, allKfs);
      else renderRegular(o, kfs, allKfs);
    });
    return () => { if (timelineRef.current) timelineRef.current.kill(); };
  }, [canvasObjects, keyframes, duration, fabricCanvas, canvasBgColor]);

  const animateEl = (el, kfs, allKfs, ax, ay, ew, eh) => { const tl = timelineRef.current; for (let i = 1; i < kfs.length; i++) { const p = kfs[i-1], c = kfs[i]; const gs = findGlobalZSwapForSegment(allKfs, p.time, c.time); tl.to(el, { duration: c.time-p.time, left: (c.properties.x-ax*ew)+'px', top: (c.properties.y-ay*eh)+'px', scaleX: c.properties.scaleX, scaleY: c.properties.scaleY, rotation: c.properties.rotation, opacity: c.properties.opacity, ease: c.easing||'none' }, p.time); addZSwapTween(tl, el, p, c, gs); } };

  const renderSvgShape = (o, kfs, allKfs) => { const c = containerRef.current; const f = kfs[0]; const ax = o.anchorX??0.5, ay = o.anchorY??0.5; const w = document.createElement('div'); w.id = o.id; Object.assign(w.style, { position:'absolute', width:'100px', height:'100px', transformOrigin:`${ax*100}% ${ay*100}%`, zIndex:(f.properties.zIndex??0).toString(), left:(f.properties.x-ax*100)+'px', top:(f.properties.y-ay*100)+'px' }); const s = document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('viewBox','0 0 100 100'); s.setAttribute('width','100%'); s.setAttribute('height','100%'); s.style.display='block'; const p = document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d',o.svgPath||''); p.setAttribute('fill',o.fill||'#000'); s.appendChild(p); w.appendChild(s); c.appendChild(w); gsap.set(w, { scaleX:f.properties.scaleX, scaleY:f.properties.scaleY, rotation:f.properties.rotation, opacity:f.properties.opacity }); animateEl(w, kfs, allKfs, ax, ay, 100, 100); };

  const renderRegular = (o, kfs, allKfs) => { const c = containerRef.current; const f = kfs[0]; const ax = o.anchorX??0.5, ay = o.anchorY??0.5; const fill = o.fill||getDefaultFillColor(o.type); let ew=100, eh=100; const el = document.createElement('div'); el.id=o.id; el.style.position='absolute';
    if (o.type==='rectangle') { el.style.width=ew+'px'; el.style.height=eh+'px'; el.style.backgroundColor=fill; }
    else if (o.type==='circle') { el.style.width=ew+'px'; el.style.height=eh+'px'; el.style.borderRadius='50%'; el.style.backgroundColor=fill; }
    else if (o.type==='roundedRect') { el.style.width=ew+'px'; el.style.height=eh+'px'; el.style.borderRadius='16px'; el.style.backgroundColor=fill; }
    else if (o.type==='ellipse') { eh=76; el.style.width=ew+'px'; el.style.height=eh+'px'; el.style.borderRadius='50%'; el.style.backgroundColor=fill; }
    else if (o.type==='text') { const fo=fabricCanvas?.getObjects().find(x=>x.id===o.id); el.textContent=fo?.text||o.textContent||'Text'; el.style.fontSize='24px'; el.style.color=fill; el.style.whiteSpace='nowrap'; }
    el.style.transformOrigin=`${ax*100}% ${ay*100}%`; el.style.zIndex=(f.properties.zIndex??0).toString(); el.style.left=(f.properties.x-ax*ew)+'px'; el.style.top=(f.properties.y-ay*eh)+'px'; c.appendChild(el); gsap.set(el, { scaleX:f.properties.scaleX, scaleY:f.properties.scaleY, rotation:f.properties.rotation, opacity:f.properties.opacity }); animateEl(el, kfs, allKfs, ax, ay, ew, eh); };

  const renderImage = (o, kfs, allKfs) => { const c = containerRef.current; const f = kfs[0]; const ax=o.anchorX??0.5, ay=o.anchorY??0.5; const ew=o.imageWidth||100, eh=o.imageHeight||100; const el=document.createElement('img'); el.id=o.id; el.src=o.imageDataURL; Object.assign(el.style, { position:'absolute', width:ew+'px', height:eh+'px', transformOrigin:`${ax*100}% ${ay*100}%`, zIndex:(f.properties.zIndex??0).toString(), pointerEvents:'none', left:(f.properties.x-ax*ew)+'px', top:(f.properties.y-ay*eh)+'px' }); c.appendChild(el); gsap.set(el, { scaleX:f.properties.scaleX, scaleY:f.properties.scaleY, rotation:f.properties.rotation, opacity:f.properties.opacity }); animateEl(el, kfs, allKfs, ax, ay, ew, eh); };

  const renderGroup = (o, kfs, allKfs) => { const c=containerRef.current; const tl=timelineRef.current; const fg=fabricCanvas?.getObjects().find(x=>x.id===o.id); if(!fg) return; const f=kfs[0]; const g=document.createElement('div'); g.id=o.id; Object.assign(g.style, { position:'absolute', left:f.properties.x+'px', top:f.properties.y+'px', width:'0px', height:'0px', overflow:'visible', zIndex:(f.properties.zIndex??0).toString(), transformOrigin:'0px 0px' }); c.appendChild(g); gsap.set(g, { scaleX:f.properties.scaleX, scaleY:f.properties.scaleY, rotation:f.properties.rotation, opacity:f.properties.opacity });
    if (fg._objects) fg._objects.forEach(fc => { const co=canvasObjects.find(x=>x.id===fc.id); if(!co) return; if(fc.type==='path') renderPathChild(fc, fc.left||0, fc.top||0, fc.scaleX||1, fc.scaleY||1, g); else renderSolidChild(fc, co, fc.left||0, fc.top||0, fc.scaleX||1, fc.scaleY||1, fc.angle||0, g); });
    for(let i=1;i<kfs.length;i++){ const p=kfs[i-1],cu=kfs[i]; const gs=findGlobalZSwapForSegment(allKfs,p.time,cu.time); tl.to(g,{duration:cu.time-p.time, left:cu.properties.x+'px', top:cu.properties.y+'px', scaleX:cu.properties.scaleX, scaleY:cu.properties.scaleY, rotation:cu.properties.rotation, opacity:cu.properties.opacity, ease:cu.easing||'none'}, p.time); addZSwapTween(tl,g,p,cu,gs); }
  };

  const renderPathChild = (fc, rl, rt, sx, sy, parent) => { const ps=fabricPathToSVGPath(fc.path); if(!ps) return; const poX=fc.pathOffset?.x||0,poY=fc.pathOffset?.y||0; const s=document.createElementNS('http://www.w3.org/2000/svg','svg'); Object.assign(s.style,{position:'absolute',left:'0',top:'0',overflow:'visible',pointerEvents:'none'}); s.setAttribute('width','1'); s.setAttribute('height','1'); const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('transform',`translate(${rl-poX*sx},${rt-poY*sy}) scale(${sx},${sy})`); const p=document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d',ps); p.setAttribute('stroke',fc.stroke||'#000'); p.setAttribute('stroke-width',fc.strokeWidth||3); p.setAttribute('fill','none'); p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round'); g.appendChild(p); s.appendChild(g); parent.appendChild(s); };

  const renderSolidChild = (fc, co, rl, rt, sx, sy, angle, parent) => { const el=document.createElement('div'); el.id=fc.id; el.style.position='absolute'; el.style.transformOrigin='center center'; let cw=0,ch=0; const fill=co.fill||fc.fill;
    if(fc.type==='rect'||fc.type==='rectangle'){ cw=(fc.width||100)*sx; ch=(fc.height||100)*sy; el.style.width=cw+'px'; el.style.height=ch+'px'; el.style.backgroundColor=fill||'#3b82f6'; }
    else if(fc.type==='circle'){ const r=fc.radius||50; cw=r*2*sx; ch=r*2*sy; el.style.width=cw+'px'; el.style.height=ch+'px'; el.style.borderRadius='50%'; el.style.backgroundColor=fill||'#ef4444'; }
    else if(fc.type==='text'){ el.textContent=fc.text||'Text'; el.style.fontSize=((fc.fontSize||24)*sy)+'px'; el.style.color=fill||'#000'; el.style.whiteSpace='nowrap'; cw=(fc.width||50)*sx; ch=(fc.height||24)*sy; }
    el.style.left=(rl-cw/2)+'px'; el.style.top=(rt-ch/2)+'px'; if(angle) el.style.transform=`rotate(${angle}deg)`; parent.appendChild(el); };

  const renderPath = (o, kfs, allKfs) => { const c=containerRef.current; const tl=timelineRef.current; const fo=fabricCanvas?.getObjects().find(x=>x.id===o.id); const f=kfs[0]; const poX=fo?.pathOffset?.x||f.properties.pathOffsetX||0, poY=fo?.pathOffset?.y||f.properties.pathOffsetY||0; const w=fo?.width||f.properties.width||o.width||0, h=fo?.height||f.properties.height||o.height||0; const ax=o.anchorX??0.5, ay=o.anchorY??0.5; const tx=poX+(ax-0.5)*w, ty=poY+(ay-0.5)*h;
    const wr=document.createElement('div'); wr.id=o.id; Object.assign(wr.style,{position:'absolute',left:f.properties.x+'px',top:f.properties.y+'px',width:'0px',height:'0px',overflow:'visible',transformOrigin:'0px 0px',zIndex:(f.properties.zIndex??0).toString()});
    if(o.fills?.length>0) o.fills.forEach(fl=>{ const al=fl.relLeft-(ax-0.5)*w, at=fl.relTop-(ay-0.5)*h; const img=document.createElement('img'); img.src=fl.dataURL; Object.assign(img.style,{position:'absolute',left:al+'px',top:at+'px',width:fl.width+'px',height:fl.height+'px',pointerEvents:'none',imageRendering:'pixelated'}); wr.appendChild(img); });
    const s=document.createElementNS('http://www.w3.org/2000/svg','svg'); Object.assign(s.style,{position:'absolute',left:'0px',top:'0px',overflow:'visible',pointerEvents:'none'}); s.setAttribute('width','1'); s.setAttribute('height','1'); const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('transform',`translate(${-tx},${-ty})`); const p=document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d',fabricPathToSVGPath(o.pathData)); p.setAttribute('stroke',o.strokeColor||'#000'); p.setAttribute('stroke-width',o.strokeWidth||3); p.setAttribute('fill','none'); p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round'); g.appendChild(p); s.appendChild(g); wr.appendChild(s); c.appendChild(wr);
    gsap.set(wr, { scaleX:f.properties.scaleX, scaleY:f.properties.scaleY, rotation:f.properties.rotation, opacity:f.properties.opacity });
    for(let i=1;i<kfs.length;i++){ const pr=kfs[i-1],cu=kfs[i]; const gs=findGlobalZSwapForSegment(allKfs,pr.time,cu.time); tl.to(wr,{duration:cu.time-pr.time,left:cu.properties.x+'px',top:cu.properties.y+'px',scaleX:cu.properties.scaleX,scaleY:cu.properties.scaleY,rotation:cu.properties.rotation,opacity:cu.properties.opacity,ease:cu.easing||'none'},pr.time); addZSwapTween(tl,wr,pr,cu,gs); }
  };

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-300 p-5 mt-3" aria-label="Live preview">
      <h2 className="text-[16px] font-semibold text-gray-900 mb-1">Live Preview (GSAP)</h2>
      <p className="text-[14px] text-gray-600 mb-4">This preview always loops to help you review your animation • Loop: ENABLED ♾️</p>
      <div ref={containerRef} className="relative overflow-hidden border-2 border-gray-300 rounded"
        style={{ width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px`, backgroundColor: canvasBgColor }}
        role="img" aria-label="Animation preview" />
    </section>
  );
};

export default LivePreview;