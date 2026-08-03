import { Fragment } from 'react'
import { Polyline } from 'react-leaflet'
import type { Work } from '../model/types'
import { lineSegments } from '../utils/lineSegments'

/**
 * 线路层：每条线按「站间区间」分别渲染（白描边 casing + 彩色线芯）。
 * 地下段用虚线 + 暗灰描边 + 降低不透明度，与地上段明显区分。
 */
export function LineLayer({ work }: { work: Work }) {
  return (
    <>
      {work.lines
        .filter((l) => l.visible && l.stationIds.length >= 2)
        .map((line) => {
          const parts = lineSegments(line, work.stations)
          if (parts.length === 0) return null
          const lineDashed = (line.style ?? 'solid') === 'dashed'
          return (
            <Fragment key={line.id}>
              {parts.map((part) => {
                const under = part.ground === 'under'
                const dashed = under || lineDashed
                const dashArr = dashed ? '13 11' : undefined
                return (
                  <Fragment key={`${line.id}-${part.segIdx}`}>
                    <Polyline
                      positions={part.pts}
                      pathOptions={{
                        color: under ? '#4b5563' : '#ffffff',
                        weight: under ? 8 : 9,
                        opacity: under ? 0.65 : 0.9,
                        lineCap: 'round',
                        lineJoin: 'round',
                        ...(dashArr ? { dashArray: dashArr } : {}),
                      }}
                      interactive={false}
                    />
                    <Polyline
                      positions={part.pts}
                      pathOptions={{
                        color: line.color,
                        weight: under ? 4 : 5,
                        opacity: under ? 0.8 : 1,
                        lineCap: 'round',
                        lineJoin: 'round',
                        ...(dashArr ? { dashArray: dashArr } : {}),
                      }}
                      interactive={false}
                    />
                  </Fragment>
                )
              })}
            </Fragment>
          )
        })}
    </>
  )
}
