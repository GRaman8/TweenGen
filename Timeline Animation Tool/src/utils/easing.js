export const EASING_FUNCTIONS = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeInCubic: (t) => t * t * t,
  easeInQuart: (t) => t * t * t * t,
  easeInQuint: (t) => t * t * t * t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeOutQuart: (t) => 1 - (--t) * t * t * t,
  easeOutQuint: (t) => 1 + (--t) * t * t * t * t,
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  easeInOutQuint: (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
  bounce: (t) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    else if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    else if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    else return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
  elastic: (t) => {
    if (t === 0 || t === 1) return t;
    const p = 0.3; const s = p / 4;
    return Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
  },
};

export const EASING_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeInQuad', label: 'Ease In (Quad)' },
  { value: 'easeOutQuad', label: 'Ease Out (Quad)' },
  { value: 'easeInOutQuad', label: 'Ease In-Out (Quad)' },
  { value: 'easeInCubic', label: 'Ease In (Cubic)' },
  { value: 'easeOutCubic', label: 'Ease Out (Cubic)' },
  { value: 'easeInOutCubic', label: 'Ease In-Out (Cubic)' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'elastic', label: 'Elastic' },
];

export const applyEasing = (t, easingType = 'linear') => {
  const easingFunc = EASING_FUNCTIONS[easingType] || EASING_FUNCTIONS.linear;
  return easingFunc(Math.max(0, Math.min(1, t)));
};