import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { loadWork } from '../store/persist'
import { MapCanvas } from '../map/MapCanvas'
import { Toolbar } from './Toolbar'
import { LinePanel } from './LinePanel'
import { TrainControls } from './TrainControls'
import { SelectionBar } from './SelectionBar'
import { StickerPalette } from './StickerPalette'
import { PlacingHint } from './PlacingHint'
import { EditorHint } from './EditorHint'

export function EditorPage() {
  const { workId } = useParams<{ workId: string }>()
  const navigate = useNavigate()
  const work = useWorkStore((s) => s.work)
  const setWork = useWorkStore((s) => s.setWork)
  const resetTransient = useUIStore((s) => s.resetTransient)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    resetTransient()
    loadWork(workId ?? '')
      .then((w) => {
        if (!alive) return
        if (!w) {
          navigate('/', { replace: true })
          return
        }
        setWork(w)
        if (w.lines.length > 0) {
          useUIStore.getState().setActiveLine(w.lines[0].id)
        }
        setLoading(false)
      })
      .catch(() => {
        if (alive) navigate('/', { replace: true })
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId])

  if (loading || !work) {
    return (
      <div className="page-loading">
        <div className="page-loading-emoji">🚇</div>
        <div>正在打开你的地铁图…</div>
      </div>
    )
  }

  return (
    <div className="editor-page">
      <MapCanvas />
      <Toolbar />
      <LinePanel />
      <TrainControls />
      <SelectionBar />
      <StickerPalette />
      <PlacingHint />
      <EditorHint />
    </div>
  )
}
