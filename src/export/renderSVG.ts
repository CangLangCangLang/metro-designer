import type { Work } from '../model/types'
import { isTransfer, stationColor } from '../model/transfer'
import { fitContent, projectMerc, type Pt, type FitTransform } from './project'
import { smoothPathD, straightPathD } from '../utils/smooth'
import { formatDistance, lineLengthMeters } from '../utils/geo'
import { lineSegments } from '../utils/lineSegments'

export interface ExportOptions {
  background: 'white' | 'transparent' | 'map'
  showLegend: boolean
  showStickers: boolean
  showTitle: boolean
  /** 导出范围：仅导出指定线路（按地铁导出）；不传则导出全部可见线路 */
  scope?: { lineIds?: string[] }
  /** 标题覆盖（按地铁导出时填线路名） */
  titleOverride?: string
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  background: 'white',
  showLegend: true,
  showStickers: true,
  showTitle: true,
}

const FONT_STACK = `"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif`

/**
 * 导出画布不再限定 A4 大小：按线路内容范围自适应画布，
 * 并放大到「较长边约 TARGET_LONG 像素」，使线路清晰可见；
 * 地图底图据此级别放大铺满整张图（与线路严格对齐）。
 */
const TARGET_LONG = 2200
/** 缩放下限，避免超大范围时像素过小；上限避免极小内容被放得过分巨大 */
const SCALE_MIN = 0.06
const SCALE_MAX = 40

const LINE_CORE_W = 10
const LINE_CASING_W = 18
const STATION_R = 12
const TRANSFER_R = 17
const LABEL_FONT = 30
const TITLE_FONT = 52

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 粗算文字宽度：全角字符按 1em，半角按 0.55em */
function textWidth(s: string, fontSize: number): number {
  let units = 0
  for (const ch of s) {
    units += ch.charCodeAt(0) > 0xff ? 1 : 0.55
  }
  return units * fontSize
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** 线段与矩形相交检测（用于站名避让线路） */
function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: Rect,
): boolean {
  const inRect = (x: number, y: number) =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
  if (inRect(x1, y1) || inRect(x2, y2)) return true
  // 线段与矩形四条边相交
  const edges: [number, number, number, number][] = [
    [r.x, r.y, r.x + r.w, r.y],
    [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
    [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
    [r.x, r.y + r.h, r.x, r.y],
  ]
  const cross = (ox: number, oy: number, ax: number, ay: number, bx: number, by: number) =>
    (ax - ox) * (by - oy) - (ay - oy) * (bx - ox)
  const segHit = (
    ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, dx: number, dy: number,
  ) => {
    const d1 = cross(cx, cy, dx, dy, ax, ay)
    const d2 = cross(cx, cy, dx, dy, bx, by)
    const d3 = cross(ax, ay, bx, by, cx, cy)
    const d4 = cross(ax, ay, bx, by, dx, dy)
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  }
  for (const [ex1, ey1, ex2, ey2] of edges) {
    if (segHit(x1, y1, x2, y2, ex1, ey1, ex2, ey2)) return true
  }
  return false
}

interface LabelAnchor {
  /** 相对站点的偏移方向（单位向量乘以距离） */
  dx: number
  dy: number
  /** 文字锚点 */
  anchor: 'start' | 'end' | 'middle'
}

/** 8 方位候选（偶数站右优先，奇数站左优先，由调用方翻转） */
const ANCHORS_RIGHT_FIRST: LabelAnchor[] = [
  { dx: 1, dy: 0, anchor: 'start' },
  { dx: 0, dy: -1, anchor: 'middle' },
  { dx: 0, dy: 1, anchor: 'middle' },
  { dx: 1, dy: -1, anchor: 'start' },
  { dx: 1, dy: 1, anchor: 'start' },
  { dx: -1, dy: 0, anchor: 'end' },
  { dx: -1, dy: -1, anchor: 'end' },
  { dx: -1, dy: 1, anchor: 'end' },
]

function flipAnchors(list: LabelAnchor[]): LabelAnchor[] {
  return list.map((a) => ({
    dx: -a.dx,
    dy: a.dy,
    anchor: a.anchor === 'start' ? 'end' : a.anchor === 'end' ? 'start' : 'middle',
  }))
}
const ANCHORS_LEFT_FIRST = flipAnchors(ANCHORS_RIGHT_FIRST)

/**
 * 从作品数据独立渲染一张地铁图 SVG（不依赖 Leaflet / DOM），
 * 含站名 8 方位贪心避让、自动图例、标题。可用于导出与缩略图。
 */
export function exportWorkToSVG(
  work: Work,
  opts: Partial<ExportOptions> = {},
): { svg: string; width: number; height: number; fit: FitTransform } {
  const options: ExportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...opts }
  // 地图底图由调用方叠加，SVG 内部按透明处理
  const bg = options.background === 'map' ? 'transparent' : options.background

  // 1. 投影全部点（按范围筛选后的站点 + 贴纸），决定画布横竖版
  const scopeLineIds = options.scope?.lineIds
  const visibleLines = work.lines.filter(
    (l) =>
      (!scopeLineIds || scopeLineIds.includes(l.id)) &&
      l.visible &&
      l.stationIds.length >= 2,
  )
  const renderStationIds = new Set<string>()
  for (const l of visibleLines) for (const id of l.stationIds) renderStationIds.add(id)
  const stations = [...renderStationIds].map((id) => work.stations[id]).filter(Boolean)
  const projected = new Map<string, Pt>()
  const allPts: Pt[] = []
  for (const st of stations) {
    const p = projectMerc(st.lat, st.lng)
    projected.set(st.id, p)
    allPts.push(p)
  }
  if (options.showStickers) {
    for (const sk of work.stickers) allPts.push(projectMerc(sk.lat, sk.lng))
  }
  if (allPts.length === 0) allPts.push(projectMerc(work.view.lat, work.view.lng))

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of allPts) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  // 按内容范围自适应：放大到较长边约 TARGET_LONG 像素，线路清晰、地图随之放大
  const contentW = Math.max(maxX - minX, 1)
  const contentH = Math.max(maxY - minY, 1)
  const longer = Math.max(contentW, contentH)
  const scale = Math.min(Math.max(TARGET_LONG / longer, SCALE_MIN), SCALE_MAX)
  const fit = fitContent(allPts, 120, scale)
  const W = fit.width
  const H = fit.height

  const parts: string[] = []
  // 注意：font-family 用单引号包裹——XML 双引号属性值内不允许再出现双引号
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${FONT_STACK}'>`,
  )
  if (bg === 'white') {
    parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`)
  }

  // 2. 贴纸（最底层）
  if (options.showStickers) {
    for (const sk of work.stickers) {
      const c = fit.toCanvas(projectMerc(sk.lat, sk.lng))
      const size = Math.round(52 * sk.scale)
      parts.push(
        `<text x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" font-size="${size}" text-anchor="middle" dominant-baseline="central">${esc(sk.emoji)}</text>`,
      )
    }
  }

  // 2.5 自由画笔笔迹（在线路下层，装饰性质）
  for (const fh of work.freehands ?? []) {
    const pts = fh.points.map((p) => fit.toCanvas(projectMerc(p.lat, p.lng)))
    if (pts.length < 2) continue
    const d = straightPathD(pts)
    const w = fh.width === 1 ? 7 : fh.width === 3 ? 16 : 11
    parts.push(
      `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${w + 9}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`,
      `<path d="${d}" fill="none" stroke="${fh.color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
  }

  // 3. 线路（casing + 芯），同时收集线段供站名避让（带端点站 id）
  const segments: { x1: number; y1: number; x2: number; y2: number; a: string; b: string }[] = []
  for (const line of visibleLines) {
    const pts = line.stationIds
      .map((id) => ({ id, p: projected.get(id) }))
      .filter((s): s is { id: string; p: Pt } => Boolean(s.p))
      .map((s) => ({ id: s.id, c: fit.toCanvas(s.p) }))
    if (pts.length < 2) continue
    for (let i = 1; i < pts.length; i++) {
      segments.push({
        x1: pts[i - 1].c.x,
        y1: pts[i - 1].c.y,
        x2: pts[i].c.x,
        y2: pts[i].c.y,
        a: pts[i - 1].id,
        b: pts[i].id,
      })
    }
    // 按站间区间渲染，区分地上/地下（地下=虚线+暗灰描边+降透明度）
    const segs = lineSegments(line, work.stations)
    const lineDashed = (line.style ?? 'solid') === 'dashed'
    for (const part of segs) {
      const under = part.ground === 'under'
      const dashed = under || lineDashed
      const canvasPts = part.pts.map(([lat, lng]) => fit.toCanvas(projectMerc(lat, lng)))
      if (canvasPts.length < 2) continue
      // 平滑模式每段已是密集采样点，用 smoothPathD 生成贝塞尔曲线（C 命令）；
      // 直线段仅 2 点，smoothPathD 退化为直线，行为与旧版一致
      const d = smoothPathD(canvasPts)
      const dashAttr = dashed ? ' stroke-dasharray="22 18"' : ''
      parts.push(
        `<path d="${d}" fill="none" stroke="${under ? '#4b5563' : '#ffffff'}" stroke-width="${under ? LINE_CASING_W - 3 : LINE_CASING_W}" stroke-linecap="round" stroke-linejoin="round" opacity="${under ? 0.6 : 1}"${dashAttr}/>`,
        `<path d="${d}" fill="none" stroke="${line.color}" stroke-width="${under ? LINE_CORE_W - 3 : LINE_CORE_W}" stroke-linecap="round" stroke-linejoin="round" opacity="${under ? 0.85 : 1}"${dashAttr}/>`,
      )
    }
  }

  // 4. 站点
  const stationRects: Rect[] = []
  for (const st of stations) {
    if (!projected.has(st.id)) continue
    const c = fit.toCanvas(projected.get(st.id)!)
    const transfer = isTransfer(work, st.id)
    const color = stationColor(work, st.id)
    const r = transfer ? TRANSFER_R : STATION_R

    // 出口：环绕站点排布（与编辑器一致，角度顺时针由 +x 起算，距离随 dist 远近变化）
    const exits = st.exits ?? []
    if (exits.length) {
      exits.forEach((ex, i) => {
        const er = r + 14 + ((ex.dist ?? 1) - 1) * 20
        const ang = ((ex.angle ?? (i * 360) / exits.length) * Math.PI) / 180
        const ex2 = c.x + er * Math.cos(ang)
        const ey2 = c.y + er * Math.sin(ang)
        parts.push(
          `<circle cx="${ex2.toFixed(1)}" cy="${ey2.toFixed(1)}" r="11" fill="#ffffff" stroke="${color}" stroke-width="3"/>`,
          `<text x="${ex2.toFixed(1)}" y="${ey2.toFixed(1)}" font-size="14" font-weight="700" fill="#333333" text-anchor="middle" dominant-baseline="central">${esc(ex.label)}</text>`,
        )
      })
    }

    if (st.icon) {
      // 自定义 emoji 图标（保留线路色环）
      parts.push(
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r}" fill="#ffffff" stroke="${color}" stroke-width="${transfer ? 5 : 4}"/>`,
        `<text x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" font-size="${transfer ? 34 : 28}" text-anchor="middle" dominant-baseline="central">${esc(st.icon)}</text>`,
      )
    } else if (transfer) {
      parts.push(
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r}" fill="#ffffff" stroke="${color}" stroke-width="6"/>`,
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r - 8}" fill="#ffffff" stroke="${color}" stroke-width="3"/>`,
      )
    } else {
      parts.push(
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r}" fill="#ffffff" stroke="${color}" stroke-width="5"/>`,
      )
    }
    stationRects.push({ x: c.x - r - 2, y: c.y - r - 2, w: (r + 2) * 2, h: (r + 2) * 2 })
  }

  // 5. 站名（8 方位贪心避让 + 白色光晕）
  // 避让时需知道标题与图例的占位，先算好它们的矩形
  const occupiedRects: Rect[] = []
  if (options.showTitle) {
    occupiedRects.push({ x: 20, y: 20, w: Math.max(textWidth(work.name, TITLE_FONT), 260) + 30, h: 110 })
  }
  let legendRect: Rect | null = null
  let legendRows: { color: string; text: string }[] = []
  if (options.showLegend && visibleLines.length > 0) {
    const lineHeight = 44
    const padX = 22
    const padY = 16
    legendRows = visibleLines.map((l) => ({
      color: l.color,
      text: `${l.name}（${l.stationIds.length}站 · ${formatDistance(lineLengthMeters(l, work.stations))}）`,
    }))
    const cardW = Math.max(...legendRows.map((r) => textWidth(r.text, 26))) + padX * 2 + 52
    const cardH = legendRows.length * lineHeight + padY * 2
    legendRect = { x: W - cardW - 28, y: 28, w: cardW, h: cardH }
    occupiedRects.push(legendRect)
  }

  const labelRects: Rect[] = [...occupiedRects]
  const GAP = 16
  stations.forEach((st, idx) => {
    const p = projected.get(st.id)
    if (!p) return
    const c = fit.toCanvas(p)
    const tw = textWidth(st.name, LABEL_FONT)
    const th = LABEL_FONT * 1.25
    // 手动微调优先
    if (st.labelOffset) {
      const x = c.x + GAP + st.labelOffset.dx
      const y = c.y + st.labelOffset.dy
      parts.push(labelText(x, y, st.name, 'start'))
      labelRects.push({ x, y: y - th * 0.8, w: tw, h: th })
      return
    }
    const anchors = idx % 2 === 0 ? ANCHORS_RIGHT_FIRST : ANCHORS_LEFT_FIRST
    let bestRect: Rect | null = null
    let bestAnchor: LabelAnchor | null = null
    let bestCollisions = Infinity
    for (const a of anchors) {
      const dist = GAP + (isTransfer(work, st.id) ? TRANSFER_R : STATION_R) - 4
      const cx = c.x + a.dx * dist
      const cy = c.y + a.dy * dist
      let rect: Rect
      if (a.anchor === 'start') rect = { x: cx, y: cy - th * 0.75, w: tw, h: th }
      else if (a.anchor === 'end') rect = { x: cx - tw, y: cy - th * 0.75, w: tw, h: th }
      else rect = { x: cx - tw / 2, y: cy - th * 0.9, w: tw, h: th }
      let collisions = 0
      for (const r of labelRects) if (rectsOverlap(rect, r)) collisions++
      for (const r of stationRects) if (rectsOverlap(rect, r)) collisions++
      for (const seg of segments) {
        // 跳过与本站相连的线段——站名贴着本站，压到自己的线不可避免，白晕兜底
        if (seg.a === st.id || seg.b === st.id) continue
        if (segmentIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, rect)) collisions++
      }
      if (collisions === 0) {
        bestRect = rect
        bestAnchor = a
        break
      }
      if (collisions < bestCollisions) {
        bestCollisions = collisions
        bestRect = rect
        bestAnchor = a
      }
    }
    if (bestRect && bestAnchor) {
      const x = bestAnchor.anchor === 'start' ? bestRect.x : bestAnchor.anchor === 'end' ? bestRect.x + bestRect.w : bestRect.x + bestRect.w / 2
      const y = bestRect.y + bestRect.h * 0.75
      parts.push(labelText(x, y, st.name, bestAnchor.anchor))
      labelRects.push(bestRect)
    }
  })

  // 6. 图例（右上角白卡，位置已在避让前算好）
  if (legendRect) {
    const lineHeight = 44
    const padX = 22
    const padY = 16
    parts.push(
      `<rect x="${legendRect.x}" y="${legendRect.y}" width="${legendRect.w.toFixed(0)}" height="${legendRect.h}" rx="14" fill="#ffffff" stroke="#dddddd" stroke-width="2" opacity="0.95"/>`,
    )
    legendRows.forEach((r, i) => {
      const y = legendRect!.y + padY + i * lineHeight + lineHeight / 2
      parts.push(
        `<rect x="${legendRect!.x + padX}" y="${y - 8}" width="34" height="16" rx="8" fill="${r.color}"/>`,
        `<text x="${legendRect!.x + padX + 46}" y="${y}" font-size="26" fill="#333333" dominant-baseline="central">${esc(r.text)}</text>`,
      )
    })
  }

  // 7. 标题（左上角）
  if (options.showTitle) {
    const titleText = options.titleOverride ?? work.name
    const date = new Date(work.updatedAt)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    parts.push(
      `<text x="36" y="72" font-size="${TITLE_FONT}" font-weight="bold" fill="#222222" paint-order="stroke" stroke="#ffffff" stroke-width="8">${esc(titleText)}</text>`,
      `<text x="38" y="112" font-size="24" fill="#888888">${dateStr} · 我的地铁设计师</text>`,
    )
  }

  parts.push('</svg>')
  return { svg: parts.join(''), width: W, height: H, fit }
}

function labelText(x: number, y: number, text: string, anchor: string): string {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${LABEL_FONT}" fill="#333333" text-anchor="${anchor}" paint-order="stroke" stroke="#ffffff" stroke-width="5" stroke-linejoin="round">${esc(text)}</text>`
}
