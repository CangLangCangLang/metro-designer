import { Marker } from 'react-leaflet'
import L from 'leaflet'
import type { Sticker } from '../model/types'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'

function stickerIcon(s: Sticker, selected: boolean) {
  return L.divIcon({
    className: 'sticker-marker',
    html: `<div class="sticker-body ${selected ? 'selected' : ''}" style="font-size:${Math.round(
      28 * s.scale,
    )}px${s.rotation ? `;transform:rotate(${s.rotation}deg)` : ''}">${s.emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

export function StickerLayer() {
  const work = useWorkStore((s) => s.work)
  const pushUndoSnapshot = useWorkStore((s) => s.pushUndoSnapshot)
  const updateSticker = useWorkStore((s) => s.updateSticker)
  const mode = useUIStore((s) => s.mode)
  const selectedStickerId = useUIStore((s) => s.selectedStickerId)
  const selectSticker = useUIStore((s) => s.selectSticker)

  if (!work) return null

  return (
    <>
      {work.stickers.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={stickerIcon(s, selectedStickerId === s.id)}
          draggable={mode === 'adjust'}
          eventHandlers={{
            click: (e) => {
              e.originalEvent.stopPropagation()
              selectSticker(s.id)
            },
            dragstart: () => pushUndoSnapshot(),
            dragend: (e) => {
              const latlng = (e.target as L.Marker).getLatLng()
              updateSticker(s.id, { lat: latlng.lat, lng: latlng.lng })
            },
          }}
        />
      ))}
    </>
  )
}
