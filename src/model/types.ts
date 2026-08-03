/** 站点出口（环绕站点的小标记，可自定义编号如 A/B/C） */
export interface StationExit {
  id: string
  /** 出口编号/名称，如 "A"、"B1" */
  label: string
  /** 出口方向角（度，0=正右/东，顺时针）。不填则按序号均匀环绕 */
  angle?: number
}

/** 站点：唯一地理实体，可被多条线路引用（换乘站的关键设计） */
export interface Station {
  id: string
  name: string
  lat: number
  lng: number
  /** 导出/编辑器标注手动微调偏移（像素） */
  labelOffset?: { dx: number; dy: number }
  /** 自定义站点图标 emoji（如 🏥🏫）；不填则显示默认圆环圆点 */
  icon?: string
  /** 站点出口列表（环绕显示，含编号） */
  exits?: StationExit[]
}

export type TrainSpeed = 1 | 2 | 3
export type TrainMode = 'loop' | 'pingpong'

/** 线样式：solid 实线 / dashed 虚线（规划中的线路） */
export type LineStyle = 'solid' | 'dashed'
/** 线路径：straight 直线段 / smooth 平滑曲线 */
export type PathMode = 'straight' | 'smooth'

export interface Line {
  id: string
  name: string
  color: string
  /** 有序站点 id 列表，引用共享站点池 */
  stationIds: string[]
  visible: boolean
  train: {
    enabled: boolean
    speed: TrainSpeed
    mode: TrainMode
  }
  /** 线样式，默认 solid（旧作品数据可能缺） */
  style?: LineStyle
  /** 路径模式，默认 straight（旧作品数据可能缺） */
  pathMode?: PathMode
  /** 线路时速 km/h，默认 80 */
  speedKmh?: number
  /** 区间时速覆盖：key 为区间序号（stationIds[i]→stationIds[i+1] 的 i），值 km/h */
  segmentSpeeds?: Record<number, number>
  /** 线路默认地上/地下（未单独设置区间时跟随此项），默认 ground */
  defaultGround?: 'ground' | 'under'
  /** 区间地上/地下标记：key 同 segmentSpeeds（stationIds[i]→stationIds[i+1] 的 i） */
  segmentGround?: Record<number, 'ground' | 'under'>
}

/** 自由画笔笔迹（手绘装饰线，无站点概念、不计里程） */
export interface FreehandStroke {
  id: string
  color: string
  /** 手绘路径点（已抽稀） */
  points: { lat: number; lng: number }[]
  /** 线宽档：1 细 / 2 中 / 3 粗 */
  width: 1 | 2 | 3
}

export interface Sticker {
  id: string
  emoji: string
  lat: number
  lng: number
  scale: number
  rotation?: number
}

export interface Work {
  id: string
  name: string
  cityKey?: string
  view: { lat: number; lng: number; zoom: number }
  /** 共享站点池 */
  stations: Record<string, Station>
  lines: Line[]
  stickers: Sticker[]
  /** 自由画笔笔迹（旧作品数据可能缺） */
  freehands?: FreehandStroke[]
  createdAt: number
  updatedAt: number
  /** 数据架构版本（旧作品可能缺）；normalizeWork 据此迁移，保证前后兼容 */
  schemaVersion?: number
}

/** 画廊索引条目 */
export interface WorkIndexItem {
  id: string
  name: string
  updatedAt: number
  lineCount: number
  stationCount: number
  thumbnail?: string
}

/** JSON 导出文件格式 */
export interface WorkFile {
  app: 'metro-designer'
  version: 1
  exportedAt: string
  work: Work
}
