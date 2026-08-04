/** 地理工具：距离计算（haversine，米） */

import { smoothSample, smoothSampleWithSeg } from './smooth'

const EARTH_R = 6371000

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const h =
    s1 * s1 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 初始方位角（度，0=北，顺时针） */
export function bearingDegrees(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(la2)
  const x =
    Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** 某纬度、某缩放级别下，1 屏幕像素对应的地面米数（Web Mercator） */
export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
}

/** 线路总长（米）：站间距离累加；曲线模式先平滑采样再累加 */
export function lineLengthMeters(
  line: { stationIds: string[]; pathMode?: 'straight' | 'smooth' },
  stations: Record<string, { lat: number; lng: number }>,
): number {
  const raw = line.stationIds
    .map((id) => stations[id])
    .filter((s): s is { lat: number; lng: number } => Boolean(s))
  if (raw.length < 2) return 0
  const pts =
    (line.pathMode ?? 'straight') === 'smooth' && raw.length >= 3
      ? smoothSample(raw.map((s) => ({ x: s.lat, y: s.lng }))).map((p) => ({
          lat: p.x,
          lng: p.y,
        }))
      : raw
  let total = 0
  for (let i = 1; i < pts.length; i++) total += distanceMeters(pts[i - 1], pts[i])
  return total
}

/** 相邻两站距离（米，直线距离） */
export function segmentMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  return distanceMeters(a, b)
}

/** 里程格式化：850米 / 3.2公里 / 42公里 */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}米`
  if (m < 10000) return `${(m / 1000).toFixed(1)}公里`
  return `${Math.round(m / 1000)}公里`
}

/** 线路时速可循环档位 */
export const LINE_SPEED_OPTIONS = [60, 80, 100, 120]
/** 区间时速循环档位（0 = 自动，跟随线路时速） */
export const SEG_SPEED_OPTIONS = [0, 40, 60, 80, 100, 120]

interface LineLike {
  stationIds: string[]
  pathMode?: 'straight' | 'smooth'
  speedKmh?: number
  segmentSpeeds?: Record<number, number>
  /** 每站停站时长（秒），缺省 30 */
  dwellSeconds?: number
}

/** 每个站间区间的里程（米），曲线模式按平滑弧长 */
export function segmentLengthsMeters(
  line: LineLike,
  stations: Record<string, { lat: number; lng: number }>,
): number[] {
  const raw = line.stationIds
    .map((id) => stations[id])
    .filter((s): s is { lat: number; lng: number } => Boolean(s))
  const segCount = raw.length - 1
  if (segCount < 1) return []
  const lens = new Array<number>(segCount).fill(0)
  if ((line.pathMode ?? 'straight') === 'smooth' && raw.length >= 3) {
    const { points, segOf } = smoothSampleWithSeg(raw.map((s) => ({ x: s.lat, y: s.lng })))
    const pts = points.map((p) => ({ lat: p.x, lng: p.y }))
    for (let i = 1; i < pts.length; i++) {
      lens[segOf[i]] += distanceMeters(pts[i - 1], pts[i])
    }
  } else {
    for (let i = 0; i < segCount; i++) lens[i] = distanceMeters(raw[i], raw[i + 1])
  }
  return lens
}

/** 区间时速：覆盖优先，否则跟随线路时速（默认 80） */
export function segmentSpeedKmh(line: LineLike, segIdx: number): number {
  return line.segmentSpeeds?.[segIdx] ?? line.speedKmh ?? 80
}

/** 全程运行时间（分钟）：Σ(区间里程 ÷ 区间时速)，不含停站时间 */
export function tripMinutes(
  line: LineLike,
  stations: Record<string, { lat: number; lng: number }>,
): number {
  const lens = segmentLengthsMeters(line, stations)
  let minutes = 0
  for (let i = 0; i < lens.length; i++) {
    const kmh = segmentSpeedKmh(line, i)
    // 米 → 公里 ÷ 时速 = 小时 → ×60 = 分钟
    minutes += (lens[i] / 1000 / kmh) * 60
  }
  return minutes
}

/** 时间格式化：约 8 分钟 / 约 1 小时 5 分钟 */
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `约 ${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `约 ${h} 小时` : `约 ${h} 小时 ${rest} 分钟`
}

/* ==================== 运行时长 / 时刻表 ==================== */

/** 默认每站停站时长（秒），真实地铁常见 30 秒左右 */
export const DEFAULT_DWELL_SEC = 30
/** 停站时长可选档位（秒） */
export const DWELL_OPTIONS = [0, 20, 30, 45, 60]
/** 默认首班车 / 末班车（未设置的线路按此展示） */
export const DEFAULT_FIRST_TRAIN = '06:00'
export const DEFAULT_LAST_TRAIN = '22:30'

/** 每站停站时长（秒），缺省 30 */
export function dwellSeconds(line: LineLike): number {
  const v = line.dwellSeconds
  return typeof v === 'number' && v >= 0 ? v : DEFAULT_DWELL_SEC
}

/**
 * 每个站间区间的纯运行时长（分钟，不含停站）。
 * 第 i 项 = stationIds[i] → stationIds[i+1] 的行车时间。
 */
export function segmentMinutes(
  line: LineLike,
  stations: Record<string, { lat: number; lng: number }>,
): number[] {
  const lens = segmentLengthsMeters(line, stations)
  return lens.map((m, i) => (m / 1000 / segmentSpeedKmh(line, i)) * 60)
}

/**
 * 全程时长（分钟，含中间站停站时间）。
 * 起点不计停站、终点不计停站，中间每站各停 dwellSeconds。
 */
export function tripMinutesWithDwell(
  line: LineLike,
  stations: Record<string, { lat: number; lng: number }>,
): number {
  const run = tripMinutes(line, stations)
  const segs = segmentLengthsMeters(line, stations).length
  const midStops = Math.max(segs - 1, 0)
  return run + (midStops * dwellSeconds(line)) / 60
}

/**
 * 列车从起点发车后，到达每一站的累计分钟偏移（第 0 站为 0）。
 * 计入中间站的停站时间，用于推算各站到站时刻。
 */
export function stationOffsetsMinutes(
  line: LineLike,
  stations: Record<string, { lat: number; lng: number }>,
): number[] {
  const segMin = segmentMinutes(line, stations)
  const dwellMin = dwellSeconds(line) / 60
  const out: number[] = [0]
  let acc = 0
  for (let i = 0; i < segMin.length; i++) {
    // 第 i 段之前若已经过中间站，先加上那一站的停站时间
    if (i > 0) acc += dwellMin
    acc += segMin[i]
    out.push(acc)
  }
  return out
}

/** 解析 "HH:MM" → 当天分钟数；非法返回 null */
export function parseHHMM(s: string | undefined | null): number | null {
  if (!s) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = parseInt(m[1], 10)
  const mi = parseInt(m[2], 10)
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null
  return h * 60 + mi
}

/** 分钟数 → "HH:MM"（超过 24 小时自动回绕到次日） */
export function formatHHMM(minutes: number): string {
  const t = ((Math.round(minutes) % 1440) + 1440) % 1440
  const h = Math.floor(t / 60)
  const mi = t % 60
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
}

/** 短时长格式化（区间用）：45秒 / 1分30秒 / 12分钟 */
export function formatShortDuration(minutes: number): string {
  const totalSec = Math.round(minutes * 60)
  if (totalSec < 60) return `${totalSec}秒`
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m >= 10 || s === 0) return `${m}分钟`
  return `${m}分${s}秒`
}

/**
 * 运营时长（分钟）：首班车 → 末班车发车的跨度。
 * 末班车早于首班车时视为跨零点（如 05:30 → 00:30）。
 */
export function operatingMinutes(
  first: string | undefined,
  last: string | undefined,
): number | null {
  const a = parseHHMM(first)
  const b = parseHHMM(last)
  if (a === null || b === null) return null
  return b >= a ? b - a : b + 1440 - a
}
