/** 底图源注册表：集中管理，任何源失效一行切换 */
export interface TileSource {
  key: string
  name: string
  emoji: string
  url: string
  attribution: string
  subdomains?: string
  maxZoom: number
  /** 是否有 CORS 头（未来含底图导出时过滤用） */
  corsSafe: boolean
}

export const TILE_SOURCES: TileSource[] = [
  {
    key: 'gaode',
    name: '中文地图',
    emoji: '🗺️',
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    attribution: '&copy; 高德地图',
    subdomains: '1234',
    maxZoom: 18,
    corsSafe: false,
  },
  {
    key: 'carto',
    name: '浅色简洁',
    emoji: '⬜',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
    corsSafe: true,
  },
  {
    key: 'osm',
    name: '开放地图',
    emoji: '🌍',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    corsSafe: true,
  },
  {
    key: 'satellite',
    name: '卫星图',
    emoji: '🛰️',
    url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    attribution: '&copy; 高德地图',
    subdomains: '1234',
    maxZoom: 18,
    corsSafe: false,
  },
]

export const DEFAULT_TILE_KEY = 'gaode'

export function tileSourceByKey(key: string): TileSource {
  return TILE_SOURCES.find((s) => s.key === key) ?? TILE_SOURCES[0]
}
