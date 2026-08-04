import L from 'leaflet'
import type { Line, Station } from '../model/types'
import { bearingDegrees, distanceMeters } from '../utils/geo'
import { lineSegments } from '../utils/lineSegments'

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
  // 与线路渲染共用 lineSegments：直线/曲线/手绘覆盖区间全部一致，列车沿用户画的线跑（不出轨）
  const parts = lineSegments(line, stations)
  if (parts.length === 0) return { pts: [], cum: [], total: 0, segOf: [] }

  const pts: { lat: number; lng: number }[] = []
  const segOf: number[] = []
  for (const part of parts) {
    part.pts.forEach((p, i) => {
      // 相邻段共享端点，去重避免里程重复累加
      if (i === 0 && pts.length > 0) return
      pts.push({ lat: p[0], lng: p[1] })
      segOf.push(part.segIdx)
    })
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
