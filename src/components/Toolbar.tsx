import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkStore } from '../store/workStore'
import { saveWorkNow } from '../store/persist'
import { useUIStore, type EditMode } from '../store/uiStore'
import { CityPicker } from './CityPicker'
import { BaseLayerPicker } from './BaseLayerPicker'
import { ExportDialog } from './ExportDialog'

const MODES: { key: EditMode; emoji: string; label: string; hint: string }[] = [
  { key: 'draw', emoji: '✏️', label: '画线', hint: '点地图就能放车站' },
  { key: 'freehand', emoji: '🖌️', label: '画笔', hint: '按住拖动，自由画线' },
  { key: 'adjust', emoji: '✋', label: '调整', hint: '可以拖动车站和贴纸' },
  { key: 'browse', emoji: '🔒', label: '看看', hint: '锁定，不怕误碰' },
]

export function Toolbar() {
  const navigate = useNavigate()
  const work = useWorkStore((s) => s.work)
  const renameWork = useWorkStore((s) => s.renameWork)
  const undo = useWorkStore((s) => s.undo)
  const redo = useWorkStore((s) => s.redo)
  const canUndo = useWorkStore((s) => s.past.length > 0)
  const canRedo = useWorkStore((s) => s.future.length > 0)
  const addLine = useWorkStore((s) => s.addLine)
  const mode = useUIStore((s) => s.mode)
  const setMode = useUIStore((s) => s.setMode)
  const activeLineId = useUIStore((s) => s.activeLineId)
  const setActiveLine = useUIStore((s) => s.setActiveLine)
  const stickerPanelOpen = useUIStore((s) => s.stickerPanelOpen)
  const setStickerPanelOpen = useUIStore((s) => s.setStickerPanelOpen)
  const setPlacingSticker = useUIStore((s) => s.setPlacingSticker)
  const toolbarCollapsed = useUIStore((s) => s.toolbarCollapsed)
  const setToolbarCollapsed = useUIStore((s) => s.setToolbarCollapsed)

  const [nameDraft, setNameDraft] = useState(work?.name ?? '')
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    setNameDraft(work?.name ?? '')
  }, [work?.id, work?.name])

  // Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        useWorkStore.getState().undo()
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault()
        useWorkStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!work) return null

  // 收起态：只留左上角一个小按钮
  if (toolbarCollapsed) {
    return (
      <button
        className="panel-tab panel-tab-toolbar"
        onClick={() => setToolbarCollapsed(false)}
        title="打开工具栏"
      >
        ☰ <span className="panel-tab-text">工具</span>
      </button>
    )
  }

  const pickMode = (m: EditMode) => {
    setPlacingSticker(null)
    if (m === 'draw' && !activeLineId) {
      // 画线模式必须有活动线路：没有就自动建一条
      const id = addLine()
      setActiveLine(id)
    }
    setMode(m)
  }

  return (
    <div className="toolbar">
      <div className="toolbar-row">
        <button
          className="btn btn-ghost"
          onClick={async () => {
            // 返回画廊前强制落盘，避免防抖延迟导致画廊显示旧数据
            const w = useWorkStore.getState().work
            if (w) await saveWorkNow(w)
            navigate('/')
          }}
          title="返回我的作品"
        >
          🏠
        </button>
        <input
          className="work-name-input"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => nameDraft.trim() && renameWork(nameDraft.trim())}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          title="作品名字"
        />
        <CityPicker />
        <BaseLayerPicker />
        <button
          className="icon-btn"
          onClick={() => setToolbarCollapsed(true)}
          title="收起工具栏，画图更宽敞"
        >
          ▲
        </button>
      </div>

      <div className="toolbar-row">
        <div className="mode-group" role="group">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`btn mode-btn ${mode === m.key ? 'mode-btn-active' : ''}`}
              onClick={() => pickMode(m.key)}
              title={m.hint}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={undo} disabled={!canUndo} title="撤销 (Ctrl+Z)">
          ↩️
        </button>
        <button className="btn btn-ghost" onClick={redo} disabled={!canRedo} title="重做 (Ctrl+Y)">
          ↪️
        </button>
        <button
          className={`btn ${stickerPanelOpen ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setStickerPanelOpen(!stickerPanelOpen)}
          title="贴纸装饰"
        >
          🎨 贴纸
        </button>
        <button className="btn btn-primary" onClick={() => setExportOpen(true)} title="导出与打印">
          📤 导出
        </button>
      </div>

      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
    </div>
  )
}
