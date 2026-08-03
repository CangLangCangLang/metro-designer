import { Fragment } from 'react'
import { Polyline } from 'react-leaflet'
import type { Work } from '../model/types'
import { lineSegments } from '../utils/lineSegments'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'

/**
 * 线路层：每条线按「站间区间」分别渲染（白描边 casing + 彩色线芯）。
 * 地下段用虚线 + 暗灰描边 + 降低不透明度，与地上段明显区分。
 * 在「调整」模式下，每段额外铺一条透明可点的热区：点某段即可单独切换该段的地上/地下，
 * 实现"站点和下一站点之间"的精确控制，而不是整条线一刀切。
 */
export function LineLayer({ work }: { work: Work }) {
  const mode = useUIStore((s) => s.mode)
  const toggleSegmentGround = useWorkStore((s) => s.toggleSegmentGround)
  const clickable = mode === 'adjust'

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
                    {clickable && (
                      <Polyline
                        positions={part.pts}
                        pathOptions={{
                          color: '#000',
                          weight: 24,
                          opacity: 0.001,
                          className: 'segment-hit',
                          interactive: true,
                        }}
                        bubblingMouseEvents={false}
                        eventHandlers={{
                          click: () => toggleSegmentGround(line.id, part.segIdx),
                        }}
                      />
                    )}
                  </Fragment>
                )
              })}
            </Fragment>
          )
        })}
    </>
  )
}
