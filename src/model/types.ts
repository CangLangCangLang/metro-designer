/** 站点：唯一地理实体，可被多条线路引用（换乘站的关键设计） */
export interface Station {
  id: string
  name: string
  lat: number
  lng: number
  /** 导出/编辑器标注手动微调偏移（像素） */
  labelOffset?: { dx: number; dy: number }
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
