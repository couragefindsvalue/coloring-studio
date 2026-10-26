// src/Coffee.jsx
import React from 'react';
import './App.css';

function Coffee() {
  return (
    <div className="page-container text-page" style={{ textAlign: 'center' }}>
      <h2>☕ Buy Me a Coffee</h2>
      <p>If you and your kids enjoy this coloring studio, consider supporting the development!</p>

      {/* 这里替换为你真实的 Buy Me a Coffee 或 PayPal 链接 */}
      <a
        href="https://www.buymeacoffee.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="coffee-btn"
      >
        ☕ Buy me a coffee
      </a>
    </div>
  );
}

export default Coffee;