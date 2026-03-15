import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';

import { 
  useSelectedObject, useFabricCanvas, useSelectedObjectProperties,
  useCurrentTime, useKeyframes, useCanvasObjects, useIsPlaying,
  useHasActiveSelection, useDrawingMode, useCurrentDrawingPath,
  useDrawingToolSettings, useCanvasBgColor, useSelectedKeyframe,
  useFillToolActive, useFillToolColor, useTrackOrder,
} from '../../store/hooks';

import { 
  extractPropertiesFromFabricObject, findFabricObjectById,
  createPathFromPoints, createCompoundPathFromStrokes, ungroupFabricGroup,
  renderRotationControl,
} from '../../utils/fabricHelpers';

import { 
  findSurroundingKeyframes, interpolateProperties, 
  applyPropertiesToFabricObject, applyZIndexOrdering,
  findGlobalZSwapPoint,
} from '../../utils/interpolation';

import { performFloodFill } from '../../utils/floodFill';
import AnchorPointOverlay from './AnchorPointOverlay';

export const CANVAS_WIDTH = 1400;
export const CANVAS_HEIGHT = 800;

const getCanvasPointer = (canvas, e) => { if (typeof canvas.getScenePoint === 'function') return canvas.getScenePoint(e); if (typeof canvas.getPointer === 'function') return canvas.getPointer(e); const r = canvas.getElement().getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

const findParentPath = (fillResult, fabricCanvas, canvasObjects) => {
  const cx = fillResult.left + fillResult.width/2, cy = fillResult.top + fillResult.height/2;
  let bestId = null, bestArea = Infinity;
  for (const obj of canvasObjects) { if (obj.type !== 'path') continue; const fo = fabricCanvas.getObjects().find(o => o.id === obj.id); if (!fo) continue; const b = fo.getBoundingRect(); const pad = 30; if (cx >= b.left-pad && cx <= b.left+b.width+pad && cy >= b.top-pad && cy <= b.top+b.height+pad) { const a = b.width*b.height; if (a < bestArea) { bestArea = a; bestId = obj.id; } } }
  return bestId;
};

const Canvas = () => {
  const canvasRef = useRef(null);
  const [selectedObject, setSelectedObject] = useSelectedObject();
  const [fabricCanvas, setFabricCanvas] = useFabricCanvas();
  const [, setSelectedObjectProperties] = useSelectedObjectProperties();
  const [currentTime] = useCurrentTime();
  const [keyframes, setKeyframes] = useKeyframes();
  const [canvasObjects, setCanvasObjects] = useCanvasObjects();
  const [isPlaying] = useIsPlaying();
  const [, setHasActiveSelection] = useHasActiveSelection();
  const [drawingMode, setDrawingMode] = useDrawingMode();
  const [, setCurrentDrawingPath] = useCurrentDrawingPath();
  const [drawingSettings] = useDrawingToolSettings();
  const [canvasBgColor] = useCanvasBgColor();
  const [selectedKeyframe] = useSelectedKeyframe();
  const [fillToolActive, setFillToolActive] = useFillToolActive();
  const [fillToolColor] = useFillToolColor();
  const [, setTrackOrder] = useTrackOrder();
  const [isInteracting, setIsInteracting] = useState(false);
  const interactingObjectRef = useRef(null);
  const isDrawingRef = useRef(false); const drawingPointsRef = useRef([]); const tempPathRef = useRef(null);
  const committedStrokesRef = useRef([]); const committedStrokePathsRef = useRef([]);
  const [strokeCount, setStrokeCount] = useState(0);
  const canvasObjectsRef = useRef(canvasObjects);
  useEffect(() => { canvasObjectsRef.current = canvasObjects; }, [canvasObjects]);

  const syncFillsForPath = (pathId) => { if (!fabricCanvas) return; let pfo = fabricCanvas.getObjects().find(o => o.id === pathId); if (!pfo) { const ao = fabricCanvas.getActiveObject(); if (ao?.type === 'activeSelection') pfo = ao._objects?.find(o => o.id === pathId); } if (!pfo) return; let al=pfo.left||0,at=pfo.top||0,asx=pfo.scaleX||1,asy=pfo.scaleY||1,aa=pfo.angle||0; if (pfo.group?.type==='activeSelection') { const m=pfo.calcTransformMatrix(); const opt=fabric.util.qrDecompose(m); al=opt.translateX; at=opt.translateY; asx=opt.scaleX; asy=opt.scaleY; aa=opt.angle; } fabricCanvas.getObjects().forEach(o => { if (o._isFill && o._parentId === pathId) { const rad=(aa||0)*Math.PI/180; const sx=asx||1,sy=asy||1; const rx=(o._relLeft||0)*sx,ry=(o._relTop||0)*sy; const tx=rx*Math.cos(rad)-ry*Math.sin(rad), ty=rx*Math.sin(rad)+ry*Math.cos(rad); o.set({left:al+tx,top:at+ty,angle:aa,scaleX:sx,scaleY:sy}); o.setCoords(); } }); };
  const syncAllFills = () => { if (!fabricCanvas) return; const ids=new Set(); fabricCanvas.getObjects().forEach(o => { if (o._isFill && o._parentId) ids.add(o._parentId); }); ids.forEach(pid => syncFillsForPath(pid)); };

  const syncTrackOrderFromCanvas = useCallback(() => { if (!fabricCanvas) return; const objs = fabricCanvas.getObjects().filter(o => o.id && !o._isFill); const order = [...objs].reverse().map(o => o.id); setTrackOrder(prev => { if (prev.length === order.length && prev.every((id, i) => id === order[i])) return prev; return order; }); }, [fabricCanvas, setTrackOrder]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = new fabric.Canvas(canvasRef.current, { width:CANVAS_WIDTH, height:CANVAS_HEIGHT, backgroundColor:canvasBgColor, selection:true, selectionColor:'rgba(100,100,255,0.3)', selectionBorderColor:'rgba(50,50,200,0.8)', selectionLineWidth:2 });
    setFabricCanvas(canvas);
    canvas.on('object:added', (e) => { if (e.target && !e.target._isFill && e.target.controls?.mtr) e.target.controls.mtr.render = renderRotationControl; });
    canvas.on('selection:created', (e) => { setHasActiveSelection(true); if (e.selected?.length===1) { setSelectedObject(e.selected[0].id); updateProps(e.selected[0]); } else if (e.selected?.length>1) { setSelectedObject(null); updateProps(e.selected[0]); } });
    canvas.on('selection:updated', (e) => { setHasActiveSelection(true); if (e.selected?.length===1) { setSelectedObject(e.selected[0].id); updateProps(e.selected[0]); } else if (e.selected?.length>1) { setSelectedObject(null); updateProps(e.selected[0]); } });
    canvas.on('selection:cleared', () => { setHasActiveSelection(false); setSelectedObject(null); });
    canvas.on('object:moving', (e) => { if (e.target) { updateProps(e.target); syncAllFills(); canvas.renderAll(); } });
    canvas.on('object:scaling', (e) => { if (e.target) { updateProps(e.target); syncAllFills(); canvas.renderAll(); } });
    canvas.on('object:rotating', (e) => { if (e.target) { updateProps(e.target); syncAllFills(); canvas.renderAll(); } });
    canvas.on('object:modified', (e) => { if (e.target) { updateProps(e.target); if (e.target.type==='path') setCanvasObjects(prev => prev.map(obj => obj.id===e.target.id ? {...obj,pathData:e.target.path,strokeColor:e.target.stroke,strokeWidth:e.target.strokeWidth,boundingBox:{width:e.target.width,height:e.target.height},pathOffsetX:e.target.pathOffset?.x||0,pathOffsetY:e.target.pathOffset?.y||0} : obj)); syncAllFills(); canvas.renderAll(); } });
    canvas.on('mouse:down', (e) => { if (e.target) { setIsInteracting(true); interactingObjectRef.current = e.target.id; } });
    canvas.on('mouse:up', () => { setIsInteracting(false); interactingObjectRef.current = null; });
    canvas.on('mouse:dblclick', (e) => { if (e.target?.type==='text') { const t=prompt('Enter new text:',e.target.text); if (t!=null&&t!=='') { e.target.set('text',t); canvas.renderAll(); setCanvasObjects(prev=>prev.map(obj=>obj.id===e.target.id?{...obj,textContent:t}:obj)); } } });
    return () => { canvas.dispose(); };
  }, []);

  const updateProps = (fo) => { const p = extractPropertiesFromFabricObject(fo); if (p) setSelectedObjectProperties(p); };
  useEffect(() => { if (!fabricCanvas) return; fabricCanvas.backgroundColor = canvasBgColor; fabricCanvas.renderAll(); }, [canvasBgColor, fabricCanvas]);

  // Selected keyframe effect
  useEffect(() => {
    if (!fabricCanvas || !selectedKeyframe || isPlaying || isInteracting || drawingMode || fillToolActive) return;
    if (fabricCanvas.getActiveObject()?.type==='activeSelection') fabricCanvas.discardActiveObject();
    const {objectId,index}=selectedKeyframe; const objKfs=keyframes[objectId]||[]; if (index<0||index>=objKfs.length) return;
    const kf=objKfs[index]; const t=kf.time; const gzs=findGlobalZSwapPoint(keyframes,t);
    const fo=findFabricObjectById(fabricCanvas,objectId);
    if (fo&&kf.properties) { fo.set({left:kf.properties.x,top:kf.properties.y,scaleX:kf.properties.scaleX,scaleY:kf.properties.scaleY,angle:kf.properties.rotation,opacity:kf.properties.opacity}); fo._targetZIndex=kf.properties.zIndex??0; fo.setCoords(); fabricCanvas.setActiveObject(fo); }
    canvasObjects.forEach(obj => { if (obj.id===objectId) return; const ok=keyframes[obj.id]||[]; if (!ok.length) return; const ofo=findFabricObjectById(fabricCanvas,obj.id); if (!ofo) return; const {before,after}=findSurroundingKeyframes(ok,t); if (before&&after) { let e='linear'; if (before!==after) e=after.easing||'linear'; const interp=interpolateProperties(before,after,t,e,gzs); if (interp) { applyPropertiesToFabricObject(ofo,interp); ofo.setCoords(); } } });
    applyZIndexOrdering(fabricCanvas); syncTrackOrderFromCanvas(); syncAllFills(); fabricCanvas.renderAll();
    const props=extractPropertiesFromFabricObject(fo); if (props) setSelectedObjectProperties(props);
  }, [selectedKeyframe, fabricCanvas, keyframes, isPlaying, drawingMode, fillToolActive, canvasObjects, syncTrackOrderFromCanvas]);

  // Fill tool effect
  useEffect(() => {
    if (!fabricCanvas || !fillToolActive) return;
    fabricCanvas.selection=false; fabricCanvas.forEachObject(o=>{o.selectable=false;o.evented=false;}); fabricCanvas.discardActiveObject(); fabricCanvas.renderAll();
    const handleClick = (e) => { const ptr=getCanvasPointer(fabricCanvas,e.e); const res=performFloodFill(fabricCanvas,CANVAS_WIDTH,CANVAS_HEIGHT,ptr.x,ptr.y,fillToolColor,40); if (!res) return; const pid=findParentPath(res,fabricCanvas,canvasObjectsRef.current); const img=new Image(); img.onload=()=>{ let rl=0,rt=0; if(pid){ const pfo=fabricCanvas.getObjects().find(o=>o.id===pid); if(pfo){rl=res.left-pfo.left;rt=res.top-pfo.top;} } const fid=`_fill_${Date.now()}`; const fi=new fabric.Image(img,{left:res.left,top:res.top,width:res.width,height:res.height,originX:'left',originY:'top',selectable:false,evented:false,id:fid}); fi._isFill=true;fi._parentId=pid;fi._relLeft=rl;fi._relTop=rt; fabricCanvas.add(fi); try{fabricCanvas.sendObjectToBack?.(fi)||fabricCanvas.sendToBack?.(fi);}catch(e){} fabricCanvas.renderAll(); if(pid) setCanvasObjects(prev=>prev.map(o=>o.id===pid?{...o,fills:[...(o.fills||[]),{id:fid,dataURL:res.dataURL,left:res.left,top:res.top,width:res.width,height:res.height,color:fillToolColor,relLeft:rl,relTop:rt}]}:o)); }; img.src=res.dataURL; };
    const handleKey = (e) => { if (e.key==='Escape') setFillToolActive(false); };
    fabricCanvas.on('mouse:down',handleClick); window.addEventListener('keydown',handleKey);
    return () => { fabricCanvas.off('mouse:down',handleClick); window.removeEventListener('keydown',handleKey); if(fabricCanvas){fabricCanvas.selection=true;fabricCanvas.forEachObject(o=>{if(!o._isFill){o.selectable=true;o.evented=true;}});fabricCanvas.renderAll();} };
  }, [fabricCanvas, fillToolActive, fillToolColor, setCanvasObjects, setFillToolActive]);

  const commitDrawing = () => { if(!fabricCanvas) return; const strokes=committedStrokesRef.current; if(!strokes.length) return; committedStrokePathsRef.current.forEach(p=>{try{fabricCanvas.remove(p);}catch(e){}}); committedStrokePathsRef.current=[]; const id=`path_${Date.now()}`; const count=canvasObjects.filter(o=>o.type==='path').length+1; const name=`Drawing_${count}`; let po; if(strokes.length===1) po=createPathFromPoints(strokes[0],id,drawingSettings); else po=createCompoundPathFromStrokes(strokes,id,drawingSettings); if(po){fabricCanvas.add(po);fabricCanvas.setActiveObject(po);fabricCanvas.renderAll(); setCanvasObjects(prev=>[...prev,{id,type:'path',name,pathData:po.path,strokeColor:drawingSettings.color,strokeWidth:drawingSettings.strokeWidth,fillColor:'',boundingBox:{width:po.width,height:po.height},pathOffsetX:po.pathOffset?.x||0,pathOffsetY:po.pathOffset?.y||0}]); setKeyframes(prev=>({...prev,[id]:[]}));} committedStrokesRef.current=[];setStrokeCount(0); };
  const cancelDrawing = () => { if(!fabricCanvas) return; committedStrokePathsRef.current.forEach(p=>{try{fabricCanvas.remove(p);}catch(e){}}); committedStrokePathsRef.current=[]; committedStrokesRef.current=[]; if(tempPathRef.current){fabricCanvas.remove(tempPathRef.current);tempPathRef.current=null;} isDrawingRef.current=false;drawingPointsRef.current=[];setStrokeCount(0);fabricCanvas.renderAll(); };
  useEffect(() => { if(fabricCanvas){fabricCanvas._commitDrawing=commitDrawing;fabricCanvas._cancelDrawing=cancelDrawing;fabricCanvas._getStrokeCount=()=>committedStrokesRef.current.length;} }, [fabricCanvas,canvasObjects,drawingSettings]);

  useEffect(() => {
    if (!fabricCanvas) return;
    const handleDown = (e) => { if(!drawingMode) return; const ptr=getCanvasPointer(fabricCanvas,e.e); isDrawingRef.current=true; drawingPointsRef.current=[{x:ptr.x,y:ptr.y}]; tempPathRef.current=new fabric.Path(`M ${ptr.x} ${ptr.y}`,{stroke:drawingSettings.color,strokeWidth:drawingSettings.strokeWidth,fill:'',strokeLineCap:'round',strokeLineJoin:'round',selectable:false,evented:false}); fabricCanvas.add(tempPathRef.current); };
    const handleMove = (e) => { if(!drawingMode||!isDrawingRef.current) return; const ptr=getCanvasPointer(fabricCanvas,e.e); drawingPointsRef.current.push({x:ptr.x,y:ptr.y}); if(tempPathRef.current){fabricCanvas.remove(tempPathRef.current); let s=`M ${drawingPointsRef.current[0].x} ${drawingPointsRef.current[0].y}`; for(let i=1;i<drawingPointsRef.current.length;i++) s+=` L ${drawingPointsRef.current[i].x} ${drawingPointsRef.current[i].y}`; tempPathRef.current=new fabric.Path(s,{stroke:drawingSettings.color,strokeWidth:drawingSettings.strokeWidth,fill:'',strokeLineCap:'round',strokeLineJoin:'round',selectable:false,evented:false}); fabricCanvas.add(tempPathRef.current); fabricCanvas.renderAll();} };
    const handleUp = () => { if(!drawingMode||!isDrawingRef.current) return; isDrawingRef.current=false; if(tempPathRef.current){fabricCanvas.remove(tempPathRef.current);tempPathRef.current=null;} if(drawingPointsRef.current.length>2){const pts=[...drawingPointsRef.current]; committedStrokesRef.current.push(pts); setStrokeCount(committedStrokesRef.current.length); const pp=createPathFromPoints(pts,`preview_${Date.now()}`,{...drawingSettings}); if(pp){pp.set({selectable:false,evented:false,opacity:0.6});fabricCanvas.add(pp);committedStrokePathsRef.current.push(pp);fabricCanvas.renderAll();}} drawingPointsRef.current=[]; };
    const handleKey = (e) => { if(!drawingMode) return; if(e.key==='Enter'){e.preventDefault();commitDrawing();return;} if(e.key==='Escape'){cancelDrawing();setDrawingMode(false);return;} };
    if(drawingMode){fabricCanvas.selection=false;fabricCanvas.forEachObject(o=>{if(!o.id?.startsWith('preview_')){o.selectable=false;o.evented=false;}}); fabricCanvas.on('mouse:down',handleDown);fabricCanvas.on('mouse:move',handleMove);fabricCanvas.on('mouse:up',handleUp);window.addEventListener('keydown',handleKey);}
    else{if(committedStrokesRef.current.length>0) commitDrawing(); fabricCanvas.selection=true;fabricCanvas.forEachObject(o=>{if(!o._isFill){o.selectable=true;o.evented=true;}});fabricCanvas.off('mouse:down',handleDown);fabricCanvas.off('mouse:move',handleMove);fabricCanvas.off('mouse:up',handleUp);window.removeEventListener('keydown',handleKey);fabricCanvas.renderAll();}
    return () => { fabricCanvas.off('mouse:down',handleDown);fabricCanvas.off('mouse:move',handleMove);fabricCanvas.off('mouse:up',handleUp);window.removeEventListener('keydown',handleKey); if(fabricCanvas){fabricCanvas.selection=true;fabricCanvas.forEachObject(o=>{if(!o._isFill){o.selectable=true;o.evented=true;}});} };
  }, [fabricCanvas,drawingMode,drawingSettings,canvasObjects,setCanvasObjects,setKeyframes,setDrawingMode]);

  // Main render loop
  useEffect(() => {
    if(!fabricCanvas||isInteracting) return;
    fabricCanvas.forEachObject(o=>{if(!o._isFill){o.visible=true;o.opacity=o.opacity||1;}});
    if(selectedObject&&!isPlaying&&!drawingMode&&!fillToolActive){const fo=findFabricObjectById(fabricCanvas,selectedObject);if(fo&&fabricCanvas.getActiveObject()!==fo) fabricCanvas.setActiveObject(fo);}
    if(isPlaying){if(fabricCanvas.getActiveObject()) fabricCanvas.discardActiveObject(); const gzs=findGlobalZSwapPoint(keyframes,currentTime);
      canvasObjects.forEach(obj=>{const kfs=keyframes[obj.id]||[];if(!kfs.length) return;const fo=findFabricObjectById(fabricCanvas,obj.id);if(!fo) return;const{before,after}=findSurroundingKeyframes(kfs,currentTime);let e='linear';if(before&&after&&before!==after) e=after.easing||'linear';const interp=interpolateProperties(before,after,currentTime,e,gzs);if(interp){applyPropertiesToFabricObject(fo,interp);fo.setCoords();}});
      applyZIndexOrdering(fabricCanvas);}
    syncAllFills();fabricCanvas.renderAll();if(isPlaying) syncTrackOrderFromCanvas();
  }, [currentTime,keyframes,canvasObjects,fabricCanvas,isInteracting,selectedObject,isPlaying,drawingMode,fillToolActive,syncTrackOrderFromCanvas]);

  // Keyboard shortcuts
  useEffect(() => {
    if(!fabricCanvas||isInteracting) return;
    if(selectedObject&&!isPlaying&&!drawingMode&&!fillToolActive){const fo=findFabricObjectById(fabricCanvas,selectedObject);if(fo&&fabricCanvas.getActiveObject()!==fo){fabricCanvas.setActiveObject(fo);fabricCanvas.renderAll();}}
    const handleKey = (e) => {
      if(drawingMode||fillToolActive) return; const tag=e.target.tagName; if(tag==='INPUT'||tag==='TEXTAREA'||e.target.isContentEditable) return;
      if((e.metaKey||e.ctrlKey)&&e.key==='g'&&!e.shiftKey){e.preventDefault();const ao=fabricCanvas.getActiveObjects();if(ao.length>1){const list=[...ao];const ids=list.map(o=>o.id);fabricCanvas.discardActiveObject();list.forEach(o=>fabricCanvas.remove(o));const g=new fabric.Group(list,{id:`group_${Date.now()}`,originX:'center',originY:'center'});fabricCanvas.add(g);fabricCanvas.setActiveObject(g);fabricCanvas.renderAll();setKeyframes(prev=>{const u={...prev};ids.forEach(c=>{delete u[c];});u[g.id]=[];return u;});setCanvasObjects(prev=>[...prev,{id:g.id,type:'group',name:`Group_${canvasObjects.filter(o=>o.type==='group').length+1}`,children:ids}]);setSelectedObject(g.id);}return;}
      if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key==='G'){e.preventDefault();if(!selectedObject) return;const g=fabricCanvas.getObjects().find(o=>o.id===selectedObject);if(!g||g.type!=='group') return;const ri=ungroupFabricGroup(fabricCanvas,g);if(ri.length>0){setCanvasObjects(prev=>prev.filter(o=>o.id!==selectedObject));setKeyframes(prev=>{const u={...prev};delete u[selectedObject];ri.forEach(item=>{if(item.id&&u[item.id]===undefined) u[item.id]=[];});return u;});setSelectedObject(null);setTimeout(()=>{fabricCanvas.forEachObject(o=>{if(!o._isFill){o.visible=true;o.selectable=true;o.evented=true;o.dirty=true;}});fabricCanvas.requestRenderAll();},0);}return;}
      if(e.key==='Delete'||e.key==='Backspace'){const ao=fabricCanvas.getActiveObjects();if(ao.length>0){e.preventDefault();ao.forEach(fo=>{if(fo?.id){const od=canvasObjects.find(o=>o.id===fo.id);fabricCanvas.remove(fo);if(od?.fills?.length>0){const fids=new Set(od.fills.map(f=>f.id));fabricCanvas.getObjects().filter(o=>o._isFill&&fids.has(o.id)).forEach(fi=>fabricCanvas.remove(fi));}setCanvasObjects(prev=>{if(od?.type==='group'&&od.children) return prev.filter(o=>o.id!==fo.id&&!od.children.includes(o.id));return prev.filter(o=>o.id!==fo.id);});setKeyframes(prev=>{const u={...prev};delete u[fo.id];if(od?.type==='group'&&od.children) od.children.forEach(c=>{delete u[c];});return u;});}});fabricCanvas.discardActiveObject();fabricCanvas.renderAll();setSelectedObject(null);}}
    };
    window.addEventListener('keydown',handleKey);return()=>window.removeEventListener('keydown',handleKey);
  }, [fabricCanvas,drawingMode,fillToolActive,canvasObjects,setCanvasObjects,setKeyframes,setSelectedObject,selectedObject]);

  const activeToolLabel = fillToolActive ? '🪣 Paint Bucket Mode' : drawingMode ? '🎨 Drawing Mode' : null;

  return (
    <div className="mb-3 flex flex-col items-center relative">
      {activeToolLabel && (
        <div role="status"
          className={`flex items-center gap-3 mb-2 px-4 py-2.5 rounded-lg w-full border ${fillToolActive ? 'bg-[#e1f5fe] border-[#4fc3f7]' : 'bg-[#fff3e0] border-[#ffb74d]'}`}
          style={{ maxWidth: CANVAS_WIDTH }}>
          <span className="text-[14px] font-semibold text-gray-900">{activeToolLabel}</span>
          {drawingMode && strokeCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#1976d2] text-white">
              {strokeCount} stroke{strokeCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-[13px] text-gray-600 ml-auto">
            {fillToolActive ? 'Click on an enclosed region to fill • Press ESC to exit' : 'Draw strokes • Enter to finish • Esc to cancel'}
          </span>
        </div>
      )}
      <div className="inline-block relative shadow-lg rounded bg-white border border-gray-300">
        <canvas ref={canvasRef} />
        <AnchorPointOverlay />
      </div>
    </div>
  );
};

export default Canvas;