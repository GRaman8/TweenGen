/**
 * Path Utilities — Shape-to-path conversion and path deformation
 *
 * Handles:
 *   - Converting solid shapes (rect, circle, polygon, etc.) to SVG path strings
 *   - Parsing SVG path strings into editable segment arrays
 *   - Serializing segments back to SVG path strings
 *   - Converting line segments to quadratic Bézier curves
 */

// ===================================================================
// Shape → SVG Path conversion
// ===================================================================

/**
 * Convert any solid shape to an SVG path string based on its type.
 * Polygons use their point arrays. CSS shapes are mathematically approximated.
 * All paths use a 0–100 coordinate space matching shapeDefinitions.js.
 *
 * @param {string} shapeType - The shape type key
 * @param {Object} objData - The canvasObjects entry (may contain svgPath, points, etc.)
 * @returns {string} SVG path string
 */
export const shapeToSVGPath = (shapeType, objData) => {
  // If the shape already has an SVG path (SVG-rendered shapes and heart), use it
  if (objData?.svgPath) return objData.svgPath;

  // CSS-rendered shapes need manual path generation
  switch (shapeType) {
    case 'rectangle':
      return 'M 5 5 L 95 5 L 95 95 L 5 95 Z';
    case 'roundedRect':
      return 'M 20 5 L 80 5 Q 95 5 95 20 L 95 80 Q 95 95 80 95 L 20 95 Q 5 95 5 80 L 5 20 Q 5 5 20 5 Z';
    case 'circle':
      return circleToPath(50, 50, 48);
    case 'ellipse':
      return ellipseToPath(50, 50, 48, 38);
    default:
      return '';
  }
};

/**
 * Approximate a circle with 4 cubic Bézier curves.
 * Uses the standard kappa constant for accurate approximation.
 */
const circleToPath = (cx, cy, r) => {
  const k = r * 0.5522847498; // cubic Bézier approximation constant
  return [
    `M ${cx} ${cy - r}`,
    `C ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy}`,
    `C ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r}`,
    `C ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy}`,
    `C ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r}`,
    'Z',
  ].join(' ');
};

/**
 * Approximate an ellipse with 4 cubic Bézier curves.
 */
const ellipseToPath = (cx, cy, rx, ry) => {
  const kx = rx * 0.5522847498;
  const ky = ry * 0.5522847498;
  return [
    `M ${cx} ${cy - ry}`,
    `C ${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry}`,
    `C ${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry}`,
    'Z',
  ].join(' ');
};

// ===================================================================
// SVG Path parsing
// ===================================================================

/**
 * Parse an SVG path string into an array of editable segments.
 *
 * Each segment: { cmd: 'M'|'L'|'Q'|'C'|'Z', x?, y?, cx?, cy?, cx1?, cy1?, cx2?, cy2? }
 *
 * @param {string} pathString - SVG path d attribute
 * @returns {Array} Array of segment objects
 */
export const parsePathString = (pathString) => {
  if (!pathString) return [];

  const segments = [];
  // Tokenize: split on command letters, keeping the letter
  const commands = pathString.match(/[MLQCZHVAZ][^MLQCZHVAZ]*/gi);
  if (!commands) return [];

  for (const raw of commands) {
    const cmd = raw[0].toUpperCase();
    const nums = raw.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

    switch (cmd) {
      case 'M':
        if (nums.length >= 2) segments.push({ cmd: 'M', x: nums[0], y: nums[1] });
        break;
      case 'L':
        // May have multiple implicit L pairs
        for (let i = 0; i < nums.length; i += 2) {
          if (i + 1 < nums.length) segments.push({ cmd: 'L', x: nums[i], y: nums[i + 1] });
        }
        break;
      case 'Q':
        if (nums.length >= 4) segments.push({ cmd: 'Q', cx: nums[0], cy: nums[1], x: nums[2], y: nums[3] });
        break;
      case 'C':
        if (nums.length >= 6) segments.push({ cmd: 'C', cx1: nums[0], cy1: nums[1], cx2: nums[2], cy2: nums[3], x: nums[4], y: nums[5] });
        break;
      case 'H':
        if (nums.length >= 1) segments.push({ cmd: 'L', x: nums[0], y: segments.length > 0 ? (segments[segments.length - 1].y || 0) : 0 });
        break;
      case 'V':
        if (nums.length >= 1) segments.push({ cmd: 'L', x: segments.length > 0 ? (segments[segments.length - 1].x || 0) : 0, y: nums[0] });
        break;
      case 'Z':
        segments.push({ cmd: 'Z' });
        break;
      default:
        break;
    }
  }
  return segments;
};

/**
 * Serialize segments back to an SVG path string.
 *
 * @param {Array} segments - Array of segment objects
 * @returns {string} SVG path d attribute
 */
export const segmentsToPathString = (segments) => {
  return segments.map(seg => {
    switch (seg.cmd) {
      case 'M': return `M ${seg.x.toFixed(1)} ${seg.y.toFixed(1)}`;
      case 'L': return `L ${seg.x.toFixed(1)} ${seg.y.toFixed(1)}`;
      case 'Q': return `Q ${seg.cx.toFixed(1)} ${seg.cy.toFixed(1)} ${seg.x.toFixed(1)} ${seg.y.toFixed(1)}`;
      case 'C': return `C ${seg.cx1.toFixed(1)} ${seg.cy1.toFixed(1)} ${seg.cx2.toFixed(1)} ${seg.cy2.toFixed(1)} ${seg.x.toFixed(1)} ${seg.y.toFixed(1)}`;
      case 'Z': return 'Z';
      default: return '';
    }
  }).join(' ');
};

// ===================================================================
// Segment manipulation
// ===================================================================

/**
 * Get the endpoint of a segment (or start point for M).
 */
export const getSegmentEndpoint = (seg) => {
  if (!seg) return null;
  if (seg.cmd === 'Z') return null;
  return { x: seg.x, y: seg.y };
};

/**
 * Get the start point for a segment by looking at the previous segment.
 * For the first segment (M), return its own point.
 */
export const getSegmentStartPoint = (segments, index) => {
  if (index <= 0) {
    const seg = segments[0];
    return seg ? { x: seg.x, y: seg.y } : { x: 0, y: 0 };
  }
  // Walk backward to find the previous endpoint
  for (let i = index - 1; i >= 0; i--) {
    const ep = getSegmentEndpoint(segments[i]);
    if (ep) return ep;
  }
  return { x: 0, y: 0 };
};

/**
 * Convert a line segment (L) to a quadratic Bézier (Q).
 * The control point is placed at the midpoint of the line,
 * which initially produces the same visual — then the user drags it to curve.
 *
 * @param {Object} fromPoint - { x, y } start of the line
 * @param {Object} segment - The L segment to convert
 * @returns {Object} A Q segment with control point at midpoint
 */
export const lineToQuadratic = (fromPoint, segment) => {
  return {
    cmd: 'Q',
    cx: (fromPoint.x + segment.x) / 2,
    cy: (fromPoint.y + segment.y) / 2,
    x: segment.x,
    y: segment.y,
  };
};

/**
 * Convert a quadratic Bézier (Q) back to a line (L).
 *
 * @param {Object} segment - The Q segment
 * @returns {Object} An L segment to the same endpoint
 */
export const quadraticToLine = (segment) => {
  return { cmd: 'L', x: segment.x, y: segment.y };
};

/**
 * Compute the bounding box of a set of segments.
 * @returns {{ minX, minY, maxX, maxY, width, height }}
 */
export const getSegmentsBoundingBox = (segments) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  segments.forEach(seg => {
    if (seg.x !== undefined) { minX = Math.min(minX, seg.x); maxX = Math.max(maxX, seg.x); }
    if (seg.y !== undefined) { minY = Math.min(minY, seg.y); maxY = Math.max(maxY, seg.y); }
    if (seg.cx !== undefined) { minX = Math.min(minX, seg.cx); maxX = Math.max(maxX, seg.cx); }
    if (seg.cy !== undefined) { minY = Math.min(minY, seg.cy); maxY = Math.max(maxY, seg.cy); }
    if (seg.cx1 !== undefined) { minX = Math.min(minX, seg.cx1); maxX = Math.max(maxX, seg.cx1); }
    if (seg.cy1 !== undefined) { minY = Math.min(minY, seg.cy1); maxY = Math.max(maxY, seg.cy1); }
    if (seg.cx2 !== undefined) { minX = Math.min(minX, seg.cx2); maxX = Math.max(maxX, seg.cx2); }
    if (seg.cy2 !== undefined) { minY = Math.min(minY, seg.cy2); maxY = Math.max(maxY, seg.cy2); }
  });

  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

// ===================================================================
// Path interpolation — for morphing between keyframes
// ===================================================================

/**
 * Promote a segment to a higher-order type so two segments can be interpolated.
 *
 * L → Q: control point placed at midpoint (visually identical to a straight line)
 * L → C: control points at 1/3 and 2/3 (visually identical to a straight line)
 * Q → C: elevate quadratic to cubic using standard degree elevation formula
 *
 * @param {Object} seg       - The segment to promote
 * @param {string} targetCmd - The target command type ('Q' or 'C')
 * @param {Object} fromPoint - { x, y } start point of this segment
 * @returns {Object} A new segment with the target command type
 */
const promoteSegment = (seg, targetCmd, fromPoint) => {
  const from = fromPoint || { x: 0, y: 0 };

  if (seg.cmd === 'L' && targetCmd === 'Q') {
    return {
      cmd: 'Q',
      cx: (from.x + seg.x) / 2,
      cy: (from.y + seg.y) / 2,
      x: seg.x,
      y: seg.y,
    };
  }

  if (seg.cmd === 'L' && targetCmd === 'C') {
    return {
      cmd: 'C',
      cx1: from.x + (seg.x - from.x) / 3,
      cy1: from.y + (seg.y - from.y) / 3,
      cx2: from.x + (seg.x - from.x) * 2 / 3,
      cy2: from.y + (seg.y - from.y) * 2 / 3,
      x: seg.x,
      y: seg.y,
    };
  }

  if (seg.cmd === 'Q' && targetCmd === 'C') {
    // Standard quadratic-to-cubic degree elevation
    return {
      cmd: 'C',
      cx1: from.x + (2 / 3) * (seg.cx - from.x),
      cy1: from.y + (2 / 3) * (seg.cy - from.y),
      cx2: seg.x + (2 / 3) * (seg.cx - seg.x),
      cy2: seg.y + (2 / 3) * (seg.cy - seg.y),
      x: seg.x,
      y: seg.y,
    };
  }

  // Already the right type or M/Z — return as-is
  return { ...seg };
};

/**
 * Linearly interpolate a single numeric value.
 */
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Interpolate between two segments of the same type.
 * All coordinates are lerped independently.
 *
 * @param {Object} segA - Segment from path A
 * @param {Object} segB - Segment from path B (same cmd type)
 * @param {number} t    - Interpolation factor (0 = A, 1 = B)
 * @returns {Object} Interpolated segment
 */
const lerpSegment = (segA, segB, t) => {
  if (segA.cmd === 'Z' || segB.cmd === 'Z') {
    return { cmd: 'Z' };
  }

  const result = { cmd: segA.cmd };

  if (segA.x !== undefined) result.x = lerp(segA.x, segB.x, t);
  if (segA.y !== undefined) result.y = lerp(segA.y, segB.y, t);

  // Quadratic control point
  if (segA.cx !== undefined) result.cx = lerp(segA.cx, segB.cx, t);
  if (segA.cy !== undefined) result.cy = lerp(segA.cy, segB.cy, t);

  // Cubic control points
  if (segA.cx1 !== undefined) result.cx1 = lerp(segA.cx1, segB.cx1, t);
  if (segA.cy1 !== undefined) result.cy1 = lerp(segA.cy1, segB.cy1, t);
  if (segA.cx2 !== undefined) result.cx2 = lerp(segA.cx2, segB.cx2, t);
  if (segA.cy2 !== undefined) result.cy2 = lerp(segA.cy2, segB.cy2, t);

  return result;
};

/**
 * Interpolate between two SVG path strings.
 *
 * Both paths must have the same number of segments. If segment types differ
 * at the same index (e.g., one is L and the other is Q), the simpler one
 * is promoted to match the more complex one before interpolation.
 *
 * This is what makes "triangle → cone" morphing work:
 *   - Triangle has L (straight) on its bottom edge
 *   - Cone has Q (curve) on its bottom edge
 *   - The L is promoted to Q with control point at midpoint
 *   - Interpolation smoothly moves that control point from midpoint to the arc position
 *
 * @param {string} pathA - SVG path string at t=0
 * @param {string} pathB - SVG path string at t=1
 * @param {number} t     - Interpolation factor (0 = pathA, 1 = pathB)
 * @returns {string} Interpolated SVG path string
 */
export const interpolatePathStrings = (pathA, pathB, t) => {
  if (!pathA || !pathB) return pathB || pathA || '';
  if (t <= 0) return pathA;
  if (t >= 1) return pathB;

  const segsA = parsePathString(pathA);
  const segsB = parsePathString(pathB);

  // If segment counts don't match, can't interpolate — snap at halfway
  if (segsA.length !== segsB.length) {
    return t < 0.5 ? pathA : pathB;
  }

  const result = [];

  for (let i = 0; i < segsA.length; i++) {
    let a = segsA[i];
    let b = segsB[i];

    // If commands match, interpolate directly
    if (a.cmd === b.cmd) {
      result.push(lerpSegment(a, b, t));
      continue;
    }

    // Commands differ — promote the simpler one
    const fromA = getSegmentStartPoint(segsA, i);
    const fromB = getSegmentStartPoint(segsB, i);

    // Determine which command is "higher order"
    const order = { M: 0, L: 1, Q: 2, C: 3, Z: 0 };
    const orderA = order[a.cmd] ?? 0;
    const orderB = order[b.cmd] ?? 0;

    if (orderA < orderB) {
      // Promote A to match B's type
      a = promoteSegment(a, b.cmd, fromA);
    } else {
      // Promote B to match A's type
      b = promoteSegment(b, a.cmd, fromB);
    }

    result.push(lerpSegment(a, b, t));
  }

  return segmentsToPathString(result);
};

/**
 * Minimal standalone interpolation function as a string,
 * for embedding in exported animation code.
 * This is the same logic as interpolatePathStrings but as a self-contained JS string.
 */
export const PATH_INTERP_CODE = `
function interpolatePaths(pathA, pathB, t) {
  if (t <= 0) return pathA;
  if (t >= 1) return pathB;

  var reCmd = /[MLQCZHVAZ][^MLQCZHVAZ]*/gi;
  function parse(d) {
    var segs = [];
    var cmds = d.match(reCmd) || [];
    for (var k = 0; k < cmds.length; k++) {
      var raw = cmds[k];
      var c = raw[0].toUpperCase();
      var nums = raw.slice(1).trim().split(/[\\s,]+/).map(Number).filter(function(n){ return !isNaN(n); });
      if (c === 'M' && nums.length >= 2) segs.push({ c:'M', v:[nums[0],nums[1]] });
      else if (c === 'L') { for (var j=0;j<nums.length;j+=2) if(j+1<nums.length) segs.push({c:'L',v:[nums[j],nums[j+1]]}); }
      else if (c === 'Q' && nums.length >= 4) segs.push({ c:'Q', v:[nums[0],nums[1],nums[2],nums[3]] });
      else if (c === 'C' && nums.length >= 6) segs.push({ c:'C', v:[nums[0],nums[1],nums[2],nums[3],nums[4],nums[5]] });
      else if (c === 'Z') segs.push({ c:'Z', v:[] });
    }
    return segs;
  }

  function toStr(segs) {
    return segs.map(function(s) {
      return s.c + (s.v.length ? ' ' + s.v.map(function(n){return n.toFixed(1);}).join(' ') : '');
    }).join(' ');
  }

  function promote(seg, targetC, prev) {
    var px = prev ? prev[prev.length-2] || 0 : 0;
    var py = prev ? prev[prev.length-1] || 0 : 0;
    if (seg.c === 'L' && targetC === 'Q') return {c:'Q',v:[(px+seg.v[0])/2,(py+seg.v[1])/2,seg.v[0],seg.v[1]]};
    if (seg.c === 'L' && targetC === 'C') return {c:'C',v:[px+(seg.v[0]-px)/3,py+(seg.v[1]-py)/3,px+(seg.v[0]-px)*2/3,py+(seg.v[1]-py)*2/3,seg.v[0],seg.v[1]]};
    if (seg.c === 'Q' && targetC === 'C') return {c:'C',v:[px+(2/3)*(seg.v[0]-px),py+(2/3)*(seg.v[1]-py),seg.v[2]+(2/3)*(seg.v[0]-seg.v[2]),seg.v[3]+(2/3)*(seg.v[1]-seg.v[3]),seg.v[2],seg.v[3]]};
    return seg;
  }

  var sa = parse(pathA), sb = parse(pathB);
  if (sa.length !== sb.length) return t < 0.5 ? pathA : pathB;

  var ord = {M:0,L:1,Q:2,C:3,Z:0};
  var res = [];
  for (var i = 0; i < sa.length; i++) {
    var a = sa[i], b = sb[i];
    var prevA = i > 0 ? sa[i-1].v : [];
    var prevB = i > 0 ? sb[i-1].v : [];
    if (a.c !== b.c) {
      if ((ord[a.c]||0) < (ord[b.c]||0)) a = promote(a, b.c, prevA);
      else b = promote(b, a.c, prevB);
    }
    if (a.c === 'Z') { res.push({c:'Z',v:[]}); continue; }
    var v = [];
    for (var j = 0; j < a.v.length; j++) v.push(a.v[j] + (b.v[j] - a.v[j]) * t);
    res.push({ c: a.c, v: v });
  }
  return toStr(res);
}
`;