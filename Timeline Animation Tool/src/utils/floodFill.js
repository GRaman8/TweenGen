const hexToRgb = (hex) => {
  const clean = hex.replace('#', '');
  return { r: parseInt(clean.substring(0, 2), 16), g: parseInt(clean.substring(2, 4), 16), b: parseInt(clean.substring(4, 6), 16) };
};

const scanlineFill = (imageData, startX, startY, fillRgb, tolerance) => {
  const { width, height, data } = imageData;
  startX = Math.max(0, Math.min(width - 1, Math.round(startX)));
  startY = Math.max(0, Math.min(height - 1, Math.round(startY)));
  const startIdx = (startY * width + startX) * 4;
  const targetR = data[startIdx]; const targetG = data[startIdx + 1]; const targetB = data[startIdx + 2]; const targetA = data[startIdx + 3];
  if (Math.abs(targetR - fillRgb.r) < 5 && Math.abs(targetG - fillRgb.g) < 5 && Math.abs(targetB - fillRgb.b) < 5 && targetA > 240) return null;
  const filled = new Uint8Array(width * height);
  let pixelCount = 0; let minX = width, maxX = 0, minY = height, maxY = 0;
  const matches = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (y * width + x) * 4;
    return Math.abs(data[idx] - targetR) + Math.abs(data[idx + 1] - targetG) + Math.abs(data[idx + 2] - targetB) + Math.abs(data[idx + 3] - targetA) <= tolerance;
  };
  const stack = [[startX, startY]];
  while (stack.length > 0) {
    let [x, y] = stack.pop();
    while (y >= 0 && matches(x, y) && !filled[y * width + x]) y--;
    y++;
    let spanLeft = false, spanRight = false;
    while (y < height && matches(x, y) && !filled[y * width + x]) {
      filled[y * width + x] = 1; pixelCount++;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      const leftMatch = x > 0 && matches(x - 1, y) && !filled[y * width + (x - 1)];
      if (!spanLeft && leftMatch) { stack.push([x - 1, y]); spanLeft = true; } else if (spanLeft && !leftMatch) spanLeft = false;
      const rightMatch = x < width - 1 && matches(x + 1, y) && !filled[y * width + (x + 1)];
      if (!spanRight && rightMatch) { stack.push([x + 1, y]); spanRight = true; } else if (spanRight && !rightMatch) spanRight = false;
      y++;
    }
  }
  if (pixelCount < 10) return null;
  return { filled, minX, maxX, minY, maxY, pixelCount };
};

const createFillImage = (filled, fillRgb, fullWidth, minX, minY, maxX, maxY) => {
  const cropW = maxX - minX + 1; const cropH = maxY - minY + 1;
  const offscreen = document.createElement('canvas'); offscreen.width = cropW; offscreen.height = cropH;
  const ctx = offscreen.getContext('2d'); const imgData = ctx.createImageData(cropW, cropH);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (filled[y * fullWidth + x]) {
        const outIdx = ((y - minY) * cropW + (x - minX)) * 4;
        imgData.data[outIdx] = fillRgb.r; imgData.data[outIdx + 1] = fillRgb.g; imgData.data[outIdx + 2] = fillRgb.b; imgData.data[outIdx + 3] = 255;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return offscreen.toDataURL('image/png');
};

export const performFloodFill = (fabricCanvas, canvasWidth, canvasHeight, clickX, clickY, fillColorHex, tolerance = 40) => {
  const fillRgb = hexToRgb(fillColorHex);
  const activeObj = fabricCanvas.getActiveObject();
  fabricCanvas.discardActiveObject(); fabricCanvas.renderAll();
  const offscreen = document.createElement('canvas'); offscreen.width = canvasWidth; offscreen.height = canvasHeight;
  const ctx = offscreen.getContext('2d');
  const canvasEl = fabricCanvas.lowerCanvasEl || fabricCanvas.getElement();
  ctx.drawImage(canvasEl, 0, 0, canvasWidth, canvasHeight);
  if (activeObj) { try { fabricCanvas.setActiveObject(activeObj); } catch(e) {} fabricCanvas.renderAll(); }
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const result = scanlineFill(imageData, clickX, clickY, fillRgb, tolerance);
  if (!result) return null;
  const { filled, minX, maxX, minY, maxY, pixelCount } = result;
  const dataURL = createFillImage(filled, fillRgb, canvasWidth, minX, minY, maxX, maxY);
  return { dataURL, left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, fillColor: fillColorHex, pixelCount };
};