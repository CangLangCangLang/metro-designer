import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { saveWorkNow } from '../store/persist'
import { exportToPng, exportToSvgString } from '../export/exportImage'
import { exportWorkToJson } from '../export/jsonIO'
import { downloadBlob, downloadText, safeFilename } from '../utils/download'
import type { ExportOptions } from '../export/renderSVG'

type Scope = 'all' | 'perLine'
type Bg = 'white' | 'transparent' | 'map'

/** 导出与打印对话框：按整体 / 按地铁、白底 / 透明 / 地图底图，导出 PNG / SVG / JSON / 打印 */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const work = useWorkStore((s) => s.work)
  const baseLayerKey = useUIStore((s) => s.baseLayerKey)
  const [transparent, setTransparent] = useState(false)
  const [scope, setScope] = useState<Scope>('all')
  const [bg, setBg] = useState<Bg>('white')
  const [showLegend, setShowLegend] = useState(true)
  const [showStickers, setShowStickers] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  if (!work) return null

  // 背景模式：勾选透明时强制 transparent（与白底互斥）
  const resolvedBg: Bg = transparent ? 'transparent' : bg

  const buildOpts = (lineIds?: string[], titleOverride?: string): ExportOptions => ({
    background: resolvedBg,
    showLegend,
    showStickers,
    showTitle: true,
    ...(lineIds ? { scope: { lineIds } } : {}),
    ...(titleOverride ? { titleOverride } : {}),
  })

  const visibleLines = work.lines.filter((l) => l.visible && l.stationIds.length >= 2)

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  const doPng = async (scale: 2 | 3) => {
    setBusy(`png${scale}`)
    try {
      if (scope === 'perLine' && visibleLines.length > 0) {
        for (const line of visibleLines) {
          const blob = await exportToPng(
            work,
            buildOpts([line.id], `${work.name} · ${line.name}`),
            baseLayerKey,
            scale,
          )
          downloadBlob(blob, `${safeFilename(work.name)}-${line.name}-${scale}x.png`)
          await wait(300)
        }
      } else {
        const blob = await exportToPng(work, buildOpts(), baseLayerKey, scale)
        downloadBlob(blob, `${safeFilename(work.name)}-${scale}x.png`)
      }
      onClose()
    } catch (err) {
      alert(`导出失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  const doSvg = async () => {
    setBusy('svg')
    try {
      if (scope === 'perLine' && visibleLines.length > 0) {
        for (const line of visibleLines) {
          const svg = await exportToSvgString(
            work,
            buildOpts([line.id], `${work.name} · ${line.name}`),
            baseLayerKey,
            bg === 'map' ? 2 : 1,
          )
          downloadText(svg, `${safeFilename(work.name)}-${line.name}.svg`, 'image/svg+xml')
          await wait(300)
        }
      } else {
        const svg = await exportToSvgString(work, buildOpts(), baseLayerKey, bg === 'map' ? 2 : 1)
        downloadText(svg, `${safeFilename(work.name)}.svg`, 'image/svg+xml')
      }
      onClose()
    } catch (err) {
      alert(`导出失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  const doJson = () => {
    exportWorkToJson(work)
    onClose()
  }

  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">📤 导出「{work.name}」</div>

        <div className="export-section">
          <div className="export-section-label">导出范围</div>
          <div className="seg-group">
            <button
              className={`pill-btn ${scope === 'all' ? 'pill-on' : ''}`}
              onClick={() => setScope('all')}
            >
              整体线路
            </button>
            <button
              className={`pill-btn ${scope === 'perLine' ? 'pill-on' : ''}`}
              onClick={() => setScope('perLine')}
              disabled={visibleLines.length === 0}
              title={visibleLines.length === 0 ? '暂无可见线路' : '每条线路单独导出一张图'}
            >
              按地铁（每条线一张）
            </button>
          </div>
          {scope === 'perLine' && (
            <div className="export-hint">
              将导出 {visibleLines.length} 张图：{visibleLines.map((l) => l.name).join('、')}
            </div>
          )}
        </div>

        <div className="export-section">
          <div className="export-section-label">背景</div>
          <div className="seg-group">
            <button
              className={`pill-btn ${bg === 'white' ? 'pill-on' : ''}`}
              onClick={() => {
                setBg('white')
                setTransparent(false)
              }}
            >
              白底
            </button>
            <button
              className={`pill-btn ${bg === 'transparent' ? 'pill-on' : ''}`}
              onClick={() => {
                setBg('transparent')
                setTransparent(true)
              }}
            >
              透明
            </button>
            <button
              className={`pill-btn ${bg === 'map' ? 'pill-on' : ''}`}
              onClick={() => {
                setBg('map')
                setTransparent(false)
              }}
              title="带上真实地图底图（放大铺满整张图）"
            >
              🗺️ 地图底图
            </button>
          </div>
          {bg === 'map' && (
            <div className="export-hint">
              会按所选线路范围放大、并叠加上真实地图背景；底图用 CORS 安全样式以保证可保存。
            </div>
          )}
        </div>

        <div className="export-options">
          <label className="export-check">
            <input type="checkbox" checked={showLegend} onChange={(e) => setShowLegend(e.target.checked)} />
            带图例（线路说明）
          </label>
          <label className="export-check">
            <input type="checkbox" checked={showStickers} onChange={(e) => setShowStickers(e.target.checked)} />
            带贴纸
          </label>
        </div>

        <div className="export-grid">
          <button className="btn btn-big" disabled={busy !== null} onClick={() => void doPng(2)}>
            {busy === 'png2' ? '⏳ 生成中…' : '🖼️ PNG 图片（清晰）'}
          </button>
          <button className="btn btn-big" disabled={busy !== null} onClick={() => void doPng(3)}>
            {busy === 'png3' ? '⏳ 生成中…' : '🖼️ PNG 图片（超清）'}
          </button>
          <button className="btn btn-big" disabled={busy !== null} onClick={doSvg}>
            📐 SVG 矢量图（打印最清晰）
          </button>
          <button className="btn btn-big" disabled={busy !== null} onClick={doJson}>
            💾 作品文件（分享/备份）
          </button>
        </div>

        <button
          className="btn btn-primary btn-big btn-block"
          onClick={async () => {
            // 打印页从 IndexedDB 读作品，先强制落盘避免防抖延迟导致旧数据
            const w = useWorkStore.getState().work
            if (w) await saveWorkNow(w)
            navigate(`/print/${work.id}`)
          }}
        >
          🖨️ 去打印（A4 纸）
        </button>

        <button className="btn btn-block" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}
