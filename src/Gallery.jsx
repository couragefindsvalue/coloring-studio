import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './App.css';

function Gallery() {
  const [artworks, setArtworks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false); // 管理员状态

  // 页面加载时读取本地存储
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('my_coloring_gallery') || '[]');
    setArtworks(saved);
  }, []);

  // 管理员登录
  const handleAdminLogin = () => {
    // 🌟 你可以在这里修改密码，比如 "1234" 或 "mypassword"
    const password = window.prompt("Enter Parent/Admin Password to unlock delete mode:");

    if (password === "admin123") {
      setIsAdmin(true);
      alert("🔓 Admin mode unlocked. You can now delete artworks.");
    } else if (password !== null) {
      alert("❌ Incorrect password.");
    }
  };

  // 退出管理员模式
  const handleAdminLogout = () => {
    setIsAdmin(false);
  };

  // 删除单张作品
  const handleDeleteArtwork = (id) => {
    if (window.confirm("Are you sure you want to delete this masterpiece?")) {
      const updatedArtworks = artworks.filter(art => art.id !== id);
      localStorage.setItem('my_coloring_gallery', JSON.stringify(updatedArtworks));
      setArtworks(updatedArtworks);
    }
  };

  // 清空所有作品
  const clearGallery = () => {
    if (window.confirm("Are you sure you want to delete ALL artworks? This cannot be undone.")) {
      localStorage.removeItem('my_coloring_gallery');
      setArtworks([]);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🎨 My Masterpieces</h2>

        {/* 管理员控制按钮 */}
        {isAdmin ? (
          <button className="admin-btn logout" onClick={handleAdminLogout}>
            🔒 Exit Admin Mode
          </button>
        ) : (
          <button className="admin-btn login" onClick={handleAdminLogin}>
            👨‍👩‍👧 Parent Admin
          </button>
        )}
      </div>

      {artworks.length === 0 ? (
        <div className="empty-gallery">
          <p>No artworks yet. Go color something!</p>
          <Link to="/" className="link-btn">Go to Studio</Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ color: '#666', fontWeight: 'bold' }}>{artworks.length} artworks saved</span>
            {/* 只有管理员才能看到清空按钮 */}
            {isAdmin && (
              <button className="clear-gallery-btn" onClick={clearGallery}>🗑️ Clear All</button>
            )}
          </div>

          <div className="gallery-grid">
            {artworks.map(art => (
              <div key={art.id} className="gallery-card">
                {/* 只有管理员才能看到单张删除按钮 */}
                {isAdmin && (
                  <button
                    className="delete-artwork-btn"
                    onClick={() => handleDeleteArtwork(art.id)}
                    title="Delete this artwork"
                  >
                    ✖
                  </button>
                )}

                <img src={art.image} alt="Artwork" />
                <span className="art-date">{art.date}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Gallery;