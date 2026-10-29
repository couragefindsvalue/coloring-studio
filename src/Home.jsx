import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HexColorPicker } from 'react-colorful';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ColoringCanvas from './ColoringCanvas';
import { catalog, palette } from './catalog';
import { supabase } from './supabaseClient';

const extractTags = (name) => {
  let baseName = name.split('=')[0].replace('.svg', '');
  let parts = baseName.split('_');
  let tags = parts.map(p => p.replace(/[0-9]/g, '').toLowerCase()).filter(t => t.length > 0);
  return [...new Set(tags)];
};

function Home() {
  const categoryKeys = Object.keys(catalog);
  const location = useLocation();
  const navigate = useNavigate();

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
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [savedCode, setSavedCode] = useState('');

  // 🌟 历史特别色 (上限增加到 10 个)
  const [customColors, setCustomColors] = useState(() => {
    const saved = localStorage.getItem('my_custom_colors');
    return saved ? JSON.parse(saved) : [];
  });

  // 🌟 检查浏览器是否支持屏幕拾色器
  const isEyeDropperSupported = typeof window !== 'undefined' && !!window.EyeDropper;

  const canvasRef = useRef(null);
  const gridRef = useRef(null);

  const handleColorSelect = (newColor) => {
    let finalColor = newColor.toLowerCase();
    if (finalColor === '#000000') finalColor = '#4a4a4a'; // 纯黑转深灰
    setColor(finalColor);

    const isDefault = palette.map(p => p.toLowerCase()).includes(finalColor);
    const isCustom = customColors.map(c => c.toLowerCase()).includes(finalColor);

    if (!isDefault && !isCustom) {
      setCustomColors(prev => {
        const updated = [...prev, finalColor];
        if (updated.length > 10) updated.shift(); // 限制10个
        localStorage.setItem('my_custom_colors', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleEyeDropper = async () => {
    if (!isEyeDropperSupported) return alert("Your browser doesn't support the EyeDropper.");
    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      handleColorSelect(result.sRGBHex);
    } catch (e) { console.log(e); }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isModifier = isMac ? e.metaKey : e.ctrlKey;
      if (isModifier) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault(); if (canvasRef.current) canvasRef.current.undo();
        } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
          e.preventDefault(); if (canvasRef.current) canvasRef.current.redo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isFullScreen) document.body.classList.add('is-fullscreen-active');
    else document.body.classList.remove('is-fullscreen-active');
    return () => document.body.classList.remove('is-fullscreen-active');
  }, [isFullScreen]);

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
    if (location.state?.loadedImage) {
      setActiveItem({ path: location.state.loadedImage, name: 'My Saved Artwork' });
      setIsFullScreen(true);
      setIsCanvasCollapsed(false);
      navigate('/', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (!location.state?.loadedImage) {
      setCurrentPage(1);
      if (displayItems.length > 0) setActiveItem(displayItems[0]);
      else setActiveItem(null);
    }
  }, [searchTerm, activeCategory]);

  const isAllPageSelected = paginatedItems.length > 0 && paginatedItems.every(item => selectedPaths.includes(item.path));
  const handleSelectAll = () => {
    if (isAllPageSelected) {
      const pagePaths = paginatedItems.map(item => item.path);
      setSelectedPaths(prev => prev.filter(p => !pagePaths.includes(p)));
    } else {
      const pagePaths = paginatedItems.map(item => item.path);
      setSelectedPaths(prev => [...new Set([...prev, ...pagePaths])]);
    }
  };

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
    setSelectedPaths(prev => prev.includes(itemPath) ? prev.filter(p => p !== itemPath) : [...prev, itemPath]);
  };
  const clearSelection = () => setSelectedPaths([]);

  const handleSaveToGallery = () => {
    const canvasElement = document.querySelector('canvas');
    if (!canvasElement) return;
    const dataUrl = canvasElement.toDataURL('image/jpeg', 0.8);
    const existingGallery = JSON.parse(localStorage.getItem('my_coloring_gallery') || '[]');
    const newArtwork = { id: Date.now(), date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(), image: dataUrl };
    try {
      localStorage.setItem('my_coloring_gallery', JSON.stringify([newArtwork, ...existingGallery]));
      alert('✅ Artwork saved to Local Gallery!');
    } catch (e) {
      const goToGallery = window.confirm("❌ Local browser storage is full!\n\nGo to the Gallery now?");
      if (goToGallery) navigate('/gallery');
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${code.slice(0, 3)}-${code.slice(3)}`;
  };

  const handleSaveToCloud = async () => {
    const canvasElement = document.querySelector('canvas');
    if (!canvasElement) return;
    try {
      const blob = await new Promise(resolve => canvasElement.toBlob(resolve, 'image/png'));
      const code = generateCode();
      const fileName = `${code}.png`;
      const { error: uploadError } = await supabase.storage.from('artworks').upload(fileName, blob);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('artworks').getPublicUrl(fileName);
      const { error: dbError } = await supabase.from('cloud_artworks').insert([{ code: code, image_url: publicUrl }]);
      if (dbError) throw dbError;
      setSavedCode(code);
      setShowCodeModal(true);
    } catch (error) {
      alert('❌ Failed to save to cloud. Please try again.');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(savedCode).then(() => alert("✅ Code copied!")).catch(() => alert("❌ Failed."));
  };

  const handleLoadFromCloud = () => {
    const input = window.prompt("Enter your 6-character extraction code (e.g. A7B-9X2):");
    if (!input) return;
    const cleanCode = input.trim().toUpperCase();
    const loadImage = async () => {
      try {
        const { data, error } = await supabase.from('cloud_artworks').select('image_url').eq('code', cleanCode).single();
        if (error || !data) throw new Error('Code not found');
        navigate('/', { state: { loadedImage: data.image_url } });
      } catch (error) {
        alert("❌ Invalid code or connection error.");
      }
    };
    loadImage();
  };

  const handleBatchDownload = async () => {
    if (selectedPaths.length === 0) return;
    const zip = new JSZip();
    for (const path of selectedPaths) {
      try {
        const response = await fetch(path);
        const svgText = await response.text();
        zip.file(path.split('/').pop(), svgText);
      } catch (error) { console.error(error); }
    }
    zip.generateAsync({ type: 'blob' }).then((content) => saveAs(content, `SVGfiles_${new Date().getTime()}.zip`));
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

  const handleSelectItem = (item) => { setActiveItem(item); setIsCanvasCollapsed(false); };

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
        <header><h1>🖍️ Kids Coloring Studio</h1></header>

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
            <input type="text" placeholder="🔍 Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="toggle-canvas-btn" onClick={() => setIsCanvasCollapsed(!isCanvasCollapsed)}>
              {isCanvasCollapsed ? '🖍️ Back to Coloring' : '🔍 Browse Gallery'}
            </button>
            <button className="select-all-btn" onClick={handleSelectAll}>
              {isAllPageSelected ? '☑️ Unselect Page' : '⬜ Select Page'}
            </button>
          </div>

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

          <div className="studio-area">
            <button className="nav-arrow left" onClick={handlePrev} disabled={displayItems.length <= 1}>❮</button>
            <div className="canvas-wrapper">
              {activeItem ? (
                <ColoringCanvas
                  ref={canvasRef}
                  svgUrl={activeItem.path}
                  currentColor={color}
                  isFullScreen={isFullScreen}
                />
              ) : <div className="empty-state">Select an image</div>}
            </div>
            <button className="nav-arrow right" onClick={handleNext} disabled={displayItems.length <= 1}>❯</button>
          </div>

          {/* 🌟 调色板分组改造 */}
          <div className="palette-container">
            <div className="palette-wrapper">
              {/* 第一行：预设颜色 */}
              <div className="palette-group fixed">
                {palette.map((c) => (
                  <button key={c} className={`swatch ${color === c.toLowerCase() ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => handleColorSelect(c)} />
                ))}
              </div>

              {/* 第二行：自定义颜色 + 吸管 + 调色盘 */}
              <div className="palette-group custom">
                {customColors.map((c) => (
                  <button key={c} className={`swatch ${color === c.toLowerCase() ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => handleColorSelect(c)} title="My Custom Color" />
                ))}
                {isEyeDropperSupported && (
                  <button className="swatch custom" onClick={handleEyeDropper} title="Pick from screen" style={{ fontSize: '1.2rem' }}>
                    💧
                  </button>
                )}
                <button className="swatch custom" onClick={() => setShowPicker(!showPicker)}>🎨</button>
              </div>
            </div>

            {showPicker && (
              <div className="color-picker-popup">
                <HexColorPicker color={color} onChange={handleColorSelect} />
              </div>
            )}
          </div>

          <div className="controls">
            <button className="ctrl-btn save" onClick={handleSaveToGallery}>💾 Local Save</button>
            <button className="ctrl-btn cloud-save" onClick={handleSaveToCloud}>☁️ Cloud Save</button>
            <button className="ctrl-btn cloud-load" onClick={handleLoadFromCloud}>☁️ Cloud Load</button>
            <button className="ctrl-btn undo" onClick={handleUndo}>↩️ Undo</button>
            <button className="ctrl-btn redo" onClick={handleRedo}>↪️ Redo</button>
            <button className="ctrl-btn reset" onClick={handleReset}>🔄 Reset</button>
            <button className="ctrl-btn print" onClick={handlePrintCurrent}>🖨️ Print</button>
            {!isFullScreen && (
              <button className="ctrl-btn fullscreen" onClick={() => setIsFullScreen(true)}>⛶ Full Screen</button>
            )}
          </div>
        </>
      )}

      {showCodeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>☁️ Saved to Cloud!</h3>
            <p>Please save this extraction code.</p>
            <div className="code-display"><span>{savedCode}</span></div>
            <div className="modal-actions">
              <button className="ctrl-btn copy-btn" onClick={copyToClipboard}>📋 Copy Code</button>
              <button className="ctrl-btn close-btn" onClick={() => setShowCodeModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;