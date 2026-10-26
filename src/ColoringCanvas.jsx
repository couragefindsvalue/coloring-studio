import React, { useEffect, useImperativeHandle, forwardRef, useRef } from 'react';

const floodFill = (ctx, startX, startY, fillColor) => {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const startPos = (startY * width + startX) * 4;
  const startR = pixels[startPos];
  const startG = pixels[startPos + 1];
  const startB = pixels[startPos + 2];
  const startA = pixels[startPos + 3];

  // 🌟 核心保护：如果点击的颜色是黑色（或极深颜色），直接拒绝填色
  if (startR < 60 && startG < 60 && startB < 60) return false;

  const hex = fillColor.replace('#', '');
  const fillR = parseInt(hex.substring(0, 2), 16);
  const fillG = parseInt(hex.substring(2, 4), 16);
  const fillB = parseInt(hex.substring(4, 6), 16);

  if (startR === fillR && startG === fillG && startB === fillB) return false;

  const tolerance = 50;

  const matchStartColor = (pos) => {
    const r = pixels[pos];
    const g = pixels[pos + 1];
    const b = pixels[pos + 2];
    const a = pixels[pos + 3];
    // 匹配白色或灰色背景，但绝不匹配黑色
    return (
      a > 0 &&
      !(r < 60 && g < 60 && b < 60) &&
      Math.abs(r - startR) <= tolerance &&
      Math.abs(g - startG) <= tolerance &&
      Math.abs(b - startB) <= tolerance
    );
  };

  const colorPixel = (pos) => {
    pixels[pos] = fillR;
    pixels[pos + 1] = fillG;
    pixels[pos + 2] = fillB;
    pixels[pos + 3] = 255;
  };

  const pixelStack = [[startX, startY]];
  while (pixelStack.length) {
    const newPos = pixelStack.pop();
    const x = newPos[0];
    let y = newPos[1];
    let pixelPos = (y * width + x) * 4;

    while (y-- >= 0 && matchStartColor(pixelPos)) {
      pixelPos -= width * 4;
    }
    pixelPos += width * 4;
    ++y;

    let reachLeft = false;
    let reachRight = false;

    while (y++ < height - 1 && matchStartColor(pixelPos)) {
      colorPixel(pixelPos);
      if (x > 0) {
        if (matchStartColor(pixelPos - 4)) {
          if (!reachLeft) { pixelStack.push([x - 1, y]); reachLeft = true; }
        } else if (reachLeft) { reachLeft = false; }
      }
      if (x < width - 1) {
        if (matchStartColor(pixelPos + 4)) {
          if (!reachRight) { pixelStack.push([x + 1, y]); reachRight = true; }
        } else if (reachRight) { reachRight = false; }
      }
      pixelPos += width * 4;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return true;
};

const ColoringCanvas = forwardRef(({ svgUrl, currentColor }, ref) => {
  const canvasRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isProcessing = useRef(false);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
    historyRef.current.push(imageData);

    if (historyRef.current.length > 10) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }
  };

  const restoreState = (index) => {
    if (index < 0 || index >= historyRef.current.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(historyRef.current[index], 0, 0);
    historyIndexRef.current = index;
  };

  useImperativeHandle(ref, () => ({
    undo: () => { if (historyIndexRef.current > 0) restoreState(historyIndexRef.current - 1); },
    redo: () => { if (historyIndexRef.current < historyRef.current.length - 1) restoreState(historyIndexRef.current + 1); },
    reset: () => { historyRef.current = []; historyIndexRef.current = -1; loadSvg(); }
  }));

  const loadSvg = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    fetch(svgUrl)
      .then((res) => res.text())
      .then((svgText) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = doc.querySelector('svg');

        let width = parseInt(svgElement.getAttribute('width')) || 800;
        let height = parseInt(svgElement.getAttribute('height')) || 800;
        const viewBox = svgElement.getAttribute('viewBox');

        if (viewBox) {
          const parts = viewBox.split(/\s+/).map(Number);
          if (parts.length === 4) { width = parts[2]; height = parts[3]; }
        }

        svgElement.setAttribute('width', width);
        svgElement.setAttribute('height', height);

        const serializer = new XMLSerializer();
        const updatedSvg = serializer.serializeToString(svgElement);
        const blob = new Blob([updatedSvg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          const CANVAS_SIZE = 1600;

          const scale = Math.min(CANVAS_SIZE / width, CANVAS_SIZE / height);
          const drawWidth = width * scale;
          const drawHeight = height * scale;

          const offsetX = (CANVAS_SIZE - drawWidth) / 2;
          const offsetY = (CANVAS_SIZE - drawHeight) / 2;

          canvas.width = CANVAS_SIZE;
          canvas.height = CANVAS_SIZE;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

          URL.revokeObjectURL(url);
          saveState();
        };
        img.src = url;
      })
      .catch((err) => console.error("Error loading SVG:", err));
  };

  useEffect(() => {
    if (svgUrl) loadSvg();
  }, [svgUrl]);

  const handleCanvasClick = (e) => {
    if (isProcessing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const drawnW = canvas.width * scale;
    const drawnH = canvas.height * scale;
    const offsetX = (rect.width - drawnW) / 2;
    const offsetY = (rect.height - drawnH) / 2;

    const px = e.clientX - rect.left - offsetX;
    const py = e.clientY - rect.top - offsetY;

    if (px < 0 || py < 0 || px >= drawnW || py >= drawnH) return;

    const x = Math.floor(px / scale);
    const y = Math.floor(py / scale);

    isProcessing.current = true;

    setTimeout(() => {
      const ctx = canvas.getContext('2d');
      const changed = floodFill(ctx, x, y, currentColor);
      if (changed) saveState();
      isProcessing.current = false;
    }, 10);
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      className="color-canvas"
    />
  );
});

export default ColoringCanvas;