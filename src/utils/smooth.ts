/**
 * Catmull-Rom 样条平滑：编辑器（Leaflet 密点折线）与 SVG 导出（三次贝塞尔）
 * 共用同一套插值数学，保证两处视觉一致。
 */

export interface Vec2 {
  x: number
  y: number
}

/** 段数较少时每段采样点数 */
const SAMPLES_PER_SEG = 16

/** 计算一段 Catmull-Rom 的三次贝塞尔控制点 */
function bezierControls(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2): [Vec2, Vec2] {
  return [
    { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
    { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
  ]
}

function cubicAt(p1: Vec2, c1: Vec2, c2: Vec2, p2: Vec2, t: number): Vec2 {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * p1.x + b * c1.x + c * c2.x + d * p2.x,
    y: a * p1.y + b * c1.y + c * c2.y + d * p2.y,
  }
}

/**
 * 平滑采样：输入稀疏点列，输出密集平滑点列（含首尾）。
 * 编辑器 Leaflet polyline 用（经纬度直接当平面坐标，小范围线性可接受）。
 */
export function smoothSample<T extends Vec2>(pts: T[]): Vec2[] {
  return smoothSampleWithSeg(pts).points
}

/**
 * 平滑采样并记录每个采样点所属的原始区间（段 i = pts[i]→pts[i+1]）。
 * 列车区间时速需要把平滑后的密点映射回站点区间。
 */
export function smoothSampleWithSeg<T extends Vec2>(pts: T[]): {
  points: Vec2[]
  segOf: number[]
} {
  if (pts.length < 3) {
    return {
      points: pts.map((p) => ({ x: p.x, y: p.y })),
      segOf: pts.map((_, i) => Math.min(Math.max(0, i - 1), Math.max(0, pts.length - 2))),
    }
  }
  const points: Vec2[] = [{ x: pts[0].x, y: pts[0].y }]
  const segOf: number[] = [0]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const [c1, c2] = bezierControls(p0, p1, p2, p3)
    for (let s = 1; s <= SAMPLES_PER_SEG; s++) {
      points.push(cubicAt(p1, c1, c2, p2, s / SAMPLES_PER_SEG))
      segOf.push(i)
    }
  }
  return { points, segOf }
}

/**
 * 平滑 SVG path：M 起点，后续每段 C 三次贝塞尔。
 * 点不足 3 个时退化为直线段 L。
 */
export function smoothPathD(pts: Vec2[]): string {
  if (pts.length === 0) return ''
  if (pts.length < 3) {
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }
  const parts: string[] = [`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const [c1, c2] = bezierControls(p0, p1, p2, p3)
    parts.push(
      `C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
    )
  }
  return parts.join(' ')
}

/** 直线段 SVG path（与 smoothPathD 对应） */
export function straightPathD(pts: Vec2[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}
