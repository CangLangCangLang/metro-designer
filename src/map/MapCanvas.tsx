import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import { useEffect } from 'react'
import type L from 'leaflet'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { tileSourceByKey } from './tileLayers'
import { findSnapStation } from './snap'
import { mapRef } from './mapRef'
import { LineLayer } from './LineLayer'
import { StationMarker } from './StationMarker'
import { StickerLayer } from './StickerLayer'
import { TrainLayer } from './TrainLayer'
import { FreehandLayer } from './FreehandLayer'
import { FreehandDrawer } from './FreehandDrawer'

/** 地图事件接线：点击放站/放贴纸、视角变化回写 */
function MapEvents() {
  const map = useMap()
  const addStation = useWorkStore((s) => s.addStation)
  const addSticker = useWorkStore((s) => s.addSticker)
  const setView = useWorkStore((s) => s.setView)
  const selectStation = useUIStore((s) => s.selectStation)
  const selectSticker = useUIStore((s) => s.selectSticker)

  useMapEvents({
    click: (e) => {
      const ui = useUIStore.getState()
      const work = useWorkStore.getState().work
      if (!work) return

      // 放贴纸（保持放置模式，可连续放多个）
      if (ui.placingStickerEmoji) {
        addSticker(ui.placingStickerEmoji, e.latlng.lat, e.latlng.lng)
        return
      }

      // 画线模式：点击放站（自动吸附到附近他线站点形成换乘）
      if (ui.mode === 'draw') {
        let lineId = ui.activeLineId
        if (!lineId) {
          // 没有活动线路时自动建一条，保证「点地图就能画」
          lineId = useWorkStore.getState().addLine()
          useUIStore.getState().setActiveLine(lineId)
        }
        const snap = findSnapStation(map, work, e.latlng, [lineId])
        addStation(lineId, e.latlng.lat, e.latlng.lng, snap?.id)
        return
      }

      // 其他情况：取消选中
      selectStation(null)
      selectSticker(null)
      useUIStore.getState().selectFreehand(null)
    },
    moveend: () => {
      const c = map.getCenter()
      setView({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
    },
  })
  return null
}

/** 把 map 实例同步到全局 ref */
function MapRefSync() {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
    return () => {
      mapRef.current = null
    }
  }, [map])
  return null
}

export function MapCanvas() {
  const work = useWorkStore((s) => s.work)
  const baseLayerKey = useUIStore((s) => s.baseLayerKey)

  if (!work) return null
  const src = tileSourceByKey(baseLayerKey)

  return (
    <MapContainer
      key={work.id}
      ref={mapRef as React.RefObject<L.Map>}
      center={[work.view.lat, work.view.lng]}
      zoom={work.view.zoom}
      zoomSnap={0.5}
      zoomDelta={0.5}
      doubleClickZoom={false}
      zoomControl={false}
      className="map-canvas"
    >
      <TileLayer
        key={src.key}
        url={src.url}
        attribution={src.attribution}
        subdomains={src.subdomains ?? 'abc'}
        maxZoom={src.maxZoom}
        crossOrigin={src.corsSafe ? 'anonymous' : undefined}
      />
      <MapRefSync />
      <MapEvents />
      <ZoomControl position="bottomright" />
      <LineLayer work={work} />
      {Object.values(work.stations).map((st) => (
        <StationMarker key={st.id} station={st} work={work} />
      ))}
      <FreehandLayer />
      <FreehandDrawer />
      <StickerLayer />
      <TrainLayer />
    </MapContainer>
  )
}
