/**
 * 地图底图背景渲染：根据导出画布的 fit（Web Mercator 适配），
 * 反算需要覆盖的瓦片范围，用 CORS 安全的底图源把瓦片绘制到一张画布上，
 * 作为导出 PNG / SVG 的底层「地图背景信息」。
 * 与地铁线路 SVG 共用同一 fit，因此底图与线路严格对齐、且被放大铺满整张图。
 */
import { canvasToLatLng, projectMerc, type FitTransform } from './project'
import { tileSourceByKey } from '../map/tileLayers'

const R = 6378137
const WORLD_M = 2 * Math.PI * R

function tileMercator(x: number, y: number, z: number) {
  const n = 2 ** z
  const lon = (x / n) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))
  const lat = (latRad * 180) / Math.PI
  return { lat, lng: lon }
}

function lon2tileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z)
}
function lat2tileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z,
  )
}

/**
 * 在 W×H（逻辑像素）画布上绘制地图底图，返回放大 outScale 倍的画布。
 * 若瓦片过多或底图不安全，返回 null（调用方回退为白底）。
 */
export async function renderMapBackground(
  fit: FitTransform,
  W: number,
  H: number,
  outScale: number,
  tileKey: string,
): Promise<HTMLCanvasElement | null> {
  const requested = tileSourceByKey(tileKey)
  const src = requested.corsSafe ? requested : tileSourceByKey('carto')
  const maxZoom = src.maxZoom ?? 19

  // 选一个让单张瓦片约 256px 的层级（放大铺满、细节适中）
  const targetPx = 256
  let z = Math.round(Math.log2((WORLD_M * fit.scale) / targetPx))
  z = Math.max(1, Math.min(z, maxZoom))

  // 反算画布四角覆盖的经纬度 → 瓦片范围
  const corners = [
    canvasToLatLng(fit, 0, 0),
    canvasToLatLng(fit, W, 0),
    canvasToLatLng(fit, 0, H),
    canvasToLatLng(fit, W, H),
  ]
  const lngs = corners.map((c) => c.lng)
  const lats = corners.map((c) => c.lat)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)

  const x0 = lon2tileX(minLng, z)
  const x1 = lon2tileX(maxLng, z)
  const yTop = lat2tileY(maxLat, z) // 上沿纬度高 → tile y 小
  const yBot = lat2tileY(minLat, z)
  const y0 = Math.min(yTop, yBot)
  const y1 = Math.max(yTop, yBot)

  const tileCount = (x1 - x0 + 1) * (y1 - y0 + 1)
  if (tileCount > 400) return null // 过多：放弃底图，避免超长加载

  const sub = src.subdomains ?? 'a'
  const urlFor = (x: number, y: number) =>
    src.url
      .replace('{s}', sub[0])
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * outScale)
  canvas.height = Math.round(H * outScale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // 浅色兜底，避免瓦片间隙露白
  ctx.fillStyle = '#e9edf2'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const loadTile = (x: number, y: number) =>
    new Promise<void>((resolve) => {
      // 网络不可达时也得在超时后继续，避免导出卡死
      const timer = setTimeout(() => resolve(), 5000)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        clearTimeout(timer)
        try {
          const m0 = tileMercator(x, y, z)
          const m1 = tileMercator(x + 1, y + 1, z)
          const c0 = fit.toCanvas(projectMerc(m0.lat, m0.lng))
          const c1 = fit.toCanvas(projectMerc(m1.lat, m1.lng))
          const dw = Math.abs(c1.x - c0.x) * outScale
          const dh = Math.abs(c1.y - c0.y) * outScale
          const dx = Math.min(c0.x, c1.x) * outScale
          const dy = Math.min(c0.y, c1.y) * outScale
          ctx.drawImage(img, dx, dy, dw, dh)
        } catch {
          /* 单张失败忽略 */
        }
        resolve()
      }
      img.onerror = () => {
        clearTimeout(timer)
        resolve()
      }
      img.src = urlFor(x, y)
    })

  // 并发加载所有瓦片（无网时各自 5s 超时，并发后整体不超过 5s）
  const tileJobs: Promise<void>[] = []
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      tileJobs.push(loadTile(x, y))
    }
  }
  await Promise.all(tileJobs)
  return canvas
}
