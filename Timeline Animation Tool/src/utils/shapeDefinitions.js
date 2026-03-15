import * as fabric from 'fabric';

const regularPolygon = (sides, r = 47, cx = 50, cy = 50) =>
  Array.from({ length: sides }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });

const starPolygon = (tips, outerR = 47, innerR = 20, cx = 50, cy = 50) => {
  const pts = [];
  for (let i = 0; i < tips * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / tips;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
};

const pointsToPath = (pts) =>
  'M ' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ') + ' Z';

const TRIANGLE_PTS = [{ x: 50, y: 3 }, { x: 97, y: 97 }, { x: 3, y: 97 }];
const DIAMOND_PTS  = [{ x: 50, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 50 }];
const PENTAGON_PTS = regularPolygon(5);
const HEXAGON_PTS  = regularPolygon(6);
const STAR_PTS     = starPolygon(5, 47, 19);
const ARROW_PTS    = [{ x: 0, y: 30 }, { x: 60, y: 30 }, { x: 60, y: 5 }, { x: 100, y: 50 }, { x: 60, y: 95 }, { x: 60, y: 70 }, { x: 0, y: 70 }];
const CROSS_PTS = [{ x: 33, y: 0 }, { x: 67, y: 0 }, { x: 67, y: 33 }, { x: 100, y: 33 }, { x: 100, y: 67 }, { x: 67, y: 67 }, { x: 67, y: 100 }, { x: 33, y: 100 }, { x: 33, y: 67 }, { x: 0, y: 67 }, { x: 0, y: 33 }, { x: 33, y: 33 }];
const HEART_PATH = 'M 50 88 C 25 68 2 45 2 28 C 2 10 18 2 34 2 C 44 2 50 12 50 18 C 50 12 56 2 66 2 C 82 2 98 10 98 28 C 98 45 75 68 50 88 Z';
const ROUNDED_RECT_PATH = 'M 15 0 L 85 0 Q 100 0 100 15 L 100 85 Q 100 100 85 100 L 15 100 Q 0 100 0 85 L 0 15 Q 0 0 15 0 Z';

const BASE = (id) => ({ id, left: 350, top: 250, originX: 'center', originY: 'center' });

export const SHAPES = [
  { key: 'rectangle', label: 'Rectangle', defaultFill: '#3b82f6', renderMode: 'css', svgPath: 'M 5 5 L 95 5 L 95 95 L 5 95 Z', fabricCreate: (id, fill) => new fabric.Rect({ ...BASE(id), width: 100, height: 100, fill }) },
  { key: 'circle', label: 'Circle', defaultFill: '#ef4444', renderMode: 'css', svgPath: 'M 50 2 A 48 48 0 1 1 50 98 A 48 48 0 1 1 50 2 Z', fabricCreate: (id, fill) => new fabric.Circle({ ...BASE(id), radius: 50, fill }) },
  { key: 'roundedRect', label: 'Rounded Rect', defaultFill: '#0ea5e9', renderMode: 'css', svgPath: ROUNDED_RECT_PATH, fabricCreate: (id, fill) => new fabric.Rect({ ...BASE(id), width: 100, height: 100, rx: 16, ry: 16, fill }) },
  { key: 'ellipse', label: 'Ellipse', defaultFill: '#a855f7', renderMode: 'css', svgPath: 'M 50 10 A 48 38 0 1 1 50 90 A 48 38 0 1 1 50 10 Z', fabricCreate: (id, fill) => new fabric.Ellipse({ ...BASE(id), rx: 50, ry: 38, fill }) },
  { key: 'triangle', label: 'Triangle', defaultFill: '#10b981', renderMode: 'svg', svgPath: pointsToPath(TRIANGLE_PTS), points: TRIANGLE_PTS, fabricCreate: (id, fill) => new fabric.Polygon(TRIANGLE_PTS, { ...BASE(id), fill }) },
  { key: 'diamond', label: 'Diamond', defaultFill: '#8b5cf6', renderMode: 'svg', svgPath: pointsToPath(DIAMOND_PTS), points: DIAMOND_PTS, fabricCreate: (id, fill) => new fabric.Polygon(DIAMOND_PTS, { ...BASE(id), fill }) },
  { key: 'pentagon', label: 'Pentagon', defaultFill: '#f59e0b', renderMode: 'svg', svgPath: pointsToPath(PENTAGON_PTS), points: PENTAGON_PTS, fabricCreate: (id, fill) => new fabric.Polygon(PENTAGON_PTS, { ...BASE(id), fill }) },
  { key: 'hexagon', label: 'Hexagon', defaultFill: '#06b6d4', renderMode: 'svg', svgPath: pointsToPath(HEXAGON_PTS), points: HEXAGON_PTS, fabricCreate: (id, fill) => new fabric.Polygon(HEXAGON_PTS, { ...BASE(id), fill }) },
  { key: 'star', label: 'Star', defaultFill: '#f97316', renderMode: 'svg', svgPath: pointsToPath(STAR_PTS), points: STAR_PTS, fabricCreate: (id, fill) => new fabric.Polygon(STAR_PTS, { ...BASE(id), fill }) },
  { key: 'arrow', label: 'Arrow', defaultFill: '#6366f1', renderMode: 'svg', svgPath: pointsToPath(ARROW_PTS), points: ARROW_PTS, fabricCreate: (id, fill) => new fabric.Polygon(ARROW_PTS, { ...BASE(id), fill }) },
  { key: 'heart', label: 'Heart', defaultFill: '#ec4899', renderMode: 'svg', svgPath: HEART_PATH, fabricCreate: (id, fill) => new fabric.Path(HEART_PATH, { ...BASE(id), fill, scaleX: 1, scaleY: 1 }) },
  { key: 'cross', label: 'Cross', defaultFill: '#14b8a6', renderMode: 'svg', svgPath: pointsToPath(CROSS_PTS), points: CROSS_PTS, fabricCreate: (id, fill) => new fabric.Polygon(CROSS_PTS, { ...BASE(id), fill }) },
];

export const getShapeDef = (key) => SHAPES.find((s) => s.key === key);
export const SVG_SHAPE_KEYS = new Set(SHAPES.filter((s) => s.renderMode === 'svg').map((s) => s.key));