import type L from 'leaflet'
import type { Station, Work } from '../model/types'

/** 吸附半径（屏幕像素）：大于站点 34px 命中区，确保点击站点附近即可连为换乘 */
export const SNAP_PX = 34

/**
 * 查找吸附目标：latlng 附近 SNAP_PX 内、且不在 excludeLineIds 中任何线路上的最近站点。
 * 命中即可复用该站点形成换乘。
 */
export function findSnapStation(
  map: L.Map,
  work: Work,
  latlng: { lat: number; lng: number },
  excludeLineIds: string[],
): Station | null {
  const onExcludedLines = new Set<string>()
  for (const lineId of excludeLineIds) {
    const line = work.lines.find((l) => l.id === lineId)
    if (line) for (const id of line.stationIds) onExcludedLines.add(id)
  }
  const p = map.latLngToContainerPoint([latlng.lat, latlng.lng])
  let best: Station | null = null
  let bestDist = SNAP_PX
  for (const st of Object.values(work.stations)) {
    if (onExcludedLines.has(st.id)) continue
    const d = p.distanceTo(map.latLngToContainerPoint([st.lat, st.lng]))
    if (d < bestDist) {
      bestDist = d
      best = st
    }
  }
  return best
}
