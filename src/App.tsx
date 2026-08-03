import { HashRouter, Route, Routes } from 'react-router-dom'
import { GalleryPage } from './components/GalleryPage'
import { EditorPage } from './components/EditorPage'
import { PrintPage } from './components/PrintPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GalleryPage />} />
        <Route path="/editor/:workId" element={<EditorPage />} />
        <Route path="/print/:workId" element={<PrintPage />} />
      </Routes>
    </HashRouter>
  )
}
