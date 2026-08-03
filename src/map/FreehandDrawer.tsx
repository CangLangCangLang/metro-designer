import { useEffect, useRef, useState } from 'react'
import { Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { LINE_COLORS } from '../model/factory'

const MAX_POINTS = 600
const SAMPLE_PX = 4
const SNAP_PX = 36

/** 画笔颜色：优先当前活动线路颜色 */
function useBrushColor(): string {
  const work = useWorkStore((s) => s.work)
  const activeLineId = useUIStore((s) => s.activeLineId)
  const line = work?.lines.find((l) => l.id === activeLineId)
  return line?.color ?? LINE_COLORS[0]
}

/** 找屏幕像素 (clientX,clientY) 附近 SNAP_PX 内最近的站点（用于起点/终点吸附） */
function nearestStationPx(
  map: L.Map,
  stations: Record<string, { id: string; lat: number; lng: number }>,
  clientX: number,
  clientY: number,
): { id: string; lat: number; lng: number } | null {
  if (!map || !stations) return null
  const rect = map.getContainer().getBoundingClientRect()
  const p = L.point(clientX - rect.left, clientY - rect.top)
  let best: { id: string; lat: number; lng: number } | null = null
  let bestDist = SNAP_PX
  for (const st of Object.values(stations)) {
    const d = p.distanceTo(map.latLngToContainerPoint([st.lat, st.lng]))
    if (d < bestDist) {
      bestDist = d
      best = { id: st.id, lat: st.lat, lng: st.lng }
    }
  }
  return best
}

/**
 * 自由画笔：进入画笔模式后在地图上方铺一层透明覆盖层，用 Pointer 事件（鼠标+触屏通用）
 * 采集路径，松手成线。覆盖层吃掉了所有指针事件，地图因此不会平移/缩放。
 * - touch-action:none 阻止浏览器对触屏手势的默认滚动/缩放。
 * - setPointerCapture 让拖动到覆盖层外也能继续收笔。
 * 起点/终点若靠近某站点，会自动吸附到该站坐标（并高亮提示），使画笔真正"连"在线路上，
 * 不会画出脱离线路的悬空线。
 * 退出画笔模式时恢复地图交互。
 */
export function FreehandDrawer() {
  const map = useMap()
  const mode = useUIStore((s) => s.mode)
  const addFreehand = useWorkStore((s) => s.addFreehand)
  const brushColor = useBrushColor()
  const drawingRef = useRef(false)
  const draftRef = useRef<[number, number][]>([])
  const startStationRef = useRef<string | null>(null)
  const lastSnapRef = useRef<string | null>(null)
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
      if (lastSnapRef.current) {
        useUIStore.getState().setSnapPreview(null)
        lastSnapRef.current = null
      }
    }
  }, [mode, map])

  if (mode !== 'freehand') return null

  const toLatLng = (clientX: number, clientY: number): L.LatLng => {
    const rect = map.getContainer().getBoundingClientRect()
    return map.containerPointToLatLng(L.point(clientX - rect.left, clientY - rect.top))
  }

  const setSnap = (id: string | null) => {
    if (lastSnapRef.current !== id) {
      lastSnapRef.current = id
      useUIStore.getState().setSnapPreview(id)
    }
  }

  const startDraw = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'freehand') return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const stations = useWorkStore.getState().work?.stations ?? {}
    const snap = nearestStationPx(map, stations, e.clientX, e.clientY)
    let first: [number, number]
    if (snap) {
      first = [snap.lat, snap.lng]
      startStationRef.current = snap.id
      setSnap(snap.id)
    } else {
      const ll = toLatLng(e.clientX, e.clientY)
      first = [ll.lat, ll.lng]
      startStationRef.current = null
    }
    draftRef.current = [first]
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
    // 终点吸附预览：靠近某站时高亮提示将连到该站
    const stations = useWorkStore.getState().work?.stations ?? {}
    setSnap(nearestStationPx(map, stations, e.clientX, e.clientY)?.id ?? null)
  }

  const finish = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    const pts = draftRef.current
    let endStationId: string | null = null
    if (pts.length >= 2) {
      const stations = useWorkStore.getState().work?.stations ?? {}
      const lastLL = pts[pts.length - 1]
      const endPt = map.latLngToContainerPoint(lastLL)
      let best: { id: string; lat: number; lng: number } | null = null
      let bestDist = SNAP_PX
      for (const st of Object.values(stations)) {
        const dd = endPt.distanceTo(map.latLngToContainerPoint([st.lat, st.lng]))
        if (dd < bestDist) {
          bestDist = dd
          best = { id: st.id, lat: st.lat, lng: st.lng }
        }
      }
      if (best) {
        pts[pts.length - 1] = [best.lat, best.lng]
        endStationId = best.id
      }
    }
    draftRef.current = []
    setDraft([])
    setSnap(null)
    if (pts.length >= 2) {
      addFreehand(brushColor, pts.map(([lat, lng]) => ({ lat, lng })), 2, startStationRef.current, endStationId)
    }
    startStationRef.current = null
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
