import type { FreehandStroke, Line, Station, Sticker, Work } from './types'
import { newId } from '../utils/id'

/** 儿童友好线路调色板（参照真实地铁常用色） */
export const LINE_COLORS = [
  '#E60012', // 红
  '#005BAC', // 蓝
  '#009A44', // 绿
  '#F29600', // 橙
  '#8E24AA', // 紫
  '#00ACC1', // 青
  '#C2185B', // 品红
  '#FDD835', // 黄
  '#6D4C41', // 棕
  '#3949AB', // 靛蓝
  '#7CB342', // 浅绿
  '#757575', // 灰
]

/** 生成下一个线路默认名：1号线、2号线……（跳过已占用的数字） */
export function nextLineName(lines: Line[]): string {
  const used = new Set<number>()
  for (const l of lines) {
    const m = l.name.match(/^(\d+)号线$/)
    if (m) used.add(parseInt(m[1], 10))
  }
  let n = 1
  while (used.has(n)) n++
  return `${n}号线`
}

/** 生成下一个线路默认色：取调色板中使用次数最少的颜色 */
export function nextLineColor(lines: Line[]): string {
  const count = new Map<string, number>()
  for (const l of lines) count.set(l.color, (count.get(l.color) ?? 0) + 1)
  let best = LINE_COLORS[0]
  let bestCount = Infinity
  for (const c of LINE_COLORS) {
    const n = count.get(c) ?? 0
    if (n < bestCount) {
      best = c
      bestCount = n
    }
  }
  return best
}

export function createLine(name: string, color: string): Line {
  return {
    id: newId(),
    name,
    color,
    stationIds: [],
    visible: true,
    train: { enabled: false, speed: 2, mode: 'pingpong' },
    style: 'solid',
    pathMode: 'straight',
    speedKmh: 80,
  }
}

export function createStation(name: string, lat: number, lng: number): Station {
  return { id: newId(), name, lat, lng }
}

export function createSticker(emoji: string, lat: number, lng: number): Sticker {
  return { id: newId(), emoji, lat, lng, scale: 1 }
}

export function createFreehand(
  color: string,
  points: { lat: number; lng: number }[],
  width: 1 | 2 | 3 = 2,
): FreehandStroke {
  return { id: newId(), color, points, width }
}

export function createWork(
  name: string,
  cityKey: string | undefined,
  center: { lat: number; lng: number },
  zoom: number,
): Work {
  const now = Date.now()
  return {
    id: newId(),
    name,
    cityKey,
    view: { lat: center.lat, lng: center.lng, zoom },
    stations: {},
    lines: [],
    stickers: [],
    freehands: [],
    createdAt: now,
    updatedAt: now,
  }
}

/** 旧版本作品数据补默认值（加载/导入时调用，原地修改并返回） */
export function normalizeWork(work: Work): Work {
  for (const line of work.lines) {
    line.style ??= 'solid'
    line.pathMode ??= 'straight'
    line.speedKmh ??= 80
  }
  work.freehands ??= []
  return work
}
