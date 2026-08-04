import { useEffect, useRef, useState } from 'react'
import { Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { LINE_COLORS } from '../model/factory'

const MAX_POINTS = 600
const SAMPLE_PX = 4
// 触屏友好：吸附半径放大到 50px（手指/触控笔很难精准压在站点圆点上）
const SNAP_PX = 50

/** 画笔颜色：优先当前活动线路颜色 */
function useBrushColor(): string {
  const work = useWorkStore((s) => s.work)
  const activeLineId = useUIStore((s) => s.activeLineId)
  const line = work?.lines.find((l) => l.id === activeLineId)
  return line?.color ?? LINE_COLORS[0]
}

type StationLike = { id: string; lat: number; lng: number }

/** 屏幕像素 (clientX,clientY) 附近 SNAP_PX 内最近的站点（用于拖动预览） */
function nearestStationPx(
  map: L.Map,
  stations: Record<string, StationLike>,
  clientX: number,
  clientY: number,
): StationLike | null {
  if (!map || !stations) return null
  const rect = map.getContainer().getBoundingClientRect()
  const p = L.point(clientX - rect.left, clientY - rect.top)
  let best: StationLike | null = null
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

/** 经纬度附近 SNAP_PX 内最近的站点（用于起/收笔判定） */
function nearestStation(
  map: L.Map,
  stations: Record<string, StationLike>,
  lat: number,
  lng: number,
): StationLike | null {
  const p = map.latLngToContainerPoint([lat, lng])
  let best: StationLike | null = null
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

/** 当前可建站的线路：优先活动线路，否则第一条 */
function fallbackLineId(): string | undefined {
  const w = useWorkStore.getState().work
  return useUIStore.getState().activeLineId || w?.lines[0]?.id
}

/** 在 stationIds 中找到 a、b 为相邻两站的区间序号（顺序无关，画笔可正向或反向画）；找不到返回 -1 */
function findConsecutiveIndex(stationIds: string[], a: string, b: string): number {
  for (let i = 0; i < stationIds.length - 1; i++) {
    if (stationIds[i] === a && stationIds[i + 1] === b) return i
    if (stationIds[i] === b && stationIds[i + 1] === a) return i
  }
  return -1
}

/**
 * 自由画笔：进入画笔模式后在地图上方铺一层透明覆盖层，用 Pointer 事件（鼠标+触屏通用）
 * 采集路径，松手成线。覆盖层吃掉了所有指针事件，地图因此不会平移/缩放。
 * - touch-action:none 阻止浏览器对触屏手势的默认滚动/缩放。
 * - setPointerCapture 让拖动到覆盖层外也能继续收笔。
 * 关键：画笔**必须**从站点开始、到站点结束。
 *   - 起/收笔若靠近某站点（SNAP_PX 内），自动吸附到该站坐标；
 *   - 若附近没有站点，则在起/收笔处自动新建一个站点（计入当前线路），保证两端永远是站，
 *     这样画笔画出的曲线真正"连"在线路上，不会画出脱离线路的悬空线。
 * 退出画笔模式时恢复地图交互。
 */
export function FreehandDrawer() {
  const map = useMap()
  const mode = useUIStore((s) => s.mode)
  const addFreehand = useWorkStore((s) => s.addFreehand)
  const addStation = useWorkStore((s) => s.addStation)
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

  /** 把 (lat,lng) 解析成「站点锚点」：优先吸附已有站，没有就自动建站。返回坐标+站 id */
  const resolveStationAnchor = (lat: number, lng: number): { lat: number; lng: number; id: string | null } => {
    const stations = useWorkStore.getState().work?.stations ?? {}
    const hit = nearestStation(map, stations, lat, lng)
    if (hit) return { lat: hit.lat, lng: hit.lng, id: hit.id }
    const lid = fallbackLineId()
    if (lid) {
      const id = addStation(lid, lat, lng)
      const st = useWorkStore.getState().work?.stations[id]
      if (st) return { lat: st.lat, lng: st.lng, id }
    }
    return { lat, lng, id: null }
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
    const ll = toLatLng(e.clientX, e.clientY)
    const anchor = resolveStationAnchor(ll.lat, ll.lng)
    startStationRef.current = anchor.id
    setSnap(anchor.id)
    draftRef.current = [[anchor.lat, anchor.lng]]
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
      const lastLL = pts[pts.length - 1]
      const anchor = resolveStationAnchor(lastLL[0], lastLL[1])
      pts[pts.length - 1] = [anchor.lat, anchor.lng]
      endStationId = anchor.id
    }
    draftRef.current = []
    setDraft([])
    setSnap(null)
    const startId = startStationRef.current
    startStationRef.current = null

    // 若起/终点都落在某条线路的两个相邻站点上 → 把笔画路径直接喂进该区间（segmentPaths），
    // 让这条线真正沿手绘画出来，且不会额外渲染一条独立画笔线。否则保留为装饰性画笔笔迹。
    const w = useWorkStore.getState().work
    const lines = w?.lines ?? []
    // 优先活动线路，其次任意包含该相邻对的线路
    const ordered = [
      ...lines.filter((l) => l.id === useUIStore.getState().activeLineId),
      ...lines.filter((l) => l.id !== useUIStore.getState().activeLineId),
    ]
    let consumed: { lineId: string; segIdx: number } | null = null
    if (startId && endStationId && startId !== endStationId) {
      for (const l of ordered) {
        const idx = findConsecutiveIndex(l.stationIds, startId, endStationId)
        if (idx >= 0) {
          consumed = { lineId: l.id, segIdx: idx }
          break
        }
      }
    }
    if (consumed) {
      let pathPts = pts.map(([lat, lng]) => ({ lat, lng }))
      // 若用户反向画（B→A），把路径翻正为 A→B，避免端点被强行对调后绕圈
      const cl = lines.find((l) => l.id === consumed!.lineId)!
      if (cl.stationIds[consumed.segIdx] === endStationId && cl.stationIds[consumed.segIdx + 1] === startId) {
        pathPts = pathPts.slice().reverse()
      }
      useWorkStore.getState().setSegmentPath(consumed.lineId, consumed.segIdx, pathPts)
    } else if (pts.length >= 2) {
      // 未连入线路（如空白区自由涂鸦）→ 保留为装饰性画笔笔迹
      addFreehand(brushColor, pts.map(([lat, lng]) => ({ lat, lng })), 2, startId, endStationId)
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
