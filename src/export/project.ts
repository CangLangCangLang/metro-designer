/** Web Mercator (EPSG:3857) 投影与画布适配：导出 SVG 的数学基础，零 Leaflet 依赖 */

export interface Pt {
  x: number
  y: number
}

const R = 6378137

/** 经纬度 → Web Mercator 米 */
export function projectMerc(lat: number, lng: number): Pt {
  const clampedLat = Math.max(-85, Math.min(85, lat))
  return {
    x: (R * lng * Math.PI) / 180,
    y: R * Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360)),
  }
}

export interface FitTransform {
  /** mercator 点 → 画布坐标（y 轴翻转为屏幕方向） */
  toCanvas(p: Pt): Pt
  width: number
  height: number
  /** 1 mercator 米对应的画布单位 */
  scale: number
  /** 内部 bbox 与偏移（供逆向投影用） */
  minX: number
  minY: number
  offX: number
  offY: number
}

/**
 * 把点集 bbox 适配进 width×height 画布（含 padding），居中、保持比例。
 */
export function fitToCanvas(
  pts: Pt[],
  width: number,
  height: number,
  padding: number,
): FitTransform {
  if (pts.length === 0) {
    return {
      toCanvas: () => ({ x: width / 2, y: height / 2 }),
      width,
      height,
      scale: 1,
      minX: 0,
      minY: 0,
      offX: 0,
      offY: 0,
    }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const bw = Math.max(maxX - minX, 1)
  const bh = Math.max(maxY - minY, 1)
  const innerW = Math.max(width - padding * 2, 10)
  const innerH = Math.max(height - padding * 2, 10)
  const scale = Math.min(innerW / bw, innerH / bh)
  // 居中偏移
  const drawnW = bw * scale
  const drawnH = bh * scale
  const offX = (width - drawnW) / 2
  const offY = (height - drawnH) / 2
  return {
    width,
    height,
    scale,
    minX,
    minY,
    offX,
    offY,
    toCanvas(p: Pt): Pt {
      return {
        x: offX + (p.x - minX) * scale,
        // y 翻转：mercator y 向北增大，画布 y 向下增大
        y: height - (offY + (p.y - minY) * scale),
      }
    },
  }
}

/**
 * 按内容 bbox 直接决定画布尺寸（不再限定 A4 等固定页面）：
 * W = 内容宽*scale + 2*padding，H 同理；内容居中、比例自然。
 * 用于导出「按线路范围自适应大小、且地图放大铺满」的图片。
 */
export function fitContent(
  pts: Pt[],
  padding: number,
  scale: number,
): FitTransform {
  if (pts.length === 0) {
    return {
      toCanvas: () => ({ x: padding, y: padding }),
      width: padding * 2,
      height: padding * 2,
      scale,
      minX: 0,
      minY: 0,
      offX: padding,
      offY: padding,
    }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const bw = Math.max(maxX - minX, 1)
  const bh = Math.max(maxY - minY, 1)
  const W = Math.ceil(bw * scale + padding * 2)
  const H = Math.ceil(bh * scale + padding * 2)
  return {
    width: W,
    height: H,
    scale,
    minX,
    minY,
    offX: padding,
    offY: padding,
    toCanvas(p: Pt): Pt {
      return {
        x: padding + (p.x - minX) * scale,
        y: H - (padding + (p.y - minY) * scale),
      }
    },
  }
}

/**
 * 画布像素坐标 → 经纬度（fit.toCanvas 的逆运算），用于反算底图瓦片范围。
 */
export function canvasToLatLng(
  fit: FitTransform,
  cx: number,
  cy: number,
): { lat: number; lng: number } {
  const R = 6378137
  const mx = fit.minX + (cx - fit.offX) / fit.scale
  const mercY = fit.minY + (fit.height - cy - fit.offY) / fit.scale
  const lng = (mx * 180) / (R * Math.PI)
  const lat = (2 * Math.atan(Math.exp(mercY / R)) - Math.PI / 2) * (180 / Math.PI)
  return { lat, lng }
}
