import type { FreehandStroke, Line, Station, Sticker, Work } from './types'
import { newId } from '../utils/id'

/** 儿童友好线路调色板（参照真实地铁常用色 + 高区分度补充色，共 24 种） */
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
  '#E91E63', // 玫红
  '#1DE9B6', // 薄荷
  '#FF6F00', // 深橙
  '#3D5AFE', // 宝蓝
  '#00BFA5', // 蓝绿
  '#D81B60', // 胭脂
  '#AEEA00', // 柠檬
  '#5D4037', // 咖啡
  '#00838F', // 青蓝
  '#8D6E63', // 驼色
  '#C0CA33', // 橄榄
  '#90A4AE', // 蓝灰
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
    defaultGround: 'ground',
  }
}

/** 站点默认图标池（儿童友好的常见地标 emoji）。新车站默认随机取一个，让地图更生动，
 *  不再是清一色圆点；用户仍可在选中栏把单个站改回"默认圆点"。 */
export const STATION_ICON_POOL = [
  '🏥', '🏫', '🏟️', '🚉', '🏰', '⛪',
  '🏦', '🏪', '🌳', '🏖️', '🗼', '🎡',
  '🏠', '🏢', '🚇', '✈️', '🚌', '🚏',
  '🏛️', '🎠', '🏬', '⛲', '🍔', '☕',
  '🛒', '⛽', '🏯', '🗽',
]

export function createStation(name: string, lat: number, lng: number): Station {
  const icon = STATION_ICON_POOL[Math.floor(Math.random() * STATION_ICON_POOL.length)]
  return { id: newId(), name, lat, lng, icon }
}

export function createSticker(emoji: string, lat: number, lng: number): Sticker {
  return { id: newId(), emoji, lat, lng, scale: 1 }
}

export function createFreehand(
  color: string,
  points: { lat: number; lng: number }[],
  width: 1 | 2 | 3 = 2,
  startStationId: string | null = null,
  endStationId: string | null = null,
): FreehandStroke {
  return { id: newId(), color, points, width, startStationId, endStationId }
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
    schemaVersion: CURRENT_SCHEMA_VERSION,
  }
}

/** 旧版本作品数据补默认值（加载/导入时调用，原地修改并返回）。
 *  通过 schemaVersion 做前向迁移，保证老作品在新版本里不丢不乱。 */
export const CURRENT_SCHEMA_VERSION = 2

export function normalizeWork(work: Work): Work {
  const from = work.schemaVersion ?? 1
  for (const line of work.lines) {
    line.style ??= 'solid'
    line.pathMode ??= 'straight'
    line.speedKmh ??= 80
    line.defaultGround ??= 'ground'
  }
  // 站点级新字段（v2：icon / exits）
  for (const st of Object.values(work.stations)) {
    if (from < 2) {
      if (st.exits === undefined) st.exits = []
    }
    // 清理非法出口数据
    if (st.exits && !Array.isArray(st.exits)) st.exits = []
  }
  work.freehands ??= []
  work.schemaVersion = CURRENT_SCHEMA_VERSION
  return work
}
