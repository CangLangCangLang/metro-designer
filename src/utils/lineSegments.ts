import type { Line, Station } from '../model/types'
import { smoothSampleWithSeg } from './smooth'

export type Ground = 'ground' | 'under'

export interface SegPart {
  /** 站点区间序号（stationIds[i]→stationIds[i+1] 的 i） */
  segIdx: number
  /** 该段折线点（lat,lng），首末点与相邻段共享，保证视觉连续 */
  pts: [number, number][]
  ground: Ground
}

/**
 * 把一条线路切成「站间区间」列表，每段带地上/地下标记。
 * - 直线模式：每段就是相邻两站的直连。
 * - 曲线模式：用 Catmull-Rom 平滑采样，按 segOf 把密点分组；相邻段共享边界点避免断缝。
 * 地上/地下取决于该区间在 segmentGround 的覆盖，否则跟随线路 defaultGround（默认 ground）。
 */
export function lineSegments(line: Line, stations: Record<string, Station>): SegPart[] {
  const raw = line.stationIds
    .map((id) => stations[id])
    .filter((s): s is Station => Boolean(s))
  if (raw.length < 2) return []

  const defaultG: Ground = line.defaultGround ?? 'ground'
  const groundAt = (i: number): Ground => line.segmentGround?.[i] ?? defaultG

  if ((line.pathMode ?? 'straight') === 'smooth' && raw.length >= 3) {
    const { points, segOf } = smoothSampleWithSeg(raw.map((s) => ({ x: s.lat, y: s.lng })))
    const parts: SegPart[] = []
    let cur: [number, number][] = [[points[0].x, points[0].y]]
    let curSeg = segOf[0]
    for (let i = 1; i < points.length; i++) {
      const p: [number, number] = [points[i].x, points[i].y]
      if (segOf[i] !== curSeg) {
        // 当前段收尾（带上边界点），下一段从同一边界点起笔，保证连续
        cur.push(p)
        parts.push({ segIdx: curSeg, pts: cur, ground: groundAt(curSeg) })
        cur = [p]
        curSeg = segOf[i]
      } else {
        cur.push(p)
      }
    }
    if (cur.length >= 2) parts.push({ segIdx: curSeg, pts: cur, ground: groundAt(curSeg) })
    return parts
  }

  const parts: SegPart[] = []
  for (let i = 0; i < raw.length - 1; i++) {
    parts.push({
      segIdx: i,
      pts: [
        [raw[i].lat, raw[i].lng],
        [raw[i + 1].lat, raw[i + 1].lng],
      ],
      ground: groundAt(i),
    })
  }
  return parts
}
