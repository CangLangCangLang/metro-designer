import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { buildRouteGeom, pointAtDistance, type RouteGeom } from './routeGeom'
import { metersPerPixel } from '../utils/geo'

/** 时速→屏幕速度换算系数：80km/h 在 1x 播放倍率下约 170px/s（任何缩放级别速度感一致） */
const PX_PER_KMH = 2.1

interface TrainRuntime {
  marker: L.Marker
  geom: RouteGeom
  dist: number
  dir: 1 | -1
  lineId: string
}

function trainIcon(color: string) {
  return L.divIcon({
    className: 'train-marker',
    html: `<div class="train-token" style="--c:${color}"><div class="train-arrow"></div><span class="train-emoji">🚇</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

/** 列车动画层：单 rAF 循环驱动所有列车，按屏幕像素匀速（缩放自适应） */
export function TrainLayer() {
  const map = useMap()
  const work = useWorkStore((s) => s.work)
  const trainsRef = useRef(new Map<string, TrainRuntime>())

  // 同步列车与线路配置
  useEffect(() => {
    const trains = trainsRef.current
    const activeLines = (work?.lines ?? []).filter(
      (l) => l.train.enabled && l.visible && l.stationIds.length >= 2,
    )
    const activeIds = new Set(activeLines.map((l) => l.id))

    // 移除失效列车
    for (const [id, t] of trains) {
      if (!activeIds.has(id)) {
        t.marker.remove()
        trains.delete(id)
      }
    }

    // 新增 / 更新
    for (const line of activeLines) {
      const geom = buildRouteGeom(line, work!.stations)
      if (geom.total < 1) continue
      const existing = trains.get(line.id)
      if (existing) {
        existing.geom = geom
        existing.dist = Math.min(existing.dist, geom.total)
        existing.marker.setIcon(trainIcon(line.color))
      } else {
        const marker = L.marker([geom.pts[0].lat, geom.pts[0].lng], {
          icon: trainIcon(line.color),
          interactive: false,
          keyboard: false,
          zIndexOffset: 1000,
        }).addTo(map)
        trains.set(line.id, { marker, geom, dist: 0, dir: 1, lineId: line.id })
      }
    }
  }, [work, map])

  // 单 rAF 动画循环
  useEffect(() => {
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const playing = useUIStore.getState().trainPlaying
      if (playing) {
        const currentWork = useWorkStore.getState().work
        const scale = useUIStore.getState().trainSpeedScale
        const mpp = metersPerPixel(map.getCenter().lat, map.getZoom())
        for (const t of trainsRef.current.values()) {
          const line = currentWork?.lines.find((l) => l.id === t.lineId)
          if (!line) continue
          const { latlng, bearing, segIdx } = pointAtDistance(t.geom, t.dist)
          // 当前区间时速（可被 segmentSpeeds 覆盖）× 换算系数 × 播放倍率
          const kmh = line.segmentSpeeds?.[segIdx] ?? line.speedKmh ?? 80
          const speed = kmh * PX_PER_KMH * scale * mpp
          t.dist += t.dir * speed * dt
          if (line.train.mode === 'loop') {
            if (t.dist > t.geom.total) t.dist -= t.geom.total
            if (t.dist < 0) t.dist += t.geom.total
          } else {
            if (t.dist >= t.geom.total) {
              t.dist = t.geom.total
              t.dir = -1
            } else if (t.dist <= 0) {
              t.dist = 0
              t.dir = 1
            }
          }
          t.marker.setLatLng(latlng)
          // 容器随行进方向旋转；emoji 反向旋转保持正向
          const root = t.marker.getElement()
          const token = root?.querySelector<HTMLElement>('.train-token')
          const emoji = root?.querySelector<HTMLElement>('.train-emoji')
          if (token) token.style.transform = `rotate(${bearing}deg)`
          if (emoji) emoji.style.transform = `rotate(${-bearing}deg)`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [map])

  return null
}
