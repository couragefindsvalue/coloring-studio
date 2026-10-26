// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './Home';
import Gallery from './Gallery';
import About from './About';
import Coffee from './Coffee';
import './App.css';

function App() {
  return (
    <Router>
      <div className="site-wrapper">
        {/* 全局顶部导航栏 */}
        <nav className="navbar">
          <div className="nav-brand">🖍️ Coloring Studio</div>
          <div className="nav-links">
            <Link to="/">Home</Link>
            <Link to="/gallery">Gallery</Link>
            <Link to="/about">About</Link>
            <Link to="/coffee">☕ Buy Coffee</Link>
          </div>
        </nav>

        {/* 页面内容渲染区 */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/about" element={<About />} />
          <Route path="/coffee" element={<Coffee />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;