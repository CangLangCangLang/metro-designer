import L from 'leaflet'
import type { Line, Station } from '../model/types'
import { bearingDegrees, distanceMeters } from '../utils/geo'
import { smoothSampleWithSeg } from '../utils/smooth'

/** 线路几何：站点序列 + 累计里程 + 区间映射，用于列车匀速插值与区间时速 */
export interface RouteGeom {
  pts: { lat: number; lng: number }[]
  /** 每个点距起点的累计米数，与 pts 等长 */
  cum: number[]
  total: number
  /**
   * 每个"段"（pts[lo]→pts[lo+1]，下标 lo）所属的站点区间序号
   * （stationIds[i]→stationIds[i+1] 的 i）。与 pts 等长（末点忽略）。
   */
  segOf: number[]
}

export function buildRouteGeom(
  line: Line,
  stations: Record<string, Station>,
): RouteGeom {
  const raw = line.stationIds
    .map((id) => stations[id])
    .filter((s): s is Station => Boolean(s))
    .map((s) => ({ lat: s.lat, lng: s.lng }))

  let pts: { lat: number; lng: number }[]
  let segOf: number[]
  if ((line.pathMode ?? 'straight') === 'smooth' && raw.length >= 3) {
    // 曲线模式：平滑采样，列车沿曲线跑（不出轨），并记录采样点所属站点区间
    const { points, segOf: so } = smoothSampleWithSeg(raw.map((s) => ({ x: s.lat, y: s.lng })))
    pts = points.map((p) => ({ lat: p.x, lng: p.y }))
    segOf = so
  } else {
    pts = raw
    // 直线模式：段 lo 即站点区间 lo
    segOf = raw.map((_, i) => Math.min(i, Math.max(0, raw.length - 2)))
  }

  const cum: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + distanceMeters(pts[i - 1], pts[i]))
  }
  return { pts, cum, total: cum.length > 0 ? cum[cum.length - 1] : 0, segOf }
}

/** 距起点 d 米处的坐标、朝向与所在站点区间序号 */
export function pointAtDistance(
  g: RouteGeom,
  d: number,
): { latlng: L.LatLng; bearing: number; segIdx: number } {
  if (g.pts.length === 0) return { latlng: L.latLng(0, 0), bearing: 0, segIdx: 0 }
  if (g.pts.length === 1)
    return { latlng: L.latLng(g.pts[0].lat, g.pts[0].lng), bearing: 0, segIdx: 0 }
  const dd = Math.max(0, Math.min(g.total, d))
  let lo = 0
  let hi = g.cum.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (g.cum[mid] <= dd) lo = mid
    else hi = mid
  }
  const a = g.pts[lo]
  const b = g.pts[lo + 1]
  const segLen = g.cum[lo + 1] - g.cum[lo] || 1
  const t = (dd - g.cum[lo]) / segLen
  return {
    latlng: L.latLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t),
    bearing: bearingDegrees(a, b),
    segIdx: g.segOf[lo] ?? 0,
  }
}
