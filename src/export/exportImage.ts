/**
 * 导出图像合成：把地铁线路 SVG 与地图底图背景合成为 PNG / SVG。
 * 支持「整体导出」与「按地铁（每条线路单独）」两种范围（由 opts.scope 控制）。
 */
import type { Work } from '../model/types'
import { exportWorkToSVG, type ExportOptions } from './renderSVG'
import { svgToPngBlob } from './svgToPng'
import { renderMapBackground } from './mapBackground'

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('PNG 合成失败'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 生成失败'))), 'image/png')
  })
}

/** 导出 PNG（含地图底图时放大铺满并叠加背景；失败自动回退为透明/白底） */
export async function exportToPng(
  work: Work,
  opts: ExportOptions,
  baseLayerKey: string,
  scale: number,
): Promise<Blob> {
  const svgOpts: ExportOptions = {
    ...opts,
    background: opts.background === 'map' ? 'transparent' : opts.background,
  }
  const { svg, width, height, fit } = exportWorkToSVG(work, svgOpts)
  if (opts.background !== 'map') {
    return svgToPngBlob(svg, width, height, scale)
  }
  const base = await renderMapBackground(fit, width, height, scale, baseLayerKey)
  if (!base) return svgToPngBlob(svg, width, height, scale)
  const overlay = await svgToPngBlob(svg, width, height, scale)
  const overlayImg = await blobToImage(overlay)
  const out = document.createElement('canvas')
  out.width = base.width
  out.height = base.height
  const ctx = out.getContext('2d')
  if (!ctx) return overlay
  ctx.drawImage(base, 0, 0)
  ctx.drawImage(overlayImg, 0, 0)
  return canvasToBlob(out)
}

/** 导出 SVG 字符串（含地图底图时把底图以 base64 嵌入 <image>，保证自包含） */
export async function exportToSvgString(
  work: Work,
  opts: ExportOptions,
  baseLayerKey: string,
  scale: number,
): Promise<string> {
  const svgOpts: ExportOptions = {
    ...opts,
    background: opts.background === 'map' ? 'transparent' : opts.background,
  }
  const { svg, width, height, fit } = exportWorkToSVG(work, svgOpts)
  if (opts.background !== 'map') return svg
  const base = await renderMapBackground(fit, width, height, scale, baseLayerKey)
  if (!base) return svg
  const dataUrl = base.toDataURL('image/png')
  // 在 <svg ...> 后插入底图，铺满整张画布
  return svg.replace(
    /(<svg[^>]*>)/,
    `$1<image href="${dataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"/>`,
  )
}
