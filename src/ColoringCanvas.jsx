import React, { useEffect, useImperativeHandle, forwardRef, useRef, useState } from 'react';

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

const ColoringCanvas = forwardRef(({ svgUrl, currentColor, isFullScreen }, ref) => {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isProcessing = useRef(false);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    hasDragged.current = false; // 切换全屏时重置拖拽状态
  }, [isFullScreen]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || !isFullScreen) return;

    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      let newScale = scale + delta;
      newScale = Math.min(Math.max(1, newScale), 5);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      setScale(newScale);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isFullScreen, scale]);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
    historyRef.current.push(imageData);

    if (historyRef.current.length > 30) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }
  };

  const restoreState = (index) => {
    if (index < 0 || index >= historyRef.current.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.putImageData(historyRef.current[index], 0, 0);
    historyIndexRef.current = index;
  };

  useImperativeHandle(ref, () => ({
    undo: () => { if (historyIndexRef.current > 0) restoreState(historyIndexRef.current - 1); },
    redo: () => { if (historyIndexRef.current < historyRef.current.length - 1) restoreState(historyIndexRef.current + 1); },
    reset: () => {
      historyRef.current = [];
      historyIndexRef.current = -1;
      setScale(1);
      setPosition({ x: 0, y: 0 });
      hasDragged.current = false;
      loadSvg();
    }
  }));

  const loadSvg = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const isImage = svgUrl.startsWith('data:image') || svgUrl.match(/\.(png|jpg|jpeg|webp)$/i);

    if (isImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const CANVAS_SIZE = 1600;
        const scaleImg = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
        const drawWidth = img.width * scaleImg;
        const drawHeight = img.height * scaleImg;
        const offsetX = (CANVAS_SIZE - drawWidth) / 2;
        const offsetY = (CANVAS_SIZE - drawHeight) / 2;

        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        saveState();
      };
      img.src = svgUrl;
      return;
    }

    fetch(svgUrl)
      .then((res) => res.text())
      .then((svgText) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = doc.querySelector('svg');
        if (!svgElement) return;

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
          const scaleImg = Math.min(CANVAS_SIZE / width, CANVAS_SIZE / height);
          const drawWidth = width * scaleImg;
          const drawHeight = height * scaleImg;
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

  // 🌟 核心修复：只有在全屏且放大时才允许拖拽，并且必须重置 hasDragged
  const handleMouseDown = (e) => {
    hasDragged.current = false; // 无论如何，点下鼠标就重置拖拽状态

    if (!isFullScreen || scale <= 1) return;

    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    // 如果鼠标移动距离超过 5 像素，才判定为“拖拽”，防止手抖导致点不中
    const dx = Math.abs(e.clientX - (position.x + dragStart.current.x));
    const dy = Math.abs(e.clientY - (position.y + dragStart.current.y));
    if (dx > 5 || dy > 5) {
      hasDragged.current = true;
    }

    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleCanvasClick = (e) => {
    // 只有正在处理、或者确实发生了拖拽，才拦截点击
    if (isProcessing.current || hasDragged.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

    isProcessing.current = true;
    setTimeout(() => {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const changed = floodFill(ctx, x, y, currentColor);
      if (changed) saveState();
      isProcessing.current = false;
    }, 10);
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        cursor: isFullScreen ? (scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'crosshair') : 'crosshair'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="color-canvas"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          backgroundColor: 'white',
          boxShadow: isFullScreen ? '0 10px 40px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.1)',
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  );
});

export default ColoringCanvas;