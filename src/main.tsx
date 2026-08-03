import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles/global.css'
import App from './App'
import { attachAutosave } from './store/persist'

// 全局自动保存（作品变化 1s 防抖落盘）
attachAutosave()

createRoot(document.getElementById('root')!).render(<App />)
