import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WorkIndexItem } from '../model/types'
import { createWork } from '../model/factory'
import { cloneWorkWithNewIds } from '../store/workStore'
import { loadIndex, loadWork, putWork, removeWork, saveWorkNow } from '../store/persist'
import { importWorkFromJson, exportWorkToJson } from '../export/jsonIO'
import { CITIES, cityByKey } from '../data/cities'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  if (sameDay) {
    return `今天 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 作品画廊：首页，管理所有地铁图作品 */
export function GalleryPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<WorkIndexItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCity, setNewCity] = useState('beijing')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    setItems(await loadIndex())
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const handleCreate = async () => {
    const city = cityByKey(newCity) ?? CITIES[0]
    const name = newName.trim() || `我的${city.name}地铁`
    const work = createWork(name, city.key, { lat: city.center[0], lng: city.center[1] }, city.zoom)
    await saveWorkNow(work)
    navigate(`/editor/${work.id}`)
  }

  const handleDuplicate = async (id: string) => {
    const w = await loadWork(id)
    if (!w) return
    const copy = cloneWorkWithNewIds(w)
    await putWork(copy)
    await refresh()
  }

  const handleExportJson = async (id: string) => {
    const w = await loadWork(id)
    if (w) exportWorkToJson(w)
  }

  const handleDelete = async (id: string) => {
    await removeWork(id)
    setConfirmDeleteId(null)
    await refresh()
  }

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const work = importWorkFromJson(text)
      await putWork(work)
      setError(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败')
    }
  }

  return (
    <div className="gallery-page">
      <header className="gallery-header">
        <h1 className="gallery-title">
          <span className="gallery-title-emoji">🚇</span> 我的地铁设计师
        </h1>
        <p className="gallery-subtitle">画出属于你自己的地铁线路图，打印出来贴在房间里吧！</p>
      </header>

      <div className="gallery-actions">
        <button className="btn btn-primary btn-big" onClick={() => setNewOpen(true)}>
          ➕ 新建地铁图
        </button>
        <button className="btn btn-big" onClick={() => fileInputRef.current?.click()}>
          📂 导入作品文件
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImportFile(f)
            e.target.value = ''
          }}
        />
      </div>

      {error && <div className="gallery-error">⚠️ {error}</div>}

      {loading ? (
        <div className="page-loading">
          <div className="page-loading-emoji">🚇</div>
          <div>正在打开画廊…</div>
        </div>
      ) : items.length === 0 ? (
        <div className="gallery-empty">
          <div className="gallery-empty-emoji">🗺️</div>
          <p>还没有作品哦～</p>
          <p>点上面的「➕ 新建地铁图」，设计你的第一条地铁线吧！</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {items.map((item) => (
            <div key={item.id} className="work-card">
              <div className="work-thumb" onClick={() => navigate(`/editor/${item.id}`)}>
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt={item.name} />
                ) : (
                  <div className="work-thumb-placeholder">🚇</div>
                )}
              </div>
              <div className="work-info" onClick={() => navigate(`/editor/${item.id}`)}>
                <div className="work-name">{item.name}</div>
                <div className="work-meta">
                  🚇 {item.lineCount} 条线 · 📍 {item.stationCount} 站
                </div>
                <div className="work-meta">🕐 {formatTime(item.updatedAt)}</div>
              </div>
              <div className="work-actions">
                <button className="btn btn-sm" title="复制一份" onClick={() => void handleDuplicate(item.id)}>
                  📋
                </button>
                <button className="btn btn-sm" title="导出作品文件" onClick={() => void handleExportJson(item.id)}>
                  💾
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  title="删除"
                  onClick={() => setConfirmDeleteId(item.id)}
                >
                  🗑️
                </button>
              </div>
              {confirmDeleteId === item.id && (
                <div className="confirm-bar confirm-bar-card">
                  <span>删除「{item.name}」？找不回来哦！</span>
                  <div>
                    <button className="btn btn-danger btn-sm" onClick={() => void handleDelete(item.id)}>
                      删除
                    </button>
                    <button className="btn btn-sm" onClick={() => setConfirmDeleteId(null)}>
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {newOpen && (
        <div className="dialog-mask" onClick={() => setNewOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">➕ 新建地铁图</div>
            <label className="dialog-field">
              <span>叫什么名字？</span>
              <input
                className="dialog-input"
                value={newName}
                autoFocus
                placeholder="比如：我的北京地铁"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
              />
            </label>
            <label className="dialog-field">
              <span>在哪座城市画？</span>
              <select className="dialog-input" value={newCity} onChange={(e) => setNewCity(e.target.value)}>
                {CITIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary btn-big btn-block" onClick={() => void handleCreate()}>
              🎨 开始创作
            </button>
            <button className="btn btn-block" onClick={() => setNewOpen(false)}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
