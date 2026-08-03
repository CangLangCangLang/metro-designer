import type { Line, Work } from './types'

/** 引用某站点的所有线路 */
export function linesOfStation(work: Work, stationId: string): Line[] {
  return work.lines.filter((l) => l.stationIds.includes(stationId))
}

/** 是否换乘站：被 2 条及以上线路引用 */
export function isTransfer(work: Work, stationId: string): boolean {
  return linesOfStation(work, stationId).length >= 2
}

/** 站点所属线路中的首条可见线路颜色（用于站点圆环配色），无则灰 */
export function stationColor(work: Work, stationId: string): string {
  const lines = linesOfStation(work, stationId)
  const visible = lines.find((l) => l.visible)
  return (visible ?? lines[0])?.color ?? '#999999'
}

/** 清理不再被任何线路引用的孤立站点，返回新 work（无引用变化时原样返回） */
export function cleanupOrphanStations(work: Work): Work {
  const referenced = new Set<string>()
  for (const l of work.lines) for (const id of l.stationIds) referenced.add(id)
  const orphanIds = Object.keys(work.stations).filter((id) => !referenced.has(id))
  if (orphanIds.length === 0) return work
  const stations = { ...work.stations }
  for (const id of orphanIds) delete stations[id]
  return { ...work, stations }
}

/** 线路的站点数（用于图例/索引统计） */
export function stationCountOf(work: Work): number {
  return Object.keys(work.stations).length
}
