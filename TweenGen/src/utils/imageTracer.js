/**
 * Image-to-SVG Vectorization Utility
 * 
 * Converts bitmap images (PNG/JPG) into true SVG vector paths using
 * color quantization and contour tracing via imagetracerjs.
 * 
 * The output is NOT a bitmap wrapped in SVG — it is actual mathematical
 * <path> elements with fill colors. This means:
 *   - Zooming in stays sharp (no pixelation)
 *   - The HTML source shows <path d="..."> not base64 blobs
 *   - The visual appearance is intentionally different (vectorized/stylized)
 */
import ImageTracer from 'imagetracerjs';

// ===================================================================
// Trace presets — meaningful options with distinct visual results
// ===================================================================

export const TRACE_PRESETS = [
  {
    key: 'detailed',
    label: 'Detailed',
    description: 'High fidelity — many colors and fine detail',
    options: {
      numberofcolors: 64,
      pathomit: 4,
      ltres: 0.5,
      qtres: 0.5,
      scale: 1,
      roundcoords: 2,
    },
  },
  {
    key: 'posterized',
    label: 'Posterized',
    description: 'Stylized look — reduced color palette',
    options: {
      numberofcolors: 8,
      pathomit: 6,
      ltres: 1,
      qtres: 1,
      scale: 1,
      roundcoords: 2,
    },
  },
  {
    key: 'sharp',
    label: 'Sharp',
    description: 'Crisp edges — good for icons and logos',
    options: {
      numberofcolors: 16,
      pathomit: 4,
      ltres: 0.1,
      qtres: 0.1,
      scale: 1,
      roundcoords: 2,
    },
  },
  {
    key: 'smooth',
    label: 'Smooth',
    description: 'Rounded curves — soft, artistic result',
    options: {
      numberofcolors: 16,
      pathomit: 8,
      ltres: 2,
      qtres: 2,
      scale: 1,
      roundcoords: 2,
    },
  },
  {
    key: 'minimal',
    label: 'Minimal',
    description: 'Very few colors — strong graphic/poster effect',
    options: {
      numberofcolors: 4,
      pathomit: 10,
      ltres: 1,
      qtres: 1,
      scale: 1,
      roundcoords: 2,
    },
  },
];

export const getPreset = (key) => TRACE_PRESETS.find(p => p.key === key) || TRACE_PRESETS[0];

// ===================================================================
// Core tracing function
// ===================================================================

/**
 * Trace a bitmap image (data URL) to SVG string.
 * 
 * @param {string} dataURL - The image as a data URL (data:image/png;base64,...)
 * @param {string} presetKey - One of the TRACE_PRESETS keys
 * @returns {Promise<string>} The SVG markup string containing <path> elements
 */
export const traceImageToSVG = (dataURL, presetKey = 'detailed') => {
  return new Promise((resolve, reject) => {
    try {
      const preset = getPreset(presetKey);
      const options = { ...preset.options };
      
      ImageTracer.imageToSVG(
        dataURL,
        (svgString) => {
          if (svgString && svgString.trim().length > 0) {
            resolve(svgString);
          } else {
            reject(new Error('Tracing produced empty result'));
          }
        },
        options,
      );
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Extract just the inner SVG content (paths) and viewBox dimensions
 * from a full SVG string produced by imagetracerjs.
 * This is useful for embedding the SVG content inside a sized container.
 * 
 * @param {string} svgString - Full SVG markup from traceImageToSVG
 * @returns {{ width: number, height: number, innerSVG: string, fullSVG: string }}
 */
export const parseSVGDimensions = (svgString) => {
  // Extract width and height from the SVG tag
  const widthMatch = svgString.match(/width="(\d+(?:\.\d+)?)"/);
  const heightMatch = svgString.match(/height="(\d+(?:\.\d+)?)"/);
  const width = widthMatch ? parseFloat(widthMatch[1]) : 100;
  const height = heightMatch ? parseFloat(heightMatch[1]) : 100;

  // Extract inner content (everything between <svg ...> and </svg>)
  const innerMatch = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const innerSVG = innerMatch ? innerMatch[1].trim() : '';

  return { width, height, innerSVG, fullSVG: svgString };
};

/**
 * Create a sized SVG string with a viewBox that matches the original image dimensions.
 * This ensures the vector version scales identically to the bitmap.
 * 
 * @param {string} svgString - Full SVG from traceImageToSVG
 * @param {number} targetWidth - Desired display width (original image width)
 * @param {number} targetHeight - Desired display height (original image height)
 * @returns {string} SVG string with proper viewBox and dimensions
 */
export const createSizedSVG = (svgString, targetWidth, targetHeight) => {
  const { width: traceW, height: traceH, innerSVG } = parseSVGDimensions(svgString);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${traceW} ${traceH}" ` +
    `width="${targetWidth}" height="${targetHeight}" ` +
    `preserveAspectRatio="none" ` +
    `style="display:block">` +
    `${innerSVG}</svg>`;
};

// ===================================================================
// Canvas preview — rasterize SVG for Fabric.js display
// ===================================================================

/**
 * Rasterize a traced SVG string to a PNG data URL at specified dimensions.
 * 
 * Used to show the vectorized preview directly on the Fabric.js canvas
 * so the user sees the stylized result while editing. The canvas always
 * works with bitmaps internally — this converts the SVG paths into a
 * rasterized PNG that Fabric.js can display.
 * 
 * @param {string} svgString - Full SVG markup from traceImageToSVG
 * @param {number} targetWidth - Desired width (original image width)
 * @param {number} targetHeight - Desired height (original image height)
 * @returns {Promise<string>} PNG data URL of the rasterized vector preview
 */
export const rasterizeSVG = (svgString, targetWidth, targetHeight) => {
  return new Promise((resolve, reject) => {
    const sizedSVG = createSizedSVG(svgString, targetWidth, targetHeight);
    const blob = new Blob([sizedSVG], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize SVG for canvas preview'));
    };
    img.src = url;
  });
};