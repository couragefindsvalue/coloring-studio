import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Analytics } from '@vercel/analytics/react'; // 1. 引入分析组件

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Analytics />  {/* 2. 放在这里，和 App 平级 */}
  </StrictMode>,
)