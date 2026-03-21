import * as fabric from 'fabric';

/**
 * Custom render function for the rotation (mtr) control.
 * Draws a distinct orange circle so it's visually different from the blue square resize handles.
 */
export const renderRotationControl = (ctx, left, top, styleOverride, fabricObject) => {
  const size = fabricObject.cornerSize || 13;
  ctx.save();
  ctx.translate(left, top);

  // Outer circle — orange fill
  ctx.beginPath();
  ctx.arc(0, 0, size / 2 + 1, 0, Math.PI * 2);
  ctx.fillStyle = '#ff6b00';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Small curved arrow hint inside the circle
  const r = size / 4;
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.75, Math.PI * 0.55);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.restore();
};

/**
 * Create a new Fabric.js object based on type.
 * ALL objects use originX:'center', originY:'center' so left/top = center.
 * Now accepts optional fill color.
 */
export const createFabricObject = (type, id, options = {}) => {
  const baseProps = {
    id,
    left: 100,
    top: 100,
    originX: 'center',
    originY: 'center',
  };

  switch (type) {
    case 'rectangle':
      return new fabric.Rect({
        ...baseProps,
        width: 100,
        height: 100,
        fill: options.fill || '#3b82f6',
      });
    
    case 'circle':
      return new fabric.Circle({
        ...baseProps,
        radius: 50,
        fill: options.fill || '#ef4444',
      });
    
    case 'text':
      return new fabric.Text('Text', {
        ...baseProps,
        fontSize: 24,
        fill: options.fill || '#000000',
      });
    
    case 'path':
      return null;
      
    default:
      return null;
  }
};

/**
 * Create a path object from drawn points (single stroke)
 */
export const createPathFromPoints = (points, id, settings) => {
  if (points.length < 2) return null;

  let pathString = `M ${points[0].x} ${points[0].y}`;
  
  if (settings.smoothing && points.length > 2) {
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      pathString += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
    }
    const lastPoint = points[points.length - 1];
    pathString += ` L ${lastPoint.x} ${lastPoint.y}`;
  } else {
    for (let i = 1; i < points.length; i++) {
      pathString += ` L ${points[i].x} ${points[i].y}`;
    }
  }

  const path = new fabric.Path(pathString, {
    id,
    stroke: settings.color,
    strokeWidth: settings.strokeWidth,
    fill: '',
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    selectable: true,
    originX: 'center',
    originY: 'center',
  });

  return path;
};

/**
 * Create a COMPOUND path from multiple stroke arrays.
 */
export const createCompoundPathFromStrokes = (strokes, id, settings) => {
  if (!strokes || strokes.length === 0) return null;

  let pathString = '';

  strokes.forEach((points, strokeIndex) => {
    if (points.length < 2) return;

    if (pathString.length > 0) pathString += ' ';

    pathString += `M ${points[0].x} ${points[0].y}`;

    if (settings.smoothing && points.length > 2) {
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        pathString += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
      }
      const lastPoint = points[points.length - 1];
      pathString += ` L ${lastPoint.x} ${lastPoint.y}`;
    } else {
      for (let i = 1; i < points.length; i++) {
        pathString += ` L ${points[i].x} ${points[i].y}`;
      }
    }
  });

  if (!pathString) return null;

  const path = new fabric.Path(pathString, {
    id,
    stroke: settings.color,
    strokeWidth: settings.strokeWidth,
    fill: '',
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    selectable: true,
    originX: 'center',
    originY: 'center',
  });

  return path;
};

/**
 * Extract properties from a Fabric.js object.
 * Now includes fill color for color animation between keyframes.
 */
export const extractPropertiesFromFabricObject = (fabricObject) => {
  if (!fabricObject) return null;

  let zIndex = 0;
  if (fabricObject.canvas) {
    const objects = fabricObject.canvas.getObjects();
    zIndex = objects.indexOf(fabricObject);
    if (zIndex < 0) zIndex = 0;
  }

  // Calculate absolute coordinates safely, resolving ActiveSelections mathematically 
  let absLeft = fabricObject.left || 0;
  let absTop = fabricObject.top || 0;
  let absScaleX = fabricObject.scaleX || 1;
  let absScaleY = fabricObject.scaleY || 1;
  let absAngle = fabricObject.angle || 0;

  if (fabricObject.group && fabricObject.group.type === 'activeSelection') {
    const matrix = fabricObject.calcTransformMatrix();
    const options = fabric.util.qrDecompose(matrix);
    absLeft = options.translateX;
    absTop = options.translateY;
    absScaleX = options.scaleX;
    absScaleY = options.scaleY;
    absAngle = options.angle;
  }

  // Capture fill color: meaningful for shapes and text, empty/undefined for paths and images
  const rawFill = fabricObject.fill;
  const fill = (rawFill && typeof rawFill === 'string' && rawFill.length > 0) ? rawFill : undefined;

  const baseProps = {
    x: absLeft,
    y: absTop,
    scaleX: absScaleX,
    scaleY: absScaleY,
    rotation: absAngle,
    opacity: fabricObject.opacity !== undefined ? fabricObject.opacity : 1,
    zIndex,
    fill,
  };
  
  if (fabricObject.type === 'path') {
    return {
      ...baseProps,
      pathData: fabricObject.path,
      strokeColor: fabricObject.stroke,
      strokeWidth: fabricObject.strokeWidth,
      pathOffsetX: fabricObject.pathOffset?.x || 0,
      pathOffsetY: fabricObject.pathOffset?.y || 0,
    };
  }

  return baseProps;
};

/**
 * Find a Fabric.js object by ID - searches inside active selections as well
 */
export const findFabricObjectById = (canvas, id) => {
  if (!canvas) return null;
  let obj = canvas.getObjects().find(o => o.id === id);
  if (!obj) {
    const active = canvas.getActiveObject();
    if (active && active.type === 'activeSelection' && active._objects) {
      obj = active._objects.find(o => o.id === id);
    }
  }
  return obj || null;
};

/**
 * Properly ungroup a Fabric.js group.
 */
export const ungroupFabricGroup = (fabricCanvas, group) => {
  if (!fabricCanvas || !group || group.type !== 'group') return [];

  const items = [...(group._objects || [])];
  if (items.length === 0) return [];
  
  const groupMatrix = group.calcTransformMatrix();
  const groupScaleX = group.scaleX || 1;
  const groupScaleY = group.scaleY || 1;
  const groupAngle = group.angle || 0;
  const groupOpacity = group.opacity !== undefined ? group.opacity : 1;

  const childrenData = items.map(item => {
    const localPoint = { x: item.left || 0, y: item.top || 0 };
    const absPoint = fabric.util.transformPoint(localPoint, groupMatrix);
    
    return {
      item,
      absLeft: absPoint.x,
      absTop: absPoint.y,
      absScaleX: groupScaleX * (item.scaleX || 1),
      absScaleY: groupScaleY * (item.scaleY || 1),
      absAngle: groupAngle + (item.angle || 0),
      absOpacity: groupOpacity * (item.opacity !== undefined ? item.opacity : 1),
    };
  });

  fabricCanvas.remove(group);

  const restoredItems = [];
  childrenData.forEach(({ item, absLeft, absTop, absScaleX, absScaleY, absAngle, absOpacity }) => {
    item.group = undefined;
    item.canvas = undefined;
    if (item._cacheCanvas) item._cacheCanvas = null;
    
    item.set({
      left: absLeft,
      top: absTop,
      scaleX: absScaleX,
      scaleY: absScaleY,
      angle: absAngle,
      opacity: absOpacity,
      originX: 'center',
      originY: 'center',
      visible: true,
      selectable: true,
      evented: true,
    });
    
    item.dirty = true;
    fabricCanvas.add(item);
    item.setCoords();
    restoredItems.push(item);
  });

  fabricCanvas.requestRenderAll();
  return restoredItems;
};

/**
 * Change the anchor/pivot point of a Fabric.js object.
 * Uses renderRotationControl to keep the rotation handle visually distinct.
 */
export const changeAnchorPoint = (fabricObject, anchorX, anchorY) => {
  if (!fabricObject) return;
  
  const currentCenter = fabricObject.getCenterPoint();
  const isCenter = Math.abs(anchorX - 0.5) < 0.01 && Math.abs(anchorY - 0.5) < 0.01;
  
  if (!fabricObject._hasCustomControls) {
    fabricObject.controls = Object.assign({}, fabricObject.controls);
    fabricObject._hasCustomControls = true;
  }
  
  const existingMtr = fabricObject.controls.mtr;
  
  if (isCenter) {
    fabricObject.centeredRotation = true;
    fabricObject.set({ originX: 'center', originY: 'center' });
    fabricObject.controls.mtr = new fabric.Control({
      x: 0, y: -0.5, offsetY: existingMtr?.offsetY ?? -40,
      cursorStyleHandler: existingMtr?.cursorStyleHandler,
      actionHandler: existingMtr?.actionHandler,
      actionName: 'rotate', withConnection: true,
      render: renderRotationControl,
    });
  } else {
    fabricObject.centeredRotation = false;
    fabricObject.set({ originX: anchorX, originY: anchorY });
    fabricObject.controls.mtr = new fabric.Control({
      x: anchorX - 0.5, y: anchorY - 0.5, offsetY: existingMtr?.offsetY ?? -40,
      cursorStyleHandler: existingMtr?.cursorStyleHandler,
      actionHandler: existingMtr?.actionHandler,
      actionName: 'rotate', withConnection: true,
      render: renderRotationControl,
    });
  }
  
  fabricObject.setPositionByOrigin(
    new fabric.Point(currentCenter.x, currentCenter.y),
    'center', 'center'
  );
  
  fabricObject.dirty = true;
  fabricObject.setCoords();
};