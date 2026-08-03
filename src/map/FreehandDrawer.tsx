import { useEffect, useRef, useState } from 'react'
import { Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { LINE_COLORS } from '../model/factory'

const MAX_POINTS = 600
const SAMPLE_PX = 4

/** 画笔颜色：优先当前活动线路颜色 */
function useBrushColor(): string {
  const work = useWorkStore((s) => s.work)
  const activeLineId = useUIStore((s) => s.activeLineId)
  const line = work?.lines.find((l) => l.id === activeLineId)
  return line?.color ?? LINE_COLORS[0]
}

/** 自由画笔：按下拖动采样路径，松手成线 */
export function FreehandDrawer() {
  const map = useMap()
  const addFreehand = useWorkStore((s) => s.addFreehand)
  const brushColor = useBrushColor()
  const drawingRef = useRef(false)
  const draftRef = useRef<[number, number][]>([])
  const [draft, setDraft] = useState<[number, number][]>([])

  const finish = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    map.dragging.enable()
    const pts = draftRef.current
    draftRef.current = []
    setDraft([])
    if (pts.length >= 2) {
      addFreehand(brushColor, pts.map(([lat, lng]) => ({ lat, lng })), 2)
    }
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  const startDraw = (e: L.LeafletMouseEvent) => {
    if (useUIStore.getState().mode !== 'freehand') return
    drawingRef.current = true
    map.dragging.disable()
    draftRef.current = [[e.latlng.lat, e.latlng.lng]]
    setDraft([...draftRef.current])
  }

  useMapEvents({
    mousedown: startDraw,
    // @types/leaflet 漏掉了 touch 事件名（运行时 Leaflet 支持），断言绕过
    ...({
      touchstart: startDraw,
      touchmove: (e: L.LeafletMouseEvent) => sample(e.latlng.lat, e.latlng.lng),
      touchend: () => finishRef.current(),
    } as L.LeafletEventHandlerFnMap),
    mousemove: (e) => sample(e.latlng.lat, e.latlng.lng),
    mouseup: () => finishRef.current(),
  })

  function sample(lat: number, lng: number) {
    if (!drawingRef.current || useUIStore.getState().mode !== 'freehand') return
    const pts = draftRef.current
    if (pts.length === 0 || pts.length >= MAX_POINTS) return
    const last = pts[pts.length - 1]
    const d = map
      .latLngToContainerPoint([lat, lng])
      .distanceTo(map.latLngToContainerPoint([last[0], last[1]]))
    if (d < SAMPLE_PX) return
    pts.push([lat, lng])
    setDraft([...pts])
  }

  // 地图外松开也要结束笔画
  useEffect(() => {
    const up = () => finishRef.current()
    window.addEventListener('mouseup', up)
    window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchend', up)
    }
  }, [])

  if (draft.length < 2) return null
  return (
    <Polyline
      positions={draft}
      pathOptions={{
        color: brushColor,
        weight: 6,
        opacity: 0.75,
        lineCap: 'round',
        lineJoin: 'round',
      }}
      interactive={false}
    />
  )
}
