import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import './App.css';

function Gallery() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('local');
  const [localArtworks, setLocalArtworks] = useState([]);
  const [cloudArtworks, setCloudArtworks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchLocalArtworks();
    fetchCloudArtworks();
  }, []);

  const fetchLocalArtworks = () => {
    const saved = JSON.parse(localStorage.getItem('my_coloring_gallery') || '[]');
    setLocalArtworks(saved);
  };

  const fetchCloudArtworks = async () => {
    const { data, error } = await supabase
      .from('cloud_artworks')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setCloudArtworks(data);
  };

  const handleAdminLogin = () => {
    const password = window.prompt("Enter Parent/Admin Password:");
    if (password === import.meta.env.VITE_ADMIN_PASSWORD) {
      setIsAdmin(true);
    } else if (password !== null) {
      alert("❌ Incorrect password.");
    }
  };

  const handleAdminLogout = () => setIsAdmin(false);

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => alert(`✅ Code ${code} copied!`)).catch(() => alert("❌ Failed to copy."));
  };

  const handleDeleteLocal = (id) => {
    if (window.confirm("Delete this local artwork?")) {
      const updated = localArtworks.filter(art => art.id !== id);
      localStorage.setItem('my_coloring_gallery', JSON.stringify(updated));
      setLocalArtworks(updated);
    }
  };

  const handleDeleteCloud = async (code) => {
    if (!window.confirm(`Permanently delete cloud artwork with code ${code}?`)) return;
    try {
      const { error: dbError } = await supabase.from('cloud_artworks').delete().eq('code', code);
      if (dbError) throw dbError;
      const { error: storageError } = await supabase.storage.from('artworks').remove([`${code}.png`]);
      if (storageError) throw storageError;
      setCloudArtworks(prev => prev.filter(art => art.code !== code));
      alert("✅ Cloud artwork deleted.");
    } catch (error) {
      alert("❌ Error deleting cloud artwork.");
    }
  };

  // 🌟 核心修改：统一处理跳转加载（传递 state 给 Home.jsx）
  const handleLoadToHome = (imageSource) => {
    navigate('/', { state: { loadedImage: imageSource } });
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🎨 Art Gallery</h2>
        {isAdmin ? (
          <button className="admin-btn logout" onClick={handleAdminLogout}>🔒 Exit Admin</button>
        ) : (
          <button className="admin-btn login" onClick={handleAdminLogin}>👨‍👩‍👧 Parent Admin</button>
        )}
      </div>

      <div className="gallery-tabs">
        <button className={activeTab === 'local' ? 'active' : ''} onClick={() => setActiveTab('local')}>
          💾 Local Gallery ({localArtworks.length})
        </button>
        <button className={activeTab === 'cloud' ? 'active' : ''} onClick={() => setActiveTab('cloud')}>
          ☁️ Cloud Gallery ({cloudArtworks.length})
        </button>
      </div>

      {/* 本地画廊 */}
      {activeTab === 'local' && (
        <div className="gallery-grid">
          {localArtworks.map(art => (
            <div key={art.id} className="gallery-card">
              <button className="delete-artwork-btn" onClick={() => handleDeleteLocal(art.id)}>✖</button>
              <img
                src={art.image}
                alt="Local Artwork"
                style={{ cursor: 'pointer' }}
                onClick={() => handleLoadToHome(art.image)}
                title="Click to continue coloring"
              />
              <span className="art-date">{art.date}</span>
            </div>
          ))}
        </div>
      )}

      {/* 云端画廊 */}
      {activeTab === 'cloud' && (
        <div className="gallery-grid">
          {cloudArtworks.map(art => (
            <div key={art.id} className="gallery-card">
              {isAdmin && (
                <button className="delete-artwork-btn" onClick={() => handleDeleteCloud(art.code)}>✖</button>
              )}

              {/* 🌟 云端图片也可以点击加载了 */}
              <img
                src={art.image_url}
                alt="Cloud Artwork"
                style={{ cursor: 'pointer' }}
                onClick={() => handleLoadToHome(art.image_url)}
                title="Click to continue coloring"
              />

              <div className="cloud-card-footer">
                <span className="code-label">{art.code}</span>
                <button className="copy-code-btn" onClick={() => copyCode(art.code)} title="Copy Code">📋</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'local' && localArtworks.length === 0 && (
        <p style={{ textAlign: 'center', padding: '40px' }}>No local artworks. <Link to="/">Go color something!</Link></p>
      )}
      {activeTab === 'cloud' && cloudArtworks.length === 0 && (
        <p style={{ textAlign: 'center', padding: '40px' }}>No cloud artworks found.</p>
      )}
    </div>
  );
}

export default Gallery;