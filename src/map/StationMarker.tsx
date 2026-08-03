import { useMemo } from 'react'
import { Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Station, Work } from '../model/types'
import { cleanupOrphanStations, isTransfer, linesOfStation, stationColor } from '../model/transfer'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { findSnapStation } from './snap'

interface Props {
  station: Station
  work: Work
}

function stationIcon(color: string, transfer: boolean, selected: boolean, snapPreview: boolean) {
  const cls = [
    'st-dot',
    transfer ? 'transfer' : '',
    selected ? 'selected' : '',
    snapPreview ? 'snap-preview' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return L.divIcon({
    className: 'station-marker',
    html: `<div class="${cls}" style="--c:${color}"></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

/** 站名在其首条线路中的序号（用于奇偶交替摆放标签） */
function indexInFirstLine(work: Work, stationId: string): number {
  const line = linesOfStation(work, stationId)[0]
  return line ? line.stationIds.indexOf(stationId) : 0
}

export function StationMarker({ station, work }: Props) {
  const map = useMap()
  const mode = useUIStore((s) => s.mode)
  const selectedStationId = useUIStore((s) => s.selectedStationId)
  const snapPreviewId = useUIStore((s) => s.snapPreviewStationId)
  const selectStation = useUIStore((s) => s.selectStation)
  const setSnapPreview = useUIStore((s) => s.setSnapPreview)
  const pushUndoSnapshot = useWorkStore((s) => s.pushUndoSnapshot)
  const moveStation = useWorkStore((s) => s.moveStation)
  const mutate = useWorkStore((s) => s.mutate)

  const transfer = isTransfer(work, station.id)
  const color = stationColor(work, station.id)
  const selected = selectedStationId === station.id
  const snapPreview = snapPreviewId === station.id

  const icon = useMemo(
    () => stationIcon(color, transfer, selected, snapPreview),
    [color, transfer, selected, snapPreview],
  )

  // 站名标签：奇偶交替左右摆放；手动微调优先
  const idx = indexInFirstLine(work, station.id)
  const dir = idx % 2 === 0 ? 'right' : 'left'
  const baseOffset: [number, number] = dir === 'right' ? [14, 0] : [-14, 0]
  const offset: [number, number] = station.labelOffset
    ? [baseOffset[0] + station.labelOffset.dx, baseOffset[1] + station.labelOffset.dy]
    : baseOffset

  /** 当前数据下，该站拖拽时的吸附目标（排除它所在所有线路上的站） */
  const snapTarget = (latlng: { lat: number; lng: number }): Station | null => {
    const currentWork = useWorkStore.getState().work
    if (!currentWork) return null
    const myLineIds = linesOfStation(currentWork, station.id).map((l) => l.id)
    return findSnapStation(map, currentWork, latlng, myLineIds)
  }

  return (
    <Marker
      position={[station.lat, station.lng]}
      icon={icon}
      draggable={mode === 'adjust'}
      eventHandlers={{
        click: (e) => {
          e.originalEvent.stopPropagation()
          const ui = useUIStore.getState()
          // 画线模式下点击已有站 = 把它连进当前线路（自动形成换乘，不用瞄准吸附）
          if (ui.mode === 'draw' && ui.activeLineId) {
            const line = useWorkStore.getState().work?.lines.find((l) => l.id === ui.activeLineId)
            if (line && !line.stationIds.includes(station.id)) {
              useWorkStore
                .getState()
                .addStation(ui.activeLineId, station.lat, station.lng, station.id)
              return
            }
          }
          selectStation(station.id)
        },
        dragstart: () => {
          pushUndoSnapshot()
          map.dragging.disable()
        },
        drag: (e) => {
          const latlng = (e.target as L.Marker).getLatLng()
          setSnapPreview(snapTarget(latlng)?.id ?? null)
        },
        dragend: (e) => {
          map.dragging.enable()
          const latlng = (e.target as L.Marker).getLatLng()
          setSnapPreview(null)
          const hit = snapTarget(latlng)
          const currentWork = useWorkStore.getState().work
          if (!currentWork) return
          const myLines = linesOfStation(currentWork, station.id)
          if (hit && hit.id !== station.id && myLines.length === 1) {
            // 只属一条线：把本线引用替换为目标站，孤立的本站被清理 → 完成合并
            const lineId = myLines[0].id
            mutate((w) =>
              cleanupOrphanStations({
                ...w,
                lines: w.lines.map((l) =>
                  l.id === lineId
                    ? { ...l, stationIds: l.stationIds.map((id) => (id === station.id ? hit.id : id)) }
                    : l,
                ),
              }),
            )
          } else {
            moveStation(station.id, latlng.lat, latlng.lng)
          }
        },
      }}
    >
      <Tooltip permanent direction={dir} offset={offset} className="station-label">
        {station.name}
      </Tooltip>
    </Marker>
  )
}
