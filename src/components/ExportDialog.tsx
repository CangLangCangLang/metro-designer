import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkStore } from '../store/workStore'
import { saveWorkNow } from '../store/persist'
import { exportWorkToSVG, type ExportOptions } from '../export/renderSVG'
import { svgToPngBlob } from '../export/svgToPng'
import { exportWorkToJson } from '../export/jsonIO'
import { downloadBlob, downloadText, safeFilename } from '../utils/download'

/** 导出与打印对话框：PNG / SVG / JSON / 打印 */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const work = useWorkStore((s) => s.work)
  const [transparent, setTransparent] = useState(false)
  const [showLegend, setShowLegend] = useState(true)
  const [showStickers, setShowStickers] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  if (!work) return null

  const buildSVG = (): { svg: string; width: number; height: number } => {
    const opts: Partial<ExportOptions> = {
      background: transparent ? 'transparent' : 'white',
      showLegend,
      showStickers,
      showTitle: true,
    }
    return exportWorkToSVG(work, opts)
  }

  const doPng = async (scale: 2 | 3) => {
    setBusy(`png${scale}`)
    try {
      const { svg, width, height } = buildSVG()
      const blob = await svgToPngBlob(svg, width, height, scale)
      downloadBlob(blob, `${safeFilename(work.name)}-${scale}x.png`)
      onClose()
    } catch (err) {
      alert(`导出失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  const doSvg = () => {
    const { svg } = buildSVG()
    downloadText(svg, `${safeFilename(work.name)}.svg`, 'image/svg+xml')
    onClose()
  }

  const doJson = () => {
    exportWorkToJson(work)
    onClose()
  }

  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">📤 导出「{work.name}」</div>

        <div className="export-options">
          <label className="export-check">
            <input type="checkbox" checked={showLegend} onChange={(e) => setShowLegend(e.target.checked)} />
            带图例（线路说明）
          </label>
          <label className="export-check">
            <input type="checkbox" checked={showStickers} onChange={(e) => setShowStickers(e.target.checked)} />
            带贴纸
          </label>
          <label className="export-check">
            <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
            透明背景
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
