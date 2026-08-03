import { Fragment } from 'react'
import { Polyline } from 'react-leaflet'
import type { Work } from '../model/types'
import { smoothSample } from '../utils/smooth'

/** 线路层：每条线渲染双层 polyline（白描边 casing + 彩色线芯），经典地铁图样式 */
export function LineLayer({ work }: { work: Work }) {
  return (
    <>
      {work.lines
        .filter((l) => l.visible && l.stationIds.length >= 2)
        .map((line) => {
          const raw = line.stationIds
            .map((id) => work.stations[id])
            .filter((s): s is NonNullable<typeof s> => Boolean(s))
          if (raw.length < 2) return null
          // 曲线模式：Catmull-Rom 密点采样；直线模式：站间直连
          const pts =
            (line.pathMode ?? 'straight') === 'smooth'
              ? smoothSample(raw.map((s) => ({ x: s.lat, y: s.lng }))).map(
                  (p) => [p.x, p.y] as [number, number],
                )
              : raw.map((s) => [s.lat, s.lng] as [number, number])
          const dashed = (line.style ?? 'solid') === 'dashed'
          return (
            <Fragment key={line.id}>
              <Polyline
                positions={pts}
                pathOptions={{
                  color: '#ffffff',
                  weight: 9,
                  opacity: 0.9,
                  lineCap: 'round',
                  lineJoin: 'round',
                  ...(dashed ? { dashArray: '13 11' } : {}),
                }}
                interactive={false}
              />
              <Polyline
                positions={pts}
                pathOptions={{
                  color: line.color,
                  weight: 5,
                  opacity: 1,
                  lineCap: 'round',
                  lineJoin: 'round',
                  ...(dashed ? { dashArray: '13 11' } : {}),
                }}
                interactive={false}
              />
            </Fragment>
          )
        })}
    </>
  )
}
