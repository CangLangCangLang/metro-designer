import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { saveWorkNow } from '../store/persist'
import { exportToPng, exportToSvgString } from '../export/exportImage'
import { exportWorkToJson } from '../export/jsonIO'
import { downloadBlob, downloadText, safeFilename } from '../utils/download'
import { cityByKey } from '../data/cities'
import type { ExportOptions } from '../export/renderSVG'

type Scope = 'all' | 'select'
type Bg = 'white' | 'transparent' | 'map'

/** 导出与打印对话框：全部/选择线路、白底/透明/地图底图，导出 PNG / SVG / JSON / 打印 */
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

  const visibleLines = work.lines.filter((l) => l.visible && l.stationIds.length >= 2)
  // 默认选中全部可见线路
  const [selectedIds, setSelectedIds] = useState<string[]>(visibleLines.map((l) => l.id))

  // 背景模式：勾选透明时强制 transparent（与白底互斥）
  const resolvedBg: Bg = transparent ? 'transparent' : bg

  const cityName = cityByKey(work.cityKey)?.name
  const prefix = cityName ? `${cityName}-` : ''
  const fileBase = (lineName?: string) => safeFilename(`${prefix}${lineName ?? work.name}`)

  const buildOpts = (lineIds?: string[], titleOverride?: string): ExportOptions => ({
    background: resolvedBg,
    showLegend,
    showStickers,
    showTitle: true,
    ...(lineIds ? { scope: { lineIds } } : {}),
    ...(titleOverride ? { titleOverride } : {}),
  })

  const noSelection = scope === 'select' && selectedIds.length === 0
  const exportDisabled = busy !== null || noSelection

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  /** 实际导出的线路集合：全部模式 = 所有可见线；选择模式 = 已勾选的线 */
  const exportLines = () =>
    scope === 'select'
      ? visibleLines.filter((l) => selectedIds.includes(l.id))
      : visibleLines

  const doPng = async (scale: 2 | 3) => {
    if (noSelection) return
    setBusy(`png${scale}`)
    try {
      if (scope === 'select') {
        for (const line of exportLines()) {
          const blob = await exportToPng(
            work,
            buildOpts([line.id], cityName ? `${cityName} · ${line.name}` : line.name),
            baseLayerKey,
            scale,
          )
          downloadBlob(blob, `${fileBase(line.name)}-${scale}x.png`)
          await wait(300)
        }
      } else {
        const blob = await exportToPng(work, buildOpts(), baseLayerKey, scale)
        downloadBlob(blob, `${fileBase()}-${scale}x.png`)
      }
      onClose()
    } catch (err) {
      alert(`导出失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  const doSvg = async () => {
    if (noSelection) return
    setBusy('svg')
    try {
      if (scope === 'select') {
        for (const line of exportLines()) {
          const svg = await exportToSvgString(
            work,
            buildOpts([line.id], cityName ? `${cityName} · ${line.name}` : line.name),
            baseLayerKey,
            bg === 'map' ? 2 : 1,
          )
          downloadText(svg, `${fileBase(line.name)}.svg`, 'image/svg+xml')
          await wait(300)
        }
      } else {
        const svg = await exportToSvgString(work, buildOpts(), baseLayerKey, bg === 'map' ? 2 : 1)
        downloadText(svg, `${fileBase()}.svg`, 'image/svg+xml')
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
              全部线路（一张图）
            </button>
            <button
              className={`pill-btn ${scope === 'select' ? 'pill-on' : ''}`}
              onClick={() => setScope('select')}
              disabled={visibleLines.length === 0}
              title={visibleLines.length === 0 ? '暂无可见线路' : '勾选要导出的线路，每条一张'}
            >
              选择线路（每条一张）
            </button>
          </div>
          {scope === 'select' && (
            <>
              <div className="line-select">
                {visibleLines.map((l) => (
                  <label key={l.id} className="line-select-item">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(l.id)}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          prev.includes(l.id)
                            ? prev.filter((x) => x !== l.id)
                            : [...prev, l.id],
                        )
                      }
                    />
                    <span className="line-swatch" style={{ background: l.color }} />
                    {l.name}
                  </label>
                ))}
              </div>
              <div className="line-select-actions">
                <button
                  className="btn btn-small"
                  onClick={() => setSelectedIds(visibleLines.map((l) => l.id))}
                >
                  全选
                </button>
                <button
                  className="btn btn-small"
                  onClick={() => setSelectedIds([])}
                >
                  全不选
                </button>
              </div>
              <div className="export-hint">
                将导出已勾选的 {selectedIds.length} 条线路，每条一张（文件名：城市-线路名）
              </div>
            </>
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
              title="带上真实地图底图（按线路范围放大铺满整张图）"
            >
              🗺️ 地图底图
            </button>
          </div>
          {bg === 'map' && (
            <div className="export-hint">
              会按所选线路范围放大、并叠加上真实地图背景（地图正好覆盖这条线路的走向），底图用 CORS 安全样式以保证可保存。
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
          <button className="btn btn-big" disabled={exportDisabled} onClick={() => void doPng(2)}>
            {busy === 'png2' ? '⏳ 生成中…' : '🖼️ PNG 图片（清晰）'}
          </button>
          <button className="btn btn-big" disabled={exportDisabled} onClick={() => void doPng(3)}>
            {busy === 'png3' ? '⏳ 生成中…' : '🖼️ PNG 图片（超清）'}
          </button>
          <button className="btn btn-big" disabled={exportDisabled} onClick={doSvg}>
            📐 SVG 矢量图（打印最清晰）
          </button>
          <button className="btn btn-big" disabled={exportDisabled} onClick={doJson}>
            💾 作品文件（分享/备份）
          </button>
        </div>

        <button
          className="btn btn-primary btn-big btn-block"
          disabled={exportDisabled}
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
