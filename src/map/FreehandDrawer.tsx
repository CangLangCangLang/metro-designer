import { useEffect, useRef, useState } from 'react'
import { Polyline, useMap } from 'react-leaflet'
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

/**
 * 自由画笔：进入画笔模式后在地图上方铺一层透明覆盖层，用 Pointer 事件（鼠标+触屏通用）
 * 采集路径，松手成线。覆盖层吃掉了所有指针事件，地图因此不会平移/缩放。
 * - touch-action:none 阻止浏览器对触屏手势的默认滚动/缩放。
 * - setPointerCapture 让拖动到覆盖层外也能继续收笔。
 * 退出画笔模式时恢复地图交互。
 */
export function FreehandDrawer() {
  const map = useMap()
  const mode = useUIStore((s) => s.mode)
  const addFreehand = useWorkStore((s) => s.addFreehand)
  const brushColor = useBrushColor()
  const drawingRef = useRef(false)
  const draftRef = useRef<[number, number][]>([])
  const [draft, setDraft] = useState<[number, number][]>([])

  // 进入/退出画笔模式：禁用地图拖拽、双指缩放、滚轮缩放，避免「一画就变成拖地图」
  useEffect(() => {
    if (mode === 'freehand') {
      map.dragging.disable()
      map.touchZoom.disable()
      map.doubleClickZoom.disable()
      map.scrollWheelZoom.disable()
    } else {
      map.dragging.enable()
      map.touchZoom.enable()
      map.doubleClickZoom.enable()
      map.scrollWheelZoom.enable()
      drawingRef.current = false
      draftRef.current = []
      setDraft([])
    }
  }, [mode, map])

  if (mode !== 'freehand') return null

  const toLatLng = (clientX: number, clientY: number): L.LatLng => {
    const rect = map.getContainer().getBoundingClientRect()
    return map.containerPointToLatLng(L.point(clientX - rect.left, clientY - rect.top))
  }

  const startDraw = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'freehand') return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const ll = toLatLng(e.clientX, e.clientY)
    draftRef.current = [[ll.lat, ll.lng]]
    setDraft([...draftRef.current])
  }

  const sample = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return
    const ll = toLatLng(e.clientX, e.clientY)
    const pts = draftRef.current
    if (pts.length === 0 || pts.length >= MAX_POINTS) return
    const last = pts[pts.length - 1]
    const d = map
      .latLngToContainerPoint([ll.lat, ll.lng])
      .distanceTo(map.latLngToContainerPoint([last[0], last[1]]))
    if (d < SAMPLE_PX) return
    pts.push([ll.lat, ll.lng])
    setDraft([...pts])
  }

  const finish = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    const pts = draftRef.current
    draftRef.current = []
    setDraft([])
    if (pts.length >= 2) {
      addFreehand(brushColor, pts.map(([lat, lng]) => ({ lat, lng })), 2)
    }
  }

  return (
    <>
      <div
        className="freehand-overlay"
        onPointerDown={startDraw}
        onPointerMove={sample}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      {draft.length >= 2 && (
        <Polyline
          positions={draft}
          pathOptions={{
            color: brushColor,
            weight: 6,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }}
          interactive={false}
        />
      )}
    </>
  )
}
