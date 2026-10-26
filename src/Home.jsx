import React, { useState, useRef, useEffect, useMemo } from 'react';
import { HexColorPicker } from 'react-colorful';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ColoringCanvas from './ColoringCanvas';
import { catalog, palette } from './catalog';

const extractTags = (name) => {
  let baseName = name.split('=')[0].replace('.svg', '');
  let parts = baseName.split('_');
  let tags = parts.map(p => p.replace(/[0-9]/g, '').toLowerCase()).filter(t => t.length > 0);
  return [...new Set(tags)];
};

function Home() {
  const categoryKeys = Object.keys(catalog);

  const [activeCategory, setActiveCategory] = useState(categoryKeys[0] || '');
  const [activeItem, setActiveItem] = useState(null);
  const [color, setColor] = useState('#e63946');
  const [showPicker, setShowPicker] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCanvasCollapsed, setIsCanvasCollapsed] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(27);

  const [selectedPaths, setSelectedPaths] = useState([]);

  const canvasRef = useRef(null);
  const gridRef = useRef(null);

  const allImages = useMemo(() => {
    let list = [];
    categoryKeys.forEach(cat => {
      catalog[cat].forEach(item => {
        list.push({ ...item, category: cat, tags: extractTags(item.name) });
      });
    });
    return list;
  }, [categoryKeys]);

  const isSearching = searchTerm.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const keywords = searchTerm.toLowerCase().replace(/-and-/g, ' ').split(/\s+/).filter(k => k);
    return allImages.filter(img =>
      keywords.some(kw =>
        img.name.toLowerCase().includes(kw) ||
        img.tags.some(tag => tag.includes(kw))
      )
    );
  }, [isSearching, searchTerm, allImages]);

  const suggestions = useMemo(() => {
    if (!isSearching) return [];
    const currentKeyword = searchTerm.split(/\s+/).pop().toLowerCase();
    if (!currentKeyword) return [];
    let allTags = allImages.flatMap(img => img.tags);
    let uniqueTags = [...new Set(allTags)];
    return uniqueTags.filter(t => t.includes(currentKeyword) && t !== currentKeyword).slice(0, 5);
  }, [isSearching, searchTerm, allImages]);

  const displayItems = isSearching ? searchResults : (catalog[activeCategory] || []);

  const totalPages = Math.ceil(displayItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = displayItems.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
    if (displayItems.length > 0) {
      setActiveItem(displayItems[0]);
    } else {
      setActiveItem(null);
    }
  }, [searchTerm, activeCategory]);

  useEffect(() => {
    if (!gridRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!gridRef.current) return;
      const containerWidth = gridRef.current.clientWidth;
      const cols = Math.max(1, Math.floor((containerWidth + 12) / (100 + 12)));
      const rows = isCanvasCollapsed ? 6 : 3;
      setItemsPerPage(prev => prev !== cols * rows ? cols * rows : prev);
    });
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, [isCanvasCollapsed]);

  const toggleSelection = (e, itemPath) => {
    e.stopPropagation();
    setSelectedPaths(prev =>
      prev.includes(itemPath)
        ? prev.filter(p => p !== itemPath)
        : [...prev, itemPath]
    );
  };

  const clearSelection = () => setSelectedPaths([]);

  // 🌟 新增：保存画作到画廊
  const handleSaveToGallery = () => {
    const canvasElement = document.querySelector('canvas');
    if (!canvasElement) return;

    const dataUrl = canvasElement.toDataURL('image/png');
    const existingGallery = JSON.parse(localStorage.getItem('my_coloring_gallery') || '[]');

    const newArtwork = {
      id: Date.now(),
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      image: dataUrl
    };

    try {
      localStorage.setItem('my_coloring_gallery', JSON.stringify([newArtwork, ...existingGallery]));
      alert('✅ Artwork saved to Gallery!');
    } catch (e) {
      alert('❌ Storage is full! Please clear some old artworks in the Gallery.');
    }
  };

  const handleBatchDownload = async () => {
    if (selectedPaths.length === 0) return;
    const zip = new JSZip();

    for (const path of selectedPaths) {
      try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to fetch ${path}`);
        const svgText = await response.text();
        const filename = path.split('/').pop();
        zip.file(filename, svgText);
      } catch (error) {
        console.error("Error fetching file:", path, error);
      }
    }

    zip.generateAsync({ type: 'blob' }).then((content) => {
      const now = new Date();
      const timeStr = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
      saveAs(content, `SVGfiles_${timeStr}.zip`);
    });
  };

  const handlePrintCurrent = () => {
    const canvasElement = document.querySelector('canvas');
    if (!canvasElement) return;
    toPng(canvasElement, { pixelRatio: 2 }).then((dataUrl) => {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`<html><head><style>@page { margin: 0; } body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; } img { width: 100%; height: 100%; object-fit: contain; }</style></head><body><img src="${dataUrl}" onload="window.print();window.close();" /></body></html>`);
      printWindow.document.close();
    });
  };

  const handleBatchPrint = () => {
    if (selectedPaths.length === 0) return;
    const imgHtml = selectedPaths.map(path => `<div style="page-break-after: always; display: flex; justify-content: center; align-items: center; width: 100%; height: 95vh;"><img src="${window.location.origin}${path}" style="width: 100%; height: 100%; object-fit: contain;" /></div>`).join('');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><style>@page { margin: 10mm; } body { margin: 0; padding: 0; }</style></head><body>${imgHtml}<script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script></body></html>`);
    printWindow.document.close();
  };

  const handleSelectItem = (item) => {
    setActiveItem(item);
    setIsCanvasCollapsed(false);
  };

  const handlePrev = () => {
    if (displayItems.length <= 1) return;
    const currentIndex = displayItems.findIndex(i => i.path === activeItem.path);
    const newIndex = (currentIndex - 1 + displayItems.length) % displayItems.length;
    setActiveItem(displayItems[newIndex]);
    setCurrentPage(Math.floor(newIndex / itemsPerPage) + 1);
  };

  const handleNext = () => {
    if (displayItems.length <= 1) return;
    const currentIndex = displayItems.findIndex(i => i.path === activeItem.path);
    const newIndex = (currentIndex + 1) % displayItems.length;
    setActiveItem(displayItems[newIndex]);
    setCurrentPage(Math.floor(newIndex / itemsPerPage) + 1);
  };

  const handleUndo = () => { if (canvasRef.current) canvasRef.current.undo(); };
  const handleRedo = () => { if (canvasRef.current) canvasRef.current.redo(); };
  const handleReset = () => { if (canvasRef.current) canvasRef.current.reset(); };

  return (
    <div className={`app-container ${isFullScreen ? 'full-screen' : ''} ${isCanvasCollapsed ? 'canvas-collapsed' : ''}`}>
      <div className="top-nav">
        <header>
          <h1>🖍️ Kids Coloring Studio</h1>
        </header>

        <div className="header-controls">
          <div className="categories">
            {!isSearching && categoryKeys.map((cat) => (
              <button key={cat} className={activeCategory === cat ? 'active' : ''} onClick={() => { setActiveCategory(cat); setSearchTerm(''); }}>
                {cat.toUpperCase()}
              </button>
            ))}
            {isSearching && <span className="search-active-label">Results: {displayItems.length}</span>}
          </div>

          <div className="search-wrapper">
            <input type="text" placeholder="🔍 Search (e.g. girl hero)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
            {searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>✖</button>}
            {suggestions.length > 0 && (
              <div className="search-suggestions">
                {suggestions.map(tag => (
                  <span key={tag} onClick={() => {
                    const words = searchTerm.split(/\s+/);
                    words.pop();
                    setSearchTerm([...words, tag].join(' ') + ' ');
                  }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="gallery-toolbar">
          <button className="toggle-canvas-btn" onClick={() => setIsCanvasCollapsed(!isCanvasCollapsed)}>
            {isCanvasCollapsed ? '🖍️ Back to Coloring' : '🔍 Browse Gallery'}
          </button>

          {selectedPaths.length > 0 && (
            <div className="batch-actions">
              <span>{selectedPaths.length} selected</span>
              <button className="clear-selection" onClick={clearSelection}>Clear</button>
              <button className="batch-print-btn" onClick={handleBatchPrint}>🖨️ Print</button>
              <button className="batch-download-btn" onClick={handleBatchDownload}>⬇️ Download</button>
            </div>
          )}

          <span className="item-count">Total: {displayItems.length}</span>
        </div>

        <div className={`item-grid-container ${isCanvasCollapsed ? 'expanded' : ''}`} ref={gridRef}>
          {displayItems.length === 0 ? (
            <div className="no-results">No images found for "{searchTerm}"</div>
          ) : (
            <div className="item-grid">
              {paginatedItems.map((item) => {
                const isSelectedForPrint = selectedPaths.includes(item.path);
                return (
                  <button key={item.path} className={`item-card ${activeItem?.path === item.path ? 'active' : ''} ${isSelectedForPrint ? 'selected-print' : ''}`} onClick={() => handleSelectItem(item)}>
                    <div className={`print-checkbox ${isSelectedForPrint ? 'checked' : ''}`} onClick={(e) => toggleSelection(e, item.path)}>
                      {isSelectedForPrint ? '✓' : ''}
                    </div>
                    <div className="thumb-container">
                      <img src={item.path} alt={item.name} className="thumb-img" />
                    </div>
                    <span className="thumb-name">{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>❮ Prev</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next ❯</button>
          </div>
        )}
      </div>

      {!isCanvasCollapsed && (
        <>
          {isFullScreen && <button className="exit-fullscreen-btn" onClick={() => setIsFullScreen(false)}>✖ Exit Full Screen</button>}

          <div className="palette-container">
            <div className="palette">
              {palette.map((c) => (
                <button key={c} className={`swatch ${color === c ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
              ))}
              <button className="swatch custom" onClick={() => setShowPicker(!showPicker)}>🎨</button>
            </div>
            {showPicker && (
              <div className="color-picker-popup">
                <HexColorPicker color={color} onChange={setColor} />
              </div>
            )}
          </div>

          <div className="studio-area">
            <button className="nav-arrow left" onClick={handlePrev} disabled={displayItems.length <= 1}>❮</button>
            <div className="canvas-wrapper">
              {activeItem ? <ColoringCanvas ref={canvasRef} svgUrl={activeItem.path} currentColor={color} /> : <div className="empty-state">Select an image to start coloring</div>}
            </div>
            <button className="nav-arrow right" onClick={handleNext} disabled={displayItems.length <= 1}>❯</button>
          </div>

          <div className="controls">
            <button className="ctrl-btn save" onClick={handleSaveToGallery}>💾 Save to Gallery</button>
            <button className="ctrl-btn undo" onClick={handleUndo}>↩️ Undo</button>
            <button className="ctrl-btn redo" onClick={handleRedo}>↪️ Redo</button>
            <button className="ctrl-btn reset" onClick={handleReset}>🔄 Reset</button>
            <button className="ctrl-btn print" onClick={handlePrintCurrent}>🖨️ Print Current</button>
            {!isFullScreen && (
              <button className="ctrl-btn fullscreen" onClick={() => setIsFullScreen(true)}>⛶ Full Screen</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Home;