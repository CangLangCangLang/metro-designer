import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Work } from '../model/types'
import { loadWork } from '../store/persist'
import { exportWorkToSVG } from '../export/renderSVG'

/** 打印页：整页 SVG + A4 排版 */
export function PrintPage() {
  const { workId } = useParams<{ workId: string }>()
  const navigate = useNavigate()
  const [work, setWork] = useState<Work | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    loadWork(workId ?? '').then((w) => {
      if (w) setWork(w)
      else setNotFound(true)
    })
  }, [workId])

  if (notFound) {
    return (
      <div className="page-loading">
        <div>😢 找不到这个作品</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          🏠 回到画廊
        </button>
      </div>
    )
  }

  if (!work) {
    return (
      <div className="page-loading">
        <div className="page-loading-emoji">🖨️</div>
        <div>正在准备打印…</div>
      </div>
    )
  }

  const { svg } = exportWorkToSVG(work, {
    background: 'white',
    showLegend: true,
    showStickers: true,
    showTitle: true,
  })

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <button className="btn btn-primary btn-big" onClick={() => window.print()}>
          🖨️ 打印
        </button>
        <button className="btn btn-big" onClick={() => navigate(`/editor/${work.id}`)}>
          ✏️ 返回继续画
        </button>
        <span className="print-tip">小提示：打印设置里选「A4 纸」，方向选「自动」就可以啦</span>
      </div>
      <div className="print-sheet" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
